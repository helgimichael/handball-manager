// HM-RATINGS-0.5 Part I/J: the Editor's full CLUB -> PLAYER -> SOURCE
// EVIDENCE -> CA ESTIMATE -> PA -> GENERATED PROFILE -> REVIEW -> ADJUST
// -> LOCK workflow, composed server-side. This module is the ONLY place
// that ties together HM-RATINGS-0.3 (proposal), HM-RATINGS-0.5's CA
// estimator, HM-RATINGS-0.4's attribute generator, draft overrides, and
// locked state -- the normal (non-editor) Player Profile is completely
// unaffected and keeps using lib/gameWorld/ratingProposalSnapshot.ts,
// exactly as HM-UX-0.3 left it.
import { loadRealWorldClubSquad } from "../gameWorld/realWorldLoader";
import { applyCAEstimation } from "../rating/caEstimation/applyCAEstimation";
import type { CAProposal } from "../rating/caEstimation/types";
import { applyGamePrior } from "../rating/gamePrior/applyGamePrior";
import { generatePlayerRatingProfile } from "../rating/generation/generationEngine";
import { GENERATION_MODEL_VERSION } from "../rating/generation/types";
import type { GenerationResult } from "../rating/generation/types";
import { proposePlayerRating } from "../rating/pipeline/proposalEngine";
import type { GoalkeeperAttribute, OutcourtAttribute, PlayerRatingProfile } from "../rating/types";
import { loadRatingDatabase, type LockedPlayerRating, type RatingValueSource } from "./ratingDatabaseRepository";
import { loadRatingOverrideState, type PlayerRatingOverride } from "./ratingOverrideRepository";
import { loadRatingReviewState } from "./ratingReviewRepository";

export interface RatingWorkbenchRow {
  profile: PlayerRatingProfile;
  matchedCalibration: boolean;
  fullName: string;
  /** `null` when the player was already calibrated (HM-RATINGS-0.2) -- no estimation was needed or attempted. */
  caProposal: CAProposal | null;
  /** Where the profile's FINAL ca.value came from -- "UNRESOLVED" is not a lockable source, only shown for display. */
  caSource: RatingValueSource | "UNRESOLVED";
  override: PlayerRatingOverride | null;
  locked: LockedPlayerRating | null;
  /** HM-RATINGS-0.6: the archetype (existing AttackRole for outcourt, or one of 4 new GK archetypes) assigned when this player's CA had to fall back to a game prior -- `null` for calibrated/estimated players who already had real role/evidence data. */
  gamePriorArchetype: string | null;
  defaultStatus: string;
  status: string;
  note: string | null;
  reviewedAt: string | null;
  /** The complete HM-RATINGS-0.4 generated profile, with any editor attribute overrides applied on top (origin "EDITOR_OVERRIDE") -- PREVIEW ONLY, same as HM-RATINGS-0.4 Part G. */
  generatedPreview: GenerationResult;
}

export interface RatingWorkbenchClub {
  clubId: string;
  clubName: string;
  rows: RatingWorkbenchRow[];
}

function applyAttributeOverrides(generation: GenerationResult, overrides: Record<string, number> | undefined): GenerationResult {
  if (generation.status !== "OK" || !overrides || Object.keys(overrides).length === 0) return generation;

  const attributes = { ...generation.profile.branch.attributes } as Record<string, { value: number; origin: string }>;
  let overrideCount = 0;
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in attributes)) continue; // wrong branch for this player -- silently ignored here; setRatingOverride already rejects it at write time
    const wasOverride = attributes[key].origin === "EDITOR_OVERRIDE";
    attributes[key] = { value, origin: "EDITOR_OVERRIDE" };
    if (!wasOverride) overrideCount++;
  }

  const originCounts = { ...generation.profile.originCounts };
  // Every overridden attribute moves OUT of whichever origin bucket it
  // was in and INTO an editor-override count of its own for the UI's
  // BELAGT/HÄRLETT/GENERERAT/MANUELLT breakdown to stay accurate.
  const editorOverrideCount = (originCounts as Record<string, number>).EDITOR_OVERRIDE ?? 0;
  (originCounts as Record<string, number>).EDITOR_OVERRIDE = editorOverrideCount + overrideCount;

  return {
    status: "OK",
    profile: {
      ...generation.profile,
      branch: { ...generation.profile.branch, attributes } as typeof generation.profile.branch,
      originCounts,
    },
  };
}

function resolveCASource(matchedCalibration: boolean, hasOverrideCA: boolean, caProposal: CAProposal | null, gamePriorApplied: boolean): RatingValueSource | "UNRESOLVED" {
  if (hasOverrideCA) return "EDITOR_OVERRIDE";
  if (matchedCalibration) return "CALIBRATED";
  if (caProposal?.status === "ESTIMATED") return "MODEL_ESTIMATE";
  if (gamePriorApplied) return "GENERATED_GAME_PRIOR";
  return "UNRESOLVED";
}

