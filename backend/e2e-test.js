/**
 * e2e-test.js — Test client réel via Edge (puppeteer-core).
 * Clique dans le tunnel : accueil → catégorie → promo → produit (modèles) → panier → checkout.
 * Capture les erreurs console, les requêtes en échec, et des screenshots.
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://localhost:3001';
const SHOTS = path.join(__dirname, '_test-shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS);

const results = [];
const ok   = (m) => { results.push('✅ ' + m); console.log('✅ ' + m); };
const bad  = (m) => { results.push('❌ ' + m); console.log('❌ ' + m); };
const warn = (m) => { results.push('⚠️  ' + m); console.log('⚠️  ' + m); };

(async () => {
  // Lance Edge nous-mêmes avec un port de debug, puis on s'y connecte (plus fiable que launch()).
  const { spawn } = require('child_process');
  const userDataDir = path.join(require('os').tmpdir(), 'edge-e2e-' + Date.now());
  const PORT = 9222;
  const edgeProc = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1440,900',
  ], { detached: false, stdio: 'ignore' });

  // Attend que l'endpoint de debug réponde
  let wsEndpoint = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      wsEndpoint = v.webSocketDebuggerUrl;
      if (wsEndpoint) break;
    } catch { /* pas encore prêt */ }
  }
  if (!wsEndpoint) { try { edgeProc.kill(); } catch {} throw new Error('Edge debug endpoint indisponible (port ' + PORT + ')'); }
  const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint, defaultViewport: { width: 1440, height: 900 } });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // ── Collecte des erreurs globales ──
  const consoleErrors = [];
  const failedReqs = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));
  page.on('requestfailed', req => failedReqs.push(req.url()));

  const shot = async (name) => { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  try {
    // ─────────── 1. ACCUEIL ───────────
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = await page.title();
    ok(`Accueil chargé — titre: "${title}"`);
    // Sections dynamiques
    await sleep(1500);
    const homeCards = await page.$$eval('a[href*="shop.html?"]', els => els.length);
    homeCards >= 6 ? ok(`Cartes "Explorez notre univers": ${homeCards} liens filtrés`) : warn(`Seulement ${homeCards} cartes catégorie filtrées`);
    // Images cassées sur l'accueil ?
    const brokenHome = await page.$$eval('img', imgs => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src).slice(0,5));
    brokenHome.length ? warn(`Accueil: ${brokenHome.length} image(s) cassée(s) ex: ${brokenHome[0]}`) : ok('Accueil: toutes les images chargent');
    await shot('1-accueil');

    // ─────────── 2. BOUTIQUE filtrée par catégorie ───────────
    await page.goto(`${BASE}/pages/shop.html?category=keychains`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1500);
    const countKey = await page.$eval('#product-count', el => el.textContent.trim());
    const cardsKey = await page.$$eval('#products-grid [data-id]', els => els.length);
    (Number(countKey) > 0 && cardsKey > 0) ? ok(`Boutique ?category=keychains → compteur ${countKey}, ${cardsKey} cartes affichées`) : bad(`Boutique keychains vide (compteur ${countKey}, cartes ${cardsKey})`);
    const chipVisible = await page.$eval('#active-filter-chip', el => !el.classList.contains('hidden')).catch(() => false);
    chipVisible ? ok('Bandeau "filtre actif" visible') : warn('Bandeau filtre actif non visible');
    await shot('2-boutique-keychains');

    // ─────────── 3. ONGLET "En promo" ───────────
    await page.goto(`${BASE}/pages/shop.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1200);
    await page.click('#quick-tabs button[data-quick="promo"]');
    await sleep(800);
    const promoCount = await page.$eval('#product-count', el => el.textContent.trim());
    const promoBadges = await page.$$eval('#products-grid [data-id]', els => els.filter(c => /-\d+%/.test(c.textContent)).length);
    const struck = await page.$$eval('#products-grid .line-through', els => els.length);
    (Number(promoCount) > 0 && promoBadges > 0) ? ok(`Onglet "En promo": ${promoCount} produits, ${promoBadges} badges -X%, ${struck} prix barrés`) : bad(`Onglet promo: compteur ${promoCount}, badges ${promoBadges}`);
    await shot('3-promo');

    // ─────────── 4. FICHE PRODUIT avec MODÈLES ───────────
    // Récupère un produit à modèles via l'API
    const prodId = await page.evaluate(async () => {
      const list = await (await fetch('/api/products')).json();
      const p = list.find(x => { try { return JSON.parse(x.models || '[]').length >= 2; } catch { return false; } });
      return p ? p.id : null;
    });
    if (!prodId) { bad('Aucun produit à modèles trouvé via API'); }
    else {
      await page.goto(`${BASE}/pages/product.html?id=${prodId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1500);
      const h1 = await page.$eval('h1', el => el.textContent.trim());
      ok(`Fiche produit chargée: "${h1.slice(0,40)}"`);
      const thumbs = await page.$$eval('#thumb-strip .thumb', els => els.length);
      thumbs >= 2 ? ok(`Sélecteur de modèles: ${thumbs} modèles affichés`) : warn(`Sélecteur modèles: ${thumbs} vignette(s)`);
      // Image principale avant
      const imgBefore = await page.$eval('#main-product-image', el => el.src).catch(() => '');
      // Clic sur le 2e modèle
      if (thumbs >= 2) {
        await page.click('#thumb-strip .thumb:nth-child(2)');
        await sleep(600);
        const imgAfter = await page.$eval('#main-product-image', el => el.src).catch(() => '');
        (imgAfter && imgAfter !== imgBefore) ? ok('Clic modèle 2 → image principale mise à jour') : warn('Clic modèle 2 → image inchangée');
      }
      // Champ personnalisation présent ?
      const persInput = await page.$('#generic-text-input, #personalization-block input');
      persInput ? ok('Champ de personnalisation présent') : warn('Pas de champ personnalisation');
      await shot('4-produit-modeles');

      // ─────────── 5. AJOUT AU PANIER ───────────
      // Renseigner le texte perso si présent
      if (persInput) { await persInput.type('Sarah'); await sleep(200); }
      // Bouton "Ajouter au panier"
      const addBtn = await page.evaluateHandle(() => {
        const btns = [...document.querySelectorAll('button')];
        return btns.find(b => /ajouter au panier|ajouter|add to cart/i.test(b.textContent)) || null;
      });
      if (addBtn && addBtn.asElement()) {
        await addBtn.asElement().click();
        await sleep(800);
        const badge = await page.$eval('.cart-count, [data-cart-badge]', el => el.textContent.trim()).catch(() => null);
        badge && Number(badge) > 0 ? ok(`Ajout panier OK → badge panier = ${badge}`) : warn(`Ajout panier: badge = ${badge}`);
      } else { warn('Bouton "Ajouter au panier" introuvable'); }
      await shot('5-apres-ajout');
    }

    // ─────────── 6. PAGE PANIER ───────────
    await page.goto(`${BASE}/pages/cart.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1200);
    const cartText = await page.evaluate(() => document.body.innerText);
    const hasModel = /mod[eè]le/i.test(cartText);
    const hasItem = !/panier (est )?vide|votre panier est vide/i.test(cartText);
    hasItem ? ok('Panier: contient au moins un article') : warn('Panier affiché comme vide');
    hasModel ? ok('Panier: le modèle choisi est affiché') : warn('Panier: modèle non affiché (à vérifier)');
    await shot('6-panier');

    // ─────────── Bilan erreurs ───────────
    if (consoleErrors.length) { warn(`${consoleErrors.length} erreur(s) console JS`); consoleErrors.slice(0,8).forEach(e => console.log('     · ' + e.slice(0,120))); }
    else ok('Aucune erreur console JS');
    const extFails = failedReqs.filter(u => !u.includes('favicon'));
    if (extFails.length) { warn(`${extFails.length} requête(s) en échec`); [...new Set(extFails)].slice(0,8).forEach(u => console.log('     · ' + u.slice(0,100))); }
    else ok('Aucune requête réseau en échec');

  } catch (e) {
    bad('EXCEPTION: ' + e.message);
    await shot('zz-erreur');
  } finally {
    try { await browser.close(); } catch {}
    try { edgeProc.kill(); } catch {}
    console.log('\n──────── BILAN ────────');
    console.log(results.join('\n'));
    console.log(`\nScreenshots : backend/_test-shots/`);
  }
})();
