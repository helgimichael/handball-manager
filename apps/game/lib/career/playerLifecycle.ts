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
//     creates correctness or severe decision pathology" -- audited via
//     simulation, see this milestone's own final report; no pathology
//     found).
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
import { FREE_AGENT_CLUB_ID, isFreeAgentClubId } from "./contractExpiry";
import { buildPlayerRetiredEvent, type CareerEvent } from "./careerEvents";
import { computeProfessionalCareerExitProbability, professionalCareerExitRoll } from "./professionalCareerExit";
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES } from "../rating/types";
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
];

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
  base: number; tier: number; contract: number; freeAgent: number;
} {
  return {
    base: baseRetirementProbability(inputs.age, inputs.isGoalkeeper),
    tier: TIER_RETIREMENT_MULTIPLIER[inputs.tier],
    contract: contractSituationMultiplier(inputs.contractStatus),
    freeAgent: isFreeAgentStatus(inputs.contractStatus) ? freeAgentDurationMultiplier(inputs.daysUnattached) : 1.0,
  };
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
  return clamp(base * tierMult * contractMult * faMult, 0, 0.98);
}

function isFreeAgentStatus(status: ContractStatus | undefined): boolean {
  return status === "FREE_AGENT";
}

// ---------------------------------------------------------------------------
// Part 9/10/11: decline model.
// ---------------------------------------------------------------------------

/** Part 9/11: expected (fractional) decline POINTS by effective age -- interpolated smoothly, then probabilistically rounded (Part 3-style anchors, reused for decline). Conservative magnitude (Part 11): stays within [0,3] even at extreme ages. */
const DECLINE_AGE_ANCHORS: readonly (readonly [number, number])[] = [
  [31, 0],
  [34, 0.3],
  [37, 1.0],
  [40, 2.0],
  [43, 2.8],
];

function expectedDeclinePoints(age: number, isGoalkeeper: boolean): number {
  return interpolate(DECLINE_AGE_ANCHORS, effectiveAge(age, isGoalkeeper));
}

/** Deterministic probabilistic rounding of a fractional expected value into an integer point count -- e.g. expected=1.4 rounds down to 1 with 60% (seeded) probability, up to 2 with 40%. */
function declinePointsForPlayer(seedKey: string, age: number, isGoalkeeper: boolean): number {
  const expected = expectedDeclinePoints(age, isGoalkeeper);
  const floor = Math.floor(expected);
  const fractional = expected - floor;
  const roll = seededProbability(`${seedKey}:decline-magnitude`);
  const points = roll < fractional ? floor + 1 : floor;
  return clamp(points, 0, 3);
}

/** Deterministically picks up to `count` DISTINCT attributes from the player's own branch vocabulary that are still above ATTRIBUTE_MIN (a maxed-out floor attribute cannot decline further -- same "already at cap, no-op" precedent resolveAttributeForWeek's own growth path already uses, just the floor side). */
function pickDeclineAttributes(seedKey: string, branch: "OUTCOURT" | "GOALKEEPER", count: number, attributes: Record<string, { value: number; origin: string }>): DevelopableAttribute[] {
  const pool = branch === "GOALKEEPER" ? GOALKEEPER_ATTRIBUTES : OUTCOURT_ATTRIBUTES;
  const eligible = pool.filter((attr) => (attributes[attr]?.value ?? ATTRIBUTE_MIN) > ATTRIBUTE_MIN);
  if (eligible.length === 0) return [];
  const chosen: DevelopableAttribute[] = [];
  const chosenSet = new Set<string>();
  let attempt = 0;
  const target = Math.min(count, eligible.length);
  while (chosen.length < target && attempt < eligible.length * 4) {
    const candidate = eligible[seededIndex(`${seedKey}:decline-attr:${attempt}`, eligible.length)];
    if (!chosenSet.has(candidate)) {
      chosenSet.add(candidate);
      chosen.push(candidate);
    }
    attempt++;
  }
  return chosen;
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
function applyPlayerDecline(state: CareerState, playerId: string, clubId: string, date: string, age: number, isGoalkeeper: boolean): CareerState {
  const rating = state.gameplayRatings[clubId]?.find((r) => r.playerId === playerId);
  if (!rating) return state;

  const seedKey = `${playerId}:${date.slice(0, 4)}:decline`;
  const points = declinePointsForPlayer(seedKey, age, isGoalkeeper);
  if (points === 0) return state;

  const attributes = rating.branch.attributes as unknown as Record<string, { value: number; origin: string }>;
  const chosenAttrs = pickDeclineAttributes(seedKey, rating.branch.branch, points, attributes);
  if (chosenAttrs.length === 0) return state;

  const nudge = caNudgePerAttributePoint(rating.branch.branch);
  const changes = chosenAttrs.map((attribute) => {
    const current = attributes[attribute]?.value ?? ATTRIBUTE_MIN;
    const newValue = clamp(current - 1, ATTRIBUTE_MIN, ATTRIBUTE_MAX);
    return { attribute, newValue, caDelta: (newValue - current) * nudge };
  });
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
  const clubIds = [...careerWorldClubIds(next), FREE_AGENT_CLUB_ID];

  for (const clubId of clubIds) {
    const squad = next.worldSquads[clubId] ?? [];
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
        const probability = computeRetirementProbability({ age, isGoalkeeper, tier, contractStatus: status, daysUnattached });
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
            probability, seedKey, roll, rollPassed: false, executed: false, blockedReason: null,
          });
        }
      }

      const beforeDecline = next;
      next = applyPlayerDecline(next, player.id, clubId, date, age, isGoalkeeper);
      if (next !== beforeDecline) declinedPlayerIds.push(player.id);
    }
  }

  return { state: next, events, retiredPlayerIds, declinedPlayerIds, careerExitPlayerIds };
}
