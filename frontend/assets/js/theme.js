/* ============================================================
   Laserya — Thème CLAIR « Noir & Or » (boutique)
   Réassigne entièrement tailwind.config : ces valeurs écrasent
   le bloc inline de chaque page (chargé avant ce fichier).
   Un seul endroit à modifier pour toute la boutique.
   ============================================================ */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Fonds clairs (ivoire chaud) + cartes blanches
        "background": "#FAF8F4",
        "surface": "#FFFFFF",
        "surface-card": "#FFFFFF",
        "surface-dim": "#F0EBE1",
        "surface-bright": "#FFFFFF",
        "surface-medium": "#F2EEE6",
        "surface-tint": "#B58A1E",
        "surface-variant": "#EDE8DD",
        "surface-container-lowest": "#FFFFFF",
        "surface-container-low": "#F8F5EF",
        "surface-container": "#F3EFE7",
        "surface-container-high": "#ECE7DC",
        "surface-container-highest": "#E5DFD1",
        // surface-deep servait d'ancrage SOMBRE (header, bandes, footer).
        // On le passe en CLAIR pour un rendu cohérent ; le pied de page
        // est repassé en noir séparément via theme.css (footer{}).
        "surface-deep": "#FFFFFF",

        // Texte
        "text-primary": "#1A150C",
        "text-secondary": "#6B6358",
        "on-surface": "#1A150C",
        "on-surface-variant": "#5F584C",
        "on-background": "#1A150C",

        // Contours / verre
        "border-glass": "rgba(20,17,12,0.08)",
        "outline": "#8A8174",
        "outline-variant": "#D9D2C4",
        "inverse-surface": "#2A2418",
        "inverse-on-surface": "#F3EFE7",
        "inverse-primary": "#E8C766",

        // Accent OR (lisible comme texte ET comme fond de bouton)
        "primary": "#8A6A12",
        "on-primary": "#FFFFFF",
        "primary-container": "#14110C",
        "on-primary-container": "#E8C766",
        "primary-fixed": "#F1E4BF",
        "primary-fixed-dim": "#D8B453",
        "on-primary-fixed": "#2A2007",
        "on-primary-fixed-variant": "#6B5310",

        // Secondaire : gris chaud neutre (badges discrets)
        "secondary": "#5F584C",
        "on-secondary": "#FFFFFF",
        "secondary-container": "#EDE8DD",
        "on-secondary-container": "#4A4438",
        "secondary-fixed": "#ECE7DD",
        "secondary-fixed-dim": "#D9D2C4",
        "on-secondary-fixed": "#2A2418",
        "on-secondary-fixed-variant": "#4A4438",

        // Tertiaire : or
        "tertiary": "#B58A1E",
        "on-tertiary": "#FFFFFF",
        "tertiary-container": "#F7ECCB",
        "on-tertiary-container": "#5A4410",
        "tertiary-fixed": "#EAD9A8",
        "tertiary-fixed-dim": "#D8B453",
        "on-tertiary-fixed": "#2A2007",
        "on-tertiary-fixed-variant": "#6B5310",

        // États
        "success": "#15803D",
        "warning": "#B45309",
        "error": "#B91C1C",
        "on-error": "#FFFFFF",
        "error-container": "#FEE2E2",
        "on-error-container": "#7F1D1D"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "card-padding": "24px",
        "section-gap": "80px",
        "container-max-width": "1280px",
        "base": "8px",
        "gutter": "24px"
      },
      "fontFamily": {
        "label-sm": ["Geist"], "body-md": ["Geist"], "headline-md": ["Sora"],
        "label-md": ["Geist"], "body-lg": ["Geist"], "display-lg-mobile": ["Sora"],
        "display-lg": ["Sora"], "headline-sm": ["Sora"]
      },
      "fontSize": {
        "label-sm": ["12px", {"lineHeight": "1", "fontWeight": "600"}],
        "body-md": ["16px", {"lineHeight": "1.5", "fontWeight": "400"}],
        "headline-md": ["32px", {"lineHeight": "1.2", "fontWeight": "700"}],
        "label-md": ["14px", {"lineHeight": "1", "letterSpacing": "0.05em", "fontWeight": "500"}],
        "body-lg": ["18px", {"lineHeight": "1.6", "fontWeight": "400"}],
        "display-lg-mobile": ["36px", {"lineHeight": "1.2", "fontWeight": "800"}],
        "display-lg": ["48px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "800"}],
        "headline-sm": ["24px", {"lineHeight": "1.3", "fontWeight": "600"}]
      }
    }
  }
};
