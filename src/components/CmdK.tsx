import { useEffect, useMemo, useRef, useState } from 'react'

export type CmdKSection = 'cases' | 'panels' | 'action' | 'toggle'

export interface CmdKItem {
  id: string
  section: CmdKSection
  label: string
  /** Optional right-aligned meta text (e.g. tier tag, current value) */
  meta?: string
  tier?: 'discontinued' | 'rare' | 'active'
  /**
   * P3-#12: when true, the row renders dimmed and Enter / click are no-ops.
   * Lets actions like "Run Analysis" surface in the palette but stay inert
   * when there's no selected case — discoverable but harmless.
   */
  disabled?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  items: CmdKItem[]
  onActivate: (item: CmdKItem) => void
}

const SECTION_LABELS: Record<CmdKSection, string> = {
  cases: 'CASES',
  panels: 'PANELS',
  action: 'ACTION',
  toggle: 'TOGGLE',
}

const SECTION_ORDER: CmdKSection[] = ['cases', 'panels', 'action', 'toggle']

// Module-level component (not nested) — vercel-react-best-practices
// rerender-no-inline-components.
function OptionRow({
  item, selected, optionId, onActivate,
}: { item: CmdKItem; selected: boolean; optionId: string; onActivate: () => void }) {
  const disabled = item.disabled === true
  return (
    <div
      id={optionId}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onActivate}
      className={`px-4 py-2 text-[12px] flex items-center justify-between ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
      style={{
        borderLeft: selected ? '2px solid var(--accent-sel)' : '2px solid transparent',
        background: selected ? 'rgb(var(--accent-sel-rgb) / 0.08)' : 'transparent',
      }}
    >
      <span className="text-ink-0 truncate">{item.label}</span>
      {item.meta && <span className="text-[10px] text-ink-3 tracking-[0.1em] tabular-nums shrink-0 ml-3">{item.meta}</span>}
    </div>
  )
}

// Module-level — rerender-no-inline-components
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-3 pb-1.5 text-[10px] tracking-[0.2em] text-ink-3 font-semibold">
      {label}
    </div>
  )
}

// Fuzzy match: case-insensitive substring with score boost for prefix.
function fuzzyMatch(query: string, label: string): number | null {
  if (query === '') return 0
  const q = query.toLowerCase()
  const l = label.toLowerCase()
  if (l.startsWith(q)) return 1000 - l.length          // prefix wins
  const idx = l.indexOf(q)
  if (idx >= 0) return 500 - idx - l.length            // contained
  // Subsequence match: each query char appears in order in label
  let qi = 0
  for (let i = 0; i < l.length && qi < q.length; i++) if (l[i] === q[qi]) qi++
  if (qi === q.length) return 100 - l.length
  return null
}

export function CmdK({ open, onClose, items, onActivate }: Props) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  // Reset on open + capture opener.
  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement as HTMLElement | null
      setQuery('')
      setSelectedIdx(0)
      inputRef.current?.focus()
    } else if (openerRef.current && typeof openerRef.current.focus === 'function') {
      openerRef.current.focus()
      openerRef.current = null
    }
  }, [open])

  // Filter + sort items by fuzzy score, preserving section grouping.
  const visibleItems = useMemo(() => {
    if (!open) return []
    const scored = items
      .map((item) => ({ item, score: fuzzyMatch(query, item.label) }))
      .filter((x): x is { item: CmdKItem; score: number } => x.score !== null)
    // Stable sort by section first (locked order), then score descending
    scored.sort((a, b) => {
      const aSec = SECTION_ORDER.indexOf(a.item.section)
      const bSec = SECTION_ORDER.indexOf(b.item.section)
      if (aSec !== bSec) return aSec - bSec
      return b.score - a.score
    })
    return scored.map((x) => x.item)
  }, [open, items, query])

  // Keep selectedIdx in bounds.
  useEffect(() => {
    if (selectedIdx >= visibleItems.length && visibleItems.length > 0) {
      setSelectedIdx(0)
    }
  }, [visibleItems.length, selectedIdx])

  // Keyboard handlers — registered ONLY while open.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, Math.max(0, visibleItems.length - 1)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        const item = visibleItems[selectedIdx]
        if (item && !item.disabled) {
          e.preventDefault()
          onActivate(item)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, visibleItems, selectedIdx, onActivate, onClose])

  if (!open) return null

  // Group visibleItems by section for rendering.
  const grouped = SECTION_ORDER.flatMap((sec) => {
    const inSec = visibleItems.filter((i) => i.section === sec)
    return inSec.length === 0 ? [] : [{ section: sec, items: inSec }]
  })

  const activeId = visibleItems[selectedIdx] ? `cmdk-opt-${visibleItems[selectedIdx].id}` : undefined

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-24" role="presentation">
      <div className="absolute inset-0 bg-bg-0/60" onClick={onClose} aria-hidden="true" />
      <div className="relative w-[min(560px,90vw)] bg-bg-1 border border-line shadow-xl">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls="cmdk-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
          placeholder="Aim. Type a case, action, or panel."
          className="w-full px-4 py-3 bg-bg-1 border-b border-line text-[13px] text-ink-0 outline-none"
        />
        <div role="listbox" id="cmdk-listbox" className="max-h-[50vh] overflow-y-auto">
          {grouped.length === 0 ? (
            <div className="px-4 py-6 text-[11px] text-ink-3 tracking-[0.1em] text-center">
              // no matches
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.section} role="group" aria-label={SECTION_LABELS[group.section]}>
                <SectionHeader label={SECTION_LABELS[group.section]} />
                {group.items.map((item) => {
                  const idx = visibleItems.indexOf(item)
                  const isSelected = idx === selectedIdx
                  return (
                    <OptionRow
                      key={item.id}
                      item={item}
                      selected={isSelected}
                      optionId={`cmdk-opt-${item.id}`}
                      onActivate={() => onActivate(item)}
                    />
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
