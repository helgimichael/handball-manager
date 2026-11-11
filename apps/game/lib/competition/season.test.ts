import { cooperationEligibility } from './transition/cooperationEligibility';
// HM-ALPHA3-M03: season engine -- verified formats, series, kval,
// promotion/relegation, cup, awards, prize money and the season boundary.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchWinnerClubId } from "@handball-manager/game-simulation";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { continueCareerRhythm } from "../career/continueController";
import { playManagerFixtureLegacy } from "../career/legacy/matchday";
import { attemptSeasonTransition } from "../career/seasonRollover";
import { syntheticTransitionCareer } from "../career/seasonTransition.fixtures";
import type { CareerState } from "../career/types";
import { ALLSVENSKAN, HANDBOLLSLIGAN, KVAL_HBL, SM_SLUTSPEL, SVENSKA_CUPEN } from "./rules";
import { competitionTable } from "./tables";
import { tieWins } from "./season";
import { answerConcern, openConcerns } from "../players/talks";

function careerAt(clubId = "se_club_ifk_skovde_hk"): CareerState {
  const comps = [HANDBOLLSLIGAN, ALLSVENSKAN, "se_division1_norra", "se_division1_sodra"];
  const squads = Object.assign({}, ...comps.map((c) => snapshotWorldSquads(c)));
  const ratings = Object.assign({}, ...comps.map((c) => snapshotGameplayRatings(c)));
  return createNewCareerState("season-engine-tests", clubId, squads, undefined, ratings, undefined, "4_WEEKS");
}

function playSeason(start: CareerState): CareerState {
  let state = start;
  for (let i = 0; i < 3000 && !state.seasonComplete; i++) {
    const { state: next, stopReason } = continueCareerRhythm(state);
    state = next;
    if (stopReason === "ACTION_REQUIRED" || stopReason === "ACTION_REQUIRED_PENDING") {
      // M1.3A: the test manager answers the new playing-time decisions before continuing to matchday.
      for (const concern of openConcerns(state).filter(c => c.kind === 'PLAYING_TIME')) state = answerConcern(state,concern.id,'EARN_IT');
      state = playManagerFixtureLegacy(state).state;
    }
  }
  return state;
}

let season: CareerState | undefined;
const finished = () => (season ??= playSeason(careerAt()));

test("a new career gets both Swedish leagues and Svenska cupen before kickoff", () => {
  const s = careerAt();
  const { state } = continueCareerRhythm(s);
  for (const c of [HANDBOLLSLIGAN, ALLSVENSKAN]) assert.equal(state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === c).length, 14 * 13, c);
  const firstRound = Object.values(state.competitionTies ?? {}).filter((t) => t.competitionId === SVENSKA_CUPEN && t.key.startsWith("R32-"));
  assert.equal(firstRound.length, 16);
  assert.equal(new Set(firstRound.flatMap(t => [t.highClubId,t.lowClubId])).size, 32);
  assert.ok(state.seasonOutcome?.bothTiersSimulated);
});

test("no club ever has two fixtures on the same day", () => {
  const state = finished();
  const seen = new Set<string>();
  for (const f of state.fixtures) for (const club of [f.homeClubId, f.awayClubId]) {
    const key = `${club}:${f.date}`;
    assert.ok(!seen.has(key), `double booking ${key}`);
    seen.add(key);
  }
});

test("SM-slutspel follows the verified bracket: HBL 1-8, 1v8 4v5 2v7 3v6, best of five, one champion", () => {
  const state = finished();
  const hbl = competitionTable(state, HANDBOLLSLIGAN).map((r) => r.clubId);
  const ties = Object.values(state.competitionTies!).filter((t) => t.competitionId === SM_SLUTSPEL);
  const qf = ties.filter((t) => t.stage === "QF").sort((a, b) => a.key.localeCompare(b.key));
  assert.deepEqual(qf.map((t) => [hbl.indexOf(t.highClubId) + 1, hbl.indexOf(t.lowClubId) + 1]), [[1, 8], [4, 5], [2, 7], [3, 6]]);
  assert.equal(ties.filter((t) => t.stage === "SF").length, 2);
  for (const t of ties) {
    const wins = tieWins(state, t);
    assert.equal(wins[t.winnerClubId!], 3, `${t.key} winner has three wins`);
    assert.ok(t.fixtureIds.length >= 3 && t.fixtureIds.length <= 5);
    for (const id of t.fixtureIds) assert.ok(matchWinnerClubId(state.results[id]!), "no series game ends level");
  }
  assert.equal(state.seasonOutcome!.champion, ties.find((t) => t.stage === "F")!.winnerClubId);
});

test("default game continuity resolves eligible qualifiers while membership remains advisory", () => {
  const state = finished();
  const hbl = competitionTable(state, HANDBOLLSLIGAN).map(r => r.clubId);
  const qualifiers=Object.values(state.competitionTies!).filter(t=>t.competitionId===KVAL_HBL);
  assert.equal(qualifiers.length,3);
  for(const tie of qualifiers)assert.ok(cooperationEligibility(state,tie.lowClubId,1,state.gameDate).eligible);
  assert.equal(state.seasonOutcome!.nextMembership[hbl[13]!],ALLSVENSKAN);
  assert.ok(state.seasonOutcome!.promoted.length>0);
  assert.equal(state.competitionMembership,undefined,"postseason is advisory; gate owns membership");
});

test("the season completes only after the postseason, with awards and prize money booked", () => {
  const state = finished();
  assert.equal(state.seasonOutcome!.phase, "COMPLETE");
  assert.ok(state.seasonComplete);
  assert.ok(state.seasonOutcome!.cupWinner, "Svenska cupen has a winner");
  assert.ok(state.seasonOutcome!.awards.some((a) => a.id === "TOP_SCORER" && a.competitionId === HANDBOLLSLIGAN));
  const champion = state.seasonOutcome!.champion!;
  const books = state.clubFinances![champion]!;
  const prize = [...books.pendingTransactions, ...books.statements.flatMap((s) => s.transactions)].filter((t) => t.category === "PRIZE_MONEY");
  assert.ok(prize.some((t) => t.label === "SM-guld"), "the champion is paid");
});

test("legacy postseason outcome cannot bypass the atomic readiness gate", () => {
  const state = syntheticTransitionCareer();
  state.seasonOutcome!.nextMembership = { [state.playerClubId]: HANDBOLLSLIGAN };
  const result = attemptSeasonTransition(state,{fromSeasonId:state.seasonId});
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.state, state);
  assert.ok(result.blockers.some(b => b.code === "MISSING_STANDINGS"));
  assert.ok(result.blockers.some(b => b.code === "NEXT_SEASON_PROFILE_REQUIRED"));
});
