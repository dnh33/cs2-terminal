type Verdict = 'LONG' | 'FLAT' | 'AVOID'
type Tone = 'up' | 'warn' | 'err' | 'muted'

interface Props {
  loading: boolean
  verdict?: Verdict
  confidence?: number
}

const TONE_BY_VERDICT: Record<Verdict, Tone> = {
  LONG: 'up',
  FLAT: 'warn',
  AVOID: 'err',
}

const TONE_BG: Record<Tone, string> = {
  up:    'rgb(var(--delta-up-rgb) / 0.12)',
  warn:  'rgb(var(--state-warn-rgb) / 0.12)',
  err:   'rgb(var(--state-err-rgb) / 0.12)',
  muted: 'rgb(var(--ink-3-rgb) / 0.08)',
}

const TONE_FG: Record<Tone, string> = {
  up:    'var(--delta-up)',
  warn:  'var(--state-warn)',
  err:   'var(--state-err)',
  muted: 'var(--ink-2)',
}

export function VerdictBadge({ loading, verdict, confidence }: Props) {
  if (loading && !verdict) {
    return (
      <span
        data-tone="muted"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 t-data-bold tabular-nums motion-safe:animate-pulse-sigil"
        style={{ background: TONE_BG.muted, color: TONE_FG.muted }}
      >
        ANALYZING…
      </span>
    )
  }
  if (!verdict) return null
  const tone = TONE_BY_VERDICT[verdict]
  const pct = confidence !== undefined ? `· ${Math.round(confidence * 100)}%` : ''
  return (
    <span
      data-tone={tone}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 t-data-bold tabular-nums"
      style={{ background: TONE_BG[tone], color: TONE_FG[tone] }}
    >
      {verdict} {pct}
    </span>
  )
}
