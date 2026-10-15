/**
 * spools.js — Gestion du stock de bobines (filaments d'impression 3D).
 * Toutes les routes sont protégées (espace admin uniquement).
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Matières courantes (ajustables côté admin via le champ libre).
const MATERIALS = ['PLA', 'PLA+', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon', 'Bois', 'Résine', 'Autre'];

function num(v, def = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

// Normalise une bobine pour le front (ajoute des champs calculés).
function decorate(s) {
  const total     = num(s.weight_total, 0);
  const remaining = Math.max(0, num(s.weight_remaining, 0));
  const threshold = num(s.threshold, 0);
  const pct = total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0;
  // Valeur restante au prorata du poids (approximation du stock immobilisé).
  const value = total > 0 ? +(num(s.price, 0) * (remaining / total)).toFixed(2) : 0;
  const low = remaining <= threshold;
  return { ...s, remaining_pct: pct, stock_value: value, low_stock: low, empty: remaining <= 0 };
}

// GET /api/spools — liste (filtres : material, status=low|ok|empty, search)
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const { material, status, search } = req.query;

  let sql = 'SELECT * FROM spools WHERE 1=1';
  const params = [];
  if (material && material !== 'all') { sql += ' AND material = ?'; params.push(material); }
  if (search) {
    sql += ' AND (name LIKE ? OR brand LIKE ? OR color LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY name COLLATE NOCASE ASC';

  let rows = db.prepare(sql).all(...params).map(decorate);
  if (status === 'low')   rows = rows.filter(r => r.low_stock && !r.empty);
  if (status === 'empty') rows = rows.filter(r => r.empty);
  if (status === 'ok')    rows = rows.filter(r => !r.low_stock);

  res.json(rows);
});

// GET /api/spools/stats — indicateurs agrégés
router.get('/stats', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM spools').all().map(decorate);
  const stats = {
    count:        rows.length,
    low:          rows.filter(r => r.low_stock).length,
    empty:        rows.filter(r => r.empty).length,
    total_weight: +rows.reduce((a, r) => a + Math.max(0, num(r.weight_remaining)), 0).toFixed(0), // grammes
    total_value:  +rows.reduce((a, r) => a + num(r.stock_value), 0).toFixed(2),
  };
  res.json(stats);
});

// POST /api/spools — créer une bobine
router.post('/', authMiddleware, (req, res) => {
  const { name, brand, material, color, color_hex,
          weight_total, weight_remaining, price, threshold, location, notes } = req.body;
  if (!name || !String(name).trim())
    return res.status(400).json({ error: 'Le nom de la bobine est requis' });

  const db = getDb();
  const id = uuidv4();
  const total = num(weight_total, 1000);
  // Si le poids restant n'est pas précisé, on suppose la bobine pleine.
  const remaining = (weight_remaining === undefined || weight_remaining === '')
    ? total : num(weight_remaining, total);

  db.prepare(`
    INSERT INTO spools
      (id, name, brand, material, color, color_hex, weight_total, weight_remaining,
       price, threshold, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, String(name).trim(), brand || '', material || 'PLA', color || '',
         color_hex || '#cccccc', total, remaining,
         num(price, 0), num(threshold, 150), location || '', notes || '');

  res.status(201).json({ id, success: true });
});

// PUT /api/spools/:id — modifier une bobine
router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM spools WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Bobine introuvable' });

  const { name, brand, material, color, color_hex,
          weight_total, weight_remaining, price, threshold, location, notes } = req.body;
  if (!name || !String(name).trim())
    return res.status(400).json({ error: 'Le nom de la bobine est requis' });

  db.prepare(`
    UPDATE spools SET name=?, brand=?, material=?, color=?, color_hex=?,
      weight_total=?, weight_remaining=?, price=?, threshold=?, location=?, notes=?,
      updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(String(name).trim(), brand || '', material || 'PLA', color || '',
         color_hex || '#cccccc', num(weight_total, 1000), num(weight_remaining, 0),
         num(price, 0), num(threshold, 150), location || '', notes || '', req.params.id);

  res.json({ success: true });
});

// PUT /api/spools/:id/adjust — ajuster le poids restant (delta en grammes, +/-)
router.put('/:id/adjust', authMiddleware, (req, res) => {
  const db = getDb();
  const spool = db.prepare('SELECT * FROM spools WHERE id = ?').get(req.params.id);
  if (!spool) return res.status(404).json({ error: 'Bobine introuvable' });

  const delta = num(req.body.delta, 0);
  const next = Math.max(0, num(spool.weight_remaining, 0) + delta);
  db.prepare("UPDATE spools SET weight_remaining=?, updated_at=datetime('now','localtime') WHERE id=?")
    .run(next, req.params.id);

  res.json({ success: true, weight_remaining: next });
});

// DELETE /api/spools/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM spools WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Bobine introuvable' });
  db.prepare('DELETE FROM spools WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
module.exports.MATERIALS = MATERIALS;
