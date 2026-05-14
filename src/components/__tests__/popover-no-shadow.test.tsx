import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('popover-no-shadow (F38)', () => {
  it('CmdK.tsx source does not contain shadow-xl', () => {
    const filePath = path.join(__dirname, '..', 'CmdK.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).not.toContain('shadow-xl')
  })

  it('MentionPopover.tsx source does not contain shadow-xl', () => {
    const filePath = path.join(__dirname, '..', 'MentionPopover.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).not.toContain('shadow-xl')
  })
})
