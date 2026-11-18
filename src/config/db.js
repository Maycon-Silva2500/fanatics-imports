/**
 * FANATICS IMPORTS — CAMADA DE BANCO DE DADOS COMPLETA (SQLite -> Preparado para PostgreSQL)
 * Desenvolvido por Maycon Silva
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../../', process.env.DB_PATH || './database/fanatics.sqlite');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[DB ERRO] Falha ao conectar ao SQLite:', err.message);
  } else {
    console.log(`[DB OK] Conectado ao banco SQLite em: ${dbPath}`);
  }
});

// Ativa integridade referencial e modo WAL para melhor concorrência
db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

// Wrappers Promise para queries parametrizadas (proteção contra SQL Injection)
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Fila sequencial para transações atômicas seguras
let transactionQueue = Promise.resolve();

function runInTransaction(workFn) {
  const next = transactionQueue.then(async () => {
    await dbRun('BEGIN IMMEDIATE TRANSACTION');
    try {
      const result = await workFn();
      await dbRun('COMMIT');
      return result;
    } catch (err) {
      await dbRun('ROLLBACK');
      throw err;
    }
  });
  transactionQueue = next.catch(() => {});
  return next;
}

function generateDefaultSvg(primaryColor, accentColor, label) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
      <defs>
        <radialGradient id="bg" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stop-color="#1f1f1f"/>
          <stop offset="100%" stop-color="#0b0b0b"/>
        </radialGradient>
      </defs>
      <rect width="500" height="500" fill="url(#bg)"/>
      <path d="M150 110 L205 90 Q250 115 295 90 L350 110 L405 175 L360 215 L330 185 L330 390 L170 390 L170 185 L140 215 L95 175 Z"
            fill="${primaryColor}" stroke="${accentColor}" stroke-width="6"/>
      <path d="M205 90 Q250 125 295 90" fill="none" stroke="${accentColor}" stroke-width="6"/>
      <text x="250" y="235" fill="${accentColor}" font-family="Arial, sans-serif" font-weight="900" font-size="24" text-anchor="middle">${label}</text>
      <text x="250" y="445" fill="#777777" font-family="Arial, sans-serif" font-weight="700" font-size="14" text-anchor="middle">FANATICS IMPORTS</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const DEFAULT_CATEGORIES = [
  { name: 'Camisas de futebol', slug: 'camisas-de-futebol' },
  { name: 'Camisas retrô', slug: 'camisas-retro' },
  { name: 'NBA', slug: 'nba' },
  { name: 'Futebol americano', slug: 'futebol-americano' },
  { name: 'Regatas', slug: 'regatas' },
  { name: 'Kits camisa e bermuda', slug: 'kits-camisa-e-bermuda' },
  { name: 'Camisas infantis', slug: 'camisas-infantis' },
  { name: 'Manga longa', slug: 'manga-longa' }
];

async function initDatabase() {
  // 1. Tabela de Usuários Administrativos (Senhas com Hash Bcrypt)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Tabela de Categorias
  await dbRun(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Tabela de Produtos
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      image TEXT NOT NULL,
      images TEXT NOT NULL,
      price REAL NOT NULL,
      promo_price REAL,
      sizes TEXT NOT NULL,
      available INTEGER DEFAULT 1,
      customizable INTEGER DEFAULT 1,
      stock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Tabela de Clientes
  await dbRun(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      phone_normalized TEXT NOT NULL UNIQUE,
      email TEXT,
      cpf TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. Tabela de Pedidos
  await dbRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      phone_normalized TEXT NOT NULL,
      customer_email TEXT,
      customer_cpf TEXT,
      address_zip TEXT NOT NULL,
      address_street TEXT NOT NULL,
      address_number TEXT NOT NULL,
      address_complement TEXT,
      address_neighborhood TEXT NOT NULL,
      address_city TEXT NOT NULL,
      address_state TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'Aguardando pagamento',
      order_status TEXT NOT NULL DEFAULT 'Pedido recebido',
      subtotal REAL NOT NULL,
      total REAL NOT NULL,
      mp_payment_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    )
  `);

  // 6. Tabela de Itens do Pedido
  await dbRun(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      category TEXT,
      size TEXT NOT NULL,
      customized INTEGER DEFAULT 0,
      custom_name TEXT,
      custom_number TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  // 7. Tabela de Pagamentos (Transações Mercado Pago)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      order_code TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'mercadopago',
      external_id TEXT,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      status_detail TEXT,
      amount REAL NOT NULL,
      pix_qr_code TEXT,
      pix_qr_code_base64 TEXT,
      ticket_url TEXT,
      raw_payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  // 8. Tabela de Logs de Notificações WhatsApp
  await dbRun(`
    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      order_code TEXT,
      destination_phone TEXT NOT NULL,
      message_body TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'local_log',
      status TEXT NOT NULL DEFAULT 'logged',
      provider_message_id TEXT,
      error_details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    )
  `);

  // 9. Tabela de Configurações Dinâmicas do Sistema
  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Índices para consultas rápidas
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(code)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone_normalized)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_payments_external ON payments(external_id)`);

  // Garante o usuário administrador inicial com senha protegida por hash
  const adminCount = await dbGet(`SELECT COUNT(*) as total FROM admin_users`);
  if (adminCount && adminCount.total === 0) {
    const initialUser = (process.env.ADMIN_INITIAL_USER || 'admin').trim();
    const initialPass = process.env.ADMIN_INITIAL_PASS || 'Fanatics@2026';
    const passwordHash = bcrypt.hashSync(initialPass, 10);

    await dbRun(
      `INSERT INTO admin_users (username, password_hash, role, active) VALUES (?, ?, 'admin', 1)`,
      [initialUser, passwordHash]
    );
    console.log(`[SEGURANÇA] Administrador inicial "${initialUser}" criado com senha criptografada (bcrypt).`);
  }

  // Garante configurações iniciais padrão
  const defaultSettings = [
    ['store_name', process.env.STORE_NAME || 'Fanatics Imports'],
    ['store_instagram', process.env.STORE_INSTAGRAM || '@Fanatics.imports_ofc'],
    ['whatsapp_enabled', process.env.WHATSAPP_ENABLED || 'false'],
    ['whatsapp_api_token', process.env.WHATSAPP_API_TOKEN || ''],
    ['whatsapp_phone_number_id', process.env.WHATSAPP_PHONE_NUMBER_ID || ''],
    ['whatsapp_destination_number', process.env.WHATSAPP_DESTINATION_NUMBER || '']
  ];

  for (const [k, v] of defaultSettings) {
    await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, [k, v]);
  }

  // Garante as 8 categorias oficiais
  for (const cat of DEFAULT_CATEGORIES) {
    await dbRun(
      `INSERT OR IGNORE INTO categories (name, slug, active) VALUES (?, ?, 1)`,
      [cat.name, cat.slug]
    );
  }

  // Insere produtos iniciais apenas se o catálogo estiver completamente vazio
  const countRow = await dbGet(`SELECT COUNT(*) as total FROM products`);
  if (countRow && countRow.total === 0) {
    const initialSeeds = [
      {
        name: 'Camisa Seleção Brasil Home 2026',
        description: 'Tecido respirável de alta performance com escudo bordado e acabamento oficial.',
        category: 'Camisas de futebol',
        image: generateDefaultSvg('#FACC15', '#00E676', 'BRASIL 26'),
        price: 189.90,
        promo_price: 149.90,
        sizes: ['P', 'M', 'G', 'GG', 'XG'],
        available: 1,
        customizable: 1,
        stock: 15
      },
      {
        name: 'Camisa Retrô Brasil 2002 Pentacampeão',
        description: 'Edição histórica comemorativa do Penta com detalhes clássicos e tecido macio.',
        category: 'Camisas retrô',
        image: generateDefaultSvg('#EAB308', '#16A34A', 'RETRÔ 2002'),
        price: 219.90,
        promo_price: 169.90,
        sizes: ['P', 'M', 'G', 'GG'],
        available: 1,
        customizable: 1,
        stock: 8
      },
      {
        name: 'Regata NBA Los Angeles Lakers Icon Edition',
        description: 'Regata Swingman com números aplicados e malha perfurada para máximo conforto.',
        category: 'NBA',
        image: generateDefaultSvg('#581C87', '#FACC15', 'NBA LAKERS'),
        price: 229.90,
        promo_price: 179.90,
        sizes: ['P', 'M', 'G', 'GG'],
        available: 1,
        customizable: 1,
        stock: 10
      },
      {
        name: 'Jersey NFL Kansas City Chiefs Home',
        description: 'Jersey oficial de futebol americano com numeração frontal e nas costas.',
        category: 'Futebol americano',
        image: generateDefaultSvg('#DC2626', '#FFFFFF', 'NFL CHIEFS'),
        price: 259.90,
        promo_price: null,
        sizes: ['M', 'G', 'GG', 'XG'],
        available: 1,
        customizable: 1,
        stock: 6
      },
      {
        name: 'Regata Treino Performance Black/Green',
        description: 'Regata esportiva dry-fit leve ideal para academia, corrida e treino funcional.',
        category: 'Regatas',
        image: generateDefaultSvg('#141414', '#00E676', 'DRY-FIT'),
        price: 119.90,
        promo_price: 89.90,
        sizes: ['P', 'M', 'G', 'GG'],
        available: 1,
        customizable: 0,
        stock: 20
      },
      {
        name: 'Kit Camisa e Bermuda Treino Europeu',
        description: 'Conjunto completo com camisa dry-fit e bermuda com bolsos e ajuste na cintura.',
        category: 'Kits camisa e bermuda',
        image: generateDefaultSvg('#0F172A', '#00E676', 'KIT COMPLETO'),
        price: 239.90,
        promo_price: 189.90,
        sizes: ['P', 'M', 'G', 'GG'],
        available: 1,
        customizable: 1,
        stock: 9
      },
      {
        name: 'Kit Infantil Seleção + Short (2 a 12 anos)',
        description: 'Conjunto infantil completo leve e confortável para os pequenos torcedores.',
        category: 'Camisas infantis',
        image: generateDefaultSvg('#2563EB', '#FFFFFF', 'KIDS EDITION'),
        price: 159.90,
        promo_price: 129.90,
        sizes: ['16 (2-3a)', '20 (4-5a)', '24 (7-8a)', '28 (10-12a)'],
        available: 1,
        customizable: 1,
        stock: 12
      },
      {
        name: 'Camisa Real Madrid Manga Longa 2026',
        description: 'Versão manga longa com punhos canelados e tecnologia de controle térmico.',
        category: 'Manga longa',
        image: generateDefaultSvg('#F8FAFC', '#00E676', 'MANGA LONGA'),
        price: 219.90,
        promo_price: 174.90,
        sizes: ['P', 'M', 'G', 'GG'],
        available: 1,
        customizable: 1,
        stock: 7
      }
    ];

    for (const item of initialSeeds) {
      await dbRun(
        `INSERT INTO products (name, description, category, image, images, price, promo_price, sizes, available, customizable, stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.name,
          item.description,
          item.category,
          item.image,
          JSON.stringify([item.image]),
          item.price,
          item.promo_price,
          JSON.stringify(item.sizes),
          item.available,
          item.customizable,
          item.stock
        ]
      );
    }
    console.log('[DB SEED] 8 produtos iniciais cadastrados no catálogo.');
  }
}

module.exports = {
  db,
  dbPath,
  dbRun,
  dbGet,
  dbAll,
  runInTransaction,
  initDatabase,
  generateDefaultSvg
};