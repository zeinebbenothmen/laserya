const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Validate/normalize the personalization zones JSON coming from the admin form.
function sanitizeZones(raw) {
  if (raw === undefined) return undefined; // not provided → keep existing
  let arr;
  try { arr = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return '[]'; }
  if (!Array.isArray(arr)) return '[]';
  const clamp = (n, min, max, def) => { n = Number(n); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  const clean = arr.slice(0, 8).map((z, i) => ({
    id:    String(z.id || `z${i}`).slice(0, 12),
    label: String(z.label || 'Texte').slice(0, 40),
    type:  z.type === 'date' ? 'date' : 'text',
    x:     clamp(z.x, 0, 100, 50),
    y:     clamp(z.y, 0, 100, 50),
    size:  clamp(z.size, 1, 30, 7),
    color: /^#[0-9a-fA-F]{3,8}$/.test(z.color || '') ? z.color : '#ffffff',
  }));
  return JSON.stringify(clean);
}

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(file.mimetype));
  }
});

// GET /api/products  — liste publique
router.get('/', (req, res) => {
  const db = getDb();
  const { category, search, active, featured } = req.query;

  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (active !== 'all') {
    sql += ' AND active = 1';
  }
  if (featured === '1') {
    sql += ' AND featured = 1';
  }
  if (category && category !== 'all') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY created_at DESC';

  const products = db.prepare(sql).all(...params);
  res.json(products);
});

// GET /api/products/categories
router.get('/categories', (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT DISTINCT category FROM products WHERE active = 1").all();
  res.json(rows.map(r => r.category));
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
  res.json(product);
});

// POST /api/products  (admin only)
router.post('/', authMiddleware, upload.single('image'), (req, res) => {
  const { name, description, price, category, material, image_url, stock,
          requires_name, requires_date, name_label, date_label, personalization_zones } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Nom et prix requis' });

  const db = getDb();
  const id = uuidv4();
  const finalImage = req.file
    ? `/uploads/${req.file.filename}`
    : (image_url || '');
  const zones = sanitizeZones(personalization_zones) ?? '[]';

  db.prepare(`
    INSERT INTO products (id, name, description, price, category, material, image_url, stock,
                          requires_name, requires_date, name_label, date_label, personalization_zones)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description || '', parseFloat(price), category || 'other',
         material || '', finalImage, parseInt(stock) || 0,
         parseInt(requires_name) ? 1 : 0, parseInt(requires_date) ? 1 : 0,
         name_label || '', date_label || '', zones);

  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.status(201).json(created);
});

// PUT /api/products/:id  (admin only)
router.put('/:id', authMiddleware, upload.single('image'), (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé' });

  const { name, description, price, category, material, image_url, stock, active,
          requires_name, requires_date, name_label, date_label, personalization_zones } = req.body;
  const finalImage = req.file
    ? `/uploads/${req.file.filename}`
    : (image_url !== undefined ? image_url : product.image_url);
  const zones = sanitizeZones(personalization_zones);

  db.prepare(`
    UPDATE products
    SET name=?, description=?, price=?, category=?, material=?, image_url=?, stock=?, active=?,
        requires_name=?, requires_date=?, name_label=?, date_label=?, personalization_zones=?
    WHERE id=?
  `).run(
    name || product.name,
    description !== undefined ? description : product.description,
    price ? parseFloat(price) : product.price,
    category || product.category,
    material !== undefined ? material : product.material,
    finalImage,
    stock !== undefined ? parseInt(stock) : product.stock,
    active !== undefined ? parseInt(active) : product.active,
    requires_name !== undefined ? (parseInt(requires_name) ? 1 : 0) : product.requires_name,
    requires_date !== undefined ? (parseInt(requires_date) ? 1 : 0) : product.requires_date,
    name_label !== undefined ? name_label : product.name_label,
    date_label !== undefined ? date_label : product.date_label,
    zones !== undefined ? zones : product.personalization_zones,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// PUT /api/products/:id/featured  — épingler/retirer des best-sellers de l'accueil (admin only)
router.put('/:id/featured', authMiddleware, (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
  const featured = parseInt(req.body.featured) ? 1 : 0;
  db.prepare('UPDATE products SET featured = ? WHERE id = ?').run(featured, req.params.id);
  res.json({ success: true, featured });
});

// DELETE /api/products/:id  (admin only)
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
