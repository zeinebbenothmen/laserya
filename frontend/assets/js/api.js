/**
 * api.js — Shared API helpers for Laserya.tn
 * All pages import this file.
 */

// URL relative : le navigateur la complète avec le domaine de la page en cours.
// → marche en local (http://localhost:3001/api) ET en ligne (https://ton-domaine/api)
// sans aucune config par environnement, car le serveur sert le site ET l'API.
const API_BASE = '/api';

// ── Auth ───────────────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('laserya_admin_token'),
  setToken: (t) => localStorage.setItem('laserya_admin_token', t),
  clearToken: () => localStorage.removeItem('laserya_admin_token'),
  isAdmin: () => !!localStorage.getItem('laserya_admin_token'),

  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Connexion échouée');
    Auth.setToken(data.token);
    return data;
  },

  logout() {
    Auth.clearToken();
    window.location.href = '/admin/dashboard.html';
  }
};


// Parse a response as JSON, but give a clear message if the server
// returned HTML (the classic "Unexpected token '<'" situation).
async function parseJsonResponse(res) {
  const ctype = res.headers.get('content-type') || '';
  if (!ctype.includes('application/json')) {
    await res.text().catch(() => '');
    throw new Error(
      "Le serveur backend n'a pas répondu en JSON. Vérifiez qu'il est bien démarré " +
      "(node backend/server.js) et ouvrez le site via http://localhost:3001 " +
      "(et non en double-cliquant le fichier .html ni via un autre port)."
    );
  }
  return res.json();
}

// ── Request helpers ────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const headers = { ...options.headers };
  const token = Auth.getToken();
  // N'écrase pas un Authorization déjà fourni (ex. token client pour passer commande).
  if (token && !headers['Authorization']) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Impossible de joindre le serveur backend (http://localhost:3001). Est-il démarré ?");
  }
  if (res.status === 401) {
    Auth.clearToken();
    window.location.href = '/admin/dashboard.html';
    return;
  }
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Erreur API');
  return data;
}

async function apiFormData(path, formData, method = 'POST') {
  const headers = {};
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: formData });
  } catch {
    throw new Error("Impossible de joindre le serveur backend (http://localhost:3001). Est-il démarré ?");
  }
  // Token absent/invalide/expiré → on nettoie et on renvoie vers la connexion (comme apiFetch).
  if (res.status === 401) {
    Auth.clearToken();
    window.location.href = '/admin/dashboard.html';
    return;
  }
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Erreur API');
  return data;
}

// ── Products ───────────────────────────────────────────────
const ProductsAPI = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/products${qs ? '?' + qs : ''}`);
  },
  getOne:   (id)  => apiFetch(`/products/${id}`),
  create:   (fd)  => apiFormData('/products', fd, 'POST'),
  update:   (id, fd) => apiFormData(`/products/${id}`, fd, 'PUT'),
  delete:   (id)  => apiFetch(`/products/${id}`, { method: 'DELETE' }),
  setFeatured: (id, featured) => apiFetch(`/products/${id}/featured`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: featured ? 1 : 0 }) }),
  getCategories: () => apiFetch('/products/categories')
};

// ── Orders ─────────────────────────────────────────────────
const OrdersAPI = {
  create:     (data)       => apiFetch('/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  getAll:     (params = {}) => apiFetch(`/orders?${new URLSearchParams(params)}`),
  getOne:     (id)          => apiFetch(`/orders/${id}`),
  track:      (id)          => apiFetch(`/orders/track/${id}`),
  setStatus:  (id, status)  => apiFetch(`/orders/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }),
  delete:     (id)          => apiFetch(`/orders/${id}`, { method: 'DELETE' })
};

// ── Custom Requests ────────────────────────────────────────
const CustomAPI = {
  create:    (fd)           => apiFormData('/custom-requests', fd, 'POST'),
  getAll:    (params = {})  => apiFetch(`/custom-requests?${new URLSearchParams(params)}`),
  setStatus: (id, status, notes) => apiFetch(`/custom-requests/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, notes }) }),
  delete:    (id)           => apiFetch(`/custom-requests/${id}`, { method: 'DELETE' })
};

// ── 3D Print ───────────────────────────────────────────────
const Print3DAPI = {
  create:    (fd)           => apiFormData('/3d-print', fd, 'POST'),
  estimate:  (opts)         => apiFetch('/3d-print/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) }),
  estimateAI:(fd)           => apiFormData('/3d-print/estimate/ai', fd, 'POST'),
  estimateLink:(data)       => apiFetch('/3d-print/estimate/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  commitEstimate: (id)      => apiFetch(`/3d-print/estimate/${encodeURIComponent(id)}/commit`, { method: 'POST' }),
  cancelEstimate: (id)      => apiFetch(`/3d-print/estimate/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getAll:    (params = {})  => apiFetch(`/3d-print?${new URLSearchParams(params)}`),
  setStatus: (id, status, price) => apiFetch(`/3d-print/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, estimated_price: price }) }),
  delete:    (id)           => apiFetch(`/3d-print/${id}`, { method: 'DELETE' })
};

// ── Spools (stock bobines) ─────────────────────────────────
const SpoolsAPI = {
  getAll:    (params = {})  => apiFetch(`/spools?${new URLSearchParams(params)}`),
  stats:     ()             => apiFetch('/spools/stats'),
  create:    (data)         => apiFetch('/spools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  update:    (id, data)     => apiFetch(`/spools/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  adjust:    (id, delta)    => apiFetch(`/spools/${id}/adjust`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta }) }),
  delete:    (id)           => apiFetch(`/spools/${id}`, { method: 'DELETE' })
};

// ── Imprimantes 3D (Bambu Lab) ─────────────────────────────
const PrintersAPI = {
  list:    ()        => apiFetch('/printers'),
  status:  ()        => apiFetch('/printers/status'),
  create:  (data)    => apiFetch('/printers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  update:  (id, data)=> apiFetch(`/printers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  delete:  (id)      => apiFetch(`/printers/${id}`, { method: 'DELETE' })
};

// ── Stats ──────────────────────────────────────────────────
const StatsAPI = {
  get:         () => apiFetch('/stats'),
  bestSellers: () => apiFetch('/stats/best-sellers')
};

// ── UI Helpers ─────────────────────────────────────────────
function showToast(message, type = 'success') {
  const colors = { success: '#22C55E', error: '#EF4444', info: '#C8A13A', warning: '#F59E0B' };
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:#111827; border:1px solid ${colors[type]}40;
    color:${colors[type]}; padding:12px 20px; border-radius:12px;
    font-family:Geist,sans-serif; font-size:14px; font-weight:500;
    box-shadow:0 0 20px ${colors[type]}20;
    display:flex; align-items:center; gap:8px;
    animation: slideIn .3s ease;
  `;
  const icon = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' }[type];
  toast.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">${icon}</span>${message}`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function formatPrice(price) {
  return `${Number(price).toFixed(0)} TND`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getCategoryLabel(cat) {
  const labels = {
    'led-lamps': 'Lampes LED', 'keychains': 'Porte-clés',
    '3d-figures': 'Figurines 3D', 'accessories': 'Accessoires',
    'gifts': 'Cadeaux', 'other': 'Autre'
  };
  return labels[cat] || cat;
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `@keyframes slideIn { from { transform: translateX(100px); opacity:0 } to { transform: translateX(0); opacity:1 } }`;
document.head.appendChild(style);
