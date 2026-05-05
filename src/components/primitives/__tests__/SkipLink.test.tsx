import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SkipLink } from '../SkipLink'

describe('SkipLink', () => {
  it('renders a link to #main with sr-only-by-default styles', () => {
    render(<SkipLink targetId="main" />)
    const link = screen.getByRole('link', { name: /skip to content/i })
    expect(link).toHaveAttribute('href', '#main')
    expect(link).toHaveClass('sr-only')
  })
})
