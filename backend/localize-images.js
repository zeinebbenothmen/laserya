/**
 * localize-images.js — Rapatrie les images du catalogue (Shopify CDN ou autre
 * URL externe) vers TON serveur, puis réécrit les liens dans la base locale.
 *
 * But : rendre le site 100% indépendant de Shopify. Une fois lancé, même si la
 * boutique Shopify est fermée, les photos restent (elles sont chez toi).
 *
 * Usage :
 *   1) Arrête le serveur (Ctrl+C) s'il tourne.
 *   2) node backend/localize-images.js          → aperçu (dry-run, ne télécharge rien)
 *      node backend/localize-images.js --apply   → télécharge + réécrit la base
 *   3) Relance le serveur : node backend/server.js
 *
 * - Idempotent : une image déjà locale (/assets/...) est ignorée ; un fichier
 *   déjà téléchargé n'est pas re-téléchargé. Re-lançable sans risque.
 * - Champs traités : image_url, images[] (galerie), models[].image (modèles).
 */
const { initDb, getDb } = require('./db');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const APPLY = process.argv.includes('--apply');

// Dossier de destination — servi par Express en /assets/products/...
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'assets', 'products');
const PUBLIC_PREFIX = '/assets/products';

// Une URL est "externe" (à rapatrier) si elle commence par http(s).
const isExternal = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

// Nom de fichier stable et unique, dérivé de l'URL (idempotent).
function localNameFor(url) {
  const clean = url.split('?')[0];
  let ext = (path.extname(clean) || '.jpg').toLowerCase();
  if (!/^\.(jpg|jpeg|png|webp|gif|avif)$/.test(ext)) ext = '.jpg';
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
  return `${hash}${ext}`;
}

const cache = new Map();          // url -> chemin public local
let downloaded = 0, skipped = 0, failed = 0;

async function localize(url) {
  if (!isExternal(url)) return url;          // déjà local → on garde
  if (cache.has(url)) return cache.get(url);

  const fileName  = localNameFor(url);
  const filePath  = path.join(OUT_DIR, fileName);
  const publicUrl = `${PUBLIC_PREFIX}/${fileName}`;

  // Déjà téléchargé lors d'un run précédent ?
  if (fs.existsSync(filePath)) { skipped++; cache.set(url, publicUrl); return publicUrl; }

  if (!APPLY) { cache.set(url, publicUrl); return publicUrl; }  // dry-run : on simule

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filePath, buf);
    downloaded++;
    cache.set(url, publicUrl);
    return publicUrl;
  } catch (e) {
    failed++;
    console.warn(`  ⚠️  Échec ${url} → ${e.message} (lien conservé)`);
    return url;                              // en cas d'échec : on garde l'URL d'origine
  }
}

// Remappe un champ JSON de type tableau (images[] ou models[]).
async function remapJsonArray(raw, pick, put) {
  let arr;
  try { arr = JSON.parse(raw || '[]'); } catch { return raw; }
  if (!Array.isArray(arr)) return raw;
  let changed = false;
  for (const item of arr) {
    const cur = pick(item);
    if (!isExternal(cur)) continue;
    const next = await localize(cur);
    if (next !== cur) { put(item, next); changed = true; }
  }
  return changed ? JSON.stringify(arr) : raw;
}

async function run() {
  await initDb();
  const db = getDb();

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const products = db.prepare('SELECT id, name, image_url, images, models FROM products').all();
  console.log(`\n${APPLY ? '⬇️  TÉLÉCHARGEMENT' : '👀 APERÇU (dry-run)'} — ${products.length} produits\n`);

  let productsTouched = 0;

  for (const p of products) {
    const newImageUrl = await localize(p.image_url);
    // images[] est un tableau de chaînes (pas d'objets) → remap dédié :
    let imagesStr = p.images;
    try {
      const imgs = JSON.parse(p.images || '[]');
      if (Array.isArray(imgs)) {
        const mapped = [];
        let ch = false;
        for (const u of imgs) { const n = await localize(u); mapped.push(n); if (n !== u) ch = true; }
        if (ch) imagesStr = JSON.stringify(mapped);
      }
    } catch {}

    const modelsStr = await remapJsonArray(p.models, m => m.image, (m, v) => { m.image = v; });

    const changed = newImageUrl !== p.image_url || imagesStr !== p.images || modelsStr !== p.models;
    if (changed) {
      productsTouched++;
      if (APPLY) {
        db.prepare('UPDATE products SET image_url = ?, images = ?, models = ? WHERE id = ?')
          .run(newImageUrl, imagesStr, modelsStr, p.id);
      }
    }
  }

  console.log('');
  console.log('────────────────────────────────────────');
  console.log(`  Produits concernés : ${productsTouched}`);
  console.log(`  Images téléchargées: ${downloaded}`);
  console.log(`  Déjà présentes     : ${skipped}`);
  console.log(`  Échecs             : ${failed}`);
  console.log('────────────────────────────────────────');
  if (!APPLY) {
    console.log('\n👉 Ceci était un APERÇU. Pour rapatrier réellement :');
    console.log('   node backend/localize-images.js --apply\n');
  } else {
    console.log(`\n✅ Terminé. Images dans frontend/assets/products/ , liens réécrits.`);
    console.log('   Relance le serveur : node backend/server.js\n');
  }
}

run().catch(e => { console.error('❌ Erreur :', e); process.exit(1); });
