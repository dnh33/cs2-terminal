interface Props { targetId: string }

/**
 * WCAG 2.4.1 (Level A) Bypass Blocks. Visually hidden until focused; first
 * Tab into the page reveals it top-left, Enter jumps focus to the target
 * landmark (typically <main id="main">).
 */
export function SkipLink({ targetId }: Props) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only fixed top-2 left-2 z-[100] bg-bg-2 border border-line text-ink-0 px-3 py-2 t-label"
    >
      Skip to content
    </a>
  )
}
