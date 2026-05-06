import type { FitResult, FitComponent } from '../lib/fitScore'

interface Props {
  result: FitResult
}

const ROW_LABELS: Array<{ key: keyof Omit<FitResult['components'], 'catalyst'>; label: string }> = [
  { key: 'liquidity',         label: 'LIQ' },
  { key: 'momentum',          label: 'MOM' },
  { key: 'supply_tightness',  label: 'SUPPLY' },
  { key: 'content_quality',   label: 'CONTENT' },
  { key: 'unbox_ev_ratio',    label: 'UNBOX EV' },
  { key: 'crowding_risk',     label: 'CROWDING' },
]

function fitColor(fit: number): string {
  if (fit >= 70) return 'var(--ink-0)'
  if (fit >= 50) return 'var(--accent-sel)'
  return 'var(--state-warn)'
}

function Bar({ value }: { value: number }) {
  const opacity = value >= 50 ? 1 : 0.4
  return (
    <div className="h-1 bg-bg-3 relative" aria-hidden="true">
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: 'var(--accent-sel)',
          opacity,
        }}
      />
    </div>
  )
}

export function FitBlock({ result }: Props) {
  if (result.status === 'stale_data') return null

  const insufficient = result.status === 'insufficient_history'
  const fitDisplay = insufficient ? '--' : Math.round(result.fit).toString()
  const fitColorVal = insufficient ? 'var(--ink-3)' : fitColor(result.fit)

  return (
    <div data-test="fit-block" className="px-5 py-4 border-b border-line">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// FIT</h3>
        <span className="text-[9px] text-ink-3 tracking-[0.1em]">
          {result.confidence === 'low' ? 'LOW CONFIDENCE' : `pool-relative · ${result.weights_version}`}
        </span>
      </div>

      <div className="grid items-center gap-4" style={{ gridTemplateColumns: '64px 1fr' }}>
        <div className="text-center">
          <div className="font-display tabular-nums leading-none" style={{ fontSize: '40px', color: fitColorVal }}>
            {fitDisplay}
          </div>
          <div className="text-[9px] text-ink-3 tracking-[0.1em] mt-1">/100</div>
        </div>

        <div className="space-y-2">
          {ROW_LABELS.map((row) => {
            const c: FitComponent = result.components[row.key]
            return (
              <div key={row.key} className="grid items-center gap-2" style={{ gridTemplateColumns: '72px 1fr 36px' }}>
                <div className="text-[10px] text-ink-2 tracking-[0.15em] font-mono">{row.label}</div>
                {insufficient
                  ? <div className="h-1 bg-bg-3" aria-hidden="true" />
                  : <Bar value={c.score} />}
                <div className="text-[10px] text-ink-1 tabular-nums text-right font-mono">
                  {insufficient ? '—' : Math.round(c.score)}
                </div>
              </div>
            )
          })}
          <div className="grid items-center gap-2" style={{ gridTemplateColumns: '72px 1fr 36px' }}>
            <div className="text-[10px] text-ink-3 tracking-[0.15em] font-mono">CATALYST</div>
            <div className="h-1 bg-bg-3" aria-hidden="true" />
            <div className="text-[10px] text-ink-3 tabular-nums text-right font-mono">—</div>
          </div>
        </div>
      </div>
    </div>
  )
}
