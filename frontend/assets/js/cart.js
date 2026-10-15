/**
 * cart.js — Panier client en localStorage
 */

const Cart = {
  STORAGE_KEY: 'laserya_cart',

  getAll() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || []; }
    catch { return []; }
  },

  save(items) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
    this._updateBadge();
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: items }));
  },

  add(product, quantity = 1, customOptions = {}) {
    const items = this.getAll();
    const key = customOptions.customKey || product.id;
    const existing = items.find(i => i.cartKey === key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        cartKey: key,
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        quantity,
        customOptions
      });
    }
    this.save(items);
    return items;
  },

  remove(cartKey) {
    const items = this.getAll().filter(i => i.cartKey !== cartKey);
    this.save(items);
  },

  updateQty(cartKey, quantity) {
    const items = this.getAll();
    const item = items.find(i => i.cartKey === cartKey);
    if (item) {
      if (quantity <= 0) return this.remove(cartKey);
      item.quantity = quantity;
      this.save(items);
    }
  },

  clear() {
    this.save([]);
  },

  count() {
    return this.getAll().reduce((sum, i) => sum + i.quantity, 0);
  },

  subtotal() {
    return this.getAll().reduce((sum, i) => sum + i.price * i.quantity, 0);
  },

  _updateBadge() {
    const count = this.count();
    document.querySelectorAll('[data-cart-badge]').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });
  },

  init() {
    this._updateBadge();
    window.addEventListener('storage', () => this._updateBadge());
  }
};

// Auto-init on load
Cart.init();

/**
 * Wishlist — favoris client en localStorage (liste d'IDs produits).
 */
const Wishlist = {
  KEY: 'laserya_wishlist',
  all()   { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch { return []; } },
  has(id) { return this.all().includes(String(id)); },
  toggle(id) {
    id = String(id);
    let a = this.all();
    a = a.includes(id) ? a.filter(x => x !== id) : [...a, id];
    localStorage.setItem(this.KEY, JSON.stringify(a));
    window.dispatchEvent(new CustomEvent('wishlist:updated', { detail: a }));
    return this.has(id);
  },
  remove(id) {
    localStorage.setItem(this.KEY, JSON.stringify(this.all().filter(x => x !== String(id))));
    window.dispatchEvent(new CustomEvent('wishlist:updated'));
  },
  count() { return this.all().length; },
};
