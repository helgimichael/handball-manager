// HM-COACHING-1.0: headless live MatchPlan coaching-change layer --
// the MatchPlan counterpart to tacticalInstruction.ts's TeamTacticalProfile
// instruction. A coach expresses ONE intention at a time (a formation
// switch, a tempo change, a player's usage change, a specialist pair) as
// a small, typed `MatchPlanChange`; this module turns that into an
// ADOPTED update to a MatchPlan via HM-TACTICS-1.0's own edit functions
// (lib/matchPlan/matchPlanEdits.ts) -- never a parallel, ad hoc mutation.
//
// Deliberately SIMPLER than tacticalInstruction.ts's own lifecycle for
// v1 (Part G: "keep this SMALL"): a single fixed SIDELINE delay, reusing
// TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES verbatim rather than
// inventing a second constant -- no TIMEOUT/HALFTIME delivery modes and
// no implementationAssessment.ts DELAYED/PARTIAL outcome for MatchPlan
// changes yet (that layer is scoped to TeamTacticalProfile's 3 fields;
// honestly extending it to MatchPlan's ~15 different fields is
// disproportionate scope for this milestone -- reported as a left-out
// control, not silently skipped).
import { TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES } from "./tacticalInstruction";
import { setPlayerPhaseUsage, setPlayerPlayingTime, setSubstitutionPair, updateAttackPlan, updateDefencePlan, updateTransitionPlan } from "../matchPlan/matchPlanEdits";
import { INTENSITY_LABELS_SV, PHASE_USAGE_LABELS_SV, PLAYING_TIME_INTENTION_LABELS_SV, TEMPO_LABELS_SV } from "../matchPlan/matchPlanLabels";
import type { AttackPlanConfig, IntensityLevel, MatchPlan, PlayerPhaseUsage, PlayingTimeIntention, TransitionPlanConfig } from "../matchPlan/types";

export type MatchPlanChangeCategory = "DEFENCE" | "ATTACK" | "TRANSITION" | "PLAYER";

/**
 * Part D: the first live controls -- a small, curated set, not every
 * MatchPlan field. `PLAYER_MATCH_ROLE`/depth-hierarchy/goalkeeper-
 * reassignment changes are left out this milestone (see the final
 * report's "unsupported controls" list) since HM-MATCH-1.0's usage
 * engine already reads MatchRole primarily as a rotation-priority
 * signal that only meaningfully applies pre-match.
 */
export type MatchPlanChange =
  | { category: "DEFENCE"; kind: "FORMATION"; baseFormation: string }
  | { category: "DEFENCE"; kind: "RISK"; riskLevel: IntensityLevel }
  | { category: "DEFENCE"; kind: "CONTACT"; contactIntent: IntensityLevel }
  | { category: "ATTACK"; kind: "TEMPO"; tempo: AttackPlanConfig["tempo"] }
  | { category: "ATTACK"; kind: "PIVOT_USAGE"; pivotUsage: IntensityLevel }
  | { category: "TRANSITION"; kind: "OFFENSIVE_INTENT"; offensiveTransitionIntent: IntensityLevel }
  | { category: "TRANSITION"; kind: "SUBSTITUTION_PRIORITY"; substitutionPriority: TransitionPlanConfig["substitutionPriority"] }
  | { category: "PLAYER"; kind: "PLAYING_TIME"; playerId: string; playerName: string; playingTimeIntention: PlayingTimeIntention }
  | { category: "PLAYER"; kind: "PHASE_USAGE"; playerId: string; playerName: string; phaseUsage: PlayerPhaseUsage }
  | { category: "PLAYER"; kind: "SPECIALIST_PAIR"; attackPlayerId: string; attackPlayerName: string; defencePlayerId: string; defencePlayerName: string };

