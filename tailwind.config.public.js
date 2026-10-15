/** Config Tailwind — PAGES PUBLIQUES (boutique, accueil, tunnel d'achat…)
 *  Reproduit la config inline historique des pages publiques (échelle 24px).
 *  Build : voir package.json → "build:css:public".
 */
module.exports = {
  darkMode: 'class',
  // On scanne tout le HTML public + le JS partagé pour ne purger aucune classe utilisée
  // (y compris celles construites dynamiquement en JS).
  content: [
    './frontend/index.html',
    './frontend/pages/**/*.html',
    './frontend/assets/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        'text-secondary': '#A1A1AA', 'primary-fixed-dim': '#B58A1E', 'on-tertiary': '#432c00',
        'on-primary': '#FFFFFF', 'error-container': '#93000a', 'background': '#101419',
        'on-tertiary-container': '#6c4900', 'on-secondary-fixed-variant': '#5516be',
        'on-surface-variant': '#bbc9cf', 'border-glass': 'rgba(255, 255, 255, 0.08)',
        'inverse-on-surface': '#2d3036', 'surface-deep': '#070A0F', 'on-primary-fixed': '#1A150C',
        'tertiary-fixed': '#ffdeae', 'text-primary': '#FFFFFF', 'on-error-container': '#ffdad6',
        'inverse-primary': '#C8A13A', 'surface-container': '#1d2025', 'on-primary-container': '#FFFFFF',
        'on-secondary': '#3c0091', 'surface-container-lowest': '#0b0e13', 'on-error': '#690005',
        'success': '#22C55E', 'inverse-surface': '#e0e2ea', 'surface-variant': '#32353b',
        'on-primary-fixed-variant': '#604100', 'primary-fixed': '#C8A13A', 'on-secondary-container': '#c4abff',
        'secondary-container': '#571bc1', 'on-background': '#e0e2ea', 'surface-card': '#161B22',
        'surface': '#101419', 'on-secondary-fixed': '#23005c', 'primary': '#8A6A12', 'error': '#EF4444',
        'surface-tint': '#8A6A12', 'surface-dim': '#101419', 'secondary': '#d0bcff',
        'surface-container-high': '#272a30', 'secondary-fixed': '#e9ddff', 'on-tertiary-fixed-variant': '#604100',
        'surface-container-highest': '#32353b', 'on-tertiary-fixed': '#281900', 'tertiary-fixed-dim': '#ffba3d',
        'on-surface': '#e0e2ea', 'outline': '#859398', 'surface-bright': '#36393f', 'warning': '#F59E0B',
        'tertiary-container': '#feb528', 'outline-variant': '#3c494e', 'surface-medium': '#111827',
        'secondary-fixed-dim': '#d0bcff', 'tertiary': '#ffd9a1', 'surface-container-low': '#181c21',
        'primary-container': '#8A6A12',
      },
      borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', full: '9999px' },
      spacing: {
        'card-padding': '24px', 'section-gap': '80px', 'container-max-width': '1280px',
        'base': '8px', 'gutter': '24px',
      },
      fontFamily: {
        'label-sm': ['Geist'], 'body-md': ['Geist'], 'headline-md': ['Sora'], 'label-md': ['Geist'],
        'body-lg': ['Geist'], 'display-lg-mobile': ['Sora'], 'display-lg': ['Sora'], 'headline-sm': ['Sora'],
      },
      fontSize: {
        'label-sm': ['12px', { lineHeight: '1', fontWeight: '600' }],
        'body-md': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'headline-md': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        'label-md': ['14px', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '500' }],
        'body-lg': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        'display-lg-mobile': ['36px', { lineHeight: '1.2', fontWeight: '800' }],
        'display-lg': ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'headline-sm': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
