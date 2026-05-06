import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SystemStatus } from '../SystemStatus'

const makeRun = (overrides: Partial<{ started_at: number; finished_at: number; succeeded: number; failed: number; error: string | null; duration_s: number }> = {}) => ({
  started_at: 1714989600,
  finished_at: 1714989762,
  succeeded: 33,
  failed: 0,
  error: null,
  duration_s: 162,
  ...overrides,
})

describe('SystemStatus', () => {
  it('renders 24 bars when given 24 runs', () => {
    const runs = Array.from({ length: 24 }, (_, i) => makeRun({ started_at: 1714989600 + i * 3600 }))
    const { container } = render(<SystemStatus runs={runs} />)
    const bars = container.querySelectorAll('[data-cron-bar]')
    expect(bars.length).toBe(24)
  })

  it('green bar when error null and failed=0', () => {
    const { container } = render(<SystemStatus runs={[makeRun()]} />)
    const bar = container.querySelector('[data-cron-bar]')
    expect(bar?.getAttribute('data-status')).toBe('ok')
  })

  it('yellow bar when failed > 0 and error null', () => {
    const { container } = render(<SystemStatus runs={[makeRun({ failed: 3 })]} />)
    const bar = container.querySelector('[data-cron-bar]')
    expect(bar?.getAttribute('data-status')).toBe('degraded')
  })

  it('red bar when error not null', () => {
    const { container } = render(<SystemStatus runs={[makeRun({ error: 'timeout' })]} />)
    const bar = container.querySelector('[data-cron-bar]')
    expect(bar?.getAttribute('data-status')).toBe('failed')
  })

  it('exposes ARIA summary', () => {
    const runs = [makeRun(), makeRun({ failed: 2 }), makeRun({ error: 'x' })]
    const { getByRole } = render(<SystemStatus runs={runs} />)
    const img = getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('1 ok')
    expect(img.getAttribute('aria-label')).toContain('1 degraded')
    expect(img.getAttribute('aria-label')).toContain('1 failed')
  })

  it('renders empty placeholder when runs is empty', () => {
    const { getByText } = render(<SystemStatus runs={[]} />)
    expect(getByText(/NO CRON HISTORY/i)).toBeTruthy()
  })
})
