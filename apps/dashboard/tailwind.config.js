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
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      colors: {
        // ── CSS Variable-backed theme tokens ──
        // These work with both dark & light themes via data-theme attribute
        bg:               'var(--color-bg)',
        'bg-raised':      'var(--color-bg-raised)',
        surface:          'var(--color-surface)',
        'surface-2':      'var(--color-surface-2)',
        'surface-3':      'var(--color-surface-3)',
        'surface-hover':  'var(--color-surface-hover)',
        'surface-active': 'var(--color-surface-active)',

        border:           'var(--color-border)',
        'border-subtle':  'var(--color-border-subtle)',
        'border-strong':  'var(--color-border-strong)',

        'text-primary':   'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted':     'var(--color-text-muted)',
        'text-faint':     'var(--color-text-faint)',

        accent:           'var(--color-accent)',
        'accent-hover':   'var(--color-accent-hover)',
        'accent-subtle':  'var(--color-accent-subtle)',
        'accent-border':  'var(--color-accent-border)',

        success:          'var(--color-success)',
        'success-bg':     'var(--color-success-bg)',
        'success-border': 'var(--color-success-border)',
        warning:          'var(--color-warning)',
        'warning-bg':     'var(--color-warning-bg)',
        'warning-border': 'var(--color-warning-border)',
        danger:           'var(--color-danger)',
        'danger-bg':      'var(--color-danger-bg)',
        'danger-border':  'var(--color-danger-border)',
        info:             'var(--color-info)',
        'info-bg':        'var(--color-info-bg)',
        'info-border':    'var(--color-info-border)',

        'sidebar-bg':     'var(--sidebar-bg)',
        'sidebar-border': 'var(--sidebar-border)',
        'card-bg':        'var(--card-bg)',
        'card-border':    'var(--card-border)',
        'input-bg':       'var(--input-bg)',
        'input-border':   'var(--input-border)',

        // ── Legacy aliases (kept for existing components) ──
        // These previously had hard-coded dark values; now they map to tokens
        'accent-violet':        '#2563eb',
        'accent-violet-light':  '#60a5fa',
        'accent-violet-bright': '#93c5fd',
        'accent-teal':          '#3b82f6',
        'accent-teal-bright':   '#60a5fa',
      },
      backgroundImage: {
        'brand-gradient':        'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
        'brand-gradient-subtle': 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(59,130,246,0.12) 100%)',
      },
      borderRadius: {
        'sm':  '6px',
        'md':  '8px',
        'lg':  '12px',
        'xl':  '16px',
        '2xl': '20px',
      },
      spacing: {
        'sidebar':           '256px',
        'sidebar-collapsed': '64px',
      },
      boxShadow: {
        'card':       'var(--card-shadow)',
        'card-hover': 'var(--card-shadow-hover)',
        'glow-accent': '0 0 20px rgba(59,130,246,0.25)',
      },
      animation: {
        'fade-in':        'fade-in 0.35s ease both',
        'fade-out':       'fade-out 0.25s ease both',
        'slide-up':       'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-down':     'slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left':  'slide-in-left 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slide-in-right 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in':       'scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-dot':      'pulse-dot 2s ease-in-out infinite',
        'toast-enter':    'toast-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'toast-exit':     'toast-exit 0.25s ease both',
        'progress':       'progress-indeterminate 1.5s ease-in-out infinite',
        // Legacy names kept for compatibility
        'glow-pulse':     'none',
        'shimmer':        'none',
        'spin-slow':      'spin-base 6s linear infinite',
        'bounce-in':      'scale-in 0.3s ease both',
        'tab-indicator':  'fade-in 0.2s ease both',
        'counter':        'fade-in 0.3s ease both',
        'sheet-up':       'slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        'fade-in':        { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out':       { from: { opacity: '1' }, to: { opacity: '0' } },
        'slide-up':       { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-down':     { from: { opacity: '0', transform: 'translateY(-12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-left':  { from: { opacity: '0', transform: 'translateX(-16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'slide-in-right': { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'scale-in':       { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'pulse-dot':      { '0%,100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.5', transform: 'scale(0.75)' } },
        'spin-base':      { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        'toast-enter':    { from: { opacity: '0', transform: 'translateX(100%) scale(0.96)' }, to: { opacity: '1', transform: 'translateX(0) scale(1)' } },
        'toast-exit':     { from: { opacity: '1', transform: 'translateX(0) scale(1)' }, to: { opacity: '0', transform: 'translateX(100%) scale(0.96)' } },
        'progress-indeterminate': { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(400%)' } },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
