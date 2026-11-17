// HM-PLAYER-CAREER-LIFECYCLE-1.0: ageing, decline, and retirement -- the
// second half of the world population loop Youth Intake 1.0 started
// (commit 448a5e1). Youth Intake fixed the world aging toward extinction
// but, by design, has no counterbalancing exit -- this milestone adds
// one: AGEING -> DECLINE -> RETIREMENT, closing the loop
// YOUTH INTAKE -> DEVELOPMENT -> PRIME -> DECLINE -> RETIREMENT.
//
// ARCHITECTURE AUDIT (Part 1) -- what this hooks into, unmodified:
//   - CANONICAL CA/attribute mutation path: lib/development/developmentResolution.ts's
//     own applyResolvedAttributeChanges(rating, changes) -- the SAME
//     function HM-TRAINING-1.1's weekly growth resolution already uses,
//     just fed a NEGATIVE {attribute, newValue, caDelta} list instead of
//     a positive one. No parallel CA-mutation system exists or is
//     created here (Part 12's own explicit requirement). Its own
//     caNudgePerAttributePoint helper is now exported for this reuse.
//   - GameplayPlayerRating is the canonical ability truth; PlayerMock.currentAbility/
//     potentialAbility are legacy display fields the EXISTING growth path
//     (resolveWeeklyDevelopmentIfDue) already never touches either --
//     decline follows the exact same precedent, not a new gap.
//   - resolveWeeklyDevelopmentIfDue itself is HUMAN-CLUB-ONLY (reads only
//     state.gameplayRatings[state.playerClubId]) -- decline/retirement,
//     being WORLD RULES (Part 2/17), cannot reuse that function directly
//     and instead iterate every eligible club themselves, the SAME
//     pattern contractExpiry.ts/youthIntake.ts already established.
//   - Player identity/removal: the EXACT SAME "reserved, non-catalog
//     sentinel key in the already-generic worldSquads/gameplayRatings
//     Record<string,T>" design HM-PLAYER-CONTRACT-LIFECYCLE-1.0 proved
//     for free agency, extended with a THIRD sentinel (RETIRED_CLUB_ID)
//     -- getCareerPlayer's own generic Object.keys(worldSquads) scan
//     already finds a player there with zero code changes (identity
//     preserved, Part 2's own "not raraded ur historien"), and
//     getFreeAgents/getExternalCandidateClubs/rankCandidates/
//     getRecruitmentCandidates already structurally exclude anyone NOT
//     at FREE_AGENT_CLUB_ID or a real catalog club -- a retired player
//     (clubId === RETIRED_CLUB_ID, never "") is therefore invisible to
//     every candidate/discovery/recruitment system (Part 19's own "not
//     the same thing as an active free agent" is true purely because the
//     sentinel differs).
//     CORRECTED (HM-PLAYER-DEVELOPMENT-2.0 PHASE 1A): that reasoning is
//     sound but was NOT sufficient on its own. It holds only while a
//     retired player STAYS at the sentinel -- and contractExpiry.ts's
//     sweep iterated every worldSquads key, including "retired". Since
//     retirePlayer sets contractEndDate to the retirement date, those
//     players read as expired, were released to FREE_AGENT_CLUB_ID, and
//     were re-signed by CPU recruitment. A 5-season trace measured 43
//     executed retirements and ZERO permanent exits. The sweep now skips
//     the retired sentinel explicitly; see contractExpiry.ts.
//   - Contract/release mechanics: transferPlayerPermanently, reused
//     completely unmodified (retirePlayer below mirrors
//     contractExpiry.ts's own releasePlayerToFreeAgency almost verbatim,
//     just targeting RETIRED_CLUB_ID).
//   - Free-agent-since signal (Part 6): PlayerContract.contractEndDate is
//     ALREADY the reliable "became unattached on" date for any free
//     agent produced via the canonical contractExpiry.ts path (it is
//     never mutated by releasePlayerToFreeAgency) -- no new tracking
//     field was needed or added for this.
//   - Squad-status staleness (Part 14): deriveDefaultSquadStatusTier
//     reads a STATIC PlayerMock.squadStatus/calibratedSquadStatusTier,
//     never auto-recomputed from CA -- a PRE-EXISTING characteristic of
//     the codebase, not a new gap this milestone introduces. Documented,
//     not patched, per Part 14's own instruction ("only fix if it
//     creates correctness or severe decision pathology").
//     CORRECTED (HM-PLAYER-DEVELOPMENT-2.0 PHASE 1): "no pathology found"
//     was WRONG, and the 30-season benchmark falsified it. Because the
//     tier is a lifetime constant, a player's protective multiplier can
//     never decay -- so once the age curve stopped rising at 43 (see
//     RETIREMENT_AGE_ANCHORS below) a contracted KEY_PLAYER sat at a
//     fixed 6.9% annual retirement probability forever. The benchmark
//     measured active players aged 56-66 on all four seeds, with the
//     maximum climbing ~1 year per season without settling. The tier is
//     STILL static -- that remains deliberate and unpatched -- but it can
//     no longer produce an indefinite protected state, because
//     EXTREME_AGE_RETIREMENT_FLOOR_ANCHORS now bounds the final
//     probability from below regardless of tier or contract.
import { getCareerPlayer } from "./careerWorld";
import { getPlayerContract, getPlayerContractStatus } from "../economy/contractIntegration";
import { transferPlayerPermanently } from "../transfers/transferExecution";
import { endActivePlacementForPlayer } from "./playerPlacements";
import { seededOffset } from "../rating/generation/deterministicVariation";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { applyResolvedAttributeChanges, caNudgePerAttributePoint } from "../development/developmentResolution";
import { deriveDefaultSquadStatusTier, type SquadStatusTier } from "./squadStatus";
import { daysBetween } from "./dateUtils";
import { careerWorldClubIds } from "./worldCompetitions";
import { worldPoolCareerClubIds } from "./careerWorld";
import { FREE_AGENT_CLUB_ID, isFreeAgentClubId } from "./contractExpiry";
import { buildPlayerRetiredEvent, type CareerEvent } from "./careerEvents";
import { computeProfessionalCareerExitProbability, professionalCareerExitRoll } from "./professionalCareerExit";
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, GOALKEEPER_ATTRIBUTE_FAMILIES, OUTCOURT_ATTRIBUTE_FAMILIES } from "../rating/types";
import type { DevelopableAttribute } from "../development/types";
import type { ContractStatus } from "../economy/types";
import type { CareerState } from "./types";

