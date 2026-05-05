import type { CSSProperties, ReactNode, KeyboardEvent } from 'react'

interface KbdRowProps {
  children: ReactNode
  onActivate: () => void
  selected: boolean
  className?: string
  style?: CSSProperties
  /** Optional accessible name for the row. */
  'aria-label'?: string
}

export function KbdRow(props: KbdRowProps) {
  const { children, onActivate, selected, className, style } = props
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate()
    }
  }
  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={selected}
      aria-label={props['aria-label']}
      onClick={onActivate}
      onKeyDown={onKey}
      className={className}
      style={style}
    >
      {children}
    </div>
  )
}

type SortDir = 'asc' | 'desc' | null

interface KbdSortHeaderProps {
  children: ReactNode
  onClick: () => void
  sort: SortDir
  className?: string
}

export function KbdSortHeader({ children, onClick, sort, className }: KbdSortHeaderProps) {
  const ariaSort: 'ascending' | 'descending' | 'none' =
    sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-sort={ariaSort}
      className={['flex items-center gap-1 text-left t-label text-ink-2 hover:text-ink-0', className].filter(Boolean).join(' ')}
    >
      {children}
      {sort && <span aria-hidden="true" className="text-accent-sel">{sort === 'asc' ? '▲' : '▼'}</span>}
    </button>
  )
}
