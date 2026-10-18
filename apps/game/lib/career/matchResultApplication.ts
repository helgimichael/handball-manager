// Shared match-result bookkeeping (HM-GAME-0.3): extracted verbatim from
// calendar.ts's private helpers so both the existing AI-fixture path and
// the new manager-fixture path (matchdayAction.ts) apply club form and
// player season stats identically -- Career Rhythm must not recreate
// match-result logic (Spec S37.15), only reuse the bookkeeping around it.

import type { FastMatchResult } from "@handball-manager/game-simulation";
import { emptyPlayerSeasonStats, type ClubFormEntry, type PlayerSeasonStats } from "./types";

const FORM_HISTORY_LENGTH = 5;

export function pushForm(existing: readonly ClubFormEntry[] | undefined, entry: ClubFormEntry): ClubFormEntry[] {
  const next = [...(existing ?? []), entry];
  return next.slice(Math.max(0, next.length - FORM_HISTORY_LENGTH));
}

export function applyPlayerContribution(
  stats: Record<string, PlayerSeasonStats>,
  playerId: string,
  goals: number,
  shots: number,
  rating: number,
  started: boolean,
  saves?: number,
  shotsFaced?: number,
): void {
  const current = stats[playerId] ?? emptyPlayerSeasonStats(playerId);
  stats[playerId] = {
    playerId,
    appearances: current.appearances + 1,
    starts: current.starts + (started ? 1 : 0),
    goals: current.goals + goals,
    shots: current.shots + shots,
    saves: current.saves + (saves ?? 0),
    shotsFaced: current.shotsFaced + (shotsFaced ?? 0),
    ratingSum: current.ratingSum + rating,
  };
}

/**
 * Updates clubForm (both sides) and, for the given `ownClubId`,
 * playerSeasonStats -- mutates the passed-in Records in place, mirroring
 * calendar.ts's existing style.
 *
 * HM-PRESEASON-1.0 Part: "friendly påverkar inte ligatabell/cupresultat"
 * -- `countsForBookkeeping` (default true, so every pre-existing caller
 * that never passes it stays byte-identical) gates BOTH clubForm and
 * playerSeasonStats. A FRIENDLY fixture still runs the full match/
 * physical/development/injury pipeline (matchdayAction.ts is otherwise
 * untouched) -- only this bookkeeping step is skipped for it.
 */
export function applyMatchResultBookkeeping(
  result: FastMatchResult,
  clubForm: Record<string, ClubFormEntry[]>,
  playerSeasonStats: Record<string, PlayerSeasonStats>,
  ownClubId: string,
  countsForBookkeeping = true,
): void {
  if (!countsForBookkeeping) return;

  const homeEntry: ClubFormEntry = result.homeGoals > result.awayGoals ? "W" : result.homeGoals < result.awayGoals ? "L" : "D";
  const awayEntry: ClubFormEntry = result.awayGoals > result.homeGoals ? "W" : result.awayGoals < result.homeGoals ? "L" : "D";
  clubForm[result.homeClubId] = pushForm(clubForm[result.homeClubId], homeEntry);
  clubForm[result.awayClubId] = pushForm(clubForm[result.awayClubId], awayEntry);

  const contributions = [...result.homePlayerContributions, ...result.awayPlayerContributions];
  for (const contribution of contributions) {
    applyPlayerContribution(
      playerSeasonStats,
      contribution.playerId,
      contribution.goals,
      contribution.shots,
      contribution.rating,
      contribution.started,
      contribution.saves,
      contribution.shotsFaced,
    );
  }
}
