/**
 * FANATICS IMPORTS — API REST DE CATÁLOGO, PRODUTOS E UPLOAD DE FOTOS
 * Desenvolvido por Maycon Silva
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { dbRun, dbGet, dbAll, generateDefaultSvg } = require('../config/db');
const { verifyAdminToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Configuração de Upload Real de Fotos em public/uploads/
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 30) || 'produto';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e5)}-${safeBase}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato inválido. Envie apenas imagens JPG, PNG ou WEBP.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB por foto
});

function formatProductRow(row) {
  if (!row) return null;
  let parsedSizes = ['P', 'M', 'G', 'GG'];
  let parsedImages = [row.image];

  try {
    parsedSizes = JSON.parse(row.sizes);
  } catch {}

  try {
    parsedImages = JSON.parse(row.images);
    if (!Array.isArray(parsedImages) || parsedImages.length === 0) {
      parsedImages = [row.image];
    }
  } catch {}

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category,
    image: row.image,
    images: parsedImages,
    price: Number(row.price),
    promoPrice: row.promo_price !== null ? Number(row.promo_price) : null,
    sizes: parsedSizes,
    available: Boolean(row.available),
    customizable: Boolean(row.customizable),
    stock: Number(row.stock),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseBooleanFlag(val, defaultVal = 1) {
  if (val === undefined || val === null) return defaultVal;
  if (val === true || val === 'true' || val === '1' || val === 1 || val === 'on') return 1;
  return 0;
}

function parseSizesInput(sizesInput) {
  if (!sizesInput) return ['P', 'M', 'G', 'GG'];
  if (Array.isArray(sizesInput)) return sizesInput;
  try {
    const parsed = JSON.parse(sizesInput);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  const list = String(sizesInput)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : ['P', 'M', 'G', 'GG'];
}

// GET /api/categories — Lista as categorias da loja
router.get('/categories', async (req, res) => {
  try {
    const categories = await dbAll(`SELECT id, name, slug, active FROM categories WHERE active = 1 ORDER BY id ASC`);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar categorias.' });
  }
});

// GET /api/products — Lista produtos com suporte a filtros
router.get('/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = `SELECT * FROM products WHERE 1=1`;
    const params = [];

    if (category && category !== 'Todas') {
      sql += ` AND category = ?`;
      params.push(category);
    }

    if (search && search.trim() !== '') {
      sql += ` AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?)`;
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY id DESC`;
    const rows = await dbAll(sql, params);
    res.json(rows.map(formatProductRow));
  } catch (err) {
    console.error('[ERRO GET /api/products]:', err);
    res.status(500).json({ error: 'Erro ao buscar produtos.' });
  }
});

// GET /api/products/:id — Detalhes de um produto específico
router.get('/products/:id', async (req, res) => {
  try {
    const row = await dbGet(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json(formatProductRow(row));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar detalhes do produto.' });
  }
});

// POST /api/products — Cadastrar novo produto (Protegido)
router.post('/products', verifyAdminToken, upload.array('photos', 5), async (req, res) => {
  try {
    const { name, description, category, price, promoPrice, sizes, available, customizable, stock, imageUrl } = req.body;

    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Nome, categoria e preço são obrigatórios.' });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'Informe um preço válido maior que zero.' });
    }

    const numericPromo =
      promoPrice !== undefined && promoPrice !== '' && promoPrice !== 'null' ? parseFloat(promoPrice) : null;

    const uploadedUrls = (req.files || []).map((file) => `/uploads/${file.filename}`);
    if (imageUrl && imageUrl.trim() !== '') {
      uploadedUrls.push(imageUrl.trim());
    }

    const finalImages =
      uploadedUrls.length > 0
        ? uploadedUrls
        : [generateDefaultSvg('#161616', '#00E676', name.slice(0, 12).toUpperCase())];

    const parsedSizes = parseSizesInput(sizes);
    const isAvailable = parseBooleanFlag(available, 1);
    const isCustomizable = parseBooleanFlag(customizable, 1);
    const numericStock = Math.max(0, parseInt(stock, 10) || 0);

    const result = await dbRun(
      `INSERT INTO products (name, description, category, image, images, price, promo_price, sizes, available, customizable, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        (description || '').trim(),
        category.trim(),
        finalImages[0],
        JSON.stringify(finalImages),
        numericPrice,
        numericPromo && numericPromo > 0 ? numericPromo : null,
        JSON.stringify(parsedSizes),
        isAvailable,
        isCustomizable,
        numericStock
      ]
    );

    const created = await dbGet(`SELECT * FROM products WHERE id = ?`, [result.id]);
    res.status(201).json({
      message: 'Produto cadastrado com sucesso!',
      product: formatProductRow(created)
    });
  } catch (err) {
    console.error('[ERRO POST /api/products]:', err);
    res.status(500).json({ error: err.message || 'Erro ao cadastrar produto.' });
  }
});

// PUT /api/products/:id — Editar produto existente (Protegido)
router.put('/products/:id', verifyAdminToken, upload.array('photos', 5), async (req, res) => {
  try {
    const existing = await dbGet(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const { name, description, category, price, promoPrice, sizes, available, customizable, stock, imageUrl, replacePhotos } =
      req.body;

    const numericPrice = price !== undefined ? parseFloat(price) : existing.price;
    const numericPromo =
      promoPrice === '' || promoPrice === 'null'
        ? null
        : promoPrice !== undefined
        ? parseFloat(promoPrice)
        : existing.promo_price;

    let currentImages = [];
    try {
      currentImages = JSON.parse(existing.images);
    } catch {
      currentImages = [existing.image];
    }

    const newUploadedUrls = (req.files || []).map((file) => `/uploads/${file.filename}`);
    if (imageUrl && imageUrl.trim() !== '') {
      newUploadedUrls.push(imageUrl.trim());
    }

    let finalImages = currentImages;
    if (newUploadedUrls.length > 0) {
      finalImages = parseBooleanFlag(replacePhotos, 0) === 1 ? newUploadedUrls : [...newUploadedUrls, ...currentImages];
    }

    const parsedSizes = sizes !== undefined ? parseSizesInput(sizes) : JSON.parse(existing.sizes);
    const isAvailable = available !== undefined ? parseBooleanFlag(available, 1) : existing.available;
    const isCustomizable = customizable !== undefined ? parseBooleanFlag(customizable, 1) : existing.customizable;
    const numericStock = stock !== undefined ? Math.max(0, parseInt(stock, 10) || 0) : existing.stock;

    await dbRun(
      `UPDATE products
       SET name = ?, description = ?, category = ?, image = ?, images = ?, price = ?, promo_price = ?,
           sizes = ?, available = ?, customizable = ?, stock = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name !== undefined ? name.trim() : existing.name,
        description !== undefined ? description.trim() : existing.description,
        category !== undefined ? category.trim() : existing.category,
        finalImages[0],
        JSON.stringify(finalImages),
        numericPrice,
        numericPromo && numericPromo > 0 ? numericPromo : null,
        JSON.stringify(parsedSizes),
        isAvailable,
        isCustomizable,
        numericStock,
        req.params.id
      ]
    );

    const updated = await dbGet(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    res.json({
      message: 'Produto atualizado com sucesso!',
      product: formatProductRow(updated)
    });
  } catch (err) {
    console.error('[ERRO PUT /api/products]:', err);
    res.status(500).json({ error: err.message || 'Erro ao atualizar produto.' });
  }
});

// DELETE /api/products/:id — Excluir produto (Protegido)
router.delete('/products/:id', verifyAdminToken, async (req, res) => {
  try {
    const existing = await dbGet(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    // Remove imagens locais associadas na pasta public/uploads/
    try {
      const imgs = JSON.parse(existing.images);
      if (Array.isArray(imgs)) {
        imgs.forEach((imgPath) => {
          if (typeof imgPath === 'string' && imgPath.startsWith('/uploads/')) {
            const fullFilePath = path.join(__dirname, '../../public', imgPath);
            if (fs.existsSync(fullFilePath)) {
              fs.unlinkSync(fullFilePath);
            }
          }
        });
      }
    } catch {}

    await dbRun(`DELETE FROM products WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Produto excluído com sucesso!' });
  } catch (err) {
    console.error('[ERRO DELETE /api/products]:', err);
    res.status(500).json({ error: 'Erro ao excluir produto.' });
  }
});

module.exports = router;