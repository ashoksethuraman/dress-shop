/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:  '#0f172a',
        accent:   '#6366f1',
        'accent-light': '#818cf8',
        muted:    '#64748b',
        border:   '#e2e8f0',
        bg:       '#f8fafc',
        card:     '#ffffff',
      },
      fontFamily: {
        sans: ['Sora', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
