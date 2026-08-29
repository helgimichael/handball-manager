// HM-TRANSFERS-1.0: the ONE place that actually moves a player between
// clubs -- reused by permanent transfers, loan starts, and loan
// returns. Everything else in this domain (offers, decisions,
// affordability) is a pure judgement layer around this mutation.
//
// Reuses the flat, playerId-keyed stores every prior milestone already
// established (playerContracts, playerClubHistory, playerDevelopmentState,
// playerPhysicalState, playerInjuries, playerSeasonStats) -- NONE of
// those need to move on a transfer, since they were never club-keyed in
// the first place (Part: "canonical rating/development följer
// spelaren" falls out of the existing data model for free). Only THREE
// things are actually club-keyed and need moving: (1) worldSquads
// membership, (2) gameplayRatings, (3) PlayerContract.clubId/wage.
import { getClub, getCompetition, type PlayerMock } from "../game-data";
import { getCareerClubSquad, getCareerPlayer } from "../career/careerWorld";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { generateContractEndDate } from "../economy/contractGeneration";
import type { CareerState } from "../career/types";
import type { PlayerContract, PlayerClubHistoryEntry } from "../economy/types";

/**
 * Materializes a club's squad into `worldSquads` if it's still only
 * backed by the legacy static fallback (Tumba's TUMBA_SQUAD import) --
 * a real, mutable per-save copy is required before any player can be
 * spliced in/out. True no-op (same reference) once already materialized.
 * Mirrors the ensureCareer*'s established "fill once, idempotent" shape.
 */
function ensureCareerWorldSquad(state: CareerState, clubId: string): CareerState {
  if (state.worldSquads[clubId]) return state;
  const squad = getCareerClubSquad(state, clubId);
  if (squad.length === 0) return state;
  return { ...state, worldSquads: { ...state.worldSquads, [clubId]: [...squad] } };
}

/**
 * Splices `player` (with `clubId` already reassigned) out of
 * `fromClubId`'s materialized squad and into `toClubId`'s. Both squads
 * must already be materialized by the caller. HM-CPU-SQUAD-BUILDING-1.0B
 * Part 3: `toSquad` is built by filtering out any pre-existing entry for
 * this playerId FIRST -- a defensive squad-uniqueness invariant (never
 * more than one entry per playerId per squad) that holds even if this
 * were ever called twice for the same move, on top of (not instead of)
 * the callers' own canonical ownership guards above.
 */
function moveSquadMembership(state: CareerState, player: PlayerMock, fromClubId: string, toClubId: string): CareerState {
  const movedPlayer: PlayerMock = { ...player, clubId: toClubId };
  const fromSquad = (state.worldSquads[fromClubId] ?? []).filter((p) => p.id !== player.id);
  const toSquad = [...(state.worldSquads[toClubId] ?? []).filter((p) => p.id !== player.id), movedPlayer];
  return { ...state, worldSquads: { ...state.worldSquads, [fromClubId]: fromSquad, [toClubId]: toSquad } };
}

/** Moves the player's own GameplayPlayerRating entry (if any) from one club's array to another's -- the rating object itself carries no clubId, only the outer Record key does. */
function moveGameplayRating(state: CareerState, playerId: string, fromClubId: string, toClubId: string): CareerState {
  const fromRatings = state.gameplayRatings[fromClubId];
  if (!fromRatings) return state;
  const rating = fromRatings.find((r) => r.playerId === playerId);
  if (!rating) return state;
  const nextFrom = fromRatings.filter((r) => r.playerId !== playerId);
  const nextTo = [...(state.gameplayRatings[toClubId] ?? []), rating];
  return { ...state, gameplayRatings: { ...state.gameplayRatings, [fromClubId]: nextFrom, [toClubId]: nextTo } };
}

/**
 * Appends a real, non-generated club-history entry for the club the
 * player is LEAVING -- ownership genuinely changed, unlike the
 * generated youth history (clubHistoryGeneration.ts), which only ever
 * covers ages 12-18. `fromAge` continues from the player's existing
 * history (its last `toAge`) or falls back to 18 (the youth generator's
 * own latest-handover age) if this is their first tracked club-history
 * entry -- an honest "we don't know exactly when they joined" fallback,
 * never invented precision. Never called for a LOAN (ownership doesn't
 * change -- see loanPlayerOut's own doc).
 */
function appendClubHistoryEntry(state: CareerState, playerId: string, departingClubId: string, ageNow: number | null): CareerState {
  if (ageNow === null) return state;
  const existing = state.playerClubHistory[playerId] ?? { playerId, entries: [] };
  const lastToAge = existing.entries.length > 0 ? existing.entries[existing.entries.length - 1].toAge : 18;
  const fromAge = Math.min(lastToAge, ageNow);
  const toAge = Math.max(ageNow, fromAge + 1); // clampYears-style: never a zero/negative span.
  const entry: PlayerClubHistoryEntry = { clubId: departingClubId, fromAge, toAge };
  return { ...state, playerClubHistory: { ...state.playerClubHistory, [playerId]: { playerId, entries: [...existing.entries, entry] } } };
}

