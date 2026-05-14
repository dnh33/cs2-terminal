import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { PaletteSwitch } from '../PaletteSwitch'

/**
 * F22 — PaletteSwitch radio-group keyboard pattern.
 *
 * PaletteSwitch is uncontrolled (internal state + localStorage), so these
 * tests exercise the keyboard mechanics by reading aria-checked and the
 * tabindex attribute on the rendered radios rather than via prop spies.
 */
describe('PaletteSwitch — radio-group keyboard pattern', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-palette')
    localStorage.clear()
  })

  it('only the checked radio is tabbable; others tabIndex=-1', () => {
    const { container } = render(<PaletteSwitch />)
    const radios = container.querySelectorAll('[role="radio"]')
    expect(radios.length).toBe(3)
    const tabbable = Array.from(radios).filter((r) => r.getAttribute('tabindex') !== '-1')
    expect(tabbable.length).toBe(1)
    // The lone tab stop is the currently-checked radio.
    expect(tabbable[0].getAttribute('aria-checked')).toBe('true')
  })

  it('ArrowRight moves selection to next radio (and wraps)', () => {
    const { container } = render(<PaletteSwitch />)
    const radios = container.querySelectorAll<HTMLElement>('[role="radio"]')
    // Default selection is 'std' (index 0).
    expect(radios[0].getAttribute('aria-checked')).toBe('true')
    radios[0].focus()
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' })
    // After ArrowRight, selection should move off 'std' to the next radio.
    expect(radios[0].getAttribute('aria-checked')).toBe('false')
    expect(radios[1].getAttribute('aria-checked')).toBe('true')
  })

  it('ArrowLeft wraps backwards from first to last', () => {
    const { container } = render(<PaletteSwitch />)
    const radios = container.querySelectorAll<HTMLElement>('[role="radio"]')
    expect(radios[0].getAttribute('aria-checked')).toBe('true')
    radios[0].focus()
    fireEvent.keyDown(radios[0], { key: 'ArrowLeft' })
    // ArrowLeft from index 0 wraps to last (index 2).
    expect(radios[0].getAttribute('aria-checked')).toBe('false')
    expect(radios[2].getAttribute('aria-checked')).toBe('true')
  })
})
