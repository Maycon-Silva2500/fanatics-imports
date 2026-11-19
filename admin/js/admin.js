/**
 * FANATICS IMPORTS — CONTROLADOR DO PAINEL ADMINISTRATIVO
 * Desenvolvido por Maycon Silva
 */

const TOKEN_KEY = 'fanatics_admin_token';
let cachedOrders = [];
let cachedProducts = [];
let lastReportData = null;

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${getToken()}`,
    ...extra
  };
}

function formatBRL(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(iso) {
  if (!iso) return '-';
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR');
}

function showAdminToast(msg) {
  const toast = document.getElementById('adminToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: authHeaders(options.headers || {})
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/admin/login.html';
    throw new Error('Sessão expirada');
  }
  return res;
}

// ============================================================================
// GRÁFICOS NATIVOS EM CANVAS (SEM DEPENDÊNCIAS EXTERNAS)
// ============================================================================
function drawBarChart(canvasId, labels, values, isCurrency = true) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const padLeft = 58;
  const padRight = 20;
  const padTop = 24;
  const padBottom = 38;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxVal = Math.max(...values, 10);

  // Linhas de grade horizontais
  ctx.strokeStyle = '#262626';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#888888';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 4; i++) {
    const y = padTop + (chartH / 4) * i;
    const val = maxVal - (maxVal / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);
    ctx.stroke();

    const labelStr = isCurrency ? `R$${Math.round(val)}` : `${Math.round(val)}`;
    ctx.fillText(labelStr, padLeft - 8, y + 4);
  }

  if (labels.length === 0) return;

  const slotW = chartW / labels.length;
  const barW = Math.min(38, slotW * 0.55);

  labels.forEach((lbl, idx) => {
    const val = values[idx] || 0;
    const barH = (val / maxVal) * chartH;
    const x = padLeft + slotW * idx + (slotW - barW) / 2;
    const y = padTop + chartH - barH;

    // Barra verde Fanatics Imports
    ctx.fillStyle = '#00E676';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]) : ctx.rect(x, y, barW, barH);
    ctx.fill();

    // Rótulo no eixo X
    ctx.fillStyle = '#B0B0B0';
    ctx.textAlign = 'center';
    const shortLbl = lbl.length > 12 ? lbl.slice(0, 11) + '…' : lbl;
    ctx.fillText(shortLbl, x + barW / 2, height - 14);
  });
}

// ============================================================================
// 1. DASHBOARD
// ============================================================================
async function loadDashboard() {
  const res = await apiFetch('/api/admin/dashboard');
  if (!res.ok) return;
  const data = await res.json();
  const m = data.metrics;

  document.getElementById('kpiTotalOrders').textContent = m.totalOrders;
  document.getElementById('kpiNewOrders').textContent = m.newOrders;
  document.getElementById('kpiAwaitingPayment').textContent = m.awaitingPayment;
  document.getElementById('kpiApprovedPayments').textContent = m.approvedPayments;
  document.getElementById('kpiInPreparation').textContent = m.inPreparation;
  document.getElementById('kpiShippedOrders').textContent = m.shippedOrders;
  document.getElementById('kpiApprovedRevenue').textContent = formatBRL(m.approvedRevenue);
  document.getElementById('kpiPendingRevenue').textContent = formatBRL(m.pendingRevenue);

  const days = data.charts.last7Days || [];
  drawBarChart(
    'dailySalesChart',
    days.map((d) => d.label),
    days.map((d) => d.revenue),
    true
  );

  const cats = data.charts.categorySales || [];
  drawBarChart(
    'categorySalesChart',
    cats.map((c) => c.category),
    cats.map((c) => c.revenue),
    true
  );
}

// ============================================================================
// 2. PEDIDOS
// ============================================================================
function getStatusBadgeClass(status) {
  if (status === 'Pagamento aprovado' || status === 'Entregue') return 'badge-green';
  if (status === 'Aguardando pagamento' || status === 'Em preparação') return 'badge-warning';
  if (status === 'Cancelado' || status === 'Recusado') return 'badge-danger';
  return 'badge-info';
}

async function loadOrders() {
  const params = new URLSearchParams();
  const search = document.getElementById('orderSearchInput').value.trim();
  const status = document.getElementById('orderStatusFilter').value;
  const dateFrom = document.getElementById('orderDateFrom').value;
  const dateTo = document.getElementById('orderDateTo').value;

  if (search) params.set('search', search);
  if (status && status !== 'Todos') params.set('status', status);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  const res = await apiFetch(`/api/admin/orders?${params.toString()}`);
  if (!res.ok) return;
  cachedOrders = await res.json();

  const tbody = document.getElementById('ordersTableBody');
  if (cachedOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-sub);">Nenhum pedido encontrado para os filtros aplicados.</td></tr>`;
    return;
  }

  tbody.innerHTML = cachedOrders
    .map((o) => {
      const itemsSummary = o.items
        .map(
          (i) =>
            `<div><strong>${i.quantity}x</strong> ${i.name} (Tam: ${i.size}) ${
              i.customized ? `<span style="color:var(--green);">[${i.customName} #${i.customNumber}]</span>` : ''
            }</div>`
        )
        .join('');

      return `
        <tr>
          <td><strong style="color:var(--green);">${o.code}</strong></td>
          <td>
            <strong>${o.customer.name}</strong><br/>
            <span style="font-size:0.78rem; color:var(--text-sub);">${o.customer.phone}</span>
          </td>
          <td style="font-size:0.8rem;">${itemsSummary}</td>
          <td><strong>${formatBRL(o.total)}</strong></td>
          <td>
            <div>${o.paymentMethod}</div>
            <span class="badge ${getStatusBadgeClass(o.paymentStatus)}">${o.paymentStatus}</span>
          </td>
          <td>
            <select class="form-control" style="padding:6px 8px; font-size:0.8rem;" onchange="updateOrderStatus(${o.id}, this.value)">
              ${[
                'Pedido recebido',
                'Aguardando pagamento',
                'Pagamento aprovado',
                'Em preparação',
                'Enviado',
                'Entregue',
                'Cancelado'
              ]
                .map((st) => `<option value="${st}" ${o.orderStatus === st ? 'selected' : ''}>${st}</option>`)
                .join('')}
            </select>
          </td>
          <td style="font-size:0.78rem; color:var(--text-sub);">${formatDateTime(o.createdAt)}</td>
          <td>
            <button type="button" class="btn-secondary" style="padding:6px 10px; font-size:0.78rem;" onclick="openOrderDetail(${o.id})">
              Detalhes
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function updateOrderStatus(orderId, newStatus) {
  const res = await apiFetch(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderStatus: newStatus })
  });
  const data = await res.json();
  if (res.ok) {
    showAdminToast(data.message);
    await loadOrders();
    await loadDashboard();
  } else {
    showAdminToast(data.error || 'Erro ao atualizar pedido.');
  }
}

