// HM-ALPHA3-M03: one season's competitive calendar -- both Swedish leagues
// and Svenska cupen.
//
// A new career (or a new season after rollover) gets the second tier's
// league and the cup on its first processed day, as long as the season
// has not started yet. An older save joined mid-season keeps only its own
// league for the rest of that season (no fabricated half-calendar); the
// full structure starts with the next season.
import { generateDoubleRoundRobin } from "@handball-manager/game-simulation";
import type { CareerFixture, CareerState } from "../career/types";
import { getRealLeagueSchedule } from "../game-data/realLeagueSchedules";
import { ALLSVENSKAN, HANDBOLLSLIGAN } from "./rules";
import { createSvenskaCupen, ensureSeasonOutcome, newSeasonOutcome } from "./season";
import { competitionClubIds, hasLeagueCalendar } from "./tables";
import { avoidNationalBreaks } from "../nationalTeam/nationalTeam";

function leagueFixtures(state: CareerState, competitionId: string, kickoff: string, idPrefix: string, preferReal: boolean): CareerFixture[] {
  const real = preferReal ? getRealLeagueSchedule(competitionId) : undefined;
  const clubIds = competitionClubIds(state, competitionId);
  if (real && real.season === state.seasonId && real.fixtures.every((f) => clubIds.includes(f.homeClubId) && clubIds.includes(f.awayClubId))) {
    return real.fixtures.map((f) => ({ id: f.id, competitionId, round: f.round, date: f.date, homeClubId: f.homeClubId, awayClubId: f.awayClubId, type: "LEAGUE" as const, kickoffTime: f.kickoffTime, sourceMatchId: f.profixioMatchId }));
  }
  // The league pauses for the national team, as the real Handbollsligan does (HM-ALPHA3-M08, 8E).
  return avoidNationalBreaks(generateDoubleRoundRobin({ competitionId, clubIds, seasonStartDate: kickoff, daysBetweenRounds: 7 })).map((f) => ({
    id: `${idPrefix}${f.id}`, competitionId: f.competitionId, round: f.round, date: f.date, homeClubId: f.homeClubId, awayClubId: f.awayClubId, type: "LEAGUE" as const,
  }));
}

/** Adds the other Swedish tier's league and Svenska cupen when the season has not started yet. Idempotent. */
export function ensureSeasonCalendar(state: CareerState): CareerState {
  let next = ensureSeasonOutcome(state);
  const own = next.competitionId;
  const other = own === HANDBOLLSLIGAN ? ALLSVENSKAN : own === ALLSVENSKAN ? HANDBOLLSLIGAN : null;
  const ownLeague = next.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === own);
  if (ownLeague.length === 0) return next;
  const kickoff = ownLeague.reduce((min, f) => (f.date < min ? f.date : min), ownLeague[0]!.date);
  const notStarted = next.gameDate < kickoff && !ownLeague.some((f) => next.results[f.id]);
  if (other && notStarted && !hasLeagueCalendar(next, other) && competitionClubIds(next, other).length >= 4) {
    const preferReal = ownLeague.some((f) => f.id.startsWith("profixio-"));
    const fixtures = leagueFixtures(next, other, kickoff, `${next.seasonId.slice(0, 4)}-`, preferReal);
    next = { ...next, fixtures: [...next.fixtures, ...fixtures] };
    next = { ...next, seasonOutcome: { ...next.seasonOutcome!, bothTiersSimulated: hasLeagueCalendar(next, HANDBOLLSLIGAN) && hasLeagueCalendar(next, ALLSVENSKAN) } };
  }
  if (notStarted) next = createSvenskaCupen(next);
  return next;
}

/** A complete, fresh calendar for a new season after rollover: both leagues from the new membership, then the cup. */
export function buildNewSeasonCalendar(state: CareerState, kickoff: string): CareerState {
  const year = state.seasonId.slice(0, 4);
  // The manager's own league is always played -- including a Division 1 group after relegation (simulated as a league; see rules.ts).
  const competitions = [...new Set([HANDBOLLSLIGAN, ALLSVENSKAN, state.competitionId])];
  const fixtures = competitions.flatMap((c) => (competitionClubIds(state, c).length >= 4 ? leagueFixtures(state, c, kickoff, `${year}-`, false) : []));
  const next: CareerState = { ...state, fixtures, competitionTies: {} };
  return { ...next, seasonOutcome: newSeasonOutcome(next) };
}
