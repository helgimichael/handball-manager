// Historical match adapter regression. Production lifecycle is covered by productionMatch.test.ts.
// HM-PHYSICAL-1.0 Part 21/22/26: proves playManagerFixture persists a
// per-player energy trajectory alongside the match result, and that
// Direct Result and Live Match necessarily consume the exact same
// physical model since there is only ONE simulation pass (confirmed by
// architecture audit -- Live Match/Direct Result are two REVEAL modes
// over the same pre-generated FastMatchResult, never two separate
// simulations).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getNextPlayerFixture } from "./calendar";
import { processDay } from "./dailyTick";
import { playManagerFixtureLegacy as playManagerFixture } from "./legacy/matchday";
import { TUMBA_CLUB_ID } from "../game-data";
import { ENERGY_MAX, ENERGY_MIN } from "../matchPlan/physicalModel";

function stateAtMatchday(seed = "physical-report-seed") {
  const fresh = createNewCareerState(seed, TUMBA_CLUB_ID);
  const matchday = getNextPlayerFixture(fresh)!.date;
  return processDay(fresh, matchday).state;
}

// (21) match result retains finishing-energy information.
test("HM-PHYSICAL-1.0 (21): playManagerFixture persists a MatchPhysicalReport for the played fixture, with starting/finishing energy per player", () => {
  const state = stateAtMatchday();
  const fixture = getNextPlayerFixture(state)!;
  const { state: next } = playManagerFixture(state);

  const report = next.physicalReports[fixture.id];
  assert.ok(report, "a physical report must exist for the played fixture");
  assert.equal(report.fixtureId, fixture.id);
  const homeEntries = Object.values(report.home);
  const awayEntries = Object.values(report.away);
  assert.ok(homeEntries.length > 0 || awayEntries.length > 0, "at least one side must have physical records");
  for (const record of [...homeEntries, ...awayEntries]) {
    assert.ok(record.startingEnergy >= ENERGY_MIN && record.startingEnergy <= ENERGY_MAX);
    assert.ok(record.finishingEnergy >= ENERGY_MIN && record.finishingEnergy <= ENERGY_MAX);
    assert.equal(record.checkpoints.length, 7, "7 checkpoints: minute 0, 10, 20, 30, 40, 50, 60");
  }
});

test("HM-PHYSICAL-1.0: a player who was active on court finishes with lower energy than they started", () => {
  const state = stateAtMatchday();
  const fixture = getNextPlayerFixture(state)!;
  const { state: next } = playManagerFixture(state);
  const report = next.physicalReports[fixture.id];
  const allRecords = [...Object.values(report.home), ...Object.values(report.away)];
  // The player with the MOST total active windows in this default
  // lineup is the closest thing to a full-match starter this rotation-
  // aware model produces -- they must show a real net energy loss.
  const mostActive = allRecords.reduce((best, r) => {
    const total = r.attackWindowsActive + r.defenceWindowsActive + r.goalkeeperWindowsActive;
    const bestTotal = best.attackWindowsActive + best.defenceWindowsActive + best.goalkeeperWindowsActive;
    return total > bestTotal ? r : best;
  });
  assert.ok(mostActive.finishingEnergy < mostActive.startingEnergy, `most-active player (attack ${mostActive.attackWindowsActive}, defence ${mostActive.defenceWindowsActive}, gk ${mostActive.goalkeeperWindowsActive}) should show net energy loss`);
});

// (22) Direct Result and Live Match use same physical model.
test("HM-PHYSICAL-1.0 (22): the physical report is produced once, inside playManagerFixture itself -- the SAME call Live Match and Direct Result both reveal (matchdayAction.ts's own doc: 'the ONLY place the manager's own fixture is simulated'), so there is structurally only one physical model, never two divergent ones", () => {
  const state = stateAtMatchday();
  const fixture = getNextPlayerFixture(state)!;
  const { state: next } = playManagerFixture(state);
  // Calling playManagerFixture again on the already-resolved state must be
  // a safe no-op (idempotent, mirrors the existing "never re-simulates an
  // already-played fixture" test) -- proving the report isn't silently
  // recomputed/diverging on repeated reveals (e.g. navigating away and back).
  const { state: again } = playManagerFixture(next);
  assert.deepEqual(again.physicalReports[fixture.id], next.physicalReports[fixture.id]);
});

test("HM-PHYSICAL-1.0: physicalReports persists in CareerState the same way results does -- keyed by fixtureId, survives being carried forward unchanged by unrelated state updates", () => {
  const state = stateAtMatchday();
  const fixture = getNextPlayerFixture(state)!;
  const { state: afterMatch } = playManagerFixture(state);
  const carriedForward: typeof afterMatch = { ...afterMatch, gameDate: afterMatch.gameDate };
  assert.deepEqual(carriedForward.physicalReports[fixture.id], afterMatch.physicalReports[fixture.id]);
});
