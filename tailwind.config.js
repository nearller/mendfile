/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff8ff',
          100: '#dbefff',
          200: '#bfe3ff',
          300: '#93d2ff',
          400: '#60b7ff',
          500: '#3b94ff',
          600: '#2575f5',
          700: '#1e60e0',
          800: '#1f4fb4',
          900: '#1f448e',
        },
      },
      boxShadow: {
        card: '0 6px 24px -8px rgba(31, 70, 142, 0.18)',
      },
    },
  },
  plugins: [],
};
