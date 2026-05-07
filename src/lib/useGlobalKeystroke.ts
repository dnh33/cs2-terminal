import { useEffect } from 'react'

interface Handlers {
  onCmdK?: () => void
  onSlash?: () => void
  onEsc?: () => void
}

export function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  return false
}

/**
 * Single document-level keydown dispatcher. Replaces N independent
 * `addEventListener('keydown')` calls scattered across components.
 *
 * - ⌘K / Ctrl+K → onCmdK; preventDefault to override Firefox address-bar focus.
 * - `/` → onSlash; ONLY when no input/textarea/contenteditable is focused.
 * - Esc → onEsc; always fires (caller decides whether to act).
 *
 * Browser defaults (⌘W, ⌘T, ⌘N, ⌘R, ⌘L, etc.) are NEVER trapped — only
 * the exact key matches above call preventDefault.
 */
export function useGlobalKeystroke(handlers: Handlers): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // ⌘K / Ctrl+K
      if (e.key === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        if (handlers.onCmdK) {
          e.preventDefault()
          handlers.onCmdK()
        }
        return
      }
      // `/` — only when no editable element is focused
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!isInputFocused() && handlers.onSlash) {
          e.preventDefault()
          handlers.onSlash()
        }
        return
      }
      // Escape — always fires the handler if present
      if (e.key === 'Escape') {
        handlers.onEsc?.()
        return
      }
      // Anything else: do not preventDefault, do not call any handler.
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers.onCmdK, handlers.onSlash, handlers.onEsc])
}
