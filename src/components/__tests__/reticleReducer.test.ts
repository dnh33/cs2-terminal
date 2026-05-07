import { describe, it, expect } from 'vitest'
import { reticleReducer, initialState } from '../reticleReducer'

describe('reticleReducer', () => {
  it('IDLE → TRACKING on TOGGLE', () => {
    const s = reticleReducer(initialState, { type: 'TOGGLE' })
    expect(s.state).toBe('TRACKING')
  })

  it('TRACKING → IDLE on TOGGLE', () => {
    const s1 = reticleReducer(initialState, { type: 'TOGGLE' })
    const s2 = reticleReducer(s1, { type: 'TOGGLE' })
    expect(s2.state).toBe('IDLE')
  })

  it('TRACKING → IDLE on ESC', () => {
    const s1 = reticleReducer(initialState, { type: 'TOGGLE' })
    const s2 = reticleReducer(s1, { type: 'ESC' })
    expect(s2.state).toBe('IDLE')
  })

  it('TRACKING → LOCKED_A on CLICK with valid time + price', () => {
    const s1 = reticleReducer(initialState, { type: 'TOGGLE' })
    const s2 = reticleReducer(s1, { type: 'CLICK', time: 100, price: 50 })
    expect(s2.state).toBe('LOCKED_A')
    expect(s2.lockA).toEqual({ time: 100, price: 50 })
  })

  it('TRACKING → TRACKING on CLICK with null time (no-op)', () => {
    const s1 = reticleReducer(initialState, { type: 'TOGGLE' })
    const s2 = reticleReducer(s1, { type: 'CLICK', time: null, price: 50 })
    expect(s2.state).toBe('TRACKING')
    expect(s2.lockA).toBeNull()
  })

  it('TRACKING → TRACKING on CLICK with null price (no-op)', () => {
    const s1 = reticleReducer(initialState, { type: 'TOGGLE' })
    const s2 = reticleReducer(s1, { type: 'CLICK', time: 100, price: null })
    expect(s2.state).toBe('TRACKING')
  })

  it('LOCKED_A → LOCKED_A on CLICK with same time as lockA (zero-length arc guard)', () => {
    let s = reticleReducer(initialState, { type: 'TOGGLE' })
    s = reticleReducer(s, { type: 'CLICK', time: 100, price: 50 })
    expect(s.state).toBe('LOCKED_A')
    s = reticleReducer(s, { type: 'CLICK', time: 100, price: 60 })
    expect(s.state).toBe('LOCKED_A')
    expect(s.lockB).toBeNull()
  })

  it('LOCKED_A → LOCKED_AB on valid second CLICK', () => {
    let s = reticleReducer(initialState, { type: 'TOGGLE' })
    s = reticleReducer(s, { type: 'CLICK', time: 100, price: 50 })
    s = reticleReducer(s, { type: 'CLICK', time: 200, price: 60 })
    expect(s.state).toBe('LOCKED_AB')
    expect(s.lockA).toEqual({ time: 100, price: 50 })
    expect(s.lockB).toEqual({ time: 200, price: 60 })
  })

  it('LOCKED_AB → LOCKED_A on CLICK (clears B, awaits new B)', () => {
    let s = reticleReducer(initialState, { type: 'TOGGLE' })
    s = reticleReducer(s, { type: 'CLICK', time: 100, price: 50 })
    s = reticleReducer(s, { type: 'CLICK', time: 200, price: 60 })
    s = reticleReducer(s, { type: 'CLICK', time: 300, price: 70 })
    expect(s.state).toBe('LOCKED_A')
    expect(s.lockA).toEqual({ time: 300, price: 70 })
  })

  it('any state → IDLE on CASE_CHANGE', () => {
    let s = reticleReducer(initialState, { type: 'TOGGLE' })
    s = reticleReducer(s, { type: 'CLICK', time: 100, price: 50 })
    s = reticleReducer(s, { type: 'CASE_CHANGE' })
    expect(s.state).toBe('IDLE')
    expect(s.lockA).toBeNull()
    expect(s.lockB).toBeNull()
  })

  it('IDLE → IDLE on ESC (no-op; falls through to App.tsx cascade)', () => {
    const s = reticleReducer(initialState, { type: 'ESC' })
    expect(s.state).toBe('IDLE')
  })

  it('TRACKING ignores CROSSHAIR_LEAVE for state but clears readout cache', () => {
    let s = reticleReducer(initialState, { type: 'TOGGLE' })
    s = reticleReducer(s, { type: 'CROSSHAIR_MOVE', time: 100, price: 50 })
    expect(s.crosshair).toEqual({ time: 100, price: 50 })
    s = reticleReducer(s, { type: 'CROSSHAIR_LEAVE' })
    expect(s.state).toBe('TRACKING')
    expect(s.crosshair).toBeNull()
  })
})
