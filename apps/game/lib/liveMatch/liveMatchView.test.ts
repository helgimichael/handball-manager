import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateMatch, type SimulateMatchInput, type ClubStrength, type MatchRosterPlayer } from "@handball-manager/game-simulation";
import { computeLiveMatchView, liveStatsMatchFinal } from "./liveMatchView";
import { initLiveMatchClock, kickoff, revealInstantly, startSecondHalf, tick, type LiveMatchClock } from "./clock";

function strength(overrides: Partial<ClubStrength> = {}): ClubStrength {
  return { clubId: "x", overall: 65, attack: 65, defense: 65, goalkeeper: 65, depth: 60, ...overrides };
}

function roster(prefix: string): MatchRosterPlayer[] {
  return [
    { playerId: `${prefix}-gk`, isGoalkeeper: true, scoringWeight: 0, started: true },
    { playerId: `${prefix}-1`, isGoalkeeper: false, scoringWeight: 3, started: true },
    { playerId: `${prefix}-2`, isGoalkeeper: false, scoringWeight: 2, started: true },
    { playerId: `${prefix}-3`, isGoalkeeper: false, scoringWeight: 1.5, started: true },
  ];
}

function baseInput(seed: number): SimulateMatchInput {
  return {
    fixtureId: "f-1",
    seed,
    homeClubId: "home",
    awayClubId: "away",
    homeStrength: strength({ clubId: "home" }),
    awayStrength: strength({ clubId: "away" }),
    homeRoster: roster("h"),
    awayRoster: roster("a"),
  };
}

function fullMatchClock(): LiveMatchClock {
  let clock = kickoff(initLiveMatchClock());
  for (let i = 0; i < 30; i += 1) clock = tick(clock);
  clock = startSecondHalf(clock);
  for (let i = 0; i < 30; i += 1) clock = tick(clock);
  return clock;
}

test("at kickoff (00:00) live stats are all zero -- no final totals leak early", () => {
  const result = simulateMatch(baseInput(1));
  const view = computeLiveMatchView(result, initLiveMatchClock());
  assert.equal(view.homeScore, 0);
  assert.equal(view.awayScore, 0);
  assert.deepEqual(view.homePlayerGoals, {});
  assert.equal(view.homeStats.goals, 0);
  assert.equal(view.homeStats.shots, 0);
  assert.equal(view.currentAttack, null);
});

test("mid-match (15:00) live stats do not already equal the final totals for a match with later goals", () => {
  // Find a seed whose match has meaningfully more goals in the second half than are revealed by minute 15.
  let found = false;
  for (let seed = 0; seed < 30 && !found; seed += 1) {
    const result = simulateMatch(baseInput(seed));
    const midClock: LiveMatchClock = { phase: "FIRST_HALF", clockMinute: 15, speed: "X1", timeoutsUsed: { firstHalf: 0, secondHalf: 0 } };
    const view = computeLiveMatchView(result, midClock);
    if (view.homeScore + view.awayScore < result.homeGoals + result.awayGoals) {
      found = true;
      assert.ok(!liveStatsMatchFinal(view, result), "stats revealed by minute 15 must not already equal full-time totals");
    }
  }
  assert.ok(found, "expected at least one seed with goals still to come after minute 15");
});

test("score only changes on a revealed GOAL event, exactly once each", () => {
  const result = simulateMatch(baseInput(2));
  let clock = kickoff(initLiveMatchClock());
  let lastHome = 0;
  let lastAway = 0;
  for (let m = 1; m <= 30; m += 1) {
    clock = tick(clock);
    const view = computeLiveMatchView(result, clock);
    const goalsThisMinute = result.events.filter((e) => e.minute === m && e.type === "GOAL");
    if (goalsThisMinute.length === 0) {
      assert.equal(view.homeScore, lastHome);
      assert.equal(view.awayScore, lastAway);
    }
    lastHome = view.homeScore;
    lastAway = view.awayScore;
  }
});

test("half-time stats equal exactly the first-half (minute <= 30) event totals", () => {
  const result = simulateMatch(baseInput(3));
  let clock = kickoff(initLiveMatchClock());
  for (let i = 0; i < 30; i += 1) clock = tick(clock);
  const view = computeLiveMatchView(result, clock);
  const expectedHomeGoals = result.events.filter((e) => e.type === "GOAL" && e.side === "home" && e.minute <= 30).length;
  assert.equal(view.homeStats.goals, expectedHomeGoals);
});

test("at full time, live stats exactly equal FastMatchResult's own final stats (hard gate)", () => {
  for (let seed = 0; seed < 20; seed += 1) {
    const result = simulateMatch(baseInput(seed));
    const view = computeLiveMatchView(result, fullMatchClock());
    assert.ok(liveStatsMatchFinal(view, result), `seed ${seed}: live stats must equal FastMatchResult at full time`);
  }
});

test("live player goals equal the result's own player contribution goals at full time -- both home AND away (HM-MATCH-0.2: the opponent is no longer a special case)", () => {
  const result = simulateMatch(baseInput(4));
  const view = computeLiveMatchView(result, fullMatchClock());
  for (const contribution of result.homePlayerContributions) {
    assert.equal(view.homePlayerGoals[contribution.playerId] ?? 0, contribution.goals);
  }
  for (const contribution of result.awayPlayerContributions) {
    assert.equal(view.awayPlayerGoals[contribution.playerId] ?? 0, contribution.goals);
  }
});

test("revealInstantly's view is identical to a fully-ticked-through view for the same result", () => {
  const result = simulateMatch(baseInput(5));
  const viaTicking = computeLiveMatchView(result, fullMatchClock());
  const viaInstant = computeLiveMatchView(result, revealInstantly());
  assert.deepEqual(viaInstant, viaTicking);
});

test("currentAttack reflects the side of the most recently revealed event, not a fabricated percentage", () => {
  const result = simulateMatch(baseInput(6));
  const earliestMinute = result.events[0].minute;
  const eventsAtEarliestMinute = result.events.filter((e) => e.minute === earliestMinute);
  const expectedSide = eventsAtEarliestMinute[eventsAtEarliestMinute.length - 1].side;
  const clock: LiveMatchClock = { phase: "FIRST_HALF", clockMinute: earliestMinute, speed: "X1", timeoutsUsed: { firstHalf: 0, secondHalf: 0 } };
  const view = computeLiveMatchView(result, clock);
  assert.equal(view.currentAttack, expectedSide);
});
