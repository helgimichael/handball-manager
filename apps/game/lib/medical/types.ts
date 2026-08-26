// HM-INJURIES-1.0: the injury/medical domain's own vocabulary. Compact by
// design (Part 6: "do not create 50 diagnoses") -- one flat injury-type
// list, each type structurally tagged with its own body area and
// mechanism (CONTACT vs OVERUSE, Part 7) rather than a branching
// diagnosis tree. Deliberately separate from lib/career/playerStatus.ts's
// `PlayerAvailability` (the EXTERNAL, coarse selectability signal every
// other system already reads) -- this module is the INTERNAL detail
// (what/where/how bad/how healed) that DRIVES those external status
// transitions, never a second competing availability concept.

export const INJURY_SOURCES = ["MATCH", "TRAINING"] as const;
export type InjurySource = (typeof INJURY_SOURCES)[number];

/** Part 7: the two structurally separate risk channels -- never one identical formula for both. */
export const INJURY_MECHANISMS = ["CONTACT", "OVERUSE"] as const;
export type InjuryMechanism = (typeof INJURY_MECHANISMS)[number];

export const BODY_AREAS = ["ANKLE", "KNEE", "HAMSTRING", "CALF", "SHOULDER", "BACK", "HAND_FINGER", "HEAD", "GENERAL"] as const;
export type BodyArea = (typeof BODY_AREAS)[number];

/** Part 6: compact, handball-plausible vocabulary -- 11 types, not 50. */
export const INJURY_TYPES = [
  "ANKLE_SPRAIN",
  "KNEE_SPRAIN",
  "HAMSTRING_STRAIN",
  "CALF_STRAIN",
  "SHOULDER_OVERUSE",
  "SHOULDER_TRAUMA",
  "BACK_PAIN",
  "HAND_FINGER_INJURY",
  "HEAD_CONCUSSION",
  "GENERAL_OVERUSE",
  "ACL_TEAR",
] as const;
export type InjuryType = (typeof INJURY_TYPES)[number];

export const INJURY_SEVERITIES = ["MINOR", "MODERATE", "MAJOR", "SEVERE"] as const;
export type InjurySeverity = (typeof INJURY_SEVERITIES)[number];

/** Part 19/24/25: the required intermediate return states -- INJURED never jumps straight to fully AVAILABLE. */
export const REHAB_PHASES = ["ACUTE", "REHAB", "RETURN_TO_TRAINING", "RETURN_TO_PLAY"] as const;
export type RehabPhase = (typeof REHAB_PHASES)[number];

export interface InjuryTypeProfile {
  bodyArea: BodyArea;
  mechanism: InjuryMechanism;
  /** ACL_TEAR is a rarer, SEVERE-only variant of a knee injury (Part 6) -- never selectable for a lesser severity roll. */
  severeOnly?: boolean;
}

export const INJURY_TYPE_PROFILES: Record<InjuryType, InjuryTypeProfile> = {
  ANKLE_SPRAIN: { bodyArea: "ANKLE", mechanism: "CONTACT" },
  KNEE_SPRAIN: { bodyArea: "KNEE", mechanism: "CONTACT" },
  HAMSTRING_STRAIN: { bodyArea: "HAMSTRING", mechanism: "OVERUSE" },
  CALF_STRAIN: { bodyArea: "CALF", mechanism: "OVERUSE" },
  SHOULDER_OVERUSE: { bodyArea: "SHOULDER", mechanism: "OVERUSE" },
  SHOULDER_TRAUMA: { bodyArea: "SHOULDER", mechanism: "CONTACT" },
  BACK_PAIN: { bodyArea: "BACK", mechanism: "OVERUSE" },
  HAND_FINGER_INJURY: { bodyArea: "HAND_FINGER", mechanism: "CONTACT" },
  HEAD_CONCUSSION: { bodyArea: "HEAD", mechanism: "CONTACT" },
  GENERAL_OVERUSE: { bodyArea: "GENERAL", mechanism: "OVERUSE" },
  ACL_TEAR: { bodyArea: "KNEE", mechanism: "CONTACT", severeOnly: true },
};

