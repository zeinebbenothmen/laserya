/**
 * make-logo-png.js — Génère le logo PNG transparent à partir de logo.jpg.
 * - Fond gris clair  → transparent (remplissage par diffusion depuis les bords)
 * - Monogramme noir  → couleur choisie (NOIR pour fond clair, BLANC pour fond sombre)
 * - Drapeau rouge    → conservé tel quel (jamais modifié)
 *
 * Produit DEUX fichiers :
 *   logo.png        → monogramme NOIR  (header clair de la boutique)
 *   logo-white.png  → monogramme BLANC (footer / admin sur fond sombre)
 */
const Jimp = require('jimp');
const path = require('path');

const SRC = path.join(__dirname, '..', 'frontend', 'assets', 'images', 'logo.jpg');
const DIR = path.join(__dirname, '..', 'frontend', 'assets', 'images');

async function build(mono, outName) {
  const img = await Jimp.read(SRC);
  const w = img.bitmap.width, h = img.bitmap.height;

  const bg = Jimp.intToRGBA(img.getPixelColor(2, 2));
  const near = (r, g, b, R, G, B, tol) =>
    Math.abs(r - R) <= tol && Math.abs(g - G) <= tol && Math.abs(b - B) <= tol;

  const idx = (x, y) => (y * w + x);
  const visited = new Uint8Array(w * h);
  const queue = [];
  const pushIfBg = (x, y) => {
    const c = Jimp.intToRGBA(img.getPixelColor(x, y));
    if (near(c.r, c.g, c.b, bg.r, bg.g, bg.b, 28)) { visited[idx(x, y)] = 1; queue.push(x, y); }
  };
  for (let x = 0; x < w; x++) { pushIfBg(x, 0); pushIfBg(x, h - 1); }
  for (let y = 0; y < h; y++) { pushIfBg(0, y); pushIfBg(w - 1, y); }

  while (queue.length) {
    const y = queue.pop(), x = queue.pop();
    img.setPixelColor(0x00000000, x, y);
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (visited[idx(nx, ny)]) continue;
      const c = Jimp.intToRGBA(img.getPixelColor(nx, ny));
      if (near(c.r, c.g, c.b, bg.r, bg.g, bg.b, 28)) { visited[idx(nx, ny)] = 1; queue.push(nx, ny); }
    }
  }

  // Monogramme (pixels gris/noir encore opaques) → couleur demandée. Drapeau intact.
  img.scan(0, 0, w, h, function (x, y, i) {
    const a = this.bitmap.data[i + 3];
    if (a === 0) return;
    const r = this.bitmap.data[i], g = this.bitmap.data[i + 1], b = this.bitmap.data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 90 && Math.abs(r - g) < 40 && Math.abs(g - b) < 40) {
      this.bitmap.data[i] = mono.r; this.bitmap.data[i + 1] = mono.g; this.bitmap.data[i + 2] = mono.b;
    }
  });

  // Rogner les marges transparentes
  let minX = w, minY = h, maxX = 0, maxY = 0;
  img.scan(0, 0, w, h, function (x, y, i) {
    if (this.bitmap.data[i + 3] > 10) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  });
  const bw = Math.max(1, maxX - minX + 1), bh = Math.max(1, maxY - minY + 1);
  const content = img.clone().crop(minX, minY, bw, bh);
  const side = Math.round(Math.max(bw, bh) * 1.12);
  const canvas = new Jimp(side, side, 0x00000000);
  canvas.composite(content, Math.round((side - bw) / 2), Math.round((side - bh) / 2));
  await canvas.writeAsync(path.join(DIR, outName));
  console.log(`✅ ${outName} généré (monogramme ${outName.includes('white') ? 'BLANC' : 'NOIR'}, drapeau rouge conservé)`);
}

(async () => {
  await build({ r: 0x1A, g: 0x15, b: 0x0C }, 'logo.png');        // noir → header clair
  await build({ r: 0xFF, g: 0xFF, b: 0xFF }, 'logo-white.png');  // blanc → footer / admin
})().catch(e => { console.error('❌', e.message); process.exit(1); });
