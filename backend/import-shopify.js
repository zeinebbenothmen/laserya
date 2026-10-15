/**
 * import-shopify.js — Importe les produits depuis la boutique Shopify publique
 * (https://www.laserya.fr) vers la base de données locale Laserya.
 *
 * Usage :
 *   1) Arrêtez le serveur (Ctrl+C) s'il tourne.
 *   2) node backend/import-shopify.js
 *   3) Relancez le serveur : npm run dev
 *
 * - Idempotent : un produit déjà présent (même nom) n'est PAS recréé.
 * - Réutilise les URLs d'images Shopify (pas de téléchargement).
 * - Devine la catégorie Laserya à partir du titre + tags.
 */
const { initDb, getDb } = require('./db');
const { v4: uuidv4 } = require('uuid');

const SHOP_URL = process.env.SHOP_URL || 'https://www.laserya.fr';

// ── Catégorie Laserya devinée depuis le titre + les tags ───
function guessCategory(title, tags) {
  const s = (title + ' ' + (tags || []).join(' ')).toLowerCase();
  if (/(figurine|statuette|statue|figure)/.test(s))                         return '3d-figures';
  if (/(lamp|lampe|light\s?box|led|shadow|lune|n[ée]on|veilleuse)/.test(s)) return 'led-lamps';
  if (/(porte.?cl|porte.?bijou|keychain|keyring|porte.?cle)/.test(s))       return 'keychains';
  if (/(support|pr[ée]sentoir|carte|keycap|crocs|auto|moto|\bcar\b|bo[iî]te|box|rangement|stand)/.test(s)) return 'accessories';
  if (/(cadeau|mariage|love|couple|gift|amour|anniversaire)/.test(s))        return 'gifts';
  return 'other';
}

// ── Détecte un produit personnalisable (texte/prénom à graver) ──
function detectPersonalized(title, tags, bodyHtml) {
  const s = (title + ' ' + (tags || []).join(' ') + ' ' + (bodyHtml || '')).toLowerCase();
  return /personnalis|personalis|pr[ée]nom|votre (texte|nom|photo|message)|[àa] graver|sur.?mesure/.test(s);
}

// ── Construit la liste des modèles à partir des variantes Shopify ──
// Chaque modèle = { name, price, image, available }. Vide s'il n'y a qu'une variante.
function buildModels(p) {
  const variants = p.variants || [];
  if (variants.length <= 1) return [];
  // Map image_id → src pour retrouver l'image d'une variante au besoin
  const imgById = {};
  (p.images || []).forEach(img => { if (img.id) imgById[img.id] = img.src; });
  return variants.map(v => {
    const img = (v.featured_image && v.featured_image.src)
      || (v.image_id && imgById[v.image_id])
      || '';
    return {
      name: (v.title || v.option1 || 'Modèle').trim(),
      price: parseFloat(v.price || 0) || 0,
      image: img,
      available: v.available !== false,
    };
  }).filter(m => m.name && m.name.toLowerCase() !== 'default title');
}

