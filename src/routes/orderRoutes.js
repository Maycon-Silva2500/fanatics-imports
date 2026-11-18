/**
 * FANATICS IMPORTS — API REST DE PEDIDOS, CARRINHO E RASTREAMENTO SEGURO
 * Desenvolvido por Maycon Silva
 */

const express = require('express');
const { dbRun, dbGet, dbAll, runInTransaction } = require('../config/db');

const router = express.Router();

const ALLOWED_PAYMENT_METHODS = ['PIX', 'Cartão de Crédito', 'Cartão de Débito'];

function normalizePhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  return digits;
}

function normalizeOrderCode(code) {
  let clean = String(code || '').trim().toUpperCase();
  if (clean && !clean.startsWith('#')) {
    clean = `#${clean}`;
  }
  return clean;
}

function maskCustomerName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || 'Cliente';
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

// POST /api/orders — Cria um novo pedido com validação real de preço e estoque
router.post('/orders', async (req, res) => {
  try {
    const { customer, address, paymentMethod, items } = req.body;

    if (!customer || !customer.name || customer.name.trim().length < 3) {
      return res.status(400).json({ error: 'Informe seu nome completo.' });
    }

    const phoneNormalized = normalizePhone(customer.phone);
    if (phoneNormalized.length < 10 || phoneNormalized.length > 11) {
      return res.status(400).json({ error: 'Informe um telefone/WhatsApp válido com DDD (10 ou 11 dígitos).' });
    }

    const cpfDigits = String(customer.cpf || '').replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      return res.status(400).json({ error: 'Informe um CPF válido com 11 dígitos.' });
    }

    if (
      !address ||
      !address.zip ||
      !address.street ||
      !address.number ||
      !address.neighborhood ||
      !address.city ||
      !address.state
    ) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios do endereço de entrega.' });
    }

    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Forma de pagamento inválida.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Seu carrinho está vazio.' });
    }

    const createdOrder = await runInTransaction(async () => {
      let calculatedTotal = 0;
      const validatedItems = [];
      const requestedStockByProduct = new Map();

      for (const rawItem of items) {
        const productId = parseInt(rawItem.id, 10);
        const qty = parseInt(rawItem.quantity, 10);

        if (!productId || isNaN(qty) || qty <= 0) {
          throw new Error('Item inválido no carrinho.');
        }

        const product = await dbGet(`SELECT * FROM products WHERE id = ?`, [productId]);
        if (!product) {
          throw new Error(`O produto "${rawItem.name || productId}" não está mais disponível no catálogo.`);
        }

        if (!product.available || product.stock <= 0) {
          throw new Error(`O produto "${product.name}" está esgotado no momento.`);
        }

        const accumulatedQty = (requestedStockByProduct.get(productId) || 0) + qty;
        if (accumulatedQty > product.stock) {
          throw new Error(
            `Estoque insuficiente para "${product.name}". Disponível: ${product.stock} ${
              product.stock === 1 ? 'unidade' : 'unidades'
            }.`
          );
        }
        requestedStockByProduct.set(productId, accumulatedQty);

        const size = String(rawItem.size || '').trim();
        if (!size) {
          throw new Error(`Selecione um tamanho para "${product.name}".`);
        }

        const hasPromo =
          product.promo_price !== null &&
          Number(product.promo_price) > 0 &&
          Number(product.promo_price) < Number(product.price);
        const unitPrice = hasPromo ? Number(product.promo_price) : Number(product.price);
        const itemTotal = Number((unitPrice * qty).toFixed(2));
        calculatedTotal = Number((calculatedTotal + itemTotal).toFixed(2));

        const allowCustom = Boolean(product.customizable);
        const customName = allowCustom ? String(rawItem.customName || '').trim().toUpperCase().slice(0, 20) : '';
        const customNumber = allowCustom ? String(rawItem.customNumber || '').trim().slice(0, 3) : '';
        const isCustomized = allowCustom && (customName !== '' || customNumber !== '') ? 1 : 0;

        validatedItems.push({
          product_id: product.id,
          product_name: product.name,
          category: product.category,
          size,
          customized: isCustomized,
          custom_name: customName,
          custom_number: customNumber,
          quantity: qty,
          unit_price: unitPrice,
          total_price: itemTotal
        });
      }

      // Cadastra ou atualiza cliente
      let customerId = null;
      const existingCustomer = await dbGet(`SELECT id FROM customers WHERE phone_normalized = ?`, [phoneNormalized]);
      if (existingCustomer) {
        customerId = existingCustomer.id;
        await dbRun(
          `UPDATE customers SET name = ?, phone = ?, email = ?, cpf = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [customer.name.trim(), customer.phone.trim(), (customer.email || '').trim(), cpfDigits, customerId]
        );
      } else {
        const custInsert = await dbRun(
          `INSERT INTO customers (name, phone, phone_normalized, email, cpf) VALUES (?, ?, ?, ?, ?)`,
          [customer.name.trim(), customer.phone.trim(), phoneNormalized, (customer.email || '').trim(), cpfDigits]
        );
        customerId = custInsert.id;
      }

      // Gera código único sequencial (#FI-0001, #FI-0002...)
      const lastOrder = await dbGet(`SELECT MAX(id) as maxId FROM orders`);
      const nextSeq = (lastOrder && lastOrder.maxId ? lastOrder.maxId : 0) + 1;
      const orderCode = `#FI-${String(nextSeq).padStart(4, '0')}`;

      const orderInsert = await dbRun(
        `INSERT INTO orders (
          code, customer_id, customer_name, customer_phone, phone_normalized, customer_email, customer_cpf,
          address_zip, address_street, address_number, address_complement, address_neighborhood, address_city, address_state,
          payment_method, payment_status, order_status, subtotal, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aguardando pagamento', 'Pedido recebido', ?, ?)`,
        [
          orderCode,
          customerId,
          customer.name.trim(),
          customer.phone.trim(),
          phoneNormalized,
          (customer.email || '').trim(),
          cpfDigits,
          address.zip.trim(),
          address.street.trim(),
          address.number.trim(),
          (address.complement || '').trim(),
          address.neighborhood.trim(),
          address.city.trim(),
          address.state.trim().toUpperCase(),
          paymentMethod,
          calculatedTotal,
          calculatedTotal
        ]
      );

      const orderId = orderInsert.id;

      for (const item of validatedItems) {
        await dbRun(
          `INSERT INTO order_items (
            order_id, product_id, product_name, category, size, customized, custom_name, custom_number, quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.product_id,
            item.product_name,
            item.category,
            item.size,
            item.customized,
            item.custom_name,
            item.custom_number,
            item.quantity,
            item.unit_price,
            item.total_price
          ]
        );
      }

      // Baixa automática no estoque
      for (const [prodId, soldQty] of requestedStockByProduct.entries()) {
        await dbRun(
          `UPDATE products
           SET stock = MAX(0, stock - ?),
               available = CASE WHEN (stock - ?) <= 0 THEN 0 ELSE available END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [soldQty, soldQty, prodId]
        );
      }

      return {
        id: orderId,
        code: orderCode,
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim()
        },
        address: {
          street: address.street.trim(),
          number: address.number.trim(),
          neighborhood: address.neighborhood.trim(),
          city: address.city.trim(),
          state: address.state.trim().toUpperCase(),
          zip: address.zip.trim()
        },
        paymentMethod,
        paymentStatus: 'Aguardando pagamento',
        orderStatus: 'Pedido recebido',
        total: calculatedTotal,
        items: validatedItems.map((i) => ({
          name: i.product_name,
          size: i.size,
          customized: Boolean(i.customized),
          customName: i.custom_name,
          customNumber: i.custom_number,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          totalPrice: i.total_price
        })),
        createdAt: new Date().toISOString()
      };
    });

    return res.status(201).json(createdOrder);
  } catch (err) {
    console.error('[ERRO POST /api/orders]:', err.message);
    return res.status(400).json({ error: err.message || 'Não foi possível finalizar o pedido.' });
  }
});

