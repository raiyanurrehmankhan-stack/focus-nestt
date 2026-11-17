/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        teal: { DEFAULT: '#2A9D8F', 50: '#EAF7F5', 100: '#D3EFEB', 200: '#A7DFD7', 300: '#6FC8BC', 400: '#45B2A4', 500: '#2A9D8F', 600: '#228073', 700: '#1C665D', 800: '#174F49', 900: '#123D39' },
        sky: { DEFAULT: '#4F8EF7', 50: '#EEF4FF', 100: '#DCE8FE', 200: '#B8D0FC', 300: '#8FB5FA', 400: '#6EA0F8', 500: '#4F8EF7', 600: '#2F6FE0', 700: '#2558B4' },
        success: '#3FB68B',
        warning: '#F5B942',
        danger: '#EF6B6B',
        ink: { DEFAULT: '#1B2B3A', soft: '#5B6B7A', mute: '#8A98A6' },
        canvas: { light: '#F5F8FA', dark: '#0F172A' },
        card: { light: '#FFFFFF', dark: '#1E293B' },
        line: { light: '#E3EAF0', dark: '#2C3B52' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '16px', xl2: '20px' },
      boxShadow: {
        soft: '0 8px 24px -12px rgba(27, 43, 58, 0.14), 0 2px 6px -2px rgba(27, 43, 58, 0.06)',
        lift: '0 18px 40px -18px rgba(27, 43, 58, 0.28)',
        glow: '0 0 0 8px rgba(42, 157, 143, 0.12), 0 0 60px rgba(42, 157, 143, 0.35)',
      },
      keyframes: {
        pulseRing: { '0%,100%': { transform: 'scale(1)', opacity: '0.9' }, '50%': { transform: 'scale(1.06)', opacity: '0.55' } },
        breathe: { '0%,100%': { transform: 'scale(0.82)' }, '50%': { transform: 'scale(1)' } },
        floatUp: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        fadeIn: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        spinSlow: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        pulseRing: 'pulseRing 2.4s ease-in-out infinite',
        breathe: 'breathe 8s ease-in-out infinite',
        floatUp: 'floatUp 4s ease-in-out infinite',
        fadeIn: 'fadeIn .35s ease-out both',
        spinSlow: 'spinSlow 30s linear infinite',
      },
    },
  },
  plugins: [],
};
