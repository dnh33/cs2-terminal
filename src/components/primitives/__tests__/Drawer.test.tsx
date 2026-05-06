import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Drawer } from '../Drawer'

describe('Drawer', () => {
  it('renders children when open', () => {
    render(<Drawer open onClose={() => {}}><div>panel content</div></Drawer>)
    expect(screen.getByText('panel content')).toBeInTheDocument()
  })

  it('does not render children when closed', () => {
    render(<Drawer open={false} onClose={() => {}}><div>panel content</div></Drawer>)
    expect(screen.queryByText('panel content')).not.toBeInTheDocument()
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(<Drawer open onClose={onClose}><div>x</div></Drawer>)
    const backdrop = screen.getByTestId('drawer-backdrop')
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(<Drawer open onClose={onClose}><div>x</div></Drawer>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not fire Escape handler when closed', () => {
    const onClose = vi.fn()
    render(<Drawer open={false} onClose={onClose}><div>x</div></Drawer>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('panel has role=dialog and aria-label', () => {
    render(<Drawer open onClose={() => {}} ariaLabel="Case detail"><div>x</div></Drawer>)
    expect(screen.getByRole('dialog', { name: 'Case detail' })).toBeInTheDocument()
  })
})
