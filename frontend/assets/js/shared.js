/**
 * shared.js — Injecté sur toutes les pages client
 * • Fix navigation links
 * • Cart badge live
 * • Toast notifications
 * • Back-to-top
 */

// ── Nav map — chemins absolus depuis la racine du serveur ──
const NAV_MAP = {
  'Home':                  '/index.html',
  'Accueil':               '/index.html',
  'Shop':                  '/pages/shop.html',
  'Boutique':              '/pages/shop.html',
  'Custom Order':          '/pages/custom-order.html',
  'Commande Custom':       '/pages/custom-order.html',
  'Commande sur mesure':   '/pages/custom-order.html',
  'Gift Ideas':            '/pages/gift-ideas.html',
  'Idées Cadeaux':         '/pages/gift-ideas.html',
  'Idées cadeaux':         '/pages/gift-ideas.html',
  'Track Order':           '/pages/my-orders.html',
  'Suivi commande':        '/pages/my-orders.html',
  'Suivi de commande':     '/pages/my-orders.html',
  'Contact':               '/pages/contact.html',
  'Create Custom Design':  '/pages/create-design.html',
  'Créer un design':       '/pages/create-design.html',
  'Start Custom Order':    '/pages/create-design.html',
  'Gift Finder':           '/pages/gift-finder.html',
  // Admin
  'Dashboard':             '/admin/dashboard.html',
  'Orders':                '/admin/orders.html',
  'Products':              '/admin/products.html',
  'Custom Requests':       '/admin/custom-requests.html',
  'Production Board':      '/admin/production-board.html',
};

function fixNavLinks() {
  document.querySelectorAll('a[href="#"], nav a').forEach(a => {
    const text = a.textContent.trim();
    const target = NAV_MAP[text];
    if (target && (a.getAttribute('href') === '#' || !a.getAttribute('href'))) {
      a.href = target;
    }
  });
  // Logo → home
  document.querySelectorAll('nav .text-primary, nav [class*="text-primary"]').forEach(el => {
    if (el.textContent.trim() === 'Laserya.tn' && !el.closest('a')) {
      el.style.cursor = 'pointer';
      el.onclick = () => window.location.href = '/index.html';
    }
  });
}

// ── Cart badge ─────────────────────────────────────────────
function updateCartBadge() {
  const count = Cart.count();
  document.querySelectorAll('[data-cart-badge]').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? '' : 'none';
  });
  // Also patch hardcoded badges (static HTML ones without data-cart-badge)
  document.querySelectorAll('.absolute.-top-1.-right-1, .absolute.-top-2.-right-2').forEach(badge => {
    if (badge.textContent.match(/^\d+$/) && !badge.dataset.cartBadge) {
      badge.dataset.cartBadge = 'true';
      badge.textContent = count;
      badge.style.display = count > 0 ? '' : 'none';
    }
  });
}

// ── Cart icon click → urcart ───────────────────────────────
function initCartIcon() {
  document.querySelectorAll('.material-symbols-outlined').forEach(icon => {
    if (icon.textContent.trim() === 'shopping_cart') {
      // Cible serrée (bouton, ou la pastille .relative) — jamais un grand conteneur,
      // sinon un clic « remonte » vers le gestionnaire d'une icône voisine (recherche).
      const parent = icon.closest('button') || icon.closest('a') || icon.closest('.relative') || icon;
      if (!parent.onclick && !parent.closest('a')) {
        parent.style.cursor = 'pointer';
        parent.onclick = (e) => { e.stopPropagation(); window.location.href = '/pages/cart.html'; };
      }
    }
  });
}

// ── CTA button ─────────────────────────────────────────────
function initCTA() {
  document.querySelectorAll('button').forEach(btn => {
    const t = btn.textContent.trim();
    if (t === 'Create Custom Design' || t === 'Créer un design personnalisé') {
      if (!btn.onclick) btn.onclick = () => window.location.href = '/pages/create-design.html';
    }
    if (t === 'Start Shopping' || t === 'Voir la boutique') {
      if (!btn.onclick) btn.onclick = () => window.location.href = '/pages/shop.html';
    }
  });
}

// ── Icône compte → Mes commandes (connecté) ou Connexion ───
function initAccountIcon() {
  const loggedIn = false; // plus de compte client : l'icône mène au suivi de commande
  const dest = '/pages/my-orders.html';
  document.querySelectorAll('.material-symbols-outlined').forEach(icon => {
    if (icon.textContent.trim() !== 'person') return;
    const link = icon.closest('a');
    if (link) link.href = dest;
    else {
      const parent = icon.closest('button') || icon.closest('div') || icon;
      if (!parent.onclick) { parent.style.cursor = 'pointer'; parent.onclick = () => window.location.href = dest; }
    }
    icon.title = 'Suivi de commande';
  });
}

// ── Icônes d'en-tête : recherche · favoris · compte ────────
// (cherche les icônes dans le <nav> pour ne pas toucher les cœurs des cartes produits)
function initHeaderIcons() {
  const accountDest = '/pages/my-orders.html'; // plus de compte : icône → suivi de commande
  document.querySelectorAll('nav .material-symbols-outlined').forEach(icon => {
    const t = icon.textContent.trim();
    let dest = null;
    if (t === 'search')                                 dest = '/pages/search.html';
    else if (t === 'favorite' || t === 'favorite_border') dest = '/pages/wishlist.html';
    else if (t === 'account_circle')                    dest = accountDest;
    if (!dest) return;
    const link = icon.closest('a');
    if (link) { link.href = dest; return; }
    // Cible serrée (bouton ou l'icône elle-même), pas un conteneur partagé,
    // pour ne pas capter par propagation les clics des icônes voisines (panier).
    const parent = icon.closest('button') || icon;
    if (!parent.onclick && !parent.closest('a')) {
      parent.style.cursor = 'pointer';
      parent.onclick = (e) => { e.stopPropagation(); window.location.href = dest; };
    }
    if (t === 'account_circle') icon.title = 'Suivi de commande';
    if (t === 'favorite' || t === 'favorite_border') icon.title = 'Mes favoris';
    if (t === 'search') icon.title = 'Rechercher';
  });
}

