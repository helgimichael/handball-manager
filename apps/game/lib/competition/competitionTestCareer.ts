// Test helper for the competition view-model tests: one Allsvenskan career, built once, plus deterministic
// league results. Not imported by production code.
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "./seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import type { CareerState } from "../career/types";
import { ALLSVENSKAN } from "./rules";

let base: string | undefined;
export function leagueCareer(): CareerState {
  if (!base) {
    const ids = ["swe-2"];
    const s = createNewCareerState("league-centre", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
    base = JSON.stringify(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}

/** Records a deterministic result (with a half-time goal timeline) for every league game up to `rounds`. */
export function playRounds(s: CareerState, rounds: number, competitionId = ALLSVENSKAN): CareerState {
  const results = { ...s.results };
  s.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === competitionId && (f.round ?? 0) <= rounds).forEach((f, i) => {
    const homeGoals = 25 + (i % 4), awayGoals = 24 + ((i * 3) % 5);
    results[f.id] = {
      fixtureId: f.id, seed: i, homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals, awayGoals,
      homeStats: {} as never, awayStats: {} as never,
      events: [{ minute: 20, side: "home", type: "GOAL", homeScoreAfter: 10, awayScoreAfter: 9 }, { minute: 50, side: "away", type: "GOAL", homeScoreAfter: homeGoals, awayScoreAfter: awayGoals }],
      homePlayerContributions: [], awayPlayerContributions: [],
    };
  });
  return { ...s, results };
}
