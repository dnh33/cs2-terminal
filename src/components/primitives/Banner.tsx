import type { ReactNode } from 'react'

type Variant = 'error' | 'warn' | 'info'

interface Props {
  variant: Variant
  children: ReactNode
  action?: { label: string; onClick: () => void }
  className?: string
}

const VAR_COLOR: Record<Variant, string> = {
  error: 'var(--state-err)',
  warn:  'var(--state-warn)',
  info:  'var(--state-info)',
}

export function Banner({ variant, children, action, className }: Props) {
  const role = variant === 'error' ? 'alert' : 'status'
  const live = variant === 'error' ? 'assertive' : 'polite'
  return (
    <div
      role={role}
      aria-live={live}
      className={['flex items-center gap-3 px-4 py-2 border border-line bg-bg-1 text-[12px] text-ink-1', className].filter(Boolean).join(' ')}
      style={{ boxShadow: `inset 2px 0 0 ${VAR_COLOR[variant]}` }}
    >
      <span className="t-label" style={{ color: VAR_COLOR[variant] }}>
        {variant === 'error' ? '! ERR' : variant === 'warn' ? '⚠ WARN' : 'ℹ INFO'}
      </span>
      <span className="flex-1 font-prose">{children}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="t-label px-3 py-1 border border-line hover:border-ink-2 text-ink-1 hover:text-ink-0"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
