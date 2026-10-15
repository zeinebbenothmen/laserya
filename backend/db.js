/**
 * db.js — SQLite via sql.js (pure JS, no native compilation needed)
 * Exposes a better-sqlite3-compatible synchronous API.
 * Call initDb() once at startup, then getDb() synchronously everywhere.
 */
const path      = require('path');
// Charge backend/.env pour TOUT consommateur de la base (serveur ET scripts
// autonomes comme import-shopify / localize-images), sinon les identifiants
// admin (.env) ne seraient pas vus et l'admin serait réinitialisé au défaut.
require('dotenv').config({ path: path.join(__dirname, '.env') });
const initSqlJs = require('sql.js');
const bcrypt    = require('bcryptjs');
const fs        = require('fs');

const DB_PATH = path.join(__dirname, 'laserya.db');
let rawDb  = null;
let dbWrap = null;

// ── Persistence ────────────────────────────────────────────
function save() {
  if (!rawDb) return;
  fs.writeFileSync(DB_PATH, Buffer.from(rawDb.export()));
}

// ── SQL helpers ────────────────────────────────────────────
function escape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number')  return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function interpolate(sql, params = []) {
  let i = 0;
  return sql.replace(/\?/g, () => escape(params[i++]));
}

function execSQL(sql) {
  const results = rawDb.exec(sql);
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => { obj[col] = row[idx]; });
    return obj;
  });
}

// ── better-sqlite3 compatible wrapper ─────────────────────
function buildWrap() {
  return {
    prepare: (sql) => ({
      run: (...args) => {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        execSQL(interpolate(sql, params));
        save();
        return { changes: 1 };
      },
      get: (...args) => {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        return execSQL(interpolate(sql, params))[0];
      },
      all: (...args) => {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        return execSQL(interpolate(sql, params));
      }
    }),
    exec: (sql) => { execSQL(sql); save(); }
  };
}

