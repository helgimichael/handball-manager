// HM-ALPHA3-M03: season engine -- verified formats, series, kval,
// promotion/relegation, cup, awards, prize money and the season boundary.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchWinnerClubId } from "@handball-manager/game-simulation";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { continueCareerRhythm } from "../career/continueController";
import { playManagerFixtureLegacy } from "../career/legacy/matchday";
import { rolloverSeason } from "../career/seasonRollover";
import type { CareerState } from "../career/types";
import { ALLSVENSKAN, HANDBOLLSLIGAN, KVAL_HBL, SM_SLUTSPEL, SVENSKA_CUPEN } from "./rules";
import { competitionTable } from "./tables";
import { tieWins } from "./season";

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
    if (stopReason === "ACTION_REQUIRED" || stopReason === "ACTION_REQUIRED_PENDING") state = playManagerFixtureLegacy(state).state;
  }
  return state;
}

let season: CareerState | undefined;
const finished = () => (season ??= playSeason(careerAt()));

test("a new career gets both Swedish leagues and Svenska cupen before kickoff", () => {
  const s = careerAt();
  const { state } = continueCareerRhythm(s);
  for (const c of [HANDBOLLSLIGAN, ALLSVENSKAN]) assert.equal(state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === c).length, 14 * 13, c);
  const groups = Object.values(state.competitionTies ?? {}).filter((t) => t.competitionId === SVENSKA_CUPEN && t.stage === "CUP_GROUP");
  assert.equal(groups.length, 8);
  assert.equal(new Set(groups.flatMap((g) => g.clubIds ?? [])).size, 32);
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

test("kval pairs HBL 11/12/13 with Allsvenskan 4/3/2; 14th goes down and the Allsvenskan winner goes up", () => {
  const state = finished();
  const hbl = competitionTable(state, HANDBOLLSLIGAN).map((r) => r.clubId);
  const allsv = competitionTable(state, ALLSVENSKAN).map((r) => r.clubId);
  const kval = Object.values(state.competitionTies!).filter((t) => t.competitionId === KVAL_HBL).sort((a, b) => a.key.localeCompare(b.key));
  assert.deepEqual(kval.map((t) => [hbl.indexOf(t.highClubId) + 1, allsv.indexOf(t.lowClubId) + 1]), [[11, 4], [12, 3], [13, 2]]);
  const next = state.seasonOutcome!.nextMembership;
  assert.equal(next[hbl[13]!], ALLSVENSKAN);
  assert.equal(next[allsv[0]!], HANDBOLLSLIGAN);
  for (const t of kval) assert.equal(next[t.winnerClubId!], HANDBOLLSLIGAN);
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

test("rollover applies promotion and relegation and builds both leagues for the new season", () => {
  const state = finished();
  const next = rolloverSeason(state);
  const o = state.seasonOutcome!;
  for (const [club, competitionId] of Object.entries(o.nextMembership)) assert.equal(next.competitionMembership![club], competitionId);
  for (const c of [HANDBOLLSLIGAN, ALLSVENSKAN]) {
    const clubs = new Set(next.fixtures.filter((f) => f.competitionId === c).flatMap((f) => [f.homeClubId, f.awayClubId]));
    assert.equal(clubs.size, 14, `${c} still has 14 clubs`);
  }
  for (const id of o.promoted.filter((id) => o.nextMembership[id] === HANDBOLLSLIGAN)) assert.ok(next.fixtures.some((f) => f.competitionId === HANDBOLLSLIGAN && (f.homeClubId === id || f.awayClubId === id)), `${id} plays in HBL`);
  assert.equal(next.seasonHistory!.at(-1)!.outcome?.champion, o.champion);
  assert.equal(next.seasonOutcome!.phase, "REGULAR");
  assert.equal(new Set(next.fixtures.map((f) => f.id)).size, next.fixtures.length);
});
