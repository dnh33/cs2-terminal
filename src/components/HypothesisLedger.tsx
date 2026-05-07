import { useEffect, useRef, useState } from 'react'
import {
  useHypothesisLedger,
  type Comparator,
  type Hypothesis,
} from '../lib/useHypothesisLedger'

interface Props {
  caseId: string
  caseName: string
  priceAtCommit: number
  snapshotAt: number
}

function fmtTime(ms: number): string {
  const d = new Date(ms)
  const date = d.toISOString().slice(0, 10)
  const hh = d.getUTCHours().toString().padStart(2, '0')
  const mm = d.getUTCMinutes().toString().padStart(2, '0')
  return `${date} ${hh}:${mm}`
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function expandShorthand(value: string): string {
  const m = value.trim().match(/^(\d+)([dwm])$/i)
  if (!m) return value
  const n = parseInt(m[1], 10)
  const unit = m[2].toLowerCase()
  const days = unit === 'd' ? n : unit === 'w' ? n * 7 : n * 30
  const target = new Date(Date.now() + days * 86_400_000)
  return target.toISOString().slice(0, 10)
}

function isFutureDateUTC(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return s > todayUTC()
}

function HypothesisRow({ h, fresh }: { h: Hypothesis; fresh: boolean }) {
  const isStale = h.resolution?.outcome === 'STALE'
  const flashColor =
    h.resolution?.outcome === 'HIT' ? 'var(--delta-up)' :
    h.resolution?.outcome === 'MISS' ? 'var(--state-err)' : 'transparent'

  const outcomeText = h.resolution === null ? 'PENDING' : h.resolution.outcome
  const outcomeColor =
    h.resolution === null ? 'var(--ink-2)' :
    h.resolution.outcome === 'HIT' ? 'var(--delta-up)' :
    h.resolution.outcome === 'MISS' ? 'var(--state-err)' : 'var(--ink-3)'

  return (
    <li
      className={`flex items-center gap-3 text-[11px] text-ink-1 tabular-nums py-1 transition-[border-color,padding] duration-[1500ms] ease-out ${isStale ? 'opacity-50' : ''}`}
      style={{
        borderLeft: fresh ? `2px solid ${flashColor}` : '2px solid transparent',
        paddingLeft: fresh ? '8px' : '0',
      }}
    >
      <span className="text-ink-3">{fmtTime(h.committedAt)}</span>
      <span className="text-ink-3">·</span>
      <span>
        <span className="font-mono text-ink-1">{h.comparator === 'gte' ? '≥' : '≤'}</span>{' '}
        ${h.targetPrice.toFixed(2)} by {h.targetDate}
      </span>
      <span className="text-ink-3">·</span>
      <span className="text-ink-2">{h.confidence}%</span>
      <span className="ml-auto flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.2em] font-bold" style={{ color: outcomeColor }}>
          {outcomeText}
        </span>
        {h.resolution?.outcome === 'HIT' && h.resolution.observed && (
          <span className="text-ink-3 font-mono">${h.resolution.observed.min.toFixed(2)}</span>
        )}
        {h.resolution?.outcome === 'MISS' && h.resolution.observed && (
          <span className="text-ink-3 font-mono">${h.resolution.observed.max.toFixed(2)} max</span>
        )}
      </span>
    </li>
  )
}

function HypothesisRowMounted({ h }: { h: Hypothesis }) {
  // Compute "fresh" once at mount: was this resolved within the last 60s?
  const initiallyFresh = useRef(
    h.resolution !== null &&
    h.resolution.outcome !== 'STALE' &&
    Date.now() - h.resolution.resolvedAt < 60_000,
  ).current
  const [flashing, setFlashing] = useState(initiallyFresh)
  useEffect(() => {
    if (!flashing) return
    const t = setTimeout(() => setFlashing(false), 1500)
    return () => clearTimeout(t)
  }, [flashing])
  return <HypothesisRow h={h} fresh={flashing} />
}

export function HypothesisLedger({ caseId, caseName, priceAtCommit, snapshotAt }: Props) {
  const { entries, commit } = useHypothesisLedger()
  const [pending, setPending] = useState(false)
  const [comparator, setComparator] = useState<Comparator>('lte')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState('')
  const [confidence, setConfidence] = useState('50')
  const [note, setNote] = useState('')

  const ours = entries.filter(e => e.caseId === caseId)

  const priceNum = parseFloat(price)
  const priceOk = Number.isFinite(priceNum) && priceNum > 0
  const dateOk = isFutureDateUTC(date)
  const confNum = parseInt(confidence, 10)
  const confOk = Number.isFinite(confNum) && confNum >= 0 && confNum <= 100
  const canConfirm = priceOk && dateOk && confOk

  function handleStart() { setPending(true) }
  function handleCancel() {
    setPending(false)
    setComparator('lte')
    setPrice(''); setDate(''); setConfidence('50'); setNote('')
  }
  function handleConfirm() {
    if (!canConfirm) return
    commit({
      caseId, caseName, comparator,
      targetPrice: priceNum,
      targetDate: date,
      confidence: confNum,
      priceAtCommit, snapshotAt,
      note,
    })
    handleCancel()
  }
  function handleDateBlur() {
    const expanded = expandShorthand(date)
    if (expanded !== date) setDate(expanded)
  }

  return (
    <div data-test="hypothesis-ledger-section" className="px-5 py-4 border-t border-line">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// HYPOTHESIS LEDGER</h3>
        {!pending && (
          <button
            type="button"
            onClick={handleStart}
            className="text-[10px] tracking-[0.15em] px-3 py-1.5 font-bold bg-accent-sel text-bg-0 cursor-pointer transition-colors duration-200"
          >
            + COMMIT HYPOTHESIS
          </button>
        )}
      </div>

      {pending && (
        <div className="mb-3 p-3 border border-accent-sel bg-bg-2">
          <div className="text-[10px] text-ink-2 tracking-[0.15em] mb-2">
            // COMMIT HYPOTHESIS · {caseName} @ ${priceAtCommit.toFixed(2)}
          </div>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <div className="flex border border-line">
              <button
                type="button"
                onClick={() => setComparator('lte')}
                className={`px-3 py-1.5 text-[12px] font-mono cursor-pointer transition-colors duration-200 ${comparator === 'lte' ? 'bg-accent-sel text-bg-0 font-bold' : 'text-ink-2 hover:text-ink-0'}`}
              >≤</button>
              <button
                type="button"
                onClick={() => setComparator('gte')}
                className={`px-3 py-1.5 text-[12px] font-mono cursor-pointer transition-colors duration-200 border-l border-line ${comparator === 'gte' ? 'bg-accent-sel text-bg-0 font-bold' : 'text-ink-2 hover:text-ink-0'}`}
              >≥</button>
            </div>
            <div className="flex items-center">
              <span className="text-ink-2 text-[12px] font-mono pr-1">$</span>
              <input
                aria-label="target price"
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="280.00"
                className="w-[100px] text-[12px] text-ink-0 bg-bg-1 border border-line px-2 py-1 font-mono focus:outline-none focus:border-accent-sel"
              />
            </div>
            <span className="text-ink-3 text-[12px] font-mono">by</span>
            <input
              aria-label="target date"
              type="text"
              pattern="\d{4}-\d{2}-\d{2}"
              inputMode="numeric"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onBlur={handleDateBlur}
              placeholder="YYYY-MM-DD"
              className={`w-[120px] text-[12px] text-ink-0 bg-bg-1 border px-2 py-1 font-mono focus:outline-none focus:border-accent-sel ${date && !dateOk ? 'border-state-err' : 'border-line'}`}
            />
            <input
              aria-label="confidence"
              type="number"
              min="0"
              max="100"
              step="5"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              className="w-[70px] text-[12px] text-ink-0 bg-bg-1 border border-line px-2 py-1 font-mono focus:outline-none focus:border-accent-sel"
            />
            <span className="text-ink-2 text-[12px] font-mono">%</span>
          </div>
          <div className="text-[9px] text-ink-3 tracking-[0.1em] mb-2">
            // YYYY-MM-DD (UTC) — accepts 30d / 4w / 2m shorthand
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder="optional note (≤200 chars)"
            aria-label="hypothesis note"
            className="w-full text-[12px] text-ink-0 bg-bg-1 border border-line p-2 resize-none focus:outline-none focus:border-accent-sel"
            rows={2}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[9px] text-ink-3 tracking-[0.1em]">{note.length}/200</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="text-[10px] tracking-[0.15em] px-3 py-1 text-ink-2 hover:text-ink-0 cursor-pointer transition-colors duration-200"
              >CANCEL</button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={`text-[10px] tracking-[0.15em] px-3 py-1 font-bold transition-colors duration-200 ${canConfirm ? 'bg-accent-sel text-bg-0 cursor-pointer' : 'bg-bg-3 text-ink-3 cursor-not-allowed'}`}
              >CONFIRM</button>
            </div>
          </div>
        </div>
      )}

      {ours.length === 0 ? (
        <div className="text-[11px] text-ink-3 tracking-[0.1em]">// no hypotheses committed yet</div>
      ) : (
        <ul className="space-y-1" role="list">
          {ours.map(h => <HypothesisRowMounted key={h.id} h={h} />)}
        </ul>
      )}
    </div>
  )
}
