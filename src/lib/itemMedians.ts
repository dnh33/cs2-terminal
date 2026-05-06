import { AuthRequiredError, getStoredToken } from './api'

declare global {
  interface Window {
    __CS2_CONFIG__?: { workerUrl?: string }
  }
}

const WORKER_URL =
  (typeof window !== 'undefined' && window.__CS2_CONFIG__?.workerUrl) ||
  import.meta.env.VITE_WORKER_URL ||
  'http://localhost:8787'

export interface ItemMedianRow {
  case_id: string
  item_name: string
  kind: 'item_high' | 'item_low'
  fetched_at: number
  lowest: number | null
  median: number | null
  volume: number | null
}

export interface ItemMediansResponse {
  case_id: string
  items: ItemMedianRow[]
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Pull latest snapshot per item for a case, partitioned by tier in the response.
 * Powers FIT framework's unbox_ev_ratio computation.
 */
export async function fetchItemMedians(caseId: string): Promise<ItemMediansResponse> {
  const url = `${WORKER_URL}/api/items/medians?caseId=${encodeURIComponent(caseId)}`
  const res = await fetch(url, { headers: authHeaders() })
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cs2-auth-required'))
    }
    throw new AuthRequiredError()
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`/api/items/medians → ${res.status}: ${text.slice(0, 180)}`)
  }
  return res.json()
}