// POST /api/orders/track — Consulta segura de pedido por Código + Telefone
router.post('/orders/track', async (req, res) => {
  try {
    const code = normalizeOrderCode(req.body.code);
    const phoneNormalized = normalizePhone(req.body.phone);

    if (!code || phoneNormalized.length < 8) {
      return res.status(400).json({ error: 'Informe o código do pedido e o telefone cadastrado na compra.' });
    }

    const order = await dbGet(
      `SELECT id, code, customer_name, phone_normalized, address_city, address_state,
              payment_method, payment_status, order_status, total, created_at
       FROM orders
       WHERE UPPER(code) = ? AND phone_normalized = ?`,
      [code, phoneNormalized]
    );

    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado. Confira o código e o telefone informados.' });
    }

    const items = await dbAll(
      `SELECT product_name, size, customized, custom_name, custom_number, quantity, unit_price, total_price
       FROM order_items
       WHERE order_id = ?`,
      [order.id]
    );

    return res.json({
      code: order.code,
      customer: {
        name: maskCustomerName(order.customer_name)
      },
      destination: `${order.address_city} - ${order.address_state}`,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      total: Number(order.total),
      createdAt: order.created_at,
      items: items.map((item) => ({
        name: item.product_name,
        size: item.size,
        customized: Boolean(item.customized),
        customName: item.custom_name,
        customNumber: item.custom_number,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        totalPrice: Number(item.total_price)
      }))
    });
  } catch (err) {
    console.error('[ERRO POST /api/orders/track]:', err);
    return res.status(500).json({ error: 'Erro ao consultar pedido.' });
  }
});

module.exports = router;