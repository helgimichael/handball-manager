// HM-RATINGS-0.1: Player Rating domain foundation -- headless schema only.
// Design source of truth: docs/design/HANDBALL_MANAGER_PLAYER_RATING_MODEL_v0.1.docx,
// docs/design/HANDBALL_MANAGER_SWEDEN_2026-27_PLAYER_RATING_ANCHORS_v0.1.docx,
// docs/design/HANDBALL_MANAGER_COUNTRY_COMPETITION_LAYER_v0.1.docx,
// docs/design/HANDBALL_MANAGER_CLUB_WORLD_DEVELOPMENT_MODEL_v0.1.docx.
//
// This module defines ONLY the shape of a player's rating data -- no CA
// weighting engine, no attribute-to-CA computation, no gameplay effects,
// no numeric ratings for any real player. HM-RATINGS-0.2+ builds the
// actual engine on top of this foundation.
//
// Design principles baked into the shape itself (Rating Model §2):
//  - CA is current ability, never reputation/age/nationality/club status.
//  - PA is a theoretical ceiling; it can never leak into match performance
//    (this module has no "current attributes derived from PA" pathway at all).
//  - Attributes (1-20) and CA/PA (1-200) are structurally distinct scales
//    -- no shared type, no implicit conversion.
//  - Uncertainty is first-class: CA/PA always carry confidence + a
//    plausible range, never a bare number.
//  - Unknown players are never defaulted to "average" -- see
//    unassessedAbilityRating() in validators.ts.
//  - Injury/availability evidence never touches CA/PA fields directly --
//    it is only ever a PlayerRatingClaim.
//  - Country/competition/club context (a separate, future world-layer
//    concern) can only ever attach to a claim's evidence via `contextRef`
//    -- AbilityRating (the finished CA/PA number) has no context field at
//    all, so context can structurally never be "applied twice".

// ---------------------------------------------------------------------------
// Attribute scale (Rating Model §5): 1-20, global and fixed.
// ---------------------------------------------------------------------------

export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 20;

// ---------------------------------------------------------------------------
// Outcourt attribute vocabulary (Rating Model §6, "OUTCOURT ATTRIBUTE MODEL v0.2")
// ---------------------------------------------------------------------------

export const OUTCOURT_ATTRIBUTE_FAMILIES = {
  TECHNICAL: ["PASSING", "BALL_HANDLING", "SHOOTING_POWER", "SHOOTING_PLACEMENT", "SHOOTING_VARIETY", "BREAKTHROUGH", "FINISHING", "WING_FINISHING", "PIVOT_PLAY", "SCREENING"],
  PERCEPTION_DECISION: ["GAME_READING", "DECISION_MAKING", "AWARENESS", "ANTICIPATION", "PLAYMAKING", "TEMPO_CONTROL", "TWO_V_TWO_READING", "ADVANTAGE_RECOGNITION"],
  TACTICAL: ["TACTICAL_UNDERSTANDING", "ROLE_DISCIPLINE", "OFF_BALL_MOVEMENT", "SPACING", "TIMING", "TRANSITION_UNDERSTANDING", "SYSTEM_ADAPTABILITY", "SEVEN_V_SIX_UNDERSTANDING"],
  DEFENSIVE: ["CONTACT_ABILITY", "DEFENSIVE_POSITIONING", "DEFENSIVE_TIMING", "LATERAL_DEFENCE", "DEPTH_DEFENCE", "CENTRAL_DEFENCE", "COVERING", "SWITCHING_HANDOVER", "BALL_WINNING", "SHOT_BLOCKING"],
  PHYSICAL: ["ACCELERATION", "TOP_SPEED", "LATERAL_QUICKNESS", "AGILITY", "EXPLOSIVENESS", "STRENGTH", "CONTACT_BALANCE", "JUMP_ABILITY", "ENDURANCE", "REPEAT_SPRINT_ABILITY", "MOBILITY"],
  MENTAL: ["CONSISTENCY", "COMPOSURE", "CONCENTRATION", "COMPETITIVE_MENTALITY", "RESILIENCE", "DISCIPLINE", "COACHABILITY", "LEADERSHIP", "PRESSURE_HANDLING"],
} as const satisfies Record<string, readonly string[]>;

export type OutcourtAttributeFamily = keyof typeof OUTCOURT_ATTRIBUTE_FAMILIES;