// ---------------------------------------------------------------------------
// Part 2: retirement is a canonical world-lifecycle transition, not a
// deletion -- the SAME reserved-sentinel-key pattern free agency already
// established.
// ---------------------------------------------------------------------------

// The sentinel itself now lives beside FREE_AGENT_CLUB_ID in contractExpiry.ts
// (its sibling, and the module whose expiry sweep must distinguish the two --
// see PHASE 1A there). Re-exported here so this module remains the canonical
// import site for everything retirement-related.
export { RETIRED_CLUB_ID, isRetiredClubId } from "./contractExpiry";
import { RETIRED_CLUB_ID, isRetiredClubId } from "./contractExpiry";

export function isPlayerRetired(state: CareerState, playerId: string): boolean {
  const player = getCareerPlayer(state, playerId);
  return player !== undefined && isRetiredClubId(player.clubId);
}

// ---------------------------------------------------------------------------
// Part 8: annual evaluation date -- 15 June. Documented sequence:
//   31 May  -- contract expiry (contractExpiry.ts)
//   15 June -- ageing decline + retirement evaluation (THIS module)
//   1 July  -- youth intake (youthIntake.ts)
// Chosen deliberately AFTER contract expiry has fully resolved for the
// season (so a retiring/declining player's contract STATUS already
// reflects whether they survived the 31 May cliff -- Part 7's own
// "generally finishes contract unless exceptional") and BEFORE youth
// intake adds fresh 16-18-year-olds (who therefore never exist yet at
// evaluation time -- no special-casing needed to exclude them). This also
// satisfies Part 8's own explicit goal: retirement creates roster space
// BEFORE youth intake fills it, not after.
// ---------------------------------------------------------------------------

export const LIFECYCLE_EVALUATION_DATE_MMDD = "06-15";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function seededIndex(seedKey: string, n: number): number {
  return Math.abs(seededOffset(seedKey, n)) % n;
}

/** [0, 1), deterministic from `seedKey`. */
function seededProbability(seedKey: string): number {
  return seededIndex(seedKey, 100_000) / 100_000;
}

function interpolate(anchors: readonly (readonly [number, number])[], x: number): number {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [xa, ya] = anchors[i];
    const [xb, yb] = anchors[i + 1];
    if (x >= xa && x <= xb) {
      const t = (x - xa) / (xb - xa);
      return ya + (yb - ya) * t;
    }
  }
  return anchors[anchors.length - 1][1];
}

/** Part 4: goalkeepers get a modest, smooth "effective age" discount for BOTH retirement and decline curves -- never a hard "goalkeepers retire at 40" rule, just the SAME age-shaped curve read a few years earlier on the x-axis. */
const GOALKEEPER_EFFECTIVE_AGE_OFFSET = 2.5;

function effectiveAge(age: number, isGoalkeeper: boolean): number {
  return isGoalkeeper ? age - GOALKEEPER_EFFECTIVE_AGE_OFFSET : age;
}

// ---------------------------------------------------------------------------
// Part 3/4/5/6: retirement probability model.
// ---------------------------------------------------------------------------

