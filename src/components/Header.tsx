import { LiveRegion } from './primitives/LiveRegion'
import { PaletteSwitch } from './primitives/PaletteSwitch'
import { StatusSigil } from './primitives/StatusSigil'
import { UtcClock } from './primitives/UtcClock'
import type { MarketStats } from '../lib/api'

interface Props {
  fetching: boolean
  stats: MarketStats | null
  onLogout?: () => void
  onOpenCmdK?: () => void
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function Header({ fetching, stats, onLogout, onOpenCmdK }: Props) {
  const lastSnap = stats?.last_snapshot_at
  const ageSec = lastSnap ? Math.floor(Date.now() / 1000) - lastSnap : null
  const stale = ageSec != null && ageSec > 7200
  const status: 'live' | 'syncing' | 'stale' | 'idle' | 'err' =
    fetching ? 'syncing' :
    stale ? 'stale' :
    lastSnap ? 'live' : 'idle'
  const ageLabel = ageSec == null ? '—' : formatAge(ageSec)

  return (
    <header style={{ height: 'var(--header-h)' }} className="border-b border-line bg-bg-1 px-5 py-3 sticky top-0 z-50 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <StatusSigil status={status} lastCronTick={stats?.last_cron?.started_at} />
          <div>
            <h1 className="t-display-2 text-ink-0 m-0">CASE SNIPER</h1>
            <LiveRegion politeness="polite" className="t-micro text-ink-2" as="div">
              {status.toUpperCase()} · {ageLabel} · {stats?.last_cron ? `${stats.last_cron.succeeded}/${stats.last_cron.succeeded + stats.last_cron.failed} OK` : '—'}
            </LiveRegion>
          </div>
        </div>
        <div data-test="header-controls" className="hidden md:flex items-center gap-3 text-ink-2">
          {onOpenCmdK && (
            <>
              <button
                type="button"
                onClick={onOpenCmdK}
                className="t-label text-ink-2 hover:text-ink-0 px-2 py-1 border border-line-bright"
                title="Open command palette"
                aria-label="Open command palette"
              >
                ⌘K
              </button>
              <span className="text-ink-3">·</span>
            </>
          )}
          <PaletteSwitch />
          <span className="text-ink-3">·</span>
          <span className="t-data text-accent-data">claude-sonnet-4.5</span>
          <span className="text-ink-3">·</span>
          <UtcClock />
          {onLogout && (
            <>
              <span className="text-ink-3">·</span>
              <button
                type="button"
                onClick={onLogout}
                className="t-label text-ink-2 hover:text-state-err"
                title="Sign out — clears your session token"
              >
                SIGN OUT
              </button>
            </>
          )}
        </div>
        {/* Mobile cluster — sign-out only, plus a slot for the future ⌘K hint button (T36) */}
        <div className="flex md:hidden items-center gap-3 text-ink-2">
          {onOpenCmdK && (
            <button
              type="button"
              onClick={onOpenCmdK}
              className="t-label text-ink-2 hover:text-ink-0 px-2 py-1 border border-line-bright"
              title="Open command palette"
              aria-label="Open command palette"
            >
              ⌘K
            </button>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="t-label text-ink-2 hover:text-state-err"
              title="Sign out"
            >
              SIGN OUT
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
