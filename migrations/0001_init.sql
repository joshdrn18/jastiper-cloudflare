PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS product_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  depositor_name TEXT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  product_type_id INTEGER REFERENCES product_types(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  price INTEGER CHECK (price IS NULL OR price > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available','unavailable')),
  publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','published','archived')),
  source_name TEXT,
  source_product_url TEXT,
  source_product_id TEXT,
  source_price INTEGER,
  source_currency TEXT DEFAULT 'MYR',
  source_promotion_price INTEGER,
  source_last_checked_at TEXT,
  import_status TEXT NOT NULL DEFAULT 'manual' CHECK (import_status IN ('manual','imported','price_changed','needs_review')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (publication_status <> 'published' OR price IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(publication_status, availability_status);

-- Mencegah stok menjadi negatif walaupun ada checkout bersamaan.
CREATE TRIGGER IF NOT EXISTS prevent_negative_stock
BEFORE UPDATE OF stock ON products
WHEN NEW.stock < 0
BEGIN
  SELECT RAISE(ABORT, 'STOK_TIDAK_CUKUP');
END;


CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  tracking_code TEXT NOT NULL UNIQUE,
  idempotency_key TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_phone_norm TEXT NOT NULL,
  customer_email TEXT,
  shipping_address TEXT NOT NULL,
  city TEXT NOT NULL,
  notes TEXT,
  admin_notes TEXT,
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  shipping_fee INTEGER NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'Transfer manual',
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','verified')),
  order_status TEXT NOT NULL DEFAULT 'Menunggu Konfirmasi' CHECK (order_status IN
    ('Menunggu Konfirmasi','Dikonfirmasi','Menunggu Pembayaran','Pembayaran Diverifikasi','Diproses','Dikirim','Selesai','Dibatalkan')),
  stock_restored INTEGER NOT NULL DEFAULT 0 CHECK (stock_restored IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone_norm);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  unit_price_snapshot INTEGER NOT NULL CHECK (unit_price_snapshot > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id_hash TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON admin_sessions(expires_at);

INSERT OR IGNORE INTO site_settings(key,value) VALUES
 ('store_name','JASTIPER'),
 ('tagline','Titip Mudah, Belanja Praktis.'),
 ('shipping_fee','0'),
 ('payment_instructions','Transfer manual. Hubungi admin untuk detail pembayaran.'),
 ('whatsapp','');

INSERT OR IGNORE INTO categories(name,slug) VALUES
 ('Fashion dan pakaian','fashion-dan-pakaian'),
 ('Sepatu dan tas','sepatu-dan-tas'),
 ('Elektronik dan gadget','elektronik-dan-gadget'),
 ('Kosmetik dan skincare','kosmetik-dan-skincare'),
 ('Makanan dan minuman','makanan-dan-minuman'),
 ('Aksesori','aksesori'),
 ('Oleh-oleh','oleh-oleh'),
 ('Barang lainnya','barang-lainnya');
