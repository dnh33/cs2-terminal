import { describe, it, expect } from 'vitest'
// @ts-expect-error — .mjs source imported in vitest, types not required for the helper
import { findHexInJsxSource } from '../check-no-hex-in-jsx.mjs'

describe('check-no-hex-in-jsx', () => {
  it('flags JSX className arbitrary hex value', () => {
    const src = `function X() { return <div className="bg-[#ff7421] text-white">x</div> }`
    const hits = findHexInJsxSource(src, 'test.tsx')
    expect(hits.length).toBe(1)
    expect(hits[0]).toMatchObject({ literal: '#ff7421' })
  })

  it('flags inline style hex literal', () => {
    const src = `function X() { return <div style={{ color: '#fff' }}>x</div> }`
    const hits = findHexInJsxSource(src, 'test.tsx')
    expect(hits.length).toBe(1)
  })

  it('does NOT flag whitelisted line (next-line directive)', () => {
    const src = `// no-hex-disable-next-line — token fallback\nconst c = '#0a0e14'`
    const hits = findHexInJsxSource(src, 'test.tsx')
    expect(hits.length).toBe(0)
  })

  it('does NOT scan .css files (out of scope)', () => {
    const hits = findHexInJsxSource(`.x { color: #ff7421; }`, 'test.css')
    expect(hits.length).toBe(0)
  })
})
