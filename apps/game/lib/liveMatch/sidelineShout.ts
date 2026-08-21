// HM-COACHING-0.2: sideline shouts -- a small, TEMPORARY tactical nudge
// layered on top of the existing (permanent) issued -> pending ->
// adopted instruction model from HM-TACTICS-0.7/HM-COACHING-0.1.
//
// A shout is NOT a new TeamTacticalProfile field and NOT a new
// tactical-domain concept: each supported shout temporarily overrides
// exactly one of the existing 3 HM-TACTICS-0.6A fields to one of its
// existing enum values, for a short, bounded, provisional duration, then
// automatically reverts to whatever profile was in effect when the
// shout was called -- never a permanent change, and never additive (the
// override is a fixed enum substitution, not a numeric bonus), so
// repeated/spammed shouts of the same type can never stack: reapplying
// "HIGH" on top of "HIGH" is a no-op, not a bigger number.
//
// ---------------------------------------------------------------------
// AUDIT (Spec: "do not implement a shout unless it has a defensible
// mapping to existing Fast Match/Tactical Domain variables"):
//
// SUPPORTED:
//   SOK_M6 ("SÖK M6") -> ati001UsageTendency = HIGH. Bible S60 defines
//     ati001UsageTendency as literally "this team's tendency to attempt
//     the ATI-001 interaction" -- the V9/M6 provoke-H2/H3 interaction.
//     "Seek M6" IS that interaction; a direct, honest match, not an
//     invented one.
//   STA_KOMPAKT ("STÅ KOMPAKT") -> h2ResponsePreference = H2_HOLDS.
//     H2_HOLDS is tactical-domain's own "hold position" Working Rule
//     response -- a compact, non-overcommitting defensive shape is
//     exactly what "stand compact" asks for.
//   VAR_MER_AGGRESSIVA ("VAR MER AGGRESSIVA") -> h2ResponsePreference =
//     H2_STOPS. H2_STOPS is tactical-domain's own "stop" response, the
//     most confrontational end of the same existing vocabulary.
//
// REJECTED (no defensible mapping -- omitted rather than invented):
//   ÖKA TEMPOT / SÄNK TEMPOT ("increase/decrease tempo"): Fast Match has
//     no tempo/pace/possession-speed variable anywhere. Goals are
//     sampled once for the whole match/segment (matchEngine.ts's
//     sampleTeamGoals), and every other stat (shots, saves, turnovers)
//     is DERIVED from that single goals number in buildTeamStats. There
//     is nothing a "tempo" shout could honestly move without inventing
//     a brand new mechanism.
//   TA HAND OM BOLLEN ("look after the ball"): turnovers exist as a
//     stat (TeamMatchStats.turnovers), but nothing in game-simulation or
//     tacticalMatchAdjustment.ts exposes turnovers as a lever tied to
//     TeamTacticalProfile -- matchEngine.ts's buildTeamStats samples
//     turnovers independently (`rng.nextInt(8, 16)`), with no
//     adjustment parameter at all. Wiring a turnover-specific knob would
//     be new modeling, not a mapping onto something that already
//     exists, so it is left out of this v0.1 rather than invented.
// ---------------------------------------------------------------------
import type { TeamTacticalProfile } from "../career/teamTacticalProfile";

export type ShoutType = "SOK_M6" | "STA_KOMPAKT" | "VAR_MER_AGGRESSIVA";

export const SHOUT_TYPES: readonly ShoutType[] = ["SOK_M6", "STA_KOMPAKT", "VAR_MER_AGGRESSIVA"];

/**
 * PROVISIONAL, deterministic delivery delay (simulated match minutes)
 * between a shout being called and it taking effect. Deliberately
 * shorter than a full sideline instruction's delay (see
 * tacticalInstruction.ts's TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES)
 * -- a shout is one quick call, not a systematic reorganization. Not a
 * player-receptiveness model.
 */
export const SHOUT_DELIVERY_DELAY_MINUTES = 1;

/**
 * PROVISIONAL, deterministic active duration (simulated match minutes)
 * once delivered, before the shout's override automatically reverts to
 * whatever profile was in effect when it was called.
 */
export const SHOUT_ACTIVE_DURATION_MINUTES = 5;

/** One in-flight shout. Only one may be pending/active at a time (Spec: "must not stack"). */
export interface Shout {
  type: ShoutType;
  /** The simulated match minute the manager called this shout at. */
  issuedMinute: number;
}

export type ShoutStatus = "PENDING" | "ACTIVE" | "EXPIRED";

export function shoutDeliveryMinute(shout: Shout): number {
  return Math.min(60, shout.issuedMinute + SHOUT_DELIVERY_DELAY_MINUTES);
}

export function shoutExpiryMinute(shout: Shout): number {
  return Math.min(60, shoutDeliveryMinute(shout) + SHOUT_ACTIVE_DURATION_MINUTES);
}

/** Deterministic: a pure function of `issuedMinute`/`type` and the current clock minute only -- never of wall-clock time, playback speed, or pause state. */
export function resolveShoutStatus(shout: Shout, clockMinute: number): ShoutStatus {
  if (clockMinute < shoutDeliveryMinute(shout)) {
    return "PENDING";
  }
  if (clockMinute < shoutExpiryMinute(shout)) {
    return "ACTIVE";
  }
  return "EXPIRED";
}

/**
 * The ONE, isolated override table (mirrors tacticalMatchAdjustment.ts's
 * own "one documented table" pattern) -- each shout swaps exactly one
 * existing TeamTacticalProfile field to one of its existing enum
 * values. Never a numeric bonus -- see the module doc above for why
 * this makes stacking structurally impossible rather than merely
 * discouraged.
 */
export function applyShoutOverride(baseProfile: TeamTacticalProfile, type: ShoutType): TeamTacticalProfile {
  switch (type) {
    case "SOK_M6":
      return { ...baseProfile, ati001UsageTendency: "HIGH" };
    case "STA_KOMPAKT":
      return { ...baseProfile, h2ResponsePreference: "H2_HOLDS" };
    case "VAR_MER_AGGRESSIVA":
      return { ...baseProfile, h2ResponsePreference: "H2_STOPS" };
  }
}

/** Swedish display labels -- presentation only, never stored. */
export function shoutLabel(type: ShoutType): string {
  switch (type) {
    case "SOK_M6":
      return "SÖK M6";
    case "STA_KOMPAKT":
      return "STÅ KOMPAKT";
    case "VAR_MER_AGGRESSIVA":
      return "VAR MER AGGRESSIVA";
  }
}
