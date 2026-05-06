import { z } from 'zod'
import { callClaudeStream, type AuthRequiredError } from './api'

export const SENTINEL = '\n[[CASE_SNIPER_VERDICT]]\n'

export const ANALYSIS_SCHEMA = z.object({
  verdict: z.enum(['LONG', 'FLAT', 'AVOID']),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(280),
  key_risks: z.array(z.string().max(80)).max(3),
})

export type AnalysisVerdict = z.infer<typeof ANALYSIS_SCHEMA>

export type ParseError = 'no_sentinel' | 'malformed_json' | 'schema_invalid' | 'duplicate_sentinel'

export interface ParsedStream {
  prose: string
  verdict: AnalysisVerdict | null
  error: ParseError | null
}

/**
 * Pure parsing function. Splits a complete stream string on the sentinel,
 * Zod-validates the JSON tail, returns prose + verdict OR error reason.
 *
 * Sentinel is brand-unique (25 chars, includes "CASE_SNIPER_VERDICT") so
 * collision with prose content is practically impossible. Duplicate
 * occurrence is treated as error per the locked design — Claude is
 * instructed to emit the sentinel exactly once.
 */
export function parseStreamWithSentinel(stream: string): ParsedStream {
  // Count sentinel occurrences
  let count = 0
  let firstIdx = -1
  let searchFrom = 0
  while (true) {
    const idx = stream.indexOf(SENTINEL, searchFrom)
    if (idx === -1) break
    count++
    if (firstIdx === -1) firstIdx = idx
    searchFrom = idx + SENTINEL.length
    if (count > 1) {
      return { prose: stream.slice(0, firstIdx), verdict: null, error: 'duplicate_sentinel' }
    }
  }

  if (count === 0) {
    return { prose: stream, verdict: null, error: 'no_sentinel' }
  }

  const prose = stream.slice(0, firstIdx)
  const tail = stream.slice(firstIdx + SENTINEL.length).trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(tail)
  } catch {
    return { prose, verdict: null, error: 'malformed_json' }
  }

  const result = ANALYSIS_SCHEMA.safeParse(parsed)
  if (!result.success) {
    return { prose, verdict: null, error: 'schema_invalid' }
  }
  return { prose, verdict: result.data, error: null }
}

export interface StreamAnalysisOptions {
  prompt: string
  system: string
  onProse: (delta: string) => void
  signal?: AbortSignal
  /**
   * When true, asks the Worker to inject the sentinel-instruction system
   * prompt prefix so Claude emits a [[CASE_SNIPER_VERDICT]] tail with a
   * structured JSON object. When false (default), no sentinel is requested
   * and parseStreamWithSentinel returns error='no_sentinel' on completion.
   * Plan 3 T40 sets this to true for the analyze-case path. Other callers
   * (chat, market scan) leave it false.
   */
  structured?: boolean
}

export interface StreamAnalysisResult {
  prose: string
  verdict: AnalysisVerdict | null
  error: ParseError | null
}

// Re-export AuthRequiredError type so callers can catch it without a
// separate import from ./api.
export type { AuthRequiredError }

/**
 * High-level streaming analysis. Wraps callClaudeStream:
 *  - Streams Claude's response, calling onProse for each visible delta
 *    (tokens BEFORE the sentinel are visible; tokens AFTER are buffered
 *    silently as the JSON tail).
 *  - On stream end: parses with parseStreamWithSentinel, returns prose +
 *    verdict (or error).
 *  - Caller passes signal for AbortController-based cancellation.
 *
 * Server-side (Worker) responsibility: inject the sentinel-instruction
 * system prompt prefix. This client trusts the contract.
 */
export async function streamAnalysis(opts: StreamAnalysisOptions): Promise<StreamAnalysisResult> {
  const { prompt, system, onProse, signal, structured } = opts

  let fullStream = ''
  let inTail = false
  let tailBuffer = ''
  let proseAccum = ''

  // Authoritative path: the Worker emits a terminal `event: validated` /
  // `event: invalid` SSE record after parsing the sentinel server-side.
  // We latch the first such event and prefer it over the client-side
  // sentinel reparse (defense-in-depth: still Zod-validate on receipt).
  // If neither event arrives (legacy worker / non-structured), we fall
  // back to parseStreamWithSentinel on the accumulated prose+tail.
  let workerVerdict: AnalysisVerdict | null = null
  let workerError: ParseError | null = null
  let workerEventSeen = false

  await callClaudeStream(
    {
      messages: [{ role: 'user', content: prompt }],
      system,
      cache_system_prompt: true,
      // explicit opt-in; Worker injects sentinel only when true
      // Cast: ChatRequest doesn't yet declare `structured`; T28 widens the
      // worker contract. Keeping the cast localized avoids touching api.ts.
      ...({ structured: structured === true } as Record<string, unknown>),
    } as Parameters<typeof callClaudeStream>[0],
    (delta) => {
      fullStream += delta
      if (inTail) {
        tailBuffer += delta
        return
      }
      // Check if the sentinel has appeared in fullStream up to here.
      const sentinelIdx = fullStream.indexOf(SENTINEL)
      if (sentinelIdx === -1) {
        // Still in prose. Forward delta to UI.
        proseAccum += delta
        onProse(delta)
        return
      }
      // Sentinel just landed. Send up to sentinel as prose, buffer the rest.
      const proseEnd = sentinelIdx
      const proseDelta = fullStream.slice(proseAccum.length, proseEnd)
      if (proseDelta.length > 0) {
        proseAccum += proseDelta
        onProse(proseDelta)
      }
      tailBuffer = fullStream.slice(proseEnd + SENTINEL.length)
      inTail = true
    },
    signal,
    (name, data) => {
      // First worker event wins; subsequent ones are ignored.
      if (workerEventSeen) return
      if (name === 'validated') {
        const result = ANALYSIS_SCHEMA.safeParse(data)
        if (result.success) {
          workerVerdict = result.data
          workerEventSeen = true
        } else {
          // Worker said "validated" but the payload doesn't match our schema.
          // Treat as schema_invalid; fall through to whatever the sentinel
          // reparse decides only if no other signal arrives.
          workerError = 'schema_invalid'
          workerEventSeen = true
        }
      } else if (name === 'invalid') {
        // Worker reported a structural failure. Map its `reason` field to
        // our ParseError taxonomy where possible; default to malformed_json.
        const reason = (data as { reason?: string } | null)?.reason
        workerError =
          reason === 'sentinel_missing' ? 'no_sentinel'
          : reason === 'json_parse_error' ? 'malformed_json'
          : 'malformed_json'
        workerEventSeen = true
      }
    },
  )

  // Authoritative: worker-event-driven verdict.
  if (workerEventSeen) {
    // Slice prose out of the accumulated stream the same way the sentinel
    // parser would, so the UI's prose snapshot stays consistent regardless
    // of which path produced the verdict.
    const sentinelIdx = fullStream.indexOf(SENTINEL)
    const prose = sentinelIdx === -1 ? fullStream : fullStream.slice(0, sentinelIdx)
    return { prose, verdict: workerVerdict, error: workerVerdict ? null : workerError }
  }

  // Legacy fallback: no worker event arrived (older worker, or transport
  // dropped the trailing record). Reparse the sentinel from prose.
  return parseStreamWithSentinel(fullStream)
}