// ── Nettoyage de la description HTML → texte court ─────────
function cleanDescription(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

// ── Récupère tous les produits Shopify (pagination) ────────
async function fetchAllProducts() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${SHOP_URL}/products.json?limit=250&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Shopify a répondu ${res.status} pour ${url}`);
    const data = await res.json();
    const ps = data.products || [];
    if (!ps.length) break;
    all.push(...ps);
    if (ps.length < 250) break;
  }
  return all;
}

async function run() {
  console.log(`→ Récupération des produits depuis ${SHOP_URL} ...`);
  let products;
  try {
    products = await fetchAllProducts();
  } catch (e) {
    // Repli : fichier local ._shopify.json s'il existe
    try { products = (require('../._shopify.json').products) || []; console.log('(repli sur le fichier local ._shopify.json)'); }
    catch { throw e; }
  }
  console.log(`→ ${products.length} produits trouvés sur Shopify.`);

  await initDb();
  const db = getDb();

  // Produits déjà en base (par nom) → pour mettre à jour les images
  const existing = new Map();
  db.prepare('SELECT id, name, image_url FROM products').all()
    .forEach(r => existing.set(r.name.trim().toLowerCase(), r));

  const insertStmt = db.prepare(`
    INSERT INTO products (id, name, description, price, compare_at_price, category, material, image_url, stock,
                          requires_name, requires_date, name_label, date_label, personalization_zones, images, models)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '', '[]', ?, ?)
  `);
  // Met à jour un produit déjà importé : on rafraîchit galerie + modèles + perso + prix + promo + description,
  // sans écraser la photo principale si elle a été choisie à la main.
  const updFull     = db.prepare(`UPDATE products SET images=?, models=?, price=?, compare_at_price=?, description=?,
                                   requires_name=?, name_label=?, image_url=? WHERE id=?`);
  const updFullKeep = db.prepare(`UPDATE products SET images=?, models=?, price=?, compare_at_price=?, description=?,
                                   requires_name=?, name_label=? WHERE id=?`);

  let added = 0, updated = 0, skipped = 0, withModels = 0, personalized = 0, onSale = 0;
  const byCat = {};
  for (const p of products) {
    const name = (p.title || '').trim();
    if (!name) { skipped++; continue; }

    const variants = p.variants || [];
    const models = buildModels(p);
    // Prix affiché = le plus bas parmi les variantes (« à partir de »).
    const prices = variants.map(v => parseFloat(v.price || 0) || 0).filter(n => n > 0);
    const price = prices.length ? Math.min(...prices) : (parseFloat((variants[0] || {}).price || 0) || 0);
    // Promo : prix barré (compare_at_price) de la/les variante(s) au prix affiché, si supérieur au prix.
    let compareAt = 0;
    for (const v of variants) {
      if ((parseFloat(v.price || 0) || 0) !== price) continue;
      const c = parseFloat(v.compare_at_price || 0) || 0;
      if (c > price && c > compareAt) compareAt = c;
    }
    const imageList = (p.images || []).map(i => i.src).filter(Boolean);
    const imagesJson = JSON.stringify(imageList);
    const modelsJson = JSON.stringify(models);
    const mainImage = imageList[0] || '';
    const category = guessCategory(name, p.tags);
    const description = cleanDescription(p.body_html);
    const isPerso = detectPersonalized(name, p.tags, p.body_html);
    const nameLabel = isPerso ? 'Votre texte / prénom à graver' : '';
    const firstVar = variants[0] || {};
    const stock = (firstVar.inventory_quantity != null && firstVar.inventory_quantity > 0)
      ? firstVar.inventory_quantity : 10;

    if (models.length) withModels++;
    if (isPerso) personalized++;
    if (compareAt > price) onSale++;

    const found = existing.get(name.toLowerCase());
    if (found) {
      if (!found.image_url && mainImage)
        updFull.run(imagesJson, modelsJson, price, compareAt, description, isPerso ? 1 : 0, nameLabel, mainImage, found.id);
      else
        updFullKeep.run(imagesJson, modelsJson, price, compareAt, description, isPerso ? 1 : 0, nameLabel, found.id);
      updated++;
      continue;
    }

    insertStmt.run(uuidv4(), name, description, price, compareAt, category, '', mainImage, stock,
                   isPerso ? 1 : 0, nameLabel, imagesJson, modelsJson);
    existing.set(name.toLowerCase(), { id: 'new', name, image_url: mainImage });
    byCat[category] = (byCat[category] || 0) + 1;
    added++;
  }

  console.log(`\n✅ Import terminé : ${added} ajoutés, ${updated} mis à jour, ${skipped} ignorés.`);
  console.log(`   Modèles multiples : ${withModels} · Personnalisables : ${personalized} · En promo : ${onSale}.`);
  console.log('   Répartition par catégorie (nouveaux) :', JSON.stringify(byCat));
  console.log('   Lancez maintenant le serveur : npm run dev');
}

run().catch(err => { console.error('❌ Erreur import :', err.message); process.exit(1); });
