/**
 * FANATICS IMPORTS — GERENCIAMENTO DE CARRINHO E CHECKOUT INTEGRADO AO SQLITE
 * Desenvolvido por Maycon Silva
 */

const CART_STORAGE_KEY = 'fanatics_imports_cart_v1';

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function showToast(message) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  updateCartUI();
}

function addToCart(item) {
  const cart = getCart();
  const itemKey = `${item.id}_${item.size}_${item.customName || ''}_${item.customNumber || ''}`;
  const existingIndex = cart.findIndex((c) => c.key === itemKey);

  if (existingIndex > -1) {
    cart[existingIndex].quantity += 1;
  } else {
    cart.push({
      key: itemKey,
      id: item.id,
      name: item.name,
      category: item.category,
      price: Number(item.price),
      image: item.image,
      size: item.size,
      customized: Boolean(item.customName || item.customNumber),
      customName: item.customName || '',
      customNumber: item.customNumber || '',
      quantity: 1
    });
  }

  saveCart(cart);
  openCartDrawer();
  showToast('Produto adicionado ao carrinho!');
}

function updateItemQuantity(key, delta) {
  const cart = getCart();
  const index = cart.findIndex((c) => c.key === key);
  if (index === -1) return;

  cart[index].quantity += delta;
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }
  saveCart(cart);
}

function removeFromCart(key) {
  const cart = getCart().filter((c) => c.key !== key);
  saveCart(cart);
  showToast('Item removido do carrinho.');
}

function getCartTotal(cart = getCart()) {
  return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
}

function openCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');
  if (drawer && backdrop) {
    drawer.classList.add('open');
    backdrop.classList.add('open');
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');
  if (drawer && backdrop) {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
  }
}