export type OutcourtAttribute = (typeof OUTCOURT_ATTRIBUTE_FAMILIES)[OutcourtAttributeFamily][number];

export const OUTCOURT_ATTRIBUTES: readonly OutcourtAttribute[] = Object.values(OUTCOURT_ATTRIBUTE_FAMILIES).flat();

// ---------------------------------------------------------------------------
// Goalkeeper attribute branch (Rating Model §7) -- deliberately separate
// from OutcourtAttribute; a goalkeeper is never represented by one
// generic "Goalkeeping" value.
// ---------------------------------------------------------------------------

export const GOALKEEPER_ATTRIBUTE_FAMILIES = {
  SHOT_STOPPING: ["GK_POSITIONING", "SET_POSITION", "REACTION", "GK_EXPLOSIVENESS", "LOW_SAVES", "HIGH_SAVES", "CLOSE_RANGE_SAVES", "LONG_RANGE_SAVES", "WING_SAVES", "SEVEN_M_SAVES"],
  PERCEPTION_DECISION: ["SHOOTER_READING", "SHOT_ANTICIPATION", "PATIENCE", "DECISION_TIMING"],
  TRANSITION: ["OUTLET_PASSING", "RESTART_SPEED", "TRANSITION_DECISION"],
  // Rating Model §7: "Mental: Consistency; Composure; Concentration;
  // Pressure Handling and other applicable mental attributes" -- these
  // are the same named attributes as the outcourt MENTAL family, kept as
  // a distinct list here so the two branches never implicitly share a
  // record type (Rating Model's own "goalkeeper/outcourt branches stay
  // separate" boundary).
  MENTAL: ["GK_CONSISTENCY", "GK_COMPOSURE", "GK_CONCENTRATION", "GK_PRESSURE_HANDLING"],
} as const satisfies Record<string, readonly string[]>;

export type GoalkeeperAttributeFamily = keyof typeof GOALKEEPER_ATTRIBUTE_FAMILIES;

export type GoalkeeperAttribute = (typeof GOALKEEPER_ATTRIBUTE_FAMILIES)[GoalkeeperAttributeFamily][number];

export const GOALKEEPER_ATTRIBUTES: readonly GoalkeeperAttribute[] = Object.values(GOALKEEPER_ATTRIBUTE_FAMILIES).flat();

// ---------------------------------------------------------------------------
// Physical/body profile (Rating Model §6: "factual body/profile fields,
// not 1-20 ratings").
// ---------------------------------------------------------------------------

export type Handedness = "LEFT" | "RIGHT" | "AMBIDEXTROUS";

export interface PlayerPhysicalProfile {
  heightCm?: number;
  weightKg?: number;
  handedness?: Handedness;
}

// ---------------------------------------------------------------------------
// Position + role-profile vocabulary (Rating Model §8, "ROLE PROFILE SYSTEM v0.1")
// ---------------------------------------------------------------------------

export const OUTCOURT_POSITIONS = ["M9", "V9", "H9", "M6", "V6", "H6"] as const;
export type OutcourtPositionId = (typeof OUTCOURT_POSITIONS)[number];

/** Position and role are separate (Rating Model §8); GK is its own branch, never an outcourt role slot. */
export type Position = OutcourtPositionId | "GK";

export const ATTACK_ROLES_BY_POSITION = {
  M9: ["PRIMARY_PLAYMAKER", "BREAKTHROUGH_CREATOR", "SCORING_CENTRE_BACK", "TEMPO_CONTROLLER"],
  V9: ["SHOOTING_BACK", "BREAKTHROUGH_BACK", "CREATIVE_BACK", "COMPLETE_BACK"],
  H9: ["SHOOTING_BACK", "BREAKTHROUGH_BACK", "CREATIVE_BACK", "COMPLETE_BACK"],
  M6: ["PHYSICAL_PIVOT", "MOBILE_PIVOT", "SCREENING_PIVOT", "OFFENSIVE_PIVOT", "TWO_WAY_M6"],
  V6: ["ELITE_FINISHER", "TRANSITION_WING", "CREATIVE_WING", "TWO_WAY_WING"],
  H6: ["ELITE_FINISHER", "TRANSITION_WING", "CREATIVE_WING", "TWO_WAY_WING"],
} as const satisfies Record<OutcourtPositionId, readonly string[]>;

