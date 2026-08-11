/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./{app,components,libs,pages,hooks,lib}/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0f172a',
          50: '#f8fafc',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#94a3b8',
          400: '#64748b',
          500: '#475569',
          600: '#334155',
          700: '#1e293b',
          800: '#0f172a',
          900: '#0b1220',
          950: '#020617',
        },
        brass: {
          DEFAULT: '#2dd4bf',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
        bone: {
          DEFAULT: '#f1f5f9',
          muted: '#cbd5e1',
        },
        fog: {
          DEFAULT: '#94a3b8',
          dim: '#64748b',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Noto Serif KR', 'serif'],
        sans: ['var(--font-body)', 'IBM Plex Sans KR', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        ink: '0 18px 40px -20px rgba(2, 6, 23, 0.55)',
        soft: '0 8px 24px -12px rgba(2, 6, 23, 0.4)',
      },
      letterSpacing: {
        brand: '0.04em',
        mist: '0.18em',
      },
    },
  },
  plugins: [],
};
