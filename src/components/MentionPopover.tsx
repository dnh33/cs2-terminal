import { useEffect, useState } from 'react'

interface CaseRef {
  id: string
  name: string
}

interface Props {
  open: boolean
  query: string
  cases: CaseRef[]
  onPick: (name: string) => void
  onClose: () => void
  /** DOMRect anchor to position the popover; null = render at default offset */
  anchor: { top: number; left: number } | null
}

export function MentionPopover({ open, query, cases, onPick, onClose, anchor }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0)

  const filtered = (() => {
    if (query === '') return cases
    const q = query.toLowerCase()
    return cases.filter((c) => c.name.toLowerCase().includes(q))
  })()

  useEffect(() => {
    if (!open) return
    setSelectedIdx(0)
  }, [open, query])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        const c = filtered[selectedIdx]
        if (c) {
          e.preventDefault()
          onPick(c.name)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, filtered, selectedIdx, onPick, onClose])

  if (!open || filtered.length === 0) return null

  const style: React.CSSProperties = anchor
    ? { position: 'fixed', top: anchor.top, left: anchor.left, zIndex: 150 }
    : { position: 'absolute', bottom: '100%', left: 0, zIndex: 150 }

  return (
    <div role="listbox" aria-label="Case suggestions" className="bg-bg-1 border border-line-bright bg-bg-2 max-h-[200px] overflow-y-auto min-w-[240px]" style={style}>
      {filtered.map((c, i) => (
        <div
          key={c.id}
          role="option"
          aria-selected={i === selectedIdx}
          onClick={() => onPick(c.name)}
          className="px-3 py-1.5 text-[12px] text-ink-0 cursor-pointer"
          style={{
            background: i === selectedIdx ? 'rgb(var(--accent-sel-rgb) / 0.08)' : 'transparent',
            borderLeft: i === selectedIdx ? '2px solid var(--accent-sel)' : '2px solid transparent',
          }}
        >
          {c.name}
        </div>
      ))}
    </div>
  )
}
