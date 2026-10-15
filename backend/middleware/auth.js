const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'laserya-secret-jwt-2024';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Accès refusé — token requis' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
