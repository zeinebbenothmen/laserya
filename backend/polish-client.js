/**
 * polish-client.js — Finition client : nav uniforme + images mortes remplacées.
 *   1. Supprime le lien de nav « 3D Print / Impression 3D » (routes /3d-print ET /pages/3d-print.html).
 *   2. Renomme le lien nav « Custom Order / Commande perso » → « Commande sur mesure ».
 *   3. Traduit les libellés de nav restés en anglais (Home/Shop/Gift Ideas/Track Order), ancrés sur leur href.
 *   4. Traduit le bouton « Create Custom Design » → « Créer mon design ».
 *   5. Remplace toutes les images mortes googleusercontent par /assets/images/placeholder.svg.
 * Usage : node backend/polish-client.js [--apply]   (sans --apply = dry-run)
 */
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const ROOT = path.join(__dirname, '..', 'frontend');
const PLACEHOLDER = '/assets/images/placeholder.svg';

function walk(dir) {
  let files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(p));
    else if (e.name.endsWith('.html')) files.push(p);
  }
  return files;
}

// 1. Lien nav 3D (texte = libellé de nav uniquement → on ne touche pas aux liens de footer "FDM/SLA…")
const RE_3D = /\s*<a\b[^>]*href="(?:\/3d-print|\/?(?:pages\/)?3d-print\.html)"[^>]*>\s*(?:3D Print|Impression 3D)\s*<\/a>/gi;
// 2. Lien nav Custom Order → Commande sur mesure
const RE_CUSTOM = /(<a\b[^>]*href="(?:\/custom-order|\/?(?:pages\/)?custom-order\.html)"[^>]*>)\s*(?:Custom Order|Commande perso)\s*(<\/a>)/gi;
// 3. Libellés nav anglais (ancrés sur href) — gère routes propres, /pages/x.html et liens relatifs x.html
const NAV_TR = [
  { re: /(<a\b[^>]*href="(?:\/index\.html|\/|index\.html)"[^>]*>)\s*Home\s*(<\/a>)/gi,                         to: '$1Accueil$2' },
  { re: /(<a\b[^>]*href="(?:\/shop|\/?(?:pages\/)?shop\.html)"[^>]*>)\s*Shop\s*(<\/a>)/gi,                     to: '$1Boutique$2' },
  { re: /(<a\b[^>]*href="(?:\/gift-ideas|\/?(?:pages\/)?gift-ideas\.html)"[^>]*>)\s*Gift Ideas\s*(<\/a>)/gi,   to: '$1Idées cadeaux$2' },
  { re: /(<a\b[^>]*href="(?:\/track-order|\/?(?:pages\/)?my-orders\.html)"[^>]*>)\s*Track Order\s*(<\/a>)/gi,  to: '$1Suivi de commande$2' },
];
// 5. Images mortes googleusercontent (aida & aida-public) → placeholder local
const RE_DEAD_IMG = /https?:\/\/[a-z0-9.\-]*googleusercontent\.com\/[^"'\s)]*/gi;

let nav3d = 0, navCustom = 0, navTr = 0, ccd = 0, imgs = 0, touched = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const orig = html;

  nav3d     += (html.match(RE_3D) || []).length;       html = html.replace(RE_3D, '');
  navCustom += (html.match(RE_CUSTOM) || []).length;    html = html.replace(RE_CUSTOM, '$1Commande sur mesure$2');
  for (const t of NAV_TR) { navTr += (html.match(t.re) || []).length; html = html.replace(t.re, t.to); }
  ccd       += (html.match(/>Create Custom Design</g) || []).length; html = html.replace(/>Create Custom Design</g, '>Créer mon design<');
  imgs      += (html.match(RE_DEAD_IMG) || []).length;  html = html.replace(RE_DEAD_IMG, PLACEHOLDER);

  if (html !== orig) {
    touched++;
    if (APPLY) fs.writeFileSync(file, html);
  }
}

console.log(`${APPLY ? 'APPLIQUÉ' : 'DRY-RUN'} — ${touched} fichier(s) modifié(s)`);
console.log(`  · liens nav 3D supprimés        : ${nav3d}`);
console.log(`  · liens « Commande sur mesure »  : ${navCustom}`);
console.log(`  · libellés nav traduits          : ${navTr}`);
console.log(`  · « Créer mon design »           : ${ccd}`);
console.log(`  · images mortes → placeholder    : ${imgs}`);
if (!APPLY) console.log('\nRelancer avec --apply pour écrire.');
