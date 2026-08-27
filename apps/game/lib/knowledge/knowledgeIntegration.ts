// HM-DATA-ALLSVENSKAN-1.1B Parts 11/12/13: the ONE module that reads/
// writes CareerState for knowledge -- mirrors lib/economy/contractIntegration.ts's
// own "pure math below, CareerState glue here" split.
//
// Deliberately sparse storage: `clubKnowledge`/`playerKnowledge` only
// ever carry an entry for a club/player whose familiarity has moved
// AWAY from the default (own club/own players never need a stored row
// at all -- their knowledge is always the constant 100 via the
// `clubId === state.playerClubId` fast path; an external club/player
// nobody has ever specifically learned about needs no row either -- it
// simply reads as DEFAULT_EXTERNAL_KNOWLEDGE_PCT). This is what "never
// duplicate canonical player/club data in knowledge state" means in
// practice: a fresh career's knowledge maps start (and mostly stay)
// EMPTY, not pre-seeded with one row per club/player in the world.
import type { CareerState } from "../career/types";
import { clampKnowledgePct, DEFAULT_EXTERNAL_KNOWLEDGE_PCT, OWN_CLUB_KNOWLEDGE_PCT } from "./types";

/** The manager's own club is always fully known; an external club defaults to DEFAULT_EXTERNAL_KNOWLEDGE_PCT unless a stored (scouted/observed) value overrides it. */
export function getClubKnowledgePct(state: CareerState, clubId: string): number {
  if (clubId === state.playerClubId) return OWN_CLUB_KNOWLEDGE_PCT;
  return state.clubKnowledge[clubId] ?? DEFAULT_EXTERNAL_KNOWLEDGE_PCT;
}

/**
 * A player's own knowledge defaults to their CLUB's own knowledge level
 * (a player at a club you barely know is themselves barely known) --
 * unless a stored, player-SPECIFIC value exists (reserved for a future
 * scouting pass that learns about one player faster than their club in
 * general, e.g. an individually-scouted target). The manager's own
 * roster is always fully known, regardless of any stored value.
 */
export function getPlayerKnowledgePct(state: CareerState, playerId: string, clubId: string): number {
  if (clubId === state.playerClubId) return OWN_CLUB_KNOWLEDGE_PCT;
  return state.playerKnowledge[playerId] ?? getClubKnowledgePct(state, clubId);
}

/** The one write path for club knowledge -- reserved for a future scouting/observation source; not called by any gameplay system yet (Part: "Bygg inte hela scouting-systemet ännu"). */
export function setClubKnowledgePct(state: CareerState, clubId: string, pct: number): CareerState {
  const clamped = clampKnowledgePct(pct);
  if (state.clubKnowledge[clubId] === clamped) return state;
  return { ...state, clubKnowledge: { ...state.clubKnowledge, [clubId]: clamped } };
}

/** The one write path for player-specific knowledge (see getPlayerKnowledgePct's own doc on when this overrides the club default). */
export function setPlayerKnowledgePct(state: CareerState, playerId: string, pct: number): CareerState {
  const clamped = clampKnowledgePct(pct);
  if (state.playerKnowledge[playerId] === clamped) return state;
  return { ...state, playerKnowledge: { ...state.playerKnowledge, [playerId]: clamped } };
}
