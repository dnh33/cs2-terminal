import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Banner } from '../Banner'

describe('Banner', () => {
  it('error variant has role=alert', () => {
    render(<Banner variant="error">fetch failed</Banner>)
    const banner = screen.getByRole('alert')
    expect(banner).toHaveTextContent('fetch failed')
  })
  it('warn/info variant has role=status', () => {
    render(<Banner variant="warn">stale</Banner>)
    expect(screen.getByRole('status')).toHaveTextContent('stale')
  })
  it('renders an action button when provided', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Banner variant="error" action={{ label: 'Retry', onClick }}>err</Banner>
    )
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(onClick).toHaveBeenCalled()
  })
})
