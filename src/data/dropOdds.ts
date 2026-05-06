/** Steam case rarity drop probabilities. Per-case totals across all skins. */
export const DROP_ODDS_STANDARD = {
  milspec: 0.7992,
  restricted: 0.1598,
  classified: 0.0320,
  covert: 0.0064,
  special: 0.0026,    // knife OR glove tier
} as const

/** Hardcoded Steam Container Key cost in USD. Drift <2%/year — refresh manually. */
export const KEY_COST_USD = 2.49
