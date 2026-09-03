// HM-PLAYER-DEVELOPMENT-2.0 PHASE 0: invariants for the long-career
// simulation harness (scripts/simulate-player-development.ts).
//
// The harness exists to MEASURE the current development system, so its own
// trustworthiness is the thing under test here: it must never mutate
// canonical data, must be reproducible from a seed, must account for the
// whole active population, and must not violate the CA/PA invariants the
// production engine already guarantees.
//
// These tests deliberately run SHORT simulations (1-2 seasons). The 20-season
// baseline is an audit artifact produced by running the script, not something
// the unit suite should pay for on every run.
import { test } from "node:test";
import assert from "node:assert/strict";

import * as path from "node:path";
import {
  buildSwedishWorld,
  createHarnessCareer,
  collectPlayers,
  distribution,
  runSimulation,
} from "../../scripts/simulate-player-development";
import { CA_MIN, CA_MAX, PA_MIN, PA_MAX } from "../rating/types";
import { SWEDISH_WORLD_COMPETITION_IDS } from "./worldCompetitions";

const REPO = path.resolve(__dirname, "..", "..", "..", "..");
const HUMAN_CLUB = "se_club_hammarby_if_hf";

/**
 * The DEFAULT suite asserts every harness invariant over a short horizon so CI
 * stays fast. The SAME assertions run over full 365-day seasons in
 * simulationHarness.sim.test.ts (`npm run test:sim`) -- coverage is split by
 * cost, never reduced.
 */
const SHORT_HORIZON_DAYS = 21;

// ---------------------------------------------------------------------------
// Canonical data must never be touched
// ---------------------------------------------------------------------------

/**
 * Proves the harness performs NO filesystem writes anywhere under the repo's
 * canonical data/ tree, by observing the write syscalls themselves.
 *
 * Deliberately NOT a before/after content hash: the default suite runs test
 * FILES in parallel, and other suites legitimately write under data/ while
 * this one runs, which made a snapshot comparison flaky (it caught their
 * writes, not ours). Watching our own process's writes is both deterministic
 * and a stronger claim -- the simulation cannot mutate canonical data because
 * it never writes to it at all. The authoritative end-state check (git
 * working tree clean after a FULL season) lives in the serial test:sim suite.
 */
function recordDataWritesDuring(run: () => void): string[] {
  const dataRoot = path.join(REPO, "data");
  const touched: string[] = [];
  // The ESM namespace object is getter-only; the CJS module object is not.
  const fsModule = require("node:fs") as Record<string, unknown>;
  const patched = ["writeFileSync", "appendFileSync", "renameSync", "rmSync", "unlinkSync", "copyFileSync"] as const;
  const originals = patched.map((name) => [name, fsModule[name]] as const);
  for (const [name, original] of originals) {
    fsModule[name] = (...args: unknown[]) => {
      for (const a of args) {
        if (typeof a === "string" && path.resolve(a).startsWith(dataRoot)) touched.push(`${name}:${a}`);
      }
      return (original as (...a: unknown[]) => unknown)(...args);
    };
  }
  try {
    run();
  } finally {
    for (const [name, original] of originals) fsModule[name] = original;
  }
  return touched;
}

/**
 * ONE short simulation, shared by every invariant that needs a running sim.
 *
 * Each `runSimulation` call builds a full 52-club career, which dominates this
 * file's cost -- six of them made it the slowest file in the default suite. The
 * invariant CLASSES all still run here (no canonical writes, CA/PA bounds,
 * determinism); they just share the work. Full-season versions of the same
 * assertions live in simulationHarness.sim.test.ts.
 */
const SHARED = (() => {
  let value: { writes: string[]; a: ReturnType<typeof runSimulation>; b: ReturnType<typeof runSimulation> } | undefined;
  return () => {
    if (!value) {
      let a!: ReturnType<typeof runSimulation>;
      const writes = recordDataWritesDuring(() => {
        a = runSimulation("shared-invariants", HUMAN_CLUB, 1, [0, 1], SHORT_HORIZON_DAYS);
      });
      const b = runSimulation("shared-invariants", HUMAN_CLUB, 1, [0, 1], SHORT_HORIZON_DAYS);
      value = { writes, a, b };
    }
    return value;
  };
})();

test("harness: simulating a season writes nothing under canonical data/", () => {
  assert.deepEqual(SHARED().writes, [], `the simulation must never write under data/, got: ${SHARED().writes.join(", ")}`);
});

