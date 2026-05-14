import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { mockUseMarketDataWithGloveCase, mockAuth } from '../../__tests__/__fixtures__/dashboardMocks'

mockUseMarketDataWithGloveCase()
mockAuth()

describe('footer disclaimer disclosure — ARIA wiring', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('button aria-controls references the disclosed panel id', async () => {
    const Mod = await import('../../App')
    const { container } = render(<Mod.default />)
    await new Promise((r) => setTimeout(r, 0))
    const trigger = container.querySelector('[data-test="footer-disclaimer-trigger"]') as HTMLButtonElement | null
    expect(trigger).toBeTruthy()
    const controls = trigger?.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    const target = controls ? container.querySelector(`#${controls}`) : null
    // The disclosed div only renders when disclaimer is open; click to expand
    fireEvent.click(trigger!)
    const expandedTarget = controls ? container.querySelector(`#${controls}`) : null
    expect(expandedTarget).toBeTruthy()
    expect(expandedTarget?.getAttribute('data-test')).toBe('footer-disclaimer-content')
  })
})
