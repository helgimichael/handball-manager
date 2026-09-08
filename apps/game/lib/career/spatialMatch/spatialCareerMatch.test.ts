// MATCH-EXPERIENCE-2.0 M14: a real career fixture, played by the spatial engine.
//
// The test that must never be deleted is "the spatial engine is the only source
// of this scoreline". The entire risk of a seam like this is that two engines
// end up running and somebody picks between them, or that one quietly tops the
// other up. A change that let a Fast Match Engine number reach a migrated
// fixture would satisfy most of the rest of this file and would have destroyed
// the only thing M14 is for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../newCareer";
import { continueCareerRhythm } from "../continueController";
import { getNextPlayerFixture } from "../calendar";
import { playManagerFixture } from "../matchdayAction";
import { getCareerClubSquad } from "../careerWorld";
import { getLiveStandings } from "../standings";
import { snapshotAiTacticalPreferences, snapshotWorldSquads } from "../../gameWorld/serverSnapshot";
import { GAME_CURRENT_DATE } from "../../game-data";
import { isSpatialMatchFailure, playCareerFixtureSpatially, simulateCareerFixtureSpatially, spatialMatchSeed } from "./spatialCareerMatch";
import { resolveCareerLineup, selectBestAvailableLineup } from "./careerLineup";
import { buildSpatialRatings } from "./careerRatings";
import { instructionsFromMatchPlan } from "./careerInstructions";
import type { CareerState } from "../types";

const LEAGUE = "se_handbollsligan_herr";
const REAL_CLUB = "se_club_alingsas_hk";

/**
 * A real Handbollsligan career, advanced to the manager's first matchday.
 *
 * Real clubs, real snapshotted squads, real canonical playerIds -- the vertical
 * slice this milestone is about. Mirrors the existing real-club integration
 * pattern in matchdayAction.test.ts rather than inventing a second one.
 */
function realCareerAtMatchday(seed: string): CareerState {
  const worldSquads = snapshotWorldSquads(LEAGUE);
  const aiTacticalPreferences = snapshotAiTacticalPreferences(LEAGUE, "2026/27", GAME_CURRENT_DATE);
  let current = createNewCareerState(seed, REAL_CLUB, worldSquads, aiTacticalPreferences);
  for (let i = 0; i < 100; i += 1) {
    const { state: next, stopReason } = continueCareerRhythm(current);
    current = next;
    if (stopReason === "ACTION_REQUIRED" || stopReason === "ACTION_REQUIRED_PENDING") return current;
  }
  throw new Error("never reached an ACTION_REQUIRED stop");
}

function sideOf(state: CareerState, clubId: string) {
  return { clubId, squad: getCareerClubSquad(state, clubId), gameplayRatings: state.gameplayRatings[clubId] ?? [], plan: null };
}

/**
 * The career fixture, played through the SAME seam the matchday action uses --
 * same input builder, same plans, same squads. Anything else would be comparing
 * two different matches and proving nothing.
 */
function playSpatially(state: CareerState, fixture: { id: string; homeClubId: string; awayClubId: string }) {
  const outcome = playCareerFixtureSpatially(state, fixture as Parameters<typeof playCareerFixtureSpatially>[1]);
  assert.equal(isSpatialMatchFailure(outcome), false, "both real clubs can field a spatial line-up");
  return outcome as Exclude<typeof outcome, { reason: string }>;
}

// ---------------------------------------------------------------------------
// 1. Real players go in
// ---------------------------------------------------------------------------

