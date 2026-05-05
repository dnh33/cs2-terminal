import { C } from '../lib/theme'

function highlightInline(s: string): string {
  return s
    .replace(/\$([0-9]+\.?[0-9]*)/g, `<span style="color:${C.orange};font-weight:600">$$$1</span>`)
    .replace(/(\b\d+\.?\d*%)/g, `<span style="color:${C.cyan};font-weight:600">$1</span>`)
    .replace(/\*\*([^*]+)\*\*/g, `<span style="color:${C.t0};font-weight:700">$1</span>`)
    .replace(/`([^`]+)`/g, `<span style="color:${C.yellow};background:rgba(251,191,36,0.08);padding:0 4px">$1</span>`)
}

export function AnalysisOutput({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="text-[12px] leading-[1.6] text-ink-1 bg-bg-0 border border-line px-4 py-3.5 font-mono">
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
