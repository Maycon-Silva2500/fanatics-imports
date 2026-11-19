/**
 * FANATICS IMPORTS — ROTAS DO PAINEL ADMINISTRATIVO
 * Desenvolvido por Maycon Silva
 */

const express = require('express');
const { dbRun, dbGet, dbAll, runInTransaction } = require('../config/db');
const { verifyAdminToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Todas as rotas abaixo exigem autenticação administrativa válida
router.use('/admin', verifyAdminToken);

// ============================================================================
// 1. DASHBOARD — MÉTRICAS E GRÁFICOS DE VENDAS
// ============================================================================
router.get('/admin/dashboard', async (req, res) => {
  try {
    const summary = await dbGet(`
      SELECT
        COUNT(*) as totalOrders,
        SUM(CASE WHEN order_status = 'Pedido recebido' THEN 1 ELSE 0 END) as newOrders,
        SUM(CASE WHEN payment_status = 'Aguardando pagamento' AND order_status != 'Cancelado' THEN 1 ELSE 0 END) as awaitingPayment,
        SUM(CASE WHEN payment_status = 'Pagamento aprovado' THEN 1 ELSE 0 END) as approvedPayments,
        SUM(CASE WHEN order_status = 'Em preparação' THEN 1 ELSE 0 END) as inPreparation,
        SUM(CASE WHEN order_status = 'Enviado' THEN 1 ELSE 0 END) as shippedOrders,
        SUM(CASE WHEN order_status = 'Entregue' THEN 1 ELSE 0 END) as deliveredOrders,
        COALESCE(SUM(CASE WHEN payment_status = 'Pagamento aprovado' THEN total ELSE 0 END), 0) as approvedRevenue,
        COALESCE(SUM(CASE WHEN payment_status = 'Aguardando pagamento' AND order_status != 'Cancelado' THEN total ELSE 0 END), 0) as pendingRevenue
      FROM orders
    `);

    // Faturamento dos últimos 7 dias
    const dailyRows = await dbAll(`
      SELECT
        DATE(created_at, 'localtime') as day,
        COUNT(*) as ordersCount,
        COALESCE(SUM(CASE WHEN order_status != 'Cancelado' THEN total ELSE 0 END), 0) as revenue
      FROM orders
      WHERE DATE(created_at, 'localtime') >= DATE('now', 'localtime', '-6 days')
      GROUP BY DATE(created_at, 'localtime')
      ORDER BY day ASC
    `);

    // Preenche os 7 dias contínuos mesmo nos dias sem venda
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoDay = d.toLocaleDateString('sv-SE'); // YYYY-MM-DD
      const found = dailyRows.find((r) => r.day === isoDay);
      last7Days.push({
        day: isoDay,
        label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        ordersCount: found ? Number(found.ordersCount) : 0,
        revenue: found ? Number(found.revenue) : 0
      });
    }

    // Vendas por Categoria
    const categorySales = await dbAll(`
      SELECT
        COALESCE(oi.category, 'Outros') as category,
        SUM(oi.quantity) as unitsSold,
        COALESCE(SUM(oi.total_price), 0) as revenue
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.order_status != 'Cancelado'
      GROUP BY COALESCE(oi.category, 'Outros')
      ORDER BY revenue DESC
      LIMIT 8
    `);

    // Alertas de estoque baixo
    const lowStockRow = await dbGet(`SELECT COUNT(*) as total FROM products WHERE stock <= 5`);

    const totalOrders = Number(summary.totalOrders || 0);
    const approvedPayments = Number(summary.approvedPayments || 0);
    const approvedRevenue = Number(summary.approvedRevenue || 0);

    res.json({
      metrics: {
        totalOrders,
        newOrders: Number(summary.newOrders || 0),
        awaitingPayment: Number(summary.awaitingPayment || 0),
        approvedPayments,
        inPreparation: Number(summary.inPreparation || 0),
        shippedOrders: Number(summary.shippedOrders || 0),
        deliveredOrders: Number(summary.deliveredOrders || 0),
        approvedRevenue,
        pendingRevenue: Number(summary.pendingRevenue || 0),
        averageTicket: approvedPayments > 0 ? Number((approvedRevenue / approvedPayments).toFixed(2)) : 0,
        lowStockCount: Number(lowStockRow.total || 0)
      },
      charts: {
        last7Days,
        categorySales
      }
    });
  } catch (err) {
    console.error('[ERRO GET /api/admin/dashboard]:', err);
    res.status(500).json({ error: 'Erro ao carregar indicadores do dashboard.' });
  }
});

