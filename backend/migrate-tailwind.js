/**
 * migrate-tailwind.js — Remplace le CDN Tailwind (+ config inline) par le CSS
 * compilé local, sur toutes les pages HTML.
 *
 *   node backend/migrate-tailwind.js          → aperçu (dry-run)
 *   node backend/migrate-tailwind.js --apply   → écrit les fichiers
 *
 * - Pages /admin/  → /assets/css/tailwind-admin.css
 * - Autres pages   → /assets/css/tailwind-public.css
 * - Idempotent : une page déjà migrée (plus de CDN) est ignorée.
 */
const fs   = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const ROOT  = path.join(__dirname, '..', 'frontend');

// Retrouve récursivement tous les .html
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const CDN_RE    = /[ \t]*<script[^>]*src="https:\/\/cdn\.tailwindcss\.com[^"]*"[^>]*><\/script>\s*\n?/i;
const CONFIG_RE = /[ \t]*<script id="tailwind-config">[\s\S]*?<\/script>\s*\n?/i;

let migrated = 0, skipped = 0;

for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  if (!CDN_RE.test(html)) { skipped++; continue; }   // déjà migrée ou pas de CDN

  const isAdmin = file.split(path.sep).includes('admin');
  const cssHref = isAdmin ? '/assets/css/tailwind-admin.css' : '/assets/css/tailwind-public.css';
  const linkTag = `<link rel="stylesheet" href="${cssHref}">\n`;

  // Remplace le script CDN par le <link>, puis retire le bloc de config inline.
  let out = html.replace(CDN_RE, linkTag).replace(CONFIG_RE, '');

  if (out !== html) {
    migrated++;
    console.log(`  ${isAdmin ? '[admin] ' : '[public]'} ${path.relative(ROOT, file)}`);
    if (APPLY) fs.writeFileSync(file, out, 'utf8');
  }
}

console.log('\n────────────────────────────────────────');
console.log(`  Pages migrées : ${migrated}`);
console.log(`  Ignorées      : ${skipped}`);
console.log('────────────────────────────────────────');
if (!APPLY) console.log('\n👉 Aperçu. Pour appliquer : node backend/migrate-tailwind.js --apply\n');
else        console.log('\n✅ Migration appliquée.\n');
