/**
 * INITIAL calibration values for HERO LiveRegion announcements.
 * Pending Plan D NVDA/VoiceOver tuning. Tests assert mechanism,
 * not these specific numbers.
 */
export const announceConfig = {
  debounceMs: 5_000,
  thresholdRelative: 0.01, // 1%
  thresholdAbsolute: 1_000, // $1,000
} as const
