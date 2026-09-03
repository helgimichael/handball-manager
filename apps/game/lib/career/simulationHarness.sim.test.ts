// HM-PLAYER-DEVELOPMENT-2.0 PHASE 0.5: the EXPENSIVE long-career harness
// validation. Run with `npm run test:sim`, not the default suite.
//
// simulationHarness.test.ts asserts the same invariants over a short horizon
// so ordinary CI stays fast; this file re-asserts them over FULL 365-day
// seasons, plus the cross-seed stability and git-cleanliness checks that only
// mean something at full season length. Coverage is split by cost, not
// reduced.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { runSimulation } from "../../scripts/simulate-player-development";

const REPO = path.resolve(__dirname, "..", "..", "..", "..");
const HUMAN_CLUB = "se_club_hammarby_if_hf";

test("harness: git reports no working-tree change under data/ after a simulation", () => {
  runSimulation("no-git-change", HUMAN_CLUB, 1, [0, 1]);
  const dirty = execSync("git status --porcelain -z -- data/", { cwd: REPO, maxBuffer: 1 << 26 })
    .toString()
    .split("\0")
    .filter(Boolean);
  assert.deepEqual(dirty, [], `simulation dirtied canonical data: ${dirty.join(", ")}`);
});

test("harness: a different seed varies outcomes without structural instability", () => {
  const a = runSimulation("seed-alpha", HUMAN_CLUB, 1, [0, 1]);
  const b = runSimulation("seed-beta", HUMAN_CLUB, 1, [0, 1]);
  const endA = a.checkpoints[a.checkpoints.length - 1];
  const endB = b.checkpoints[b.checkpoints.length - 1];
  // Structural stability: population stays in the same order of magnitude.
  const ratio = endA.totalActive / endB.totalActive;
  assert.ok(ratio > 0.8 && ratio < 1.25, `population must stay comparable across seeds (ratio ${ratio.toFixed(3)})`);
  assert.ok(Math.abs(endA.caWorld.mean - endB.caWorld.mean) < 10, "world mean CA must not swing wildly between seeds");
});

test("sim: a full season is deterministic end to end", () => {
  const a = runSimulation("full-season-determinism", HUMAN_CLUB, 1, [0, 1]);
  const b = runSimulation("full-season-determinism", HUMAN_CLUB, 1, [0, 1]);
  assert.equal(
    JSON.stringify({ c: a.checkpoints, d: a.seasonDeltas, p: a.paUtilisation }),
    JSON.stringify({ c: b.checkpoints, d: b.seasonDeltas, p: b.paUtilisation }),
    "a full simulated season must reproduce byte-identically from the same seed",
  );
});

test("sim: three full seasons advance without a blocker", () => {
  const result = runSimulation("multi-season", HUMAN_CLUB, 3, [0, 3]);
  assert.deepEqual(result.blockers, [], `simulation hit a blocker: ${result.blockers.join("; ")}`);
  assert.equal(result.timings.seasonsSimulated, 3);
  assert.equal(result.seasonDeltas.length, 3);
});