// ============================================================================
// 2. PEDIDOS — LISTAGEM, PESQUISA, FILTRO POR DATA E ATUALIZAÇÃO DE STATUS
// ============================================================================
router.get('/admin/orders', async (req, res) => {
  try {
    const { search, status, paymentStatus, dateFrom, dateTo } = req.query;

    let sql = `SELECT * FROM orders WHERE 1=1`;
    const params = [];

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(code) LIKE ? OR LOWER(customer_name) LIKE ? OR customer_phone LIKE ? OR phone_normalized LIKE ?)`;
      params.push(term, term, term, term);
    }

    if (status && status !== 'Todos') {
      sql += ` AND order_status = ?`;
      params.push(status);
    }

    if (paymentStatus && paymentStatus !== 'Todos') {
      sql += ` AND payment_status = ?`;
      params.push(paymentStatus);
    }

    if (dateFrom && dateFrom.trim() !== '') {
      sql += ` AND DATE(created_at, 'localtime') >= ?`;
      params.push(dateFrom.trim());
    }

    if (dateTo && dateTo.trim() !== '') {
      sql += ` AND DATE(created_at, 'localtime') <= ?`;
      params.push(dateTo.trim());
    }

    sql += ` ORDER BY id DESC`;
    const orders = await dbAll(sql, params);

    if (orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map((o) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');
    const allItems = await dbAll(
      `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
      orderIds
    );

    const itemsByOrder = new Map();
    for (const item of allItems) {
      if (!itemsByOrder.has(item.order_id)) {
        itemsByOrder.set(item.order_id, []);
      }
      itemsByOrder.get(item.order_id).push({
        id: item.id,
        productId: item.product_id,
        name: item.product_name,
        category: item.category,
        size: item.size,
        customized: Boolean(item.customized),
        customName: item.custom_name,
        customNumber: item.custom_number,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        totalPrice: Number(item.total_price)
      });
    }

    const formatted = orders.map((o) => ({
      id: o.id,
      code: o.code,
      customer: {
        name: o.customer_name,
        phone: o.customer_phone,
        email: o.customer_email,
        cpf: o.customer_cpf
      },
      address: {
        zip: o.address_zip,
        street: o.address_street,
        number: o.address_number,
        complement: o.address_complement,
        neighborhood: o.address_neighborhood,
        city: o.address_city,
        state: o.address_state
      },
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      orderStatus: o.order_status,
      subtotal: Number(o.subtotal),
      total: Number(o.total),
      mpPaymentId: o.mp_payment_id,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      items: itemsByOrder.get(o.id) || []
    }));

    res.json(formatted);
  } catch (err) {
    console.error('[ERRO GET /api/admin/orders]:', err);
    res.status(500).json({ error: 'Erro ao listar pedidos.' });
  }
});

// PATCH /api/admin/orders/:id/status — Atualiza status do pedido e/ou pagamento
router.patch('/admin/orders/:id/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { orderStatus, paymentStatus } = req.body;

    const validOrderStatuses = [
      'Pedido recebido',
      'Aguardando pagamento',
      'Pagamento aprovado',
      'Em preparação',
      'Enviado',
      'Entregue',
      'Cancelado'
    ];
    const validPaymentStatuses = ['Aguardando pagamento', 'Pagamento aprovado', 'Recusado', 'Estornado'];

    if (orderStatus && !validOrderStatuses.includes(orderStatus)) {
      return res.status(400).json({ error: 'Status de pedido inválido.' });
    }
    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ error: 'Status de pagamento inválido.' });
    }

    const updated = await runInTransaction(async () => {
      const existing = await dbGet(`SELECT * FROM orders WHERE id = ?`, [orderId]);
      if (!existing) {
        throw new Error('Pedido não encontrado.');
      }

      const nextOrderStatus = orderStatus || existing.order_status;
      let nextPaymentStatus = paymentStatus || existing.payment_status;

      // Sincroniza automaticamente se o admin avançar o pedido para "Pagamento aprovado"
      if (orderStatus === 'Pagamento aprovado' && !paymentStatus) {
        nextPaymentStatus = 'Pagamento aprovado';
      }

      // Se o pedido for cancelado pela primeira vez, devolve os itens ao estoque
      if (nextOrderStatus === 'Cancelado' && existing.order_status !== 'Cancelado') {
        const items = await dbAll(`SELECT product_id, quantity FROM order_items WHERE order_id = ?`, [orderId]);
        for (const item of items) {
          if (item.product_id) {
            await dbRun(
              `UPDATE products SET stock = stock + ?, available = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [item.quantity, item.product_id]
            );
          }
        }
      }

      await dbRun(
        `UPDATE orders SET order_status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [nextOrderStatus, nextPaymentStatus, orderId]
      );

      return dbGet(`SELECT * FROM orders WHERE id = ?`, [orderId]);
    });

    res.json({
      message: `Pedido ${updated.code} atualizado com sucesso!`,
      orderStatus: updated.order_status,
      paymentStatus: updated.payment_status
    });
  } catch (err) {
    console.error('[ERRO PATCH /api/admin/orders/:id/status]:', err);
    res.status(400).json({ error: err.message || 'Erro ao atualizar status do pedido.' });
  }
});