// ── Badge favoris (compteur sur l'icône cœur de l'en-tête) ──
function updateWishlistBadge() {
  if (!window.Wishlist) return;
  const n = Wishlist.count();
  document.querySelectorAll('[data-wishlist-badge]').forEach(el => {
    el.textContent = n;
    el.style.display = n > 0 ? '' : 'none';
  });
}

// ── Menu mobile global (hamburger) — injecté sur toutes les pages ──
function initMobileMenu() {
  if (window.__laseryaMobileMenu) return;
  // En-tête fixe de la page (nav ou header)
  const nav = document.querySelector('nav[class*="fixed"], header[class*="fixed"]');
  if (!nav) return;
  window.__laseryaMobileMenu = true;

  // CSS : sur mobile on masque les actions encombrantes et on montre nos contrôles
  const style = document.createElement('style');
  style.textContent =
    '.mm-controls{display:none}' +
    '@media(max-width:767px){.mm-hide-mobile{display:none !important}.mm-controls{display:flex !important}}' +
    '@media(min-width:768px){#mm-panel{display:none !important}}';
  document.head.appendChild(style);

  // Masquer sur mobile : icônes d'action + boutons CTA de l'en-tête
  const HIDE = ['search', 'favorite', 'shopping_cart', 'account_circle', 'person', 'menu'];
  nav.querySelectorAll('.material-symbols-outlined').forEach(ic => {
    const t = (ic.getAttribute('data-icon') || ic.textContent || '').trim();
    if (HIDE.includes(t)) (ic.closest('button, a, div.relative') || ic).classList.add('mm-hide-mobile');
  });
  nav.querySelectorAll('button, a').forEach(b => {
    if (/(cr[ée]er|create).*(design|produit|custom)/i.test(b.textContent.trim())) b.classList.add('mm-hide-mobile');
  });

  const accountDest = '/pages/my-orders.html';

  // Contrôles mobiles (panier + hamburger), centrés verticalement à droite de l'en-tête
  const controls = document.createElement('div');
  controls.className = 'mm-controls';
  controls.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);align-items:center;gap:2px;z-index:60';
  controls.innerHTML =
    '<a href="/pages/cart.html" style="position:relative;color:#bbc9cf;padding:6px;display:inline-flex"><span class="material-symbols-outlined">shopping_cart</span>' +
    '<span data-cart-badge style="position:absolute;top:0;right:0;background:#8A6A12;color:#fff;font-size:10px;font-weight:700;border-radius:9999px;padding:0 5px;display:none">0</span></a>' +
    '<button id="mm-burger" aria-label="Menu" style="color:#e0e2ea;padding:6px;background:none;border:none;cursor:pointer"><span class="material-symbols-outlined" style="font-size:28px">menu</span></button>';
  nav.appendChild(controls);

  // Panneau déroulant
  const link = (href, label) =>
    `<a href="${href}" style="padding:14px 24px;color:#bbc9cf;text-decoration:none;font-family:Geist,sans-serif;border-bottom:1px solid rgba(255,255,255,.05)">${label}</a>`;
  const panel = document.createElement('div');
  panel.id = 'mm-panel';
  panel.style.cssText = 'position:fixed;left:0;width:100%;z-index:55;background:rgba(7,10,15,.98);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.08);display:none;flex-direction:column';
  panel.innerHTML =
    link('/index.html', 'Accueil') +
    link('/pages/shop.html', 'Boutique') +
    link('/pages/custom-order.html', 'Commande sur mesure') +
    link('/pages/gift-ideas.html', 'Idées cadeaux') +
    link('/pages/my-orders.html', 'Suivi de commande') +
    link('/pages/contact.html', 'Contact') +
    '<div style="display:flex;gap:28px;padding:18px 24px;color:#bbc9cf">' +
      '<a href="/pages/search.html" class="material-symbols-outlined" style="color:#bbc9cf" title="Rechercher">search</a>' +
      '<a href="/pages/wishlist.html" class="material-symbols-outlined" style="color:#bbc9cf" title="Favoris">favorite</a>' +
      `<a href="${accountDest}" class="material-symbols-outlined" style="color:#bbc9cf" title="Mon compte">account_circle</a>` +
    '</div>' +
    '<a href="/pages/create-design.html" style="margin:8px 24px 20px;background:#8A6A12;color:#fff;font-weight:700;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-family:Geist,sans-serif">Créer un design</a>';
  document.body.appendChild(panel);

  const burger = document.getElementById('mm-burger');
  const bicon = burger.querySelector('.material-symbols-outlined');
  burger.addEventListener('click', () => {
    const open = panel.style.display === 'flex';
    if (open) { panel.style.display = 'none'; bicon.textContent = 'menu'; document.body.style.overflow = ''; }
    else { panel.style.top = nav.getBoundingClientRect().bottom + 'px'; panel.style.display = 'flex'; bicon.textContent = 'close'; }
  });
}

// ── Run on every page ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fixNavLinks();
  initCartIcon();
  initCTA();
  initAccountIcon();
  initHeaderIcons();
  initMobileMenu();
  updateCartBadge();
  updateWishlistBadge();
});
window.addEventListener('cart:updated', updateCartBadge);
window.addEventListener('wishlist:updated', updateWishlistBadge);