export const CONTACT_INJURY_TYPES: readonly InjuryType[] = INJURY_TYPES.filter((t) => INJURY_TYPE_PROFILES[t].mechanism === "CONTACT" && !INJURY_TYPE_PROFILES[t].severeOnly);
export const OVERUSE_INJURY_TYPES: readonly InjuryType[] = INJURY_TYPES.filter((t) => INJURY_TYPE_PROFILES[t].mechanism === "OVERUSE");

/** Part 22: base duration RANGE (days) per severity -- an exact day is picked deterministically within this range, never a single hardcoded literal. */
export const SEVERITY_DURATION_RANGE_DAYS: Record<InjurySeverity, { min: number; max: number }> = {
  MINOR: { min: 2, max: 7 },
  MODERATE: { min: 7, max: 28 },
  MAJOR: { min: 28, max: 120 },
  SEVERE: { min: 120, max: 270 },
};

/** Part 19: phase boundaries as a fraction of total elapsed rehab progress (0-1). RETURN_TO_PLAY is the LIMITED-availability window; everything before it is fully unavailable (INJURED). */
export const REHAB_PHASE_THRESHOLDS: Record<RehabPhase, number> = {
  ACUTE: 0,
  REHAB: 0.15,
  RETURN_TO_TRAINING: 0.75,
  RETURN_TO_PLAY: 0.95,
};

export function rehabPhaseForProgress(progress: number): RehabPhase {
  if (progress >= REHAB_PHASE_THRESHOLDS.RETURN_TO_PLAY) return "RETURN_TO_PLAY";
  if (progress >= REHAB_PHASE_THRESHOLDS.RETURN_TO_TRAINING) return "RETURN_TO_TRAINING";
  if (progress >= REHAB_PHASE_THRESHOLDS.REHAB) return "REHAB";
  return "ACUTE";
}

/**
 * Part 4: the active injury record. Deliberately compact -- no diagnosis
 * detail beyond type/bodyArea/severity (Part 4: "do not overbuild
 * diagnosis detail").
 */
export interface ActiveInjury {
  injuryId: string;
  injuryType: InjuryType;
  bodyArea: BodyArea;
  mechanism: InjuryMechanism;
  severity: InjurySeverity;
  occurredDate: string;
  source: InjurySource;
  /** Deterministically picked within SEVERITY_DURATION_RANGE_DAYS, then age-adjusted -- an estimate, never re-rolled. */
  expectedReturnDate: string;
  expectedDurationDays: number;
  currentPhase: RehabPhase;
  /** 0-1: fraction of expected duration elapsed under actual (medical-quality-scaled) daily progress. 1.0 = fully recovered. */
  rehabProgress: number;
  /** >=1.0: this body area's own recurrence-risk multiplier while an old injury there is still within its recurrence window (Part 12/34). */
  recurrenceRiskMultiplier: number;
  /** Idempotency guard (Part 30/35): the last date daily rehab progression was applied for this injury. */
  lastRehabProcessedDate: string | null;
}

/** Part 37: compact history -- enough for future recurrence risk, never a daily rehab log. */
export interface InjuryHistoryEntry {
  injuryId: string;
  injuryType: InjuryType;
  bodyArea: BodyArea;
  mechanism: InjuryMechanism;
  severity: InjurySeverity;
  source: InjurySource;
  occurredDate: string;
  returnDate: string;
}

export interface PlayerInjuryState {
  playerId: string;
  activeInjury: ActiveInjury | null;
  injuryHistory: readonly InjuryHistoryEntry[];
}

export function emptyPlayerInjuryState(playerId: string): PlayerInjuryState {
  return { playerId, activeInjury: null, injuryHistory: [] };
}
