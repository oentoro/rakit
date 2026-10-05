PRAGMA busy_timeout=5000;
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','staff')), active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (username TEXT NOT NULL, attempted_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS attempts_username ON login_attempts(username,attempted_at);
CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL CHECK(kind IN ('photo','pdf')), name TEXT NOT NULL, mime_type TEXT NOT NULL, path TEXT NOT NULL, page_count INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS racks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, shelf_count INTEGER NOT NULL CHECK(shelf_count > 0));
CREATE TABLE IF NOT EXISTS rack_shelves (rack INTEGER NOT NULL REFERENCES racks(id), shelf TEXT NOT NULL, PRIMARY KEY(rack,shelf));
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, sku TEXT UNIQUE NOT NULL, name TEXT NOT NULL, rack INTEGER NOT NULL, shelf TEXT NOT NULL, photo_file_id TEXT REFERENCES files(id), active INTEGER NOT NULL DEFAULT 1, FOREIGN KEY(rack,shelf) REFERENCES rack_shelves(rack,shelf));
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, order_number TEXT UNIQUE NOT NULL, airway_bill TEXT UNIQUE, pdf_file_id TEXT REFERENCES files(id), receipt_pages TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','picking','packing','completed')), assignee_id TEXT REFERENCES users(id), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, completed_at INTEGER);
CREATE TABLE IF NOT EXISTS order_items (order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), sku TEXT NOT NULL, name TEXT NOT NULL, qty INTEGER NOT NULL CHECK(qty>0), picked_qty INTEGER NOT NULL DEFAULT 0 CHECK(picked_qty>=0 AND picked_qty<=qty), PRIMARY KEY(order_id,product_id));
CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, sku TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS scan_requests (request_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), actor_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, code TEXT NOT NULL, result TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS product_locations (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), rack INTEGER NOT NULL, shelf TEXT NOT NULL, quantity INTEGER CHECK(quantity IS NULL OR (quantity>=0 AND typeof(quantity)='integer')), UNIQUE(product_id,rack,shelf), FOREIGN KEY(rack,shelf) REFERENCES rack_shelves(rack,shelf));
CREATE TABLE IF NOT EXISTS order_location_picks (order_id TEXT NOT NULL, product_id TEXT NOT NULL, location_id TEXT NOT NULL REFERENCES product_locations(id), quantity INTEGER NOT NULL CHECK(quantity>0), PRIMARY KEY(order_id,product_id,location_id), FOREIGN KEY(order_id,product_id) REFERENCES order_items(order_id,product_id));
CREATE INDEX IF NOT EXISTS picks_location ON order_location_picks(location_id);

CREATE TABLE IF NOT EXISTS stocktakes (
 id TEXT PRIMARY KEY,
 location_id TEXT NOT NULL,
 sku TEXT NOT NULL,
 name TEXT NOT NULL,
 rack_name TEXT NOT NULL,
 shelf TEXT NOT NULL,
 before_quantity INTEGER,
 quantity INTEGER NOT NULL CHECK(quantity>=0 AND typeof(quantity)='integer'),
 note TEXT NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id),
 actor_name TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS stocktakes_created ON stocktakes(created_at DESC);
