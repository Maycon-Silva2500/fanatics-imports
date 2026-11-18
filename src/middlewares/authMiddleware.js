/**
 * FANATICS IMPORTS — MIDDLEWARE DE AUTENTICAÇÃO ADMINISTRATIVA (JWT)
 * Desenvolvido por Maycon Silva
 */

const jwt = require('jsonwebtoken');

function verifyAdminToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Faça login como administrador.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'fanatics_imports_default_secret';
    const decoded = jwt.verify(token, secret);
    req.admin = decoded;
    return next();
  } catch (err) {
    return res.status(403).json({ error: 'Sessão expirada ou token inválido. Faça login novamente.' });
  }
}

module.exports = { verifyAdminToken };