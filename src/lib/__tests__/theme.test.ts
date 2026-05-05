import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { C } from '../theme'

const cssText = readFileSync(
  resolve(__dirname, '../../index.css'),
  'utf-8'
)

describe('theme tokens — declared in src/index.css', () => {
  it('declares STD --ink-2 at the AA-passing value #7e8a99', () => {
    expect(cssText).toMatch(/--ink-2:\s*#7e8a99/i)
  })

  it('declares STD --accent-sel at the new browner orange #e8681a', () => {
    expect(cssText).toMatch(/--accent-sel:\s*#e8681a/i)
  })

  it('declares channel-triplet form for opacity modifiers', () => {
    expect(cssText).toMatch(/--accent-sel-rgb:\s*232\s+104\s+26/)
    expect(cssText).toMatch(/--ink-2-rgb:\s*126\s+138\s+153/)
  })

  it('does NOT declare --accent-purple anywhere (token removed)', () => {
    expect(cssText).not.toMatch(/--accent-purple\s*:/)
  })

  it('declares the AMBER and GREEN palette mode blocks', () => {
    expect(cssText).toMatch(/:root\[data-palette="amber"\]/)
    expect(cssText).toMatch(/:root\[data-palette="green"\]/)
  })
})

describe('theme C constants — runtime token bridge', () => {
  it('legacy C.orange proxies to --accent-sel via var()', () => {
    expect(C.orange).toBe('var(--accent-sel)')
  })

  it('C.purple aliases to --ink-3 (deprecated, kept for build compat)', () => {
    expect(C.purple).toBe('var(--ink-3)')
  })

  it('C.modeled exposes the new --modeled token', () => {
    expect(C.modeled).toBe('var(--modeled)')
  })
})
