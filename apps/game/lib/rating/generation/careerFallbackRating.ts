// HM-RATINGS-CAREER-1.0: the universal fallback rating generator -- the
// SAME game-prior -> generation chain gameplayRatingSnapshot.ts already
// runs for a REAL_WORLD player with zero resolved evidence (Part 3: "do
// not build a second rating system"), just entered directly from an
// empty-evidence PlayerRatingProfile instead of a filesystem-loaded one.
//
// Deliberately does NOT import lib/rating/gamePrior/applyGamePrior.ts --
// that module (transitively, via clubContextTier.ts ->
// gameWorld/clubIdentityLoader.ts) touches the filesystem, and this
// function must stay callable from client code (lib/career/newCareer.ts
// is "pure, filesystem-free ... safe to call from client code", and
// this is its own new dependency). Every OTHER building block used here
// (generateGamePriorCA/PA, assignArchetypeForPosition,
// generatePlayerRatingProfile, unassessedAbilityRating) is already
// confirmed pure/fs-free -- only the per-club season-context SHIFT is
// skipped (fixed at 0), which is exactly what a real-world club with no
// season-identity file already gets (clubContextShift's own honest
// "no evidence" default, per its own doc comment) -- so this produces
// IDENTICAL output to the real pipeline for any club without season
// data, and a mock/generated club never has one.
import { unassessedAbilityRating } from "../validators";
import { CA_MAX, CA_MIN, PA_MAX, PA_MIN, type AttackRole, type PlayerRatingClaim, type PlayerRatingProfile, type Position } from "../types";
import { assignArchetypeForPosition } from "../gamePrior/archetypeAssignment";
import { generateGamePriorCA, generateGamePriorPA, type PopulationTier } from "../gamePrior/populationModel";
import { GAME_PRIOR_MODEL_VERSION } from "../gamePrior/types";
import { generatePlayerRatingProfile } from "./generationEngine";
import { GENERATION_MODEL_VERSION } from "./types";
import type { RatingValueSource } from "../../editor/ratingDatabaseRepository";
import type { GameplayPlayerRating } from "../../gameWorld/gameplayRatingSnapshot";

/** The exact same rationale-claim shape applyGamePrior.ts's own gamePriorRationaleClaim produces, so a generated career player's claims read identically to a generated real-world player's. */
function gamePriorRationaleClaim(playerId: string, archetype: string): PlayerRatingClaim {
  return {
    id: `${playerId}-game-prior-ca`,
    playerId,
    evidenceClass: "UNASSESSED",
    domain: "GAME_PRIOR",
    key: "rationale",
    value: `No calibration or evidence available -- a deterministic gameplay-representation CA/archetype (${archetype}) was generated instead. This is a GAME ESTIMATE, never a researched fact.`,
    sourceRefs: [],
  };
}

function emptyEvidenceProfile(playerId: string, position: Position): PlayerRatingProfile {
  return {
    playerId,
    position,
    physicalProfile: {},
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    phaseAbilities: [],
    usage: { attackUsageShare: 0, defenceUsageShare: 0, transitionUsageShare: 0 },
    utility: { utility: 0, positionalFlexibility: 0 },
    ca: unassessedAbilityRating(CA_MIN, CA_MAX),
    pa: unassessedAbilityRating(PA_MIN, PA_MAX),
    claims: [],
  };
}

/**
 * Part 5/6/7/8: generates a COMPLETE, deterministic GameplayPlayerRating
 * for one player with no evidence-backed profile at all -- reused
 * identically for mock and generated players (Part 2: no runtime
 * difference between REAL_WORLD/MOCK/GENERATED). Deterministic in
 * (playerId, position) alone -- never the player's name, never
 * Math.random -- so the same career/world/seed always produces the same
 * starting rating (Part 5).
 */
export function generateFallbackGameplayRating(playerId: string, position: Position, tier: PopulationTier = "STANDARD"): GameplayPlayerRating {
  let profile = emptyEvidenceProfile(playerId, position);

  const ca = generateGamePriorCA(playerId, 0, GAME_PRIOR_MODEL_VERSION, tier);
  const archetype = assignArchetypeForPosition(playerId, position, GAME_PRIOR_MODEL_VERSION);
  const extraClaims: PlayerRatingClaim[] = [gamePriorRationaleClaim(playerId, archetype)];
  let attackRoleProficiencies = profile.attackRoleProficiencies;
  let claims = [...profile.claims, ...extraClaims];
  if (position === "GK") {
    claims = [...claims, { id: `${playerId}-gk-archetype`, playerId, evidenceClass: "UNASSESSED", domain: "ARCHETYPE", key: "gkArchetype", value: archetype, sourceRefs: [] }];
  } else {
    attackRoleProficiencies = [...attackRoleProficiencies, { role: archetype as AttackRole }];
  }
  profile = { ...profile, ca: { value: ca, confidence: "LOW", plausibleRange: { min: Math.max(1, ca - 25), max: Math.min(200, ca + 25) } }, attackRoleProficiencies, claims };

  // Part 8: PA is always CA-plus-a-small-non-negative-offset here (populationModel.ts's own invariant), so PA >= CA structurally, never regenerated independently later.
  const pa = generateGamePriorPA(playerId, ca, GAME_PRIOR_MODEL_VERSION, tier);
  profile = { ...profile, pa: { value: pa, confidence: "LOW", plausibleRange: { min: Math.max(PA_MIN, pa - 20), max: Math.min(PA_MAX, pa + 20) } } };

  const generation = generatePlayerRatingProfile(profile);
  const branch = generation.status === "OK" ? generation.profile.branch : { branch: "OUTCOURT" as const, attributes: {} as never };
  const caSource: RatingValueSource = "GENERATED_GAME_PRIOR";

  return {
    playerId,
    position,
    ca,
    pa,
    caSource,
    branch,
    attackRoleProficiencies,
    defenceRoleProficiencies: profile.defenceRoleProficiencies,
    attributeGenerationModelVersion: GENERATION_MODEL_VERSION,
    locked: false,
  };
}
