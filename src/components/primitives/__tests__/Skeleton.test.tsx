import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Skeleton } from '../Skeleton'

describe('Skeleton', () => {
  it('is aria-hidden', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })

  it('merges className', () => {
    const { container } = render(<Skeleton className="h-10 w-32" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('h-10')
    expect(el.className).toContain('w-32')
    expect(el.className).toContain('bg-bg-2')
  })
})
