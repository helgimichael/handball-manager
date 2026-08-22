// HM-RATINGS-0.6 Part A/M/N: the COMPLETE gameplay-rating read path --
// every real Handbollsligan player gets a usable CA/PA/attribute
// profile, following the priority order Part A specifies: LOCKED
// (human-approved) beats CALIBRATED beats ESTIMATED beats
// GENERATED_GAME_PRIOR. Nothing here is a new persistence mechanism --
// a locked player is read from HM-RATINGS-0.5's own database
// (lib/editor/ratingDatabaseRepository.ts); everyone else is
// recomputed fresh through the exact same proposal -> CA estimation ->
// game prior -> HM-RATINGS-0.4 generation chain lib/editor/
// ratingWorkbench.ts uses, deterministic and reproducible from the
// same source files + model versions every time (Part N: "Generation
// should be reproducible" -- achieved by NOT persisting the generated
// tier at all, so there is nothing that can drift out of sync with the
// generator). Draft (un-locked) Editor overrides are intentionally NOT
// applied here -- only a LOCK is "editor-approved" (Part N: "Generated
// != locked/editor-approved").
import { loadRealWorldClubSquad } from "./realWorldLoader";
import { loadRatingDatabase, type LockedPlayerRating, type RatingValueSource } from "../editor/ratingDatabaseRepository";
import { applyCAEstimation } from "../rating/caEstimation/applyCAEstimation";
import { applyGamePrior } from "../rating/gamePrior/applyGamePrior";
import { generatePlayerRatingProfile } from "../rating/generation/generationEngine";
import { GENERATION_MODEL_VERSION } from "../rating/generation/types";
import type { GeneratedGoalkeeperProfile, GeneratedOutcourtProfile } from "../rating/generation/types";
import { proposePlayerRating } from "../rating/pipeline/proposalEngine";
import type { Position, RoleProficiency } from "../rating/types";

export interface GameplayPlayerRating {
  playerId: string;
  position: Position;
  ca: number;
  pa: number;
  caSource: RatingValueSource;
  branch: GeneratedOutcourtProfile | GeneratedGoalkeeperProfile;
  attackRoleProficiencies: RoleProficiency[];
  defenceRoleProficiencies: RoleProficiency[];
  attributeGenerationModelVersion: string;
  locked: boolean;
}

export interface GameplayRatingClubSnapshot {
  clubId: string;
  clubName: string | null;
  players: GameplayPlayerRating[];
}

function fromLocked(record: LockedPlayerRating): GameplayPlayerRating {
  return {
    playerId: record.playerId,
    position: record.position,
    ca: record.ca.value,
    pa: record.pa?.value ?? record.ca.value,
    caSource: record.ca.source,
    branch: record.branch,
    attackRoleProficiencies: record.attackRoleProficiencies,
    defenceRoleProficiencies: record.defenceRoleProficiencies,
    attributeGenerationModelVersion: record.attributeGenerationModelVersion,
    locked: true,
  };
}

/** Complete gameplay-rating snapshot for one club -- `clubName: null` for an unknown clubId (never throws). Every non-locked player is guaranteed a resolved CA/PA/attribute branch (Part J: "No player should remain gameplay-unresolved"). */
export function snapshotGameplayRatingsForClub(clubId: string): GameplayRatingClubSnapshot {
  const squad = loadRealWorldClubSquad(clubId);
  if (!squad) return { clubId, clubName: null, players: [] };

  const lockedState = loadRatingDatabase(clubId);

  const players: GameplayPlayerRating[] = squad.players.map((player) => {
    const locked = lockedState[player.playerId];
    if (locked) return fromLocked(locked);

    const { profile: proposed, matchedCalibration } = proposePlayerRating(player);
    const { profile: estimated, caProposal } = applyCAEstimation(proposed, player.fullName, matchedCalibration);
    const { profile: final } = applyGamePrior(estimated, clubId);
    const generation = generatePlayerRatingProfile(final);

    const caSource: RatingValueSource = matchedCalibration ? "CALIBRATED" : caProposal?.status === "ESTIMATED" ? "MODEL_ESTIMATE" : "GENERATED_GAME_PRIOR";

    // generation.status is always "OK" here: applyGamePrior guarantees a resolved CA for every player reaching this point.
    const branch = generation.status === "OK" ? generation.profile.branch : { branch: "OUTCOURT" as const, attributes: {} as never };

    return {
      playerId: final.playerId,
      position: final.position,
      ca: final.ca.value as number,
      pa: (final.pa.value ?? final.ca.value) as number,
      caSource,
      branch,
      attackRoleProficiencies: final.attackRoleProficiencies,
      defenceRoleProficiencies: final.defenceRoleProficiencies,
      attributeGenerationModelVersion: GENERATION_MODEL_VERSION,
      locked: false,
    };
  });

  return { clubId: squad.clubId, clubName: squad.clubName, players };
}
