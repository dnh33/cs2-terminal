/**
 * Phase 4 Plan 1 — Hypothesis Ledger Spec Showcase
 *
 * Public route at /spec/hypothesis-ledger. Standalone preview of the
 * locked spec, rendered with the actual case-sniper design system tokens.
 * Mock data only; no localStorage writes, no /history fetches.
 *
 * Spec source: docs/superpowers/specs/2026-05-07-case-sniper-phase-4-plan-1-hypothesis-ledger-design.md
 */
import { useEffect, useId, useState } from 'react'
import { PaletteSwitch } from '../components/primitives/PaletteSwitch'

// ─── Mock data ───────────────────────────────────────────────────────────────

type Comparator = 'gte' | 'lte'
type Outcome = 'HIT' | 'MISS' | 'STALE'

interface MockHypothesis {
  id: string
  caseName: string
  comparator: Comparator
  targetPrice: number
  targetDate: string
  confidence: number
  committedAt: string
  resolution: null | {
    outcome: Outcome
    observed: { min: number; max: number; count: number } | null
    resolvedAt: number
  }
}

const MOCK: MockHypothesis[] = [
  {
    id: '1',
    caseName: 'Glove',
    comparator: 'gte',
    targetPrice: 280,
    targetDate: '2026-06-15',
    confidence: 65,
    committedAt: '2026-05-06 14:32',
    resolution: null,
  },
  {
    id: '2',
    caseName: 'Recoil',
    comparator: 'lte',
    targetPrice: 8,
    targetDate: '2026-05-30',
    confidence: 80,
    committedAt: '2026-04-30 09:11',
    resolution: {
      outcome: 'HIT',
      observed: { min: 7.42, max: 8.91, count: 23 },
      resolvedAt: Date.now() - 1000, // fresh — will flash
    },
  },
  {
    id: '3',
    caseName: 'Revolution',
    comparator: 'gte',
    targetPrice: 310,
    targetDate: '2026-05-01',
    confidence: 50,
    committedAt: '2026-04-22 18:05',
    resolution: {
      outcome: 'MISS',
      observed: { min: 251.4, max: 284.0, count: 22 },
      resolvedAt: Date.now() - 500_000, // not fresh
    },
  },
  {
    id: '4',
    caseName: 'CS:GO Weapon',
    comparator: 'gte',
    targetPrice: 50,
    targetDate: '2026-04-15',
    confidence: 70,
    committedAt: '2026-04-10 11:00',
    resolution: {
      outcome: 'STALE',
      observed: null,
      resolvedAt: Date.now() - 3_600_000,
    },
  },
]

// ─── Building blocks ─────────────────────────────────────────────────────────

function Cmp({ value }: { value: Comparator }) {
  return (
    <span className="font-mono text-ink-1" aria-label={value === 'gte' ? 'greater or equal' : 'less or equal'}>
      {value === 'gte' ? '≥' : '≤'}
    </span>
  )
}

function OutcomeChip({ outcome }: { outcome: Outcome | 'PENDING' }) {
  if (outcome === 'PENDING') {
    return <span className="font-mono text-[10px] tracking-[0.2em] text-ink-2">PENDING</span>
  }
  if (outcome === 'HIT') {
    return <span className="font-mono text-[10px] tracking-[0.2em] font-bold" style={{ color: 'var(--delta-up)' }}>HIT</span>
  }
  if (outcome === 'MISS') {
    return <span className="font-mono text-[10px] tracking-[0.2em] font-bold" style={{ color: 'var(--state-err)' }}>MISS</span>
  }
  return <span className="font-mono text-[10px] tracking-[0.2em] text-ink-3">STALE</span>
}