/** A fresh multi-year deal, anchored `years` seasons out -- reuses the exact same deterministic spread contractGeneration.ts already uses for initial contracts, never a bare hardcoded date. */
export function computeNewContractEndDate(playerId: string, gameDate: string, years: number): string {
  const currentYear = Number(gameDate.slice(0, 4));
  const fallbackYear = currentYear + years;
  return generateContractEndDate(playerId, `${fallbackYear - 1}/${String(fallbackYear).slice(-2)}`, fallbackYear);
}

/**
 * Part: "en permanent värvning ska skapa ett nytt persistent kontrakt"
 * -- ownership genuinely changes: squad membership, rating, contract
 * (new clubId/wage/end date), and club history (a real entry for the
 * departing club) all move/update together.
 */
export function transferPlayerPermanently(state: CareerState, playerId: string, fromClubId: string, toClubId: string, newWageEurPerMonth: number, newContractEndDate: string): CareerState {
  const player = getCareerPlayer(state, playerId);
  // HM-CPU-SQUAD-BUILDING-1.0B Part 2: canonical ownership guard -- never
  // trust a caller-supplied `fromClubId` blindly. If the player no longer
  // actually belongs to that club (e.g. a stale offer executing after
  // they already moved via a different deal), this is a silent no-op --
  // protects every caller (CPU and human alike), not just the offer
  // layer above it. See progressDailyTransfers for the explicit
  // stale-offer cancellation this guard backs up.
  if (!player || player.clubId !== fromClubId) return state;

  let next = ensureCareerWorldSquad(state, fromClubId);
  next = ensureCareerWorldSquad(next, toClubId);
  next = moveSquadMembership(next, player, fromClubId, toClubId);
  next = moveGameplayRating(next, playerId, fromClubId, toClubId);

  const newContract: PlayerContract = { playerId, clubId: toClubId, contractEndDate: newContractEndDate, wageEurPerMonth: newWageEurPerMonth };
  next = { ...next, playerContracts: { ...next.playerContracts, [playerId]: newContract } };

  const ageNow = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate);
  next = appendClubHistoryEntry(next, playerId, fromClubId, ageNow);

  return next;
}

/**
 * Part: "no permanent ownership change... spelaren spelar för
 * låneklubben under perioden men behåller sin career identity, rating,
 * development och history." Squad/rating move to the borrowing club
 * (so match-day squad selection and wage-cost derivation correctly
 * treat them as part of it) and the contract's own wage is reduced to
 * the BORROWING club's own share for the loan's duration -- club
 * history is deliberately NOT touched (a loan spell is not an
 * ownership change, Part: avoid invented precision about "did this
 * count as a real club").
 */
export function loanPlayerOut(state: CareerState, playerId: string, parentClubId: string, borrowingClubId: string, wageShareBorrowingPct: number): CareerState {
  const player = getCareerPlayer(state, playerId);
  const contract = state.playerContracts[playerId];
  // Canonical ownership guard -- see transferPlayerPermanently's own doc.
  if (!player || !contract || player.clubId !== parentClubId) return state;

  let next = ensureCareerWorldSquad(state, parentClubId);
  next = ensureCareerWorldSquad(next, borrowingClubId);
  next = moveSquadMembership(next, player, parentClubId, borrowingClubId);
  next = moveGameplayRating(next, playerId, parentClubId, borrowingClubId);

  const shareWage = Math.round((contract.wageEurPerMonth * wageShareBorrowingPct) / 100);
  const loanContract: PlayerContract = { ...contract, clubId: borrowingClubId, wageEurPerMonth: shareWage };
  next = { ...next, playerContracts: { ...next.playerContracts, [playerId]: loanContract } };

  return next;
}

/** The exact inverse of loanPlayerOut -- restores squad/rating/contract to the parent club, using the LoanRecord's own preserved originalWageEurPerMonth (never re-derived). */
export function returnPlayerFromLoan(state: CareerState, playerId: string, parentClubId: string, borrowingClubId: string, originalWageEurPerMonth: number, originalContractEndDate: string): CareerState {
  const player = getCareerPlayer(state, playerId);
  // Canonical ownership guard -- see transferPlayerPermanently's own doc.
  if (!player || player.clubId !== borrowingClubId) return state;

  let next = ensureCareerWorldSquad(state, borrowingClubId);
  next = ensureCareerWorldSquad(next, parentClubId);
  next = moveSquadMembership(next, player, borrowingClubId, parentClubId);
  next = moveGameplayRating(next, playerId, borrowingClubId, parentClubId);

  const restoredContract: PlayerContract = { playerId, clubId: parentClubId, contractEndDate: originalContractEndDate, wageEurPerMonth: originalWageEurPerMonth };
  next = { ...next, playerContracts: { ...next.playerContracts, [playerId]: restoredContract } };

  return next;
}

/** Convenience -- Competition.tier for a club, the same lookup contractIntegration.ts's own buildEconomyProfileInputs already relies on. */
export function competitionTierForClub(clubId: string): 1 | 2 | undefined {
  return getCompetition(getClub(clubId)?.competitionId ?? "")?.tier;
}
