import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MentionPopover } from '../MentionPopover'

const cases = [
  { id: 'glove-case', name: 'Glove Case' },
  { id: 'kilowatt-case', name: 'Kilowatt Case' },
  { id: 'gallery-case', name: 'Gallery Case' },
]

describe('MentionPopover', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<MentionPopover open={false} query="" cases={cases} onPick={() => {}} onClose={() => {}} anchor={null} />)
    expect(container.textContent).toBe('')
  })

  it('renders all matching cases when query is empty', () => {
    render(<MentionPopover open query="" cases={cases} onPick={() => {}} onClose={() => {}} anchor={null} />)
    expect(screen.getByText('Glove Case')).toBeInTheDocument()
    expect(screen.getByText('Kilowatt Case')).toBeInTheDocument()
    expect(screen.getByText('Gallery Case')).toBeInTheDocument()
  })

  it('filters by query (fuzzy)', () => {
    render(<MentionPopover open query="kil" cases={cases} onPick={() => {}} onClose={() => {}} anchor={null} />)
    expect(screen.getByText('Kilowatt Case')).toBeInTheDocument()
    expect(screen.queryByText('Glove Case')).not.toBeInTheDocument()
  })

  it('calls onPick on Enter', () => {
    const onPick = vi.fn()
    render(<MentionPopover open query="" cases={cases} onPick={onPick} onClose={() => {}} anchor={null} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(<MentionPopover open query="" cases={cases} onPick={() => {}} onClose={onClose} anchor={null} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
