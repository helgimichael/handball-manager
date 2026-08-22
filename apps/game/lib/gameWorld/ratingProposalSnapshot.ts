// HM-UX-0.3: the ONE shared translation from lib/rating/pipeline's
// per-club batch result into the plain JSON shape both the normal
// Player Profile (app/api/game-world/rating-proposals/clubs/[clubId])
// and the Editor's Rating Review workspace
// (app/api/editor/ratings/clubs/[clubId]) return -- "Gustav's normal
// profile and Editor read the same rating proposal source" is enforced
// by construction here, not by two independently-written mappings that
// could drift apart.
//
// Server-only (touches the filesystem transitively via
// lib/rating/pipeline -> gameWorld/realWorldLoader.ts) -- never import
// this from client-bundled code, only from a Route Handler.
import { runRatingPipelineForClub } from "../rating/pipeline";
import type { PlayerRatingProfile } from "../rating/types";

export interface RatingProposalRow {
  profile: PlayerRatingProfile;
  /** Whether this profile was adopted from a HM-RATINGS-0.2 calibration match, vs. left fully unresolved. */
  matchedCalibration: boolean;
}

export interface RatingProposalSnapshot {
  clubId: string;
  clubName: string | null;
  players: RatingProposalRow[];
  unresolvedPositionCount: number;
  invalidProfileCount: number;
}

/** `clubName: null` means the clubId didn't resolve to an importable real-world roster -- callers should treat this as "not found", never invent a snapshot for it. */
export function snapshotClubRatingProposals(clubId: string): RatingProposalSnapshot {
  const result = runRatingPipelineForClub(clubId);
  const players: RatingProposalRow[] = result.profiles.map((profile) => ({
    profile,
    matchedCalibration: result.matchedCalibrationPlayerIds.has(profile.playerId),
  }));
  return {
    clubId: result.clubId,
    clubName: result.clubName,
    players,
    unresolvedPositionCount: result.unresolvedPositionCount,
    invalidProfileCount: result.invalidProfileCount,
  };
}
