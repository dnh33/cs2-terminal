import { PoolBadge } from './Atoms'
import { PriceChart } from './Charts'
import { AnalysisOutput } from './AnalysisOutput'
import { Banner } from './primitives/Banner'
import { Drawer } from './primitives/Drawer'
import { FitBlock } from './FitBlock'
import { PeersList } from './PeersList'
import { RoiCalculator } from './RoiCalculator'
import { DecisionLog } from './DecisionLog'
import { VerdictBadge } from './VerdictBadge'
import type { ItemFull } from './CaseTable'
import type { FitResult } from '../lib/fitScore'
import type { Verdict } from '../lib/useDecisionLog'

interface PeerCandidate {
  id: string
  name: string
  result: FitResult
}

interface Props {
  item: ItemFull | undefined
  onAnalyze: () => void
  analysis: string | null
  analyzing: boolean
  error: string | null
  fit?: FitResult
  peers?: PeerCandidate[]
  onSelectPeer?: (caseId: string) => void
  /** From Plan 3 structured analysis — Plan 2 ships the slot, Plan 3 wires the value */
  verdict?: Verdict
  confidence?: number
  /**
   * P3-T36: when true, the selected case was opened by clicking a CaseChip in
   * the most recent Market Scan output (vs direct table click). Renders a
   * compact "↳ FROM THIS SCAN" pill near the header so the user has a
   * breadcrumb back to the scan that originated the inspection.
   */
  fromScan?: boolean
  /**
   * Optional close handler used by the mobile Drawer wrapper (Esc / backdrop).
   * Desktop ignores it. Defaults to a noop so existing call-sites that don't
   * pass it remain valid (DetailPanel API stays the same per Plan 2 T27).
   */
  onClose?: () => void
  /**
   * P3-T38: re-run the analysis with reversed framing ("argue the OPPOSITE
   * side"). Button only renders when an analysis already exists, so the
   * empty state stays clean.
   */
  onDevilsAdvocate?: () => void
}

export function DetailPanel({
  item, onAnalyze, analysis, analyzing, error,
  fit, peers, onSelectPeer, verdict, confidence, fromScan, onClose, onDevilsAdvocate,
}: Props) {
  if (!item) {
    return (
      <div className="p-10 text-center text-ink-3 text-[12px] tracking-[0.1em]">
        // SELECT A CASE FROM THE TABLE TO INSPECT
      </div>
    )
  }
  const m = item.metrics, p = item.price

  const body = (
    <div className="animate-fade-up">
      {/* Header */}
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

      {/* From-scan pill (T36) — breadcrumb back to the originating scan */}
      {fromScan && (
        <div className="px-5 py-2 border-b border-line bg-accent-data/[0.04] text-[11px] text-accent-data flex items-center gap-2">
          <span className="font-bold tracking-[0.15em] text-[9px] shrink-0">↳ FROM THIS SCAN</span>
        </div>
      )}

      {/* Price summary (kept — terminal-essential) */}
      {p && (
        <div className="grid grid-cols-3 border-b border-line">
          <div className="px-5 py-3.5 border-r border-line">
            <div className="text-[9px] tracking-[0.2em] text-ink-2">LOWEST ASK</div>
            <div className="font-display text-[28px] text-accent-sel leading-tight">${p.lowest.toFixed(2)}</div>
            <div className="text-[10px] text-ink-2">median ${(p.median || 0).toFixed(2)}</div>
          </div>
          <div className="px-5 py-3.5 border-r border-line">
            <div className="text-[9px] tracking-[0.2em] text-ink-2">24H VOLUME</div>
            <div className="font-display text-[28px] text-accent-data leading-tight">{p.volume.toLocaleString()}</div>
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

      {/* FIT block (T22) */}
      {fit ? (
        <FitBlock result={fit} />
      ) : (
        <div className="px-5 py-4 border-b border-line text-[11px] text-ink-3 tracking-[0.1em]">
          // FIT computing…
        </div>
      )}

      {/* PEERS (T23) */}
      {fit && peers && onSelectPeer && (
        <PeersList target={fit} candidates={peers} onSelect={onSelectPeer} />
      )}

      {/* Price chart with history zoom (T25) */}
      <div className="px-5 py-4 border-b border-line">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// PRICE TRAJECTORY</h3>
          <span className="text-[9px] text-ink-3">
            {item.history.some((h) => h.source === 'real') ? 'real history from worker' : 'modeled from current px'}
          </span>
        </div>
        <PriceChart item={item} />
      </div>

      {/* ROI calc (T24) */}
      {p && <RoiCalculator buyPrice={p.lowest} />}

      {/* LLM-native thesis (preserved from Phase 1) */}
      <div className="px-5 py-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// LLM-NATIVE THESIS</h3>
            <VerdictBadge loading={analyzing} verdict={verdict} confidence={confidence} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAnalyze}
              disabled={analyzing}
              className={`text-[10px] tracking-[0.15em] px-3.5 py-1.5 font-bold ${
                analyzing
                  ? 'bg-bg-3 text-ink-2 border border-line-bright cursor-not-allowed'
                  : 'bg-accent-sel text-bg-0 border border-accent-sel hover:opacity-90'
              }`}
            >
              {analyzing ? 'ANALYZING...' : '▸ RUN ANALYSIS'}
            </button>
            {analysis && onDevilsAdvocate && (
              <button
                onClick={onDevilsAdvocate}
                disabled={analyzing}
                className="text-[10px] tracking-[0.15em] px-3.5 py-1.5 font-bold border border-state-warn text-state-warn hover:bg-state-warn/10 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Re-run with reversed framing"
              >
                ⚖ DEVIL'S ADVOCATE
              </button>
            )}
          </div>
        </div>
        {error && <Banner variant="error" className="mb-3">Analysis failed. {error}</Banner>}
        {analysis && <AnalysisOutput text={analysis} />}
        {!analysis && !analyzing && !error && (
          <div className="text-[11px] text-ink-3 p-5 border border-dashed border-line-bright text-center tracking-[0.1em]">
            Run analysis to get a Claude-generated investment thesis using current market data.
          </div>
        )}
      </div>

      {item && fit && (
        <DecisionLog
          caseId={item.id}
          caseName={item.name}
          snapshotAt={fit.snapshot_at * 1000}
          priceAtCommit={item.price?.lowest ?? 0}
          verdict={verdict}
          confidence={confidence}
        />
      )}
    </div>
  )

  // P2-T27: render inline body on desktop (md+); on mobile (<md) the same body
  // is wrapped in a full-screen Drawer that opens whenever an item is selected.
  // jsdom can't run media queries, so tests assert class presence per P0-5.
  return (
    <>
      <div data-test="detail-desktop" className="hidden md:block">
        {body}
      </div>
      <div data-test="detail-mobile" className="md:hidden">
        <Drawer open={!!item} onClose={onClose ?? (() => {})} ariaLabel="Case detail">
          {body}
        </Drawer>
      </div>
    </>
  )
}
