import { useMemo, useState } from 'react'

const STEAM_FEE = 0.15

export interface RoiInput {
  buy: number
  sell: number
  qty: number
}

export interface RoiOutput {
  netGain: number
  netGainPct: number
  breakEven: number   // sell price required to break even
}

export function computeRoi({ buy, sell, qty }: RoiInput): RoiOutput {
  if (qty === 0 || buy <= 0) return { netGain: 0, netGainPct: 0, breakEven: 0 }
  const grossPerUnit = sell - buy
  const feePerUnit = sell * STEAM_FEE
  const netPerUnit = grossPerUnit - feePerUnit
  const netGain = netPerUnit * qty
  const netGainPct = (netPerUnit / buy) * 100
  const breakEven = buy / (1 - STEAM_FEE)
  return { netGain, netGainPct, breakEven }
}

interface Props {
  buyPrice: number
}

export function RoiCalculator({ buyPrice }: Props) {
  const [target, setTarget] = useState<string>(buyPrice ? (buyPrice * 1.20).toFixed(2) : '0')
  const [qty, setQty] = useState<string>('1')

  const result = useMemo(() => {
    const buy = buyPrice
    const sell = parseFloat(target) || 0
    const q = parseInt(qty, 10) || 0
    return computeRoi({ buy, sell, qty: q })
  }, [buyPrice, target, qty])

  return (
    <div className="px-5 py-4 border-b border-line">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] tracking-[0.2em] text-ink-1 font-semibold m-0">// ROI CALC</h3>
        <span className="text-[9px] text-ink-3 tracking-[0.1em]">break-even @ ${result.breakEven.toFixed(2)} · 15% steam fee</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[9px] text-ink-2 tracking-[0.15em]">BUY</span>
          <div className="text-[12px] text-ink-1 tabular-nums mt-1">${buyPrice.toFixed(2)}</div>
        </label>
        <label className="block">
          <span className="text-[9px] text-ink-2 tracking-[0.15em]">TARGET</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Target sell price"
            className="w-full mt-1 px-2 py-1 bg-bg-2 border border-line text-[12px] text-ink-0 tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-[9px] text-ink-2 tracking-[0.15em]">QTY</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            aria-label="Quantity"
            className="w-full mt-1 px-2 py-1 bg-bg-2 border border-line text-[12px] text-ink-0 tabular-nums"
          />
        </label>
      </div>

      <div className="mt-3 text-[12px] tabular-nums">
        <span className="text-ink-2 tracking-[0.1em] mr-2">NET</span>
        <span style={{ color: result.netGain >= 0 ? 'var(--delta-up)' : 'var(--state-err)' }}>
          ${result.netGain.toFixed(2)} ({result.netGainPct >= 0 ? '+' : ''}{result.netGainPct.toFixed(1)}%)
        </span>
      </div>
    </div>
  )
}
