import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  ariaLabel?: string
}

/**
 * Mobile overlay drawer. Slides up from bottom on <md, full-screen.
 * - `prefers-reduced-motion: reduce` → instant appear, no slide.
 * - Esc dismisses.
 * - Backdrop click dismisses.
 * - Focus management: stores opener on open, restores on close.
 *
 * NOT used at md+ — call site renders the wrapped panel inline at desktop sizes.
 * The component itself doesn't gate on viewport; that's the caller's job
 * (App.tsx mounts <Drawer> only at <md).
 */
export function Drawer({ open, onClose, children, ariaLabel }: Props) {
  const openerRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Capture opener on open; restore focus on close.
  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement as HTMLElement | null
      // Focus the panel itself so screen readers announce + Tab cycles within.
      panelRef.current?.focus()
      return
    }
    if (openerRef.current && typeof openerRef.current.focus === 'function') {
      openerRef.current.focus()
      openerRef.current = null
    }
  }, [open])

  // Esc handler.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100]" role="presentation">
      <div
        data-testid="drawer-backdrop"
        onClick={onClose}
        className="absolute inset-0 motion-safe:transition-opacity motion-safe:duration-[140ms]"
        style={{ background: 'rgb(var(--bg-0-rgb) / 0.6)' }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={ariaLabel}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 top-0 bg-bg-1 border-t border-line overflow-y-auto motion-safe:transition-transform motion-safe:duration-[140ms]"
        style={{ transform: open ? 'translateY(0)' : 'translateY(100%)' }}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      >
        {children}
      </div>
    </div>
  )
}
