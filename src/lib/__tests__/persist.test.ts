import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { saveAnalysis, loadAnalysis, saveScan, loadLastScan } from '../persist'

describe('persist analyses', () => {
  beforeEach(() => localStorage.clear())

  it('saves and loads an analysis keyed by caseId + snapshot', () => {
    saveAnalysis('glove', 1700000000, 'thesis: long')
    expect(loadAnalysis('glove', 1700000000)).toBe('thesis: long')
  })

  it('returns null when key absent', () => {
    expect(loadAnalysis('glove', 1700000000)).toBe(null)
  })

  it('returns null when snapshot mismatches (cache busted by new data)', () => {
    saveAnalysis('glove', 1700000000, 'old')
    expect(loadAnalysis('glove', 1700000999)).toBe(null)
  })

  it('uses a stable key format including caseId and snapshotAt', () => {
    saveAnalysis('chroma', 42, 'x')
    expect(localStorage.getItem('cs-analysis:v2:chroma:42')).toBe('x')
  })
})

describe('persist scans', () => {
  beforeEach(() => localStorage.clear())

  it('saves last scan with timestamp', () => {
    saveScan('full output')
    const last = loadLastScan()
    expect(last?.text).toBe('full output')
    expect(typeof last?.savedAt).toBe('number')
  })

  it('returns null when no scan saved', () => {
    expect(loadLastScan()).toBe(null)
  })

  it('returns null gracefully when JSON is corrupted', () => {
    localStorage.setItem('cs-last-scan', '{not json')
    expect(loadLastScan()).toBe(null)
  })
})

describe('persist resilience', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saveAnalysis swallows storage errors (e.g. quota exceeded)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    expect(() => saveAnalysis('a', 1, 'b')).not.toThrow()
    expect(spy).toHaveBeenCalled()
  })

  it('loadAnalysis returns null when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('disabled')
    })
    expect(loadAnalysis('a', 1)).toBe(null)
  })

  it('saveScan swallows storage errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    expect(() => saveScan('hi')).not.toThrow()
  })

  it('loadLastScan returns null when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('disabled')
    })
    expect(loadLastScan()).toBe(null)
  })
})
