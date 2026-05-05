import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// We assert against the raw stylesheet text rather than computed styles
// because jsdom does not resolve var() through getComputedStyle, and its
// matchMedia stub always returns matches:false regardless of the query.
const cssText = readFileSync(
  resolve(__dirname, '../../index.css'),
  'utf-8'
)

describe('motion tokens — 4-tier vocabulary in src/index.css', () => {
  it('declares --dur-tick at 80ms with linear easing', () => {
    expect(cssText).toMatch(/--dur-tick:\s*80ms/)
    expect(cssText).toMatch(/--ease-tick:\s*linear/)
  })

  it('declares --dur-snap at 140ms with a cubic-bezier easing', () => {
    expect(cssText).toMatch(/--dur-snap:\s*140ms/)
    expect(cssText).toMatch(/--ease-snap:\s*cubic-bezier\(/)
  })

  it('declares --dur-sweep at 320ms with a cubic-bezier easing', () => {
    expect(cssText).toMatch(/--dur-sweep:\s*320ms/)
    expect(cssText).toMatch(/--ease-sweep:\s*cubic-bezier\(/)
  })

  it('declares --dur-drift at 1200ms with linear easing', () => {
    expect(cssText).toMatch(/--dur-drift:\s*1200ms/)
    expect(cssText).toMatch(/--ease-drift:\s*linear/)
  })
})

describe('reduced-motion handler', () => {
  it('emits a prefers-reduced-motion: reduce media query', () => {
    expect(cssText).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  })

  it('forces animation-duration and transition-duration to ~0 inside that block', () => {
    // Non-greedy match across the media query body.
    const block = cssText.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\s*\}\s*\}/
    )
    expect(block, 'reduced-motion media block not found').toBeTruthy()
    const body = block![0]
    expect(body).toMatch(/animation-duration:\s*0\.001ms\s*!important/)
    expect(body).toMatch(/transition-duration:\s*0\.001ms\s*!important/)
    expect(body).toMatch(/animation-iteration-count:\s*1\s*!important/)
    expect(body).toMatch(/scroll-behavior:\s*auto\s*!important/)
  })
})

describe('global keyframes — defined in index.css so color-mix can read tokens', () => {
  it('defines @keyframes pulse-sigil using color-mix on --state-info', () => {
    expect(cssText).toMatch(/@keyframes\s+pulse-sigil\s*\{/)
    const block = cssText.match(/@keyframes\s+pulse-sigil\s*\{[\s\S]*?\n\}/)
    expect(block).toBeTruthy()
    expect(block![0]).toMatch(/color-mix\(\s*in\s+srgb\s*,\s*var\(--state-info\)/)
  })

  it('defines @keyframes ticker-drift translating to -50%', () => {
    expect(cssText).toMatch(/@keyframes\s+ticker-drift\s*\{/)
    const block = cssText.match(/@keyframes\s+ticker-drift\s*\{[\s\S]*?\n\}/)
    expect(block).toBeTruthy()
    expect(block![0]).toMatch(/translate3d\(-50%,\s*0,\s*0\)/)
  })

  it('defines @keyframes blink with a 50% opacity step', () => {
    expect(cssText).toMatch(/@keyframes\s+blink\s*\{/)
  })

  it('defines @keyframes fade-up that translates from 6px to 0', () => {
    expect(cssText).toMatch(/@keyframes\s+fade-up\s*\{/)
    const block = cssText.match(/@keyframes\s+fade-up\s*\{[\s\S]*?\n\}/)
    expect(block).toBeTruthy()
    expect(block![0]).toMatch(/translateY\(6px\)/)
  })
})

describe('tailwind.config.js — animation utilities wire to new keyframes', () => {
  const tailwindText = readFileSync(
    resolve(__dirname, '../../../tailwind.config.js'),
    'utf-8'
  )

  it('registers a pulse-sigil animation utility', () => {
    expect(tailwindText).toMatch(/['"]pulse-sigil['"]\s*:\s*['"]pulse-sigil\s/)
  })

  it('registers a ticker-drift animation utility bound to --ticker-duration', () => {
    expect(tailwindText).toMatch(/['"]ticker-drift['"]\s*:\s*['"]ticker-drift\s+var\(--ticker-duration/)
  })

  it('keeps legacy pulse-orange and ticker aliases for unmigrated components', () => {
    expect(tailwindText).toMatch(/['"]pulse-orange['"]\s*:\s*['"]pulse-sigil\s/)
    expect(tailwindText).toMatch(/['"]ticker['"]\s*:\s*['"]ticker-drift\s/)
  })
})