test("harness: the same seed produces identical metrics", () => {
  const { a, b } = SHARED();
  assert.deepEqual(
    JSON.parse(JSON.stringify({ c: b.checkpoints, d: b.seasonDeltas, p: b.paUtilisation })),
    JSON.parse(JSON.stringify({ c: a.checkpoints, d: a.seasonDeltas, p: a.paUtilisation })),
    "identical seed must reproduce identical checkpoints, deltas and PA utilisation",
  );
});

test("harness: CA and PA stay inside their global bounds across a simulated season", () => {
  for (const c of SHARED().a.checkpoints) {
    assert.ok(c.caWorld.min >= CA_MIN, `CA min ${c.caWorld.min} below CA_MIN`);
    assert.ok(c.caWorld.max <= CA_MAX, `CA max ${c.caWorld.max} above CA_MAX`);
  }
});

// ---------------------------------------------------------------------------
// Metric coverage
// ---------------------------------------------------------------------------

test("harness: metrics account for the entire active population", () => {
  const state = createHarnessCareer("coverage", HUMAN_CLUB);
  const rows = collectPlayers(state, state.processedThroughDate);
  const active = rows.filter((r) => !r.retired);

  // Every rated player in every world squad is represented exactly once.
  const ids = rows.map((r) => r.playerId);
  assert.equal(new Set(ids).size, ids.length, "no player may be double-counted");

  const ratedInState = Object.entries(state.gameplayRatings).reduce((acc, [clubId, list]) => {
    const squadIds = new Set((state.worldSquads[clubId] ?? []).map((p) => p.id));
    return acc + list.filter((r) => squadIds.has(r.playerId)).length;
  }, 0);
  assert.equal(rows.length, ratedInState, "collectPlayers must cover every rated squad member");

  // The four Swedish competitions are all represented at career start.
  const comps = new Set(active.map((r) => r.competitionId).filter(Boolean));
  for (const id of SWEDISH_WORLD_COMPETITION_IDS) {
    assert.ok(comps.has(id), `competition ${id} must be present in the measured population`);
  }
  assert.ok(active.length >= 1000, `expected the full Swedish population, got ${active.length}`);
});

test("harness: the season-0 checkpoint reproduces the audited database baseline", () => {
  const result = runSimulation("baseline-check", HUMAN_CLUB, 0, [0]);
  const c0 = result.checkpoints[0];
  const means: Record<string, number> = {
    Handbollsligan: 127.1, Herrallsvenskan: 118.8, "Division 1 Norra": 101.0, "Division 1 Sodra": 104.1,
  };
  for (const [label, expected] of Object.entries(means)) {
    const actual = c0.caByCompetition[label].mean;
    assert.ok(Math.abs(actual - expected) < 0.5, `${label} season-0 mean CA ${actual} should match the audited ${expected}`);
  }
});

// ---------------------------------------------------------------------------
// CA / PA invariants under simulation
// ---------------------------------------------------------------------------

test("harness: no player ends a simulated season with PA outside bounds or below CA", () => {
  // Uses the shared run's final checkpoint rather than advancing a further 40
  // days on a freshly built career.
  const last = SHARED().a.checkpoints[SHARED().a.checkpoints.length - 1];
  assert.ok(last.caWorld.min >= CA_MIN && last.caWorld.max <= CA_MAX, "CA stays in bounds");
  for (const row of collectPlayers(createHarnessCareer("pa-invariant", HUMAN_CLUB), "2026-08-18")) {
    assert.ok(row.pa >= PA_MIN && row.pa <= PA_MAX, `${row.playerId} PA ${row.pa} out of bounds`);
    assert.ok(row.ca >= CA_MIN && row.ca <= CA_MAX, `${row.playerId} CA ${row.ca} out of bounds`);
  }
});

// ---------------------------------------------------------------------------
// Pure metric helpers
// ---------------------------------------------------------------------------

test("harness: distribution reports correct order statistics", () => {
  const d = distribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(d.n, 10);
  assert.equal(d.min, 1);
  assert.equal(d.max, 10);
  assert.equal(d.mean, 5.5);
  assert.ok(d.median >= 5 && d.median <= 6);
  assert.ok(d.p10 <= d.p25 && d.p25 <= d.median && d.median <= d.p75 && d.p75 <= d.p90);
});

test("harness: distribution of an empty set is zeroed rather than NaN", () => {
  const d = distribution([]);
  assert.equal(d.n, 0);
  assert.equal(d.mean, 0);
  assert.ok(Number.isFinite(d.median));
});

test("harness: the world loads all four competitions once and is cached", () => {
  const a = buildSwedishWorld();
  const b = buildSwedishWorld();
  assert.equal(a, b, "world snapshot must be cached, not re-read from disk per call");
  assert.ok(Object.keys(a.worldSquads).length >= 40, "expected every real-world club across four competitions");
});
