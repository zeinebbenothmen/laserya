/**
 * checkout.js — Partage les données entre les étapes du tunnel de commande
 * Stockage en sessionStorage pour la durée de la session.
 */

const CHECKOUT_KEY = 'laserya_checkout';

const Checkout = {
  get() {
    try { return JSON.parse(sessionStorage.getItem(CHECKOUT_KEY)) || {}; }
    catch { return {}; }
  },
  set(data) {
    const current = this.get();
    sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify({ ...current, ...data }));
  },
  clear() { sessionStorage.removeItem(CHECKOUT_KEY); },

  // Step helpers
  setInfo(info)     { this.set({ info }); },
  setDelivery(d)    { this.set({ delivery: d }); },
  setPayment(p)     { this.set({ payment: p }); },
  getInfo()         { return this.get().info || {}; },
  getDelivery()     { return this.get().delivery || { method: 'home', cost: 0, label: 'Livraison à domicile (gratuite)' }; },
  getPayment()      { return this.get().payment || { method: 'cash', label: 'Paiement à la livraison' }; },

  // Build order payload for API
  buildOrder(cartItems) {
    const info     = this.getInfo();
    const delivery = this.getDelivery();
    const payment  = this.getPayment();
    return {
      customer_name:    `${info.firstName || ''} ${info.lastName || ''}`.trim() || info.phone,
      customer_phone:   info.phone    || '',
      customer_email:   info.email    || '',
      customer_address: `${info.address || ''}, ${info.city || ''}`.trim().replace(/^,\s*/, ''),
      delivery_method:  delivery.method,
      payment_method:   payment.method,
      items: cartItems.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, image_url: i.image_url, customOptions: i.customOptions || {} })),
      notes: info.notes || ''
    };
  }
};

// Livraison gratuite (tous modes à 0).
const DELIVERY_OPTIONS = [
  { method: 'home',    label: 'Livraison à domicile',  cost: 0,  days: '2-4 jours' },
  { method: 'pickup',  label: "Retrait à l'atelier",   cost: 0,  days: '1-2 jours' },
];

// Un seul moyen de paiement : à la livraison (cash).
const PAYMENT_OPTIONS = [
  { method: 'cash',     label: 'Paiement à la livraison' },
];
