/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
      },
      colors: {
        income: '#2563eb',
        spending: '#e11d48',
        saving: '#059669',
        // Single accent used for UI chrome (nav, buttons, focus, icon) — kept distinct from the
        // income/spending/saving colors above, which carry financial meaning, not brand identity.
        accent: {
          DEFAULT: '#0ea5e9',
          light: '#38bdf8',
          dark: '#0284c7',
        },
      },
    },
  },
  plugins: [],
}