export type AttackRole = (typeof ATTACK_ROLES_BY_POSITION)[OutcourtPositionId][number];

export const ATTACK_ROLES: readonly AttackRole[] = [...new Set(Object.values(ATTACK_ROLES_BY_POSITION).flat())];

/** Defence position/role is separate from attack position/role (Rating Model §8). */
export const DEFENCE_ROLES = ["CENTRAL_ANCHOR", "AGGRESSIVE_SECOND", "MOBILE_DEFENDER", "DEFENSIVE_SPECIALIST", "MULTI_POSITION_DEFENDER"] as const;
export type DefenceRole = (typeof DEFENCE_ROLES)[number];

/**
 * How well the player's current attributes fit a specific role (Rating
 * Model §9: "Role Ability"). `value`, when present, is on the FUTURE CA
 * engine's own internal working scale -- this milestone defines only the
 * shape a role-ability score takes, not the weighting formula that
 * computes it (Rating Model §21, implementation steps 2-3 are explicitly
 * later work). `value` is deliberately OPTIONAL: a role can be recorded
 * as claimed/relevant for a player (e.g. from a qualitative anchor)
 * without a computed numeric score existing yet -- omitted, never a
 * fabricated 0 or placeholder number.
 */
export interface RoleProficiency {
  role: AttackRole | DefenceRole;
  value?: number;
}

// ---------------------------------------------------------------------------
// Phase ability, usage, utility (Rating Model §9)
// ---------------------------------------------------------------------------

export const PHASES = ["ATTACK", "DEFENCE", "TRANSITION", "GOALKEEPING"] as const;
export type Phase = (typeof PHASES)[number];

/** Current ability within one phase (Rating Model §9: "Phase Ability"). Same future-engine-owned scale as RoleProficiency.value. */
export interface PhaseAbility {
  phase: Phase;
  value: number;
}

/**
 * How the player is actually used (Rating Model §9: "Usage... Prevents
 * attack-only or defence-only specialists from being punished by
 * irrelevant phases"). Shares are independent -- a specialist's unused
 * phase is legitimately 0, never forced toward balance.
 */
export interface UsageProfile {
  attackUsageShare: number;
  defenceUsageShare: number;
  transitionUsageShare: number;
}

/** Rating Model §9: "Utility must remain a modest component" -- breadth of high-quality tactical use, plus a small positional-flexibility bonus. */
export interface UtilityProfile {
  utility: number;
  positionalFlexibility: number;
}

// ---------------------------------------------------------------------------
// Evidence model (Rating Model §3) -- deliberately a SEPARATE, smaller
// vocabulary from lib/identity's EvidenceClass: player-rating evidence
// and club/coach identity evidence are different domains with different
// semantics, and this model must not silently inherit or be conflated
// with the identity domain's 9-value vocabulary.
// ---------------------------------------------------------------------------

export const RATING_EVIDENCE_CLASSES = ["VERIFIED_CAREER_SIGNAL", "USER_EXPERT_PLAYER_ANCHOR", "INJURY_AVAILABILITY", "UNASSESSED", "PROJECTION_EXPECTATION"] as const;

export type RatingEvidenceClass = (typeof RATING_EVIDENCE_CLASSES)[number];

/**
 * Rating Model §3, per-class semantics:
 *  - VERIFIED_CAREER_SIGNAL: externally supported (national teams,
 *    foreign professional experience, competition level, awards,
 *    production, documented milestones).
 *  - USER_EXPERT_PLAYER_ANCHOR: expert assessment of importance,
 *    quality, role or potential (CLUB_STAR, KEY_PLAYER, ...).
 *  - INJURY_AVAILABILITY: stored separately from ability; may affect
 *    selection/development path, never CA/PA directly.
 *  - UNASSESSED: no expert anchor exists -- NOT negative evidence.
 *  - PROJECTION_EXPECTATION: forward-looking expectation; must never be
 *    silently promoted to verified career fact.
 */
export const RATING_EVIDENCE_CLASS_MEANING: Record<RatingEvidenceClass, string> = {
  VERIFIED_CAREER_SIGNAL: "Externally supported evidence: national teams, foreign professional experience, competition level, awards, production, documented milestones.",
  USER_EXPERT_PLAYER_ANCHOR: "Expert assessment of importance, quality, role or potential.",
  INJURY_AVAILABILITY: "Stored separately from ability. May affect selection/development path, never CA/PA directly.",
  UNASSESSED: "No expert anchor exists. This is not negative evidence.",
  PROJECTION_EXPECTATION: "Forward-looking expert or market expectation; must not be silently promoted to verified career fact.",
};

