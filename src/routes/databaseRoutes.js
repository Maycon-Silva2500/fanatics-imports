/**
 * FANATICS IMPORTS — ROTAS ADMINISTRATIVAS DE BANCO DE DADOS E BACKUPS
 * Desenvolvido por Maycon Silva
 */

const express = require('express');
const fs = require('fs');
const { dbGet, dbPath } = require('../config/db');
const { verifyAdminToken } = require('../middlewares/authMiddleware');
const { createDatabaseBackup, listBackups, getBackupFilePath } = require('../services/backupService');

const router = express.Router();

// GET /api/admin/database/stats — Visão geral das tabelas e backups
router.get('/admin/database/stats', verifyAdminToken, async (req, res) => {
  try {
    const [categories, products, customers, orders, payments, whatsappLogs] = await Promise.all([
      dbGet(`SELECT COUNT(*) as total FROM categories`),
      dbGet(`SELECT COUNT(*) as total FROM products`),
      dbGet(`SELECT COUNT(*) as total FROM customers`),
      dbGet(`SELECT COUNT(*) as total FROM orders`),
      dbGet(`SELECT COUNT(*) as total FROM payments`),
      dbGet(`SELECT COUNT(*) as total FROM whatsapp_logs`)
    ]);

    const fileStats = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;

    res.json({
      engine: process.env.DB_CLIENT || 'sqlite',
      databaseFile: 'fanatics.sqlite',
      sizeKB: fileStats ? (fileStats.size / 1024).toFixed(2) : '0.00',
      postgresMigrationReady: true,
      tables: {
        categories: categories.total,
        products: products.total,
        customers: customers.total,
        orders: orders.total,
        payments: payments.total,
        whatsapp_logs: whatsappLogs.total
      },
      backups: listBackups()
    });
  } catch (err) {
    console.error('[ERRO GET /api/admin/database/stats]:', err);
    res.status(500).json({ error: 'Erro ao consultar estatísticas do banco.' });
  }
});

// POST /api/admin/database/backup — Gera um novo backup imediato
router.post('/admin/database/backup', verifyAdminToken, async (req, res) => {
  try {
    const backup = await createDatabaseBackup('manual');
    res.status(201).json({
      message: 'Backup do banco de dados gerado com sucesso!',
      backup
    });
  } catch (err) {
    console.error('[ERRO POST /api/admin/database/backup]:', err);
    res.status(500).json({ error: err.message || 'Erro ao gerar backup.' });
  }
});

// GET /api/admin/database/backup/:filename — Faz download seguro do arquivo .sqlite
router.get('/admin/database/backup/:filename', verifyAdminToken, (req, res) => {
  const filePath = getBackupFilePath(req.params.filename);
  if (!filePath) {
    return res.status(404).json({ error: 'Arquivo de backup não encontrado.' });
  }
  return res.download(filePath);
});

module.exports = router;