// PROVISIONAL Career Rhythm pacing constants (HM-GAME-0.3).
//
// These are game-flow scheduling offsets, not real coaching, medical, or
// sports-science truth. They exist to make CONTINUE feel like a believable
// weekly rhythm (Spec S17/S18/S16) without hardcoding events to specific
// weekdays (Spec S9: "Do not hardcode 'Tuesday = scouting report'" -- these
// are day-count offsets from a season/task start date, not weekday checks).

/** Match preparation fires this many days before an unplayed manager fixture. */
export const MATCH_PREPARATION_OFFSET_DAYS = 1;

/** A periodic TRAINING_REPORT fires every N processed days since season start. */
export const TRAINING_REPORT_INTERVAL_DAYS = 7;

/** A periodic STAFF_REPORT fires every N processed days, offset so it does not land on the same day as TRAINING_REPORT. */
export const STAFF_REPORT_INTERVAL_DAYS = 7;
export const STAFF_REPORT_OFFSET_DAYS = 3;

/** Deterministic completion offset for the one scouting task seeded at career start. */
export const SCOUT_TASK_DURATION_DAYS = 10;

/** Deterministic lead time before a fixture for its opponent-analysis task to complete. */
export const OPPONENT_ANALYSIS_LEAD_DAYS = 3;

/** Safety guard against runaway loops in the Continue Controller (mirrors calendar.ts's existing debug guard). */
export const CONTINUE_MAX_DAYS_PER_PRESS = 400;
