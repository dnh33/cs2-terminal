import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchItemMedians } from '../itemMedians'

describe('fetchItemMedians', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns parsed items array', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        case_id: 'glove-case',
        items: [
          { case_id: 'glove-case', item_name: '★ Glove A', kind: 'item_high', fetched_at: 100, lowest: 250, median: 260, volume: 5 },
        ],
      }),
    } as Response)
    const result = await fetchItemMedians('glove-case')
    expect(result.items.length).toBe(1)
    expect(result.items[0].kind).toBe('item_high')
  })

  it('throws on non-OK response', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'oops',
    } as Response)
    await expect(fetchItemMedians('x')).rejects.toThrow(/500/)
  })

  it('encodes caseId into query string', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ case_id: 'a b', items: [] }),
    } as Response)
    await fetchItemMedians('a b')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('caseId=a%20b'),
      expect.any(Object),
    )
  })
})
