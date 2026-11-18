/**
 * FANATICS IMPORTS — ACOMPANHAMENTO SEGURO DE PEDIDOS VIA API REST
 * Desenvolvido por Maycon Silva
 */

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

function formatBRL(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function showTrackingToast(msg) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const prefillCode = params.get('code');
  if (prefillCode) {
    const codeField = document.getElementById('trackOrderCode');
    if (codeField) codeField.value = prefillCode;
  }

  const form = document.getElementById('trackingForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let codeInput = document.getElementById('trackOrderCode').value.trim().toUpperCase();
    if (!codeInput.startsWith('#')) {
      codeInput = `#${codeInput}`;
    }
    const phoneInput = normalizeDigits(document.getElementById('trackPhone').value);

    if (phoneInput.length < 10) {
      showTrackingToast('Informe um número de telefone válido com DDD.');
      return;
    }

    const resultBox = document.getElementById('trackingResult');

    try {
      const response = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeInput, phone: phoneInput })
      });

      const data = await response.json();

      if (!response.ok) {
        resultBox.style.display = 'none';
        showTrackingToast(data.error || 'Pedido não encontrado. Verifique os dados.');
        return;
      }

      document.getElementById('resOrderCode').textContent = data.code;
      document.getElementById('resCustomerName').textContent = `${data.customer.name} (${data.destination})`;

      const itemsHtml = data.items
        .map(
          (item) =>
            `<div>• ${item.quantity}x <strong>${item.name}</strong> (Tam: ${item.size}) ${
              item.customized ? `- Personalização: ${item.customName} #${item.customNumber}` : ''
            } — ${formatBRL(item.totalPrice)}</div>`
        )
        .join('');

      document.getElementById('resOrderItems').innerHTML = `
        <div style="margin-bottom: 6px;"><strong>Pagamento:</strong> ${data.paymentMethod} — <span style="color: var(--green-primary);">${data.paymentStatus}</span></div>
        <div style="margin-bottom: 6px;"><strong>Total do Pedido:</strong> ${formatBRL(data.total)}</div>
        <div><strong>Itens do Pedido:</strong></div>
        ${itemsHtml}
      `;

      let currentIndex = ORDER_STEPS.findIndex(
        (s) => s.key.toLowerCase() === String(data.orderStatus || '').toLowerCase()
      );
      if (currentIndex === -1) {
        currentIndex = data.paymentStatus === 'Pagamento aprovado' ? 2 : 1;
      } else if (currentIndex === 0 && data.paymentStatus === 'Aguardando pagamento') {
        currentIndex = 1;
      }

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
    } catch {
      resultBox.style.display = 'none';
      showTrackingToast('Erro ao consultar o servidor.');
    }
  });
});