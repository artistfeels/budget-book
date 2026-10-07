/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      colors: {
        income: '#2563eb',
        spending: '#e11d48',
        saving: '#059669',
        // Single accent used for UI chrome (nav, buttons, focus). Warm amber taken from the coin
        // app icon, and deliberately a different hue from income/spending/saving above: those
        // carry financial meaning, so "tappable" must never look like "income" (the old Apple-blue
        // accent was nearly the same color as income). DEFAULT clears 4.5:1 on white; `light` is
        // the dark-mode variant and needs dark text when used as a fill.
        accent: {
          DEFAULT: '#b45309',
          light: '#fbbf24',
          dark: '#92400e',
        },
        // Page background vs. the raised card surface sitting on it. Two steps, not one, so cards
        // read as lifted panes in both modes instead of blending into the page.
        canvas: {
          light: '#f5f5f7',
          dark: '#0a0a0b',
        },
        surface: {
          light: '#ffffff',
          dark: '#161618',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      transitionTimingFunction: {
        // Decelerating "settle" curve — the standard for UI that should feel physical rather
        // than linear. Used for every entrance animation and hover transition in the app.
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Bottom-sheet entrance — the phone-side counterpart to slide-in-right's drawer.
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      // Entrances run slow enough to read as a settle rather than a blink; the spring curve still
      // front-loads most of the movement, so content is legible well before the animation ends.
      animation: {
        'fade-up': 'fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.6s ease-out both',
        'scale-in': 'scale-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-right': 'slide-in-right 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
