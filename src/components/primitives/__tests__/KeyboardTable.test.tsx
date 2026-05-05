import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { KbdRow, KbdSortHeader } from '../KeyboardTable'

describe('KbdRow', () => {
  it('is focusable and activates on Enter and Space', async () => {
    const onActivate = vi.fn()
    const user = userEvent.setup()
    render(
      <div role="grid">
        <KbdRow onActivate={onActivate} selected={false} aria-label="Glove Case row">
          <span>Glove Case</span>
        </KbdRow>
      </div>
    )
    const row = screen.getByRole('row')
    expect(row).toHaveAttribute('tabIndex', '0')
    row.focus()
    expect(row).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onActivate).toHaveBeenCalledTimes(1)
    await user.keyboard(' ')
    expect(onActivate).toHaveBeenCalledTimes(2)
  })

  it('sets aria-selected when selected', () => {
    render(
      <div role="grid">
        <KbdRow onActivate={() => {}} selected={true}>x</KbdRow>
      </div>
    )
    expect(screen.getByRole('row')).toHaveAttribute('aria-selected', 'true')
  })
})

describe('KbdSortHeader', () => {
  it('renders a button with aria-sort', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<KbdSortHeader onClick={onClick} sort="asc">CASE</KbdSortHeader>)
    const btn = screen.getByRole('button', { name: /case/i })
    expect(btn).toHaveAttribute('aria-sort', 'ascending')
    await user.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('reports aria-sort=none when sort is null', () => {
    render(<KbdSortHeader onClick={() => {}} sort={null}>CASE</KbdSortHeader>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-sort', 'none')
  })
})
