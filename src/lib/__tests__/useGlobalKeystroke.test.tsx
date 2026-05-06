import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useGlobalKeystroke } from '../useGlobalKeystroke'

function Probe({ onCmdK, onSlash, onEsc }: {
  onCmdK?: () => void; onSlash?: () => void; onEsc?: () => void
}) {
  useGlobalKeystroke({
    onCmdK, onSlash, onEsc,
  })
  return <input data-testid="probe-input" />
}

describe('useGlobalKeystroke', () => {
  it('fires onCmdK on ⌘K (metaKey)', () => {
    const onCmdK = vi.fn()
    render(<Probe onCmdK={onCmdK} />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(onCmdK).toHaveBeenCalledTimes(1)
  })

  it('fires onCmdK on Ctrl+K', () => {
    const onCmdK = vi.fn()
    render(<Probe onCmdK={onCmdK} />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(onCmdK).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire onCmdK on plain k', () => {
    const onCmdK = vi.fn()
    render(<Probe onCmdK={onCmdK} />)
    fireEvent.keyDown(window, { key: 'k' })
    expect(onCmdK).not.toHaveBeenCalled()
  })

  it('fires onSlash on `/` when no input is focused', () => {
    const onSlash = vi.fn()
    render(<Probe onSlash={onSlash} />)
    fireEvent.keyDown(window, { key: '/' })
    expect(onSlash).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire onSlash when input is focused', () => {
    const onSlash = vi.fn()
    const { getByTestId } = render(<Probe onSlash={onSlash} />)
    const input = getByTestId('probe-input') as HTMLInputElement
    input.focus()
    fireEvent.keyDown(input, { key: '/' })
    expect(onSlash).not.toHaveBeenCalled()
  })

  it('fires onEsc on Escape', () => {
    const onEsc = vi.fn()
    render(<Probe onEsc={onEsc} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onEsc).toHaveBeenCalledTimes(1)
  })

  it('does NOT trap browser-default ⌘W (preventDefault is false)', () => {
    const onCmdK = vi.fn()
    render(<Probe onCmdK={onCmdK} />)
    const event = new KeyboardEvent('keydown', { key: 'w', metaKey: true, cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(onCmdK).not.toHaveBeenCalled()
  })
})
