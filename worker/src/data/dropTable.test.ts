import { describe, it, expect } from 'vitest'
import { DROP_TABLE, uniqueHighTierItems, uniqueLowTierItems, itemToCases, getDropTable } from './dropTable'

describe('dropTable', () => {
  it('every case sums drop_odds to ~1.0', () => {
    for (const [caseId, c] of Object.entries(DROP_TABLE)) {
      const total = c.drop_odds.milspec + c.drop_odds.restricted + c.drop_odds.classified + c.drop_odds.covert + c.drop_odds.special
      expect(Math.abs(total - 1.0), `${caseId} drop_odds sum`).toBeLessThan(0.001)
    }
  })

  it('uniqueHighTierItems dedupes across cases', () => {
    const list = uniqueHighTierItems()
    expect(new Set(list).size).toBe(list.length)
    expect(list.length).toBeGreaterThan(0)
  })

  it('uniqueLowTierItems dedupes across cases', () => {
    const list = uniqueLowTierItems()
    expect(new Set(list).size).toBe(list.length)
  })

  it('itemToCases maps every item to at least one parent case', () => {
    const map = itemToCases()
    const allItems = [...uniqueHighTierItems(), ...uniqueLowTierItems()]
    for (const item of allItems) {
      const cases = map.get(item)
      expect(cases, `${item} missing parent case`).toBeDefined()
      expect(cases!.length, `${item} parent cases`).toBeGreaterThan(0)
    }
  })

  it('getDropTable returns undefined for unknown case', () => {
    expect(getDropTable('nonexistent-case')).toBeUndefined()
  })

  it('getDropTable returns the entry for a known case', () => {
    const t = getDropTable('glove')
    expect(t).toBeDefined()
    expect(t!.high_tier_items.length).toBeGreaterThan(0)
  })
})
