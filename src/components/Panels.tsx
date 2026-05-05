import { useEffect, useRef, useState } from 'react'
import { callClaude, ANALYST_SYSTEM } from '../lib/api'
import { AnalysisOutput } from './AnalysisOutput'
import { StatusDot } from './Atoms'
import { C } from '../lib/theme'
import type { ItemFull } from './CaseTable'

interface ScanProps {
  items: ItemFull[]
  onScan: () => void
  scan: string | null
  scanning: boolean
  error: string | null
}

export function MarketScanPanel({ items, onScan, scan, scanning, error }: ScanProps) {
  const enabled = items.filter(i => i.price).length >= 5
  return (
    <div className="bg-bg-1 border border-line px-5 py-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-display text-[22px] tracking-[0.05em] text-ink-0 leading-none m-0">MARKET SCAN</h2>
          <p className="text-[10px] tracking-[0.15em] text-ink-2 mt-1 m-0">
            // LLM-NATIVE TOP-DOWN ANALYSIS OF TRACKED UNIVERSE
          </p>
        </div>
        <button
          onClick={onScan}
          disabled={scanning || !enabled}
          className={`text-[11px] tracking-[0.15em] px-5 py-2.5 font-bold border ${
            scanning
              ? 'bg-bg-3 text-ink-2 border-line-bright cursor-wait'
              : 'bg-transparent text-accent-data border-accent-data hover:bg-accent-data/5'
          }`}
        >
          {scanning ? '◌ SCANNING...' : '▸ RUN FULL SCAN'}
        </button>
      </div>
      {error && (
        <div className="text-[11px] text-state-err p-2.5 border border-state-err bg-state-err/5 mb-3">
          ERR: {error}
        </div>
      )}
      {scan ? (
        <AnalysisOutput text={scan} />
      ) : !scanning ? (
        <div className="text-[11px] text-ink-3 p-6 border border-dashed border-line-bright text-center tracking-[0.1em]">
          Reads every tracked case and produces ranked picks: best value plays, momentum candidates, traps to avoid, capital allocation.
        </div>
      ) : null}
    </div>
  )
}

interface ChatProps {
  marketContext: string
}

export function ChatPanel({ marketContext }: ChatProps) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, busy])

  async function send() {
    const txt = input.trim()
    if (!txt || busy) return
    const newMsgs = [...messages, { role: 'user' as const, content: txt }]
    setMessages(newMsgs)
    setInput('')
    setBusy(true)
    try {
      const reply = await callClaude({
        messages: newMsgs,
        system: ANALYST_SYSTEM + '\n\n=== CURRENT MARKET DATASET ===\n' + marketContext,
        // Same big system prompt across all turns — cache it once.
        cache_system_prompt: true,
      })
      setMessages([...newMsgs, { role: 'assistant', content: reply }])
    } catch (e: any) {
      setMessages([...newMsgs, { role: 'assistant', content: `// SYSTEM ERROR\n- ${e.message}` }])
    } finally {
      setBusy(false)
    }
  }

  const suggestions = [
    'Which discontinued case has the worst liquidity right now?',
    'Compare Glove Case vs Operation Broken Fang for a 2yr hold',
    'What looks underpriced relative to age and pool status?',
    'Rank top 5 active cases by short-term flip potential',
  ]

  return (
    <div className="bg-bg-1 border border-line flex flex-col h-[580px]">
      <div className="px-5 py-3.5 border-b border-line bg-bg-2 flex justify-between items-center">
        <div>
          <h2 className="font-display text-[18px] tracking-[0.05em] text-ink-0 leading-none m-0">ANALYST CHAT</h2>
          <p className="text-[9px] tracking-[0.2em] text-ink-2 mt-1 m-0">// QUERY DATASET IN NATURAL LANGUAGE</p>
        </div>
        <StatusDot color={busy ? C.orange : C.green} pulse={busy} />
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div>
            <h3 className="text-[10px] tracking-[0.2em] text-ink-2 mb-3 m-0 font-normal">// SUGGESTED QUERIES</h3>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s)}
                  className="text-left px-3 py-2.5 text-[11px] border border-line text-ink-1 bg-bg-2 hover:border-accent-data hover:text-accent-data transition-colors"
                >
                  › {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="mb-3.5 animate-fade-up">
            <div
              className={`text-[9px] tracking-[0.2em] font-bold mb-1 ${
                m.role === 'user' ? 'text-accent-data' : 'text-accent-sel'
              }`}
            >
              {m.role === 'user' ? '▸ YOU' : '◂ ANALYST'}
            </div>
            {m.role === 'user' ? (
              <div className="text-[12px] text-ink-0 px-3 py-2 bg-bg-2 border-l-2 border-accent-data">{m.content}</div>
            ) : (
              <AnalysisOutput text={m.content} />
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-ink-2 text-[11px]">
            <span className="text-accent-sel animate-blink">◌</span>
            <span className="tracking-[0.15em]">PROCESSING...</span>
          </div>
        )}
      </div>
      <div className="border-t border-line px-3.5 py-2.5 flex gap-2 items-center bg-bg-2">
        <span className="text-accent-sel text-[14px]">›</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') send()
          }}
          placeholder="ask the analyst..."
          disabled={busy}
          className="flex-1 text-[12px] text-ink-0 px-1 py-1.5 bg-transparent"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className={`text-[10px] tracking-[0.15em] px-3 py-1.5 font-bold ${
            busy || !input.trim() ? 'bg-bg-3 text-ink-3 cursor-not-allowed' : 'bg-accent-sel text-bg-0'
          }`}
        >
          SEND
        </button>
      </div>
    </div>
  )
}
