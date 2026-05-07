import { render } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { AnalysisOutput } from '../AnalysisOutput'

describe('AnalysisOutput wrapper typography', () => {
  it('uses font-prose + t-body (not font-mono) for long-form prose', () => {
    const { container } = render(<AnalysisOutput text={'some thesis line\n- a bullet'} />)
    // First child is now an outer wrapper (when caseId/snapshot omitted, the prose div is firstElementChild).
    const proseEl = container.querySelector('.font-prose') as HTMLElement
    expect(proseEl).not.toBeNull()
    expect(proseEl.className).toContain('font-prose')
    expect(proseEl.className).toContain('t-body')
    expect(proseEl.className).not.toContain('font-mono')
    expect(proseEl.className).not.toContain('text-[12px]')
    expect(proseEl.className).not.toContain('leading-[1.6]')
  })
})

describe('AnalysisOutput devil flip pill', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders flip pill when both caches exist', () => {
    // Plan 4: both keys now share the v2 shape.
    localStorage.setItem('cs-analysis:v2:glove:100', 'normal text')
    localStorage.setItem('cs-analysis-devil:v2:glove:100', 'devil text')
    const { getByRole } = render(<AnalysisOutput text="normal text" caseId="glove" snapshotAt={100} />)
    expect(getByRole('tablist')).toBeTruthy()
  })

  it('reads v1 cache via one-shot migration to v2', () => {
    // Seed legacy key only — no v2 key exists.
    localStorage.setItem('cs-analysis:glove:100', 'legacy text')
    // Devil cache also seeded so flip-pill activates and 'legacy text' actually renders
    // (component shows fallback `text` prop when only one cache exists).
    localStorage.setItem('cs-analysis-devil:v2:glove:100', 'devil text')

    render(<AnalysisOutput text="placeholder" caseId="glove" snapshotAt={100} />)

    // After render, migration must have copied legacy → v2 and deleted legacy.
    expect(localStorage.getItem('cs-analysis:v2:glove:100')).toBe('legacy text')
    expect(localStorage.getItem('cs-analysis:glove:100')).toBeNull()
    // Devil cache untouched.
    expect(localStorage.getItem('cs-analysis-devil:v2:glove:100')).toBe('devil text')
  })

  it('hides pill when only one cache exists', () => {
    localStorage.setItem('cs-analysis:v2:glove:100', 'normal text')
    const { queryByRole } = render(<AnalysisOutput text="normal text" caseId="glove" snapshotAt={100} />)
    expect(queryByRole('tablist')).toBeNull()
  })

  it('hides pill when caseId or snapshotAt missing', () => {
    localStorage.setItem('cs-analysis:v2:glove:100', 'normal text')
    localStorage.setItem('cs-analysis-devil:v2:glove:100', 'devil text')
    const { queryByRole } = render(<AnalysisOutput text="normal text" />)
    expect(queryByRole('tablist')).toBeNull()
  })
})
