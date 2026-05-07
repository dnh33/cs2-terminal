import { useEffect, useMemo, useState } from 'react'
import { C } from '../lib/theme'

function highlightInline(s: string): string {
  return s
    .replace(/\$([0-9]+\.?[0-9]*)/g, `<span style="color:${C.orange};font-weight:600">$$$1</span>`)
    .replace(/(\b\d+\.?\d*%)/g, `<span style="color:${C.cyan};font-weight:600">$1</span>`)
    .replace(/\*\*([^*]+)\*\*/g, `<span style="color:${C.t0};font-weight:700">$1</span>`)
    .replace(/`([^`]+)`/g, `<span style="color:${C.yellow};background:rgba(251,191,36,0.08);padding:0 4px">$1</span>`)
}

interface Props {
  text: string
  /** Optional cache key parts. When both are provided AND both caches exist, render flip pill. */
  caseId?: string
  snapshotAt?: number
}

function readCache(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function ProseBlock({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="font-prose t-body text-ink-1 bg-bg-0 border border-line px-4 py-3.5">
      {lines.map((line, i) => {
        const t = line.trim()
        if (!t) return <div key={i} className="h-1.5" />
        if (t.startsWith('//'))
          return (
            <div key={i} className="text-[10px] tracking-[0.2em] text-accent-sel font-bold mt-2.5 mb-1.5">
              {t}
            </div>
          )
        if (/^#+\s/.test(t))
          return (
            <div key={i} className="text-[11px] tracking-[0.15em] text-accent-sel font-bold mt-2.5 mb-1.5 uppercase">
              {t.replace(/^#+\s/, '')}
            </div>
          )
        if (/^[-*•]\s/.test(t))
          return (
            <div key={i} className="flex gap-2 pl-1 mb-0.5">
              <span className="text-accent-data shrink-0">›</span>
              <span
                className="text-ink-1"
                dangerouslySetInnerHTML={{ __html: highlightInline(t.replace(/^[-*•]\s/, '')) }}
              />
            </div>
          )
        return <div key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: highlightInline(t) }} />
      })}
    </div>
  )
}

export function AnalysisOutput({ text, caseId, snapshotAt }: Props) {
  // P0-1 audit fix: asymmetric cache keys.
  // Normal:  cs-analysis:v2:${id}:${snap}     (Plan 4: unified to v2 shape)
  // Devil:   cs-analysis-devil:v2:${id}:${snap}
  // One-shot v1→v2 migration on legacy reads (see normalCache below).
  const { normalCache, devilCache } = useMemo(() => {
    if (!caseId || snapshotAt === undefined) return { normalCache: null, devilCache: null }
    return {
      normalCache: readCache(`cs-analysis:v2:${caseId}:${snapshotAt}`)
        ?? (() => {
            // One-shot v1→v2 migration: read legacy key, copy to v2, delete legacy.
            const legacy = readCache(`cs-analysis:${caseId}:${snapshotAt}`)
            if (legacy) {
              try {
                localStorage.setItem(`cs-analysis:v2:${caseId}:${snapshotAt}`, legacy)
                localStorage.removeItem(`cs-analysis:${caseId}:${snapshotAt}`)
              } catch { /* quota/private mode — leave legacy in place */ }
            }
            return legacy
          })(),
      devilCache: readCache(`cs-analysis-devil:v2:${caseId}:${snapshotAt}`),
    }
  }, [caseId, snapshotAt])

  const bothExist = !!(normalCache && devilCache)
  const [view, setView] = useState<'normal' | 'devil'>('normal')

  // If the active key set changes (e.g., new snapshot), reset back to NORMAL.
  useEffect(() => { setView('normal') }, [caseId, snapshotAt])

  const activeText = bothExist
    ? (view === 'devil' ? (devilCache as string) : (normalCache as string))
    : text

  if (!bothExist) {
    return <ProseBlock text={text} />
  }

  return (
    <div>
      <div role="tablist" className="inline-flex border border-line text-[10px] tracking-[0.15em] mb-2">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'normal'}
          className={`px-2 py-1 ${view === 'normal' ? 'bg-accent-sel/10 text-accent-sel' : 'text-ink-3 hover:text-ink-1'}`}
          onClick={() => setView('normal')}
        >
          NORMAL
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'devil'}
          className={`px-2 py-1 ${view === 'devil' ? 'bg-accent-sel/10 text-accent-sel' : 'text-ink-3 hover:text-ink-1'}`}
          onClick={() => setView('devil')}
        >
          DEVIL
        </button>
      </div>
      <ProseBlock text={activeText} />
    </div>
  )
}
