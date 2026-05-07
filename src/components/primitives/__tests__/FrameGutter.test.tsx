import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FrameGutter } from '../FrameGutter'

describe('FrameGutter', () => {
  it('renders the formatted frame label', () => {
    const { getByText } = render(<FrameGutter number="01" label="MKT" />)
    expect(getByText(/01·MKT/)).toBeTruthy()
  })

  it('uses vertical-rl writing mode', () => {
    const { container } = render(<FrameGutter number="03" label="CHRT" />)
    const el = container.querySelector('[data-frame-gutter]') as HTMLElement
    expect(el.style.writingMode).toBe('vertical-rl')
  })

  it('applies hidden md:flex for mobile-hide', () => {
    const { container } = render(<FrameGutter number="01" label="MKT" />)
    const el = container.querySelector('[data-frame-gutter]')
    expect(el?.className).toContain('hidden')
    expect(el?.className).toContain('md:flex')
  })
})
