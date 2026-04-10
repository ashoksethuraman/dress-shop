/** @type {import('tailwindcss').Config} */
// ─── THEME MASTER FILE ────────────────────────────────────────────────────────
// Change colors here → they reflect everywhere in the app automatically.
// All Tailwind classes (bg-brand, text-brand-dark, border-brand-border, etc.)
// and the CSS custom-properties in index.css both derive from these values.
// ──────────────────────────────────────────────────────────────────────────────
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand palette (edit these to re-theme the whole app) ──
        brand:             '#EEF2ED',   // light sage: navbar bg, active surfaces
        'brand-dark':      '#1a1a1a',   // jet black: all primary buttons & accents
        'brand-hover':     '#333333',   // dark grey: button hover state
        'brand-border':    '#738A6E',   // moss green: all borders, icon surrounds
        'brand-bg':        '#FFFFFF',   // white: page / app background
        // ── Semantic aliases (kept for Tailwind class compatibility) ──
        border:            '#738A6E',   // alias → brand-border (moss)
        bg:                '#FFFFFF',   // alias → brand-bg (white)
        // ── Text ──────────────────────────────────────────────────
        primary:           '#1a1a1a',   // main body text
        muted:             '#6b7280',   // secondary / placeholder text
        card:              '#ffffff',   // card / surface background
      },
      fontFamily: {
        sans:    ['"Poppins"', 'sans-serif'],
        display: ['"Poppins"', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateX(-50%) translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
        },
      },
      animation: {
        'fade-in':  'fade-in 0.2s ease-out both',
        'slide-up': 'slide-up 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};