// ---------------------------------------------------------------------------
// Player anchor vocabulary (Rating Model §3, §13; Sweden Anchors doc).
// Deliberately open (a stable string, not a closed enum) -- mirrors
// lib/identity's IdentityClaim.domain precedent: the approved source
// vocabulary keeps growing as more player profiles are assessed, and a
// closed enum would force either silent truncation or constant schema
// churn. CANONICAL_PLAYER_ANCHORS documents the vocabulary actually
// observed so far (including the 5 the spec calls out by name) for
// UI/label purposes -- it is NOT a validation whitelist.
// ---------------------------------------------------------------------------

export type PlayerAnchorType = string;

export const CANONICAL_PLAYER_ANCHORS = [
  // Explicitly named in the Rating Model spec:
  "CLUB_STAR",
  "KEY_PLAYER",
  "HIGH_POTENTIAL",
  "ROLE_SPECIALIST",
  "PRIMARY_PLAYMAKER",
  // Additional vocabulary observed in the Sweden 2026/27 Anchors source:
  "CLUB_ICON",
  "CLUB_LEGEND",
  "SUPER_CLUB_STAR",
  "VETERAN_LEADER",
  "DEFENSIVE_SPECIALIST",
  "OFFENSIVE_SPECIALIST",
  "PHYSICAL_SPECIALIST",
  "ATTACK_ORGANIZER",
  "TWO_WAY_M6",
  "TWO_WAY_PLAYER",
  "TWO_WAY_WING",
  "ELITE_M6",
  "ELITE_H6",
  "MOMENTUM_GOALKEEPER",
  "VETERAN_EXPERIENCE",
  "SCORING_PROFILE",
  "DEVELOPMENT_SIGNAL",
  "FOREIGN_ELITE_ENVIRONMENT",
  "TWO_WAY_PROFILE",
  "DEFENSIVE_PROFILE",
  "LEADERSHIP_PROFILE",
  // PA-prior anchors (Rating Model §13):
  "DEVELOPMENT_POTENTIAL",
  "VERY_HIGH_POTENTIAL",
  "EXTREME_POTENTIAL",
  "NORMAL_OR_UNCERTAIN_POTENTIAL",
] as const;

// ---------------------------------------------------------------------------
// Evidence claim (Rating Model §3, §17 "verified career signals + user
// expert anchors + provenance/evidence class"). One generic, evidence-
// tagged claim envelope carries anchors, career signals, injury reports,
// projections and qualitative functional-attribute anchors alike --
// mirrors lib/identity's IdentityClaim shape (a proven pattern in this
// codebase for exactly this kind of qualitative, provenance-bearing data).
// ---------------------------------------------------------------------------

export interface PlayerRatingClaim {
  id: string;
  playerId: string;
  evidenceClass: RatingEvidenceClass;
  /** A domain grouping (e.g. "ANCHOR", "CAREER_SIGNAL", "INJURY", "PROJECTION", "FUNCTIONAL_ATTRIBUTE") -- free-form but stable per caller, not a closed enum. */
  domain: string;
  key: string;
  value: string | number | boolean;
  confidence?: "CONFIRMED" | "PROBABLE" | "UNCERTAIN";
  /**
   * A single, optional reference to whichever country/competition/club
   * world-layer entity calibrated this evidence's strength (e.g. a
   * competition id) -- deliberately a single string, never an array, so
   * a claim can structurally never be "double-stamped" with two
   * conflicting context calibrations. Country/Competition/Club Layer
   * §23: "Competition context modifies evidence on the way into the
   * attribute estimate. It must not be multiplied into the player's
   * finished CA again" -- enforced here by AbilityRating (below) having
   * no context field of its own at all, only claims do.
   */
  contextRef?: string;
  sourceRefs: string[];
  notes?: string;
}

export const PLAYER_RATING_CLAIM_DOMAINS = ["ANCHOR", "CAREER_SIGNAL", "INJURY", "PROJECTION", "FUNCTIONAL_ATTRIBUTE"] as const;
export type PlayerRatingClaimDomain = (typeof PLAYER_RATING_CLAIM_DOMAINS)[number];

