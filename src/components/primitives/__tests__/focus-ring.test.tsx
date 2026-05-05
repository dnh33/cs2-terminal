import { describe, it, expect } from 'vitest'
import '../../../index.css'

// jsdom does not compute :focus-visible. We assert by reading the parsed
// stylesheet text and verifying the expected rules exist with the right
// tokens. Real visual verification is in Task 26 (axe + manual).
describe('global focus-visible ring', () => {
  const allRuleText = (): string => {
    return Array.from(document.styleSheets)
      .flatMap((s) => {
        try {
          return Array.from(s.cssRules).map((r) => r.cssText)
        } catch {
          return [] as string[]
        }
      })
      .join('\n')
  }

  it('declares a :focus-visible rule using --accent-sel with 2px outline + offset', () => {
    const text = allRuleText()
    expect(text).toMatch(/:focus-visible/)
    // Match the base rule: 2px solid var(--accent-sel) + outline-offset 2px
    expect(text).toMatch(/:focus-visible[^{]*\{[^}]*outline:\s*2px\s+solid\s+var\(--accent-sel\)/)
    expect(text).toMatch(/:focus-visible[^{]*\{[^}]*outline-offset:\s*2px/)
  })

  it('declares an inverse focus variant using --focus-inverse for accent surfaces', () => {
    const text = allRuleText()
    // Selector list should include data-variant="primary" or on-accent contexts
    expect(text).toMatch(/data-variant="primary"\]:focus-visible|\.on-accent\s+:focus-visible|\[data-on-accent\]\s+:focus-visible/)
    // And the inverse rule must reference --focus-inverse
    expect(text).toMatch(/:focus-visible[^{]*\{[^}]*outline-color:\s*var\(--focus-inverse\)/)
  })

  it('declares an inset focus variant using box-shadow inset', () => {
    const text = allRuleText()
    expect(text).toMatch(/\[data-focus="inset"\]:focus-visible/)
    expect(text).toMatch(/box-shadow:\s*inset\s+0\s+0\s+0\s+2px\s+var\(--accent-sel\)/)
  })

  it('strips the default :focus outline so the visible ring replaces it', () => {
    const text = allRuleText()
    expect(text).toMatch(/(?:^|[^-]):focus\s*\{[^}]*outline:\s*none/)
  })
})