/** The ONE sanctioned way to turn an adopted MatchPlanChange into a new MatchPlan -- always via lib/matchPlan/matchPlanEdits.ts's own pure edit functions, never a parallel mutation path. */
export function applyMatchPlanChange(plan: MatchPlan, change: MatchPlanChange): MatchPlan {
  switch (change.kind) {
    case "FORMATION":
      return updateDefencePlan(plan, { baseFormation: change.baseFormation });
    case "RISK":
      return updateDefencePlan(plan, { riskLevel: change.riskLevel });
    case "CONTACT":
      return updateDefencePlan(plan, { contactIntent: change.contactIntent });
    case "TEMPO":
      return updateAttackPlan(plan, { tempo: change.tempo });
    case "PIVOT_USAGE":
      return updateAttackPlan(plan, { pivotUsage: change.pivotUsage });
    case "OFFENSIVE_INTENT":
      return updateTransitionPlan(plan, { offensiveTransitionIntent: change.offensiveTransitionIntent });
    case "SUBSTITUTION_PRIORITY":
      return updateTransitionPlan(plan, { substitutionPriority: change.substitutionPriority });
    case "PLAYING_TIME":
      return setPlayerPlayingTime(plan, change.playerId, change.playingTimeIntention);
    case "PHASE_USAGE":
      return setPlayerPhaseUsage(plan, change.playerId, change.phaseUsage);
    case "SPECIALIST_PAIR":
      return setSubstitutionPair(plan, change.attackPlayerId, change.defencePlayerId);
  }
}

/** A short, deterministic, Swedish coaching-language summary -- for the change-history log (Part N) and the pending-change badge. Never raw enum keys/technical terms. */
export function describeMatchPlanChange(change: MatchPlanChange): string {
  switch (change.kind) {
    case "FORMATION":
      return `Försvar: formation → ${change.baseFormation}`;
    case "RISK":
      return `Försvar: risknivå → ${INTENSITY_LABELS_SV[change.riskLevel]}`;
    case "CONTACT":
      return `Försvar: kontakt → ${INTENSITY_LABELS_SV[change.contactIntent]}`;
    case "TEMPO":
      return `Anfall: tempo → ${TEMPO_LABELS_SV[change.tempo]}`;
    case "PIVOT_USAGE":
      return `Anfall: M6-fokus → ${INTENSITY_LABELS_SV[change.pivotUsage]}`;
    case "OFFENSIVE_INTENT":
      return `Omställning: anfallsintention → ${INTENSITY_LABELS_SV[change.offensiveTransitionIntent]}`;
    case "SUBSTITUTION_PRIORITY":
      return `Omställning: bytesprioritet → ${change.substitutionPriority === "ATTACK_FIRST" ? "Anfallsspecialister först" : change.substitutionPriority === "DEFENCE_FIRST" ? "Försvarsspecialister först" : "Balanserat"}`;
    case "PLAYING_TIME":
      return `${change.playerName}: speltid → ${PLAYING_TIME_INTENTION_LABELS_SV[change.playingTimeIntention]}`;
    case "PHASE_USAGE":
      return `${change.playerName}: fasanvändning → ${PHASE_USAGE_LABELS_SV[change.phaseUsage]}`;
    case "SPECIALIST_PAIR":
      return `${change.attackPlayerName} ⇄ ${change.defencePlayerName}`;
  }
}

export interface MatchPlanChangeInstruction {
  id: string;
  issuedMinute: number;
  change: MatchPlanChange;
}

export type MatchPlanChangeStatus = "PENDING" | "ADOPTED";

/** Deterministic: a pure function of `issuedMinute` only (Part H: never wall-clock/pause/speed-dependent) -- reuses tacticalInstruction.ts's own sideline delay constant rather than a second one. */
export function matchPlanChangeAdoptionMinute(instruction: MatchPlanChangeInstruction): number {
  return Math.min(60, instruction.issuedMinute + TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES);
}

export function resolveMatchPlanChangeStatus(instruction: MatchPlanChangeInstruction, clockMinute: number): MatchPlanChangeStatus {
  return clockMinute >= matchPlanChangeAdoptionMinute(instruction) ? "ADOPTED" : "PENDING";
}

/**
 * Part N: one structured, persisted change-history entry -- "what did
 * the coach change, when did they ask for it, when did it actually take
 * effect". Defined here (not in lib/career/matchPlanMidMatchChange.ts,
 * the module that actually WRITES it) so lib/career/types.ts can
 * reference it without a CareerState <-> splice-module import cycle.
 */
export interface MatchPlanChangeHistoryEntry {
  id: string;
  category: MatchPlanChangeCategory;
  label: string;
  requestedMinute: number;
  adoptedMinute: number;
}
