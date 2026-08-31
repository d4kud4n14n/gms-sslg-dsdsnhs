/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#dfeeff',
          200: '#bfdcff',
          300: '#8ec1ff',
          400: '#5aa5ff',
          500: '#2d7df6',
          600: '#175ed9',
          700: '#164eb3',
          800: '#173f8d',
          900: '#1a376e',
        },
        slate: {
          950: '#0b1220',
        },
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)',
        glow: '0 16px 40px rgba(45, 125, 246, 0.18)',
      },
      borderRadius: {
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
