// HM-PLAYER-DATA-EDITOR-1.0: the ONE combined "calibrate this player's
// CA/PA and make it actually count" write path -- exactly the same two
// steps `app/api/editor/ratings/players/[playerId]/override/route.ts`
// (PUT) and `.../lock/route.ts` (PUT) already perform, called back to
// back, so a bulk calibration pass never needs a separate "now go lock
// everything you just overrode" click per player.
//
// Root cause this exists to close (see gameplayRatingSnapshot.ts's own
// header): a draft override alone is NEVER read by
// snapshotGameplayRatingsForClub (the resolver fresh careers actually
// consume) -- only a LOCKED record is. Writing just the draft would
// silently do nothing to gameplay. This module is the one place that
// composes draft-override + lock into a single call, reusing
// setRatingOverride/buildRatingWorkbenchRowForPlayer/
// buildLockedRecordFromRow/lockPlayerRating verbatim -- no new
// resolution logic, no parallel database.
import { setRatingOverride } from "./ratingOverrideRepository";
import { buildLockedRecordFromRow, buildRatingWorkbenchRowForPlayer } from "./ratingWorkbench";
import { lockPlayerRating, type LockedPlayerRating } from "./ratingDatabaseRepository";
import { setReviewStatus } from "./ratingReviewRepository";
import { DEFAULT_DATA_ROOT } from "./paths";
import type { Position } from "../rating/types";
import type { CanonicalPosition } from "./schema";

/**
 * The rating domain's own Position type ("GK" for goalkeeper, per
 * lib/rating/types.ts) and the roster-editing schema's CanonicalPosition
 * ("MV" for goalkeeper, per schema.ts's own CANONICAL_POSITIONS) use
 * different codes for the SAME position -- confirmed by audit, not an
 * inconsistency this milestone introduces. Every other code (M9/V9/H9/
 * M6/V6/H6) is identical between the two vocabularies.
 */
export function toRatingPosition(rosterPosition: CanonicalPosition): Position {
  return rosterPosition === "MV" ? "GK" : rosterPosition;
}

export interface CalibratePlayerRatingResult {
  ok: boolean;
  errors: string[];
  record: LockedPlayerRating | null;
}

/**
 * `ca`/`pa` are optional -- pass only what actually changed (mirrors
 * setRatingOverride's own targeted-merge contract, so calibrating CA
 * this call and PA next call never clobbers the other). Omitting both
 * still re-locks the player against their CURRENT resolved profile
 * (proposal/estimate/game-prior + any prior override) -- useful for a
 * bulk "lock everyone I've touched" sweep without re-sending unchanged
 * numbers.
 */
export function calibratePlayerRating(
  clubId: string,
  playerId: string,
  position: Position,
  ca: number | undefined,
  pa: number | undefined,
  note?: string,
  dataRoot: string = DEFAULT_DATA_ROOT,
): CalibratePlayerRatingResult {
  if (ca !== undefined || pa !== undefined) {
    const overrideResult = setRatingOverride({ clubId, playerId, position, ca, pa }, dataRoot);
    if (!overrideResult.ok) {
      return { ok: false, errors: overrideResult.errors, record: null };
    }
  }

  const row = buildRatingWorkbenchRowForPlayer(clubId, playerId, dataRoot);
  if (!row) {
    return { ok: false, errors: [`unknown clubId "${clubId}" or playerId "${playerId}"`], record: null };
  }

  const record = buildLockedRecordFromRow(clubId, row, note);
  if (!record) {
    return { ok: false, errors: ["cannot lock a player with unresolved CA"], record: null };
  }

  const lockResult = lockPlayerRating(clubId, record, dataRoot);
  if (!lockResult.ok) {
    return { ok: false, errors: lockResult.errors, record: null };
  }

  setReviewStatus(clubId, playerId, "LOCKED", note, dataRoot);
  return { ok: true, errors: [], record };
}
