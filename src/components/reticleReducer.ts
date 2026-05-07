import type { Lock } from '../lib/reticleMath'

export type ReticleState = 'IDLE' | 'TRACKING' | 'LOCKED_A' | 'LOCKED_AB'

export interface ReticleStore {
  state: ReticleState
  lockA: Lock | null
  lockB: Lock | null
  /** Crosshair position when in TRACKING; null when cursor leaves canvas. */
  crosshair: Lock | null
}

export const initialState: ReticleStore = {
  state: 'IDLE',
  lockA: null,
  lockB: null,
  crosshair: null,
}

export type ReticleAction =
  | { type: 'TOGGLE' }
  | { type: 'ESC' }
  | { type: 'CLICK'; time: number | null; price: number | null }
  | { type: 'CROSSHAIR_MOVE'; time: number; price: number }
  | { type: 'CROSSHAIR_LEAVE' }
  | { type: 'CASE_CHANGE' }

export function reticleReducer(state: ReticleStore, action: ReticleAction): ReticleStore {
  if (action.type === 'CASE_CHANGE') return initialState

  switch (state.state) {
    case 'IDLE':
      if (action.type === 'TOGGLE') return { ...initialState, state: 'TRACKING' }
      // ESC in IDLE is a no-op — composes with App.tsx cascade
      return state

    case 'TRACKING':
      if (action.type === 'TOGGLE' || action.type === 'ESC') return initialState
      if (action.type === 'CROSSHAIR_MOVE') return { ...state, crosshair: { time: action.time, price: action.price } }
      if (action.type === 'CROSSHAIR_LEAVE') return { ...state, crosshair: null }
      if (action.type === 'CLICK') {
        if (action.time === null || action.price === null) return state
        return { ...state, state: 'LOCKED_A', lockA: { time: action.time, price: action.price } }
      }
      return state

    case 'LOCKED_A':
      if (action.type === 'TOGGLE' || action.type === 'ESC') return initialState
      if (action.type === 'CROSSHAIR_MOVE') return { ...state, crosshair: { time: action.time, price: action.price } }
      if (action.type === 'CROSSHAIR_LEAVE') return { ...state, crosshair: null }
      if (action.type === 'CLICK') {
        if (action.time === null || action.price === null) return state
        // Zero-length-arc guard
        if (state.lockA && action.time === state.lockA.time) return state
        return { ...state, state: 'LOCKED_AB', lockB: { time: action.time, price: action.price } }
      }
      return state

    case 'LOCKED_AB':
      if (action.type === 'TOGGLE' || action.type === 'ESC') return initialState
      if (action.type === 'CROSSHAIR_MOVE') return { ...state, crosshair: { time: action.time, price: action.price } }
      if (action.type === 'CROSSHAIR_LEAVE') return { ...state, crosshair: null }
      if (action.type === 'CLICK') {
        if (action.time === null || action.price === null) return state
        // New click in LOCKED_AB resets to LOCKED_A with the new point as A.
        return { ...state, state: 'LOCKED_A', lockA: { time: action.time, price: action.price }, lockB: null }
      }
      return state

    default:
      return state
  }
}
