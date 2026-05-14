import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'

const guardedFiles = [
  'src/components/MarketStats.tsx',
  'src/components/DetailPanel.tsx',
]

describe('typography accessibility floor (.impeccable.md: "Never below 10")', () => {
  for (const f of guardedFiles) {
    it(`${f} contains no text-[9px] (or below)`, async () => {
      const src = await readFile(f, 'utf-8')
      expect(src).not.toMatch(/text-\[[0-9]px\]/)
    })
  }
})
