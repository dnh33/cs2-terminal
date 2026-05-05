import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AnalysisOutput } from '../AnalysisOutput'

describe('AnalysisOutput wrapper typography', () => {
  it('uses font-prose + t-body (not font-mono) for long-form prose', () => {
    const { container } = render(<AnalysisOutput text={'some thesis line\n- a bullet'} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('font-prose')
    expect(wrapper.className).toContain('t-body')
    expect(wrapper.className).not.toContain('font-mono')
    // Hard-coded text-[12px] / leading-[1.6] are replaced by t-body.
    expect(wrapper.className).not.toContain('text-[12px]')
    expect(wrapper.className).not.toContain('leading-[1.6]')
  })
})
