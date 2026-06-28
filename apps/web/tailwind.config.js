/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        carto: {
          bg: '#F8F5F0',
          panel: '#FFFFFF',
          panelSoft: '#FBFAF7',
          border: '#E7E0D6',
          text: '#25211D',
          muted: '#756D64',
          faint: '#A99F94',
        },
        blaze: {
          50: '#FFF1EF',
          100: '#FFE1DD',
          200: '#FFC9C2',
          300: '#FFA99E',
          400: '#FF7A68',
          500: '#F04B37',
          600: '#D93827',
          700: '#B92E21',
        },
        grape: {
          50: '#F5F1FF',
          100: '#E9DDFF',
          200: '#D4C4FF',
          300: '#B8A0FF',
          400: '#9678FF',
          500: '#7B5CFF',
          600: '#6548E8',
          700: '#4F35BE',
        },
        severity: {
          info: '#3B82F6',
          low: '#22C55E',
          medium: '#F59E0B',
          high: '#EF4444',
        },
      },
      boxShadow: {
        soft: '0 8px 24px rgba(37, 33, 29, 0.08)',
        node: '0 6px 18px rgba(37, 33, 29, 0.10)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
