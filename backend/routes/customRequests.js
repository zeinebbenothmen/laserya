const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `cr_${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    cb(null, allowed.test(file.mimetype));
  }
});

const VALID_STATUSES = ['new', 'reviewing', 'quoted', 'approved', 'in_production', 'done', 'cancelled'];

// POST /api/custom-requests  — soumettre une demande custom (public)
router.post('/', upload.single('image'), (req, res) => {
  const { customer_name, customer_phone, customer_email,
          product_type, size, material, personalization_text, notes } = req.body;

  if (!customer_name || !customer_phone || !product_type)
    return res.status(400).json({ error: 'Nom, téléphone et type de produit requis' });

  const db = getDb();
  const id = uuidv4();
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';

  db.prepare(`
    INSERT INTO custom_requests
      (id, customer_name, customer_phone, customer_email, product_type,
       size, material, personalization_text, image_url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, customer_name, customer_phone, customer_email || '',
         product_type, size || '', material || '',
         personalization_text || '', imageUrl, notes || '');

  res.status(201).json({ id, success: true, message: 'Demande enregistrée' });
});

// GET /api/custom-requests  — liste admin (protected)
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const { status, search } = req.query;

  let sql = 'SELECT * FROM custom_requests WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    sql += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR product_type LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY created_at DESC';

  res.json(db.prepare(sql).all(...params));
});

// GET /api/custom-requests/:id  (admin)
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const req_ = db.prepare('SELECT * FROM custom_requests WHERE id = ?').get(req.params.id);
  if (!req_) return res.status(404).json({ error: 'Demande non trouvée' });
  res.json(req_);
});

// PUT /api/custom-requests/:id/status  (admin)
router.put('/:id/status', authMiddleware, (req, res) => {
  const { status, notes } = req.body;
  if (!VALID_STATUSES.includes(status))
    return res.status(400).json({ error: `Statut invalide. Valeurs: ${VALID_STATUSES.join(', ')}` });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM custom_requests WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Demande non trouvée' });

  if (notes !== undefined) {
    db.prepare('UPDATE custom_requests SET status=?, notes=? WHERE id=?').run(status, notes, req.params.id);
  } else {
    db.prepare('UPDATE custom_requests SET status=? WHERE id=?').run(status, req.params.id);
  }
  res.json({ success: true, status });
});

// DELETE /api/custom-requests/:id  (admin)
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM custom_requests WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Demande non trouvée' });
  db.prepare('DELETE FROM custom_requests WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