/**
 * Composes the full workbench for one club's real roster. Returns
 * `null` for an unknown clubId. Every value is recomputed fresh on
 * every call -- nothing here is cached, matching every other rating
 * read path in this codebase (HM-RATINGS-0.3's own doc comment: "the
 * dataset is small, a cache is not worth the invalidation risk").
 */
export function buildRatingWorkbenchForClub(clubId: string): RatingWorkbenchClub | null {
  const squad = loadRealWorldClubSquad(clubId);
  if (!squad) return null;

  const reviewState = loadRatingReviewState(clubId);
  const overrideState = loadRatingOverrideState(clubId);
  const lockedState = loadRatingDatabase(clubId);

  const rows: RatingWorkbenchRow[] = squad.players.map((player) => {
    const { profile: proposedProfile, matchedCalibration } = proposePlayerRating(player);
    const { profile: estimatedProfile, caProposal } = applyCAEstimation(proposedProfile, player.fullName, matchedCalibration);
    const { profile: gamePriorProfile, gamePriorCAApplied, archetype } = applyGamePrior(estimatedProfile, clubId);

    const override = overrideState[player.playerId] ?? null;

    let finalProfile = gamePriorProfile;
    if (override?.ca !== undefined) {
      finalProfile = { ...finalProfile, ca: { value: override.ca, confidence: "HIGH", plausibleRange: { min: override.ca, max: override.ca } } };
    }
    if (override?.pa !== undefined) {
      finalProfile = { ...finalProfile, pa: { value: override.pa, confidence: "HIGH", plausibleRange: { min: override.pa, max: override.pa } } };
    }

    const generation = applyAttributeOverrides(generatePlayerRatingProfile(finalProfile), override?.attributeOverrides);

    const defaultStatus = matchedCalibration ? "PROPOSED" : caProposal?.status === "ESTIMATED" ? "PROPOSED" : "UNASSESSED";
    const review = reviewState[player.playerId];

    return {
      profile: finalProfile,
      matchedCalibration,
      fullName: player.fullName,
      caProposal,
      caSource: resolveCASource(matchedCalibration, override?.ca !== undefined, caProposal, gamePriorCAApplied),
      override,
      locked: lockedState[player.playerId] ?? null,
      gamePriorArchetype: gamePriorCAApplied ? archetype : null,
      defaultStatus,
      status: review?.status ?? defaultStatus,
      note: review?.note ?? null,
      reviewedAt: review?.updatedAt ?? null,
      generatedPreview: generation,
    };
  });

  return { clubId: squad.clubId, clubName: squad.clubName, rows };
}

export function buildRatingWorkbenchRowForPlayer(clubId: string, playerId: string): RatingWorkbenchRow | null {
  const club = buildRatingWorkbenchForClub(clubId);
  return club?.rows.find((r) => r.profile.playerId === playerId) ?? null;
}

/** Builds the exact LockedPlayerRating record a `lock` action should persist, from an already-computed workbench row. Returns `null` when the row's CA is UNRESOLVED -- a player cannot be locked without a resolved CA. */
export function buildLockedRecordFromRow(clubId: string, row: RatingWorkbenchRow, note: string | undefined): LockedPlayerRating | null {
  if (row.profile.ca.value === null || row.generatedPreview.status !== "OK") return null;

  return {
    playerId: row.profile.playerId,
    clubId,
    position: row.profile.position,
    ca: { value: row.profile.ca.value, confidence: row.profile.ca.confidence, plausibleRange: row.profile.ca.plausibleRange, source: row.caSource === "UNRESOLVED" ? "MODEL_ESTIMATE" : row.caSource },
    pa:
      row.profile.pa.value !== null
        ? {
            value: row.profile.pa.value,
            confidence: row.profile.pa.confidence,
            plausibleRange: row.profile.pa.plausibleRange,
            source: row.override?.pa !== undefined ? "EDITOR_OVERRIDE" : row.matchedCalibration ? "CALIBRATED" : row.caProposal?.status === "ESTIMATED" ? "MODEL_ESTIMATE" : "GENERATED_GAME_PRIOR",
          }
        : null,
    branch: row.generatedPreview.profile.branch,
    attackRoleProficiencies: row.profile.attackRoleProficiencies,
    defenceRoleProficiencies: row.profile.defenceRoleProficiencies,
    caEstimationModelVersion: row.caProposal?.modelVersion ?? null,
    attributeGenerationModelVersion: GENERATION_MODEL_VERSION,
    lockedAt: new Date().toISOString(),
    ...(note ? { lockedNote: note } : {}),
  };
}

export type { OutcourtAttribute, GoalkeeperAttribute };
