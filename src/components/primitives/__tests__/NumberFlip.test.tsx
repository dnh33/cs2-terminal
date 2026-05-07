import { describe, it, expect } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { NumberFlip } from '../NumberFlip'

describe('NumberFlip', () => {
  it('renders the value with prefix + decimals', () => {
    const { container } = render(<NumberFlip value={247.5} prefix="$" decimals={2} />)
    expect(container.textContent).toContain('$247.50')
  })

  it('applies tabular-nums class', () => {
    const { container } = render(<NumberFlip value={100} />)
    const wrapper = container.querySelector('.num-flip')
    expect(wrapper?.className).toContain('tabular-nums')
  })

  it('sets data-flash="up" when value increases', async () => {
    const { container, rerender } = render(<NumberFlip value={100} />)
    rerender(<NumberFlip value={120} />)
    const wrapper = container.querySelector('.num-flip')
    expect(wrapper?.getAttribute('data-flash')).toBe('up')
  })

  it('sets data-flash="down" when value decreases', () => {
    const { container, rerender } = render(<NumberFlip value={100} />)
    rerender(<NumberFlip value={80} />)
    const wrapper = container.querySelector('.num-flip')
    expect(wrapper?.getAttribute('data-flash')).toBe('down')
  })

  it('does NOT set data-flash on initial render', () => {
    const { container } = render(<NumberFlip value={100} />)
    const wrapper = container.querySelector('.num-flip')
    expect(wrapper?.getAttribute('data-flash')).toBeNull()
  })

  it('removes data-flash on animation end', () => {
    const { container, rerender } = render(<NumberFlip value={100} />)
    rerender(<NumberFlip value={120} />)
    const wrapper = container.querySelector('.num-flip') as HTMLElement
    // jsdom lacks AnimationEvent constructor; dispatch a generic Event named 'animationend' that
    // bubbles so React's delegated synthetic-event system picks it up.
    act(() => {
      const ev = new Event('animationend', { bubbles: true })
      ;(ev as unknown as { animationName: string }).animationName = 'flash-up'
      wrapper.dispatchEvent(ev)
    })
    expect(wrapper.getAttribute('data-flash')).toBeNull()
  })

  it('flashOnChange={false} disables the tint', () => {
    const { container, rerender } = render(<NumberFlip value={100} flashOnChange={false} />)
    rerender(<NumberFlip value={120} flashOnChange={false} />)
    const wrapper = container.querySelector('.num-flip')
    expect(wrapper?.getAttribute('data-flash')).toBeNull()
  })

  it('handles equal values (no flash)', () => {
    const { container, rerender } = render(<NumberFlip value={100} />)
    rerender(<NumberFlip value={100} />)
    const wrapper = container.querySelector('.num-flip')
    expect(wrapper?.getAttribute('data-flash')).toBeNull()
  })

  it('formats with suffix', () => {
    const { container } = render(<NumberFlip value={5.5} suffix="%" decimals={1} />)
    expect(container.textContent).toContain('5.5%')
  })

  it('does NOT render DigitColumn on initial mount (no animation on first render)', () => {
    const { container } = render(<NumberFlip value={247.50} prefix="$" />)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0)
  })

  it('renders DigitColumn for each changed digit position on value change', () => {
    const { container, rerender } = render(<NumberFlip value={247.50} prefix="$" />)
    rerender(<NumberFlip value={247.80} prefix="$" />)
    const columns = container.querySelectorAll('[aria-hidden="true"]')
    expect(columns.length).toBe(1)
    expect(columns[0].textContent).toContain('5')
    expect(columns[0].textContent).toContain('8')
  })

  it('keeps prefix, suffix, and decimal point static (never animated)', () => {
    const { container, rerender } = render(<NumberFlip value={1} prefix="$" suffix="%" decimals={2} />)
    rerender(<NumberFlip value={2} prefix="$" suffix="%" decimals={2} />)
    const columns = container.querySelectorAll('[aria-hidden="true"]')
    expect(columns.length).toBe(1)
  })

  it('skips slide on length mismatch (e.g. 99 → 100)', () => {
    const { container, rerender } = render(<NumberFlip value={99} decimals={0} />)
    rerender(<NumberFlip value={100} decimals={0} />)
    const columns = container.querySelectorAll('[aria-hidden="true"]')
    expect(columns.length).toBe(0)
    expect(container.textContent).toContain('100')
  })

  it('aria-label exposes the full formatted value (screen readers)', () => {
    const { container } = render(<NumberFlip value={247.50} prefix="$" />)
    const wrapper = container.querySelector('.num-flip')
    expect(wrapper?.getAttribute('aria-label')).toBe('$247.50')
  })

  it('slideDigits={false} disables per-digit slide', () => {
    const { container, rerender } = render(<NumberFlip value={1} slideDigits={false} decimals={0} />)
    rerender(<NumberFlip value={2} slideDigits={false} decimals={0} />)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0)
  })
})
