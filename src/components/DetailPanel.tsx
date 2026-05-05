import { C } from '../lib/theme'
import { PoolBadge } from './Atoms'
import { PriceChart } from './Charts'
import { AnalysisOutput } from './AnalysisOutput'
import type { ItemFull } from './CaseTable'

function MetricBar({
  label, value, max = 100, color = C.cyan, tooltip,
}: { label: string; value: number; max?: number; color?: string; tooltip?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-ink-2 tracking-[0.1em]" title={tooltip}>{label}</span>
        <span className="text-ink-0 font-semibold">{value.toFixed(0)}</span>
      </div>
      <div className="h-1 bg-bg-3 relative" aria-hidden="true">
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  )
}

interface Props {
  item: ItemFull | undefined
  onAnalyze: () => void
  analysis: string | null
  analyzing: boolean
  error: string | null
}

export function DetailPanel({ item, onAnalyze, analysis, analyzing, error }: Props) {
  if (!item) {
    return (
      <div className="p-10 text-center text-ink-3 text-[12px] tracking-[0.1em]">
        // SELECT A CASE FROM THE TABLE TO INSPECT
      </div>
    )
  }
  const m = item.metrics, p = item.price

  return (
    <div className="animate-fade-up">
      <div
        className="px-5 py-4 border-b border-line"
        style={{ background: 'linear-gradient(180deg, rgba(255,116,33,0.04), transparent)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] tracking-[0.2em] text-ink-2 mb-1.5 m-0">// SELECTED INSTRUMENT</p>
            <h2 className="font-display text-[28px] tracking-[0.02em] leading-none text-ink-0 m-0">
              {item.name.toUpperCase()}
            </h2>
            <div className="text-[11px] text-ink-2 mt-1.5">{item.notable}</div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <PoolBadge pool={item.pool} />
            <div className="text-[10px] text-ink-2 tracking-[0.1em]">{item.released}</div>
          </div>
        </div>
      </div>

      {p && (
        <div className="grid grid-cols-3 border-b border-line">
          <div className="px-5 py-3.5 border-r border-line">
            <div className="text-[9px] tracking-[0.2em] text-ink-2">LOWEST ASK</div>
            <div className="font-display text-[28px] text-accent-orange leading-tight">${p.lowest.toFixed(2)}</div>
            <div className="text-[10px] text-ink-2">median ${(p.median || 0).toFixed(2)}</div>
          </div>
          <div className="px-5 py-3.5 border-r border-line">
            <div className="text-[9px] tracking-[0.2em] text-ink-2">24H VOLUME</div>
            <div className="font-display text-[28px] text-accent-cyan leading-tight">{p.volume.toLocaleString()}</div>
            <div className="text-[10px] text-ink-2">units sold</div>
          </div>
          <div className="px-5 py-3.5">
            <div className="text-[9px] tracking-[0.2em] text-ink-2">BREAK-EVEN</div>
            <div className="font-display text-[28px] text-ink-0 leading-tight">
              ${(m?.breakeven || 0).toFixed(2)}
            </div>
            <div className="text-[10px] text-ink-2">after 15% fee</div>
          </div>
        </div>
      )}

      <div className="px-5 py-4 border-b border-line">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// PRICE TRAJECTORY</h3>
          <span className="text-[9px] text-ink-3">
            {item.history.some(h => h.source === 'real') ? 'real history from worker' : 'modeled from current px'}
          </span>
        </div>
        <PriceChart item={item} />
      </div>

      {m && (
        <div className="px-5 py-4 border-b border-line">
          <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold mb-3 m-0">// SIGNALS</h3>
          <MetricBar label="LIQUIDITY" value={m.liquidity} color={C.cyan} />
          <MetricBar label="SCARCITY (POOL × AGE)" value={m.scarcity} color={C.orange} />
          <MetricBar label="POOL APPRECIATION BIAS" value={m.poolMul * 100} color={C.purple} />
          <MetricBar
            label="SPREAD FRICTION"
            value={Math.max(0, Math.min(m.spreadPct * 5, 100))}
            color={C.yellow}
            tooltip={m.spreadPct < 0 ? 'median < lowest — likely illiquid or stale median' : undefined}
          />
        </div>
      )}

      <div className="px-5 py-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// LLM-NATIVE THESIS</h3>
          <button
            onClick={onAnalyze}
            disabled={analyzing}
            className={`text-[10px] tracking-[0.15em] px-3.5 py-1.5 font-bold ${
              analyzing
                ? 'bg-bg-3 text-ink-2 border border-line-bright cursor-not-allowed'
                : 'bg-accent-orange text-bg-0 border border-accent-orange hover:opacity-90'
            }`}
          >
            {analyzing ? 'ANALYZING...' : '▸ RUN ANALYSIS'}
          </button>
        </div>
        {error && (
          <div className="text-[11px] text-accent-red p-2 border border-accent-red bg-accent-red/5 mb-3">
            ERR: {error}
          </div>
        )}
        {analysis && <AnalysisOutput text={analysis} />}
        {!analysis && !analyzing && !error && (
          <div className="text-[11px] text-ink-3 p-5 border border-dashed border-line-bright text-center tracking-[0.1em]">
            Run analysis to get a Claude-generated investment thesis using current market data.
          </div>
        )}
      </div>
    </div>
  )
}