/** Part 3: smooth anchor curve, never a hard age cliff -- calibration starting points per the milestone's own conceptual shape (<=31 near-zero, 32-33 rare, 34-35 possible, 36-37 common, 38+ very common, 40+ exceptional continuation only). */
const RETIREMENT_AGE_ANCHORS: readonly (readonly [number, number])[] = [
  [28, 0.0],
  [31, 0.01],
  [32, 0.03],
  [33, 0.05],
  [34, 0.08],
  [35, 0.13],
  [36, 0.2],
  [37, 0.3],
  [38, 0.45],
  [39, 0.6],
  [40, 0.75],
  [43, 0.92],
  // HM-PLAYER-DEVELOPMENT-2.0 PHASE 1: the table previously ENDED at 43, and
  // `interpolate` returns the final anchor for every x beyond the table -- so
  // the base probability was exactly flat from 43 to infinity. These two
  // anchors keep it rising instead of freezing.
  [46, 0.96],
  [50, 0.99],
];

// ---------------------------------------------------------------------------
// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1: EXTREME-AGE RETIREMENT FLOOR.
//
// THE DEFECT THIS FIXES. The 30-season benchmark found active players aged
// 56-66 on every seed, with the maximum climbing ~1 year per season and never
// settling. Root cause, proven from code rather than inferred:
//
//   1. RETIREMENT_AGE_ANCHORS ended at 43, so base froze at 0.92 forever.
//   2. TIER_RETIREMENT_MULTIPLIER is read from deriveDefaultSquadStatusTier,
//      which resolves from STATIC PlayerMock fields (calibratedSquadStatusTier
//      or the squadStatus string) and has NO dependence on CA, age or form.
//      A player's tier is therefore a lifetime constant.
//   3. contractSituationMultiplier returns 0.15 while comfortably contracted.
//
// Together those gave a contracted KEY_PLAYER a 0.92*0.5*0.15 = 6.9% annual
// retirement probability at EVERY age past 43 -- an absorbing state, since
// nothing about getting older could ever raise it again.
//
// WHY A FLOOR RATHER THAN BIGGER MULTIPLIERS. The multipliers are bounded
// below by 0.5 (KEY_PLAYER) * 0.15 (contracted) = 0.075. For age to dominate
// multiplicatively the base would have to exceed 13.0, which is impossible for
// a probability. So no reformulation of the existing product can satisfy "age
// must eventually dominate all protective multipliers" -- the floor has to be
// applied AFTER the multipliers, which is exactly what makes it a floor.
//
// WHY NOT EXTEND THE DECLINE CURVE INSTEAD. Measured, not assumed:
// declinePointsForPlayer ends in clamp(points, 0, 3), and expectedDeclinePoints
// is already 2.8 at age 43. Any anchor producing an expected value >= 3.0
// yields exactly 3 points after the clamp, so additional decline anchors are
// INERT unless the clamp itself is raised. And because the tier is a lifetime
// constant (point 2 above), even unlimited decline could never move a player
// into a higher-retirement tier. The decline curve is structurally incapable of
// breaking this lock-in, so this milestone deliberately leaves it untouched.
//
// SHAPE. Zero below 38 so nothing about ordinary careers changes; the floor
// only overtakes the multiplier path around 39-40, then rises steeply. Read on
// effectiveAge like every other curve here, so goalkeepers keep the same
// consistent discount rather than acquiring a second, special rule.
// ---------------------------------------------------------------------------
const EXTREME_AGE_RETIREMENT_FLOOR_ANCHORS: readonly (readonly [number, number])[] = [
  [38, 0.0],
  [40, 0.12],
  [42, 0.3],
  [44, 0.55],
  [46, 0.78],
  [48, 0.93],
  [50, 0.99],
];

/** The minimum annual retirement probability at `age`, irrespective of tier, contract or any other protective multiplier. */
export function extremeAgeRetirementFloor(age: number, isGoalkeeper: boolean): number {
  return interpolate(EXTREME_AGE_RETIREMENT_FLOOR_ANCHORS, effectiveAge(age, isGoalkeeper));
}

/** Nobody is even evaluated below this age -- avoids spending a seeded roll (and any audit noise) on players the curve already treats as ~0. */
const RETIREMENT_MIN_EVAL_AGE = 28;

function baseRetirementProbability(age: number, isGoalkeeper: boolean): number {
  return interpolate(RETIREMENT_AGE_ANCHORS, effectiveAge(age, isGoalkeeper));
}

/** Part 5: quality/status mildly shifts continuation likelihood -- a KEY_PLAYER/FIRST_CHOICE is meaningfully less likely to retire than an equivalent SQUAD_PLAYER, never a hard rule. */
const TIER_RETIREMENT_MULTIPLIER: Record<SquadStatusTier, number> = {
  KEY_PLAYER: 0.5,
  FIRST_CHOICE: 0.75,
  ROTATION: 1.0,
  SQUAD_PLAYER: 1.25,
  TALENT: 1.0,
};

/** Part 7: "generally finishes contract unless exceptional" -- comfortably UNDER_CONTRACT is a rare, exceptional retirement; EXPIRING/EXPIRING_SOON is a genuine natural boundary approaching; FREE_AGENT is full weight (plus the duration boost below). */
function contractSituationMultiplier(status: ContractStatus | undefined): number {
  if (status === "FREE_AGENT") return 1.0;
  if (status === "EXPIRING" || status === "EXPIRING_SOON") return 0.6;
  return 0.15;
}

