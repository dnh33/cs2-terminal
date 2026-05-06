import { useMemo } from 'react'
import { CaseChip } from './CaseChip'

interface CaseRef {
  id: string
  name: string
}

interface Props {
  text: string
  cases: CaseRef[]
  onSelect: (caseId: string) => void
}

interface NameMatch {
  start: number
  end: number
  caseId: string
  displayName: string
}

// Module-level helper — vercel-react-best-practices js-set-map-lookups:
// build a Map of lowercase-name → {id, displayName} once for O(1) lookup
// during longest-match-first scan.
function buildLookup(cases: CaseRef[]): Map<string, CaseRef> {
  const map = new Map<string, CaseRef>()
  for (const c of cases) map.set(c.name.toLowerCase(), c)
  return map
}

function findMatches(text: string, cases: CaseRef[]): NameMatch[] {
  // Sort case names by length DESC for longest-match-first.
  const sorted = [...cases].sort((a, b) => b.name.length - a.name.length)
  const lookup = buildLookup(cases)
  const lower = text.toLowerCase()
  const claimed = new Uint8Array(text.length) // O(N) range tracker
  const matches: NameMatch[] = []

  for (const c of sorted) {
    const lname = c.name.toLowerCase()
    // O(1) Map lookup verifies canonical CaseRef via lowercase-name key.
    const ref = lookup.get(lname) ?? c
    let from = 0
    while (true) {
      const idx = lower.indexOf(lname, from)
      if (idx === -1) break
      // Check no portion of [idx, idx+lname.length) is already claimed
      let overlap = false
      for (let i = idx; i < idx + lname.length; i++) {
        if (claimed[i]) {
          overlap = true
          break
        }
      }
      if (!overlap) {
        for (let i = idx; i < idx + lname.length; i++) claimed[i] = 1
        matches.push({ start: idx, end: idx + lname.length, caseId: ref.id, displayName: ref.name })
      }
      from = idx + lname.length
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start)
  return matches
}

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'chip'; caseId: string; caseName: string }

export function ScanOutput({ text, cases, onSelect }: Props) {
  // Memoize match calculation per text + case-list reference.
  // (cases reference can be stable if caller useMemos it — for fitness we
  // accept a recompute when cases or text changes.)
  const segments = useMemo<Segment[]>(() => {
    if (!text) return []
    if (cases.length === 0) return [{ kind: 'text', value: text }]
    const matches = findMatches(text, cases)
    const out: Segment[] = []
    let cursor = 0
    for (const m of matches) {
      if (m.start > cursor) out.push({ kind: 'text', value: text.slice(cursor, m.start) })
      out.push({ kind: 'chip', caseId: m.caseId, caseName: m.displayName })
      cursor = m.end
    }
    if (cursor < text.length) out.push({ kind: 'text', value: text.slice(cursor) })
    return out
  }, [text, cases])

  return (
    <div className="font-prose t-body text-ink-1 whitespace-pre-wrap">
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <CaseChip key={i} caseId={seg.caseId} caseName={seg.caseName} onSelect={onSelect} />
        ),
      )}
    </div>
  )
}
