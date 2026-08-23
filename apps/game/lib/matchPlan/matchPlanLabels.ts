// HM-TACTICS-1.1: the ONE canonical Swedish label vocabulary for
// HM-TACTICS-1.0's MatchPlan domain -- mirrors lib/rating/
// attributeVocabulary.ts's role in the rating domain (a single source
// of player-facing labels, never raw enum keys in the UI, never
// duplicated per component). Also home to the deterministic tactical
// summary builder (Part M): plain label lookups joined together, no
// AI/LLM/random text.
import type {
  AttackFormation,
  DefenceRole,
  IntensityLevel,
  MatchPlan,
  MatchRole,
  PlayerPhaseUsage,
  PlayingTimeIntention,
  Position,
  SevenVSixPolicyLevel,
} from "./types";

export const POSITION_LABELS_SV: Record<Position, string> = {
  GK: "Målvakt",
  V9: "Vänster nia",
  V6: "Vänster sexa",
  M9: "Mittnia",
  M6: "Mittsexa",
  H9: "Höger nia",
  H6: "Höger sexa",
};

export function matchPlanPositionLabel(position: Position): string {
  return POSITION_LABELS_SV[position];
}

export const MATCH_ROLE_LABELS_SV: Record<MatchRole, string> = {
  KEY_PLAYER: "Nyckelspelare",
  STARTER: "Ordinarie",
  MAJOR_ROTATION: "Stor rotation",
  ROTATION: "Rotation",
  SPECIALIST: "Specialist",
  DEVELOPMENT: "Utveckling",
  EMERGENCY: "Nödfall",
};

export const PLAYING_TIME_INTENTION_LABELS_SV: Record<PlayingTimeIntention, string> = {
  VERY_HIGH: "Mycket hög",
  HIGH: "Hög",
  NORMAL: "Normal",
  LOW: "Låg",
  VERY_LOW: "Mycket låg",
  EMERGENCY_ONLY: "Endast nödfall",
};

export const PHASE_USAGE_LABELS_SV: Record<PlayerPhaseUsage, string> = {
  BOTH_PHASES: "Anfall & försvar",
  ATTACK_ONLY: "Endast anfall",
  DEFENCE_ONLY: "Endast försvar",
  ATTACK_PREFERRED: "Främst anfall",
  DEFENCE_PREFERRED: "Främst försvar",
};

export const INTENSITY_LABELS_SV: Record<IntensityLevel, string> = {
  LOW: "Låg",
  MEDIUM: "Normal",
  HIGH: "Hög",
};

export const ATTACK_FORMATION_LABELS_SV: Record<AttackFormation, string> = {
  NORMAL: "Normal",
  SEVEN_V_SIX: "7 mot 6",
};

export const SEVEN_V_SIX_POLICY_LABELS_SV: Record<SevenVSixPolicyLevel, string> = {
  NEVER: "Aldrig",
  SITUATIONAL: "Situationsbaserat",
  FREQUENT: "Ofta",
  PRIMARY: "Primärt",
};

export const TEMPO_LABELS_SV = { SLOW: "Långsamt", BALANCED: "Balanserat", FAST: "Snabbt" } as const;
export const STRUCTURE_FREEDOM_LABELS_SV = { STRUCTURED: "Strukturerat", BALANCED: "Balanserat", FREE: "Fritt" } as const;
export const BALL_CIRCULATION_LABELS_SV = { DIRECT: "Direkt", BALANCED: "Balanserad", PATIENT: "Tålmodig" } as const;
export const DEFENSIVE_DEPTH_LABELS_SV = { DEEP: "Djup", STANDARD: "Normal", HIGH: "Hög" } as const;
export const SUBSTITUTION_PRIORITY_LABELS_SV = {
  ATTACK_FIRST: "Anfallsspecialister först",
  DEFENCE_FIRST: "Försvarsspecialister först",
  BALANCED: "Balanserat",
} as const;

