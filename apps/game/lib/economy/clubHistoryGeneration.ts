// HM-CONTRACTS-1.0A: deterministic, one-time generation of a player's
// PAST club/youth history -- no real transfer/youth-history data exists
// anywhere in this project's sources (confirmed by audit) for any
// player (mock, REAL_WORLD, or generated), so this is honestly
// GENERATED, provisional data, exactly like HM-STAFF-1.0's fictional
// staff or HM-RATINGS-CAREER-1.0's fallback ratings -- never presented
// as researched fact. Deterministic via seededOffset (never Math.random),
// so the same player always gets the same history.
import { CLUBS, getClub, getCompetition, type PlayerMock } from "../game-data";
import { seededOffset } from "../rating/generation/deterministicVariation";
import type { PlayerClubHistory, PlayerClubHistoryEntry } from "./types";

const YOUTH_HISTORY_START_AGE = 12;
/** The latest age a player could still be transitioning out of a youth/training club into their current one. */
const YOUTH_HISTORY_LATEST_HANDOVER_AGE = 18;

function candidateClubsFor(currentClubId: string): readonly string[] {
  const currentClub = getClub(currentClubId);
  const nation = currentClub ? getCompetition(currentClub.competitionId)?.nation : undefined;
  const pool = CLUBS.filter((c) => c.id !== currentClubId && (nation === undefined || getCompetition(c.competitionId)?.nation === nation));
  return pool.map((c) => c.id).sort(); // stable order -- deterministic selection below never depends on array-construction order.
}

/**
 * Part: "flera utbildningsklubbar kan representeras" -- generates 0, 1,
 * or 2 past clubs (weighted: most players have exactly one, some have
 * none -- their current club raised them from youth -- a few have two),
 * each assigned a non-overlapping youth-age window before the player's
 * CURRENT club. A player whose age isn't known yet (real-world data gap)
 * gets an empty history rather than a fabricated one.
 */
export function generatePlayerClubHistory(player: PlayerMock, ageNow: number | null): PlayerClubHistory {
  if (ageNow === null || ageNow < YOUTH_HISTORY_START_AGE) {
    return { playerId: player.id, entries: [] };
  }

  const candidates = candidateClubsFor(player.clubId);
  if (candidates.length === 0) {
    return { playerId: player.id, entries: [] };
  }

  const countRoll = Math.abs(seededOffset(`${player.id}:club-history:count`, 1_000_000)) % 100;
  const clubCount = countRoll < 40 ? 0 : countRoll < 85 ? 1 : 2;
  if (clubCount === 0) {
    return { playerId: player.id, entries: [] };
  }

  const latestHandover = Math.min(YOUTH_HISTORY_LATEST_HANDOVER_AGE, Math.max(YOUTH_HISTORY_START_AGE + 1, ageNow - 1));
  const entries: PlayerClubHistoryEntry[] = [];
  let cursorAge = YOUTH_HISTORY_START_AGE;
  const usedClubs = new Set<string>();

  for (let i = 0; i < clubCount && cursorAge < latestHandover; i++) {
    const remainingSlots = clubCount - i;
    const span = Math.max(1, Math.floor((latestHandover - cursorAge) / remainingSlots));
    const toAge = Math.min(latestHandover, cursorAge + span);

    const clubIndex = Math.abs(seededOffset(`${player.id}:club-history:club:${i}`, 1_000_000)) % candidates.length;
    let clubId = candidates[clubIndex];
    // Deterministic collision-avoidance -- linear probe forward through the sorted candidate list rather than re-rolling (keeps the whole function pure/side-effect-free).
    let probe = 0;
    while (usedClubs.has(clubId) && probe < candidates.length) {
      clubId = candidates[(clubIndex + probe + 1) % candidates.length];
      probe++;
    }
    usedClubs.add(clubId);

    entries.push({ clubId, fromAge: cursorAge, toAge });
    cursorAge = toAge;
  }

  return { playerId: player.id, entries };
}
