/**
 * FANATICS IMPORTS — ROTAS DE AUTENTICAÇÃO ADMINISTRATIVA
 * Desenvolvido por Maycon Silva
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyAdminToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const validUser = process.env.ADMIN_INITIAL_USER || 'admin';
  const validPass = process.env.ADMIN_INITIAL_PASS || 'Fanatics@2026';

  if (!username || !password) {
    return res.status(400).json({ error: 'Informe usuário e senha.' });
  }

  if (username.trim() !== validUser || password !== validPass) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  const secret = process.env.JWT_SECRET || 'fanatics_imports_default_secret';
  const token = jwt.sign(
    { username: validUser, role: 'admin' },
    secret,
    { expiresIn: '12h' }
  );

  return res.json({
    message: 'Login realizado com sucesso!',
    token,
    user: { username: validUser, role: 'admin' }
  });
});

// GET /api/auth/verify
router.get('/verify', verifyAdminToken, (req, res) => {
  res.json({ authenticated: true, user: req.admin });
});

module.exports = router;