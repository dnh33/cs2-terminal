import { describe, it, expect } from 'vitest'

describe('test framework', () => {
  it('wires up arithmetic correctly', () => {
    expect(1 + 1).toBe(2)
  })
  it('exposes jest-dom matchers', () => {
    const div = document.createElement('div')
    div.textContent = 'hello'
    document.body.appendChild(div)
    expect(div).toBeInTheDocument()
    expect(div).toHaveTextContent('hello')
    document.body.removeChild(div)
  })
})
