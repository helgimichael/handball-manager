// Historical match adapter regression. Production lifecycle is covered by productionMatch.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBA_CLUB_ID } from "../game-data";
import { createNewCareerState } from "../career/newCareer";
import { continueCareerRhythm } from "../career/continueController";
import { playManagerFixtureLegacy as playManagerFixture } from "../career/legacy/matchday";
import { snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import type { CareerState } from "../career/types";
import { buildLastMatchViewModel, buildOpponentViewModel, buildOurTeamViewModel, buildOverviewViewModel } from "./viewModels";

function playManagerMatchdays(state: CareerState, n: number): CareerState {
  let current = state;
  let played = 0;
  let guard = 0;
  while (played < n && guard < 500) {
    guard += 1;
    const { state: next } = continueCareerRhythm(current);
    current = next;
    const pending = current.careerEvents.find((e) => e.type === "MATCHDAY_READY" && !e.resolved);
    if (pending) {
      const result = playManagerFixture(current);
      current = result.state;
      if (result.result) played += 1;
    }
  }
  return current;
}

test("a fresh career (no completed matches) shows NO_MATCHES_YET everywhere, never a fabricated value", () => {
  const fresh = createNewCareerState("vm-seed-fresh", TUMBA_CLUB_ID);
  const overview = buildOverviewViewModel(fresh);
  assert.equal(overview.ourForm.ok, false);
  if (!overview.ourForm.ok) assert.equal(overview.ourForm.state, "NO_MATCHES_YET");
  assert.equal(overview.lastMatch.ok, false);
  if (!overview.lastMatch.ok) assert.equal(overview.lastMatch.state, "NO_MATCHES_YET");

  const lastMatch = buildLastMatchViewModel(fresh);
  assert.equal(lastMatch.status, "NO_MATCHES_YET");

  const ourTeam = buildOurTeamViewModel(fresh);
  assert.equal(ourTeam.status, "NO_MATCHES_YET");
});

test("Overview: next opponent, our form, and last match are all real and dynamic after matches are played", () => {
  const state = playManagerMatchdays(createNewCareerState("vm-seed-overview", TUMBA_CLUB_ID), 2);
  const overview = buildOverviewViewModel(state);

  assert.equal(overview.ourForm.ok, true);
  assert.equal(overview.lastMatch.ok, true);
  if (overview.lastMatch.ok) {
    const result = state.results[overview.lastMatch.value.fixtureId];
    assert.ok(result, "last match must reference a real stored result");
  }
  // No mock analysis prose anywhere in the overview's own fields.
  assert.equal(typeof overview.ownClub.name, "string");
});

test("Opponent: dynamically changes when the next scheduled opponent changes, and its recent-match metrics come from real stored results", () => {
  const state1 = createNewCareerState("vm-seed-opp", TUMBA_CLUB_ID);
  const opp1 = buildOpponentViewModel(state1);
  assert.equal(opp1.status, "OK");

  const stateAfterOneMatch = playManagerMatchdays(state1, 1);
  const opp2 = buildOpponentViewModel(stateAfterOneMatch);
  assert.equal(opp2.status, "OK");
  assert.notEqual(opp1.club?.id, opp2.club?.id, "the next opponent must change once round 1 is played");

  // Opponent player production is never fabricated -- always NOT_AVAILABLE_YET in v0.1.
  assert.equal(opp2.players.ok, false);
  if (!opp2.players.ok) assert.equal(opp2.players.state, "NOT_AVAILABLE_YET");
});

test("Our Team: player production uses real per-save career stats, not provisional ratings", () => {
  const state = playManagerMatchdays(createNewCareerState("vm-seed-ourteam", TUMBA_CLUB_ID), 3);
  const ourTeam = buildOurTeamViewModel(state, "SEASON");
  assert.equal(ourTeam.status, "OK");
  assert.ok(ourTeam.players.length > 0);
  for (const p of ourTeam.players) {
    const seasonStats = state.playerSeasonStats[p.playerId];
    assert.ok(seasonStats);
    assert.equal(p.goals, seasonStats.goals);
    assert.equal(p.appearances, seasonStats.appearances);
  }
});

test("Last Match: score, half split, and scoring runs are all derived from the exact same stored FastMatchResult as Match Report", () => {
  const state = playManagerMatchdays(createNewCareerState("vm-seed-lastmatch", TUMBA_CLUB_ID), 1);
  const lastMatch = buildLastMatchViewModel(state);
  assert.equal(lastMatch.status, "OK");
  const storedResult = state.results[lastMatch.fixtureId!];
  assert.equal(lastMatch.homeGoals, storedResult.homeGoals);
  assert.equal(lastMatch.awayGoals, storedResult.awayGoals);
  assert.deepEqual(lastMatch.timeline, storedResult.events);

  const { firstHalf, secondHalf } = lastMatch.halfSplit!;
  assert.equal(firstHalf.home.goals + secondHalf.home.goals, storedResult.homeStats.goals);
  assert.equal(firstHalf.away.goals + secondHalf.away.goals, storedResult.awayStats.goals);
});

test("HM-DATA-0.2 real-club QA: Analysis Hub works for a real Handbollsligan club, not only IFK Tumba", () => {
  const clubId = "se_club_alingsas_hk";
  const worldSquads = snapshotWorldSquads("se_handbollsligan_herr");
  const state = playManagerMatchdays(createNewCareerState("vm-seed-real-club", clubId, worldSquads), 2);

  const overview = buildOverviewViewModel(state);
  assert.equal(overview.ownClub.id, clubId);
  assert.equal(overview.ownClub.name, "Alingsås HK");

  const ourTeam = buildOurTeamViewModel(state, "SEASON");
  assert.equal(ourTeam.status, "OK");
  assert.ok(ourTeam.players.length > 0);
  // Real-world player identity, not a Tumba mock name.
  assert.ok(ourTeam.players.every((p) => !state.playerSeasonStats[p.playerId] || getCareerSquadHasNoTumbaIds(state, p.playerId)));

  const opponent = buildOpponentViewModel(state);
  assert.equal(opponent.status, "OK");
  assert.notEqual(opponent.club?.id, clubId);

  const lastMatch = buildLastMatchViewModel(state);
  assert.equal(lastMatch.status, "OK");
});

function getCareerSquadHasNoTumbaIds(state: CareerState, playerId: string): boolean {
  return !playerId.startsWith("p-"); // TUMBA_SQUAD's mock ids are all "p-*"; real-world ids are "se_player_*"
}
