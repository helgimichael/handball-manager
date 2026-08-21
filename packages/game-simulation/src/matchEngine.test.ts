import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateMatch, type SimulateMatchInput } from "./matchEngine";
import { seedFromString } from "./rng";
import type { ClubStrength, MatchRosterPlayer } from "./types";

function strength(overrides: Partial<ClubStrength> = {}): ClubStrength {
  return { clubId: "x", overall: 65, attack: 65, defense: 65, goalkeeper: 65, depth: 60, ...overrides };
}

function roster(prefix: string): MatchRosterPlayer[] {
  return [
    { playerId: `${prefix}-gk`, isGoalkeeper: true, scoringWeight: 0, started: true },
    { playerId: `${prefix}-1`, isGoalkeeper: false, scoringWeight: 3, started: true },
    { playerId: `${prefix}-2`, isGoalkeeper: false, scoringWeight: 2, started: true },
    { playerId: `${prefix}-3`, isGoalkeeper: false, scoringWeight: 1.5, started: true },
    { playerId: `${prefix}-4`, isGoalkeeper: false, scoringWeight: 1.5, started: true },
    { playerId: `${prefix}-5`, isGoalkeeper: false, scoringWeight: 1, started: true },
    { playerId: `${prefix}-6`, isGoalkeeper: false, scoringWeight: 1, started: true },
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

test("identical seed -> identical result (1)", () => {
  const a = simulateMatch(baseInput(12345));
  const b = simulateMatch(baseInput(12345));
  assert.deepEqual(a, b);
});

test("different seeds can produce different results (2)", () => {
  const results = new Set<string>();
  for (let seed = 0; seed < 30; seed += 1) {
    const r = simulateMatch(baseInput(seed));
    results.add(`${r.homeGoals}-${r.awayGoals}`);
  }
  assert.ok(results.size > 1, "expected variety across seeds");
});

test("score remains within configured plausible bounds (3)", () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const r = simulateMatch(baseInput(seed));
    assert.ok(r.homeGoals >= 16 && r.homeGoals <= 40, `home goals out of bounds: ${r.homeGoals}`);
    assert.ok(r.awayGoals >= 16 && r.awayGoals <= 40, `away goals out of bounds: ${r.awayGoals}`);
  }
});

test("final event GOAL counts equal final score (4)", () => {
  for (let seed = 0; seed < 50; seed += 1) {
    const r = simulateMatch(baseInput(seed));
    const homeGoalEvents = r.events.filter((e) => e.type === "GOAL" && e.side === "home").length;
    const awayGoalEvents = r.events.filter((e) => e.type === "GOAL" && e.side === "away").length;
    assert.equal(homeGoalEvents, r.homeGoals, `seed ${seed}: home goal events mismatch`);
    assert.equal(awayGoalEvents, r.awayGoals, `seed ${seed}: away goal events mismatch`);
  }
});

test("player goal totals equal team goals (5)", () => {
  for (let seed = 0; seed < 50; seed += 1) {
    const r = simulateMatch(baseInput(seed));
    const homeTotal = r.homePlayerContributions.reduce((sum, p) => sum + p.goals, 0);
    const awayTotal = r.awayPlayerContributions.reduce((sum, p) => sum + p.goals, 0);
    assert.equal(homeTotal, r.homeGoals, `seed ${seed}: home player goal total mismatch`);
    assert.equal(awayTotal, r.awayGoals, `seed ${seed}: away player goal total mismatch`);
  }
});

test("goalkeeper stats remain non-negative and coherent (6)", () => {
  for (let seed = 0; seed < 50; seed += 1) {
    const r = simulateMatch(baseInput(seed));
    const homeGk = r.homePlayerContributions.find((p) => p.playerId === "h-gk")!;
    const awayGk = r.awayPlayerContributions.find((p) => p.playerId === "a-gk")!;
    for (const gk of [homeGk, awayGk]) {
      assert.ok(gk.saves! >= 0, "saves must be non-negative");
      assert.ok(gk.shotsFaced! >= 0, "shotsFaced must be non-negative");
      assert.ok(gk.saves! <= gk.shotsFaced!, "saves cannot exceed shots faced");
      assert.ok(!Number.isNaN(gk.rating));
      assert.ok(gk.rating >= 1 && gk.rating <= 10);
    }
  }
});

test("home advantage affects long-run distribution in a batch test (7)", () => {
  let homeGoalsTotal = 0;
  let awayGoalsTotal = 0;
  const n = 300;
  for (let seed = 0; seed < n; seed += 1) {
    const r = simulateMatch(baseInput(seedFromString(`batch-home-adv-${seed}`)));
    homeGoalsTotal += r.homeGoals;
    awayGoalsTotal += r.awayGoals;
  }
  const homeAvg = homeGoalsTotal / n;
  const awayAvg = awayGoalsTotal / n;
  assert.ok(homeAvg > awayAvg, `expected home advantage to show in long-run average: home=${homeAvg} away=${awayAvg}`);
});