function openOrderDetail(orderId) {
  const o = cachedOrders.find((item) => item.id === orderId);
  if (!o) return;

  const itemsHtml = o.items
    .map(
      (i) => `
      <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between;">
        <div>
          <strong>${i.quantity}x ${i.name}</strong> — Tamanho: <strong>${i.size}</strong>
          ${i.customized ? `<div style="color:var(--green); font-size:0.82rem;">Personalização: ${i.customName} #${i.customNumber}</div>` : ''}
        </div>
        <strong>${formatBRL(i.totalPrice)}</strong>
      </div>
    `
    )
    .join('');

  document.getElementById('orderDetailContent').innerHTML = `
    <h2 style="color:var(--green); margin-bottom:4px;">PEDIDO ${o.code}</h2>
    <p style="font-size:0.82rem; color:var(--text-sub); margin-bottom:16px;">Registrado em: ${formatDateTime(o.createdAt)}</p>

    <div style="background:var(--bg-dark); padding:14px; border-radius:8px; border:1px solid var(--border-color); margin-bottom:14px; font-size:0.88rem;">
      <p><strong>Cliente:</strong> ${o.customer.name}</p>
      <p><strong>Telefone / WhatsApp:</strong> ${o.customer.phone}</p>
      <p><strong>CPF:</strong> ${o.customer.cpf || '-'} | <strong>E-mail:</strong> ${o.customer.email || '-'}</p>
      <p style="margin-top:8px;"><strong>Endereço de Entrega:</strong><br/>
        ${o.address.street}, ${o.address.number} ${o.address.complement ? `(${o.address.complement})` : ''}<br/>
        ${o.address.neighborhood} — ${o.address.city}/${o.address.state} — CEP: ${o.address.zip}
      </p>
    </div>

    <div style="margin-bottom:14px;">
      <strong style="font-size:0.85rem; color:var(--green);">ITENS DO PEDIDO:</strong>
      ${itemsHtml}
      <div style="display:flex; justify-content:space-between; font-size:1.15rem; margin-top:10px;">
        <strong>Valor Total:</strong>
        <strong style="color:var(--green);">${formatBRL(o.total)}</strong>
      </div>
    </div>

    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; background:var(--bg-dark); padding:12px; border-radius:8px;">
      <div style="flex:1;">
        <label style="font-size:0.76rem; color:var(--text-sub); display:block; margin-bottom:4px;">Situação do Pagamento (${o.paymentMethod}):</label>
        <select id="modalPaymentStatusSelect" class="form-control" style="width:100%;">
          ${['Aguardando pagamento', 'Pagamento aprovado', 'Recusado', 'Estornado']
            .map((ps) => `<option value="${ps}" ${o.paymentStatus === ps ? 'selected' : ''}>${ps}</option>`)
            .join('')}
        </select>
      </div>
      <button type="button" class="btn-primary" style="margin-top:18px;" onclick="saveModalPaymentStatus(${o.id})">
        Salvar Pagamento
      </button>
    </div>
  `;

  document.getElementById('orderDetailModal').classList.add('open');
}

async function saveModalPaymentStatus(orderId) {
  const paymentStatus = document.getElementById('modalPaymentStatusSelect').value;
  const res = await apiFetch(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentStatus })
  });
  const data = await res.json();
  if (res.ok) {
    showAdminToast(data.message);
    document.getElementById('orderDetailModal').classList.remove('open');
    await loadOrders();
    await loadDashboard();
  } else {
    showAdminToast(data.error || 'Erro ao atualizar pagamento.');
  }
}

// ============================================================================
// 3. PRODUTOS & 6. ESTOQUE
// ============================================================================
async function loadProductsAndStock() {
  const [catRes, prodRes] = await Promise.all([fetch('/api/categories'), fetch('/api/products')]);
  if (catRes.ok) {
    const cats = await catRes.json();
    document.getElementById('pCategory').innerHTML = cats
      .map((c) => `<option value="${c.name}">${c.name}</option>`)
      .join('');
  }

  if (!prodRes.ok) return;
  cachedProducts = await prodRes.json();

  // Tabela Aba Produtos
  const prodBody = document.getElementById('adminProductsBody');
  prodBody.innerHTML = cachedProducts
    .map((p) => {
      const hasPromo = p.promoPrice && p.promoPrice < p.price;
      return `
        <tr>
          <td><img src="${p.image}" alt="${p.name}" class="prod-thumb" /></td>
          <td>
            <strong>${p.name}</strong><br/>
            <span style="font-size:0.75rem; color:var(--green);">${p.category}</span>
          </td>
          <td>
            ${hasPromo ? `<span style="text-decoration:line-through; color:var(--text-muted); font-size:0.76rem;">${formatBRL(p.price)}</span><br/>` : ''}
            <strong>${formatBRL(hasPromo ? p.promoPrice : p.price)}</strong>
          </td>
          <td>${p.stock} un.</td>
          <td>
            <span class="badge ${p.available && p.stock > 0 ? 'badge-green' : 'badge-danger'}">
              ${p.available && p.stock > 0 ? 'Ativo' : 'Esgotado'}
            </span>
          </td>
          <td>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-secondary" style="padding:5px 9px; font-size:0.76rem;" onclick="editProduct(${p.id})">Editar</button>
              <button type="button" class="btn-danger-sm" onclick="removeProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  // Tabela Aba Estoque
  const stockBody = document.getElementById('stockTableBody');
  stockBody.innerHTML = cachedProducts
    .map((p) => {
      let badgeHtml = `<span class="badge badge-green">Normal</span>`;
      if (p.stock <= 0) badgeHtml = `<span class="badge badge-danger">Esgotado</span>`;
      else if (p.stock <= 5) badgeHtml = `<span class="badge badge-warning">Estoque Baixo</span>`;

      return `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.category}</td>
          <td>${badgeHtml}</td>
          <td>
            <input type="number" min="0" id="stockInput_${p.id}" value="${p.stock}" class="form-control" style="width:90px; padding:6px 10px;" />
          </td>
          <td>
            <button type="button" class="btn-primary" style="padding:6px 12px; font-size:0.78rem;" onclick="saveQuickStock(${p.id})">
              Atualizar
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function editProduct(id) {
  const p = cachedProducts.find((item) => item.id === id);
  if (!p) return;

  document.getElementById('editProdId').value = p.id;
  document.getElementById('prodFormHeading').textContent = `EDITANDO PRODUTO #${p.id}`;
  document.getElementById('pName').value = p.name;
  document.getElementById('pCategory').value = p.category;
  document.getElementById('pDescription').value = p.description;
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pPromoPrice').value = p.promoPrice || '';
  document.getElementById('pStock').value = p.stock;
  document.getElementById('pAvailable').checked = p.available;
  document.getElementById('pCustomizable').checked = p.customizable;
  document.getElementById('saveProdSubmitBtn').textContent = 'Atualizar Produto';
  document.getElementById('cancelProdEditBtn').style.display = 'inline-flex';

  document.querySelectorAll('#pSizesGroup input[type="checkbox"]').forEach((cb) => {
    cb.checked = p.sizes.includes(cb.value);
  });
}

function resetProductForm() {
  document.getElementById('editProdId').value = '';
  document.getElementById('prodFormHeading').textContent = 'CADASTRAR PRODUTO';
  document.getElementById('adminProductForm').reset();
  document.getElementById('pStock').value = 10;
  document.getElementById('pAvailable').checked = true;
  document.getElementById('pCustomizable').checked = true;
  document.getElementById('saveProdSubmitBtn').textContent = 'Salvar Produto';
  document.getElementById('cancelProdEditBtn').style.display = 'none';
}

async function removeProduct(id, name) {
  if (!confirm(`Excluir permanentemente "${name}"?`)) return;
  const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (res.ok) {
    showAdminToast(data.message);
    await loadProductsAndStock();
  } else {
    showAdminToast(data.error || 'Erro ao excluir.');
  }
}

async function saveQuickStock(productId) {
  const input = document.getElementById(`stockInput_${productId}`);
  const stock = parseInt(input.value, 10) || 0;
  const res = await apiFetch(`/api/admin/products/${productId}/stock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock, available: stock > 0 })
  });
  const data = await res.json();
  if (res.ok) {
    showAdminToast(data.message);
    await loadProductsAndStock();
  } else {
    showAdminToast(data.error || 'Erro ao atualizar estoque.');
  }
}

// ============================================================================
// 4. CATEGORIAS
// ============================================================================
async function loadAdminCategories() {
  const res = await apiFetch('/api/admin/categories');
  if (!res.ok) return;
  const cats = await res.json();

  document.getElementById('categoriesTableBody').innerHTML = cats
    .map(
      (c) => `
      <tr>
        <td>#${c.id}</td>
        <td><strong>${c.name}</strong></td>
        <td>${c.productsCount} produto(s)</td>
        <td>
          <span class="badge ${c.active ? 'badge-green' : 'badge-danger'}">${c.active ? 'Ativa' : 'Inativa'}</span>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-secondary" style="padding:5px 9px; font-size:0.76rem;" onclick="toggleCategory(${c.id}, ${c.active ? 0 : 1})">
              ${c.active ? 'Desativar' : 'Ativar'}
            </button>
            <button type="button" class="btn-danger-sm" onclick="deleteCategory(${c.id})">Excluir</button>
          </div>
        </td>
      </tr>
    `
    )
    .join('');
}

async function toggleCategory(id, active) {
  const res = await apiFetch(`/api/admin/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active })
  });
  if (res.ok) {
    showAdminToast('Categoria atualizada!');
    await loadAdminCategories();
    await loadProductsAndStock();
  }
}

