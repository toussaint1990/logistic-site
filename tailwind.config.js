/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef5ff',
          100: '#d9e7ff',
          200: '#b0caff',
          300: '#84acff',
          400: '#4d87ff',
          500: '#0B5FFF',   // primary
          600: '#0a52db',
          700: '#0a45b6',
          800: '#0a3891',
          900: '#092b6d',
        },
        accent: {
          500: '#00C2A8',
          600: '#00a892',
        }
      }
    },
  },
  plugins: [],
};