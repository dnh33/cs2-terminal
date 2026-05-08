import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MktTabs } from '../MktTabs'

const scanProps = {
  items: [],
  onScan: vi.fn(),
  scan: null,
  scanning: false,
  error: null,
  onSelectCase: vi.fn(),
}

const moversProps = {
  onSelect: vi.fn(),
  earliestSnapshotAge: 0,
}

describe('MktTabs (Phase 4.5 Plan 2)', () => {
  it('renders a tablist with two tabs (MARKET SCAN | MOVERS)', () => {
    const { container } = render(
      <MktTabs value="scan" onChange={vi.fn()} scan={scanProps} movers={moversProps} />,
    )
    const tablist = container.querySelector('[role="tablist"]')
    expect(tablist).not.toBeNull()
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs.length).toBe(2)
    expect(tabs[0].textContent).toMatch(/MARKET SCAN/)
    expect(tabs[1].textContent).toMatch(/MOVERS/)
  })

  it('marks the active tab aria-selected="true" and inactive tab tabIndex="-1"', () => {
    const { container } = render(
      <MktTabs value="scan" onChange={vi.fn()} scan={scanProps} movers={moversProps} />,
    )
    const [scanTab, moversTab] = container.querySelectorAll('[role="tab"]')
    expect(scanTab.getAttribute('aria-selected')).toBe('true')
    expect(scanTab.getAttribute('tabindex')).toBe('0')
    expect(moversTab.getAttribute('aria-selected')).toBe('false')
    expect(moversTab.getAttribute('tabindex')).toBe('-1')
  })

  it('hides the inactive tabpanel via hidden attribute (both panels mounted)', () => {
    const { container } = render(
      <MktTabs value="scan" onChange={vi.fn()} scan={scanProps} movers={moversProps} />,
    )
    const panels = container.querySelectorAll('[role="tabpanel"]')
    expect(panels.length).toBe(2)
    const scanPanel = container.querySelector('#mkt-panel-scan') as HTMLElement
    const moversPanel = container.querySelector('#mkt-panel-movers') as HTMLElement
    expect(scanPanel.hidden).toBe(false)
    expect(moversPanel.hidden).toBe(true)
    expect(container.querySelector('[data-test="market-scan-panel"]')).not.toBeNull()
    expect(container.querySelector('[data-test="movers-panel"]')).not.toBeNull()
  })

  it('clicking inactive tab fires onChange with the new value', () => {
    const onChange = vi.fn()
    const { container } = render(
      <MktTabs value="scan" onChange={onChange} scan={scanProps} movers={moversProps} />,
    )
    const moversTab = container.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement
    fireEvent.click(moversTab)
    expect(onChange).toHaveBeenCalledWith('movers')
  })

  it('ArrowRight cycles forward; ArrowLeft cycles back (wraps in 2-tab list)', () => {
    const onChange = vi.fn()
    const { container } = render(
      <MktTabs value="scan" onChange={onChange} scan={scanProps} movers={moversProps} />,
    )
    const scanTab = container.querySelectorAll('[role="tab"]')[0] as HTMLButtonElement
    fireEvent.keyDown(scanTab, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('movers')
    onChange.mockClear()
    fireEvent.keyDown(scanTab, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('movers')
  })

  it('Home / End move to first / last tab', () => {
    const onChange = vi.fn()
    const { container } = render(
      <MktTabs value="movers" onChange={onChange} scan={scanProps} movers={moversProps} />,
    )
    const moversTab = container.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement
    fireEvent.keyDown(moversTab, { key: 'Home' })
    expect(onChange).toHaveBeenCalledWith('scan')
    onChange.mockClear()
    fireEvent.keyDown(moversTab, { key: 'End' })
    expect(onChange).toHaveBeenCalledWith('movers')
  })

  it('tablist has aria-label for screen-readers', () => {
    const { container } = render(
      <MktTabs value="scan" onChange={vi.fn()} scan={scanProps} movers={moversProps} />,
    )
    const tablist = container.querySelector('[role="tablist"]')
    expect(tablist!.getAttribute('aria-label')).toBe('Market view')
  })
})
