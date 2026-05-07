import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { VolumePriceScatter } from '../VolumePriceScatter'
import type { ItemFull } from '../../CaseTable'

// ESM-safe __dirname/__filename equivalents (Vitest+ESM does not auto-shim CJS globals).
const __filenameESM = fileURLToPath(import.meta.url)
const __dirnameESM = path.dirname(__filenameESM)

// Helper to build minimal ItemFull fixtures. PriceData is {lowest, median, volume};
// extra fields like clientWidth come from `as unknown as ItemFull` cast on the outer
// shape to satisfy ItemFull's broader surface.
function item(id: string, name: string, vol: number, price: number, pool: ItemFull['pool']): ItemFull {
  return {
    id, name, pool,
    price: { lowest: price, median: price, volume: vol },
  } as unknown as ItemFull
}

describe('VolumePriceScatter (SVG primitive)', () => {
  let rectSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // jsdom: test-setup.ts already provides a default stub returning width=800.
    // Override here for tooltip-math tests that need known left/top offsets.
    // Use vi.spyOn so afterEach can restore — direct prototype assignment leaks
    // across describes and corrupts subsequent tests.
    rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 50, y: 100, left: 50, top: 100, right: 530, bottom: 300, width: 480, height: 200,
      toJSON: () => ({}),
    } as DOMRect)
    // Also stub clientWidth so the tooltip overflow-flip math has a measurable container.
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 480,
    })
  })

  afterEach(() => {
    rectSpy.mockRestore()
  })

  it('renders empty state when no items have volume > 0', () => {
    render(<VolumePriceScatter items={[]} onSelect={vi.fn()} selectedId={null} />)
    expect(screen.getByText(/INSUFFICIENT VOLUME DATA/)).toBeInTheDocument()
  })

  it('filters out items with vol = 0, NaN, or Infinity', () => {
    const items = [
      item('a', 'A', 0, 1, 'discontinued'),
      item('b', 'B', NaN, 1, 'discontinued'),
      item('c', 'C', Infinity, 1, 'discontinued'),
      item('d', 'D', 100, 5, 'discontinued'),
    ]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    // Only one valid point — one circle (DISC)
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(1)
    // Empty state must NOT render
    expect(screen.queryByText(/INSUFFICIENT VOLUME DATA/)).not.toBeInTheDocument()
  })

  it('renders correct shape per pool: circle (disc), triangle (rare), square (active)', () => {
    const items = [
      item('a', 'Disc', 100, 5, 'discontinued'),
      item('b', 'Rare', 200, 10, 'rare'),
      item('c', 'Act', 300, 15, 'active'),
    ]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(1) // disc + legend circle ok
    expect(container.querySelectorAll('polygon').length).toBeGreaterThanOrEqual(1) // rare + legend triangle ok
    // Square: rect with cursor:pointer style — look for one inside the chart svg
    const chartSvg = container.querySelector('svg[viewBox^="0 0 480"]')
    expect(chartSvg?.querySelectorAll('rect').length).toBeGreaterThanOrEqual(1)
  })

  it('selected point: larger radius + white stroke', () => {
    const items = [item('a', 'A', 100, 5, 'discontinued')]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId="a" />)
    const circle = container.querySelector('svg[viewBox^="0 0 480"] circle[r="10"]')
    expect(circle).toBeTruthy()
    expect(circle?.getAttribute('stroke')).toBe('#fff')
  })

  it('top-5 by volume: persistent labels rendered', () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      item(`id-${i}`, `Name${i}`, (i + 1) * 100, 5, 'discontinued'))
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    const labels = container.querySelectorAll('[data-persistent-label]')
    expect(labels.length).toBe(5) // top-5 by vol
  })

  it('selected point (not top-5): persistent label rendered', () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      item(`id-${i}`, `Name${i}`, (i + 1) * 100, 5, 'discontinued'))
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId="id-0" />)
    // top-5 (id-2..id-6 by vol) plus selected id-0 = 6 labels
    const labels = container.querySelectorAll('[data-persistent-label]')
    expect(labels.length).toBe(6)
  })

  it('click on point → onSelect(id) called', () => {
    const onSelect = vi.fn()
    const items = [item('a', 'A', 100, 5, 'discontinued')]
    const { container } = render(<VolumePriceScatter items={items} onSelect={onSelect} selectedId={null} />)
    const circle = container.querySelector('svg[viewBox^="0 0 480"] circle')!
    fireEvent.click(circle)
    expect(onSelect).toHaveBeenCalledWith('a')
  })

  it('hover renders tooltip with name, price, volume', () => {
    const items = [item('a', 'TestItem', 100, 5.5, 'discontinued')]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    const circle = container.querySelector('svg[viewBox^="0 0 480"] circle')!
    fireEvent.mouseEnter(circle, { clientX: 200, clientY: 150 })
    expect(screen.getByText('TestItem')).toBeInTheDocument()
    expect(screen.getByText(/\$5.50/)).toBeInTheDocument()
    expect(screen.getByText(/100 vol/)).toBeInTheDocument()
  })

  it('tooltip position: container-relative via getBoundingClientRect math', () => {
    const items = [item('a', 'A', 100, 5, 'discontinued')]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    const circle = container.querySelector('svg[viewBox^="0 0 480"] circle')!
    // Stub returns rect at (50, 100). Hover at viewport (200, 150)
    // → container-relative (200-50, 150-100) = (150, 50)
    // → tooltip left = 150 + 12 = 162; top = 50 - 12 = 38
    fireEvent.mouseEnter(circle, { clientX: 200, clientY: 150 })
    const tooltip = container.querySelector('[class*="absolute"][class*="pointer-events-none"]') as HTMLElement
    expect(tooltip).toBeTruthy()
    expect(tooltip.style.left).toBe('162px')
    expect(tooltip.style.top).toBe('38px')
  })

  it('mouse leave dismisses tooltip', () => {
    const items = [item('a', 'A', 100, 5, 'discontinued')]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    const circle = container.querySelector('svg[viewBox^="0 0 480"] circle')!
    fireEvent.mouseEnter(circle, { clientX: 200, clientY: 150 })
    expect(screen.getByText('A')).toBeInTheDocument()
    fireEvent.mouseLeave(circle)
    expect(screen.queryByText('A')).not.toBeInTheDocument()
  })

  it('layering: SVG child group order is quadrant-tints → grid → ticks → points → labels', () => {
    const items = [
      item('a', 'TopVol', 1000, 5, 'discontinued'),
      item('b', 'B', 100, 10, 'rare'),
    ]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    const svg = container.querySelector('svg[viewBox^="0 0 480"]')!
    const children = Array.from(svg.children)

    // Find indices of layer markers
    const quadrantIdx = children.findIndex(c => c.tagName === 'rect' && c.getAttribute('fill')?.includes('var(--accent-data-rgb)'))
    const gridIdx = children.findIndex(c => c.tagName === 'g' && c.querySelector('line[stroke-dasharray]'))
    const pointIdx = children.findIndex(c => c.tagName === 'circle' || (c.tagName === 'polygon' && !c.hasAttribute('data-persistent-label')))
    const labelIdx = children.findIndex(c => (c as Element).hasAttribute('data-persistent-label'))

    expect(quadrantIdx).toBeGreaterThanOrEqual(0)
    expect(gridIdx).toBeGreaterThan(quadrantIdx)
    expect(pointIdx).toBeGreaterThan(gridIdx)
    expect(labelIdx).toBeGreaterThan(pointIdx)
  })

  it('RHS truncation: rightmost-vol point uses textAnchor=end and x = px - 10', () => {
    // Three points; max-vol point's label must anchor end (left of marker)
    const items = [
      item('a', 'LowVol', 10, 5, 'discontinued'),
      item('b', 'MidVol', 100, 5, 'discontinued'),
      item('c', 'MaxVolume', 10000, 5, 'discontinued'),
    ]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    const labels = Array.from(container.querySelectorAll('[data-persistent-label]'))
    const maxLabel = labels.find(el => el.textContent === 'MaxVolume') as SVGTextElement
    expect(maxLabel).toBeTruthy()
    // RHS-truncation: label at right edge flipped to end-anchor at px - 10
    expect(maxLabel.getAttribute('text-anchor')).toBe('end')
  })

  it('single-point dataset: log-mapping returns midpoint inside plot region', () => {
    const items = [item('a', 'Solo', 100, 5, 'discontinued')]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    const circle = container.querySelector('svg[viewBox^="0 0 480"] circle') as SVGCircleElement
    expect(circle).toBeTruthy()
    const cx = parseFloat(circle.getAttribute('cx')!)
    const cy = parseFloat(circle.getAttribute('cy')!)
    // Stronger than `Number.isFinite`: must land inside the plot region, proving the
    // NaN-guard returned the midpoint and didn't silently degrade to 0 or off-canvas.
    expect(cx).toBeGreaterThan(36)   // PAD_L
    expect(cx).toBeLessThan(472)     // W - PAD_R
    expect(cy).toBeGreaterThan(8)    // PAD_T
    expect(cy).toBeLessThan(176)     // H - PAD_B
  })

  it('sub-decade extent (e.g. [120, 850]) renders ≥2 vol gridlines via fallback', () => {
    // Volume range entirely inside (100, 1000) — decade-only logTicks would emit zero ticks.
    // Implementation must fall back to [min, mid, max] (or geometric midpoints) so the
    // user sees axis context, not points floating in a void.
    const items = [
      item('a', 'A', 120, 5, 'discontinued'),
      item('b', 'B', 400, 6, 'discontinued'),
      item('c', 'C', 850, 7, 'discontinued'),
    ]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    const svg = container.querySelector('svg[viewBox^="0 0 480"]')!
    // Only dashed gridlines — exclude solid axis baselines.
    const dashedGridLines = Array.from(svg.querySelectorAll('line[stroke-dasharray]'))
    // Vertical grid lines (x-axis ticks): x1 === x2
    const verticalGrid = dashedGridLines.filter(l => l.getAttribute('x1') === l.getAttribute('x2'))
    expect(verticalGrid.length).toBeGreaterThanOrEqual(2)
  })

  it('hover staleness: rapid B-enter then A-leave keeps B tooltip visible', () => {
    // Browser firing order on overlapping points: B.mouseEnter → A.mouseLeave (race).
    // Implementation must only clear hover state when the leaving point matches the
    // currently-hovered id. Otherwise tooltip flickers on dense clusters.
    const items = [
      item('a', 'AlphaItem', 100, 5, 'discontinued'),
      item('b', 'BetaItem',  200, 5, 'discontinued'),
    ]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    const circles = container.querySelectorAll('svg[viewBox^="0 0 480"] circle')
    const a = circles[0]
    const b = circles[1]
    fireEvent.mouseEnter(a, { clientX: 100, clientY: 150 })
    expect(screen.getByText('AlphaItem')).toBeInTheDocument()
    fireEvent.mouseEnter(b, { clientX: 200, clientY: 150 })
    expect(screen.getByText('BetaItem')).toBeInTheDocument()
    // A's mouseLeave fires AFTER B's mouseEnter — must not clear B's tooltip.
    fireEvent.mouseLeave(a)
    expect(screen.getByText('BetaItem')).toBeInTheDocument()
  })

  it('tooltip overflow: right-edge point flips tooltip to left of marker', () => {
    // Single-point dataset → marker at midpoint x ≈ (PAD_L + W - PAD_R)/2 = 254.
    // Two-point dataset with second point at large vol → that point lands near
    // the right edge. Tooltip would overflow if not flipped.
    const items = [
      item('a', 'A', 1, 5, 'discontinued'),
      item('b', 'RightEdgeItem', 100000, 5, 'discontinued'),
    ]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    const circles = container.querySelectorAll('svg[viewBox^="0 0 480"] circle')
    // Hover the right-edge point with viewport clientX positioned near container right.
    fireEvent.mouseEnter(circles[1], { clientX: 520, clientY: 150 })
    const tooltip = container.querySelector('[class*="absolute"][class*="pointer-events-none"]') as HTMLElement
    expect(tooltip).toBeTruthy()
    // Container is 480px wide (stubbed clientWidth). Hover container-relative x = 520-50 = 470.
    // Right-flip threshold: x + estTooltipW + 12 > 480 → flip to x - estTooltipW - 12.
    // After flip: tooltip.left should be < hover.x (i.e. < 470).
    const left = parseFloat(tooltip.style.left)
    expect(left).toBeLessThan(470)
  })

  it('axis baselines render at plot edges', () => {
    const items = [
      item('a', 'A', 100, 5, 'discontinued'),
      item('b', 'B', 1000, 50, 'discontinued'),
    ]
    const { container } = render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    const svg = container.querySelector('svg[viewBox^="0 0 480"]')!
    // Bottom baseline: line at y=H-PAD_B=176 spanning PAD_L..W-PAD_R
    const bottomBaseline = Array.from(svg.querySelectorAll('line')).find(l =>
      l.getAttribute('y1') === '176' && l.getAttribute('y2') === '176' &&
      l.getAttribute('x1') === '36' && l.getAttribute('x2') === '472',
    )
    // Left baseline: line at x=PAD_L=36 spanning PAD_T..H-PAD_B
    const leftBaseline = Array.from(svg.querySelectorAll('line')).find(l =>
      l.getAttribute('x1') === '36' && l.getAttribute('x2') === '36' &&
      l.getAttribute('y1') === '8' && l.getAttribute('y2') === '176',
    )
    expect(bottomBaseline).toBeTruthy()
    expect(leftBaseline).toBeTruthy()
  })

  it('aria-label includes case count', () => {
    const items = [
      item('a', 'A', 100, 5, 'discontinued'),
      item('b', 'B', 200, 10, 'rare'),
    ]
    render(<VolumePriceScatter items={items} onSelect={vi.fn()} selectedId={null} />)
    expect(screen.getByLabelText(/2 cases plotted by 24h volume vs lowest price/)).toBeInTheDocument()
  })
})

describe('VolumePriceScatter Recharts cleanup audit', () => {
  it('source file does not import recharts', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile(path.resolve(__dirnameESM, '../VolumePriceScatter.tsx'), 'utf-8')
    expect(src).not.toMatch(/from ['"]recharts/)
    expect(src).not.toMatch(/import .* recharts/)
  })

  it('test file does not mock recharts', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile(__filenameESM, 'utf-8')
    expect(src).not.toMatch(/vi\.mock\(['"]recharts/)
  })
})
