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
        'pulse-sigil': 'pulse-sigil 2.4s ease-in-out infinite',
        'ticker-drift': 'ticker-drift var(--ticker-duration, 80s) linear infinite',
        'blink': 'blink 1s steps(2) infinite',
        'fade-up': 'fade-up 0.3s ease-out',
        // Legacy aliases for components not yet migrated (see Task 11.5).
        'pulse-orange': 'pulse-sigil 2.4s ease-in-out infinite',
        'ticker': 'ticker-drift var(--ticker-duration, 80s) linear infinite',
      },
      keyframes: {
        // empty — definitions live in src/index.css so they can use color-mix.
      },
    },
  },
  plugins: [],
}
