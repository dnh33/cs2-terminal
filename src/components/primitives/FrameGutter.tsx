interface Props { number: string; label: string; noBorder?: boolean }

/**
 * Vertical-rl numbered frame gutter — Bloomberg-terminal grammar for region IDs.
 * 24px wide vertical strip on the left edge of a panel/region.
 * JetBrains Mono 10px tracking-[0.15em] color var(--ink-3).
 *
 * `noBorder` (default false): when the gutter sits inside a perimeter-bordered
 * workspace (Phase 4.5-3), the standalone `border-r` would create a parallel
 * line ~24px in from the workspace divider — moiré. Opt out at the call site.
 *
 * Hidden on mobile (<md). Decorative — aria-hidden.
 */
export function FrameGutter({ number, label, noBorder = false }: Props) {
  const borderClass = noBorder ? '' : 'border-r border-line'
  return (
    <div
      data-frame-gutter
      className={`hidden md:flex w-6 ${borderClass} text-[10px] tracking-[0.15em] text-ink-3 font-mono items-start py-2 px-1`}
      style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      aria-hidden="true"
    >
      {number}·{label}
    </div>
  )
}