// ============================================================================
// 3. CATEGORIAS — GESTÃO COMPLETA
// ============================================================================
router.get('/admin/categories', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.active,
        COUNT(p.id) as productsCount
      FROM categories c
      LEFT JOIN products p ON p.category = c.name
      GROUP BY c.id
      ORDER BY c.id ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar categorias.' });
  }
});

router.post('/admin/categories', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (name.length < 2) {
      return res.status(400).json({ error: 'Informe um nome válido para a categoria.' });
    }

    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    await dbRun(`INSERT INTO categories (name, slug, active) VALUES (?, ?, 1)`, [name, slug]);
    res.status(201).json({ message: 'Categoria criada com sucesso!' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Já existe uma categoria com este nome.' });
    }
    res.status(500).json({ error: 'Erro ao criar categoria.' });
  }
});

router.patch('/admin/categories/:id', async (req, res) => {
  try {
    const active = req.body.active ? 1 : 0;
    await dbRun(`UPDATE categories SET active = ? WHERE id = ?`, [active, req.params.id]);
    res.json({ message: 'Status da categoria atualizado!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar categoria.' });
  }
});

router.delete('/admin/categories/:id', async (req, res) => {
  try {
    const cat = await dbGet(`SELECT * FROM categories WHERE id = ?`, [req.params.id]);
    if (!cat) return res.status(404).json({ error: 'Categoria não encontrada.' });

    const linked = await dbGet(`SELECT COUNT(*) as total FROM products WHERE category = ?`, [cat.name]);
    if (linked && linked.total > 0) {
      return res.status(400).json({
        error: `Não é possível excluir: existem ${linked.total} produto(s) vinculados a "${cat.name}".`
      });
    }

    await dbRun(`DELETE FROM categories WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Categoria excluída com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir categoria.' });
  }
});

// ============================================================================
// 4. CLIENTES — LISTAGEM E HISTÓRICO DE COMPRAS
// ============================================================================
router.get('/admin/customers', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.cpf,
        c.created_at as createdAt,
        COUNT(o.id) as ordersCount,
        COALESCE(SUM(CASE WHEN o.order_status != 'Cancelado' THEN o.total ELSE 0 END), 0) as totalSpent,
        MAX(o.created_at) as lastOrderAt
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(c.name) LIKE ? OR c.phone LIKE ? OR c.cpf LIKE ? OR LOWER(c.email) LIKE ?)`;
      params.push(term, term, term, term);
    }

    sql += ` GROUP BY c.id ORDER BY totalSpent DESC, c.id DESC`;
    const customers = await dbAll(sql, params);
    res.json(customers);
  } catch (err) {
    console.error('[ERRO GET /api/admin/customers]:', err);
    res.status(500).json({ error: 'Erro ao carregar clientes.' });
  }
});