function updateCartUI() {
  const cart = getCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = getCartTotal(cart);

  const badge = document.getElementById('cartCountBadge');
  if (badge) badge.textContent = totalItems;

  const container = document.getElementById('cartItemsContainer');
  const totalEl = document.getElementById('cartTotalValue');
  if (container && totalEl) {
    totalEl.textContent = formatCurrency(totalPrice);

    if (cart.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: var(--text-secondary);">
          <p style="margin-bottom: 12px;">Seu carrinho está vazio.</p>
          <button type="button" class="btn-outline" onclick="closeCartDrawer()">Explorar Produtos</button>
        </div>
      `;
    } else {
      container.innerHTML = cart
        .map(
          (item) => `
          <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" />
            <div class="cart-item-details">
              <div class="cart-item-title">${item.name}</div>
              <div class="cart-item-meta">Tamanho: <strong>${item.size}</strong></div>
              ${
                item.customized
                  ? `<div class="cart-item-meta" style="color: var(--green-primary);">Personalização: ${item.customName || '-'} #${item.customNumber || '-'}</div>`
                  : ''
              }
              <div style="font-weight: 700; color: var(--green-primary); font-size: 0.92rem;">
                ${formatCurrency(item.price * item.quantity)}
              </div>
              <div class="cart-item-controls">
                <div class="qty-box">
                  <button type="button" onclick="updateItemQuantity('${item.key}', -1)">-</button>
                  <span>${item.quantity}</span>
                  <button type="button" onclick="updateItemQuantity('${item.key}', 1)">+</button>
                </div>
                <button type="button" class="btn-remove-item" onclick="removeFromCart('${item.key}')">Remover</button>
              </div>
            </div>
          </div>
        `
        )
        .join('');
    }
  }

  const summaryContainer = document.getElementById('checkoutSummaryItems');
  if (summaryContainer) {
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const checkoutTotalEl = document.getElementById('checkoutTotal');

    if (subtotalEl) subtotalEl.textContent = formatCurrency(totalPrice);
    if (checkoutTotalEl) checkoutTotalEl.textContent = formatCurrency(totalPrice);

    if (cart.length === 0) {
      summaryContainer.innerHTML = `<p style="color: var(--text-secondary); font-size: 0.9rem;">Nenhum produto no carrinho. <a href="/" style="color: var(--green-primary); text-decoration: underline;">Voltar à loja</a></p>`;
    } else {
      summaryContainer.innerHTML = cart
        .map(
          (item) => `
          <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 10px; font-size: 0.88rem;">
            <div style="display: flex; justify-content: space-between; font-weight: 700;">
              <span>${item.quantity}x ${item.name}</span>
              <span style="color: var(--green-primary);">${formatCurrency(item.price * item.quantity)}</span>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.8rem;">
              Tamanho: ${item.size} ${item.customized ? `| Personalização: ${item.customName} #${item.customNumber}` : ''}
            </div>
          </div>
        `
        )
        .join('');
    }
  }
}

function setupCheckoutMasks() {
  const phoneInput = document.getElementById('customerPhone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 6) {
        v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      } else if (v.length > 2) {
        v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      }
      e.target.value = v;
    });
  }

  const cpfInput = document.getElementById('customerCpf');
  if (cpfInput) {
    cpfInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 9) {
        v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
      } else if (v.length > 6) {
        v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
      } else if (v.length > 3) {
        v = `${v.slice(0, 3)}.${v.slice(3)}`;
      }
      e.target.value = v;
    });
  }

  const zipInput = document.getElementById('addrZip');
  if (zipInput) {
    zipInput.addEventListener('input', async (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 8);
      if (v.length > 5) {
        e.target.value = `${v.slice(0, 5)}-${v.slice(5)}`;
      } else {
        e.target.value = v;
      }

      if (v.length === 8) {
        try {
          const resp = await fetch(`https://viacep.com.br/ws/${v}/json/`);
          if (resp.ok) {
            const addr = await resp.json();
            if (!addr.erro) {
              if (addr.logradouro) document.getElementById('addrStreet').value = addr.logradouro;
              if (addr.bairro) document.getElementById('addrNeighborhood').value = addr.bairro;
              if (addr.localidade) document.getElementById('addrCity').value = addr.localidade;
              if (addr.uf) document.getElementById('addrState').value = addr.uf;
              document.getElementById('addrNumber').focus();
            }
          }
        } catch {}
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();
  setupCheckoutMasks();

  const openBtn = document.getElementById('openCartBtn');
  const closeBtn = document.getElementById('closeCartBtn');
  const backdrop = document.getElementById('cartBackdrop');
  const checkoutBtn = document.getElementById('goToCheckoutBtn');

  if (openBtn) openBtn.addEventListener('click', openCartDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeCartDrawer);
  if (backdrop) backdrop.addEventListener('click', closeCartDrawer);

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (getCart().length === 0) {
        showToast('Adicione pelo menos um produto ao carrinho antes de finalizar.');
        return;
      }
      window.location.href = '/checkout.html';
    });
  }

  const paymentLabels = document.querySelectorAll('.payment-option');
  paymentLabels.forEach((label) => {
    label.addEventListener('click', () => {
      paymentLabels.forEach((l) => l.classList.remove('selected'));
      label.classList.add('selected');
      const radio = label.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cart = getCart();
      if (cart.length === 0) {
        showToast('Seu carrinho está vazio!');
        return;
      }

      const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'PIX';
      const orderPayload = {
        customer: {
          name: document.getElementById('customerName').value.trim(),
          phone: document.getElementById('customerPhone').value.trim(),
          email: document.getElementById('customerEmail').value.trim(),
          cpf: document.getElementById('customerCpf').value.trim()
        },
        address: {
          zip: document.getElementById('addrZip').value.trim(),
          street: document.getElementById('addrStreet').value.trim(),
          number: document.getElementById('addrNumber').value.trim(),
          complement: document.getElementById('addrComplement').value.trim(),
          neighborhood: document.getElementById('addrNeighborhood').value.trim(),
          city: document.getElementById('addrCity').value.trim(),
          state: document.getElementById('addrState').value.trim().toUpperCase()
        },
        paymentMethod,
        items: cart
      };

      const confirmBtn = document.getElementById('confirmOrderBtn');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Registrando pedido...';

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload)
        });

        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || 'Não foi possível concluir o pedido.');
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirmar Pedido';
          return;
        }

        localStorage.removeItem(CART_STORAGE_KEY);
        updateCartUI();

        const itemsListHtml = data.items
          .map(
            (i) =>
              `<div style="margin-top:4px; font-size:0.86rem;">• ${i.quantity}x <strong>${i.name}</strong> (Tam: ${i.size}) ${
                i.customized ? `— Personalização: ${i.customName} #${i.customNumber}` : ''
              }</div>`
          )
          .join('');

        checkoutForm.style.display = 'none';
        const successBox = document.getElementById('orderSuccessBox');
        document.getElementById('generatedOrderCode').textContent = data.code;
        document.getElementById('orderSuccessSummary').innerHTML = `
          <p><strong>Cliente:</strong> ${data.customer.name}</p>
          <p><strong>Telefone:</strong> ${data.customer.phone}</p>
          <p><strong>Entrega:</strong> ${data.address.street}, ${data.address.number} - ${data.address.neighborhood}, ${data.address.city}/${data.address.state}</p>
          <p><strong>Forma de Pagamento:</strong> ${data.paymentMethod}</p>
          <p><strong>Status do Pagamento:</strong> <span style="color: var(--warning); font-weight: 700;">${data.paymentStatus}</span></p>
          <p><strong>Status do Pedido:</strong> <span style="color: var(--green-primary); font-weight: 700;">${data.orderStatus}</span></p>
          <div style="margin: 10px 0; padding-top: 10px; border-top: 1px solid var(--border-color);">
            <strong>Itens:</strong>
            ${itemsListHtml}
          </div>
          <p style="font-size: 1.1rem; margin-top: 8px;"><strong>Valor Total:</strong> <span style="color: var(--green-primary);">${formatCurrency(data.total)}</span></p>
        `;

        const trackLink = document.getElementById('trackDirectLink');
        if (trackLink) {
          trackLink.href = `/rastreio.html?code=${encodeURIComponent(data.code)}`;
        }

        successBox.style.display = 'block';
      } catch {
        showToast('Erro de conexão com o servidor. Verifique se o Node.js está rodando.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Pedido';
      }
    });
  }
});