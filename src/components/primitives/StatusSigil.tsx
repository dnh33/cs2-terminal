type Status = 'live' | 'syncing' | 'stale' | 'idle' | 'err'

interface Props {
  status: Status
  size?: number
}

const COLOR: Record<Status, string> = {
  live: 'var(--state-info)',
  syncing: 'var(--accent-sel)',
  stale: 'var(--state-warn)',
  idle: 'var(--ink-3)',
  err: 'var(--state-err)',
}

export function StatusSigil({ status, size = 28 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      role="img"
      aria-label={`Feed: ${status}`}
      style={{ flexShrink: 0 }}
    >
      <rect x="2" y="2" width="24" height="24" fill="var(--accent-sel)" opacity="0.12" />
      <rect x="2" y="2" width="24" height="24" fill="none" stroke="var(--accent-sel)" strokeWidth="1.5" />
      <line x1="14" y1="3" x2="14" y2="9" stroke="var(--accent-data)" strokeWidth="1.5" />
      <line x1="14" y1="19" x2="14" y2="25" stroke="var(--accent-data)" strokeWidth="1.5" />
      <line x1="3" y1="14" x2="9" y2="14" stroke="var(--accent-data)" strokeWidth="1.5" />
      <line x1="19" y1="14" x2="25" y2="14" stroke="var(--accent-data)" strokeWidth="1.5" />
      <circle
        cx="14"
        cy="14"
        r={status === 'live' ? 2.4 : 1.8}
        fill={COLOR[status]}
        className={status === 'live' ? 'animate-pulse-sigil' : undefined}
      />
    </svg>
  )
}
