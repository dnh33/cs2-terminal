import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseStreamWithSentinel, ANALYSIS_SCHEMA } from '../streamAnalysis'

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
