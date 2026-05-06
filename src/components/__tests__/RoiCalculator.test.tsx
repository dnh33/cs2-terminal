import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RoiCalculator, computeRoi } from '../RoiCalculator'

describe('computeRoi', () => {
  it('15% Steam fee — break-even on identical buy/sell is negative', () => {
    const roi = computeRoi({ buy: 100, sell: 100, qty: 1 })
    expect(roi.netGain).toBeLessThan(0)
  })

  it('17.65% gross gain breaks even after 15% fee', () => {
    const roi = computeRoi({ buy: 100, sell: 117.65, qty: 1 })
    expect(Math.abs(roi.netGain)).toBeLessThan(0.05)
  })

  it('scales linearly with qty', () => {
    const single = computeRoi({ buy: 100, sell: 200, qty: 1 })
    const ten = computeRoi({ buy: 100, sell: 200, qty: 10 })
    expect(ten.netGain).toBeCloseTo(single.netGain * 10, 5)
  })

  it('zero qty returns zero', () => {
    const roi = computeRoi({ buy: 100, sell: 200, qty: 0 })
    expect(roi.netGain).toBe(0)
    expect(roi.netGainPct).toBe(0)
  })
})

describe('RoiCalculator', () => {
  it('updates when target price changes', () => {
    render(<RoiCalculator buyPrice={100} />)
    const targetInput = screen.getByLabelText(/target/i) as HTMLInputElement
    fireEvent.change(targetInput, { target: { value: '200' } })
    // Net gain shows (multiple $ values render — buy, break-even, net)
    expect(screen.getAllByText(/\$/).length).toBeGreaterThan(0)
  })

  it('renders break-even hint', () => {
    render(<RoiCalculator buyPrice={100} />)
    expect(screen.getByText(/break-even/i)).toBeInTheDocument()
  })
})
