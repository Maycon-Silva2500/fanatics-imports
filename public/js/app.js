/**
 * FANATICS IMPORTS — VITRINE, FILTROS E PERSONALIZAÇÃO DE PRODUTOS
 * Desenvolvido por Maycon Silva
 */

// Gera ilustração SVG esportiva limpa enquanto fotos reais não são cadastradas no Painel Admin (Etapa 3)
function generateJerseyPreview(title, primaryColor, accentColor, label) {
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
      <text x="250" y="445" fill="#777777" font-family="Arial, sans-serif" font-weight="700" font-size="14" text-anchor="middle">FANATICS IMPORTS • PRÉVIA</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Catálogo inicial demonstrativo cobrindo as 8 categorias (na Etapa 3 será alimentado via API/SQLite)
const INITIAL_SHOWCASE_PRODUCTS = [
  {
    id: 1,
    name: 'Camisa Seleção Brasil Home 2026',
    category: 'Camisas de futebol',
    description: 'Tecido respirável de alta performance com escudo bordado e acabamento oficial.',
    price: 189.90,
    promoPrice: 149.90,
    sizes: ['P', 'M', 'G', 'GG', 'XG'],
    available: true,
    customizable: true,
    stock: 15,
    image: generateJerseyPreview('Brasil', '#FACC15', '#00E676', 'BRASIL 26')
  },
  {
    id: 2,
    name: 'Camisa Retrô Brasil 2002 Pentacampeão',
    category: 'Camisas retrô',
    description: 'Edição histórica comemorativa do Penta com detalhes clássicos e tecido macio.',
    price: 219.90,
    promoPrice: 169.90,
    sizes: ['P', 'M', 'G', 'GG'],
    available: true,
    customizable: true,
    stock: 8,
    image: generateJerseyPreview('Retrô 2002', '#EAB308', '#16A34A', 'RETRÔ 2002')
  },
  {
    id: 3,
    name: 'Regata NBA Los Angeles Lakers Icon Edition',
    category: 'NBA',
    description: 'Regata Swingman com números aplicados e malha perfurada para máximo conforto.',
    price: 229.90,
    promoPrice: 179.90,
    sizes: ['P', 'M', 'G', 'GG'],
    available: true,
    customizable: true,
    stock: 10,
    image: generateJerseyPreview('Lakers', '#581C87', '#FACC15', 'NBA LAKERS')
  },
  {
    id: 4,
    name: 'Jersey NFL Kansas City Chiefs Home',
    category: 'Futebol americano',
    description: 'Jersey oficial de futebol americano com numeração frontal e nas costas.',
    price: 259.90,
    promoPrice: null,
    sizes: ['M', 'G', 'GG', 'XG'],
    available: true,
    customizable: true,
    stock: 6,
    image: generateJerseyPreview('NFL Chiefs', '#DC2626', '#FFFFFF', 'NFL CHIEFS')
  },
  {
    id: 5,
    name: 'Regata Treino Performance Black/Green',
    category: 'Regatas',
    description: 'Regata esportiva dry-fit leve ideal para academia, corrida e treino funcional.',
    price: 119.90,
    promoPrice: 89.90,
    sizes: ['P', 'M', 'G', 'GG'],
    available: true,
    customizable: false,
    stock: 20,
    image: generateJerseyPreview('Regata Dry', '#141414', '#00E676', 'DRY-FIT')
  },
  {
    id: 6,
    name: 'Kit Camisa e Bermuda Treino Europeu',
    category: 'Kits camisa e bermuda',
    description: 'Conjunto completo com camisa dry-fit e bermuda com bolsos e ajuste na cintura.',
    price: 239.90,
    promoPrice: 189.90,
    sizes: ['P', 'M', 'G', 'GG'],
    available: true,
    customizable: true,
    stock: 9,
    image: generateJerseyPreview('Kit Treino', '#0F172A', '#00E676', 'KIT COMPLETO')
  },
  {
    id: 7,
    name: 'Kit Infantil Seleção + Short (2 a 12 anos)',
    category: 'Camisas infantis',
    description: 'Conjunto infantil completo leve e confortável para os pequenos torcedores.',
    price: 159.90,
    promoPrice: 129.90,
    sizes: ['16 (2-3a)', '20 (4-5a)', '24 (7-8a)', '28 (10-12a)'],
    available: true,
    customizable: true,
    stock: 12,
    image: generateJerseyPreview('Infantil', '#2563EB', '#FFFFFF', 'KIDS EDITION')
  },
  {
    id: 8,
    name: 'Camisa Real Madrid Manga Longa 2026',
    category: 'Manga longa',
    description: 'Versão manga longa com punhos canelados e tecnologia de controle térmico.',
    price: 219.90,
    promoPrice: 174.90,
    sizes: ['P', 'M', 'G', 'GG'],
    available: true,
    customizable: true,
    stock: 7,
    image: generateJerseyPreview('Manga Longa', '#F8FAFC', '#00E676', 'MANGA LONGA')
  }
];

let allProducts = [...INITIAL_SHOWCASE_PRODUCTS];
let activeCategory = 'Todas';
let searchTerm = '';
let selectedModalProduct = null;
let selectedModalSize = null;

async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        allProducts = data;
      }
    }
  } catch {
    // Mantém vitrine demonstrativa até a Etapa 3 conectar a API/SQLite
  }
  renderProducts();
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
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
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

function openProductModal(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  selectedModalProduct = product;
  selectedModalSize = product.sizes[0] || null;

  const hasPromo = product.promoPrice && Number(product.promoPrice) < Number(product.price);
  const finalPrice = hasPromo ? product.promoPrice : product.price;

  const modalBody = document.getElementById('modalProductBody');
  modalBody.innerHTML = `
    <div class="modal-img-box">
      <img src="${product.image}" alt="${product.name}" />
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
  loadProducts();

  // Filtro por categoria
  const categoryButtons = document.querySelectorAll('.category-pill');
  categoryButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      categoryButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      renderProducts();
    });
  });

  // Pesquisa em tempo real
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderProducts();
    });
  }

  // Fechar modal
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