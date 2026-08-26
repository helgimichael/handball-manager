// HM-RATINGS-CAREER-1.0: the universal career-rating GUARANTEE -- "if a
// player exists in a playable CareerWorld roster, that player has
// exactly one usable GameplayPlayerRating" (Part 2). This is the ONE
// place that decides whether a roster player needs a rating generated;
// every caller (newCareer.ts, saveMigration.ts, and any future
// SIGN_PLAYER/LOAN/YOUTH_INTAKE hook -- Part 24) goes through here so
// the guarantee can never drift out of sync between call sites.
import { generateFallbackGameplayRating } from "../rating/generation/careerFallbackRating";
import { mapHandballPositionToMatchPlanPosition } from "../matchPlan/careerSquadBridge";
import { getCareerClubSquad } from "./careerWorld";
import type { CareerState } from "./types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";

/**
 * Part 13/23: fills ONLY the missing roster-player ratings for `clubId`
 * -- an existing entry (evidence-backed OR already-developed) is never
 * touched, never regenerated, never duplicated. Idempotent: calling
 * this twice in a row is a no-op the second time (Part 23's own
 * requirement). Returns `state` unchanged (same reference) when nothing
 * was missing, so callers can cheaply check `result === state`.
 */
export function ensureCareerGameplayRatings(state: CareerState, clubId: string): CareerState {
  const squad = getCareerClubSquad(state, clubId);
  if (squad.length === 0) return state;

  const existing = state.gameplayRatings[clubId] ?? [];
  const existingIds = new Set(existing.map((r) => r.playerId));
  const missing = squad.filter((p) => !existingIds.has(p.id));
  if (missing.length === 0) return state;

  const generated: GameplayPlayerRating[] = missing.map((p) => generateFallbackGameplayRating(p.id, mapHandballPositionToMatchPlanPosition(p.position)));

  return { ...state, gameplayRatings: { ...state.gameplayRatings, [clubId]: [...existing, ...generated] } };
}

/**
 * Part 12: the one lookup abstraction for "this player's own career
 * rating" -- reserved so a future transfer/loan milestone can change how
 * `gameplayRatings` is keyed (today: `Record<clubId, GameplayPlayerRating[]>`)
 * without every call site needing to know the storage shape. When
 * `clubId` is omitted, scans every club this career knows about (same
 * "own club first, then scan the rest" precedent as
 * careerWorld.ts's own `getCareerPlayer`) -- correct today (a playerId
 * is never duplicated across two clubs' rosters, Part F/13) and remains
 * correct once transfers exist (a transferred player's rating moves
 * with them to their new club's own array, this function just needs to
 * find whichever club currently lists them).
 */
export function getCareerPlayerRating(state: CareerState, playerId: string, clubId?: string): GameplayPlayerRating | undefined {
  if (clubId) {
    return state.gameplayRatings[clubId]?.find((r) => r.playerId === playerId);
  }
  const ownClub = state.gameplayRatings[state.playerClubId]?.find((r) => r.playerId === playerId);
  if (ownClub) return ownClub;
  for (const otherClubId of Object.keys(state.gameplayRatings)) {
    if (otherClubId === state.playerClubId) continue;
    const found = state.gameplayRatings[otherClubId].find((r) => r.playerId === playerId);
    if (found) return found;
  }
  return undefined;
}
