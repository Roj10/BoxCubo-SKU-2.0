import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Escala completa da marca gerada de #da8301 (laranja Box Cubo)
        brand: {
          50: '#fdf8ef',
          100: '#faeed7',
          200: '#f4daae',
          300: '#edc17b',
          400: '#e5a246',
          500: '#da8301',
          600: '#c06f04',
          700: '#9d5807',
          800: '#7f460c',
          900: '#683a0f',
          950: '#3b1e06',
          orange: '#da8301', // alias legado
          dark: '#26211a', // grafite morno (tingido com o hue da marca)
        },
        // Neutros quentes: mesmo hue do laranja com croma mínimo — a UI inteira
        // "pertence" à marca sem usar laranja em lugar nenhum
        neutral: {
          50: '#fafaf8',
          100: '#f4f3f0',
          200: '#e7e5e0',
          300: '#d5d2cb',
          400: '#a5a199',
          500: '#79756c',
          600: '#5d5950',
          700: '#464239',
          800: '#32302a',
          900: '#211f1a',
          950: '#161410',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'card-in': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'card-in': 'card-in 180ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config
