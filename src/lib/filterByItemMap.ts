// src/lib/filterByItemMap.ts

/** Filter entries whose `caseId` references a known item (orphan-guard).
 *  Loading-state fallback: when `items` is empty (still loading from network),
 *  returns ALL entries unchanged — prevents flash-erasing user data on cold start.
 *  Plan 2 introduces; Plan 5 extends to Hypothesis entries. */
export function filterByItemMap<E extends { caseId: string }>(
  entries: E[],
  items: { id: string }[],
): E[] {
  if (items.length === 0) return entries
  const validIds = new Set(items.map((i) => i.id))
  return entries.filter((e) => validIds.has(e.caseId))
}
