import { useCallback, useSyncExternalStore } from 'react'

export interface LocalLogConfig<TEntry, TInput> {
  key: string
  event: string
  schemaVersion: number
  buildEntry: (input: TInput) => TEntry
  validate: (parsed: unknown) => TEntry[] | null
  validateEntry?: (entry: unknown) => TEntry | null
}

export interface LocalLogState<TEntry> {
  schemaVersion: 1
  entries: TEntry[]
}

export interface LocalLogStorageHelpers<TEntry> {
  read: () => LocalLogState<TEntry>
  write: (state: LocalLogState<TEntry>) => void
  dispatch: () => void
}

export interface UseLocalLogResult<TEntry, TInput> {
  entries: TEntry[]
  commit: (input: TInput) => void
  remove: (id: string) => void
}

export function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function createLocalLog<TEntry extends { id: string }, TInput>(
  config: LocalLogConfig<TEntry, TInput>,
): {
  helpers: LocalLogStorageHelpers<TEntry>
  useLog: () => UseLocalLogResult<TEntry, TInput>
} {
  const EMPTY: LocalLogState<TEntry> = { schemaVersion: 1, entries: [] }

  function read(): LocalLogState<TEntry> {
    try {
      const raw = localStorage.getItem(config.key)
      if (!raw) return EMPTY
      const parsed = JSON.parse(raw) as unknown
      const validated = config.validate(parsed)
      if (!validated) return EMPTY
      const entries = config.validateEntry
        ? validated
            .map((e) => config.validateEntry!(e))
            .filter((e): e is TEntry => {
              if (e === null) {
                console.warn(`[useLocalLog] dropped invalid entry from ${config.key}`)
                return false
              }
              return true
            })
        : validated
      return { schemaVersion: 1, entries }
    } catch {
      return EMPTY
    }
  }

  function write(state: LocalLogState<TEntry>): void {
    try {
      localStorage.setItem(config.key, JSON.stringify(state))
    } catch (e) {
      console.warn(`[useLocalLog] write failed for ${config.key}`, e)
      /* quota / private mode — non-fatal, in-memory state still updates */
    }
  }

  function dispatch(): void {
    window.dispatchEvent(new CustomEvent(config.event))
  }

  let snapshotCache: { raw: string | null; parsed: LocalLogState<TEntry> } = { raw: null, parsed: EMPTY }

  function getSnapshot(): LocalLogState<TEntry> {
    let raw: string | null = null
    try { raw = localStorage.getItem(config.key) } catch { /* ignore */ }
    if (raw === snapshotCache.raw) return snapshotCache.parsed
    const parsed = read()
    snapshotCache = { raw, parsed }
    return parsed
  }

  function subscribe(cb: () => void): () => void {
    function onStorage(e: StorageEvent) { if (e.key === config.key) cb() }
    function onCustom() { cb() }
    window.addEventListener('storage', onStorage)
    window.addEventListener(config.event, onCustom as EventListener)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(config.event, onCustom as EventListener)
    }
  }

  function useLog(): UseLocalLogResult<TEntry, TInput> {
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    const commit = useCallback((input: TInput) => {
      const entry = config.buildEntry(input)
      const next: LocalLogState<TEntry> = {
        schemaVersion: 1,
        entries: [entry, ...read().entries],
      }
      write(next)
      let liveRaw: string | null = null
      try { liveRaw = localStorage.getItem(config.key) } catch { /* ignore */ }
      snapshotCache = { raw: liveRaw, parsed: next }
      dispatch()
    }, [])

    const remove = useCallback((id: string) => {
      const current = read()
      const next: LocalLogState<TEntry> = {
        schemaVersion: 1,
        entries: current.entries.filter((e) => e.id !== id),
      }
      if (next.entries.length === current.entries.length) return // no-op on unknown id
      write(next)
      let liveRaw: string | null = null
      try { liveRaw = localStorage.getItem(config.key) } catch { /* ignore */ }
      snapshotCache = { raw: liveRaw, parsed: next }
      dispatch()
    }, [])

    return { entries: state.entries, commit, remove }
  }

  return {
    helpers: { read, write, dispatch },
    useLog,
  }
}
