/**
 * admin-nav.js — Barre latérale admin partagée (source unique).
 *
 * Usage dans chaque page admin :
 *   <aside id="admin-sidebar" data-active="orders"></aside>
 *   ...
 *   <script src="/assets/js/api.js"></script>
 *   <script src="/assets/js/admin-nav.js"></script>
 *
 * Clés data-active : dashboard | orders | products | analytics | custom | print3d | production
 */
(function () {
  const ITEMS = [
    { key: 'dashboard',  label: 'Tableau de bord',        icon: 'dashboard',     href: '/admin/dashboard.html' },
    { key: 'orders',     label: 'Commandes',              icon: 'shopping_cart', href: '/admin/orders.html' },
    { key: 'products',   label: 'Produits',               icon: 'inventory_2',   href: '/admin/products.html' },
    { key: 'analytics',  label: 'Analyses',               icon: 'analytics',     href: '/admin/analytics.html' },
    { key: 'custom',     label: 'Demandes perso',         icon: 'edit_note',     href: '/admin/custom-requests.html' },
    { key: 'print3d',    label: 'Demandes impression 3D', icon: '3d_rotation',   href: '/admin/print-requests.html' },
    { key: 'production', label: 'Atelier (production)',   icon: 'view_kanban',   href: '/admin/production-board.html' },
    { key: 'spools',     label: 'Stock bobines',          icon: 'database',      href: '/admin/spools.html' },
    { key: 'printers',   label: 'Machines 3D',            icon: 'print',         href: '/admin/printers.html' },
  ];

  function linkHtml(item, active) {
    const isActive = item.key === active;
    const cls = isActive
      ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-primary font-bold border-l-2 border-primary bg-primary/10 shadow-[0_0_15px_rgba(168,232,255,0.2)]'
      : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface-variant font-medium hover:bg-surface-variant/50 hover:text-on-surface transition-all duration-200';
    const fill = isActive ? " style=\"font-variation-settings: 'FILL' 1;\"" : '';
    return `<a class="${cls}" href="${item.href}">
      <span class="material-symbols-outlined text-lg"${fill}>${item.icon}</span>
      <span class="font-label-md text-label-md">${item.label}</span>
    </a>`;
  }

  function build(active) {
    return `<aside class="w-sidebar_width h-screen fixed left-0 top-0 bg-surface-container-low backdrop-blur-xl border-r border-outline-variant/20 shadow-lg flex flex-col py-gutter px-4 z-50">
      <a href="/admin/dashboard.html" class="flex items-center gap-3 mb-10 px-2">
        <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-[0_0_12px_rgba(0,212,255,0.3)]">
          <img src="/assets/images/logo-white.png" alt="Laserya.tn" class="w-full h-full object-cover"/>
        </div>
        <div>
          <h1 class="font-headline-sm text-headline-sm font-bold text-primary leading-none">Laserya.tn</h1>
          <p class="font-label-sm text-label-sm text-on-surface-variant opacity-70">Espace administration</p>
        </div>
      </a>
      <nav class="flex-1 overflow-y-auto space-y-1 pr-2">
        ${ITEMS.map(i => linkHtml(i, active)).join('')}
      </nav>
      <div class="mt-auto pt-6 border-t border-outline-variant/10">
        <a href="/index.html" target="_blank" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface-variant font-medium hover:bg-surface-variant/50 hover:text-on-surface transition-all duration-200 mb-1">
          <span class="material-symbols-outlined text-lg">storefront</span>
          <span class="font-label-md text-label-md">Voir la boutique</span>
        </a>
        <a id="admin-logout" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-error font-medium hover:bg-error/10 transition-colors cursor-pointer" href="#">
          <span class="material-symbols-outlined text-lg">logout</span>
          <span class="font-label-md text-label-md">Déconnexion</span>
        </a>
      </div>
    </aside>`;
  }

  function mount() {
    const placeholder = document.getElementById('admin-sidebar');
    if (!placeholder) return;
    const active = placeholder.getAttribute('data-active') || '';
    placeholder.outerHTML = build(active);
    const logout = document.getElementById('admin-logout');
    if (logout) logout.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.Auth && Auth.logout) Auth.logout();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
