/**
 * FANATICS IMPORTS — CAMADA DE BANCO DE DADOS (SQLite -> Preparado para PostgreSQL)
 * Desenvolvido por Maycon Silva
 */

const sqlite3 = require('sqlite3').verbose();
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

// Ativa chaves estrangeiras no SQLite
db.run('PRAGMA foreign_keys = ON');

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
  // 1. Tabela de Categorias
  await dbRun(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Tabela de Produtos
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
  dbRun,
  dbGet,
  dbAll,
  initDatabase,
  generateDefaultSvg
};