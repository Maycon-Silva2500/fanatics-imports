-- ============================================================================
-- FANATICS IMPORTS — ESQUEMA DE BANCO DE DADOS POSTGRESQL / SUPABASE
-- Pronto para migração futura em produção
-- Desenvolvido por Maycon Silva
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  slug VARCHAR(140) NOT NULL UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(120) NOT NULL,
  image TEXT NOT NULL,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  price NUMERIC(10, 2) NOT NULL,
  promo_price NUMERIC(10, 2),
  sizes JSONB NOT NULL DEFAULT '["P","M","G","GG"]'::jsonb,
  available BOOLEAN DEFAULT TRUE,
  customizable BOOLEAN DEFAULT TRUE,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  phone_normalized VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(200),
  cpf VARCHAR(14),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  phone_normalized VARCHAR(20) NOT NULL,
  customer_email VARCHAR(200),
  customer_cpf VARCHAR(14),
  address_zip VARCHAR(12) NOT NULL,
  address_street VARCHAR(200) NOT NULL,
  address_number VARCHAR(30) NOT NULL,
  address_complement VARCHAR(150),
  address_neighborhood VARCHAR(120) NOT NULL,
  address_city VARCHAR(120) NOT NULL,
  address_state VARCHAR(2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_status VARCHAR(60) NOT NULL DEFAULT 'Aguardando pagamento',
  order_status VARCHAR(60) NOT NULL DEFAULT 'Pedido recebido',
  subtotal NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  mp_payment_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(200) NOT NULL,
  category VARCHAR(120),
  size VARCHAR(30) NOT NULL,
  customized BOOLEAN DEFAULT FALSE,
  custom_name VARCHAR(40),
  custom_number VARCHAR(10),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_code VARCHAR(20) NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'mercadopago',
  external_id VARCHAR(120),
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  status_detail VARCHAR(120),
  amount NUMERIC(10, 2) NOT NULL,
  pix_qr_code TEXT,
  pix_qr_code_base64 TEXT,
  ticket_url TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  order_code VARCHAR(20),
  destination_phone VARCHAR(30) NOT NULL,
  message_body TEXT NOT NULL,
  mode VARCHAR(30) NOT NULL DEFAULT 'local_log',
  status VARCHAR(30) NOT NULL DEFAULT 'logged',
  provider_message_id VARCHAR(120),
  error_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(120) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(code);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_external ON payments(external_id);