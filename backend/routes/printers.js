/**
 * printers.js — Configuration & suivi des imprimantes 3D Bambu Lab (admin).
 * Lecture seule de l'état (via MQTT local) ; CRUD de la config (IP/série/code).
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const bambu = require('../bambu');

const router = express.Router();

const allConfigs = () => getDb().prepare('SELECT * FROM printers ORDER BY name COLLATE NOCASE ASC').all();
// On ne renvoie jamais le code d'accès au front
const publicCfg = (p) => { const { access_code, ...rest } = p; return { ...rest, has_code: !!access_code }; };

// GET /api/printers — liste des imprimantes configurées
router.get('/', authMiddleware, (req, res) => {
  res.json(allConfigs().map(publicCfg));
});

// GET /api/printers/status — état temps réel de chaque imprimante
router.get('/status', authMiddleware, (req, res) => {
  res.json(allConfigs().map(p => bambu.statusFor(p)));
});

// POST /api/printers — ajouter une imprimante
router.post('/', authMiddleware, (req, res) => {
  const { name, host, serial, access_code, model } = req.body;
  if (!name || !host || !serial || !access_code)
    return res.status(400).json({ error: "Nom, IP, numéro de série et code d'accès sont requis" });

  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO printers (id,name,host,serial,access_code,model) VALUES (?,?,?,?,?,?)')
    .run(id, String(name).trim(), String(host).trim(), String(serial).trim(),
         String(access_code).trim(), (model || '').trim());
  bambu.reload(allConfigs());
  res.status(201).json({ id, success: true });
});

// PUT /api/printers/:id — modifier (code d'accès optionnel : vide = inchangé)
router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const ex = db.prepare('SELECT * FROM printers WHERE id=?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Imprimante introuvable' });

  const { name, host, serial, access_code, model } = req.body;
  db.prepare('UPDATE printers SET name=?, host=?, serial=?, access_code=?, model=? WHERE id=?')
    .run(String(name || ex.name).trim(), String(host || ex.host).trim(),
         String(serial || ex.serial).trim(),
         access_code ? String(access_code).trim() : ex.access_code,
         (model !== undefined ? model : ex.model), req.params.id);

  bambu.disconnect(ex.serial);          // coupe l'ancienne connexion (série/IP a pu changer)
  bambu.reload(allConfigs());
  res.json({ success: true });
});

// DELETE /api/printers/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const ex = db.prepare('SELECT * FROM printers WHERE id=?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Imprimante introuvable' });
  db.prepare('DELETE FROM printers WHERE id=?').run(req.params.id);
  bambu.disconnect(ex.serial);
  res.json({ success: true });
});

module.exports = router;
