// HM-TACTICS-1.0: the MATCH SQUAD / MATCH PLAN domain foundation.
//
// This module is deliberately headless (no fs, no React, no match-
// engine coupling) and deliberately separate from everything that
// already exists:
//
//  - lib/career/teamTacticalProfile.ts's `TeamTacticalProfile` (exactly
//    3 fields: ati001UsageTendency, h2ResponsePreference,
//    tacticalFamiliarity) is the CLUB'S permanent tactical identity --
//    one instance per club, read/written by every mid-match coaching
//    system (tacticalInstruction.ts, sidelineShout.ts,
//    implementationAssessment.ts, aiTacticalPreferences.ts,
//    opponentAdaptation.ts). MatchPlan NEVER reads or writes that type.
//  - lib/liveMatch/sevenVSixMode.ts's `SevenVSixInstruction`/
//    `sevenVSixActive` is the LIVE, mid-match 7v6 toggle (issued at a
//    clock minute, adopted after a delay). MatchPlan's `SevenVSixPolicy`
//    below is a PRE-MATCH coach intention (how readily to use it) --
//    structurally distinct, never renamed/merged with the live switch.
//  - packages/tactical-domain (@handball-manager/tactical-domain) is
//    the ATI-001 x TI-001 single-interaction resolution model -- audited
//    for this milestone and confirmed to contain NO general attack/
//    defence tactic-profile vocabulary (tempo, formation, emphasis
//    dimensions, etc. do not exist there). This module does not import
//    from it; the ATTACK/DEFENCE/TRANSITION config below is new,
//    provisional vocabulary scoped ONLY to MatchPlan, per this
//    milestone's own instruction: "If a requested concept has no
//    current domain representation, add it only to this MatchPlan
//    domain as a clear provisional tactical choice."
//
// PERSISTENCE BOUNDARY (Part M): this domain is intentionally headless
// in this milestone -- no field was added to CareerState. The
// established fixture-keyed-data convention already used throughout
// CareerState (`results: Record<fixtureId, FastMatchResult>`,
// `worldSquads: Record<clubId, PlayerMock[]>`) is the correct future
// home: a fixture's MatchPlan should live at
// `career.matchPlans: Record<string /* fixtureId */, MatchPlan>`,
// completely separate from `career.tacticalProfile: TeamTacticalProfile`
// (the club's own, non-fixture-keyed field) by construction -- writing
// a fixture's match plan can never touch club identity, because they
// live in different keyed stores. Wiring that field into CareerState
// (plus the corresponding saveMigration.ts bump every prior CareerState
// addition required) is left to a future milestone once an editor
// actually needs to persist a plan.
import type { AttackRole, DefenceRole, Position } from "../rating/types";

export type { AttackRole, DefenceRole, Position };

// ---------------------------------------------------------------------------
// Part A -- Match Squad (max 16 players selected for one fixture).
// ---------------------------------------------------------------------------

export const MATCH_SQUAD_MIN_PLAYERS = 1;
export const MATCH_SQUAD_MAX_PLAYERS = 16;

export interface MatchSquadPlayer {
  playerId: string;
  /** The player's own position -- goalkeeper/outcourt identity preserved via `position === "GK"`, never a separate boolean that could drift out of sync. */
  position: Position;
}

/** A fixture-specific, max-16 selection from a club's available squad. Never a permanent squad-status change (that stays lib/game-data's `SquadStatus`/lib/career's player-status machinery). */
export interface MatchSquad {
  fixtureId: string;
  clubId: string;
  players: readonly MatchSquadPlayer[];
}

// ---------------------------------------------------------------------------
// Part B/C -- Starting units. Attack and defence are selected
// INDEPENDENTLY -- a player can start in one phase and not the other.
// ---------------------------------------------------------------------------

export type AttackFormation = "NORMAL" | "SEVEN_V_SIX";

export interface AttackUnitSlot {
  playerId: string;
  position: Position;
}

/**
 * HM-MATCH-1.1 Part 6: a real 7v6 lineup follows one of a small number
 * of RECOGNIZED handball structures -- never a freeform "pick any
 * position for any of the 7 slots" picker, which previously let the UI
 * produce tactically absurd lineups (e.g. two V6/left-wing slots).
 * DOUBLE_PIVOT doubles up the pivot/M6 role (the most common real 7v6
 * shape); EXTRA_BACKCOURT brings on a second central/backcourt player
 * (M9) instead -- the other legitimate, clean structure this domain's
 * existing position vocabulary can honestly represent. Both keep the
 * other 5 positions (V6/V9/H9/H6 plus one of M9/M6) exactly as in a
 * NORMAL lineup.
 */