test("real career player ids are the players on the court", () => {
  const state = realCareerAtMatchday("m14-identity");
  const fixture = getNextPlayerFixture(state)!;
  const played = playSpatially(state, fixture);

  const homeIds = new Set(getCareerClubSquad(state, fixture.homeClubId).map((p) => p.id));
  const awayIds = new Set(getCareerClubSquad(state, fixture.awayClubId).map((p) => p.id));
  assert.ok(homeIds.size > 0 && awayIds.size > 0, "both clubs have real squads in this career");

  // Every id the match ever put on the court is a real career player. Nothing
  // is invented, and no canonical id is duplicated under a second identity.
  const onCourt = new Set(played.match.trace.flatMap((t) => t.playerPositions.map((p) => p.playerId)));
  assert.ok(onCourt.size >= 14, `a real population played (${onCourt.size} distinct ids)`);
  for (const id of onCourt) {
    assert.ok(homeIds.has(id) || awayIds.has(id), `${id} is a real career player`);
  }
  // ...and each of them belongs to exactly one of the two clubs.
  for (const id of onCourt) {
    assert.equal(homeIds.has(id) && awayIds.has(id), false, `${id} plays for one club only`);
  }
  // The engine's own rosters agree.
  for (const id of played.match.finalState.rosters.HOME) assert.ok(homeIds.has(id));
  for (const id of played.match.finalState.rosters.AWAY) assert.ok(awayIds.has(id));
});

test("starters, bench and goalkeepers map onto the canonical seven", () => {
  const state = realCareerAtMatchday("m14-lineup");
  const squad = getCareerClubSquad(state, REAL_CLUB);
  const lineup = selectBestAvailableLineup(REAL_CLUB, squad)!;
  assert.ok(lineup, "a real squad produces a line-up");

  // Six distinct outcourt starters, one per canonical role, plus a goalkeeper.
  const starters = Object.values(lineup.startersByRole);
  assert.equal(starters.length, 6);
  assert.equal(new Set(starters).size, 6, "no player starts in two places");
  assert.equal(starters.includes(lineup.goalkeeperId), false, "the keeper is not also an outfielder");

  const byId = new Map(squad.map((p) => [p.id, p]));
  assert.equal(byId.get(lineup.goalkeeperId)!.position, "MV", "a real goalkeeper keeps goal");
  for (const id of starters) assert.notEqual(byId.get(id)!.position, "MV", "no goalkeeper is picked outfield");

  // The bench is the rest of the squad, and nobody is on it twice or in both.
  const selected = new Set([lineup.goalkeeperId, ...starters]);
  for (const entry of lineup.bench) {
    assert.equal(selected.has(entry.playerId), false, `${entry.playerId} is not both a starter and a substitute`);
    assert.equal(entry.isGoalkeeper, byId.get(entry.playerId)!.position === "MV", "bench keepers are the real keepers");
  }
  assert.equal(new Set(lineup.squadIds).size, lineup.squadIds.length, "the match squad has no duplicates");

  // And the engine actually receives them that way.
  const fixture = getNextPlayerFixture(state)!;
  const played = playSpatially(state, fixture);
  const first = played.match.trace[0].playerPositions.map((p) => p.playerId);
  const home = fixture.homeClubId === REAL_CLUB ? played.home : played.away;
  for (const id of [home.goalkeeperId, ...Object.values(home.startersByRole)]) {
    assert.ok(first.includes(id), `${id} is on the court at the opening throw-off`);
  }
  // Exactly two goalkeepers are on the court, and they are the two real ones.
  const keepers = played.match.finalState.goalkeeperIds;
  assert.ok(keepers.includes(played.home.goalkeeperId) && keepers.includes(played.away.goalkeeperId));
});