// ---------------------------------------------------------------------------
// CA / PA (Rating Model §10, §12, §13) -- global 1-200 scale, structurally
// separate from the 1-20 attribute scale.
// ---------------------------------------------------------------------------

export const CA_MIN = 1;
export const CA_MAX = 200;
export const PA_MIN = 1;
export const PA_MAX = 200;

export type AbilityConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface PlausibleRange {
  min: number;
  max: number;
}

/**
 * Shared shape for CA and PA (Rating Model §12: "Store true/underlying
 * CA separately from knowledge about it... CA confidence, plausible CA
 * range"; §13: "PA confidence"). `value` is `null` when no confident
 * point estimate exists yet -- NOT defaulted to a mid-scale "average"
 * (Rating Model §2: "Unknown players must not all become average").
 * `plausibleRange` is always present, even when `value` is null --
 * widened uncertainty IS the honest representation of thin evidence.
 *
 * Deliberately has NO field for age, nationality, club, league or
 * context -- those can only ever influence the EVIDENCE (PlayerRatingClaim),
 * never this finished number, which structurally prevents re-applying
 * any of them a second time here.
 */
export interface AbilityRating {
  value: number | null;
  confidence: AbilityConfidence;
  plausibleRange: PlausibleRange;
}

/**
 * Rating Model §13 PA priors -- explicitly priors, not rules ("Youth
 * national-team role, YouthDevelopmentStrength, senior readiness, club
 * development environment, individual trajectory and expert evidence
 * may move the distribution"). Used only to seed a PLAUSIBLE RANGE for a
 * qualitative potential anchor, never to assign a final point value.
 *
 * HM-RATINGS-0.2 MODEL FIX: NORMAL_OR_UNCERTAIN_POTENTIAL was added
 * after the first real calibration pass (Malte Haglund) exposed a gap
 * -- the Sweden Anchors source uses this exact anchor specifically to
 * REJECT an inflated potential read (a prestigious foreign academy
 * pathway that user expert assessment explicitly does NOT read as
 * HIGH_POTENTIAL). Without a band for it, a caller had no honest way to
 * represent "evidence exists, but it does not support elevated
 * potential" other than the fully-unassessed fallback, which would
 * discard the anti-bias anchor entirely. The band is deliberately WIDE
 * and centered below the other bands -- it represents genuine
 * uncertainty around ordinary/uncertain ability, not a confident
 * "medium" prior.
 */
export const PA_PRIOR_BANDS: Record<string, PlausibleRange> = {
  NORMAL_OR_UNCERTAIN_POTENTIAL: { min: 90, max: 145 },
  DEVELOPMENT_POTENTIAL: { min: 105, max: 140 },
  HIGH_POTENTIAL: { min: 140, max: 165 },
  VERY_HIGH_POTENTIAL: { min: 160, max: 180 },
  EXTREME_POTENTIAL: { min: 175, max: 195 },
};

// ---------------------------------------------------------------------------
// PlayerRatingProfile -- the top-level composite (Rating Model §19,
// "REQUIRED IMPLEMENTATION DATA MODEL"). Mirrors ClubIdentityProfile /
// CurrentTeamIdentity's role in lib/identity: describes the SHAPE a
// player's rating data takes, computes nothing.
// ---------------------------------------------------------------------------

export interface PlayerRatingProfile {
  playerId: string;
  position: Position;
  secondaryPositions?: Position[];
  physicalProfile: PlayerPhysicalProfile;
  /** Present only for outcourt players (position !== "GK"). Partial -- an omitted attribute is genuinely unassessed, never silently defaulted. */
  outcourtAttributes?: Partial<Record<OutcourtAttribute, number>>;
  /** Present only for goalkeepers (position === "GK"). Never populated alongside outcourtAttributes. */
  goalkeeperAttributes?: Partial<Record<GoalkeeperAttribute, number>>;
  attackRoleProficiencies: RoleProficiency[];
  defenceRoleProficiencies: RoleProficiency[];
  phaseAbilities: PhaseAbility[];
  usage: UsageProfile;
  utility: UtilityProfile;
  ca: AbilityRating;
  pa: AbilityRating;
  /** Every piece of evidence about this player -- anchors, career signals, injury reports, projections, functional attribute anchors. */
  claims: PlayerRatingClaim[];
}