async function deleteCategory(id) {
  if (!confirm('Deseja excluir esta categoria?')) return;
  const res = await apiFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (res.ok) {
    showAdminToast(data.message);
    await loadAdminCategories();
  } else {
    showAdminToast(data.error || 'Erro ao excluir categoria.');
  }
}

// ============================================================================
// 5. CLIENTES
// ============================================================================
async function loadCustomers(search = '') {
  const res = await apiFetch(`/api/admin/customers?search=${encodeURIComponent(search)}`);
  if (!res.ok) return;
  const customers = await res.json();

  const tbody = document.getElementById('customersTableBody');
  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-sub);">Nenhum cliente encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = customers
    .map(
      (c) => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.phone}</td>
        <td>${c.cpf || '-'}</td>
        <td>${c.email || '-'}</td>
        <td><strong>${c.ordersCount}</strong> pedido(s)</td>
        <td style="color:var(--green); font-weight:700;">${formatBRL(c.totalSpent)}</td>
      </tr>
    `
    )
    .join('');
}

// ============================================================================
// 7. PAGAMENTOS
// ============================================================================
async function loadPayments() {
  const res = await apiFetch('/api/admin/payments');
  if (!res.ok) return;
  const data = await res.json();

  const badge = document.getElementById('mpStatusBadge');
  if (data.mercadoPagoConfigured) {
    badge.className = 'badge badge-green';
    badge.textContent = 'Mercado Pago Configurado';
  } else {
    badge.className = 'badge badge-warning';
    badge.textContent = 'Mercado Pago Pendente (Etapa 8)';
  }

  const rows = data.transactions.length > 0 ? data.transactions : data.ordersPayments;
  const tbody = document.getElementById('paymentsTableBody');

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-sub);">Nenhuma movimentação financeira registrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (p) => `
      <tr>
        <td><strong style="color:var(--green);">${p.orderCode}</strong></td>
        <td>${p.customerName || '-'}</td>
        <td>${p.paymentMethod}</td>
        <td><strong>${formatBRL(p.amount)}</strong></td>
        <td style="font-family:monospace; font-size:0.78rem;">${p.externalId || 'Aguardando integração'}</td>
        <td><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></td>
        <td style="font-size:0.78rem; color:var(--text-sub);">${formatDateTime(p.createdAt)}</td>
      </tr>
    `
    )
    .join('');
}

// ============================================================================
// 8. RELATÓRIOS & EXPORTAÇÃO CSV
// ============================================================================
async function loadReports() {
  const params = new URLSearchParams();
  const dateFrom = document.getElementById('reportDateFrom').value;
  const dateTo = document.getElementById('reportDateTo').value;
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  const res = await apiFetch(`/api/admin/reports?${params.toString()}`);
  if (!res.ok) return;
  const data = await res.json();
  lastReportData = data;

  document.getElementById('repTotalOrders').textContent = data.totals.totalOrders;
  document.getElementById('repGrossRevenue').textContent = formatBRL(data.totals.grossRevenue);
  document.getElementById('repPaidRevenue').textContent = formatBRL(data.totals.paidRevenue);

  document.getElementById('repPaymentMethodsBody').innerHTML =
    data.byPaymentMethod.length === 0
      ? `<tr><td colspan="3" style="color:var(--text-sub);">Sem dados no período.</td></tr>`
      : data.byPaymentMethod
          .map(
            (m) => `
            <tr>
              <td><strong>${m.method}</strong></td>
              <td>${m.count}</td>
              <td style="color:var(--green); font-weight:700;">${formatBRL(m.total)}</td>
            </tr>
          `
          )
          .join('');

  document.getElementById('repTopProductsBody').innerHTML =
    data.topProducts.length === 0
      ? `<tr><td colspan="3" style="color:var(--text-sub);">Sem vendas no período.</td></tr>`
      : data.topProducts
          .map(
            (tp) => `
            <tr>
              <td><strong>${tp.productName}</strong></td>
              <td>${tp.totalUnits} un.</td>
              <td style="color:var(--green); font-weight:700;">${formatBRL(tp.totalRevenue)}</td>
            </tr>
          `
          )
          .join('');
}

function exportReportToCSV() {
  if (!lastReportData) return;
  const lines = [
    'RELATORIO GERENCIAL - FANATICS IMPORTS',
    `Total de Pedidos;${lastReportData.totals.totalOrders}`,
    `Faturamento Bruto;${lastReportData.totals.grossRevenue.toFixed(2)}`,
    `Receita Confirmada;${lastReportData.totals.paidRevenue.toFixed(2)}`,
    '',
    'PRODUTOS MAIS VENDIDOS',
    'Produto;Categoria;Unidades;Faturamento'
  ];

  lastReportData.topProducts.forEach((p) => {
    lines.push(`"${p.productName}";"${p.category}";${p.totalUnits};${Number(p.totalRevenue).toFixed(2)}`);
  });

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-fanatics-imports-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// 9. CONFIGURAÇÕES & BACKUPS
// ============================================================================
async function loadSettingsAndBackups() {
  const [cfgRes, dbRes] = await Promise.all([
    apiFetch('/api/admin/settings'),
    apiFetch('/api/admin/database/stats')
  ]);

  if (cfgRes.ok) {
    const cfg = await cfgRes.json();
    document.getElementById('cfgStoreName').value = cfg.store_name;
    document.getElementById('cfgStoreInstagram').value = cfg.store_instagram;
    document.getElementById('cfgWhatsappEnabled').checked = cfg.whatsapp_enabled;
    document.getElementById('cfgWhatsappPhoneId').value = cfg.whatsapp_phone_number_id;
    document.getElementById('cfgWhatsappDest').value = cfg.whatsapp_destination_number;
    document.getElementById('cfgTokenStatus').textContent = cfg.whatsapp_api_token_configured
      ? 'Status: Token já configurado no servidor.'
      : 'Status: Nenhum token configurado ainda (será usado na Etapa 7).';
  }

  if (dbRes.ok) {
    const dbStats = await dbRes.json();
    document.getElementById('dbStatsInfo').textContent = `Banco ativo: ${dbStats.databaseFile} (${dbStats.sizeKB} KB) • Pronto para migração PostgreSQL.`;

    document.getElementById('backupsTableBody').innerHTML = dbStats.backups
      .map(
        (b) => `
        <tr>
          <td style="font-size:0.8rem;">${b.filename}</td>
          <td>${b.sizeKB} KB</td>
          <td>
            <button type="button" class="btn-secondary" style="padding:4px 10px; font-size:0.76rem;" onclick="downloadBackup('${b.filename}')">
              Baixar
            </button>
          </td>
        </tr>
      `
      )
      .join('');
  }
}

async function downloadBackup(filename) {
  const res = await apiFetch(`/api/admin/database/backup/${encodeURIComponent(filename)}`);
  if (!res.ok) {
    showAdminToast('Erro ao baixar backup.');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// NAVEGAÇÃO E EVENTOS INICIAIS
// ============================================================================
const TAB_TITLES = {
  dashboard: 'DASHBOARD GERAL',
  pedidos: 'PEDIDOS DA LOJA',
  produtos: 'CATÁLOGO DE PRODUTOS',
  categorias: 'CATEGORIAS',
  clientes: 'CLIENTES',
  estoque: 'CONTROLE DE ESTOQUE',
  pagamentos: 'PAGAMENTOS E TRANSAÇÕES',
  relatorios: 'RELATÓRIOS DE VENDAS',
  configuracoes: 'CONFIGURAÇÕES E BACKUPS'
};

function switchTab(tabName) {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `tab-${tabName}`);
  });
  document.getElementById('currentPageTitle').textContent = TAB_TITLES[tabName] || 'PAINEL';
  document.getElementById('adminSidebar').classList.remove('open');

  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'pedidos') loadOrders();
  if (tabName === 'produtos' || tabName === 'estoque') loadProductsAndStock();
  if (tabName === 'categorias') loadAdminCategories();
  if (tabName === 'clientes') loadCustomers();
  if (tabName === 'pagamentos') loadPayments();
  if (tabName === 'relatorios') loadReports();
  if (tabName === 'configuracoes') loadSettingsAndBackups();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) {
    window.location.href = '/admin/login.html';
    return;
  }

  // Verifica validade da sessão
  await apiFetch('/api/auth/verify');

  // Carrega dados iniciais
  await loadDashboard();

  // Navegação sidebar
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Menu mobile
  document.getElementById('toggleSidebarBtn').addEventListener('click', () => {
    document.getElementById('adminSidebar').classList.toggle('open');
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/admin/login.html';
  });

  // Filtros de pedidos
  document.getElementById('applyOrderFiltersBtn').addEventListener('click', loadOrders);
  document.getElementById('refreshOrdersBtn').addEventListener('click', loadOrders);
  document.getElementById('closeOrderModalBtn').addEventListener('click', () => {
    document.getElementById('orderDetailModal').classList.remove('open');
  });

  // Formulário de Produto
  document.getElementById('cancelProdEditBtn').addEventListener('click', resetProductForm);
  document.getElementById('adminProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedSizes = Array.from(document.querySelectorAll('#pSizesGroup input:checked')).map((cb) => cb.value);
    if (selectedSizes.length === 0) {
      showAdminToast('Selecione pelo menos um tamanho.');
      return;
    }

    const editId = document.getElementById('editProdId').value;
    const formData = new FormData();
    formData.append('name', document.getElementById('pName').value.trim());
    formData.append('category', document.getElementById('pCategory').value);
    formData.append('description', document.getElementById('pDescription').value.trim());
    formData.append('price', document.getElementById('pPrice').value);
    formData.append('promoPrice', document.getElementById('pPromoPrice').value);
    formData.append('stock', document.getElementById('pStock').value);
    formData.append('sizes', JSON.stringify(selectedSizes));
    formData.append('available', document.getElementById('pAvailable').checked);
    formData.append('customizable', document.getElementById('pCustomizable').checked);

    const files = document.getElementById('pPhotos').files;
    for (let i = 0; i < files.length; i++) {
      formData.append('photos', files[i]);
    }

    const url = editId ? `/api/products/${editId}` : '/api/products';
    const method = editId ? 'PUT' : 'POST';

    const res = await apiFetch(url, { method, body: formData });
    const data = await res.json();
    if (res.ok) {
      showAdminToast(data.message);
      resetProductForm();
      await loadProductsAndStock();
    } else {
      showAdminToast(data.error || 'Erro ao salvar produto.');
    }
  });

  // Nova Categoria
  document.getElementById('newCategoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newCategoryName').value.trim();
    const res = await apiFetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (res.ok) {
      showAdminToast(data.message);
      document.getElementById('newCategoryName').value = '';
      await loadAdminCategories();
    } else {
      showAdminToast(data.error || 'Erro ao criar categoria.');
    }
  });

  // Pesquisa de clientes
  document.getElementById('customerSearchInput').addEventListener('input', (e) => {
    loadCustomers(e.target.value);
  });

  // Relatórios
  document.getElementById('generateReportBtn').addEventListener('click', loadReports);
  document.getElementById('exportReportCsvBtn').addEventListener('click', exportReportToCSV);

  // Configurações
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      store_name: document.getElementById('cfgStoreName').value,
      store_instagram: document.getElementById('cfgStoreInstagram').value,
      whatsapp_enabled: document.getElementById('cfgWhatsappEnabled').checked,
      whatsapp_api_token: document.getElementById('cfgWhatsappToken').value,
      whatsapp_phone_number_id: document.getElementById('cfgWhatsappPhoneId').value,
      whatsapp_destination_number: document.getElementById('cfgWhatsappDest').value
    };
    const res = await apiFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showAdminToast(data.message);
      document.getElementById('cfgWhatsappToken').value = '';
      await loadSettingsAndBackups();
    } else {
      showAdminToast(data.error || 'Erro ao salvar configurações.');
    }
  });

  // Trocar Senha Admin
  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentAdminPass').value;
    const newPassword = document.getElementById('newAdminPass').value;
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (res.ok) {
      showAdminToast(data.message);
      document.getElementById('changePasswordForm').reset();
    } else {
      showAdminToast(data.error || 'Erro ao alterar senha.');
    }
  });

  // Gerar Backup Manual
  document.getElementById('createBackupNowBtn').addEventListener('click', async () => {
    const res = await apiFetch('/api/admin/database/backup', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showAdminToast(data.message);
      await loadSettingsAndBackups();
    } else {
      showAdminToast(data.error || 'Erro ao gerar backup.');
    }
  });
});