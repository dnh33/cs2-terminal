import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import '../../../index.css'

// jsdom does not resolve CSS custom properties via getComputedStyle on the
// element — it returns the literal `var(--token)` string. We assert that the
// utility classes wire the right tokens (proving the rule is applied), then
// resolve the token on :root to verify the underlying value matches the spec.
describe('type scale utilities', () => {
  const root = document.documentElement
  const rootCs = () => getComputedStyle(root)

  it('applies font-display class with Bebas Neue at expected size', () => {
    render(<h1 className="t-display-2" data-testid="title">CASE SNIPER</h1>)
    const el = screen.getByTestId('title')
    const cs = getComputedStyle(el)
    // Utility wires the display tokens
    expect(cs.fontSize).toBe('var(--text-display-2)')
    expect(cs.fontFamily).toBe('var(--font-display)')
    // Root resolves the size to the spec scale (~2.154rem) and family to Bebas
    expect(rootCs().getPropertyValue('--text-display-2').trim()).toMatch(/^2\.\d+rem$|^28px$/)
    expect(rootCs().getPropertyValue('--font-display').toLowerCase()).toContain('bebas')
  })

  it('applies prose body class with DM Sans', () => {
    render(<p className="t-body" data-testid="body">analysis prose</p>)
    const el = screen.getByTestId('body')
    expect(getComputedStyle(el).fontFamily).toBe('var(--font-prose)')
    expect(rootCs().getPropertyValue('--font-prose').toLowerCase()).toContain('dm sans')
  })

  it('applies tabular-nums on data utility', () => {
    render(<span className="t-data" data-testid="d">123</span>)
    const el = screen.getByTestId('d')
    expect(getComputedStyle(el).fontVariantNumeric).toContain('tabular-nums')
  })
})
