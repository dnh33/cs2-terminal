import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { PaletteSwitch } from '../PaletteSwitch'

describe('PaletteSwitch', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-palette')
    localStorage.clear()
  })

  it('renders three radio buttons with std pre-pressed', () => {
    render(<PaletteSwitch />)
    const std = screen.getByRole('radio', { name: /std/i })
    const amber = screen.getByRole('radio', { name: /amber/i })
    const green = screen.getByRole('radio', { name: /green/i })
    expect(std).toHaveAttribute('aria-checked', 'true')
    expect(amber).toHaveAttribute('aria-checked', 'false')
    expect(green).toHaveAttribute('aria-checked', 'false')
  })

  it('switches data-palette on click', async () => {
    const user = userEvent.setup()
    render(<PaletteSwitch />)
    await user.click(screen.getByRole('radio', { name: /amber/i }))
    expect(document.documentElement.dataset.palette).toBe('amber')
    expect(screen.getByRole('radio', { name: /amber/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /std/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('persists choice across mount via localStorage', () => {
    localStorage.setItem('cs-palette', 'green')
    render(<PaletteSwitch />)
    expect(document.documentElement.dataset.palette).toBe('green')
    expect(screen.getByRole('radio', { name: /green/i })).toHaveAttribute('aria-checked', 'true')
  })
})
