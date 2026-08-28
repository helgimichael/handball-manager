// HM-RATINGS-0.6 Part B: the orchestration step that fills in a GAME
// PRIOR CA/PA (and, for outcourt players, an archetype role) for a
// player who still has no resolved CA after HM-RATINGS-0.3's proposal
// and HM-RATINGS-0.5's CA estimator have both run -- and fills in a
// game-prior PA for ANY player (calibrated, estimated, or generated)
// still missing one. Never overwrites an existing calibrated/estimated
// CA (Part A priority order: LOCKED/EDITOR > CALIBRATED > ESTIMATED >
// GENERATED_GAME_PRIOR -- this module only ever fills the bottom tier).
import { unassessedAbilityRating } from "../validators";
import { PA_MAX, PA_MIN, type AttackRole, type PlayerRatingClaim, type PlayerRatingProfile } from "../types";
import { assignArchetypeForPosition } from "./archetypeAssignment";
import { clubContextShift, populationTierForClub, resolveInternationalPopulationProfile } from "./clubContextTier";
import { generateGamePriorCA, generateGamePriorPA } from "./populationModel";
import { GAME_PRIOR_MODEL_VERSION } from "./types";
import type { RealWorldPlayerWorldPoolMetadata } from "../../gameWorld/realWorldLoader";

export interface GamePriorOutcome {
  profile: PlayerRatingProfile;
  /** True only when THIS module supplied the CA (i.e. it was still null going in). */
  gamePriorCAApplied: boolean;
  /** True when this module supplied PA -- independent of whether CA came from calibration, estimation, or this module. */
  gamePriorPAApplied: boolean;
  archetype: string | null;
}

function gamePriorRationaleClaim(playerId: string, clubShift: number, archetype: string): PlayerRatingClaim {
  return {
    id: `${playerId}-game-prior-ca`,
    playerId,
    evidenceClass: "UNASSESSED",
    domain: "GAME_PRIOR",
    key: "rationale",
    value: `No calibration or evidence-based estimate available -- a deterministic gameplay-representation CA/archetype (${archetype}) was generated instead (club context shift ${clubShift >= 0 ? "+" : ""}${clubShift}). This is a GAME ESTIMATE, never a researched fact.`,
    sourceRefs: [],
  };
}

export function applyGamePrior(
  profile: PlayerRatingProfile,
  clubId: string,
  modelVersion: string = GAME_PRIOR_MODEL_VERSION,
  worldPoolMetadata?: RealWorldPlayerWorldPoolMetadata | null,
): GamePriorOutcome {
  let working = profile;
  let gamePriorCAApplied = false;
  let archetype: string | null = null;

  const tier = populationTierForClub(clubId);
  // HM-WORLD-PLAYER-POOL-1.0: `null` for every non-international clubId
  // -- generateGamePriorCA/PA then fall straight back to the `tier`
  // lookup above, completely unchanged.
  const internationalProfile = resolveInternationalPopulationProfile(clubId, worldPoolMetadata ?? null);

  if (working.ca.value === null) {
    const shift = clubContextShift(clubId);
    const ca = generateGamePriorCA(working.playerId, shift, modelVersion, tier, internationalProfile ?? undefined);
    archetype = assignArchetypeForPosition(working.playerId, working.position, modelVersion);

    const extraClaims: PlayerRatingClaim[] = [gamePriorRationaleClaim(working.playerId, shift, archetype)];
    let attackRoleProficiencies = working.attackRoleProficiencies;
    let claims = [...working.claims, ...extraClaims];

    if (working.position === "GK") {
      claims = [...claims, { id: `${working.playerId}-gk-archetype`, playerId: working.playerId, evidenceClass: "UNASSESSED", domain: "ARCHETYPE", key: "gkArchetype", value: archetype, sourceRefs: [] }];
    } else {
      attackRoleProficiencies = [...attackRoleProficiencies, { role: archetype as AttackRole }];
    }

    working = {
      ...working,
      ca: { value: ca, confidence: "LOW", plausibleRange: { min: Math.max(1, ca - 25), max: Math.min(200, ca + 25) } },
      attackRoleProficiencies,
      claims,
    };
    gamePriorCAApplied = true;
  }

  let gamePriorPAApplied = false;
  if (working.pa.value === null && working.ca.value !== null) {
    const pa = generateGamePriorPA(working.playerId, working.ca.value, modelVersion, tier, internationalProfile ?? undefined);
    working = { ...working, pa: { value: pa, confidence: "LOW", plausibleRange: { min: Math.max(PA_MIN, pa - 20), max: Math.min(PA_MAX, pa + 20) } } };
    gamePriorPAApplied = true;
  } else if (working.pa.value === null) {
    // CA itself never got resolved (structurally impossible after the branch above, but keeps this function total) -- PA stays honestly unassessed.
    working = { ...working, pa: unassessedAbilityRating(PA_MIN, PA_MAX) };
  }

  return { profile: working, gamePriorCAApplied, gamePriorPAApplied, archetype };
}
