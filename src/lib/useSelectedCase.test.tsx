import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { useSelectedCase } from './useSelectedCase'

function Probe({ onValue }: { onValue: (v: string | null, set: (id: string | null) => void) => void }) {
  const [id, setId] = useSelectedCase()
  onValue(id, setId)
  return null
}

describe('useSelectedCase', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('returns null when URL has no ?case=', () => {
    let captured: string | null = 'nope'
    render(<Probe onValue={(v) => { captured = v }} />)
    expect(captured).toBeNull()
  })

  it('reads ?case=glove-case from URL on mount', () => {
    window.history.replaceState({}, '', '/?case=glove-case')
    let captured: string | null = null
    render(<Probe onValue={(v) => { captured = v }} />)
    expect(captured).toBe('glove-case')
  })

  it('setSelectedCase updates URL via pushState', () => {
    let setter: (id: string | null) => void = () => {}
    render(<Probe onValue={(_, set) => { setter = set }} />)
    act(() => { setter('chroma-2-case') })
    expect(window.location.search).toBe('?case=chroma-2-case')
  })

  it('setSelectedCase(null) clears the query param', () => {
    window.history.replaceState({}, '', '/?case=glove-case')
    let setter: (id: string | null) => void = () => {}
    render(<Probe onValue={(_, set) => { setter = set }} />)
    act(() => { setter(null) })
    expect(window.location.search).toBe('')
  })

  it('listens for popstate and updates state', () => {
    let captured: string | null = null
    render(<Probe onValue={(v) => { captured = v }} />)
    act(() => {
      window.history.pushState({}, '', '/?case=fracture-case')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(captured).toBe('fracture-case')
  })
})
