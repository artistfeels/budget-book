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
        // Single accent used for UI chrome (nav, buttons, focus, icon) — kept distinct from the
        // income/spending/saving colors above, which carry financial meaning, not brand identity.
        accent: {
          DEFAULT: '#0071e3',
          light: '#0a84ff',
          dark: '#0058b0',
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
      },
      animation: {
        'fade-up': 'fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-right': 'slide-in-right 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
