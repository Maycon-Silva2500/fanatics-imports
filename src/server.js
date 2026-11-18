/**
 * PROJETO PROFISSIONAL — FANATICS IMPORTS
 * Loja Virtual + Sistema de Pedidos + Painel Administrativo
 * Crédito: Desenvolvido por Maycon Silva
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { initDatabase } = require('./config/db');
const { ensureDailyAutoBackup } = require('./services/backupService');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const databaseRoutes = require('./routes/databaseRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Garante a existência das pastas essenciais do sistema automaticamente
const requiredDirs = [
  path.join(__dirname, '../database'),
  path.join(__dirname, '../database/backups'),
  path.join(__dirname, '../public'),
  path.join(__dirname, '../public/uploads'),
  path.join(__dirname, '../admin')
];

requiredDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 1. Middlewares de Segurança
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Muitas requisições deste IP. Tente novamente em alguns minutos.' }
});
app.use('/api/', apiLimiter);

// 2. Arquivos Estáticos (Frontend da Loja e Painel Administrativo)
app.use(express.static(path.join(__dirname, '../public')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// 3. Rotas da API REST
app.use('/api/auth', authRoutes);
app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api', databaseRoutes);

// Rota de Diagnóstico do Sistema
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    loja: process.env.STORE_NAME || 'Fanatics Imports',
    instagram: process.env.STORE_INSTAGRAM || '@Fanatics.imports_ofc',
    ambiente: process.env.NODE_ENV || 'development',
    banco_de_dados: process.env.DB_CLIENT || 'sqlite',
    whatsapp_configurado: Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    mercadopago_configurado: Boolean(process.env.MP_ACCESS_TOKEN),
    creditos: 'Desenvolvido por Maycon Silva',
    timestamp: new Date().toISOString()
  });
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Erro ao processar requisição.' });
  }
  next();
});

// Inicializa o Banco de Dados, garante Backup Diário e sobe o Servidor
initDatabase()
  .then(() => ensureDailyAutoBackup())
  .then(() => {
    app.listen(PORT, () => {
      console.log('==========================================================');
      console.log('  FANATICS IMPORTS - SERVIDOR E BANCO DE DADOS ATIVOS');
      console.log('  Instagram: @Fanatics.imports_ofc');
      console.log(`  Loja Virtual:      http://localhost:${PORT}`);
      console.log(`  Gestão Produtos:   http://localhost:${PORT}/admin/produtos.html`);
      console.log('  Credito: Desenvolvido por Maycon Silva');
      console.log('==========================================================');
    });
  })
  .catch((err) => {
    console.error('[FATAL] Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  });