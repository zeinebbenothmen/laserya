const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['pending', 'confirmed', 'in_production', 'ready', 'delivered', 'cancelled'];
// Livraison gratuite partout (la propriétaire offre la livraison).
const DELIVERY_COSTS = { home: 0, express: 0, pickup: 0 };

// POST /api/orders  — passer une commande (public)
router.post('/', (req, res) => {
  const { customer_name, customer_phone, customer_email, customer_address,
          delivery_method, payment_method, items, notes } = req.body;

  if (!customer_name || !customer_phone)
    return res.status(400).json({ error: 'Nom et téléphone requis' });
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Panier vide' });

  const db = getDb();
  const pricedItems = [];
  for (const item of items) {
    const custom = item.customOptions || {};
    if (custom.type === 'Impression 3D sur mesure' && !custom.quote_id)
      return res.status(400).json({ error: 'Le devis d’impression 3D est incomplet. Recommencez l’estimation.' });
    if (!custom.quote_id) {
      pricedItems.push(item);
      continue;
    }
    const quote = db.prepare('SELECT * FROM print3d_price_quotes WHERE id = ?').get(String(custom.quote_id));
    if (!quote) return res.status(400).json({ error: 'Devis introuvable. Relancez l’analyse de votre modèle STL.' });
    if (quote.consumed_order_id) return res.status(409).json({ error: 'Ce devis a déjà été utilisé. Relancez une estimation.' });
    const createdAt = Date.parse(`${quote.created_at.replace(' ', 'T')}Z`);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 24 * 60 * 60 * 1000)
      return res.status(410).json({ error: 'Ce devis a expiré après 24 heures. Relancez l’analyse pour obtenir un prix à jour.' });
    if (parseInt(item.quantity, 10) !== quote.quantity)
      return res.status(409).json({ error: 'La quantité du devis a changé. Relancez l’analyse avec la nouvelle quantité.' });
    let details;
    try { details = JSON.parse(quote.details); }
    catch { return res.status(500).json({ error: 'Les détails du devis ne sont pas disponibles.' }); }
    pricedItems.push({
      id: `custom3d-${quote.id}`,
      name: details.name,
      price: quote.unit_price,
      quantity: quote.quantity,
      image_url: details.photo_url,
      customOptions: { ...details, quote_id: quote.id },
    });
  }

  const delivery = delivery_method || 'home';
  const deliveryCost = DELIVERY_COSTS[delivery] ?? 0;
  const subtotal = pricedItems.reduce((s, i) => s + (parseFloat(i.price) * (parseInt(i.quantity) || 1)), 0);
  const total = subtotal + deliveryCost;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO orders
      (id, customer_name, customer_phone, customer_email, customer_address,
       delivery_method, payment_method, items, subtotal, delivery_cost, total, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, customer_name, customer_phone, customer_email || '',
    customer_address || '', delivery, payment_method || 'cash',
    JSON.stringify(pricedItems), subtotal, deliveryCost, total, notes || ''
  );
  for (const item of pricedItems) {
    const quoteId = item.customOptions?.quote_id;
    if (quoteId) db.prepare('UPDATE print3d_price_quotes SET consumed_order_id = ? WHERE id = ?').run(id, quoteId);
  }

  res.status(201).json({ id, total, success: true });

  // Email de confirmation avec le code de suivi (non bloquant)
  require('../mailer')
    .sendOrderEmail({ id, customer_name, customer_email, items: pricedItems, total })
    .catch(() => {});
});

// GET /api/orders  — liste admin (protected)
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const { status, search } = req.query;

  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    sql += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR id LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY created_at DESC';

  const orders = db.prepare(sql).all(...params);
  res.json(orders.map(o => ({ ...o, items: JSON.parse(o.items) })));
});

// GET /api/orders/track/:id  — suivi public par ID complet OU par numéro court (8 car.)
router.get('/track/:id', (req, res) => {
  const db = getDb();
  const raw = (req.params.id || '').trim().toLowerCase();
  // Correspondance exacte d'abord, sinon par préfixe (numéro court affiché au client)
  let order = db.prepare('SELECT * FROM orders WHERE lower(id) = ?').get(raw);
  if (!order) order = db.prepare("SELECT * FROM orders WHERE lower(id) LIKE ? ORDER BY created_at DESC LIMIT 1").get(raw + '%');
  if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
  const { customer_phone, ...safeOrder } = order;
  res.json({ ...safeOrder, items: JSON.parse(order.items) });
});

// GET /api/orders/:id  — détail admin (protected)
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
  res.json({ ...order, items: JSON.parse(order.items) });
});

// PUT /api/orders/:id/status  (admin only)
router.put('/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status))
    return res.status(400).json({ error: `Statut invalide. Valeurs: ${VALID_STATUSES.join(', ')}` });

  const db = getDb();
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande non trouvée' });

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true, status });
});

// DELETE /api/orders/:id  (admin only)
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/orders/stats/summary  (admin only)
router.get('/stats/summary', authMiddleware, (req, res) => {
  const db = getDb();
  const total    = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const pending  = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='pending'").get().c;
  const inProd   = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='in_production'").get().c;
  const delivered= db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='delivered'").get().c;
  const revenue  = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status='delivered'").get().s;
  res.json({ total, pending, inProd, delivered, revenue });
});

module.exports = router;
