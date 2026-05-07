import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function extractTokensFromBlock(css: string, selector: string): Set<string> {
  // P0-3 audit fix: real index.css declares `:root, :root[data-palette="std"] { ... }`.
  // Permissive match allows comma-separated grouped selectors before the `{`.
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(?:^|[\\n,])\\s*${escapedSelector}[^{]*\\{([^}]+)\\}`, 'm')
  const match = css.match(regex)
  if (!match) throw new Error(`Selector not found: ${selector}`)
  const body = match[1]
  const tokens = new Set<string>()
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*(--[a-z][a-z0-9-]+)\s*:/i)
    if (m) tokens.add(m[1])
  }
  return tokens
}

/**
 * Plan-defect patch (Phase 3 P4-T4):
 *   Plan literal-spec: amberTokens === stdTokens AND greenTokens === stdTokens.
 *   Reality: :root contains palette-color tokens AND non-palette tokens
 *   (--s-0..--s-7, --row-height, --panel-pad-*, --radius, --dur-*, --ticker-duration,
 *    type tokens, line-heights). amber/green only override palette colors.
 *   Forcing spacing/duration tokens into amber/green blocks would be incorrect
 *   semantically (they aren't palette-dependent) and is not the spec § 2.3.B
 *   intent ("prevent silent palette drift").
 *
 *   Pragmatic invariants the test enforces:
 *     1. amber and green declare the SAME set of tokens (mirrored overrides).
 *     2. Every amber/green token is also declared in :root (no orphan overrides).
 *
 *   This catches the real drift case: adding a color token to one palette but
 *   forgetting the other, or adding a token to an override block that no longer
 *   exists in :root.
 */
describe('palette completeness', () => {
  const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')
  const stdTokens = extractTokensFromBlock(css, ':root[data-palette="std"]')
  const amberTokens = extractTokensFromBlock(css, ':root[data-palette="amber"]')
  const greenTokens = extractTokensFromBlock(css, ':root[data-palette="green"]')

  it('amber and green declare the same set of palette tokens', () => {
    const missingInGreen = [...amberTokens].filter(t => !greenTokens.has(t))
    const missingInAmber = [...greenTokens].filter(t => !amberTokens.has(t))
    expect(missingInGreen).toEqual([])
    expect(missingInAmber).toEqual([])
  })

  it('every amber token is declared in :root', () => {
    const orphans = [...amberTokens].filter(t => !stdTokens.has(t))
    expect(orphans).toEqual([])
  })

  it('every green token is declared in :root', () => {
    const orphans = [...greenTokens].filter(t => !stdTokens.has(t))
    expect(orphans).toEqual([])
  })
})
