// M1.2E: one season's competitive calendar -- the four Swedish men's leagues
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
import { SWEDISH_WORLD_COMPETITION_IDS } from "../career/worldCompetitions";
import { SWEDISH_2026_RULES } from "./transition/sweden2026";
import { createSvenskaCupen, ensureSeasonOutcome, newSeasonOutcome } from "./season";
import { competitionClubIds, hasLeagueCalendar } from "./tables";
import { ensureCupCalendar } from "./cupSchedule";
import { avoidNationalBreaks } from "../nationalTeam/nationalTeam";

function leagueFixtures(state: CareerState, competitionId: string, kickoff: string, idPrefix: string, preferReal: boolean): CareerFixture[] {
  const real = preferReal ? getRealLeagueSchedule(competitionId) : undefined;
  const clubIds = competitionClubIds(state, competitionId);
  if (real && real.season === state.seasonId && real.fixtures.every((f) => clubIds.includes(f.homeClubId) && clubIds.includes(f.awayClubId))) {
    return real.fixtures.map((f) => ({ id: f.id, competitionId, round: f.round, date: f.date, homeClubId: f.homeClubId, awayClubId: f.awayClubId, type: "LEAGUE" as const, kickoffTime: f.kickoffTime, sourceMatchId: f.profixioMatchId }));
  }
  // GAME_CONTINUITY uses six-day rounds so generated leagues finish before March qualification.
  // Published source fixtures above remain unchanged. Explicit official-only requests retain their calendar policy.
  // The league pauses for the national team, as the real Handbollsligan does (HM-ALPHA3-M08, 8E).
  return avoidNationalBreaks(generateDoubleRoundRobin({ competitionId, clubIds, seasonStartDate: kickoff, daysBetweenRounds: state.seasonTransitionRequest && state.seasonTransitionRequest.rules?.provenance !== 'GAME_CONTINUITY' ? 7 : 6 })).map((f) => ({
    id: `${idPrefix}${f.id}`, competitionId: f.competitionId, round: f.round, date: f.date, homeClubId: f.homeClubId, awayClubId: f.awayClubId, type: "LEAGUE" as const,
  }));
}

/** Adds missing Swedish league calendars and the cup before kickoff. Division 1 dates are game-generated, not official appointments. Idempotent. */
export function ensureSeasonCalendar(state: CareerState, affectedCompetitions: readonly string[] = SWEDISH_WORLD_COMPETITION_IDS): CareerState {
  let next = ensureSeasonOutcome(state);
  const own = next.competitionId;
  const missing = affectedCompetitions.filter(id => !hasLeagueCalendar(next,id));
  const ownLeague = next.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === own);
  if (ownLeague.length === 0) return ensureCupCalendar(next);
  const kickoff = ownLeague.reduce((min, f) => (f.date < min ? f.date : min), ownLeague[0]!.date);
  const notStarted = next.gameDate <= kickoff && !next.fixtures.some(f => f.type === "LEAGUE" && next.results[f.id]);
  for (const other of missing.filter(id => notStarted && competitionClubIds(next,id).length === SWEDISH_2026_RULES.leagues.find(l => l.id === id)?.size)) {
    const preferReal = ownLeague.some((f) => f.id.startsWith("profixio-"));
    const fixtures = leagueFixtures(next, other, kickoff, `${next.seasonId.slice(0, 4)}-`, preferReal);
    next = { ...next, fixtures: [...next.fixtures, ...fixtures] };
    next = { ...next, seasonOutcome: { ...next.seasonOutcome!, bothTiersSimulated: hasLeagueCalendar(next, HANDBOLLSLIGAN) && hasLeagueCalendar(next, ALLSVENSKAN) } };
  }
  if (notStarted) next = createSvenskaCupen(next);
  return ensureCupCalendar(next);
}

/** Build the explicitly validated league set; the cup follows through the existing daily calendar flow. */
export function buildNewSeasonCalendar(state: CareerState, kickoff: string, affectedCompetitions?: readonly string[]): CareerState {
  const year = state.seasonId.slice(0, 4);
  // The manager's own league is always played -- including a Division 1 group after relegation (simulated as a league; see rules.ts).
  const competitions = [...new Set(affectedCompetitions ?? [...SWEDISH_WORLD_COMPETITION_IDS, state.competitionId])];
  const fixtures = competitions.flatMap((c) => (affectedCompetitions || competitionClubIds(state, c).length >= 4 ? leagueFixtures(state, c, kickoff, `${year}-`, false) : []));
  const next: CareerState = { ...state, fixtures, competitionTies: {} };
  return ensureSeasonCalendar({ ...next, seasonOutcome: newSeasonOutcome(next) }, competitions);
}
