import type { FitResult } from '../lib/fitScore'

interface Candidate {
  id: string
  name: string
  result: FitResult
}

interface Props {
  target: FitResult
  candidates: Candidate[]
  onSelect: (caseId: string) => void
}

function distance(a: FitResult, b: FitResult): number {
  const aC = a.components, bC = b.components
  let s = 0
  s += (aC.liquidity.score - bC.liquidity.score) ** 2
  s += (aC.momentum.score - bC.momentum.score) ** 2
  s += (aC.supply_tightness.score - bC.supply_tightness.score) ** 2
  s += (aC.content_quality.score - bC.content_quality.score) ** 2
  s += (aC.unbox_ev_ratio.score - bC.unbox_ev_ratio.score) ** 2
  s += (aC.crowding_risk.score - bC.crowding_risk.score) ** 2
  return Math.sqrt(s)
}

export function PeersList({ target, candidates, onSelect }: Props) {
  const filtered = candidates.filter((c) => c.id !== target.case_id && c.result.status === 'ok')
  const sorted = [...filtered]
    .map((c) => ({ ...c, dist: distance(target, c.result) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)

  return (
    <div className="px-5 py-4 border-b border-line">
      <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold mb-3 m-0">// PEERS</h3>
      {sorted.length === 0 ? (
        <div className="text-[11px] text-ink-3 tracking-[0.1em]">// no peers yet — wait for FIT to compute on more cases</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {sorted.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="text-left px-3 py-2 border border-line bg-bg-2 hover:border-accent-sel"
            >
              <div className="text-[11px] text-ink-0 truncate">{c.name}</div>
              <div className="text-[9px] text-ink-3 tracking-[0.1em] tabular-nums">FIT {Math.round(c.result.fit)} · Δ {Math.round(c.dist)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