// ── Schema ─────────────────────────────────────────────────
function initSchema() {
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
      price REAL NOT NULL, compare_at_price REAL DEFAULT 0,
      category TEXT DEFAULT 'other', material TEXT DEFAULT '',
      image_url TEXT DEFAULT '', stock INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
      requires_name INTEGER DEFAULT 0, requires_date INTEGER DEFAULT 0,
      name_label TEXT DEFAULT '', date_label TEXT DEFAULT '',
      personalization_zones TEXT DEFAULT '[]',
      images TEXT DEFAULT '[]',
      models TEXT DEFAULT '[]',
      featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
      customer_email TEXT DEFAULT '', customer_address TEXT DEFAULT '',
      delivery_method TEXT DEFAULT 'home', payment_method TEXT DEFAULT 'cash',
      items TEXT NOT NULL, subtotal REAL DEFAULT 0, delivery_cost REAL DEFAULT 0,
      total REAL NOT NULL, status TEXT DEFAULT 'pending', notes TEXT DEFAULT '',
      customer_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS custom_requests (
      id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
      customer_email TEXT DEFAULT '', product_type TEXT NOT NULL,
      size TEXT DEFAULT '', material TEXT DEFAULT '',
      personalization_text TEXT DEFAULT '', image_url TEXT DEFAULT '',
      notes TEXT DEFAULT '', status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS print3d_quotes (
      id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
      customer_email TEXT DEFAULT '', file_url TEXT DEFAULT '', file_name TEXT DEFAULT '',
      material TEXT DEFAULT 'PLA', quality TEXT DEFAULT 'standard',
      quantity INTEGER DEFAULT 1, color TEXT DEFAULT '', dimensions TEXT DEFAULT '',
      notes TEXT DEFAULT '', estimated_price REAL DEFAULT 0, status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '', password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS spools (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT DEFAULT '',
      material TEXT DEFAULT 'PLA', color TEXT DEFAULT '', color_hex TEXT DEFAULT '#cccccc',
      weight_total REAL DEFAULT 1000, weight_remaining REAL DEFAULT 1000,
      price REAL DEFAULT 0, threshold REAL DEFAULT 150, location TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS printers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      host TEXT NOT NULL, serial TEXT NOT NULL, access_code TEXT NOT NULL,
      model TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
  save();
}

// ── Migration: add personalization columns to existing DBs ──
function migrate() {
  const info = rawDb.exec('PRAGMA table_info(products)');
  const cols = info.length ? info[0].values.map(r => r[1]) : [];
  const toAdd = [];
  if (!cols.includes('requires_name')) toAdd.push("ALTER TABLE products ADD COLUMN requires_name INTEGER DEFAULT 0");
  if (!cols.includes('requires_date')) toAdd.push("ALTER TABLE products ADD COLUMN requires_date INTEGER DEFAULT 0");
  if (!cols.includes('name_label'))    toAdd.push("ALTER TABLE products ADD COLUMN name_label TEXT DEFAULT ''");
  if (!cols.includes('date_label'))    toAdd.push("ALTER TABLE products ADD COLUMN date_label TEXT DEFAULT ''");
  if (!cols.includes('personalization_zones')) toAdd.push("ALTER TABLE products ADD COLUMN personalization_zones TEXT DEFAULT '[]'");
  if (!cols.includes('images')) toAdd.push("ALTER TABLE products ADD COLUMN images TEXT DEFAULT '[]'");
  if (!cols.includes('models')) toAdd.push("ALTER TABLE products ADD COLUMN models TEXT DEFAULT '[]'");
  if (!cols.includes('compare_at_price')) toAdd.push("ALTER TABLE products ADD COLUMN compare_at_price REAL DEFAULT 0");
  if (!cols.includes('featured')) toAdd.push("ALTER TABLE products ADD COLUMN featured INTEGER DEFAULT 0");
  if (!cols.includes('collections')) toAdd.push("ALTER TABLE products ADD COLUMN collections TEXT DEFAULT '[]'");

  // Lien commande → compte client (nullable : les commandes invité restent à vide).
  const oinfo = rawDb.exec('PRAGMA table_info(orders)');
  const ocols = oinfo.length ? oinfo[0].values.map(r => r[1]) : [];
  if (ocols.length && !ocols.includes('customer_id'))
    toAdd.push("ALTER TABLE orders ADD COLUMN customer_id TEXT DEFAULT ''");

  if (!toAdd.length) return;

  for (const sql of toAdd) rawDb.exec(sql);
  // Sensible demo defaults for products that already exist (admin can change)
  rawDb.exec("UPDATE products SET requires_name = 1 WHERE category IN ('led-lamps','keychains','accessories','gifts')");
  rawDb.exec("UPDATE products SET requires_date = 1 WHERE category IN ('gifts')");
  save();
  console.log(`✅ Migration produits : ${toAdd.length} colonne(s) de personnalisation ajoutée(s)`);
}

// ── Backfill: build default zones from requires_name/date flags ──
// Runs for any product that has flags but no zones yet (fresh seed or old data).
function backfillZones() {
  const rid = () => 'z' + Math.random().toString(36).slice(2, 7);
  const rows = dbWrap.prepare(
    'SELECT id, requires_name, requires_date, name_label, date_label, personalization_zones FROM products'
  ).all();
  for (const r of rows) {
    const cur = r.personalization_zones;
    const empty = !cur || cur === '[]' || cur === 'null';
    if (!empty) continue;
    if (!r.requires_name && !r.requires_date) continue;
    const zones = [];
    if (r.requires_name) zones.push({ id: rid(), label: r.name_label || 'Prénom', type: 'text', x: 50, y: 78, size: 7,   color: '#ffffff' });
    if (r.requires_date) zones.push({ id: rid(), label: r.date_label || 'Date',    type: 'date', x: 50, y: 88, size: 4.5, color: '#a8e8ff' });
    dbWrap.prepare('UPDATE products SET personalization_zones = ? WHERE id = ?').run(JSON.stringify(zones), r.id);
  }
}

function seedAdmin() {
  // Identifiants pilotés par le .env (source de vérité). Pour changer le mot de
  // passe : modifier ADMIN_PASSWORD dans backend/.env puis redémarrer le serveur.
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'laserya2024';
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('⚠️  ADMIN_PASSWORD absent du .env — mot de passe par défaut utilisé. À définir avant la mise en ligne !');
  }
  const existing = dbWrap.prepare('SELECT id FROM admin LIMIT 1').get();
  if (!existing) {
    dbWrap.prepare('INSERT INTO admin (username, password) VALUES (?, ?)').run(username, bcrypt.hashSync(password, 10));
    console.log(`✅ Admin créé → ${username}`);
  } else if (process.env.ADMIN_PASSWORD) {
    // .env fourni → on synchronise identifiant + mot de passe.
    dbWrap.prepare('UPDATE admin SET username = ?, password = ? WHERE id = ?')
      .run(username, bcrypt.hashSync(password, 10), existing.id);
    console.log(`✅ Admin synchronisé depuis .env → ${username}`);
  } else {
    // Pas de mot de passe en .env → on NE TOUCHE PAS l'admin existant (évite de
    // le réinitialiser au défaut quand un script tourne sans charger l'env).
    console.warn('⚠️  ADMIN_PASSWORD absent — admin existant conservé tel quel.');
  }
}

function seedProducts() {
  const { v4: uuidv4 } = require('uuid');
  const count = dbWrap.prepare('SELECT COUNT(*) as c FROM products').get().c;
  if (count > 0) return;

  // [name, desc, price, cat, material, img, stock, requires_name, requires_date]
  const items = [
    ['Lampe LED Anime Personnalisée', 'Lampe en acrylique gravée laser avec votre personnage anime préféré.', 89, 'led-lamps', 'Acrylique', 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400', 15, 1, 0],
    ['Porte-clés Personnalisé Gravé', 'Porte-clés en acrylique ou bois gravé laser avec votre texte ou photo.', 18, 'keychains', 'Acrylique', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', 50, 1, 0],
    ['Figurine 3D Personnalisée', 'Figurine imprimée en 3D à partir de votre modèle. Résine haute qualité.', 180, '3d-figures', 'Résine', 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400', 8, 0, 0],
    ['Plaque Prénom Personnalisée', 'Plaque en bois ou acrylique gravée avec le prénom de votre choix.', 35, 'accessories', 'Bois', 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400', 30, 1, 0],
    ['Coffret Cadeau Couple', 'Set romantique avec lampe LED + porte-clés gravés. Emballage cadeau inclus.', 120, 'gifts', 'Acrylique + Bois', 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400', 12, 1, 1],
    ['Accessoire Bureau Personnalisé', 'Organisateur de bureau gravé à votre nom et logo.', 65, 'accessories', 'Bois', 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400', 20, 1, 0],
    ['Miroir LED Personnalisé', 'Miroir acrylique gravé avec LED intégrées. Câble USB inclus.', 210, 'led-lamps', 'Acrylique', 'https://images.unsplash.com/photo-1616628188540-925618b98318?w=400', 6, 1, 0],
    ['Porte-clés Gaming Personnalisé', 'Porte-clés acrylique avec motif gaming gravé au laser.', 25, 'keychains', 'Acrylique', 'https://images.unsplash.com/photo-1542779283-429940ce8336?w=400', 40, 1, 0],
  ];
  const stmt = dbWrap.prepare('INSERT INTO products (id,name,description,price,category,material,image_url,stock,requires_name,requires_date) VALUES (?,?,?,?,?,?,?,?,?,?)');
  for (const [name, desc, price, cat, mat, img, stock, rName, rDate] of items) {
    stmt.run(uuidv4(), name, desc, price, cat, mat, img, stock, rName, rDate);
  }
  console.log(`✅ ${items.length} produits de démonstration créés`);
}

// ── Public API ─────────────────────────────────────────────
async function initDb() {
  if (dbWrap) return dbWrap;
  const SQL = await initSqlJs();
  rawDb = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();
  initSchema();
  dbWrap = buildWrap();
  migrate();
  seedAdmin();
  seedProducts();
  backfillZones();
  return dbWrap;
}

function getDb() {
  if (!dbWrap) throw new Error('DB not initialized — call initDb() first');
  return dbWrap;
}

module.exports = { initDb, getDb, save };
