import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import App from '../../App'

describe('disabled-busy buttons stay readable', () => {
  it('LIVE/REFRESH button text class does NOT inherit opacity-50 during busy state', () => {
    const { container } = render(<App />)
    // Find any button that uses opacity-50 + a busy state class
    const buttons = container.querySelectorAll('button')

    let foundOpacityButton = false
    for (const b of buttons) {
      const cls = b.className.toString()
      if (cls.includes('disabled:opacity-50')) {
        foundOpacityButton = true
        // Inner text wrapper should NOT inherit the parent's opacity
        const inner = b.querySelector('[data-disabled-text-bypass]')
        // Either the text content is on a wrapper that bypasses opacity, OR
        // the button's text uses a forced colour at full opacity.
        // Assert at least one of: inner bypass OR text colour override.
        const hasBypass = !!inner
        const hasOverride = cls.includes('disabled:text-')
        expect(hasBypass || hasOverride).toBe(true)
      }
    }

    // At least ensure we found buttons with opacity (if none exist, the test is vacuous)
    if (buttons.length > 0) {
      // If buttons exist, at least one should be using disabled:opacity-50 (the LIVE/REFRESH buttons)
      expect(foundOpacityButton).toBe(true)
    }
  })
})