/** Part 6: age + time-as-free-agent -- reuses contract.contractEndDate (never mutated by releasePlayerToFreeAgency) as the reliable "became unattached on" signal; no new tracking field needed. Capped so a very long-unattached veteran becomes substantially, but not absurdly, more likely to retire. */
const FREE_AGENT_DURATION_MAX_MULTIPLIER = 3.0;
function freeAgentDurationMultiplier(daysUnattached: number): number {
  return Math.min(FREE_AGENT_DURATION_MAX_MULTIPLIER, 1 + (daysUnattached / 365) * 0.6);
}

export interface RetirementProbabilityInputs {
  age: number;
  isGoalkeeper: boolean;
  tier: SquadStatusTier;
  contractStatus: ContractStatus | undefined;
  daysUnattached: number;
  /**
   * HM-TRANSFER-REALISM M8D: how far below his club's core the player now is
   * (median CA of the club's best 14 minus his CA; negative when he is above
   * it). Optional -- absent means no opportunity signal (free agents, tests).
   */
  abilityGapToSquadCore?: number;
}

/**
 * M8D: from 30, a player who has dropped out of his club's core (little
 * playing time ahead) is more likely to stop, and one who is still among its
 * best is less likely -- a gentle, bounded factor on top of age and contract.
 */
export function opportunityRetirementMultiplier(age: number, abilityGapToSquadCore: number | undefined): number {
  if (abilityGapToSquadCore === undefined || age < 30) return 1;
  return clamp(1 + abilityGapToSquadCore / 40, 0.75, 1.6);
}

// ---------------------------------------------------------------------------
// HM-PLAYER-DEVELOPMENT-2.0 PHASE 0.5: an OPT-IN diagnostic sink for the
// retirement decision. Off by default (null), so a normal career pays
// nothing for it -- no branch cost beyond one null check per evaluated
// player, no behaviour change whatsoever. It exists because a 20-season
// audit measured ZERO retirements against a non-zero expected count, and
// the only honest way to find out why is to observe the REAL lifecycle
// path rather than re-derive the formula somewhere else.
// ---------------------------------------------------------------------------

export interface RetirementDecisionTrace {
  date: string;
  playerId: string;
  clubId: string;
  age: number;
  isGoalkeeper: boolean;
  tier: SquadStatusTier;
  contractStatus: ContractStatus | undefined;
  daysUnattached: number;
  baseProbability: number;
  tierMultiplier: number;
  contractMultiplier: number;
  freeAgentMultiplier: number;
  /** PHASE 1: the extreme-age floor, and whether it (rather than the multiplier path) decided `probability`. */
  extremeAgeFloor: number;
  floorBinds: boolean;
  probability: number;
  seedKey: string;
  roll: number;
  rollPassed: boolean;
  /** True only when the state actually changed as a result of retiring this player. */
  executed: boolean;
  /** When `rollPassed` but not `executed`, the guard that swallowed it. */
  blockedReason: string | null;
}

let retirementTraceSink: ((trace: RetirementDecisionTrace) => void) | null = null;

/** Attach (or clear, with `null`) the retirement decision sink. Test/audit only. */
export function setRetirementTraceSink(sink: ((trace: RetirementDecisionTrace) => void) | null): void {
  retirementTraceSink = sink;
}

/** Exported for the Phase 0.5 audit so a trace can attribute the final probability to its factors. */
export function retirementProbabilityFactors(inputs: RetirementProbabilityInputs): {
  base: number; tier: number; contract: number; freeAgent: number; floor: number; floorBinds: boolean;
} {
  const base = baseRetirementProbability(inputs.age, inputs.isGoalkeeper);
  const tier = TIER_RETIREMENT_MULTIPLIER[inputs.tier];
  const contract = contractSituationMultiplier(inputs.contractStatus);
  const freeAgent = isFreeAgentStatus(inputs.contractStatus) ? freeAgentDurationMultiplier(inputs.daysUnattached) : 1.0;
  const floor = extremeAgeRetirementFloor(inputs.age, inputs.isGoalkeeper);
  // `floorBinds` says which of the two paths actually decided this player's
  // probability -- the diagnostic the age-tail audit needs.
  return { base, tier, contract, freeAgent, floor, floorBinds: floor > base * tier * contract * freeAgent };
}

/** The exact seed key the retirement roll uses -- exported so an audit can analyse the generator's distribution over the REAL key namespace. */
export function retirementSeedKey(playerId: string, year: string): string {
  return `${playerId}:${year}:retirement-roll`;
}

/** The exact roll the retirement decision uses. Exported for the same reason. */
export function retirementRoll(playerId: string, year: string): number {
  return seededProbability(retirementSeedKey(playerId, year));
}

