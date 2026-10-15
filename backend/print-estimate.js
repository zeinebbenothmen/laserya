/**
 * print-estimate.js — Estimation du prix d'une impression 3D « par type de produit ».
 *
 * Le client décrit son produit (type, taille, niveau de détail, nb de couleurs,
 * quantité) après avoir envoyé une photo / un modèle. On en déduit une FOURCHETTE
 * de prix raisonnable et rentable. L'atelier confirme ensuite le prix final.
 *
 * Tarifs calés sur le CATALOGUE laserya.fr :
 *   • Porte-clés : simple ~12, courant ~20, bois gravé ~25.
 *   • Figurines  : petite (anime/héros) ~25, détaillée/complexe ≥ 85.
 *   • Déco       : ~22 (petite) à ~80 (grande détaillée).
 *
 * Règles propriétaire :
 *   • Pièce DÉTAILLÉE / COMPLIQUÉE (figurine, modèle MakerWorld, résine) ⇒ plancher 85 TND.
 *   • Petite pièce simple ⇒ reste bon marché (pas de plancher 85).
 *   • La LIVRAISON est INCLUSE dans le prix (livraison gratuite partout).
 *
 * Tous les tarifs (en TND) sont AJUSTABLES ci-dessous. Une seule source de vérité :
 * utilisée par l'endpoint /estimate ET par la création de demande.
 */

// ── Tarifs par type de produit (TND, livraison incluse) ────────────
// base = prix de départ (petite pièce simple, 1 couleur) ; size = supplément selon la taille.
// bulkUnit50 = prix unitaire imposé à partir de 50 pièces (grosse commande).
// complexFloor = true ⇒ ce type peut atteindre le plancher « pièce détaillée » (85 TND).
const TYPES = {
  keychain: { label: 'Porte-clés',          base: 8,  size: { small: 0, medium: 12, large: 20 }, bulkUnit50: 2, min: 6,  complexFloor: false },
  figurine: { label: 'Figurine',            base: 25, size: { small: 0, medium: 25, large: 60 }, min: 25, complexFloor: true  },
  deco:     { label: 'Objet déco / vase',   base: 22, size: { small: 0, medium: 23, large: 58 }, min: 15, complexFloor: true  },
  part:     { label: 'Pièce / prototype',   base: 14, size: { small: 0, medium: 18, large: 50 }, min: 10, complexFloor: true  },
  other:    { label: 'Autre',               base: 16, size: { small: 0, medium: 22, large: 55 }, min: 10, complexFloor: true  },
};

const DETAIL_MULT = 1.30; // « détaillé »
const COLOR_MULT  = 1.25; // « plusieurs couleurs »
const RESIN_MULT  = 1.25; // résine (haute définition)

// Plancher « pièce détaillée / compliquée » (figurine, modèle MakerWorld, résine).
// Ne s'applique JAMAIS aux petites pièces (size = small) ni aux porte-clés.
const COMPLEX_MIN = 85;

// Remise quantité (sauf règle spéciale type.bulkUnit50)
function bulkFactor(qty) {
  if (qty >= 50) return 0.75;
  if (qty >= 25) return 0.82;
  if (qty >= 10) return 0.90;
  return 1;
}

function truthy(v) { return v === true || v === 1 || v === '1' || v === 'true'; }

const SIZE_LABELS = { small: 'Petite', medium: 'Moyenne', large: 'Grande' };

/**
 * @param {object} o
 * @param {string} o.type        keychain | figurine | deco | part | other
 * @param {string} o.size        small | medium | large
 * @param {boolean} o.detailed   produit détaillé ?
 * @param {boolean} o.multicolor plusieurs couleurs ?
 * @param {string} o.material    PLA | PETG | Resin
 * @param {number} o.quantity    ≥ 1
 * @returns {{unit,price,low,high,range,typeLabel,sizeLabel,currency}}
 */
function computeEstimate(o = {}) {
  const type = TYPES[o.type] ? o.type : 'other';
  const t    = TYPES[type];
  const size = ['small', 'medium', 'large'].includes(o.size) ? o.size : 'medium';
  const qty  = Math.max(1, parseInt(o.quantity) || 1);
  const detailed   = truthy(o.detailed);
  const multicolor = truthy(o.multicolor);

  // Prix unitaire de base (selon type + taille + options)
  let unit = t.base + (t.size[size] ?? t.size.medium);
  if (detailed)   unit *= DETAIL_MULT;
  if (multicolor) unit *= COLOR_MULT;
  if (o.material === 'Resin') unit *= RESIN_MULT;
  unit = Math.max(t.min, unit);

  // Plancher « pièce détaillée / compliquée » (figurine, modèle MakerWorld, résine).
  // Jamais sur une petite pièce ni sur un porte-clés (qui restent bon marché).
  const complex = detailed || o.material === 'Resin';
  if (t.complexFloor && complex && size !== 'small') {
    unit = Math.max(unit, COMPLEX_MIN);
  }

  // Quantité : règle spéciale (grosse commande) sinon remise dégressive
  let appliedUnit;
  if (t.bulkUnit50 && qty >= 50) appliedUnit = t.bulkUnit50;
  else                           appliedUnit = unit * bulkFactor(qty);

  const total = appliedUnit * qty;
  const low   = Math.round(total * 0.9);
  const high  = Math.round(total * 1.1);

  return {
    unit:      Math.round(appliedUnit * 10) / 10,
    price:     Math.round(total),
    low,
    high,
    range:     low === high ? `${low}` : `${low}–${high}`,
    typeLabel: t.label,
    sizeLabel: SIZE_LABELS[size],
    currency:  'TND',
    deliveryIncluded: true, // livraison gratuite : déjà comprise dans le prix
  };
}

const TYPE_LABELS = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.label]));

module.exports = { computeEstimate, TYPE_LABELS, SIZE_LABELS };
