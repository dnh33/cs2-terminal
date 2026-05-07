import { useEffect, useMemo, useState } from 'react'
import { useCatalystJournal, type Catalyst } from '../lib/useCatalystJournal'
import { todayLocal, formatShortDate } from '../lib/dates'

interface Props {
  caseId: string
  caseName: string
}

export function CatalystJournal({ caseId }: Props) {
  const { entries, commit, remove } = useCatalystJournal()
  const today = todayLocal()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState<string | null>(null)

  const forThisCase = useMemo(
    () => entries.filter(e => e.caseId === caseId),
    [entries, caseId],
  )
  const upcoming = useMemo(
    () => forThisCase
      .filter(e => e.eventDate >= today)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || b.createdAt - a.createdAt),
    [forThisCase, today],
  )
  const past = useMemo(
    () => forThisCase
      .filter(e => e.eventDate < today)
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.createdAt - a.createdAt),
    [forThisCase, today],
  )

  useEffect(() => {
    if (!removed) return
    const t = window.setTimeout(() => setRemoved(null), 3000)
    return () => window.clearTimeout(t)
  }, [removed])

  function resetForm() {
    setLabel('')
    setEventDate('')
    setError(null)
    setAdding(false)
  }

  function handleCommit() {
    setError(null)
    const trimmed = label.trim()
    if (trimmed.length === 0) { setError('// LABEL REQUIRED'); return }
    if (trimmed.length > 80) { setError('// LABEL TOO LONG'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) { setError('// INVALID DATE'); return }
    const parsed = Date.parse(`${eventDate}T00:00:00Z`)
    if (!Number.isFinite(parsed)) { setError('// INVALID DATE'); return }
    commit({ caseId, label: trimmed, eventDate })
    if (eventDate < today) setTab('past')
    else setTab('upcoming')
    resetForm()
  }

  function handleRemove(entry: Catalyst) {
    remove(entry.id)
    setRemoved(entry.label)
  }

  if (forThisCase.length === 0 && !adding) {
    return (
      <div data-test="catalyst-journal-section" className="px-5 py-4 border-t border-line">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// CATALYST JOURNAL</h3>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[10px] tracking-[0.15em] px-3 py-1.5 font-bold bg-accent-sel text-bg-0 cursor-pointer transition-colors duration-200"
          >
            + ADD
          </button>
        </div>
        <div className="text-[11px] text-ink-3 tracking-[0.1em]">
          // NO CATALYSTS COMMITTED — TRACK UPCOMING EVENTS HERE
        </div>
        {removed && (
          <div role="status" aria-live="polite" className="text-ink-3 text-[10px] mt-2 tracking-[0.15em]">
            // REMOVED: {removed}
          </div>
        )}
      </div>
    )
  }

  const visible = tab === 'upcoming' ? upcoming : past
  return (
    <div data-test="catalyst-journal-section" className="px-5 py-4 border-t border-line">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// CATALYST JOURNAL</h3>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-[10px] tracking-[0.15em] px-3 py-1.5 font-bold bg-accent-sel text-bg-0 cursor-pointer transition-colors duration-200"
        >
          + ADD
        </button>
      </div>

      <div role="tablist" className="flex items-center gap-2 mb-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upcoming'}
          onClick={() => setTab('upcoming')}
          className={`text-[10px] tracking-[0.15em] px-2 py-1 ${tab === 'upcoming' ? 'bg-accent-sel/10 text-accent-sel' : 'text-ink-3'}`}
        >
          UPCOMING ({upcoming.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'past'}
          onClick={() => setTab('past')}
          className={`text-[10px] tracking-[0.15em] px-2 py-1 ${tab === 'past' ? 'bg-accent-sel/10 text-accent-sel' : 'text-ink-3'}`}
        >
          PAST ({past.length})
        </button>
      </div>

      {adding && (
        <div className="border border-accent-sel bg-bg-2 p-3 mb-3">
          <div className="text-[10px] text-ink-2 tracking-[0.15em] mb-2">// + NEW CATALYST</div>
          <label className="flex flex-col text-[10px] mb-2 text-ink-2 tracking-[0.15em]">
            LABEL
            <input
              className="bg-bg-1 border border-line px-2 py-1 text-[12px] text-ink-0 font-mono focus:outline-none focus:border-accent-sel mt-1"
              maxLength={80}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-[10px] mb-2 text-ink-2 tracking-[0.15em]">
            DATE
            <input
              type="text"
              pattern="\d{4}-\d{2}-\d{2}"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              className="bg-bg-1 border border-line px-2 py-1 text-[12px] text-ink-0 font-mono focus:outline-none focus:border-accent-sel mt-1"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </label>
          {error && <div className="text-state-err text-[10px] mb-2 tracking-[0.15em]">{error}</div>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="text-[10px] tracking-[0.15em] px-3 py-1 text-ink-2 hover:text-ink-0 cursor-pointer transition-colors duration-200"
            >
              ✗ CANCEL
            </button>
            <button
              type="button"
              onClick={handleCommit}
              className="text-[10px] tracking-[0.15em] px-3 py-1 font-bold bg-accent-sel text-bg-0 cursor-pointer transition-colors duration-200"
            >
              ✓ COMMIT
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="text-[11px] text-ink-3 tracking-[0.1em]">
          {tab === 'upcoming' ? '// NO UPCOMING CATALYSTS' : '// NO PAST CATALYSTS'}
        </div>
      ) : (
        <ul className="space-y-1" role="list">
          {visible.map(e => (
            <li key={e.id} className="flex items-center gap-3 text-[11px] text-ink-1 tabular-nums py-1">
              <span className="text-accent-data">▸</span>
              <span className="flex-1 truncate">{e.label}</span>
              <span className="text-ink-3 tabular-nums">· {formatShortDate(e.eventDate)}</span>
              <button
                type="button"
                aria-label={`Remove ${e.label}`}
                onClick={() => handleRemove(e)}
                className="text-ink-3 hover:text-state-err cursor-pointer transition-colors duration-200"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {removed && (
        <div role="status" aria-live="polite" className="text-ink-3 text-[10px] mt-2 tracking-[0.15em]">
          // REMOVED: {removed}
        </div>
      )}
    </div>
  )
}