/** Pure -- the full retirement-probability composition, unit-testable without a CareerState. */
export function computeRetirementProbability(inputs: RetirementProbabilityInputs): number {
  const base = baseRetirementProbability(inputs.age, inputs.isGoalkeeper);
  const tierMult = TIER_RETIREMENT_MULTIPLIER[inputs.tier];
  const contractMult = contractSituationMultiplier(inputs.contractStatus);
  const faMult = isFreeAgentStatus(inputs.contractStatus) ? freeAgentDurationMultiplier(inputs.daysUnattached) : 1.0;
  const opportunityMult = opportunityRetirementMultiplier(inputs.age, inputs.abilityGapToSquadCore);
  // PHASE 1: the multiplier path stays exactly as it was -- the floor only ever
  // RAISES the result, and is 0 below age 38, so no ordinary career changes.
  const floor = extremeAgeRetirementFloor(inputs.age, inputs.isGoalkeeper);
  return clamp(Math.max(base * tierMult * contractMult * faMult * opportunityMult, floor), 0, 0.98);
}

function isFreeAgentStatus(status: ContractStatus | undefined): boolean {
  return status === "FREE_AGENT";
}

// ---------------------------------------------------------------------------
// Part 9/10/11: decline model.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// HM-TRANSFER-REALISM M8D: GRADUAL, POSITION-SENSITIVE AGEING.
//
// THE DEFECT THIS REPLACES. Decline used to remove at most THREE attribute
// points a season, picked at random from the whole branch. An outcourt CA point
// is spread over 63 attributes (caNudgePerAttributePoint = 199/19/63 = 0.166),
// so the old ceiling was ~0.5 CA a year for an outcourt player even at 43 -- in
// practice no decline at all. A 20-season simulation measured players of CA 159
// at 40 on three-year contracts, kept the world's top level filled with
// veterans, and was one cause of the league-strength drift.
//
// THE MODEL. Each attribute FAMILY ages on its own smooth curve: physical
// qualities fade first (from the late twenties), defensive and technical ones
// later, game reading, tactics and mentality last and least. The expected loss
// per attribute per season is interpolated from the family's anchors and
// rounded probabilistically per attribute (deterministic seeds), so a season
// takes a few points from many attributes rather than three random ones.
//   * Position: wings and pivots lean on their physique more than a centre back
//     does, so their physical decline is a little steeper; a centre back keeps
//     his game longer.
//   * Individual: every player has a lifelong seeded ageing rate (0.7-1.3) and
//     onset shift (+-1.5 years), so players do not all decline at the same age.
//   * Goalkeepers keep the existing effective-age discount on every curve.
// Physical decline is a small share of overall ability, so an ageing player
// loses pace before he loses his game: overall CA falls gently in the early
// thirties (~1-2 a season) and faster after 35 (~4-6 a season). PA is never
// touched (applyResolvedAttributeChanges has no PA parameter).
// ---------------------------------------------------------------------------

type Anchors = readonly (readonly [number, number])[];

const OUTCOURT_FAMILY_DECLINE: Record<keyof typeof OUTCOURT_ATTRIBUTE_FAMILIES, Anchors> = {
  PHYSICAL: [[28, 0], [31, 0.3], [34, 0.7], [37, 1.1], [40, 1.4]],
  DEFENSIVE: [[29, 0], [32, 0.22], [35, 0.55], [38, 0.9], [41, 1.1]],
  TECHNICAL: [[30, 0], [33, 0.15], [36, 0.45], [39, 0.8], [42, 1.0]],
  PERCEPTION_DECISION: [[32, 0], [35, 0.08], [38, 0.3], [41, 0.6]],
  TACTICAL: [[33, 0], [36, 0.06], [39, 0.25], [42, 0.5]],
  MENTAL: [[34, 0], [37, 0.04], [40, 0.2], [43, 0.4]],
};

const GOALKEEPER_FAMILY_DECLINE: Record<keyof typeof GOALKEEPER_ATTRIBUTE_FAMILIES, Anchors> = {
  SHOT_STOPPING: [[29, 0], [32, 0.2], [35, 0.55], [38, 0.9], [41, 1.2]],
  TRANSITION: [[30, 0], [33, 0.15], [36, 0.45], [39, 0.8], [42, 1.0]],
  PERCEPTION_DECISION: [[32, 0], [35, 0.08], [38, 0.3], [41, 0.6]],
  MENTAL: [[34, 0], [37, 0.04], [40, 0.2], [43, 0.4]],
};

/** Position emphasis on the physical (and, for pivots, defensive) curves. */
function positionFamilyFactor(position: string, family: string): number {
  if (family === "PHYSICAL") {
    if (position === "V6" || position === "H6") return 1.2;
    if (position === "M6") return 1.1;
    if (position === "M9") return 0.9;
  }
  if (family === "DEFENSIVE" && position === "M6") return 1.1;
  if (family === "TECHNICAL" && position === "M9") return 0.9;
  return 1;
}

/** Lifelong individual ageing traits, seeded on the player alone. */
export function individualAgeingTraits(playerId: string): { rate: number; onsetShift: number } {
  const rate = 0.7 + seededProbability(`${playerId}:ageing-rate:v1`) * 0.6;
  const onsetShift = (seededProbability(`${playerId}:ageing-onset:v1`) * 2 - 1) * 1.5;
  return { rate, onsetShift };
}