test("the rating mapping is a projection of real attributes, not an invention", () => {
  const state = realCareerAtMatchday("m14-ratings");
  const squad = getCareerClubSquad(state, REAL_CLUB);
  const lineup = selectBestAvailableLineup(REAL_CLUB, squad)!;
  const ratings = buildSpatialRatings(squad, state.gameplayRatings[REAL_CLUB] ?? [], lineup.squadIds);

  for (const id of lineup.squadIds) {
    const entry = ratings[id];
    assert.ok(entry, `${id} has engine ratings`);
    assert.ok(["GAMEPLAY_RATING", "MOCK_ATTRIBUTES", "CURRENT_ABILITY"].includes(entry.source), "and a stated source");
    for (const value of [entry.shooting, entry.passing, entry.attacking, entry.defending, entry.shotStopping]) {
      if (value === undefined) continue;
      assert.ok(value >= 1 && value <= 20, `${id}: ${value} is on the engine's 1-20 scale`);
    }
  }
  // A goalkeeper is rated as a goalkeeper and an outfielder is not.
  const keeper = ratings[lineup.goalkeeperId];
  assert.ok(keeper.shotStopping !== undefined, "the keeper has a save quality");
  const outfielder = ratings[Object.values(lineup.startersByRole)[0]];
  assert.ok(outfielder.shooting !== undefined && outfielder.defending !== undefined);
  assert.equal(outfielder.shotStopping, undefined, "an outfielder is not given a save quality");

  // Two genuinely different players are rated differently -- the mapping reads
  // the squad rather than handing everybody a neutral 10.
  const shootingValues = new Set(lineup.squadIds.map((id) => ratings[id].shooting).filter((v) => v !== undefined));
  assert.ok(shootingValues.size > 1, `the squad is not flat (${shootingValues.size} distinct shooting values)`);
});

test("a coach's plan becomes instructions, and no plan means neutral", () => {
  assert.deepEqual(instructionsFromMatchPlan(null), {}, "a side with no plan is told nothing");
});

// ---------------------------------------------------------------------------
// 2. DO NOT DELETE: the spatial engine is the only source of this scoreline
// ---------------------------------------------------------------------------

test("the spatial engine is the only source of this scoreline", () => {
  const state = realCareerAtMatchday("m14-ownership");
  const fixture = getNextPlayerFixture(state)!;
  const { state: next, result } = playManagerFixture(state);
  assert.ok(result, "the fixture was played");

  // The provenance marker: this fixture was owned by the spatial engine.
  assert.equal(result!.engine, "SPATIAL", "a real career fixture is played spatially");

  // And the career recorded exactly what that match produced. This is the
  // whole point: the score in the save is the score the court produced.
  const played = playSpatially(state, fixture);
  assert.equal(result!.homeGoals, played.match.finalScore.HOME, "home score is the spatial score");
  assert.equal(result!.awayGoals, played.match.finalScore.AWAY, "away score is the spatial score");
  assert.equal(result!.seed, spatialMatchSeed(state.saveSeed, fixture.id), "and it was seeded from the career, not a clock");

  // The stored result is the same one, unaltered.
  const stored = next.results[fixture.id];
  assert.equal(stored.engine, "SPATIAL");
  assert.equal(stored.homeGoals, played.match.finalScore.HOME);
  assert.equal(stored.awayGoals, played.match.finalScore.AWAY);

  // The number of GOAL events equals the final score -- the timeline and the
  // scoreline are the same match, not two accounts of it.
  const goalEvents = stored.events.filter((e) => e.type === "GOAL");
  assert.equal(goalEvents.length, stored.homeGoals + stored.awayGoals, "every goal in the timeline is a goal in the score");
  assert.equal(goalEvents.filter((e) => e.side === "home").length, stored.homeGoals);
  assert.equal(goalEvents.filter((e) => e.side === "away").length, stored.awayGoals);
});

