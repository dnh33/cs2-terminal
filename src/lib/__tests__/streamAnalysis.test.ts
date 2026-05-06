import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseStreamWithSentinel, ANALYSIS_SCHEMA, streamAnalysis, SENTINEL } from '../streamAnalysis'

describe('parseStreamWithSentinel', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('parses prose-only stream when no sentinel emitted', () => {
    const result = parseStreamWithSentinel('this is just prose, no sentinel here')
    expect(result.prose).toBe('this is just prose, no sentinel here')
    expect(result.verdict).toBeNull()
    expect(result.error).toBe('no_sentinel')
  })

  it('parses prose + valid JSON tail', () => {
    const stream = `Analysis prose here.\n[[CASE_SNIPER_VERDICT]]\n${JSON.stringify({
      verdict: 'LONG',
      confidence: 0.78,
      rationale: 'rising momentum',
      key_risks: ['volatility'],
    })}`
    const result = parseStreamWithSentinel(stream)
    expect(result.prose.trim()).toBe('Analysis prose here.')
    expect(result.verdict).not.toBeNull()
    expect(result.verdict?.verdict).toBe('LONG')
    expect(result.verdict?.confidence).toBe(0.78)
    expect(result.error).toBeNull()
  })

  it('rejects malformed JSON with error="malformed_json"', () => {
    const stream = 'prose\n[[CASE_SNIPER_VERDICT]]\n{not valid json'
    const result = parseStreamWithSentinel(stream)
    expect(result.prose.trim()).toBe('prose')
    expect(result.verdict).toBeNull()
    expect(result.error).toBe('malformed_json')
  })

  it('rejects schema-invalid JSON with error="schema_invalid"', () => {
    const stream = `prose\n[[CASE_SNIPER_VERDICT]]\n${JSON.stringify({
      verdict: 'NOT_A_VERDICT',  // not in enum
      confidence: 0.5,
      rationale: 'x',
      key_risks: [],
    })}`
    const result = parseStreamWithSentinel(stream)
    expect(result.verdict).toBeNull()
    expect(result.error).toBe('schema_invalid')
  })

  it('rejects duplicate sentinel with error="duplicate_sentinel"', () => {
    const stream = 'a\n[[CASE_SNIPER_VERDICT]]\nb\n[[CASE_SNIPER_VERDICT]]\n{}'
    const result = parseStreamWithSentinel(stream)
    expect(result.error).toBe('duplicate_sentinel')
    expect(result.verdict).toBeNull()
  })

  it('clamps rationale to 280 chars at schema boundary', () => {
    const long = 'x'.repeat(500)
    const stream = `prose\n[[CASE_SNIPER_VERDICT]]\n${JSON.stringify({
      verdict: 'FLAT', confidence: 0.5, rationale: long, key_risks: [],
    })}`
    const result = parseStreamWithSentinel(stream)
    // Schema rejects rationale > 280 chars
    expect(result.error).toBe('schema_invalid')
  })

  it('zod schema accepts valid object', () => {
    const valid = { verdict: 'LONG' as const, confidence: 0.5, rationale: 'ok', key_risks: ['x'] }
    expect(() => ANALYSIS_SCHEMA.parse(valid)).not.toThrow()
  })

  it('zod schema rejects confidence outside [0, 1]', () => {
    expect(() => ANALYSIS_SCHEMA.parse({
      verdict: 'LONG', confidence: 1.5, rationale: 'x', key_risks: [],
    })).toThrow()
  })
})

// ─── streamAnalysis end-to-end (mocked fetch) ───────────────────────────────
//
// These cover P1-#4: the worker emits `event: validated` / `event: invalid`
// SSE records as the authoritative verdict. Frontend must read those events.
// If neither arrives (legacy worker), fall back to client-side sentinel
// reparse on the prose.

function mockFetchSSE(body: string) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body))
      controller.close()
    },
  })
  // @ts-expect-error — minimal Response-like mock for the streaming code path
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    body: stream,
  }))
}

// Helper: build a default-event chunk record (OpenRouter-style content delta).
function chunkRecord(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
}

describe('streamAnalysis (worker-event contract)', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('uses worker `event: validated` as authoritative verdict', async () => {
    const verdict = {
      verdict: 'LONG' as const,
      confidence: 0.82,
      rationale: 'momentum + low supply',
      key_risks: ['volatility'],
    }
    // Worker streams prose chunks, then emits the named `validated` event,
    // then [DONE]. The sentinel + tail prose appear in the deltas because
    // OpenRouter still streams them — but the client must trust the named
    // event over its own reparse.
    const body =
      chunkRecord('Prose body here.') +
      chunkRecord(SENTINEL) +
      // Deliberately corrupt JSON in the tail to prove the named event
      // takes precedence over client-side sentinel reparse.
      chunkRecord('{not valid json at all') +
      `event: validated\ndata: ${JSON.stringify(verdict)}\n\n` +
      `data: [DONE]\n\n`
    mockFetchSSE(body)

    const proseChunks: string[] = []
    const result = await streamAnalysis({
      prompt: 'p', system: 's', structured: true,
      onProse: d => proseChunks.push(d),
    })

    expect(result.verdict).not.toBeNull()
    expect(result.verdict?.verdict).toBe('LONG')
    expect(result.verdict?.confidence).toBe(0.82)
    expect(result.error).toBeNull()
    // Prose stops at the sentinel.
    expect(result.prose).toBe('Prose body here.')
  })

  it('maps worker `event: invalid` reason to ParseError', async () => {
    const body =
      chunkRecord('Some prose with no sentinel.') +
      `event: invalid\ndata: ${JSON.stringify({ reason: 'sentinel_missing' })}\n\n` +
      `data: [DONE]\n\n`
    mockFetchSSE(body)

    const result = await streamAnalysis({
      prompt: 'p', system: 's', structured: true,
      onProse: () => {},
    })

    expect(result.verdict).toBeNull()
    expect(result.error).toBe('no_sentinel')
  })

  it('falls back to sentinel reparse when no worker event arrives (legacy)', async () => {
    const verdict = {
      verdict: 'FLAT' as const,
      confidence: 0.4,
      rationale: 'sideways',
      key_risks: [],
    }
    // Legacy worker: no event:validated record, just prose + sentinel + tail.
    const body =
      chunkRecord('Legacy prose.') +
      chunkRecord(SENTINEL) +
      chunkRecord(JSON.stringify(verdict)) +
      `data: [DONE]\n\n`
    mockFetchSSE(body)

    const result = await streamAnalysis({
      prompt: 'p', system: 's', structured: true,
      onProse: () => {},
    })

    expect(result.verdict).not.toBeNull()
    expect(result.verdict?.verdict).toBe('FLAT')
    expect(result.error).toBeNull()
    expect(result.prose).toBe('Legacy prose.')
  })

  it('rejects worker `event: validated` payload that fails Zod (defense in depth)', async () => {
    // Worker said "validated" but sent a bad payload. Don't accept it blindly.
    const body =
      chunkRecord('prose') +
      chunkRecord(SENTINEL) +
      `event: validated\ndata: ${JSON.stringify({ verdict: 'NOPE', confidence: 9, rationale: '', key_risks: [] })}\n\n` +
      `data: [DONE]\n\n`
    mockFetchSSE(body)

    const result = await streamAnalysis({
      prompt: 'p', system: 's', structured: true,
      onProse: () => {},
    })

    expect(result.verdict).toBeNull()
    expect(result.error).toBe('schema_invalid')
  })
})
