require('dotenv').config({ path: require('path').join(__dirname, '.env') }); // charge backend/.env (SMTP, etc.)
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const { initDb, getDb }  = require('./db');
const { authMiddleware } = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Uploads folder ─────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://localhost:5500', 'http://127.0.0.1:5500',
    'http://localhost:3001', 'http://127.0.0.1:3001',
    'null'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers uploadés
app.use('/uploads/_print_estimate_drafts', (req, res) => res.sendStatus(404));
app.use('/uploads', express.static(uploadsDir));

// Servir les pages HTML statiques depuis frontend/
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── Routes (chargées après init DB) ─────────────────────────
async function startServer() {
  await initDb();
  console.log('✅ Base de données initialisée');

  // Monter les routes après init DB
  app.use('/api/auth',            require('./routes/auth'));
  app.use('/api/products',        require('./routes/products'));
  app.use('/api/orders',          require('./routes/orders'));
  app.use('/api/custom-requests', require('./routes/customRequests'));
  app.use('/api/3d-print',        require('./routes/print3d'));
  app.use('/api/spools',          require('./routes/spools'));
  app.use('/api/printers',        require('./routes/printers'));

  // Connexion aux imprimantes 3D configurées (MQTT local Bambu Lab)
  try {
    require('./bambu').reload(getDb().prepare('SELECT * FROM printers').all());
  } catch (e) { console.warn('⚠️  Imprimantes 3D : init MQTT ignorée —', e.message); }

  // ── Stats globales admin ──────────────────────────────────
  app.get('/api/stats', authMiddleware, (req, res) => {
    const db = getDb();
    const products     = db.prepare('SELECT COUNT(*) as c FROM products WHERE active=1').get().c;
    const totalOrders  = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const pending      = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='pending'").get().c;
    const inProd       = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='in_production'").get().c;
    const revenue      = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status='delivered'").get().s;
    const customReqs   = db.prepare("SELECT COUNT(*) as c FROM custom_requests WHERE status='new'").get().c;
    const print3dReqs  = db.prepare("SELECT COUNT(*) as c FROM print3d_quotes WHERE status='new'").get().c;
    const recentOrders = db.prepare(
      'SELECT id, customer_name, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5'
    ).all();
    res.json({ products, totalOrders, pending, inProd, revenue, customReqs, print3dReqs, recentOrders });
  });

  // ── Best-sellers : produits les plus vendus (agrégés depuis les commandes) ─
  app.get('/api/stats/best-sellers', authMiddleware, (req, res) => {
    const db = getDb();
    // On exclut les commandes annulées du calcul des ventes.
    const rows = db.prepare("SELECT items FROM orders WHERE status != 'cancelled'").all();
    const map = {};
    for (const r of rows) {
      let items = [];
      try { items = JSON.parse(r.items); } catch { items = []; }
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        const key = it.id || it.name;
        if (!key) continue;
        if (!map[key]) map[key] = { id: it.id || null, name: it.name || 'Produit', units: 0, revenue: 0, image_url: it.image_url || '' };
        const qty   = parseInt(it.quantity) || 1;
        const price = parseFloat(it.price) || 0;
        map[key].units   += qty;
        map[key].revenue += qty * price;
      }
    }
    const list = Object.values(map);
    // Enrichir avec les données produit actuelles (image, mise en avant, existence).
    for (const row of list) {
      row.featured = false;
      row.exists   = false;
      if (row.id) {
        const p = db.prepare('SELECT image_url, featured FROM products WHERE id = ?').get(row.id);
        if (p) { row.image_url = p.image_url || row.image_url; row.featured = !!p.featured; row.exists = true; }
      }
    }
    list.sort((a, b) => b.units - a.units);
    res.json(list);
  });

  // ── Health check ──────────────────────────────────────────
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
  });

  // ── Routes propres (clean URLs sans .html) ────────────────
  const CLEAN_ROUTES = {
    '/shop':             'pages/shop.html',
    '/product':          'pages/product.html',
    '/custom-order':     'pages/custom-order.html',
    '/create-design':    'pages/create-design.html',
    '/cart':             'pages/cart.html',
    '/checkout':         'pages/checkout-info.html',
    '/checkout/info':    'pages/checkout-info.html',
    '/checkout/delivery':'pages/checkout-delivery.html',
    '/checkout/payment': 'pages/checkout-payment.html',
    '/checkout/review':  'pages/checkout-review.html',
    '/order-confirmed':  'pages/order-confirmed.html',
    '/my-orders':        'pages/my-orders.html',
    '/gift-ideas':       'pages/gift-ideas.html',
    '/gift-finder':      'pages/gift-finder.html',
    '/3d-print':         'pages/custom-order.html', // fusionné : redirige vers « Commande sur mesure »
    '/contact':          'pages/contact.html',
    '/search':           'pages/search.html',
    '/track-order':      'pages/my-orders.html',
    // Admin
    '/admin':             'admin/dashboard.html',
    '/admin/':            'admin/dashboard.html',
    '/admin/dashboard':   'admin/dashboard.html',
    '/admin/orders':     'admin/orders.html',
    '/admin/products':   'admin/products.html',
    '/admin/add-product':'admin/add-product.html',
    '/admin/custom-requests': 'admin/custom-requests.html',
    '/admin/production-board':'admin/production-board.html',
    '/admin/analytics':       'admin/analytics.html',
    '/admin/print-requests':  'admin/print-requests.html',
    '/admin/spools':          'admin/spools.html',
    '/admin/printers':        'admin/printers.html',
  };

  for (const [route, file] of Object.entries(CLEAN_ROUTES)) {
    app.get(route, (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'frontend', file));
    });
  }

  // ── Fallback HTML ─────────────────────────────────────────
  app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'frontend', 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).json({ error: 'Page non trouvée' });
  });

  // ── JSON error handler (DOIT être en dernier) ─────────────
  // Évite les pages d'erreur HTML qui cassent les appels fetch() côté front
  // (l'erreur « Unexpected token '<' »). Renvoie toujours du JSON.
  app.use((err, req, res, next) => {
    console.error('❌ Erreur requête:', err && err.message);
    if (res.headersSent) return next(err);
    if (err && err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ error: 'Image trop volumineuse (max 15 Mo). Compressez la photo et réessayez.' });
    if (err && (err.code === 'LIMIT_UNEXPECTED_FILE' || /file|fichier|image/i.test(err.message || '')))
      return res.status(400).json({ error: "Problème avec le fichier envoyé. Vérifiez le format (JPG, PNG, WEBP)." });
    res.status(500).json({ error: (err && err.message) || 'Erreur serveur interne' });
  });

  // ── Listen ────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║         LASERYA.TN — Backend v1.0        ║');
    console.log(`║  http://localhost:${PORT}                   ║`);
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  Admin : identifiants dans backend/.env  ║');
    console.log('║  DB    : backend/laserya.db              ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
  });
}

startServer().catch(err => {
  console.error('❌ Erreur démarrage serveur:', err);
  process.exit(1);
});
