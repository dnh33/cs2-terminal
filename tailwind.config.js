/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          0: '#07080a',
          1: '#0d1014',
          2: '#12161c',
          3: '#1a1f27',
        },
        line: {
          DEFAULT: '#232932',
          bright: '#2f3742',
        },
        ink: {
          0: '#e8ecf2',
          1: '#a8b0bc',
          2: '#6b7380',
          3: '#444a55',
        },
        accent: {
          orange: '#ff7421',
          'orange-dim': '#c25817',
          cyan: '#4fd1c5',
          'cyan-dim': '#2a8a82',
          green: '#4ade80',
          red: '#f87171',
          yellow: '#fbbf24',
          purple: '#a78bfa',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        display: ['Bebas Neue', 'Impact', 'sans-serif'],
      },
      animation: {
        'pulse-orange': 'pulse-orange 2s infinite',
        'ticker': 'ticker 80s linear infinite',
        'blink': 'blink 1s steps(2) infinite',
        'fade-up': 'fade-up 0.4s ease-out',
      },
      keyframes: {
        'pulse-orange': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,116,33,0.4)' },
          '50%': { boxShadow: '0 0 0 6px rgba(255,116,33,0)' },
        },
        ticker: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0.3' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