test("stronger team wins more often across a large deterministic sample (8)", () => {
  const strongInput = (seed: number): SimulateMatchInput => ({
    ...baseInput(seed),
    homeStrength: strength({ clubId: "home", overall: 85, attack: 85, defense: 85, goalkeeper: 85, depth: 85 }),
    awayStrength: strength({ clubId: "away", overall: 40, attack: 40, defense: 40, goalkeeper: 40, depth: 40 }),
  });
  let strongWins = 0;
  let weakWins = 0;
  let draws = 0;
  const n = 300;
  for (let seed = 0; seed < n; seed += 1) {
    const r = simulateMatch(strongInput(seedFromString(`batch-strength-${seed}`)));
    if (r.homeGoals > r.awayGoals) strongWins += 1;
    else if (r.homeGoals < r.awayGoals) weakWins += 1;
    else draws += 1;
  }
  assert.ok(strongWins > weakWins, `expected the strong team to win more often: strong=${strongWins} weak=${weakWins} draws=${draws}`);
  assert.ok(weakWins > 0, "expected the weak team to still win occasionally (not always deterministic)");
});

test("draws can occur (9)", () => {
  let draws = 0;
  const n = 400;
  for (let seed = 0; seed < n; seed += 1) {
    const r = simulateMatch(baseInput(seedFromString(`batch-draw-${seed}`)));
    if (r.homeGoals === r.awayGoals) draws += 1;
  }
  assert.ok(draws > 0, "expected at least some draws in a large evenly-matched sample");
});

test("no invalid NaN/negative stats anywhere in the result (10)", () => {
  for (let seed = 0; seed < 100; seed += 1) {
    const r = simulateMatch(baseInput(seed));
    const numericFields = [
      r.homeGoals,
      r.awayGoals,
      r.homeStats.goals,
      r.homeStats.shots,
      r.homeStats.saves,
      r.homeStats.shotsFaced,
      r.homeStats.turnovers,
      r.homeStats.twoMinuteSuspensions,
      r.homeStats.sevenMetreGoals,
      r.homeStats.sevenMetreAttempts,
      r.awayStats.goals,
      r.awayStats.shots,
      r.awayStats.saves,
      r.awayStats.shotsFaced,
    ];
    for (const value of numericFields) {
      assert.ok(!Number.isNaN(value), `NaN found (seed ${seed})`);
      assert.ok(value >= 0, `negative value found (seed ${seed}): ${value}`);
    }
    for (const contribution of [...r.homePlayerContributions, ...r.awayPlayerContributions]) {
      assert.ok(!Number.isNaN(contribution.goals) && contribution.goals >= 0);
      assert.ok(!Number.isNaN(contribution.rating) && contribution.rating >= 1 && contribution.rating <= 10);
    }
  }
});

test("HM-MATCH-0.1: flavour event counts exactly reconstruct final stats", () => {
  for (let seed = 0; seed < 50; seed += 1) {
    const r = simulateMatch(baseInput(seed));
    for (const [side, stats] of [
      ["home", r.homeStats],
      ["away", r.awayStats],
    ] as const) {
      const of = (type: string) => r.events.filter((e) => e.side === side && e.type === type);
      const saves = of("SAVE").length;
      const misses = of("MISS").length;
      const turnovers = of("TURNOVER").length;
      const twoMin = of("TWO_MIN").length;
      const sevenM = of("SEVEN_M");
      const sevenGoals = sevenM.filter((e) => e.sevenMetreOutcome === "GOAL").length;
      const sevenMisses = sevenM.filter((e) => e.sevenMetreOutcome === "MISS").length;

      assert.equal(saves, stats.saves, `seed ${seed} ${side}: SAVE events must equal stats.saves`);
      assert.equal(turnovers, stats.turnovers, `seed ${seed} ${side}: TURNOVER events must equal stats.turnovers`);
      assert.equal(twoMin, stats.twoMinuteSuspensions, `seed ${seed} ${side}: TWO_MIN events must equal stats.twoMinuteSuspensions`);
      assert.equal(sevenGoals, stats.sevenMetreGoals, `seed ${seed} ${side}: SEVEN_M GOAL events must equal stats.sevenMetreGoals`);
      assert.equal(sevenGoals + sevenMisses, stats.sevenMetreAttempts, `seed ${seed} ${side}: SEVEN_M events must equal stats.sevenMetreAttempts`);
      assert.equal(
        misses + saves,
        Math.max(0, stats.shots - stats.goals),
        `seed ${seed} ${side}: MISS + SAVE events must equal non-scoring shots`,
      );
    }
  }
});

test("HM-MATCH-0.1: flavour events never change the score (GOAL count still equals final score)", () => {
  for (let seed = 0; seed < 20; seed += 1) {
    const r = simulateMatch(baseInput(seed));
    const homeGoalEvents = r.events.filter((e) => e.type === "GOAL" && e.side === "home").length;
    const awayGoalEvents = r.events.filter((e) => e.type === "GOAL" && e.side === "away").length;
    assert.equal(homeGoalEvents, r.homeGoals);
    assert.equal(awayGoalEvents, r.awayGoals);
  }
});

test("works with no roster supplied (AI-vs-AI abstract simulation)", () => {
  const input: SimulateMatchInput = {
    fixtureId: "f-2",
    seed: 555,
    homeClubId: "a",
    awayClubId: "b",
    homeStrength: strength({ clubId: "a" }),
    awayStrength: strength({ clubId: "b" }),
  };
  const r = simulateMatch(input);
  assert.equal(r.homePlayerContributions.length, 0);
  assert.equal(r.awayPlayerContributions.length, 0);
  assert.ok(r.homeGoals >= 16 && r.homeGoals <= 40);
});
