/** @type {import('tailwindcss').Config} */

// Helper: Tailwind v3 needs space-separated channel triplets to layer on
// the <alpha-value> at compile time. Returns the rgb() expression Tailwind
// rewrites at compile time when an opacity modifier is applied.
const cssVar = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          0: cssVar('bg-0'),
          1: cssVar('bg-1'),
          2: cssVar('bg-2'),
          3: cssVar('bg-3'),
          4: cssVar('bg-4'),
        },
        line: {
          DEFAULT: cssVar('line'),
          bright: cssVar('line-hi'),
        },
        ink: {
          0: cssVar('ink-0'),
          1: cssVar('ink-1'),
          2: cssVar('ink-2'),
          3: cssVar('ink-3'),
        },
        accent: {
          sel: cssVar('accent-sel'),
          'sel-dim': cssVar('accent-sel-dim'),
          data: cssVar('accent-data'),
          // Legacy aliases — see Task 11.5 for the sweep that retires these.
          orange: cssVar('accent-sel'),
          'orange-dim': cssVar('accent-sel-dim'),
          cyan: cssVar('accent-data'),
          green: cssVar('delta-up'),
          red: cssVar('delta-dn'),
          yellow: cssVar('state-warn'),
          // purple deprecated → ink-3 so any orphan reference still renders something.
          purple: cssVar('ink-3'),
        },
        delta: {
          up: cssVar('delta-up'),
          dn: cssVar('delta-dn'),
        },
        state: {
          warn: cssVar('state-warn'),
          err: cssVar('state-err'),
          info: cssVar('state-info'),
          ok: cssVar('state-ok'),
        },
        modeled: cssVar('modeled'),
        'on-accent': cssVar('on-accent'),
        'focus-inverse': cssVar('focus-inverse'),
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
