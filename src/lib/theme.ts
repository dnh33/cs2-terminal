// Token-reading constants. The values are CSS custom property references —
// any place that uses them inline (Recharts colors, inline styles, SVG
// attribute strings) gets resolved at paint time by the browser, so
// palette switching works without re-rendering React.
//
// IMPORTANT: every key from the legacy theme.ts MUST survive here so the
// existing codebase compiles at the moment Task 1 lands. The actual color
// migration happens in Task 11.5 (sweep) — Phase 1 only replaces the
// VALUES, not the KEYS.
export const C = {
  bg0:  'var(--bg-0)',
  bg1:  'var(--bg-1)',
  bg2:  'var(--bg-2)',
  bg3:  'var(--bg-3)',
  bg4:  'var(--bg-4)',
  line: 'var(--line)',
  lineBright: 'var(--line-hi)',
  t0: 'var(--ink-0)',
  t1: 'var(--ink-1)',
  t2: 'var(--ink-2)',
  t3: 'var(--ink-3)',
  orange:    'var(--accent-sel)',
  orangeDim: 'var(--accent-sel-dim)',
  cyan:      'var(--accent-data)',
  cyanDim:   'var(--accent-sel-dim)', // legacy key; not referenced
  green:     'var(--delta-up)',
  red:       'var(--delta-dn)',
  yellow:    'var(--state-warn)',
  // Purple is retired by the design system but DetailPanel.tsx still
  // references C.purple for the "POOL APPRECIATION BIAS" metric bar
  // (Phase 2 will replace that whole block with a single FIT score).
  // Until then, alias purple to ink-3 so the bar renders as a neutral
  // tone and the build stays green.
  purple:    'var(--ink-3)',
  modeled:   'var(--modeled)',
  onAccent:  'var(--on-accent)',
  focusInverse: 'var(--focus-inverse)',
} as const
