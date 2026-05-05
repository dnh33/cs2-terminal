import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, it, expect } from 'vitest'
import { Header } from '../Header'
import { Banner } from '../primitives/Banner'

describe('dashboard a11y smoke (axe)', () => {
  it('Header passes axe', async () => {
    const stats = {
      last_snapshot_at: Math.floor(Date.now() / 1000) - 30,
      last_cron: { succeeded: 10, failed: 0, started_at: 0, finished_at: 0 },
    } as any
    const { container } = render(
      <Header fetching={false} stats={stats} onLogout={() => {}} />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('error Banner passes axe', async () => {
    const { container } = render(<Banner variant="error">Fetch failed</Banner>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