export const DEFENCE_ROLE_LABELS_SV: Record<DefenceRole, string> = {
  CENTRAL_ANCHOR: "Central ankare",
  AGGRESSIVE_SECOND: "Aggressiv tvåa",
  MOBILE_DEFENDER: "Rörlig försvarare",
  DEFENSIVE_SPECIALIST: "Försvarsspecialist",
  MULTI_POSITION_DEFENDER: "Flerpositionsförsvarare",
};

/**
 * HM-TACTICS-1.2 Part 4: `DefenceUnitSlot.courtSlot` is a deliberately
 * formation-agnostic 1-6 index (see types.ts's own doc comment -- no
 * named-formation vocabulary exists in the domain). This is a UI-only
 * labeling convention (left-to-right handball defender naming), not a
 * domain concept -- the underlying courtSlot number is still the only
 * thing persisted/validated.
 */
export const DEFENCE_COURT_SLOT_LABELS_SV: Record<number, string> = { 1: "V1", 2: "V2", 3: "V3", 4: "H3", 5: "H2", 6: "H1" };

export function defenceCourtSlotLabel(courtSlot: number): string {
  return DEFENCE_COURT_SLOT_LABELS_SV[courtSlot] ?? `Ruta ${courtSlot}`;
}

/** A short glanceable playing-time cue for the compact squad list (Part 5) -- never a replacement for the full Swedish label, only a scan aid next to it. */
export const PLAYING_TIME_INTENTION_INDICATOR_SV: Record<PlayingTimeIntention, string> = {
  VERY_HIGH: "↑↑",
  HIGH: "↑",
  NORMAL: "–",
  LOW: "↓",
  VERY_LOW: "↓↓",
  EMERGENCY_ONLY: "⚠",
};

/**
 * A short, deterministic, human-readable tactical summary (Part M) --
 * plain field-to-label lookups joined together. No AI/LLM involvement,
 * no randomness: the exact same MatchPlan always produces the exact
 * same summary string.
 */
export function buildTacticalSummary(plan: MatchPlan): string {
  const segments = [
    `${plan.defencePlan.baseFormation} · ${INTENSITY_LABELS_SV[plan.defencePlan.contactIntent]} kontakt`,
    `${TEMPO_LABELS_SV[plan.attackPlan.tempo]} anfall · ${INTENSITY_LABELS_SV[plan.attackPlan.pivotUsage]} M6-fokus`,
    `${INTENSITY_LABELS_SV[plan.transitionPlan.firstWaveAggression]} första fas`,
    `7v6 ${SEVEN_V_SIX_POLICY_LABELS_SV[plan.attackPlan.sevenVSixPolicy.level].toLowerCase()}`,
  ];
  return segments.join(" · ");
}

/**
 * HM-TACTICS-1.2 Part 6: the same deterministic field-to-label lookups
 * as `buildTacticalSummary`, grouped by phase (FÖRSVAR/ANFALL/
 * OMSTÄLLNING/SPECIAL) for the "Matchidé" header instead of one long
 * joined line. Still no AI/LLM/randomness -- only fields that exist on
 * MatchPlan.
 */
export function buildMatchIdea(plan: MatchPlan): { defence: string; attack: string; transition: string; special: string } {
  const d = plan.defencePlan;
  const a = plan.attackPlan;
  const t = plan.transitionPlan;
  return {
    defence: `${d.baseFormation} · ${DEFENSIVE_DEPTH_LABELS_SV[d.defensiveDepth]} höjd · ${INTENSITY_LABELS_SV[d.contactIntent]} kontakt`,
    attack: `${TEMPO_LABELS_SV[a.tempo]} · ${STRUCTURE_FREEDOM_LABELS_SV[a.structureFreedom]} · ${INTENSITY_LABELS_SV[a.pivotUsage]} M6-fokus`,
    transition: `${INTENSITY_LABELS_SV[t.firstWaveAggression]} första fas · ${SUBSTITUTION_PRIORITY_LABELS_SV[t.substitutionPriority]}`,
    special: `7 mot 6: ${SEVEN_V_SIX_POLICY_LABELS_SV[a.sevenVSixPolicy.level].toLowerCase()}`,
  };
}
