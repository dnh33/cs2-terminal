import '@testing-library/jest-dom/vitest'
import { expect } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

expect.extend(toHaveNoViolations)

// jsdom does not implement ResizeObserver — Recharts ResponsiveContainer needs it.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || ResizeObserverMock

afterEach(() => {
  cleanup()
})