export const SEVEN_V_SIX_STRUCTURES = ["DOUBLE_PIVOT", "EXTRA_BACKCOURT"] as const;
export type SevenVSixStructure = (typeof SEVEN_V_SIX_STRUCTURES)[number];

/** The FIXED 7-slot position template for each structure -- slot index i always maps to this position, never a free per-slot choice. */
export const SEVEN_V_SIX_STRUCTURE_POSITIONS: Record<SevenVSixStructure, readonly Position[]> = {
  DOUBLE_PIVOT: ["V6", "V9", "M9", "H9", "H6", "M6", "M6"],
  EXTRA_BACKCOURT: ["V6", "V9", "M9", "H9", "H6", "M6", "M9"],
};

/**
 * NORMAL: exactly 7 slots -- 1 GK + the 6 distinct outcourt positions,
 * each filled exactly once (the standard 6-outcourt-plus-keeper
 * lineup).
 * SEVEN_V_SIX: exactly 7 slots, ALL outcourt, NO goalkeeper slot at
 * all (the keeper is off for an extra attacker) -- `sevenVSixStructure`
 * fixes each slot's position per `SEVEN_V_SIX_STRUCTURE_POSITIONS`
 * above; defaults to DOUBLE_PIVOT when omitted (every pre-HM-MATCH-1.1
 * plan).
 */
export interface AttackStartingUnit {
  formation: AttackFormation;
  slots: readonly AttackUnitSlot[];
  sevenVSixStructure?: SevenVSixStructure;
}

/**
 * Defence has no named-formation vocabulary anywhere in the codebase
 * yet (confirmed by audit: lib/career/aiTacticalPreferences.ts's own
 * doc comment explicitly records that a 6:0/5:1/3:3 formation field
 * was deliberately NOT added to TeamTacticalProfile). Rather than
 * invent a formation enum this milestone doesn't need, defence slots
 * use an abstract, formation-agnostic court-slot index (1-6) plus an
 * OPTIONAL reuse of the rating domain's existing `DefenceRole`
 * vocabulary as descriptive metadata.
 */
export interface DefenceUnitSlot {
  playerId: string;
  /** 1-6, formation-agnostic defensive court slot -- not tied to any specific named formation. */
  courtSlot: number;
  role?: DefenceRole;
}

export interface DefenceStartingUnit {
  /** Exactly 6 entries, courtSlot 1-6 each used exactly once. */
  courtSlots: readonly DefenceUnitSlot[];
  goalkeeperId: string;
}

// ---------------------------------------------------------------------------
// Part D/E/F -- per-player match usage (role importance, playing-time
// intention, phase usage). Every MatchSquad player needs exactly one.
// ---------------------------------------------------------------------------

/** Importance in THIS match -- never permanent squad status, CA, reputation, or contract role. */
export const MATCH_ROLES = ["KEY_PLAYER", "STARTER", "MAJOR_ROTATION", "ROTATION", "SPECIALIST", "DEVELOPMENT", "EMERGENCY"] as const;
export type MatchRole = (typeof MATCH_ROLES)[number];

/** Coach INTENT, not exact minutes -- the future Match Engine translates this into actual usage. */
export const PLAYING_TIME_INTENTIONS = ["VERY_HIGH", "HIGH", "NORMAL", "LOW", "VERY_LOW", "EMERGENCY_ONLY"] as const;
export type PlayingTimeIntention = (typeof PLAYING_TIME_INTENTIONS)[number];

/** Which phase(s) the coach intends to use this player in -- crucial for handball's attack/defence substitution pattern (e.g. an ATTACK_ONLY playmaker paired with a DEFENCE_ONLY specialist). */
export const PLAYER_PHASE_USAGES = ["BOTH_PHASES", "ATTACK_ONLY", "DEFENCE_ONLY", "ATTACK_PREFERRED", "DEFENCE_PREFERRED"] as const;
export type PlayerPhaseUsage = (typeof PLAYER_PHASE_USAGES)[number];

export interface PlayerMatchUsage {
  playerId: string;
  matchRole: MatchRole;
  playingTimeIntention: PlayingTimeIntention;
  phaseUsage: PlayerPhaseUsage;
}

// ---------------------------------------------------------------------------
// Part G -- attack/defence substitution pairs (coach-declared intent
// only; whether a substitution actually succeeds during a real
// transition is Match Engine's future job, not this domain's).
// ---------------------------------------------------------------------------

export interface SubstitutionPair {
  attackPlayerId: string;
  defencePlayerId: string;
}

