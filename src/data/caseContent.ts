/**
 * Hand-curated content quality table for FIT framework v1.
 * One entry per CS2 case. Static — refreshed only when case definitions change.
 *
 * knife_tier: 0=none, 1=common, 2=mid (Karambit/M9/Bayonet), 3=exotic_new (Kukri/Skeleton/Stiletto/Talon)
 * multi_knife: 1 if case has 3+ distinct knife/glove model variants
 * notable_pattern: 1 if case carries a famous rare-pattern variant (Wild Lotus, Case Hardened blue gem family)
 *
 * Case IDs mirror src/lib/cases.ts (underscored).
 */

export interface ContentEntry {
  knife: 0 | 1
  glove: 0 | 1
  knife_tier: 0 | 1 | 2 | 3
  multi_knife: 0 | 1
  notable_pattern: 0 | 1
}

export const CASE_CONTENT: Record<string, ContentEntry> = {
  // ACTIVE
  fracture:                { knife: 1, glove: 0, knife_tier: 1, multi_knife: 0, notable_pattern: 0 },
  dreams_nightmares:       { knife: 1, glove: 0, knife_tier: 1, multi_knife: 0, notable_pattern: 0 },
  recoil:                  { knife: 0, glove: 0, knife_tier: 0, multi_knife: 0, notable_pattern: 0 }, // matches plan: scores 0
  revolution:              { knife: 1, glove: 0, knife_tier: 1, multi_knife: 0, notable_pattern: 0 },
  kilowatt:                { knife: 1, glove: 0, knife_tier: 3, multi_knife: 0, notable_pattern: 0 },
  gallery:                 { knife: 1, glove: 0, knife_tier: 2, multi_knife: 0, notable_pattern: 0 },
  fever:                   { knife: 1, glove: 0, knife_tier: 2, multi_knife: 0, notable_pattern: 0 },

  // RARE
  snakebite:               { knife: 0, glove: 1, knife_tier: 0, multi_knife: 1, notable_pattern: 0 },
  clutch:                  { knife: 0, glove: 1, knife_tier: 0, multi_knife: 1, notable_pattern: 0 },

  // DISCONTINUED
  csgo_weapon:             { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 1 },
  csgo_weapon_2:           { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 1 },
  csgo_weapon_3:           { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  esports_2013:            { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  winter_offensive:        { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  operation_bravo:         { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 1 },
  operation_phoenix:       { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  huntsman:                { knife: 1, glove: 0, knife_tier: 1, multi_knife: 0, notable_pattern: 0 },
  operation_breakout:      { knife: 1, glove: 0, knife_tier: 1, multi_knife: 0, notable_pattern: 0 },
  esports_2014_summer:     { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  operation_vanguard:      { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  chroma:                  { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 1 },
  chroma_2:                { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  chroma_3:                { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  falchion:                { knife: 1, glove: 0, knife_tier: 1, multi_knife: 0, notable_pattern: 0 },
  shadow:                  { knife: 1, glove: 0, knife_tier: 1, multi_knife: 0, notable_pattern: 0 },
  revolver:                { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  operation_wildfire:      { knife: 1, glove: 0, knife_tier: 1, multi_knife: 0, notable_pattern: 0 },
  gamma:                   { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  gamma_2:                 { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  glove:                   { knife: 0, glove: 1, knife_tier: 0, multi_knife: 1, notable_pattern: 1 },
  spectrum:                { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  operation_hydra:         { knife: 0, glove: 1, knife_tier: 0, multi_knife: 1, notable_pattern: 0 },
  spectrum_2:              { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  cs20:                    { knife: 1, glove: 0, knife_tier: 1, multi_knife: 0, notable_pattern: 0 },
  danger_zone:             { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  horizon:                 { knife: 1, glove: 0, knife_tier: 3, multi_knife: 1, notable_pattern: 0 },
  prisma:                  { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  prisma_2:                { knife: 1, glove: 0, knife_tier: 2, multi_knife: 1, notable_pattern: 0 },
  shattered_web:           { knife: 1, glove: 0, knife_tier: 3, multi_knife: 1, notable_pattern: 0 },
  operation_riptide:       { knife: 1, glove: 0, knife_tier: 3, multi_knife: 1, notable_pattern: 0 },
  operation_broken_fang:   { knife: 0, glove: 1, knife_tier: 0, multi_knife: 1, notable_pattern: 0 },
}

export function contentQuality(c: ContentEntry): number {
  let s = 0
  if (c.knife) s += 50
  if (c.glove) s += 25
  s += c.knife_tier * 5      // 0/5/10/15
  if (c.multi_knife) s += 10
  if (c.notable_pattern) s += 10
  if (!c.knife && !c.glove) s -= 20
  return Math.max(0, Math.min(100, s))
}

/** Returns 0 when the case is not in the content table (graceful fallback for new cases). */
export function getContentQuality(caseId: string): number {
  const entry = CASE_CONTENT[caseId]
  return entry ? contentQuality(entry) : 0
}
