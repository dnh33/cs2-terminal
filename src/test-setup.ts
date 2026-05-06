import '@testing-library/jest-dom/vitest'
import { expect } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

expect.extend(toHaveNoViolations)

// jsdom does not implement ResizeObserver — Recharts ResponsiveContainer needs it.
// We synchronously fire the callback with a non-zero size so charts actually render.
class ResizeObserverMock {
  cb: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
  }
  observe(target: Element) {
    this.cb(
      [
        {
          target,
          contentRect: { width: 800, height: 240, top: 0, left: 0, bottom: 240, right: 800, x: 0, y: 0, toJSON: () => ({}) },
          borderBoxSize: [{ inlineSize: 800, blockSize: 240 }],
          contentBoxSize: [{ inlineSize: 800, blockSize: 240 }],
          devicePixelContentBoxSize: [{ inlineSize: 800, blockSize: 240 }],
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    )
  }
  unobserve() {}
  disconnect() {}
}
;(globalThis as any).ResizeObserver = ResizeObserverMock

// jsdom returns 0 for layout boxes; stub a reasonable size so Recharts measures children.
if (typeof Element !== 'undefined') {
  const proto = Element.prototype as unknown as { getBoundingClientRect: () => DOMRect }
  proto.getBoundingClientRect = function () {
    return {
      width: 800,
      height: 240,
      top: 0,
      left: 0,
      right: 800,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  }
}

afterEach(() => {
  cleanup()
})
