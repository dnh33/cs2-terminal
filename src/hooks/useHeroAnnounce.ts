import { useEffect, useRef, useState } from 'react'
import type { MoverRow } from '../lib/api'
import { announceConfig } from '../components/hero-announce-config'

interface HeroState {
  dollarVolume24h: number | null
  biggestMover: MoverRow | null
}

export function useHeroAnnounce(state: HeroState): string {
  const [message, setMessage] = useState('')
  const lastEmitted = useRef<HeroState>({ dollarVolume24h: null, biggestMover: null })
  const lastEmitAt = useRef<number>(0)

  useEffect(() => {
    const now = Date.now()
    if (now - lastEmitAt.current < announceConfig.debounceMs) return

    const last = lastEmitted.current
    const volCross = isMaterialChange(last.dollarVolume24h, state.dollarVolume24h)
    const moverCross = moverIdentity(state.biggestMover) !== moverIdentity(last.biggestMover)

    if (!volCross && !moverCross) return

    const volFmt =
      state.dollarVolume24h != null ? `$${state.dollarVolume24h.toLocaleString('en-US')}` : '—'
    const moverStr = state.biggestMover
      ? `BIGGEST MOVER ${moverIdentity(state.biggestMover)} ${state.biggestMover.pct_change >= 0 ? 'up' : 'down'} ${Math.round(Math.abs(state.biggestMover.pct_change))}%`
      : 'BIGGEST MOVER —'

    setMessage(`HERO update: 24H DOLLAR VOLUME ${volFmt}, ${moverStr}`)
    lastEmitted.current = state
    lastEmitAt.current = now
  }, [state.dollarVolume24h, state.biggestMover])

  return message
}

function moverIdentity(m: MoverRow | null | undefined): string | null {
  if (!m) return null
  // MoverRow has `name`; some test fixtures use `short_name`. Accept either.
  return (m as { name?: string; short_name?: string }).name
    ?? (m as { short_name?: string }).short_name
    ?? null
}

function isMaterialChange(prev: number | null, next: number | null): boolean {
  if (prev == null || next == null) return prev !== next
  const absDelta = Math.abs(next - prev)
  if (absDelta >= announceConfig.thresholdAbsolute) return true
  if (prev !== 0 && absDelta / Math.abs(prev) >= announceConfig.thresholdRelative) return true
  return false
}
