// MATCH-EXPERIENCE-2.0 M16: the match bench.
//
// The test that must never be deleted is "the bench measures and never
// changes". A benchmark that could influence what it measures is worse than no
// benchmark: every future comparison made with it would be against a number the
// tool itself moved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulateMatch } from "../simulation/matchRunner";
import { autonomousCoach } from "../simulation/coach";
import { buildCanonicalMatchEvents, eventsOfType, goalsFromEvents } from "../simulation/canonicalEvents";
import { DEFAULT_BENCH_SEEDS, formatBenchReport, measureMatch, runMatchBench } from "./matchBench";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });
/** A short set, so the tests below stay quick. The bench's own default is the full 24. */
const SEEDS = [12, 7, 33] as const;

// ---------------------------------------------------------------------------
// 1. Deterministic
// ---------------------------------------------------------------------------

test("the same config and seeds always produce the same report", () => {
  const a = runMatchBench({ seeds: SEEDS });
  const b = runMatchBench({ seeds: SEEDS });
  assert.deepEqual(b, a, "identical reports");
  assert.equal(formatBenchReport(b), formatBenchReport(a), "and identical output, so two runs diff cleanly");

  // Different seeds are a different question, and the report says which it asked.
  const other = runMatchBench({ seeds: [1, 3, 5] });
  assert.notDeepEqual(other.rows, a.rows);
  assert.deepEqual(a.seeds, SEEDS, "the report carries its own seed set");
  assert.ok(formatBenchReport(a).includes(SEEDS.join(", ")), "and prints it");
});

test("the seed set is explicit and fixed", () => {
  assert.equal(DEFAULT_BENCH_SEEDS.length, 24, "a modest, stated set");
  assert.equal(new Set(DEFAULT_BENCH_SEEDS).size, DEFAULT_BENCH_SEEDS.length, "with no repeats");
  assert.deepEqual([...DEFAULT_BENCH_SEEDS], [...DEFAULT_BENCH_SEEDS].sort((x, y) => x - y), "in a stated order");
  // Frozen, so nothing can quietly change what "the bench" means at runtime.
  assert.throws(() => (DEFAULT_BENCH_SEEDS as number[]).push(999));
});

// ---------------------------------------------------------------------------
// 2. DO NOT DELETE: the bench measures and never changes
// ---------------------------------------------------------------------------

test("the bench measures and never changes what it measures", () => {
  const report = runMatchBench({ seeds: SEEDS });
  for (const row of report.rows) {
    // The same seed played directly, without the bench anywhere near it.
    const direct = simulateMatch(TOP, row.seed, { coaches: { HOME: autonomousCoach(), AWAY: autonomousCoach() } });
    assert.equal(row.homeGoals, direct.finalScore.HOME, `seed ${row.seed}: the bench reports the match's own home score`);
    assert.equal(row.awayGoals, direct.finalScore.AWAY, `seed ${row.seed}: and its own away score`);
    assert.equal(row.possessions, direct.totalPossessions, "and its own possession count");
    assert.equal(row.segments, direct.totalSegments);
    assert.equal(row.simulationSeconds, Math.round(direct.simulationSeconds * 10) / 10);
  }
});

test("bench metrics reconcile with the canonical events and the final score", () => {
  for (const seed of SEEDS) {
    const match = simulateMatch(TOP, seed, { coaches: { HOME: autonomousCoach(), AWAY: autonomousCoach() } });
    const events = buildCanonicalMatchEvents(match);
    const row = measureMatch(seed, match, events);

    // Goals: the row, the events and the match all agree.
    const goals = goalsFromEvents(events);
    assert.equal(row.goals, row.homeGoals + row.awayGoals);
    assert.equal(row.homeGoals, goals.HOME, `seed ${seed}: home goals`);
    assert.equal(row.awayGoals, goals.AWAY);
    assert.equal(row.goals, match.finalScore.HOME + match.finalScore.AWAY, "and the final score");

    // Shots partition into the four outcomes, and on-target is goals + saves.
    const shots = eventsOfType(events, "SHOT");
    assert.equal(row.shots, shots.length);
    assert.equal(row.onTarget + row.missed + row.blocked, row.shots, "every shot is on target, off target or blocked");
    assert.equal(row.onTarget, row.goals + row.saves, "on target is what was scored plus what was stopped");

    // The rule and bench counts are the events' own counts.
    assert.equal(row.turnovers, eventsOfType(events, "TURNOVER").length);
    assert.equal(row.suspensions, eventsOfType(events, "SUSPENSION").length);
    assert.equal(row.substitutions, eventsOfType(events, "SUBSTITUTION_COMPLETED").length);
    assert.equal(row.timeouts, eventsOfType(events, "TIMEOUT_STARTED").length);
    assert.equal(row.sevenMetreAttempts, shots.filter((s) => s.sevenMetre).length);
    assert.ok(row.sevenMetreGoals <= row.sevenMetreAttempts, "a 7 metre cannot be scored more often than it is taken");
    assert.equal(row.freeThrows, eventsOfType(events, "FOUL").filter((f) => f.restart === "FREE_THROW").length);
  }
});

test("the reported rates are the reported counts", () => {
  const report = runMatchBench({ seeds: SEEDS });
  const total = (key: "goals" | "shots" | "onTarget" | "saves" | "possessions" | "turnovers") =>
    report.rows.reduce((sum, row) => sum + row[key], 0);

  assert.equal(report.rates.goalsPerPossession, total("goals") / total("possessions"));
  assert.equal(report.rates.shotConversion, total("goals") / total("shots"));
  assert.equal(report.rates.goalkeeperSaveRate, total("saves") / total("onTarget"));
  assert.equal(report.rates.shotsPerPossession, total("shots") / total("possessions"));
  assert.equal(report.rates.turnoverRate, total("turnovers") / total("possessions"));

  // Symmetry is counted, not asserted -- the bench reports it and a human reads it.
  assert.equal(report.symmetry.homeGoals + report.symmetry.awayGoals, total("goals"));
  assert.ok(report.symmetry.homeShare >= 0 && report.symmetry.homeShare <= 1);
});

test("the report is a distribution, not just an average", () => {
  const report = runMatchBench({ seeds: SEEDS });
  for (const [metric, d] of Object.entries(report.counts)) {
    assert.ok(d.min <= d.p25 && d.p25 <= d.median && d.median <= d.p75 && d.p75 <= d.max, `${metric} quantiles are ordered`);
    assert.ok(d.mean >= d.min && d.mean <= d.max, `${metric} mean lies inside its own range`);
  }
  const text = formatBenchReport(report);
  assert.ok(text.includes("goals/possession") && text.includes("GK save rate") && text.includes("SYMMETRY"));
  assert.ok(text.includes("possessions") && text.includes("substitutions") && text.includes("timeouts"));
});

test("the bench can be run without the coaches, and says nothing else changed", () => {
  const coached = runMatchBench({ seeds: [12] });
  const uncoached = runMatchBench({ seeds: [12], coached: false });
  assert.equal(coached.rows[0].timeouts > 0 || coached.rows[0].interventions > 0, true, "the coached run has coaching in it");
  assert.equal(uncoached.rows[0].timeouts, 0, "the uncoached one has none");
  assert.equal(uncoached.rows[0].interventions, 0);
  // Both are still complete, legal matches.
  for (const report of [coached, uncoached]) {
    assert.ok(report.rows[0].possessions > 50, "a real match was played");
    assert.equal(report.rows[0].onTarget, report.rows[0].goals + report.rows[0].saves);
  }
});
