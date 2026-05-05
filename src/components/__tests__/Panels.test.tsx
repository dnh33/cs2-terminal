import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarketScanPanel } from '../Panels'

describe('MarketScanPanel error UI', () => {
  it('renders Banner with role=alert when error is set', () => {
    render(
      <MarketScanPanel
        items={[]}
        onScan={() => {}}
        scan={null}
        scanning={false}
        error="boom"
      />
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/boom/)
  })
})
