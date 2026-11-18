/**
 * FANATICS IMPORTS — VITRINE DINÂMICA, FILTROS E PERSONALIZAÇÃO DE PRODUTOS
 * Desenvolvido por Maycon Silva
 */

let allProducts = [];
let activeCategory = 'Todas';
let searchTerm = '';
let selectedModalProduct = null;
let selectedModalSize = null;

async function loadCategories() {
  const bar = document.getElementById('categoriesBar');
  if (!bar) return;

  try {
    const response = await fetch('/api/categories');
    if (!response.ok) return;
    const categories = await response.json();

    bar.innerHTML = `
      <button class="category-pill active" data-category="Todas">Todas as Categorias</button>
      ${categories
        .map((cat) => `<button class="category-pill" data-category="${cat.name}">${cat.name}</button>`)
        .join('')}
    `;

    bindCategoryButtons();
  } catch (err) {
    console.error('Erro ao carregar categorias:', err);
  }
}

function bindCategoryButtons() {
  const categoryButtons = document.querySelectorAll('.category-pill');
  categoryButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      categoryButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      renderProducts();
    });
  });
}

async function loadProducts() {
  const countEl = document.getElementById('productsCount');
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Falha ao buscar produtos');
    allProducts = await response.json();
    renderProducts();
  } catch (err) {
    console.error('Erro ao carregar catálogo:', err);
    if (countEl) countEl.textContent = 'Erro ao carregar produtos do servidor.';
  }
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const countEl = document.getElementById('productsCount');
  const headingEl = document.getElementById('catalogHeading');
  if (!grid) return;

  const filtered = allProducts.filter((p) => {
    const matchesCategory = activeCategory === 'Todas' || p.category === activeCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (headingEl) {
    headingEl.innerHTML =
      activeCategory === 'Todas'
        ? `CATÁLOGO <span>COMPLETO</span>`
        : `CATEGORIA: <span>${activeCategory.toUpperCase()}</span>`;
  }

  if (countEl) {
    countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
        <h3 style="margin-bottom: 8px;">Nenhum produto encontrado</h3>
        <p style="color: var(--text-secondary);">Tente buscar por outro termo ou selecione "Todas as Categorias".</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((product) => {
      const hasPromo = product.promoPrice && Number(product.promoPrice) < Number(product.price);
      const finalPrice = hasPromo ? product.promoPrice : product.price;
      const isAvailable = product.available && product.stock > 0;

      return `
        <article class="product-card">
          <div class="product-image-wrap">
            <img src="${product.image}" alt="${product.name}" loading="lazy" />
            <div class="product-badges">
              ${hasPromo ? `<span class="badge-promo">Oferta</span>` : ''}
              ${product.customizable ? `<span class="badge-custom">Personalizável</span>` : ''}
              ${!isAvailable ? `<span class="badge-soldout">Esgotado</span>` : ''}
            </div>
          </div>

          <div class="product-info">
            <span class="product-category">${product.category}</span>
            <h3 class="product-title">${product.name}</h3>

            <div class="product-sizes-preview">
              ${product.sizes.map((s) => `<span class="size-chip">${s}</span>`).join('')}
            </div>

            <div class="product-price-box">
              ${hasPromo ? `<span class="price-old">${formatCurrency(product.price)}</span>` : ''}
              <span class="price-current">${formatCurrency(finalPrice)}</span>
              <span class="price-pix-note">à vista no PIX ou no Cartão</span>
            </div>

            <button
              type="button"
              class="btn-buy-card"
              ${!isAvailable ? 'disabled' : ''}
              onclick="openProductModal(${product.id})"
            >
              ${isAvailable ? 'Escolher Tamanho e Comprar' : 'Indisponível no Momento'}
            </button>
          </div>
        </article>
      `;
    })
    .join('');
}

function switchModalMainImage(imgUrl, thumbBtn) {
  const mainImg = document.getElementById('modalMainImage');
  if (mainImg) mainImg.src = imgUrl;
  document.querySelectorAll('.modal-thumb-btn').forEach((b) => (b.style.borderColor = 'var(--border-color)'));
  if (thumbBtn) thumbBtn.style.borderColor = 'var(--green-primary)';
}

function openProductModal(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  selectedModalProduct = product;
  selectedModalSize = product.sizes[0] || null;

  const hasPromo = product.promoPrice && Number(product.promoPrice) < Number(product.price);
  const finalPrice = hasPromo ? product.promoPrice : product.price;
  const photos = Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.image];

  const thumbsHtml =
    photos.length > 1
      ? `<div style="display: flex; gap: 8px; margin-top: 10px; overflow-x: auto;">
          ${photos
            .map(
              (url, idx) => `
              <button type="button" class="modal-thumb-btn"
                style="width: 58px; height: 58px; border-radius: 6px; overflow: hidden; border: 2px solid ${
                  idx === 0 ? 'var(--green-primary)' : 'var(--border-color)'
                }; background: #101010; flex-shrink: 0;"
                onclick="switchModalMainImage('${url}', this)">
                <img src="${url}" alt="Foto ${idx + 1}" style="width: 100%; height: 100%; object-fit: cover;" />
              </button>
            `
            )
            .join('')}
        </div>`
      : '';

  const modalBody = document.getElementById('modalProductBody');
  modalBody.innerHTML = `
    <div>
      <div class="modal-img-box">
        <img id="modalMainImage" src="${photos[0]}" alt="${product.name}" />
      </div>
      ${thumbsHtml}
    </div>

    <div>
      <span class="product-category">${product.category}</span>
      <h2 style="font-size: 1.7rem; margin: 4px 0 10px; line-height: 1.15;">${product.name}</h2>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 16px;">${product.description}</p>

      <div style="margin-bottom: 16px;">
        ${hasPromo ? `<span class="price-old">${formatCurrency(product.price)}</span>` : ''}
        <span class="price-current" style="font-size: 1.75rem;">${formatCurrency(finalPrice)}</span>
        <span style="display: block; font-size: 0.78rem; color: var(--green-primary);">Estoque disponível: ${product.stock} unidades</span>
      </div>

      <div>
        <strong style="font-size: 0.85rem; color: var(--text-secondary);">1. SELECIONE O TAMANHO:</strong>
        <div class="size-selector" id="modalSizeSelector">
          ${product.sizes
            .map(
              (size, idx) => `
              <button type="button" class="size-btn ${idx === 0 ? 'selected' : ''}" onclick="selectModalSize('${size}', this)">
                ${size}
              </button>
            `
            )
            .join('')}
        </div>
      </div>

      ${
        product.customizable
          ? `
          <div class="custom-box">
            <label class="custom-toggle">
              <input type="checkbox" id="enableCustomCheckbox" onchange="toggleCustomFields(this.checked)" />
              Personalizar camisa com Nome e Número
            </label>
            <div class="custom-fields" id="customFieldsContainer">
              <div>
                <label style="font-size: 0.75rem; color: var(--text-secondary);">Nome na Camisa</label>
                <input type="text" id="customNameInput" class="form-control" maxlength="16" placeholder="Ex: SILVA" style="text-transform: uppercase;" />
              </div>
              <div>
                <label style="font-size: 0.75rem; color: var(--text-secondary);">Número</label>
                <input type="text" id="customNumberInput" class="form-control" maxlength="2" placeholder="Ex: 10" />
              </div>
            </div>
          </div>
        `
          : ''
      }

      <button type="button" class="btn-primary" style="width: 100%;" onclick="confirmAddToCart()">
        Adicionar ao Carrinho
      </button>
    </div>
  `;

  document.getElementById('productModal').classList.add('open');
}

