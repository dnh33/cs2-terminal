interface Props { number: string; label: string }

/**
 * Vertical-rl numbered frame gutter — Bloomberg-terminal grammar for region IDs.
 * 24px wide vertical strip on the left edge of a panel/region.
 * JetBrains Mono 10px tracking-[0.15em] color var(--ink-3) with 1px right-border.
 * Hidden on mobile (<md) to avoid breaking single-column layout with vertical text.
 * Decorative — aria-hidden so it doesn't pollute the accessibility tree.
 */
export function FrameGutter({ number, label }: Props) {
  return (
    <div
      data-frame-gutter
      className="hidden md:flex w-6 border-r border-line text-[10px] tracking-[0.15em] text-ink-3 font-mono items-start py-2 px-1"
      style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      aria-hidden="true"
    >
      {number}·{label}
    </div>
  )
}