// ============================================================================
// 5. ESTOQUE — AJUSTE RÁPIDO DE QUANTIDADE E DISPONIBILIDADE
// ============================================================================
router.patch('/admin/products/:id/stock', async (req, res) => {
  try {
    const stock = Math.max(0, parseInt(req.body.stock, 10) || 0);
    const available = req.body.available !== undefined ? (req.body.available ? 1 : 0) : stock > 0 ? 1 : 0;

    await dbRun(
      `UPDATE products SET stock = ?, available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [stock, available, req.params.id]
    );

    res.json({ message: 'Estoque atualizado com sucesso!', stock, available: Boolean(available) });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar estoque.' });
  }
});

// ============================================================================
// 6. PAGAMENTOS — HISTÓRICO DE TRANSAÇÕES
// ============================================================================
router.get('/admin/payments', async (req, res) => {
  try {
    const payments = await dbAll(`
      SELECT
        p.id,
        p.order_code as orderCode,
        p.provider,
        p.external_id as externalId,
        p.payment_method as paymentMethod,
        p.status,
        p.status_detail as statusDetail,
        p.amount,
        p.created_at as createdAt,
        o.customer_name as customerName,
        o.payment_status as orderPaymentStatus
      FROM payments p
      LEFT JOIN orders o ON o.id = p.order_id
      ORDER BY p.id DESC
    `);

    // Também retorna resumo dos pedidos para acompanhamento mesmo antes de gerar cobrança externa
    const ordersSummary = await dbAll(`
      SELECT
        code as orderCode,
        customer_name as customerName,
        payment_method as paymentMethod,
        payment_status as status,
        total as amount,
        mp_payment_id as externalId,
        created_at as createdAt
      FROM orders
      ORDER BY id DESC
      LIMIT 50
    `);

    res.json({
      transactions: payments,
      ordersPayments: ordersSummary,
      mercadoPagoConfigured: Boolean(process.env.MP_ACCESS_TOKEN)
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao consultar pagamentos.' });
  }
});

// ============================================================================
// 7. RELATÓRIOS — ANÁLISE FINANCEIRA E RANKING DE PRODUTOS
// ============================================================================
router.get('/admin/reports', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    let dateFilter = ` WHERE o.order_status != 'Cancelado' `;
    const params = [];

    if (dateFrom && dateFrom.trim() !== '') {
      dateFilter += ` AND DATE(o.created_at, 'localtime') >= ?`;
      params.push(dateFrom.trim());
    }
    if (dateTo && dateTo.trim() !== '') {
      dateFilter += ` AND DATE(o.created_at, 'localtime') <= ?`;
      params.push(dateTo.trim());
    }

    const totals = await dbGet(
      `SELECT
        COUNT(*) as totalOrders,
        COALESCE(SUM(o.total), 0) as grossRevenue,
        COALESCE(SUM(CASE WHEN o.payment_status = 'Pagamento aprovado' THEN o.total ELSE 0 END), 0) as paidRevenue
       FROM orders o
       ${dateFilter}`,
      params
    );

    const byPaymentMethod = await dbAll(
      `SELECT
        o.payment_method as method,
        COUNT(*) as count,
        COALESCE(SUM(o.total), 0) as total
       FROM orders o
       ${dateFilter}
       GROUP BY o.payment_method
       ORDER BY total DESC`,
      params
    );

    const topProducts = await dbAll(
      `SELECT
        oi.product_name as productName,
        oi.category,
        SUM(oi.quantity) as totalUnits,
        COALESCE(SUM(oi.total_price), 0) as totalRevenue
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       ${dateFilter}
       GROUP BY oi.product_name, oi.category
       ORDER BY totalUnits DESC, totalRevenue DESC
       LIMIT 10`,
      params
    );

    res.json({
      totals: {
        totalOrders: Number(totals.totalOrders || 0),
        grossRevenue: Number(totals.grossRevenue || 0),
        paidRevenue: Number(totals.paidRevenue || 0)
      },
      byPaymentMethod,
      topProducts
    });
  } catch (err) {
    console.error('[ERRO GET /api/admin/reports]:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório.' });
  }
});

// ============================================================================
// 8. CONFIGURAÇÕES — LOJA E CREDENCIAIS WHATSAPP CLOUD API
// ============================================================================
router.get('/admin/settings', async (req, res) => {
  try {
    const rows = await dbAll(`SELECT key, value FROM settings`);
    const map = {};
    rows.forEach((r) => {
      map[r.key] = r.value;
    });

    res.json({
      store_name: map.store_name || 'Fanatics Imports',
      store_instagram: map.store_instagram || '@Fanatics.imports_ofc',
      whatsapp_enabled: map.whatsapp_enabled === 'true',
      whatsapp_api_token_configured: Boolean(map.whatsapp_api_token || process.env.WHATSAPP_API_TOKEN),
      whatsapp_phone_number_id: map.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      whatsapp_destination_number: map.whatsapp_destination_number || process.env.WHATSAPP_DESTINATION_NUMBER || '',
      mercadopago_configured: Boolean(process.env.MP_ACCESS_TOKEN),
      webhook_base_url: process.env.WEBHOOK_BASE_URL || 'http://localhost:3000'
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar configurações.' });
  }
});

router.put('/admin/settings', async (req, res) => {
  try {
    const {
      store_name,
      store_instagram,
      whatsapp_enabled,
      whatsapp_api_token,
      whatsapp_phone_number_id,
      whatsapp_destination_number
    } = req.body;

    const updates = [
      ['store_name', String(store_name || 'Fanatics Imports').trim()],
      ['store_instagram', String(store_instagram || '@Fanatics.imports_ofc').trim()],
      ['whatsapp_enabled', whatsapp_enabled ? 'true' : 'false'],
      ['whatsapp_phone_number_id', String(whatsapp_phone_number_id || '').trim()],
      ['whatsapp_destination_number', String(whatsapp_destination_number || '').replace(/\D/g, '')]
    ];

    // Só sobrescreve o token se o administrador digitou um novo valor
    if (whatsapp_api_token && whatsapp_api_token.trim() !== '') {
      updates.push(['whatsapp_api_token', whatsapp_api_token.trim()]);
    }

    for (const [k, v] of updates) {
      await dbRun(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [k, v]
      );
    }

    res.json({ message: 'Configurações salvas com sucesso!' });
  } catch (err) {
    console.error('[ERRO PUT /api/admin/settings]:', err);
    res.status(500).json({ error: 'Erro ao salvar configurações.' });
  }
});

module.exports = router;