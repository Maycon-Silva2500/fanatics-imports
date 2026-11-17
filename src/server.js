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
    contentSecurityPolicy: false // Ajustado para permitir scripts locais e SDK do Mercado Pago
  })
);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Limite de requisições para evitar abusos e ataques de força bruta
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,
  message: { error: 'Muitas requisições deste IP. Tente novamente em alguns minutos.' }
});
app.use('/api/', apiLimiter);

// 2. Arquivos Estáticos (Frontend da Loja e Painel Administrativo)
app.use(express.static(path.join(__dirname, '../public')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// 3. Rota de Diagnóstico da Arquitetura (Etapa 1)
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

// Rota provisória de verificação visual na raiz (será substituída pela Loja completa na Etapa 2)
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Fanatics Imports — Ambiente Inicializado</title>
      <style>
        body { background-color: #0A0A0A; color: #FFFFFF; font-family: 'Segoe UI', Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #141414; border: 2px solid #00E676; border-radius: 12px; padding: 32px; max-width: 550px; text-align: center; box-shadow: 0 10px 30px rgba(0, 230, 118, 0.15); }
        h1 { color: #00E676; margin-top: 0; letter-spacing: 1px; }
        .badge { background: #00E676; color: #0A0A0A; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem; display: inline-block; margin-bottom: 16px; }
        p { color: #CCCCCC; line-height: 1.6; }
        .footer { margin-top: 24px; font-size: 0.85rem; color: #777777; border-top: 1px solid #262626; padding-top: 16px; }
        a { color: #00E676; text-decoration: none; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge">ETAPA 1 CONCLUÍDA COM SUCESSO</span>
        <h1>FANATICS IMPORTS</h1>
        <p>O servidor Node.js + Express está ativo e todas as pastas da arquitetura foram criadas automaticamente.</p>
        <p>Instagram: <strong>@Fanatics.imports_ofc</strong></p>
        <p><a href="/api/status" target="_blank">Verificar JSON de Diagnóstico da API (/api/status) →</a></p>
        <div class="footer">Desenvolvido por Maycon Silva</div>
      </div>
    </body>
    </html>
  `);
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log('==========================================================');
  console.log('  FANATICS IMPORTS - SERVIDOR INICIADO COM SUCESSO');
  console.log('  Instagram: @Fanatics.imports_ofc');
  console.log(`  Loja Local: http://localhost:${PORT}`);
  console.log(`  Status API: http://localhost:${PORT}/api/status`);
  console.log('  Credito: Desenvolvido por Maycon Silva');
  console.log('==========================================================');
});