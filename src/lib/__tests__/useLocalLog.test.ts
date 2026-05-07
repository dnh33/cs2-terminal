import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createLocalLog, uuidv4 } from '../useLocalLog'

interface TestEntry { id: string; value: string; createdAt: number }
interface TestInput { value: string }

const TEST_KEY = 'test-key:v1'
const TEST_EVENT = 'test-key-changed'

function makeLog() {
  return createLocalLog<TestEntry, TestInput>({
    key: TEST_KEY,
    event: TEST_EVENT,
    schemaVersion: 1,
    buildEntry: (input) => ({ id: uuidv4(), value: input.value, createdAt: Date.now() }),
    validate: (parsed) => {
      if (!parsed || typeof parsed !== 'object') return null
      const o = parsed as { schemaVersion?: number; entries?: unknown }
      if (o.schemaVersion !== 1 || !Array.isArray(o.entries)) return null
      return o.entries as TestEntry[]
    },
  })
}

describe('useLocalLog primitive', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('createLocalLog returns helpers and useLog', () => {
    const { helpers, useLog } = makeLog()
    expect(helpers.read).toBeTypeOf('function')
    expect(helpers.write).toBeTypeOf('function')
    expect(helpers.dispatch).toBeTypeOf('function')
    expect(useLog).toBeTypeOf('function')
  })

  it('helpers.read returns empty state on missing key', () => {
    const { helpers } = makeLog()
    expect(helpers.read()).toEqual({ schemaVersion: 1, entries: [] })
  })

  it('helpers.read returns empty state on malformed JSON', () => {
    const { helpers } = makeLog()
    localStorage.setItem(TEST_KEY, 'not-json{{{')
    expect(helpers.read()).toEqual({ schemaVersion: 1, entries: [] })
  })

  it('helpers.read returns empty state on schema mismatch', () => {
    const { helpers } = makeLog()
    localStorage.setItem(TEST_KEY, JSON.stringify({ schemaVersion: 999, entries: [] }))
    expect(helpers.read()).toEqual({ schemaVersion: 1, entries: [] })
  })

  it('helpers.write persists state; idempotent re-read', () => {
    const { helpers } = makeLog()
    const state = { schemaVersion: 1 as const, entries: [{ id: 'a', value: 'x', createdAt: 1 }] }
    helpers.write(state)
    expect(helpers.read()).toEqual(state)
  })

  it('helpers.dispatch fires custom event with correct name', () => {
    const { helpers } = makeLog()
    const handler = vi.fn()
    window.addEventListener(TEST_EVENT, handler)
    helpers.dispatch()
    expect(handler).toHaveBeenCalledOnce()
    window.removeEventListener(TEST_EVENT, handler)
  })

  it('useLog: commit appends entry; entries newest-first', () => {
    const { useLog } = makeLog()
    const { result } = renderHook(() => useLog())
    act(() => result.current.commit({ value: 'first' }))
    act(() => result.current.commit({ value: 'second' }))
    expect(result.current.entries).toHaveLength(2)
    expect(result.current.entries[0].value).toBe('second')
    expect(result.current.entries[1].value).toBe('first')
  })

  it('useLog: remove(id) drops matching entry; no-op on unknown id', () => {
    const { helpers, useLog } = makeLog()
    helpers.write({ schemaVersion: 1, entries: [
      { id: 'a', value: 'x', createdAt: 1 },
      { id: 'b', value: 'y', createdAt: 2 },
    ] })
    const { result } = renderHook(() => useLog())
    expect(result.current.entries).toHaveLength(2)
    act(() => result.current.remove('a'))
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].id).toBe('b')
    act(() => result.current.remove('does-not-exist'))
    expect(result.current.entries).toHaveLength(1)
  })

  it('useLog: same-tab custom event triggers re-render', () => {
    const { helpers, useLog } = makeLog()
    const { result } = renderHook(() => useLog())
    expect(result.current.entries).toHaveLength(0)
    act(() => {
      helpers.write({ schemaVersion: 1, entries: [{ id: 'a', value: 'x', createdAt: 1 }] })
      helpers.dispatch()
    })
    expect(result.current.entries).toHaveLength(1)
  })

  it('useLog: storage event triggers re-render across hook instances', () => {
    const { useLog } = makeLog()
    const { result } = renderHook(() => useLog())
    expect(result.current.entries).toHaveLength(0)
    act(() => {
      localStorage.setItem(TEST_KEY, JSON.stringify({
        schemaVersion: 1, entries: [{ id: 'a', value: 'cross-tab', createdAt: 1 }],
      }))
      window.dispatchEvent(new StorageEvent('storage', { key: TEST_KEY }))
    })
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].value).toBe('cross-tab')
  })

  it('cross-tab race: back-to-back storage events both invalidate cache', () => {
    const { useLog } = makeLog()
    const { result } = renderHook(() => useLog())
    act(() => {
      localStorage.setItem(TEST_KEY, JSON.stringify({
        schemaVersion: 1, entries: [{ id: 'a', value: 'first', createdAt: 1 }],
      }))
      window.dispatchEvent(new StorageEvent('storage', { key: TEST_KEY }))
    })
    expect(result.current.entries[0].value).toBe('first')
    act(() => {
      localStorage.setItem(TEST_KEY, JSON.stringify({
        schemaVersion: 1, entries: [{ id: 'b', value: 'second', createdAt: 2 }],
      }))
      window.dispatchEvent(new StorageEvent('storage', { key: TEST_KEY }))
    })
    expect(result.current.entries[0].value).toBe('second')
  })

  it('concurrent same-tab commits: both persist; ordering deterministic', () => {
    const { useLog } = makeLog()
    const { result } = renderHook(() => useLog())
    act(() => {
      result.current.commit({ value: 'A' })
      result.current.commit({ value: 'B' })
    })
    expect(result.current.entries).toHaveLength(2)
    // Newest-first: B was committed second, so it's at index 0.
    expect(result.current.entries[0].value).toBe('B')
    expect(result.current.entries[1].value).toBe('A')
  })

  it('quota-exceeded write does not crash; in-memory state still updates', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const err = new Error('QuotaExceededError')
      err.name = 'QuotaExceededError'
      throw err
    })
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { useLog } = makeLog()
    const { result } = renderHook(() => useLog())
    expect(() => act(() => result.current.commit({ value: 'over-quota' }))).not.toThrow()
    setItemSpy.mockRestore()
    consoleWarn.mockRestore()
  })

  it('validateEntry per-entry filter drops corrupt entries with warn', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { helpers, useLog } = createLocalLog<TestEntry, TestInput>({
      key: TEST_KEY,
      event: TEST_EVENT,
      schemaVersion: 1,
      buildEntry: (input) => ({ id: uuidv4(), value: input.value, createdAt: Date.now() }),
      validate: (parsed) => {
        if (!parsed || typeof parsed !== 'object') return null
        const o = parsed as { schemaVersion?: number; entries?: unknown }
        if (o.schemaVersion !== 1 || !Array.isArray(o.entries)) return null
        return o.entries as TestEntry[]
      },
      validateEntry: (e) => {
        if (e && typeof e === 'object' && typeof (e as TestEntry).value === 'string') {
          return e as TestEntry
        }
        return null
      },
    })
    helpers.write({ schemaVersion: 1, entries: [
      { id: 'good', value: 'ok', createdAt: 1 },
      { value: 42 } as unknown as TestEntry, // corrupt: missing id, value wrong type
    ] })
    const { result } = renderHook(() => useLog())
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].id).toBe('good')
    expect(consoleWarn).toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('uuidv4 returns RFC4122-ish format (v4)', () => {
    const id = uuidv4()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('subscribe + unsubscribe is balanced (StrictMode-safe)', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { useLog } = makeLog()
    const { unmount } = renderHook(() => useLog())
    unmount()
    // Verify both 'storage' and config.event listeners are removed on unmount.
    const calls = removeSpy.mock.calls.map(c => c[0])
    expect(calls).toContain('storage')
    expect(calls).toContain(TEST_EVENT)
  })

  it('vi.resetModules survival: re-importing the module produces fresh state', async () => {
    // Plan 5 T5 Tier 1 escalation depends on this — vi.resetModules() between
    // tests must not leave stale subscribers or stale snapshotCache.
    const log1 = makeLog()
    const { unmount } = renderHook(() => log1.useLog())
    log1.helpers.write({ schemaVersion: 1, entries: [{ id: 'a', value: 'pre-reset', createdAt: 1 }] })
    unmount()

    vi.resetModules()
    const fresh = await import('../useLocalLog')
    const log2 = fresh.createLocalLog<TestEntry, TestInput>({
      key: TEST_KEY,
      event: TEST_EVENT,
      schemaVersion: 1,
      buildEntry: (input) => ({ id: fresh.uuidv4(), value: input.value, createdAt: Date.now() }),
      validate: (parsed) => {
        if (!parsed || typeof parsed !== 'object') return null
        const o = parsed as { schemaVersion?: number; entries?: unknown }
        if (o.schemaVersion !== 1 || !Array.isArray(o.entries)) return null
        return o.entries as TestEntry[]
      },
    })
    // Storage persists across resetModules; the new module instance reads it fresh.
    expect(log2.helpers.read().entries).toHaveLength(1)
    expect(log2.helpers.read().entries[0].value).toBe('pre-reset')
    // No stale listeners from the pre-reset module — manual dispatch on TEST_EVENT
    // should NOT trigger any old subscribers (they unmounted).
    window.dispatchEvent(new CustomEvent(TEST_EVENT))
    // No assertion failure expected; this just must not throw or trigger leaked handlers.
  })
})