/** Expected attribute points lost this season per attribute of `family` (before rounding). */
export function expectedFamilyDecline(family: string, branch: "OUTCOURT" | "GOALKEEPER", position: string, age: number, playerId: string): number {
  const anchors = branch === "GOALKEEPER"
    ? GOALKEEPER_FAMILY_DECLINE[family as keyof typeof GOALKEEPER_FAMILY_DECLINE]
    : OUTCOURT_FAMILY_DECLINE[family as keyof typeof OUTCOURT_FAMILY_DECLINE];
  if (!anchors) return 0;
  const { rate, onsetShift } = individualAgeingTraits(playerId);
  const x = effectiveAge(age, branch === "GOALKEEPER") - onsetShift;
  return Math.max(0, interpolate(anchors, x)) * rate * positionFamilyFactor(position, family);
}

/**
 * The attribute changes one season of ageing applies to a rating (empty when
 * the player is too young to decline). Pure and deterministic.
 */
export function ageingDeclineChanges(
  playerId: string,
  year: string,
  age: number,
  position: string,
  branch: "OUTCOURT" | "GOALKEEPER",
  attributes: Record<string, { value: number }>,
): { attribute: DevelopableAttribute; newValue: number; caDelta: number }[] {
  const families = branch === "GOALKEEPER" ? GOALKEEPER_ATTRIBUTE_FAMILIES : OUTCOURT_ATTRIBUTE_FAMILIES;
  const nudge = caNudgePerAttributePoint(branch);
  const changes: { attribute: DevelopableAttribute; newValue: number; caDelta: number }[] = [];
  for (const [family, list] of Object.entries(families)) {
    const expected = expectedFamilyDecline(family, branch, position, age, playerId);
    if (expected <= 0) continue;
    for (const attribute of list as readonly string[]) {
      const current = attributes[attribute]?.value;
      if (current === undefined || current <= ATTRIBUTE_MIN) continue;
      const whole = Math.floor(expected);
      const points = whole + (seededProbability(`${playerId}:${year}:decline:${attribute}`) < expected - whole ? 1 : 0);
      if (points <= 0) continue;
      const newValue = clamp(current - points, ATTRIBUTE_MIN, ATTRIBUTE_MAX);
      changes.push({ attribute: attribute as DevelopableAttribute, newValue, caDelta: (newValue - current) * nudge });
    }
  }
  return changes;
}

/**
 * Part 9/12/13: applies one season's worth of age-related decline to
 * `playerId`'s own canonical GameplayPlayerRating at `clubId` -- reuses
 * applyResolvedAttributeChanges completely unmodified (Part 12), so
 * decline and growth can NEVER diverge into an incoherent CA-vs-attribute
 * state. Never touches `rating.pa` (Part 13: PA is a ceiling, never
 * altered by decline) -- applyResolvedAttributeChanges itself has no PA
 * parameter at all, so this is true by construction, not by convention.
 * A true no-op (same state reference) when no decline applies this
 * season (young player, already-floor attributes, or a zero magnitude
 * roll).
 */
function applyPlayerDecline(state: CareerState, playerId: string, clubId: string, date: string, age: number, position: string): CareerState {
  const rating = state.gameplayRatings[clubId]?.find((r) => r.playerId === playerId);
  if (!rating) return state;
  const attributes = rating.branch.attributes as unknown as Record<string, { value: number }>;
  const changes = ageingDeclineChanges(playerId, date.slice(0, 4), age, position, rating.branch.branch, attributes);
  if (changes.length === 0) return state;
  const updated = applyResolvedAttributeChanges(rating, changes);
  if (updated === rating) return state;
  const nextRatings = (state.gameplayRatings[clubId] ?? []).map((r) => (r.playerId === playerId ? updated : r));
  return { ...state, gameplayRatings: { ...state.gameplayRatings, [clubId]: nextRatings } };
}

// ---------------------------------------------------------------------------
// Part 2/7: retirement execution -- mirrors contractExpiry.ts's own
// releasePlayerToFreeAgency almost verbatim, targeting RETIRED_CLUB_ID.
// ---------------------------------------------------------------------------

/**
 * Moves `playerId` to the canonical RETIRED sentinel -- identity, rating,
 * development history, and club history are all PRESERVED (Part 2: "inte
 * raderas ur historien"); only current squad/contract/candidate-pool
 * membership ends. Reuses transferPlayerPermanently completely
 * unmodified (same 1.0B ownership guard already protects this exactly
 * like a free-agent release), and reuses the SAME loan-deactivation /
 * active-placement-ending side effects releasePlayerToFreeAgency already
 * established, so a retiring player can never leave a stale loan/
 * placement pointing at them (Part 29's own correctness invariants).
 */
/** Diagnostic only: why `retirePlayer` would decline to move this player. Mirrors its own guards exactly, in order. */
function retirementBlockReason(state: CareerState, playerId: string): string {
  const player = getCareerPlayer(state, playerId);
  if (!player) return "getCareerPlayer returned nothing";
  if (isRetiredClubId(player.clubId)) return "already retired";
  if (!getPlayerContract(state, playerId)) return "no contract record";
  return "transferPlayerPermanently returned the same state (ownership//destination guard)";
}

