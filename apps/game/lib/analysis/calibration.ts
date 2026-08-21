// The one place every analysis sample-size/threshold number lives
// (HM-ANALYSIS-0.1, Spec §14/S8: "keep these values in one explicit
// analysis-calibration location, do not scatter magic sample numbers").

/** Minimum completed matches a window needs before it stops being INSUFFICIENT_DATA. */
export const MIN_SAMPLE = {
  LAST_MATCH: 1,
  LAST_3: 3,
  LAST_5: 1, // "up to 5" (Spec §14) -- any non-zero sample is displayable, just labelled by its actual size
  SEASON: 5,
} as const;

/** Consecutive same-side goals before a run is worth surfacing (Spec §16/S16). */
export const SCORING_RUN_THRESHOLD = 3;

/** Minute boundary between first and second half, matching HM-MATCH-0.1's existing live-stats convention (minute <= 30 is first half). */
export const HALF_TIME_MINUTE = 30;
export const FULL_TIME_MINUTE = 60;
