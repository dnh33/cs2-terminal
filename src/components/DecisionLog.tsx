import { useState } from 'react'
import { useDecisionLog, type Verdict } from '../lib/useDecisionLog'

interface Props {
  caseId: string
  caseName: string
  snapshotAt: number
  priceAtCommit: number
  verdict?: Verdict
  confidence?: number
}

function fmtTime(ms: number): string {
  const d = new Date(ms)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const date = d.toISOString().slice(0, 10)
  return `${date} ${hh}:${mm}`
}

export function DecisionLog({ caseId, caseName, snapshotAt, priceAtCommit, verdict, confidence }: Props) {
  const { entries, commit } = useDecisionLog()
  const [pending, setPending] = useState(false)
  const [note, setNote] = useState('')

  function handleCommit() {
    setPending(true)
  }

  function handleConfirm() {
    if (!verdict || confidence === undefined) return
    commit({
      caseId, caseName, verdict, confidence, priceAtCommit, snapshotAt, note,
    })
    setPending(false)
    setNote('')
  }

  function handleCancel() {
    setPending(false)
    setNote('')
  }

  const canCommit = verdict !== undefined && confidence !== undefined

  return (
    <div className="px-5 py-4 border-t border-line">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// DECISION LOG</h3>
        {!pending && (
          <button
            onClick={handleCommit}
            disabled={!canCommit}
            className={`text-[10px] tracking-[0.15em] px-3 py-1.5 font-bold ${
              canCommit ? 'bg-accent-sel text-bg-0' : 'bg-bg-3 text-ink-3 cursor-not-allowed'
            }`}
          >
            ✓ COMMIT
          </button>
        )}
      </div>

      {pending && (
        <div className="mb-3 p-3 border border-accent-sel bg-bg-2">
          <div className="text-[10px] text-ink-2 tracking-[0.15em] mb-2">
            Logging {verdict} · {confidence !== undefined ? Math.round(confidence * 100) : 0}% on {caseName} @ ${priceAtCommit.toFixed(2)}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder="optional note (≤200 chars)"
            aria-label="Decision note"
            className="w-full text-[12px] text-ink-0 bg-bg-1 border border-line p-2 resize-none"
            rows={2}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[9px] text-ink-3 tracking-[0.1em]">{note.length}/200</span>
            <div className="flex gap-2">
              <button onClick={handleCancel} className="text-[10px] tracking-[0.15em] px-3 py-1 text-ink-2 hover:text-ink-0">
                CANCEL
              </button>
              <button onClick={handleConfirm} className="text-[10px] tracking-[0.15em] px-3 py-1 bg-accent-sel text-bg-0 font-bold">
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-[11px] text-ink-3 tracking-[0.1em]">// no decisions logged yet</div>
      ) : (
        <ul className="space-y-1.5" role="list">
          {entries.map((e) => (
            <li key={e.id} role="listitem" className="text-[11px] text-ink-1 tabular-nums">
              <span className="text-ink-3">{fmtTime(e.committedAt)}</span>
              {' · '}
              <span className="font-bold" style={{
                color: e.verdict === 'LONG' ? 'var(--delta-up)' :
                       e.verdict === 'AVOID' ? 'var(--state-err)' : 'var(--state-warn)',
              }}>{e.verdict}</span>
              {' · '}
              <span>{e.caseName}</span>
              {' · '}
              <span className="text-ink-2">${e.priceAtCommit.toFixed(2)}</span>
              {e.note && <span className="text-ink-2 italic"> — “{e.note}”</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