test("every scorer and stat event is a real spatial event", () => {
  const state = realCareerAtMatchday("m14-events");
  const fixture = getNextPlayerFixture(state)!;
  const played = playSpatially(state, fixture);
  const result = played.result;

  // Every attributed player id is somebody who was actually on the court.
  const onCourt = new Set(played.match.trace.flatMap((t) => t.playerPositions.map((p) => p.playerId)));
  for (const event of result.events) {
    if (!event.playerId) continue;
    assert.ok(onCourt.has(event.playerId), `${event.type} attributed to ${event.playerId}, who played`);
  }

  // Every goal event corresponds to a SHOT_GOAL the engine recorded, by the
  // same player -- goals are not redistributed across a roster afterwards.
  const spatialScorers = played.match.events.filter((e) => e.outcome === "SHOT_GOAL").map((e) => e.event.playerId);
  const adapterScorers = result.events.filter((e) => e.type === "GOAL").map((e) => e.playerId ?? null);
  assert.deepEqual([...adapterScorers].sort(), [...spatialScorers].sort(), "the scorers are the engine's own shooters");

  // Player contributions add up to the team's own goals.
  const homeContributionGoals = result.homePlayerContributions.reduce((a, c) => a + c.goals, 0);
  const awayContributionGoals = result.awayPlayerContributions.reduce((a, c) => a + c.goals, 0);
  assert.equal(homeContributionGoals, result.homeGoals, "home contributions sum to the home score");
  assert.equal(awayContributionGoals, result.awayGoals, "away contributions sum to the away score");

  // A goalkeeper's saves are saves the engine's goalkeeper actually made.
  const spatialSaves = played.match.events.filter((e) => e.outcome === "SHOT_SAVED").length;
  const contributionSaves =
    result.homePlayerContributions.reduce((a, c) => a + (c.saves ?? 0), 0) + result.awayPlayerContributions.reduce((a, c) => a + (c.saves ?? 0), 0);
  assert.equal(contributionSaves, spatialSaves, "every recorded save is a save that happened");

  // Team shot counts are the engine's shot counts.
  const homeShots = played.match.segments.filter((s) => s.team === "HOME" && s.outcome.startsWith("SHOT_")).length;
  assert.equal(result.homeStats.shots, homeShots, "shots are counted from the match, not modelled");
  assert.equal(result.homeStats.shotsFaced, result.awayStats.shots, "shots faced is the opponent's shot count");

  // And a 7 metre in the stats is a 7 metre the referee actually gave.
  const sevenMetreFouls = played.match.segments.flatMap((s) => s.fouls).filter((f) => f.restart === "SEVEN_METRE").length;
  assert.ok(
    result.homeStats.sevenMetreAttempts + result.awayStats.sevenMetreAttempts <= sevenMetreFouls,
    "no 7 metre is reported that the match did not award",
  );
});

// ---------------------------------------------------------------------------
// 3. The career carries on normally
// ---------------------------------------------------------------------------

test("the fixture is recorded exactly once, and the table moves with it", () => {
  const state = realCareerAtMatchday("m14-progression");
  const fixture = getNextPlayerFixture(state)!;
  assert.equal(state.results[fixture.id], undefined, "not played yet");

  const before = getLiveStandings(state);
  const { state: next, result } = playManagerFixture(state);
  assert.ok(result);

  // Recorded once: one result, one MATCH_COMPLETED event, one resolved matchday.
  assert.equal(Object.keys(next.results).filter((id) => id === fixture.id).length, 1);
  const completed = next.careerEvents.filter((e) => e.id.startsWith("MATCH_COMPLETED") && e.id.includes(fixture.id));
  assert.equal(completed.length, 1, "one completion event");
  const matchday = next.careerEvents.find((e) => e.id === `MATCHDAY_READY:${fixture.id}`);
  assert.equal(matchday?.resolved, true, "the matchday is resolved");

  // Playing again is an idempotent no-op rather than a second result.
  const again = playManagerFixture(next);
  assert.equal(again.result, null, "the same fixture cannot be played twice");
  assert.equal(Object.keys(again.state.results).length, Object.keys(next.results).length);

  // The league table moved, and it moved by this match.
  const after = getLiveStandings(next);
  const rowBefore = before.find((r) => r.clubId === fixture.homeClubId)!;
  const rowAfter = after.find((r) => r.clubId === fixture.homeClubId)!;
  assert.equal(rowAfter.played, rowBefore.played + 1, "the home club has played one more");
  assert.equal(rowAfter.goalsFor, rowBefore.goalsFor + result!.homeGoals, "and scored exactly what the match produced");
  assert.equal(rowAfter.goalsAgainst, rowBefore.goalsAgainst + result!.awayGoals);
});

