import { MarketScanPanel } from './Panels'
import { MoversPanel } from './MoversPanel'
import type { ComponentProps } from 'react'

export type MktTabValue = 'scan' | 'movers'

interface Props {
  value: MktTabValue
  onChange: (next: MktTabValue) => void
  scan: ComponentProps<typeof MarketScanPanel>
  movers: ComponentProps<typeof MoversPanel>
}

const TABS: { id: MktTabValue; label: string; panelId: string; tabId: string }[] = [
  { id: 'scan',   label: 'MARKET SCAN', panelId: 'mkt-panel-scan',   tabId: 'mkt-tab-scan'   },
  { id: 'movers', label: 'MOVERS',      panelId: 'mkt-panel-movers', tabId: 'mkt-tab-movers' },
]

/**
 * Phase 4.5 Plan 2 — MKT Tabs.
 *
 * Wraps MarketScanPanel + MoversPanel in an ARIA-compliant tablist. Both
 * panels render simultaneously (preserves component state — scan output,
 * movers `days` selector) but the inactive one carries the `hidden`
 * attribute so screen-readers + visual layout treat it as collapsed.
 *
 * Cmd+K integration: callers MUST set tab BEFORE scrollIntoView (the
 * `hidden` panel has no layout box; scroll would no-op). App.tsx's
 * Cmd+K handler uses requestAnimationFrame to defer the scroll one
 * frame after onChange so React has time to flip hidden=false.
 */
export function MktTabs({ value, onChange, scan, movers }: Props) {
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const idx = TABS.findIndex(t => t.id === value)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(TABS[(idx - 1 + TABS.length) % TABS.length].id)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(TABS[(idx + 1) % TABS.length].id)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(TABS[0].id)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(TABS[TABS.length - 1].id)
    }
  }

  return (
    <div data-test="mkt-tabs" className="flex flex-col">
      <div role="tablist" aria-label="Market view" className="flex border-b border-line">
        {TABS.map(t => {
          const active = t.id === value
          return (
            <button
              key={t.id}
              id={t.tabId}
              role="tab"
              aria-selected={active}
              aria-controls={t.panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={onKeyDown}
              className={`px-4 py-2 text-[10px] tracking-[0.2em] bg-transparent border-r border-line ${
                active
                  ? 'text-accent-sel border-b border-accent-sel -mb-px'
                  : 'text-ink-2 hover:text-ink-1'
              }`}
              type="button"
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id="mkt-panel-scan"
        aria-labelledby="mkt-tab-scan"
        hidden={value !== 'scan'}
      >
        <div data-test="market-scan-panel">
          <MarketScanPanel {...scan} />
        </div>
      </div>

      <div
        role="tabpanel"
        id="mkt-panel-movers"
        aria-labelledby="mkt-tab-movers"
        hidden={value !== 'movers'}
      >
        <div data-test="movers-panel">
          <MoversPanel {...movers} />
        </div>
      </div>
    </div>
  )
}