function LedgerRow({ h, showCaseName = false, flashing = false }: {
  h: MockHypothesis
  showCaseName?: boolean
  flashing?: boolean
}) {
  const flashColor = h.resolution?.outcome === 'HIT' ? 'var(--delta-up)'
    : h.resolution?.outcome === 'MISS' ? 'var(--state-err)' : 'transparent'

  const isStale = h.resolution?.outcome === 'STALE'

  return (
    <li
      className={`flex items-center gap-3 text-[11px] text-ink-1 tabular-nums py-1 transition-[border-color,padding] duration-[1500ms] ease-out ${
        isStale ? 'opacity-50' : ''
      }`}
      style={{
        borderLeft: flashing ? `2px solid ${flashColor}` : '2px solid transparent',
        paddingLeft: flashing ? '8px' : '0',
      }}
    >
      <span className="text-ink-3">{h.committedAt}</span>
      <span className="text-ink-3">·</span>
      <span>
        <Cmp value={h.comparator} /> ${h.targetPrice.toFixed(2)} by {h.targetDate}
      </span>
      <span className="text-ink-3">·</span>
      <span className="text-ink-2">{h.confidence}%</span>
      {showCaseName && (
        <>
          <span className="text-ink-3">·</span>
          <span className="text-ink-2 font-bold">{h.caseName}</span>
        </>
      )}
      <span className="ml-auto flex items-center gap-2">
        {h.resolution === null ? <OutcomeChip outcome="PENDING" /> : <OutcomeChip outcome={h.resolution.outcome} />}
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

// ─── Sections ────────────────────────────────────────────────────────────────

function SectionHeader({ kicker, title, summary }: { kicker: string; title: string; summary?: string }) {
  return (
    <div className="mb-6">
      <div className="text-[10px] tracking-[0.3em] text-accent-sel font-bold mb-2">// {kicker}</div>
      <h2 className="text-[20px] tracking-tight text-ink-0 font-display uppercase">{title}</h2>
      {summary && <p className="text-[12px] text-ink-2 mt-2 max-w-[640px] leading-relaxed">{summary}</p>}
    </div>
  )
}

function Panel({ children, title, className = '' }: { children: React.ReactNode; title?: string; className?: string }) {
  return (
    <div className={`border border-line bg-bg-1 ${className}`}>
      {title && (
        <div className="px-4 py-2 border-b border-line text-[10px] tracking-[0.2em] text-ink-2">// {title}</div>
      )}
      {children}
    </div>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="border-b border-line py-12 px-8">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-[10px] tracking-[0.3em] text-ink-3 mb-3">// PHASE 4 · PLAN 1 · DESIGN SPEC PREVIEW</div>
        <h1 className="text-[56px] leading-[1.05] tracking-tight text-ink-0 font-display uppercase mb-4">
          Hypothesis Ledger
        </h1>
        <p className="text-[16px] text-ink-1 max-w-[720px] leading-relaxed">
          The HERO of <span className="text-accent-sel font-bold">"Make the terminal hold a memory"</span>.
          Forward-looking price calls, committed to the record, auto-resolved against D1 snapshots
          when the target date passes.
        </p>
        <div className="mt-6 flex gap-6 items-center text-[11px] tracking-[0.15em] text-ink-3 font-mono">
          <span>SCOPE: locked 2026-05-07</span>
          <span>·</span>
          <span>COUNCIL: 4-lens + Ralph</span>
          <span>·</span>
          <span>PATCHES: P0×3, P1×10</span>
          <span>·</span>
          <span>TAG: phase-4-plan-1-hypothesis-ledger</span>
        </div>
        <blockquote className="mt-8 pl-4 border-l-2 border-accent-sel">
          <p className="text-[13px] text-ink-2 italic font-prose leading-relaxed">
            "Reticle = where is the floor right now? Ledger = where will the floor be on June 15, was I right?
            Same brand spine, new time axis. Auto-resolution is the magic moment."
          </p>
        </blockquote>
      </div>
    </section>
  )
}

// ─── Schema visualizer ──────────────────────────────────────────────────────

function Schema() {
  return (
    <section className="py-12 px-8 border-b border-line">
      <div className="max-w-[1100px] mx-auto">
        <SectionHeader
          kicker="01 / SCHEMA"
          title="The shape on disk"
          summary="localStorage key cs-hypotheses:v1. Mirrors Decision Log's pattern with three differences highlighted in orange — comparator, targetDate, and resolution carry the time-axis innovation."
        />
        <Panel title="Hypothesis interface">
          <pre className="p-4 text-[12px] leading-[1.6] font-mono text-ink-1 overflow-x-auto">
{`interface Hypothesis {
  id              : string                     // uuid v4
  caseId          : string                     // ← LOOKUP KEY (resolver uses this)
  caseName        : string                     // display cache only
  `}<span className="text-accent-sel font-bold">{`comparator      : 'gte' | 'lte'`}</span>{`              // ≥ or ≤
  targetPrice     : number                     // dollars, against \`lowest\`
  `}<span className="text-accent-sel font-bold">{`targetDate      : string                     // 'YYYY-MM-DD' UTC`}</span>{`
  confidence      : number                     // integer 0..100
  priceAtCommit   : number
  snapshotAt      : number                     // epoch s
  committedAt     : number                     // epoch ms
  note            : string                     // ≤200 chars
  `}<span className="text-accent-sel font-bold">{`resolution      : Resolution | null          // null while pending`}</span>{`
  lastAttemptAt?  : number
  lastAttemptError?: 'network' | null
}

interface Resolution {
  outcome         : 'HIT' | 'MISS' | 'STALE'
  resolvedAt      : number
  resolverVersion : 1                          // bump on algorithm change
  observed        : { min, max, count } | null // null when STALE
}`}
          </pre>
        </Panel>
        <div className="grid grid-cols-3 gap-4 mt-4 text-[11px] text-ink-2">
          <Panel className="p-3">
            <div className="text-[10px] tracking-[0.2em] text-accent-sel font-bold mb-1">// CONFIDENCE</div>
            <p>Stored as <span className="font-mono text-ink-0">integer 0..100</span>. Decision Log stores 0..1 and renders ×100 — diverges on purpose for terminal-grammar fit. Verdict Accuracy Tracker (Phase 5) normalizes both.</p>
          </Panel>
          <Panel className="p-3">
            <div className="text-[10px] tracking-[0.2em] text-accent-sel font-bold mb-1">// LOOKUP KEY</div>
            <p>Resolver uses <span className="font-mono text-ink-0">caseId</span>, not <span className="font-mono text-ink-0">caseName</span>. Renames in cases.ts won't drift the resolution — caseName is display cache only.</p>
          </Panel>
          <Panel className="p-3">
            <div className="text-[10px] tracking-[0.2em] text-accent-sel font-bold mb-1">// VERSIONING</div>
            <p>resolverVersion locks each resolution to the algorithm that produced it. Future formula changes don't invalidate history.</p>
          </Panel>
        </div>
      </div>
    </section>
  )
}

// ─── Resolution states gallery ──────────────────────────────────────────────

function StatesGallery() {
  return (
    <section className="py-12 px-8 border-b border-line">
      <div className="max-w-[1100px] mx-auto">
        <SectionHeader
          kicker="02 / STATES"
          title="Four resolution outcomes"
          summary="Every hypothesis lives in exactly one of four states. Color discipline: PENDING is neutral, HIT and MISS carry decisive signals, STALE recedes (null result, not alarm)."
        />
        <Panel title="Per-case section as it appears in DetailPanel">
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// HYPOTHESIS LEDGER</h3>
              <button
                type="button"
                disabled
                className="text-[10px] tracking-[0.15em] px-3 py-1.5 font-bold bg-accent-sel text-bg-0 cursor-not-allowed"
              >
                + COMMIT HYPOTHESIS
              </button>
            </div>
            <ul className="space-y-1">
              {MOCK.map((h, i) => (
                <LedgerRow key={h.id} h={h} flashing={i === 1 /* HIT row demo */} />
              ))}
            </ul>
          </div>
        </Panel>

        <div className="grid grid-cols-4 gap-3 mt-4">
          <StateAnnotation label="PENDING" color="var(--ink-2)" desc="resolution === null. Target date hasn't passed. Resolver will check on next mount." />
          <StateAnnotation label="HIT" color="var(--delta-up)" desc="At least one snapshot on target_date satisfied the comparator. Brief border-left flash on first reveal." />
          <StateAnnotation label="MISS" color="var(--state-err)" desc="Snapshots existed but never crossed the threshold. observed.min/max documents the closest approach." />
          <StateAnnotation label="STALE" color="var(--ink-3)" desc="Filter was empty — D1 had no rows for that day. Null result, not user error. opacity-50 to recede." />
        </div>
      </div>
    </section>
  )
}

function StateAnnotation({ label, color, desc }: { label: string; color: string; desc: string }) {
  return (
    <Panel className="p-3">
      <div className="text-[10px] tracking-[0.2em] font-bold mb-2" style={{ color }}>{label}</div>
      <p className="text-[11px] text-ink-2 leading-relaxed">{desc}</p>
    </Panel>
  )
}

// ─── Empty state + Form demo ─────────────────────────────────────────────────

function EmptyState() {
  return (
    <Panel title="Empty state">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// HYPOTHESIS LEDGER</h3>
          <button
            type="button"
            disabled
            className="text-[10px] tracking-[0.15em] px-3 py-1.5 font-bold bg-accent-sel text-bg-0 cursor-not-allowed"
          >
            + COMMIT HYPOTHESIS
          </button>
        </div>
        <div className="text-[11px] text-ink-3 tracking-[0.1em]">// no hypotheses committed yet</div>
        <p className="text-[10px] text-ink-3 mt-2 italic">The button is the affordance. No placeholder example row (avoids Bloomberg ghost-data bug).</p>
      </div>
    </Panel>
  )
}

function FormDemo() {
  const [comparator, setComparator] = useState<Comparator>('lte')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState('')
  const [confidence, setConfidence] = useState('50')
  const [note, setNote] = useState('')
  const dateId = useId()
  const priceId = useId()
  const confId = useId()

  function expandShorthand(value: string): string {
    const m = value.trim().match(/^(\d+)([dwm])$/i)
    if (!m) return value
    const n = parseInt(m[1], 10)
    const unit = m[2].toLowerCase()
    const days = unit === 'd' ? n : unit === 'w' ? n * 7 : n * 30
    const target = new Date(Date.UTC(2026, 4, 7) + days * 86_400_000) // pinned demo date
    return target.toISOString().slice(0, 10)
  }

  function handleDateBlur() {
    const expanded = expandShorthand(date)
    if (expanded !== date) setDate(expanded)
  }

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const priceOk = parseFloat(price) > 0
  const confOk = (() => {
    const n = parseInt(confidence, 10)
    return Number.isFinite(n) && n >= 0 && n <= 100
  })()
  const canConfirm = dateOk && priceOk && confOk

  return (
    <Panel title="Commit form (live demo — try typing &quot;30d&quot; in the date field)">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// HYPOTHESIS LEDGER</h3>
        </div>
        <div className="border border-accent-sel bg-bg-2 p-4">
          <div className="text-[10px] text-ink-2 tracking-[0.15em] mb-3">// COMMIT HYPOTHESIS · GLOVE @ $268.40</div>
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <div className="flex border border-line">
              <button
                type="button"
                onClick={() => setComparator('lte')}
                className={`px-3 py-1.5 text-[12px] font-mono cursor-pointer transition-colors duration-200 ${
                  comparator === 'lte' ? 'bg-accent-sel text-bg-0 font-bold' : 'text-ink-2 hover:text-ink-0'
                }`}
              >
                ≤
              </button>
              <button
                type="button"
                onClick={() => setComparator('gte')}
                className={`px-3 py-1.5 text-[12px] font-mono cursor-pointer transition-colors duration-200 border-l border-line ${
                  comparator === 'gte' ? 'bg-accent-sel text-bg-0 font-bold' : 'text-ink-2 hover:text-ink-0'
                }`}
              >
                ≥
              </button>
            </div>
            <div className="flex items-center">
              <span className="text-ink-2 text-[12px] font-mono pr-1">$</span>
              <input
                id={priceId}
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
              id={dateId}
              aria-label="target date"
              type="text"
              pattern="\d{4}-\d{2}-\d{2}"
              inputMode="numeric"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onBlur={handleDateBlur}
              placeholder="YYYY-MM-DD"
              className={`w-[120px] text-[12px] text-ink-0 bg-bg-1 border px-2 py-1 font-mono focus:outline-none focus:border-accent-sel ${
                date && !dateOk ? 'border-state-err' : 'border-line'
              }`}
            />
            <input
              id={confId}
              aria-label="confidence percent"
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
            // YYYY-MM-DD (UTC) — accepts {`30d / 4w / 2m`} shorthand
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
                className="text-[10px] tracking-[0.15em] px-3 py-1 text-ink-2 hover:text-ink-0 cursor-pointer transition-colors duration-200"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                className={`text-[10px] tracking-[0.15em] px-3 py-1 font-bold transition-colors duration-200 ${
                  canConfirm
                    ? 'bg-accent-sel text-bg-0 cursor-pointer'
                    : 'bg-bg-3 text-ink-3 cursor-not-allowed'
                }`}
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-[11px] text-ink-2">
          <ValidationChip ok={priceOk} label="targetPrice > 0" />
          <ValidationChip ok={dateOk} label="YYYY-MM-DD format" />
          <ValidationChip ok={confOk} label="confidence ∈ [0,100]" />
        </div>
      </div>
    </Panel>
  )
}

function ValidationChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1 border border-line text-[10px] font-mono ${ok ? '' : 'opacity-60'}`}>
      <span className={`inline-block w-1.5 h-1.5`} style={{ background: ok ? 'var(--delta-up)' : 'var(--ink-3)' }} aria-hidden />
      <span className="text-ink-1">{label}</span>
      <span className="ml-auto text-ink-3">{ok ? 'OK' : '—'}</span>
    </div>
  )
}

function StatesAndForm() {
  return (
    <section className="py-12 px-8 border-b border-line">
      <div className="max-w-[1100px] mx-auto">
        <SectionHeader
          kicker="03 / FORM & EMPTY"
          title="Commit interaction"
          summary="The form is keyboard-first. HTML5 date inputs were rejected (mouse-required, locale-leaky). Text input with regex + shorthand (30d / 4w / 2m) keeps trader-grade typing flow. Try it below."
        />
        <div className="grid grid-cols-1 gap-4">
          <FormDemo />
          <EmptyState />
        </div>
      </div>
    </section>
  )
}

// ─── Resolution flash demo ──────────────────────────────────────────────────

function FlashDemo() {
  const [now, setNow] = useState(Date.now())
  const [flashKey, setFlashKey] = useState(0)
  const [resolution, setResolution] = useState<'PENDING' | 'HIT' | 'MISS'>('PENDING')

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])

  const fresh = now - flashKey < 1500 && resolution !== 'PENDING'

  function trigger(out: 'HIT' | 'MISS') {
    setResolution(out)
    setFlashKey(Date.now())
  }

  function reset() {
    setResolution('PENDING')
    setFlashKey(0)
  }

  const mockH: MockHypothesis = {
    id: 'demo',
    caseName: 'Glove',
    comparator: 'gte',
    targetPrice: 280,
    targetDate: '2026-06-15',
    confidence: 65,
    committedAt: '2026-05-06 14:32',
    resolution: resolution === 'PENDING' ? null : {
      outcome: resolution,
      observed: resolution === 'HIT' ? { min: 282, max: 291, count: 21 } : { min: 251, max: 277, count: 22 },
      resolvedAt: flashKey,
    },
  }

  return (
    <section className="py-12 px-8 border-b border-line">
      <div className="max-w-[1100px] mx-auto">
        <SectionHeader
          kicker="04 / RESOLUTION FLASH"
          title="The magic moment"
          summary="When a target date passes and the resolver flips a row from PENDING, the row emits a one-shot 1500ms border-left flash. Per-mount, not per-render — Daniel sees it on the dashboard load that revealed the change. STALE rows do NOT flash (null result, not signal)."
        />
        <Panel title="Trigger a resolution to see the flash">
          <div className="px-5 py-4">
            <ul className="space-y-1 mb-4">
              <LedgerRow h={mockH} flashing={fresh} />
            </ul>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => trigger('HIT')}
                className="text-[10px] tracking-[0.15em] px-3 py-1.5 font-bold cursor-pointer transition-colors duration-200"
                style={{ background: 'var(--delta-up)', color: 'var(--bg-0)' }}
              >
                FLIP → HIT
              </button>
              <button
                type="button"
                onClick={() => trigger('MISS')}
                className="text-[10px] tracking-[0.15em] px-3 py-1.5 font-bold cursor-pointer transition-colors duration-200"
                style={{ background: 'var(--state-err)', color: 'var(--bg-0)' }}
              >
                FLIP → MISS
              </button>
              <button
                type="button"
                onClick={reset}
                className="text-[10px] tracking-[0.15em] px-3 py-1.5 text-ink-2 hover:text-ink-0 border border-line cursor-pointer transition-colors duration-200"
              >
                RESET
              </button>
              <span className="ml-4 text-[10px] tracking-[0.15em] text-ink-3 font-mono">
                {resolution === 'PENDING' ? '// awaiting resolution' : fresh ? '// flashing (1500ms)' : '// flash complete'}
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </section>
  )
}

// ─── Cmd+K preview ──────────────────────────────────────────────────────────

function CmdKPreview() {
  return (
    <section className="py-12 px-8 border-b border-line">
      <div className="max-w-[1100px] mx-auto">
        <SectionHeader
          kicker="05 / CROSS-CASE VIEW"
          title="Cmd+K integration"
          summary="A new HYPOTHESES section in the existing palette. PENDING-only by default; RESOLVED gates behind &quot;hyp resolved&quot; query (Linear pattern). Row click navigates via existing ?case= URL state, then scrolls DetailPanel to the ledger."
        />
        <Panel title="Cmd+K palette · query: 'hyp'">
          <div className="bg-bg-0 p-4 font-mono text-[12px]">
            <div className="flex items-center gap-2 border-b border-line pb-2 mb-3">
              <span className="text-accent-sel">{'>'}</span>
              <span className="text-ink-0">hyp</span>
              <span className="ml-auto text-ink-3 text-[10px]">esc to close</span>
            </div>
            <div className="text-[9px] tracking-[0.2em] text-ink-3 mb-2">HYPOTHESES (3 OPEN)</div>
            <div className="space-y-1">
              {MOCK.filter(h => h.resolution === null).map(h => (
                <div key={h.id} className="flex items-center gap-3 px-2 py-1.5 hover:bg-bg-2 cursor-pointer transition-colors duration-200">
                  <span className="text-ink-1 font-bold">{h.caseName.toUpperCase()}</span>
                  <span className="text-ink-1"><Cmp value={h.comparator} /> ${h.targetPrice} by {h.targetDate}</span>
                  <span className="text-ink-2">{h.confidence}%</span>
                  <span className="ml-auto"><OutcomeChip outcome="PENDING" /></span>
                </div>
              ))}
              <div className="px-2 py-1.5 text-ink-2 hover:bg-bg-2 cursor-pointer transition-colors duration-200">
                <span className="text-ink-1 font-bold">GLOVE</span>
                <span className="text-ink-1"> ≥ $280 by 2026-06-15</span>
                <span className="text-ink-2 ml-2">65%</span>
                <span className="ml-auto float-right"><OutcomeChip outcome="PENDING" /></span>
              </div>
            </div>
            <div className="text-[9px] tracking-[0.2em] text-ink-3 mt-4 mb-2">
              RESOLVED (3 — type "hyp resolved" to expand)
            </div>
          </div>
        </Panel>
        <div className="mt-4 text-[11px] text-ink-2 leading-relaxed max-w-[720px]">
          <p>
            Sort: ascending by <span className="font-mono">targetDate</span> (most-urgent-first).
            Resolved entries collapse by default — they're historical record, not action items. Linear's pattern.
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Before / After ────────────────────────────────────────────────────────

function BeforeAfter() {
  return (
    <section className="py-12 px-8 border-b border-line">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeader
          kicker="06 / BEFORE & AFTER"
          title="DetailPanel composition"
          summary="The Hypothesis Ledger lands as a section sibling to Decision Log. No redesign of existing surfaces. The terminal grows by composition, not replacement."
        />
        <div className="grid grid-cols-2 gap-6">
          <Panel title="Phase 3 — current state">
            <div className="px-4 py-3 border-b border-line text-[11px] text-ink-3 font-mono">// header · pricechart · fitblock · reticle · decision log</div>
            <div className="p-4 space-y-2">
              <Stub label="HEADER" />
              <Stub label="PRICE CHART" h={48} />
              <Stub label="FIT BLOCK" h={32} />
              <Stub label="RETICLE" h={32} />
              <Stub label="DECISION LOG" h={32} highlight />
            </div>
          </Panel>
          <Panel title="Phase 4 — Plan 1 ships this">
            <div className="px-4 py-3 border-b border-line text-[11px] text-ink-3 font-mono">// header · pricechart · fitblock · reticle · decision log · <span className="text-accent-sel">hypothesis ledger</span></div>
            <div className="p-4 space-y-2">
              <Stub label="HEADER" />
              <Stub label="PRICE CHART" h={48} />
              <Stub label="FIT BLOCK" h={32} />
              <Stub label="RETICLE" h={32} />
              <Stub label="DECISION LOG" h={32} highlight />
              <Stub label="HYPOTHESIS LEDGER" h={32} accent />
            </div>
          </Panel>
        </div>
      </div>
    </section>
  )
}

function Stub({ label, h = 24, highlight = false, accent = false }: { label: string; h?: number; highlight?: boolean; accent?: boolean }) {
  return (
    <div
      className={`border flex items-center px-3 text-[10px] tracking-[0.2em] font-mono ${
        accent ? 'border-accent-sel bg-bg-2' : highlight ? 'border-line bg-bg-2' : 'border-line bg-bg-1'
      }`}
      style={{ height: `${h}px` }}
    >
      <span className={accent ? 'text-accent-sel font-bold' : 'text-ink-2'}>// {label}</span>
      {accent && <span className="ml-auto text-[9px] text-accent-sel">NEW</span>}
    </div>
  )
}

// ─── Resolver-pass timeline ─────────────────────────────────────────────────

function ResolverFlow() {
  const steps = [
    { tag: 'TRIGGER', label: 'AppDashboard mount\n+ visibilitychange', tone: 'neutral' },
    { tag: 'GUARD', label: 'inflight Promise\n+ 30s gate', tone: 'neutral' },
    { tag: 'SCAN', label: 'entries.filter(\nresolution===null\n&& targetDate<=today\n)', tone: 'neutral' },
    { tag: 'GROUP', label: 'Map<caseId,\nHypothesis[]>', tone: 'neutral' },
    { tag: 'FETCH', label: 'fetchHistory(\nname, daysSpan+2\n)\nONE per case', tone: 'accent' },
    { tag: 'RESOLVE', label: 'resolveHypothesis(\nh, history\n)\npure fn', tone: 'accent' },
    { tag: 'MERGE', label: 're-read state\nupdate where\nresolution===null', tone: 'accent' },
    { tag: 'WRITE', label: 'writeLedger(next)\n+ dispatch event\nONCE', tone: 'neutral' },
  ]

  return (
    <section className="py-12 px-8 border-b border-line">
      <div className="max-w-[1100px] mx-auto">
        <SectionHeader
          kicker="07 / ALGORITHM"
          title="Resolver-pass orchestration"
          summary="One pass per dashboard mount, gated. Concurrent-write race prevented by re-reading state pre-write. P0 fixes from architecture review baked in."
        />
        <div className="overflow-x-auto">
          <ol className="flex gap-3 min-w-max">
            {steps.map((s, i) => (
              <li key={s.tag} className="flex items-center">
                <Panel className={`min-w-[140px] ${s.tone === 'accent' ? 'border-accent-sel' : ''}`}>
                  <div className="px-3 py-2 border-b border-line text-[10px] tracking-[0.2em] font-bold" style={{ color: s.tone === 'accent' ? 'var(--accent-sel)' : 'var(--ink-1)' }}>
                    {String(i + 1).padStart(2, '0')} · {s.tag}
                  </div>
                  <pre className="p-3 text-[10px] font-mono text-ink-2 whitespace-pre">{s.label}</pre>
                </Panel>
                {i < steps.length - 1 && (
                  <span className="text-ink-3 px-1" aria-hidden>→</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

// ─── Boundary tests ────────────────────────────────────────────────────────

function BoundaryTests() {
  return (
    <section className="py-12 px-8 border-b border-line">
      <div className="max-w-[1100px] mx-auto">
        <SectionHeader
          kicker="08 / BOUNDARY TESTS"
          title="The bugs we caught before writing tests"
          summary="Three boundary cases the council surfaced. Each gets a unit test in §10 of the spec."
        />
        <div className="grid grid-cols-3 gap-4">
          <Panel title="Timezone — UTC vs local">
            <div className="p-4 text-[11px] text-ink-2 leading-relaxed font-mono">
              <div className="mb-2 text-ink-3">// freeze Date.now() to:</div>
              <div className="text-ink-0">2026-06-14T22:30:00Z</div>
              <div className="mt-3 mb-2 text-ink-3">// for Daniel (CET, UTC+1):</div>
              <div className="text-ink-0">local: 2026-06-15 00:30</div>
              <div className="text-ink-0">utc:&nbsp;&nbsp; 2026-06-14</div>
              <div className="mt-3 text-[10px] text-ink-3 not-italic">Resolver MUST use UTC. targetDate=2026-06-14 → matured. targetDate=2026-06-15 → still pending.</div>
            </div>
          </Panel>
          <Panel title="daysSpan — boundary T+0">
            <div className="p-4 text-[11px] text-ink-2 leading-relaxed font-mono">
              <div className="mb-2 text-ink-3">// hypothesis matures TODAY</div>
              <div className="text-ink-0">naive:  daysSpan = 1</div>
              <div className="text-ink-0">worker: since = now-86400</div>
              <div className="text-ink-0">⚠ excludes morning snaps</div>
              <div className="mt-3 mb-2 text-ink-3">// fix:</div>
              <div className="text-accent-sel font-bold">+2 margin = full day OK</div>
              <div className="mt-3 text-[10px] text-ink-3">~24 extra rows · negligible cost</div>
            </div>
          </Panel>
          <Panel title="Concurrent write — race">
            <div className="p-4 text-[11px] text-ink-2 leading-relaxed font-mono">
              <div className="mb-2 text-ink-3">// resolver pass timeline:</div>
              <div className="text-ink-0">T0: read state (5 rows)</div>
              <div className="text-ink-0">T1: fetch /history</div>
              <div className="text-ink-0">T2: user commits row 6</div>
              <div className="text-ink-0">T3: resolver writes 5 rows</div>
              <div className="mt-2 text-state-err">⚠ row 6 LOST</div>
              <div className="mt-3 mb-1 text-ink-3">// fix:</div>
              <div className="text-accent-sel font-bold">re-read pre-write</div>
              <div className="text-accent-sel">merge by id</div>
            </div>
          </Panel>
        </div>
      </div>
    </section>
  )
}

// ─── Council patches ───────────────────────────────────────────────────────

function CouncilPatches() {
  const patches: Array<{ tier: 'P0' | 'P1'; source: string; issue: string }> = [
    { tier: 'P0', source: 'Architect', issue: 'Concurrent-write race: resolver clobbers user commits' },
    { tier: 'P0', source: 'Ralph + Architect', issue: 'Timezone: UTC strings only; HTML5 date input gives local-day' },
    { tier: 'P0', source: 'Architect', issue: 'Auth deferral: resolver mounts inside AppDashboard fn, not AppGate' },
    { tier: 'P1', source: 'Architect', issue: 'daysSpan +2 margin to eliminate T+0 boundary' },
    { tier: 'P1', source: 'Architect', issue: '>365 days = STALE-via-empty-filter (not without-fetch)' },
    { tier: 'P1', source: 'Architect', issue: 'caseId as lookup key — caseName is display cache' },
    { tier: 'P1', source: 'Architect', issue: 'inflight Promise + 30s minimum interval gate' },
    { tier: 'P1', source: 'Designer', issue: 'Confidence: integer 0..100, not float 0..1' },
    { tier: 'P1', source: 'Designer + Ralph', issue: 'HTML5 date → text+regex with 30d/4w/2m shorthand' },
    { tier: 'P1', source: 'Designer', issue: '4-segment row in per-case (drop caseName)' },
    { tier: 'P1', source: 'Designer', issue: 'STALE → ink-3 + opacity-50 (null result, not alarm)' },
    { tier: 'P1', source: 'Designer', issue: '1500ms one-shot border-left flash on fresh resolutions' },
    { tier: 'P1', source: 'Designer', issue: 'Cmd+K PENDING-only default, RESOLVED gated' },
  ]

  const declined: Array<{ source: string; reason: string }> = [
    { source: 'Ralph: kill gte', reason: 'Recovery hypotheses are real even if rare; symmetry is cheap' },
    { source: 'Ralph: use closing tick not min/max', reason: 'min/max IS correct for "any-time-on-day=HIT" rule' },
    { source: 'Ralph: service worker for resolution', reason: 'Over-engineered for desktop-first 1-2 user app' },
  ]

  return (
    <section className="py-12 px-8 border-b border-line">
      <div className="max-w-[1100px] mx-auto">
        <SectionHeader
          kicker="09 / COUNCIL"
          title="13 patches absorbed · 3 push-backs declined"
          summary="Three reviewers in parallel: Ralph (brutal roast), Architect (correctness), Designer (terminal-grammar fit). Their convergent catches landed in the spec; their divergent calls were arbitrated."
        />
        <Panel title="Patches absorbed">
          <ul className="divide-y divide-line">
            {patches.map((p, i) => (
              <li key={i} className="px-4 py-2 grid grid-cols-[40px_120px_1fr] gap-3 items-center text-[11px]">
                <span
                  className="font-mono font-bold tabular-nums tracking-[0.1em]"
                  style={{ color: p.tier === 'P0' ? 'var(--state-err)' : 'var(--accent-sel)' }}
                >
                  {p.tier}
                </span>
                <span className="text-ink-3 font-mono text-[10px] tracking-[0.1em] uppercase">{p.source}</span>
                <span className="text-ink-1">{p.issue}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Declined (with reasoning)" className="mt-4">
          <ul className="divide-y divide-line">
            {declined.map((d, i) => (
              <li key={i} className="px-4 py-2 grid grid-cols-[200px_1fr] gap-3 items-center text-[11px]">
                <span className="text-ink-2 font-mono text-[10px] tracking-[0.1em]">{d.source}</span>
                <span className="text-ink-1">{d.reason}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="py-12 px-8 bg-bg-0">
      <div className="max-w-[1100px] mx-auto text-[11px] text-ink-3 font-mono leading-relaxed">
        <div className="text-[10px] tracking-[0.3em] text-accent-sel font-bold mb-3">// META</div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-1">
          <div>spec · docs/superpowers/specs/2026-05-07-case-sniper-phase-4-plan-1-hypothesis-ledger-design.md</div>
          <div>plan source · 06-projects\case-sniper-phase-4-plan.md</div>
          <div>commit · 0386732</div>
          <div>tag (planned) · phase-4-plan-1-hypothesis-ledger</div>
          <div>files in scope · src/lib/useHypothesisLedger.ts · src/lib/resolveHypothesis.ts · src/components/HypothesisLedger.tsx</div>
          <div>integrations · src/App.tsx (AppDashboard) · src/components/DetailPanel.tsx · src/components/CmdK.tsx</div>
        </div>
        <div className="mt-6 text-ink-3">
          // next: <span className="text-ink-1">Daniel reviews this preview, then /writing-plans generates the atomic TDD plan from spec.</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function HypothesisLedgerShowcase() {
  // Lock palette token CSS to inherit from <html data-palette> (existing system)
  return (
    <div className="min-h-screen bg-bg-0 text-ink-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-accent-sel focus:text-bg-0 focus:px-3 focus:py-1 focus:z-50"
      >
        Skip to content
      </a>
      <header className="border-b border-line py-3 px-8 flex items-center gap-4 sticky top-0 z-10 bg-bg-0/95 backdrop-blur">
        <a href="/" className="text-[12px] tracking-[0.2em] text-ink-2 hover:text-ink-0 cursor-pointer transition-colors duration-200 font-mono">
          ← CASE SNIPER
        </a>
        <span className="text-ink-3">·</span>
        <span className="text-[10px] tracking-[0.3em] text-accent-sel font-bold">PHASE 4 / PLAN 1 SPEC</span>
        <span className="ml-auto"><PaletteSwitch /></span>
      </header>
      <main id="main">
        <Hero />
        <Schema />
        <StatesGallery />
        <StatesAndForm />
        <FlashDemo />
        <CmdKPreview />
        <BeforeAfter />
        <ResolverFlow />
        <BoundaryTests />
        <CouncilPatches />
      </main>
      <Footer />
    </div>
  )
}