function selectModalSize(size, btnEl) {
  selectedModalSize = size;
  document.querySelectorAll('#modalSizeSelector .size-btn').forEach((b) => b.classList.remove('selected'));
  btnEl.classList.add('selected');
}

function toggleCustomFields(checked) {
  const container = document.getElementById('customFieldsContainer');
  if (container) {
    container.classList.toggle('visible', checked);
  }
}

function confirmAddToCart() {
  if (!selectedModalProduct) return;
  if (!selectedModalSize) {
    showToast('Selecione um tamanho antes de continuar.');
    return;
  }

  let customName = '';
  let customNumber = '';
  const customCheckbox = document.getElementById('enableCustomCheckbox');

  if (customCheckbox && customCheckbox.checked) {
    customName = (document.getElementById('customNameInput')?.value || '').trim().toUpperCase();
    customNumber = (document.getElementById('customNumberInput')?.value || '').trim();

    if (!customName && !customNumber) {
      showToast('Informe o nome ou o número para a personalização.');
      return;
    }
  }

  const hasPromo =
    selectedModalProduct.promoPrice && Number(selectedModalProduct.promoPrice) < Number(selectedModalProduct.price);
  const finalPrice = hasPromo ? selectedModalProduct.promoPrice : selectedModalProduct.price;

  addToCart({
    id: selectedModalProduct.id,
    name: selectedModalProduct.name,
    category: selectedModalProduct.category,
    price: finalPrice,
    image: selectedModalProduct.image,
    size: selectedModalSize,
    customName,
    customNumber
  });

  document.getElementById('productModal').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  bindCategoryButtons();
  loadCategories();
  loadProducts();

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderProducts();
    });
  }

  const closeModalBtn = document.getElementById('closeProductModal');
  const modalOverlay = document.getElementById('productModal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => modalOverlay.classList.remove('open'));
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('open');
    });
  }
});