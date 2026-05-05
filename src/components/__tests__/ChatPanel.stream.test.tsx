import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the api module before importing ChatPanel.
vi.mock('../../lib/api', () => {
  return {
    callClaude: vi.fn(),
    callClaudeStream: vi.fn(),
    ANALYST_SYSTEM: 'sys',
  }
})

import { ChatPanel } from '../Panels'
import { callClaudeStream } from '../../lib/api'

describe('ChatPanel streaming send', () => {
  beforeEach(() => {
    vi.mocked(callClaudeStream).mockReset()
  })

  it('renders partial assistant deltas as they arrive then finalizes', async () => {
    let resolveStream: (() => void) | null = null
    let onChunkCb: ((d: string) => void) | null = null
    vi.mocked(callClaudeStream).mockImplementation(async (_req, onChunk) => {
      onChunkCb = onChunk
      return new Promise<string>(resolve => {
        resolveStream = () => resolve('Hello world')
      })
    })

    render(<ChatPanel marketContext="ctx" />)
    const input = screen.getByPlaceholderText(/ask the analyst/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hi' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(callClaudeStream).toHaveBeenCalled())

    // Stream first delta — assistant message should mutate to show partial text.
    await act(async () => {
      onChunkCb!('Hello ')
    })
    expect(screen.getByText(/Hello/)).toBeInTheDocument()

    await act(async () => {
      onChunkCb!('world')
    })
    expect(screen.getByText(/Hello world/)).toBeInTheDocument()

    // Resolve the stream — finalize.
    await act(async () => {
      resolveStream!()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByText(/Hello world/)).toBeInTheDocument()
    })
  })

  it('shows error in last assistant slot when stream throws', async () => {
    vi.mocked(callClaudeStream).mockImplementation(async () => {
      throw new Error('stream boom')
    })

    render(<ChatPanel marketContext="ctx" />)
    const input = screen.getByPlaceholderText(/ask the analyst/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hi' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText(/SYSTEM ERROR/)).toBeInTheDocument()
      expect(screen.getByText(/stream boom/)).toBeInTheDocument()
    })
  })
})
