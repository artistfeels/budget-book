/** @type {import('tailwindcss').Config} */
export default {
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
      },
    },
  },
  plugins: [],
}
