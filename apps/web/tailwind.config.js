/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        bg: '#0A0A14',
        surface: '#13131C',
        'surface-2': '#1a1a28',
        'surface-hover': '#1f1f30',
        'accent-violet': '#7C3AED',
        'accent-violet-light': '#A855F7',
        'accent-teal': '#0EA5E9',
        'accent-teal-bright': '#22D3EE',
        'text-primary': '#F5F5F7',
        'text-muted': '#9A9AA5',
        'text-faint': '#5A5A6A',
        'border': 'rgba(255,255,255,0.08)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7C3AED 0%, #0EA5E9 100%)',
        'brand-gradient-warm': 'linear-gradient(135deg, #A855F7 0%, #06B6D4 100%)',
        'shimmer': 'linear-gradient(135deg, #7C3AED 0%, #0EA5E9 50%, #7C3AED 100%)',
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease both',
        'slide-up': 'slide-up 0.6s ease both',
        'slide-down': 'slide-down 0.4s ease both',
        'scale-in': 'scale-in 0.4s ease both',
        'float': 'float 4s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2.5s ease-in-out infinite',
        'spin-slow': 'spin-slow 8s linear infinite',
        'orb-pulse': 'orb-pulse 6s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-down': { from: { opacity: '0', transform: 'translateY(-12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.94)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'float': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        'glow-pulse': { '0%,100%': { boxShadow: '0 0 20px rgba(124,58,237,0.3)' }, '50%': { boxShadow: '0 0 40px rgba(124,58,237,0.5),0 0 80px rgba(34,211,238,0.2)' } },
        'spin-slow': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        'orb-pulse': { '0%,100%': { opacity: '0.18', transform: 'scale(1)' }, '50%': { opacity: '0.28', transform: 'scale(1.06)' } },
        'shimmer': { '0%': { backgroundPosition: '-200% center' }, '100%': { backgroundPosition: '200% center' } },
      },
      boxShadow: {
        'glow-violet': '0 0 20px rgba(124,58,237,0.3), 0 0 60px rgba(124,58,237,0.1)',
        'glow-teal': '0 0 20px rgba(34,211,238,0.3), 0 0 60px rgba(34,211,238,0.1)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
