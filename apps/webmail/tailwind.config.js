/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#141414',
        'surface-2': '#1e1e1e',
        'surface-3': '#262626',
        border: 'rgba(255,255,255,0.08)',
        brand: {
          50: '#f4f4f5',
          100: '#e4e4e7',
          500: '#ffffff',
          600: '#e5e5e5',
          700: '#d4d4d8',
          900: '#0a0a0a',
        },
      },
    },
  },
  plugins: [],
};
