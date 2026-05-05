import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginScreen } from '../LoginScreen'
import * as api from '../../lib/api'

describe('LoginScreen a11y', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('input has required attribute', () => {
    render(<LoginScreen onSuccess={() => {}} />)
    const input = screen.getByLabelText(/password/i) as HTMLInputElement
    expect(input).toBeRequired()
  })

  it('submit button has data-variant="primary"', () => {
    render(<LoginScreen onSuccess={() => {}} />)
    const button = screen.getByRole('button', { name: /authenticate/i })
    expect(button.getAttribute('data-variant')).toBe('primary')
  })

  it('error message has role="alert" and is linked via aria-describedby on failure', async () => {
    vi.spyOn(api, 'login').mockRejectedValueOnce(new Error('bad password'))
    render(<LoginScreen onSuccess={() => {}} />)
    const input = screen.getByLabelText(/password/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'wrong' } })
    const button = screen.getByRole('button', { name: /authenticate/i })
    fireEvent.click(button)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/bad password/i)
    expect(alert.id).toBeTruthy()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(alert.id)
  })

  it('shows Caps Lock hint and links via aria-describedby when CapsLock is on', async () => {
    render(<LoginScreen onSuccess={() => {}} />)
    const input = screen.getByLabelText(/password/i) as HTMLInputElement
    // Patch the prototype getModifierState so React's SyntheticEvent proxy returns true for CapsLock.
    const orig = KeyboardEvent.prototype.getModifierState
    KeyboardEvent.prototype.getModifierState = function (key: string) {
      return key === 'CapsLock'
    }
    try {
      fireEvent.keyDown(input, { key: 'A' })
      const hint = await screen.findByText(/caps lock/i)
      expect(hint.id).toBeTruthy()
      expect(input.getAttribute('aria-describedby')).toBe(hint.id)
    } finally {
      KeyboardEvent.prototype.getModifierState = orig
    }
  })

  it('does not mark aria-invalid when there is no error', () => {
    render(<LoginScreen onSuccess={() => {}} />)
    const input = screen.getByLabelText(/password/i) as HTMLInputElement
    expect(input.getAttribute('aria-invalid')).toBe('false')
  })
})
