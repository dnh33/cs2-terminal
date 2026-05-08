import { useEffect, useState } from 'react'
import { fetchConfig } from './api'

/**
 * Phase 4.5 Plan 4 — single source of truth for the displayed model id.
 * Auto-synced with the worker's OPENROUTER_MODEL env var via GET /config
 * (no OpenRouter call; pure local read on the Cloudflare side).
 *
 * Module-level cache so multiple consumers (Header, FooterStrip) only fire
 * one fetch per session. Dev-mode fallback while the request is in flight:
 * the loading state returns null and consumers render an em-dash placeholder.
 */
const FALLBACK_MODEL = 'ring-2.6-1t:free'

let cached: string | null = null
let inFlight: Promise<string> | null = null

export function useDisplayedModel(): string | null {
  const [model, setModel] = useState<string | null>(cached)

  useEffect(() => {
    if (cached !== null) {
      setModel(cached)
      return
    }
    if (!inFlight) {
      inFlight = fetchConfig()
        .then((c) => {
          // Worker may return the prefixed form (e.g. "inclusionai/ring-2.6-1t:free").
          // Strip the provider prefix for display — the slash-separated tail is
          // what users recognize.
          const display = c.model.includes('/') ? c.model.split('/').pop()! : c.model
          cached = display
          return display
        })
        .catch(() => {
          cached = FALLBACK_MODEL
          return FALLBACK_MODEL
        })
    }
    let cancelled = false
    inFlight.then((m) => {
      if (!cancelled) setModel(m)
    })
    return () => { cancelled = true }
  }, [])

  return model
}

// Kept for any consumer that hasn't migrated yet — same fallback string. The
// Phase 4.5 Plan 4 follow-up consumers (Header, FooterStrip) use the hook above.
export const DISPLAYED_MODEL_ID = FALLBACK_MODEL
