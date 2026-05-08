import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Header } from '../Header'

const stubStats = {
  cases_tracked: 33,
  total_cases: 33,
  total_volume_24h: 0,
  total_market_cap: 0,
  last_snapshot_at: Math.floor(Date.now() / 1000),
  last_cron: { started_at: Math.floor(Date.now() / 1000), finished_at: Math.floor(Date.now() / 1000), succeeded: 33, failed: 0, error: null },
}

describe('Header', () => {
  it('exposes its height via inline style referencing --header-h, so sticky INSP has a deterministic top-offset', () => {
    // NOTE: implementation-detail assertion — we verify the inline style value
    // because jsdom doesn't compute pixel heights. If the height-application
    // mechanism changes (e.g. to a className utility), update this test atomically.
    const { container } = render(
      <Header fetching={false} stats={stubStats} />,
    )
    const header = container.querySelector('header')
    expect(header).not.toBeNull()
    expect((header as HTMLElement).style.height).toBe('var(--header-h)')
  })
})