export function retirePlayer(state: CareerState, playerId: string, date: string): CareerState {
  const player = getCareerPlayer(state, playerId);
  const contract = getPlayerContract(state, playerId);
  if (!player || !contract || isRetiredClubId(player.clubId)) return state;

  const fromClubId = player.clubId;
  // HM-PLAYER-CAREER-LIFECYCLE-1.0 fix (found by the long-run audit): the
  // new contractEndDate must be `date`, NOT the original
  // contract.contractEndDate. A player who retires exactly at a natural
  // contract boundary has contractEndDate <= date already, so this makes
  // no difference there -- but an "exceptional" mid-contract retirement
  // (contractSituationMultiplier still allows a small chance) previously
  // left a FUTURE contractEndDate in place, so getPlayerContractStatus
  // (pure date math, no clubId awareness) kept reporting a retired
  // player as UNDER_CONTRACT. Setting it to `date` makes the contract
  // read as expired from this point on, for every reader -- a genuine
  // ownership-mismatch correctness fix, not a new field or a parallel
  // status.
  let next = transferPlayerPermanently(state, playerId, fromClubId, RETIRED_CLUB_ID, 0, date);
  if (next === state) return state;

  for (const loan of Object.values(next.loans)) {
    if (loan.active && loan.playerId === playerId) {
      next = { ...next, loans: { ...next.loans, [loan.id]: { ...loan, active: false } } };
    }
  }
  next = endActivePlacementForPlayer(next, playerId, date, "EXPIRED");

  return next;
}

// ---------------------------------------------------------------------------
// Part 8/17: the daily-tick hook -- one annual pass, every eligible club
// (Part 17: identical treatment for real/generated/Division1/free-agent
// players) plus the free-agent pool itself (Part 6).
// ---------------------------------------------------------------------------

export interface PlayerLifecycleResult {
  state: CareerState;
  events: CareerEvent[];
  retiredPlayerIds: string[];
  declinedPlayerIds: string[];
  /**
   * HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B.3: players who left professional
   * handball because they could not find a club -- deliberately reported
   * SEPARATELY from `retiredPlayerIds`, even though both use the same terminal
   * storage, so metrics and career history can tell the two apart.
   */
  careerExitPlayerIds: string[];
}

/**
 * Runs once per year on LIFECYCLE_EVALUATION_DATE_MMDD (cheap early-exit
 * on every other day). For each eligible player not yet evaluated this
 * calendar year (Part 22/10: idempotent via playerLifecycleYears, no
 * double-processing on a reload/reprocess), rolls retirement FIRST (a
 * retiring player skips decline entirely -- they are leaving anyway) and
 * otherwise applies one season of age-related decline. Human-club
 * players are evaluated exactly like every CPU club's own (Part 2/17: a
 * world rule, never a CPU decision) -- only the resulting CareerEvent is
 * club-scoped.
 */
