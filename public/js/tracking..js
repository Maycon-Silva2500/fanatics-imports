/**
 * FANATICS IMPORTS — ACOMPANHAMENTO SEGURO DE PEDIDOS
 * Desenvolvido por Maycon Silva
 */

const LOCAL_ORDERS_STORAGE = 'fanatics_imports_local_orders_v1';

const ORDER_STEPS = [
  { key: 'Pedido recebido', label: 'Pedido recebido', desc: 'Seu pedido foi registrado no sistema da Fanatics Imports.' },
  { key: 'Aguardando pagamento', label: 'Aguardando pagamento', desc: 'Aguardando confirmação do PIX ou operadora do cartão.' },
  { key: 'Pagamento aprovado', label: 'Pagamento aprovado', desc: 'Pagamento confirmado com sucesso!' },
  { key: 'Em preparação', label: 'Em preparação', desc: 'Seu manto está sendo separado e personalizado.' },
  { key: 'Enviado', label: 'Enviado', desc: 'Pedido despachado para entrega.' },
  { key: 'Entregue', label: 'Entregue', desc: 'Pedido entregue no endereço informado.' }
];

function normalizeDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

function showTrackingToast(msg) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('trackingForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let codeInput = document.getElementById('trackOrderCode').value.trim().toUpperCase();
    if (!codeInput.startsWith('#')) {
      codeInput = `#${codeInput}`;
    }
    const phoneInput = normalizeDigits(document.getElementById('trackPhone').value);

    if (phoneInput.length < 8) {
      showTrackingToast('Informe um número de telefone válido com DDD.');
      return;
    }

    let foundOrder = null;

    // Consulta o backend oficial (Etapa 4/5); se ainda não estiver ativo, consulta pedidos de teste salvos localmente
    try {
      const response = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeInput, phone: phoneInput })
      });
      if (response.ok) {
        foundOrder = await response.json();
      }
    } catch {
      // Fallback para pedidos locais na Etapa 2
    }

    if (!foundOrder) {
      const localOrders = JSON.parse(localStorage.getItem(LOCAL_ORDERS_STORAGE) || '[]');
      foundOrder = localOrders.find(
        (o) => o.code.toUpperCase() === codeInput && normalizeDigits(o.customer.phone) === phoneInput
      );
    }

    const resultBox = document.getElementById('trackingResult');

    if (!foundOrder) {
      resultBox.style.display = 'none';
      showTrackingToast('Pedido não encontrado. Verifique o código e o telefone informados.');
      return;
    }

    // Exibe dados protegidos do pedido
    document.getElementById('resOrderCode').textContent = foundOrder.code;
    document.getElementById('resCustomerName').textContent = foundOrder.customer.name;

    const itemsHtml = foundOrder.items
      .map(
        (item) =>
          `<div>• ${item.quantity}x <strong>${item.name}</strong> (Tam: ${item.size}) ${
            item.customized ? `- Personalização: ${item.customName} #${item.customNumber}` : ''
          }</div>`
      )
      .join('');

    document.getElementById('resOrderItems').innerHTML = `
      <div style="margin-bottom: 6px;"><strong>Pagamento:</strong> ${foundOrder.paymentMethod} (${foundOrder.paymentStatus})</div>
      <div><strong>Itens do Pedido:</strong></div>
      ${itemsHtml}
    `;

    // Monta linha do tempo com os 6 status obrigatórios
    const currentStatus = foundOrder.orderStatus || foundOrder.paymentStatus || 'Pedido recebido';
    let currentIndex = ORDER_STEPS.findIndex((s) => s.key.toLowerCase() === currentStatus.toLowerCase());
    if (currentIndex === -1) currentIndex = 1;

    const timelineEl = document.getElementById('statusTimeline');
    timelineEl.innerHTML = ORDER_STEPS.map((step, index) => {
      const stateClass = index < currentIndex ? 'completed' : index === currentIndex ? 'active' : '';
      return `
        <div class="status-step ${stateClass}">
          <div class="step-dot">${index <= currentIndex ? '✓' : index + 1}</div>
          <div>
            <strong style="display: block; font-size: 0.95rem;">${step.label}</strong>
            <span style="font-size: 0.8rem; color: var(--text-secondary);">${step.desc}</span>
          </div>
        </div>
      `;
    }).join('');

    resultBox.style.display = 'block';
  });
});