test("a played fixture survives save and reload", () => {
  const state = realCareerAtMatchday("m14-save");
  const fixture = getNextPlayerFixture(state)!;
  const { state: next, result } = playManagerFixture(state);
  assert.ok(result);

  // What persistence does to a career state: serialise, store, read back.
  const reloaded = JSON.parse(JSON.stringify(next)) as CareerState;
  const stored = reloaded.results[fixture.id];
  assert.ok(stored, "the played fixture is still there");
  assert.equal(stored.engine, "SPATIAL", "and still says which engine owned it");
  assert.equal(stored.homeGoals, result!.homeGoals);
  assert.equal(stored.awayGoals, result!.awayGoals);
  assert.deepEqual(stored.events, result!.events, "the whole timeline round-trips");
  assert.deepEqual(getLiveStandings(reloaded), getLiveStandings(next), "and the table reads the same after reload");
});

test("the same career state and fixture always produce the same match", () => {
  const state = realCareerAtMatchday("m14-determinism");
  const fixture = getNextPlayerFixture(state)!;

  const a = playSpatially(state, fixture);
  const b = playSpatially(state, fixture);
  assert.equal(a.seed, b.seed);
  assert.deepEqual(b.match.finalScore, a.match.finalScore, "the same scoreline");
  assert.deepEqual(b.result.events, a.result.events, "the same timeline");
  assert.deepEqual(b.result.homePlayerContributions, a.result.homePlayerContributions, "the same player records");
  assert.equal(b.match.trace.length, a.match.trace.length, "and the same spatial trace");

  // Playing the career fixture twice from the same state agrees with it too --
  // the career result and a freshly derived match are the same match.
  const first = playManagerFixture(state).result!;
  const second = playManagerFixture(state).result!;
  assert.deepEqual(second, first, "playManagerFixture is a pure function of the state");
  assert.equal(first.homeGoals, a.match.finalScore.HOME);
  assert.equal(first.awayGoals, a.match.finalScore.AWAY);

  // A different fixture is a different match.
  const other = simulateCareerFixtureSpatially({
    fixtureId: `${fixture.id}-other`,
    saveSeed: state.saveSeed,
    home: sideOf(state, fixture.homeClubId),
    away: sideOf(state, fixture.awayClubId),
  });
  assert.equal(isSpatialMatchFailure(other), false);
  assert.notEqual(spatialMatchSeed(state.saveSeed, `${fixture.id}-other`), a.seed, "fixtures never share a seed");
});

test("Match 2D replays the career's own match rather than a second one", () => {
  const state = realCareerAtMatchday("m14-playback");
  const fixture = getNextPlayerFixture(state)!;
  const { result } = playManagerFixture(state);
  assert.ok(result);

  // What the playback screen does: ask the SAME seam for the SAME fixture from
  // the SAME career state. It is one simulation, re-derived, never a second
  // match generated for the visuals.
  const forPlayback = playSpatially(state, fixture);
  assert.equal(forPlayback.match.finalScore.HOME, result!.homeGoals, "the trace's score is the career's score");
  assert.equal(forPlayback.match.finalScore.AWAY, result!.awayGoals);
  assert.ok(forPlayback.match.trace.length > 100, "and there is a real trace to play back");
  const scoreAtFullTime = forPlayback.match.trace[forPlayback.match.trace.length - 1].score;
  assert.equal(scoreAtFullTime.HOME + scoreAtFullTime.AWAY, result!.homeGoals + result!.awayGoals);
});

test("a club with no squad data is honestly not migrated, and never double-simulated", () => {
  // A club this career knows nothing about cannot field seven real players, and
  // inventing them is exactly what this milestone forbids. The seam says so.
  const state = realCareerAtMatchday("m14-unmigrated");
  const outcome = simulateCareerFixtureSpatially({
    fixtureId: "fixture-with-an-unknown-club",
    saveSeed: state.saveSeed,
    home: sideOf(state, REAL_CLUB),
    away: { clubId: "club-that-does-not-exist", squad: [], gameplayRatings: [], plan: null },
  });
  assert.equal(isSpatialMatchFailure(outcome), true, "no match is produced");
  assert.equal(isSpatialMatchFailure(outcome) && outcome.clubId, "club-that-does-not-exist", "and it says which club");

  // No line-up, no match, no score -- rather than a fabricated one.
  assert.equal(resolveCareerLineup("club-that-does-not-exist", [], null), null);
});
