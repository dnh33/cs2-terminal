import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('SystemStatus 3-tier', () => {
  it('renders all 3 tier rows', () => {
    render(<SystemStatus runsCase={[makeRun()]} runsHi={[makeRun()]} runsLo={[makeRun()]} />)
    expect(screen.getByText('CASE')).toBeInTheDocument()
    expect(screen.getByText('ITEM-HI')).toBeInTheDocument()
    expect(screen.getByText('ITEM-LO')).toBeInTheDocument()
  })

  it('empty tier shows NO RUNS muted', () => {
    render(<SystemStatus runsCase={[makeRun()]} runsHi={[]} runsLo={[]} />)
    expect(screen.getAllByText(/NO RUNS/i).length).toBeGreaterThanOrEqual(2)
  })

  it('failed tier shows ENDPOINT FAIL muted', () => {
    render(<SystemStatus runsCase={[makeRun()]} runsHi={[]} runsLo={[]} failHi />)
    expect(screen.getByText(/ENDPOINT FAIL/i)).toBeInTheDocument()
  })

  it('per-tier aria-label semantically distinct', () => {
    render(<SystemStatus runsCase={[makeRun()]} runsHi={[]} runsLo={[]} />)
    expect(screen.getByLabelText(/Last 1 case-sweep runs/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/item-high-tier runs: no runs recorded/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/item-low-tier runs: no runs recorded/i)).toBeInTheDocument()
  })

  it('renders 24 bars when given 24 case runs', () => {
    const runs = Array.from({ length: 24 }, (_, i) => makeRun({ started_at: 1714989600 + i * 3600 }))
    const { container } = render(<SystemStatus runsCase={runs} runsHi={[]} runsLo={[]} />)
    const bars = container.querySelectorAll('[data-cron-bar]')
    expect(bars.length).toBe(24)
  })

  it('green bar when error null and failed=0', () => {
    const { container } = render(<SystemStatus runsCase={[makeRun()]} runsHi={[]} runsLo={[]} />)
    const bar = container.querySelector('[data-cron-bar]')
    expect(bar?.getAttribute('data-status')).toBe('ok')
  })

  it('yellow bar when failed > 0 and error null', () => {
    const { container } = render(<SystemStatus runsCase={[makeRun({ failed: 3 })]} runsHi={[]} runsLo={[]} />)
    const bar = container.querySelector('[data-cron-bar]')
    expect(bar?.getAttribute('data-status')).toBe('degraded')
  })

  it('red bar when error not null', () => {
    const { container } = render(<SystemStatus runsCase={[makeRun({ error: 'timeout' })]} runsHi={[]} runsLo={[]} />)
    const bar = container.querySelector('[data-cron-bar]')
    expect(bar?.getAttribute('data-status')).toBe('failed')
  })

  it('exposes ARIA summary on case tier', () => {
    const runs = [makeRun(), makeRun({ failed: 2 }), makeRun({ error: 'x' })]
    render(<SystemStatus runsCase={runs} runsHi={[]} runsLo={[]} />)
    const img = screen.getByLabelText(/Last 3 case-sweep runs/)
    expect(img.getAttribute('aria-label')).toContain('1 ok')
    expect(img.getAttribute('aria-label')).toContain('1 degraded')
    expect(img.getAttribute('aria-label')).toContain('1 failed')
  })

  it('sparkline bars rendered with status colors', () => {
    const { container } = render(<SystemStatus runsCase={[makeRun()]} runsHi={[]} runsLo={[]} />)
    expect(container.querySelector('[data-cron-bar][data-status="ok"]')).toBeInTheDocument()
  })
})
