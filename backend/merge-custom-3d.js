/**
 * merge-custom-3d.js — Fusion « Custom Order » + « 3D Print » en une seule entrée.
 * Sur toutes les pages frontend :
 *   1. Supprime le lien de menu vers /3d-print (clean route = top-nav uniquement).
 *   2. Renomme le libellé du lien /custom-order en « Commande sur mesure ».
 * Usage : node backend/merge-custom-3d.js [--apply]   (sans --apply = dry-run)
 */
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const ROOT = path.join(__dirname, '..', 'frontend');

// Anchor vers /3d-print (href dans n'importe quel ordre d'attributs), texte simple.
const RE_REMOVE = /[ \t]*<a\b[^>]*href="\/3d-print"[^>]*>[^<]*<\/a>[ \t]*\n?/g;
// Anchor vers /custom-order : on ne remplace que le texte interne.
const RE_RENAME = /(<a\b[^>]*href="\/custom-order"[^>]*>)[^<]*(<\/a>)/g;

function walk(dir) {
  let files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(p));
    else if (e.name.endsWith('.html')) files.push(p);
  }
  return files;
}

let totalRemoved = 0, totalRenamed = 0, touched = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const orig = html;

  const removed = (html.match(RE_REMOVE) || []).length;
  html = html.replace(RE_REMOVE, '');

  let renamed = 0;
  html = html.replace(RE_RENAME, (m, open, close) => { renamed++; return `${open}Commande sur mesure${close}`; });

  if (html !== orig) {
    touched++;
    totalRemoved += removed;
    totalRenamed += renamed;
    const rel = path.relative(ROOT, file);
    console.log(`${APPLY ? '✏️ ' : '· '}${rel}  (—${removed} lien 3D, ${renamed} renommé)`);
    if (APPLY) fs.writeFileSync(file, html);
  }
}
console.log(`\n${APPLY ? 'Appliqué' : 'DRY-RUN'} : ${touched} fichier(s), ${totalRemoved} lien(s) 3D supprimé(s), ${totalRenamed} lien(s) renommé(s).`);
if (!APPLY) console.log('Relancer avec --apply pour écrire les changements.');