export function progressPlayerLifecycle(state: CareerState, date: string): PlayerLifecycleResult {
  if (date.slice(5, 10) !== LIFECYCLE_EVALUATION_DATE_MMDD) return { state, events: [], retiredPlayerIds: [], declinedPlayerIds: [], careerExitPlayerIds: [] };

  const year = date.slice(0, 4);
  let next = state;
  const events: CareerEvent[] = [];
  const retiredPlayerIds: string[] = [];
  const declinedPlayerIds: string[] = [];
  const careerExitPlayerIds: string[] = [];

  // HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0 Part 18: retirement/decline
  // is a WORLD RULE that must apply across every tier (Handbollsligan,
  // Allsvenskan, Division 1), not just the manager's own competition --
  // deliberately reuses the broader `careerWorldClubIds` resolver, NOT
  // youthIntake.ts's own `eligibleYouthIntakeClubIds` (which is
  // intentionally narrower, scoped only to the manager's own live
  // competition, per that module's own doc). Before this milestone these
  // two were conflated because they happened to be identical in a
  // single-competition world.
  // HM-TRANSFER-REALISM M8A: ageing, decline and retirement are world rules --
  // world-pool players were exempt (they could only leave through contract
  // expiry), so a 39-year-old could keep a contract abroad indefinitely.
  const clubIds = [...careerWorldClubIds(next), ...worldPoolCareerClubIds(next), FREE_AGENT_CLUB_ID];

  for (const clubId of clubIds) {
    const squad = next.worldSquads[clubId] ?? [];
    // M8D: the club's core level (median CA of its best 14), read once per club.
    const clubCas = isFreeAgentClubId(clubId) ? [] : (next.gameplayRatings[clubId] ?? []).map((r) => r.ca).sort((a, b) => b - a).slice(0, 14);
    const squadCore = clubCas.length >= 7 ? clubCas[Math.floor(clubCas.length / 2)] : undefined;
    for (const player of squad) {
      if (next.playerLifecycleYears[player.id] === year) continue; // idempotent -- already evaluated this year.

      const contract = getPlayerContract(next, player.id);
      const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, date);
      next = { ...next, playerLifecycleYears: { ...next.playerLifecycleYears, [player.id]: year } };
      if (!contract || age === null) continue;

      const isGoalkeeper = player.position === "MV";

      // PHASE 1B.3: PROFESSIONAL CAREER EXIT -- unattached players only, at any
      // age. This runs BEFORE the age-gated retirement check below because the
      // two are different endings and a player can only have one: a free agent
      // who leaves the professional game did not retire, and RETIREMENT_MIN_EVAL_AGE
      // (28) is deliberately NOT lowered to accommodate him. Reuses the same
      // annual pass and the same playerLifecycleYears idempotency key already
      // written above, so no new state and no second evaluation date.
      if (isFreeAgentClubId(player.clubId)) {
        const yearsUnattached = Math.max(0, daysBetween(contract.contractEndDate, date)) / 365;
        const rating = next.gameplayRatings[player.clubId]?.find((r) => r.playerId === player.id);
        const exitProbability = computeProfessionalCareerExitProbability({
          yearsUnattached,
          age,
          ca: rating?.ca ?? 0,
          headroom: rating ? rating.pa - rating.ca : 0,
        });
        if (professionalCareerExitRoll(player.id, year) < exitProbability) {
          const before = next;
          next = retirePlayer(next, player.id, date);
          // SILENT for the world, exactly like a CPU club's retirement: a free
          // agent has no club, so `wasHumanClub` can never be true for them and
          // emitting one inbox message per exit (~50/year) would be pure noise.
          // The distinction still survives where it matters -- careerExitPlayerIds
          // below, and buildPlayerCareerExitEvent for any surface that later
          // knows the player was the manager's own (no last-club signal exists
          // today: transferPlayerPermanently overwrites the contract's clubId on
          // release, so a free agent retains no former employer).
          if (next !== before) careerExitPlayerIds.push(player.id);
          continue; // a player who leaves the game never also retires or declines this year.
        }
      }

      if (age >= RETIREMENT_MIN_EVAL_AGE) {
        const tier = deriveDefaultSquadStatusTier(player);
        const status = getPlayerContractStatus(next, player.id);
        const daysUnattached = isFreeAgentClubId(player.clubId) ? Math.max(0, daysBetween(contract.contractEndDate, date)) : 0;
        const ownCa = squadCore === undefined ? undefined : next.gameplayRatings[clubId]?.find((r) => r.playerId === player.id)?.ca;
        const abilityGapToSquadCore = squadCore === undefined || ownCa === undefined ? undefined : squadCore - ownCa;
        const probability = computeRetirementProbability({ age, isGoalkeeper, tier, contractStatus: status, daysUnattached, abilityGapToSquadCore });
        const seedKey = retirementSeedKey(player.id, year);
        const roll = seededProbability(seedKey);

        if (roll < probability) {
          const wasHumanClub = player.clubId === next.playerClubId;
          const playerName = `${player.firstName} ${player.lastName}`;
          const beforeRetire = next;
          next = retirePlayer(next, player.id, date);
          const executed = next !== beforeRetire;
          if (retirementTraceSink) {
            const f = retirementProbabilityFactors({ age, isGoalkeeper, tier, contractStatus: status, daysUnattached });
            retirementTraceSink({
              date, playerId: player.id, clubId, age, isGoalkeeper, tier, contractStatus: status, daysUnattached,
              baseProbability: f.base, tierMultiplier: f.tier, contractMultiplier: f.contract, freeAgentMultiplier: f.freeAgent,
              extremeAgeFloor: f.floor, floorBinds: f.floorBinds,
              probability, seedKey, roll, rollPassed: true, executed,
              blockedReason: executed ? null : retirementBlockReason(beforeRetire, player.id),
            });
          }
          retiredPlayerIds.push(player.id);
          if (wasHumanClub) events.push(buildPlayerRetiredEvent(player.id, playerName, age, date));
          continue; // a retiring player never also declines the same evaluation.
        }
        if (retirementTraceSink) {
          const f = retirementProbabilityFactors({ age, isGoalkeeper, tier, contractStatus: status, daysUnattached });
          retirementTraceSink({
            date, playerId: player.id, clubId, age, isGoalkeeper, tier, contractStatus: status, daysUnattached,
            baseProbability: f.base, tierMultiplier: f.tier, contractMultiplier: f.contract, freeAgentMultiplier: f.freeAgent,
              extremeAgeFloor: f.floor, floorBinds: f.floorBinds,
            probability, seedKey, roll, rollPassed: false, executed: false, blockedReason: null,
          });
        }
      }

      const beforeDecline = next;
      next = applyPlayerDecline(next, player.id, clubId, date, age, player.position);
      if (next !== beforeDecline) declinedPlayerIds.push(player.id);
    }
  }

  return { state: next, events, retiredPlayerIds, declinedPlayerIds, careerExitPlayerIds };
}
