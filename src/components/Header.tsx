import { useEffect, useState } from 'react'
import { C } from '../lib/theme'
import { StatusDot } from './Atoms'
import { LiveRegion } from './primitives/LiveRegion'
import type { MarketStats } from '../lib/api'

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect x="2" y="2" width="24" height="24" fill={C.orange} opacity="0.08" />
        <rect x="2" y="2" width="24" height="24" fill="none" stroke={C.orange} strokeWidth="1.5" />
        <circle cx="14" cy="14" r="6" fill="none" stroke={C.cyan} strokeWidth="1.5" />
        <line x1="14" y1="2" x2="14" y2="6" stroke={C.cyan} strokeWidth="1.5" />
        <line x1="14" y1="22" x2="14" y2="26" stroke={C.cyan} strokeWidth="1.5" />
        <line x1="2" y1="14" x2="6" y2="14" stroke={C.cyan} strokeWidth="1.5" />
        <line x1="22" y1="14" x2="26" y2="14" stroke={C.cyan} strokeWidth="1.5" />
        <circle cx="14" cy="14" r="1.6" fill={C.orange} />
      </svg>
      <div>
        <h1 className="font-display text-[20px] tracking-[0.12em] leading-none text-ink-0 m-0">CASE SNIPER</h1>
        <p className="text-[9px] tracking-[0.2em] text-ink-2 mt-0.5 m-0">CS2 / MARKET INTELLIGENCE / v1.0</p>
      </div>
    </div>
  )
}

interface Props {
  fetching: boolean
  stats: MarketStats | null
  onLogout?: () => void
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function Header({ fetching, stats, onLogout }: Props) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const lastSnap = stats?.last_snapshot_at
  const ageSec = lastSnap ? Math.floor(now.getTime() / 1000) - lastSnap : null
  const stale = ageSec != null && ageSec > 7200 // older than 2h = stale

  let feedColor: string = C.t3
  let feedLabel = 'IDLE'
  if (fetching) { feedColor = C.orange; feedLabel = 'SYNCING' }
  else if (stale) { feedColor = C.yellow; feedLabel = 'STALE' }
  else if (lastSnap) { feedColor = C.green; feedLabel = 'LIVE' }

  return (
    <header className="border-b border-line bg-bg-1 px-5 py-3.5 flex items-center justify-between sticky top-0 z-50 backdrop-blur">
      <Logo />
      <div className="flex items-center gap-6 text-[11px] text-ink-1">
        <div className="flex items-center gap-2">
          <StatusDot color={feedColor} pulse={fetching} />
          <span className="text-ink-2 tracking-[0.1em] text-[10px]">FEED</span>
          <LiveRegion politeness="polite">
            <span style={{ color: feedColor }}>{feedLabel}</span>
          </LiveRegion>
        </div>
        <div className="text-ink-3">|</div>
        <div className="flex items-center gap-1.5">
          <span className="text-ink-2 tracking-[0.1em] text-[10px]">LAST SWEEP</span>
          <span style={{ color: stale ? C.yellow : C.t1 }}>
            {ageSec == null ? '—' : formatAge(ageSec)}
          </span>
        </div>
        <div className="text-ink-3">|</div>
        <div>
          <span className="text-ink-2 tracking-[0.1em] text-[10px] mr-1.5">UTC</span>
          {now.toUTCString().slice(17, 25)}
        </div>
        {onLogout && (
          <>
            <div className="text-ink-3">|</div>
            <button
              onClick={onLogout}
              className="text-ink-2 tracking-[0.1em] text-[10px] hover:text-red-400 transition-colors"
              title="Sign out — clears your session token"
            >
              SIGN OUT
            </button>
          </>
        )}
      </div>
    </header>
  )
}

