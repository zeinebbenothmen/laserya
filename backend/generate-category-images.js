/**
 * generate-category-images.js
 * Génère les 6 photos de catégories de la page d'accueil — GRATUIT, sans clé API,
 * via Pollinations.ai (texte → image). Style : néon cyan futuriste (thème du site).
 *
 * Usage :
 *   node backend/generate-category-images.js
 *
 * Images écrites dans frontend/assets/images/cat-<key>.jpg
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'frontend', 'assets', 'images');

const STYLE = 'dark moody studio background, electric cyan neon accent lighting, glossy reflections, ' +
              'high-end futuristic laser-craft aesthetic, centered product photography, photorealistic, ' +
              'sharp focus, no text, no watermark, no people';

const CATEGORIES = [
  { key: 'led-lamps',    subject: 'a custom acrylic LED night lamp glowing, with an engraved anime line-art design, lit from a black base' },
  { key: 'anime-gaming', subject: 'an anime and gaming themed glowing acrylic light box display piece on a gaming desk' },
  { key: 'keychains',    subject: 'a small collection of laser-engraved transparent and colored acrylic custom keychains, macro shot' },
  { key: 'figures-3d',   subject: 'a highly detailed 3D printed resin figurine of a stylized character on a hexagonal display base' },
  { key: 'couple-gifts', subject: 'a romantic engraved acrylic couple photo lamp glowing softly, a heartfelt personalized gift' },
  { key: 'desk',         subject: 'a personalized laser-engraved wooden and acrylic desk organizer with a phone stand' },
];

function buildUrl(prompt, seed) {
  const enc = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${enc}?width=1024&height=768&seed=${seed}&nologo=true&model=flux`;
}

async function fetchImage(url, timeoutMs = 90000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) throw new Error('image trop petite (échec génération)');
    return buf;
  } finally { clearTimeout(t); }
}

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const only = process.argv.slice(2);
  const cats = only.length ? CATEGORIES.filter(c => only.includes(c.key)) : CATEGORIES;
  let ok = 0;
  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i];
    const prompt = `${cat.subject}, ${STYLE}`;
    process.stdout.write(`→ ${cat.key.padEnd(14)} génération... `);
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        const buf = await fetchImage(buildUrl(prompt, 1000 + i * 7 + attempt));
        fs.writeFileSync(path.join(OUT_DIR, `cat-${cat.key}.jpg`), buf);
        console.log(`✅ (${Math.round(buf.length / 1024)} Ko)`);
        ok++; done = true;
      } catch (e) {
        if (attempt === 3) console.log(`❌ ${e.message}`);
      }
    }
  }
  console.log(`\nTerminé : ${ok}/${cats.length} images dans frontend/assets/images/ (cat-*.jpg).`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