// ---------------------------------------------------------------------------
// Part H -- generic depth/hierarchy structure. `groupKey` is a free-form
// but stable label (e.g. "M9", "M6_ATTACK", "CENTRAL_DEFENCE", "GK") --
// deliberately not a closed enum, so the coach can express depth for
// any grouping (a position, a role, a custom bucket) without this
// domain hardcoding every possible one.
// ---------------------------------------------------------------------------

export interface DepthEntry {
  playerId: string;
  /** 1 = primary, 2 = secondary, 3 = emergency, etc. */
  priority: number;
}

export interface DepthGroup {
  groupKey: string;
  entries: readonly DepthEntry[];
}

export type DepthHierarchy = readonly DepthGroup[];

// ---------------------------------------------------------------------------
// Part I -- headless tactical plan structure (ATTACK / DEFENCE /
// TRANSITION). Confirmed by audit: NONE of this vocabulary exists
// anywhere else in the codebase (tactical-domain, TeamTacticalProfile,
// or the mid-match coaching systems) -- this is new, provisional
// vocabulary scoped only to MatchPlan, per this milestone's own
// instruction not to duplicate or alter existing tactical concepts.
// A small, locally-scoped 3-level intensity scale is used throughout
// rather than importing tactical-domain's CapabilityLevel, which
// carries ATI-001-specific calibration semantics this domain must not
// couple itself to.
// ---------------------------------------------------------------------------

export type IntensityLevel = "LOW" | "MEDIUM" | "HIGH";

export const SEVEN_V_SIX_POLICY_LEVELS = ["NEVER", "SITUATIONAL", "FREQUENT", "PRIMARY"] as const;
export type SevenVSixPolicyLevel = (typeof SEVEN_V_SIX_POLICY_LEVELS)[number];

/**
 * Pre-match coach INTENTION about 7v6 usage -- distinct from
 * lib/liveMatch/sevenVSixMode.ts's live, mid-match ON/OFF toggle
 * (HM-TACTICS-0.8's mechanics are untouched by this milestone). A
 * `PRIMARY` policy with `activeFromKickoff: true` describes an
 * intention the future Match Engine could use to seed the live
 * `sevenVSixActive` state at kickoff -- this module does not do that
 * wiring itself.
 */
export interface SevenVSixPolicy {
  level: SevenVSixPolicyLevel;
  activeFromKickoff: boolean;
}

export interface AttackPlanConfig {
  tempo: "SLOW" | "BALANCED" | "FAST";
  structureFreedom: "STRUCTURED" | "BALANCED" | "FREE";
  pivotUsage: IntensityLevel;
  twoVTwoEmphasis: IntensityLevel;
  breakthroughEmphasis: IntensityLevel;
  shootingEmphasis: IntensityLevel;
  wingUsage: IntensityLevel;
  ballCirculation: "DIRECT" | "BALANCED" | "PATIENT";
  sevenVSixPolicy: SevenVSixPolicy;
}

export interface DefencePlanConfig {
  /** Free-form label (e.g. "6-0", "5-1", "3-3") -- not a closed enum, since no formation vocabulary exists anywhere in the codebase yet (see module doc). Provisional, not authoritative. */
  baseFormation: string;
  defensiveDepth: "DEEP" | "STANDARD" | "HIGH";
  contactIntent: IntensityLevel;
  coverBlockingEmphasis: IntensityLevel;
  ballOrientedPressure: IntensityLevel;
  riskLevel: IntensityLevel;
}

export interface TransitionPlanConfig {
  offensiveTransitionIntent: IntensityLevel;
  defensiveRetreatIntent: IntensityLevel;
  firstWaveAggression: IntensityLevel;
  goalkeeperInitiation: IntensityLevel;
  substitutionPriority: "ATTACK_FIRST" | "DEFENCE_FIRST" | "BALANCED";
}

// ---------------------------------------------------------------------------
// Top-level MatchPlan -- composes everything above. Fixture-specific;
// never mutates lib/career/teamTacticalProfile.ts's club-level
// `TeamTacticalProfile` (structurally impossible: MatchPlan has no
// field of that type anywhere).
// ---------------------------------------------------------------------------

export interface MatchPlan {
  fixtureId: string;
  clubId: string;
  squad: MatchSquad;
  attackStartingUnit: AttackStartingUnit;
  defenceStartingUnit: DefenceStartingUnit;
  playerUsage: readonly PlayerMatchUsage[];
  substitutionPairs: readonly SubstitutionPair[];
  depthHierarchy: DepthHierarchy;
  attackPlan: AttackPlanConfig;
  defencePlan: DefencePlanConfig;
  transitionPlan: TransitionPlanConfig;
}
