const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

  const db = getDb();
  const admin = db.prepare('SELECT * FROM admin WHERE username = ?').get(username);
  if (!admin)
    return res.status(401).json({ error: 'Identifiants incorrects' });

  const valid = bcrypt.compareSync(String(password), String(admin.password));
  if (!valid)
    return res.status(401).json({ error: 'Identifiants incorrects' });

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, username: admin.username });
});

// POST /api/auth/change-password  (protected)
router.post('/change-password', authMiddleware, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });

  const db = getDb();
  const hashed = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin SET password = ? WHERE id = ?').run(hashed, req.admin.id);
  res.json({ success: true, message: 'Mot de passe mis à jour' });
});

// GET /api/auth/me  (verify token)
router.get('/me', authMiddleware, (req, res) => {
  res.json({ id: req.admin.id, username: req.admin.username });
});

module.exports = router;
