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
        // Solid (non-translucent) card background for modals/popups that need
        // more contrast than the translucent `.glass` utility gives — was
        // referenced as `bg-surface-card` in several places (catalog page
        // modals, the AI-subscription popup) without ever being defined,
        // so those elements silently got no background color at all.
        'surface-card': '#14141f',
        'accent-violet': '#7C3AED',
        'accent-violet-light': '#A855F7',
        'accent-violet-bright': '#C084FC',
        'accent-teal': '#0EA5E9',
        'accent-teal-bright': '#22D3EE',
        'text-primary': '#F5F5F7',
        'text-muted': '#9A9AA5',
        'text-faint': '#5A5A6A',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7C3AED 0%, #0EA5E9 100%)',
        'brand-gradient-warm': 'linear-gradient(135deg, #A855F7 0%, #06B6D4 100%)',
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease both',
        'slide-up': 'slide-up 0.5s ease both',
        'scale-in': 'scale-in 0.3s ease both',
        'glow-pulse': 'glow-pulse 2.5s ease-in-out infinite',
        'spin-slow': 'spin-slow 6s linear infinite',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'glow-pulse': { '0%,100%': { boxShadow: '0 0 20px rgba(124,58,237,0.3)' }, '50%': { boxShadow: '0 0 40px rgba(124,58,237,0.5)' } },
        'spin-slow': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
      },
      boxShadow: {
        'glow-violet': '0 0 20px rgba(124,58,237,0.3), 0 0 60px rgba(124,58,237,0.1)',
        'glow-teal': '0 0 20px rgba(34,211,238,0.3), 0 0 60px rgba(34,211,238,0.1)',
        // Soft elevation shadow for modals/popovers — referenced as
        // `shadow-card` by the shared Modal component in ui.tsx, but never
        // defined, so every modal in the app has been missing it silently.
        card: '0 20px 60px -15px rgba(0,0,0,0.55), 0 0 1px rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [],
};
