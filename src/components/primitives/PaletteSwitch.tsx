import { useEffect, useState } from 'react'

type Mode = 'std' | 'amber' | 'green'
const STORAGE_KEY = 'cs-palette'
const MODES: { id: Mode; label: string }[] = [
  { id: 'std',   label: 'STD' },
  { id: 'amber', label: 'AMBER' },
  { id: 'green', label: 'GREEN' },
]

function readInitial(): Mode {
  if (typeof localStorage === 'undefined') return 'std'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'amber' || v === 'green' ? v : 'std'
}

export function PaletteSwitch() {
  const [mode, setMode] = useState<Mode>(readInitial)

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', mode)
    try { localStorage.setItem(STORAGE_KEY, mode) } catch {}
  }, [mode])

  return (
    <div role="radiogroup" aria-label="Palette mode" className="inline-flex border border-line">
      {MODES.map(m => (
        <button
          key={m.id}
          role="radio"
          aria-checked={mode === m.id}
          aria-label={m.label}
          onClick={() => setMode(m.id)}
          className={[
            'px-3 py-1 text-[10px] tracking-[0.15em] uppercase border-r border-line last:border-r-0',
            mode === m.id
              ? 'text-ink-0 bg-bg-2 font-semibold'
              : 'text-ink-2 hover:text-ink-0',
          ].join(' ')}
          style={mode === m.id ? { boxShadow: 'inset 2px 0 0 var(--accent-sel)' } : undefined}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
