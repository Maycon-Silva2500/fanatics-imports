/**
 * FANATICS IMPORTS — AUTENTICAÇÃO ADMINISTRATIVA COM HASH BCRYPTJS
 * Desenvolvido por Maycon Silva
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun } = require('../config/db');
const { verifyAdminToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// POST /api/auth/login — Autentica usando senha criptografada no banco de dados
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Informe usuário e senha.' });
    }

    const adminUser = await dbGet(
      `SELECT id, username, password_hash, role, active FROM admin_users WHERE username = ?`,
      [username.trim()]
    );

    if (!adminUser || !adminUser.active) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const passwordMatches = bcrypt.compareSync(password, adminUser.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const secret = process.env.JWT_SECRET || 'fanatics_imports_default_secret';
    const token = jwt.sign(
      { id: adminUser.id, username: adminUser.username, role: adminUser.role },
      secret,
      { expiresIn: '12h' }
    );

    return res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: { id: adminUser.id, username: adminUser.username, role: adminUser.role }
    });
  } catch (err) {
    console.error('[ERRO POST /api/auth/login]:', err);
    return res.status(500).json({ error: 'Erro interno ao processar login.' });
  }
});

// POST /api/auth/change-password — Altera a senha administrativa gerando novo hash seguro
router.post('/change-password', verifyAdminToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }

    const adminUser = await dbGet(`SELECT id, password_hash FROM admin_users WHERE id = ?`, [req.admin.id]);
    if (!adminUser) {
      return res.status(404).json({ error: 'Usuário administrativo não encontrado.' });
    }

    if (!bcrypt.compareSync(currentPassword, adminUser.password_hash)) {
      return res.status(401).json({ error: 'A senha atual está incorreta.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await dbRun(`UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      newHash,
      adminUser.id
    ]);

    return res.json({ message: 'Senha administrativa atualizada com sucesso!' });
  } catch (err) {
    console.error('[ERRO POST /api/auth/change-password]:', err);
    return res.status(500).json({ error: 'Erro ao atualizar senha.' });
  }
});

// GET /api/auth/verify
router.get('/verify', verifyAdminToken, (req, res) => {
  res.json({ authenticated: true, user: req.admin });
});

module.exports = router;