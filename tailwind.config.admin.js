/** Config Tailwind — PAGES ADMIN (espace administration)
 *  Reproduit la config inline historique des pages admin (échelle 18px,
 *  rayons plus petits, tokens d'espacement sidebar/topbar…).
 *  Build : voir package.json → "build:css:admin".
 */
module.exports = {
  darkMode: 'class',
  content: [
    './frontend/admin/**/*.html',
    './frontend/assets/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        'surface-container-high': '#272a30', 'on-surface': '#e0e2ea', 'surface-variant': '#32353b',
        'on-tertiary-fixed': '#141b2b', 'inverse-surface': '#e0e2ea', 'surface-container-highest': '#32353b',
        'on-error': '#690005', 'outline': '#859398', 'primary-fixed': '#b4ebff', 'on-error-container': '#ffdad6',
        'inverse-primary': '#00677e', 'outline-variant': '#3c494e', 'on-surface-variant': '#bbc9cf',
        'surface-tint': '#3cd7ff', 'tertiary-fixed': '#dce2f7', 'surface-bright': '#36393f',
        'surface-container-lowest': '#0b0e13', 'secondary-fixed-dim': '#d0bcff', 'primary-container': '#00d4ff',
        'on-background': '#e0e2ea', 'on-primary': '#003642', 'tertiary': '#d8def3', 'inverse-on-surface': '#2d3036',
        'secondary': '#d0bcff', 'surface-container': '#1d2025', 'on-secondary-container': '#c4abff',
        'on-secondary-fixed': '#23005c', 'on-tertiary-fixed-variant': '#404758', 'on-primary-fixed-variant': '#004e5f',
        'tertiary-fixed-dim': '#c0c6db', 'on-primary-container': '#00586b', 'background': '#101419',
        'error-container': '#93000a', 'primary': '#a8e8ff', 'surface-container-low': '#181c21',
        'secondary-fixed': '#e9ddff', 'surface-dim': '#101419', 'on-primary-fixed': '#001f27', 'error': '#ffb4ab',
        'primary-fixed-dim': '#3cd7ff', 'on-secondary-fixed-variant': '#5516be', 'on-secondary': '#3c0091',
        'tertiary-container': '#bcc2d7', 'secondary-container': '#571bc1', 'surface': '#101419',
        'on-tertiary': '#293040', 'on-tertiary-container': '#495061',
        // Présents dans le HTML admin mais absents de la config inline → ajoutés pour fidélité.
        'success': '#22C55E', 'warning': '#F59E0B', 'surface-card': '#161B22', 'surface-medium': '#111827',
      },
      borderRadius: { DEFAULT: '0.125rem', lg: '0.25rem', xl: '0.5rem', full: '0.75rem' },
      spacing: {
        'gutter': '24px', 'stack_xs': '4px', 'topbar_height': '64px', 'sidebar_collapsed': '72px',
        'stack_lg': '24px', 'stack_md': '16px', 'sidebar_width': '260px', 'stack_sm': '8px',
        'container_padding': '32px',
      },
      fontFamily: {
        'headline-sm': ['Sora'], 'label-md': ['Geist'], 'body-md': ['Geist'], 'headline-md': ['Sora'],
        'label-sm': ['Geist'], 'mono-ui': ['Geist'], 'body-sm': ['Geist'], 'display-lg': ['Sora'], 'body-lg': ['Geist'],
      },
      fontSize: {
        'headline-sm': ['18px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '600' }],
        'label-md': ['12px', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '600' }],
        'body-md': ['14px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
        'headline-md': ['24px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'label-sm': ['11px', { lineHeight: '1', letterSpacing: '0.03em', fontWeight: '500' }],
        'mono-ui': ['13px', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '500' }],
        'body-sm': ['13px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
        'display-lg': ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'body-lg': ['16px', { lineHeight: '1.6', letterSpacing: '0', fontWeight: '400' }],
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
