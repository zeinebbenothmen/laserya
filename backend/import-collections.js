/**
 * import-collections.js — Récupère l'appartenance produit→collection depuis
 * laserya.fr et la stocke dans products.collections (JSON de handles).
 *
 * Usage :
 *   1) Arrêter le serveur (Ctrl+C).
 *   2) node backend/import-collections.js
 *   3) Relancer : node backend/server.js
 *
 * Idempotent : réécrit la liste des collections de chaque produit à chaque exécution.
 * Correspondance produit ↔ Shopify par TITRE (même logique que import-shopify.js).
 */
const { initDb, getDb } = require('./db');

const SHOP_URL = process.env.SHOP_URL || 'https://www.laserya.fr';
const norm = (s) => String(s || '').trim().toLowerCase();

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} pour ${url}`);
  return res.json();
}

async function fetchCollections() {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const data = await fetchJSON(`${SHOP_URL}/collections.json?limit=250&page=${page}`);
    const cs = data.collections || [];
    if (!cs.length) break;
    all.push(...cs);
    if (cs.length < 250) break;
  }
  return all;
}

async function fetchCollectionProducts(handle) {
  const titles = [];
  for (let page = 1; page <= 20; page++) {
    let data;
    try { data = await fetchJSON(`${SHOP_URL}/collections/${handle}/products.json?limit=250&page=${page}`); }
    catch { break; }
    const ps = data.products || [];
    if (!ps.length) break;
    titles.push(...ps.map(p => p.title));
    if (ps.length < 250) break;
  }
  return titles;
}

async function run() {
  console.log(`→ Lecture des collections depuis ${SHOP_URL} ...`);
  const collections = await fetchCollections();
  console.log(`→ ${collections.length} collections.`);

  // title (normalisé) → Set(handles)
  const titleToHandles = new Map();
  for (const c of collections) {
    const titles = await fetchCollectionProducts(c.handle);
    for (const t of titles) {
      const k = norm(t);
      if (!titleToHandles.has(k)) titleToHandles.set(k, new Set());
      titleToHandles.get(k).add(c.handle);
    }
    process.stdout.write(`   ${c.handle}: ${titles.length}\n`);
  }

  await initDb();
  const db = getDb();
  const rows = db.prepare('SELECT id, name FROM products').all();
  const upd = db.prepare('UPDATE products SET collections = ? WHERE id = ?');

  let matched = 0;
  for (const r of rows) {
    const handles = titleToHandles.get(norm(r.name));
    const arr = handles ? [...handles] : [];
    if (arr.length) matched++;
    upd.run(JSON.stringify(arr), r.id);
  }

  console.log(`\n✅ Collections rattachées : ${matched}/${rows.length} produits.`);
  console.log('   Relancez le serveur : node backend/server.js');
}

run().catch(err => { console.error('❌ Erreur :', err.message); process.exit(1); });
