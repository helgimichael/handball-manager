import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePlayerDecision } from "./playerDecision";

function baseInputs(overrides: Partial<Parameters<typeof evaluatePlayerDecision>[0]> = {}) {
  return {
    playerId: "p-1",
    currentWageEurPerMonth: 1000,
    offeredWageEurPerMonth: 1000,
    currentClubTier: 2 as const,
    newClubTier: 2 as const,
    currentSquadStatus: "Rotation" as const,
    currentClubPressure: "NONE" as const,
    ...overrides,
  };
}

test("(1) a big wage rise is accepted", () => {
  const result = evaluatePlayerDecision(baseInputs({ offeredWageEurPerMonth: 2000 }));
  assert.ok(result.accept);
});

test("(2) a big wage cut with no other upside is rejected", () => {
  const result = evaluatePlayerDecision(baseInputs({ offeredWageEurPerMonth: 300 }));
  assert.ok(!result.accept);
});

test("(3) a move up from tier 2 to tier 1 with an equal wage is attractive (positive tier delta)", () => {
  const lateral = evaluatePlayerDecision(baseInputs({ currentClubTier: 2, newClubTier: 2 }));
  const upgrade = evaluatePlayerDecision(baseInputs({ currentClubTier: 2, newClubTier: 1 }));
  assert.ok(!lateral.accept || upgrade.accept); // upgrade must be at least as attractive as lateral
});

test("(4) a downgrade from tier 1 to tier 2 with an equal wage is less attractive than staying level", () => {
  const lateral = evaluatePlayerDecision(baseInputs({ currentClubTier: 1, newClubTier: 1 }));
  const downgrade = evaluatePlayerDecision(baseInputs({ currentClubTier: 1, newClubTier: 2 }));
  assert.ok(lateral.accept);
  assert.ok(!downgrade.accept);
});

test("(5) a player at a financially CRITICAL club is more willing to accept a wage cut than one at a stable club", () => {
  const stable = evaluatePlayerDecision(baseInputs({ offeredWageEurPerMonth: 400, currentClubPressure: "NONE" }));
  const critical = evaluatePlayerDecision(baseInputs({ offeredWageEurPerMonth: 400, currentClubPressure: "CRITICAL" }));
  assert.ok(!stable.accept);
  assert.ok(critical.accept);
});

test("(6) a Förstaval (starter) player is harder to lure away with a modest pay cut than a Rotation player", () => {
  const rotation = evaluatePlayerDecision(baseInputs({ offeredWageEurPerMonth: 700, currentSquadStatus: "Rotation" }));
  const forstaval = evaluatePlayerDecision(baseInputs({ offeredWageEurPerMonth: 700, currentSquadStatus: "Förstaval" }));
  assert.ok(rotation.accept);
  assert.ok(!forstaval.accept);
});

test("(7) is deterministic -- identical inputs always produce the identical decision", () => {
  const inputs = baseInputs({ offeredWageEurPerMonth: 1200 });
  assert.deepEqual(evaluatePlayerDecision(inputs), evaluatePlayerDecision(inputs));
});

test("(8) different players facing the identical offer can decide differently (deterministic per-player jitter, not a single global rule)", () => {
  const decisions = Array.from({ length: 30 }, (_, i) => evaluatePlayerDecision(baseInputs({ playerId: `player-${i}`, offeredWageEurPerMonth: 700 })).accept);
  assert.ok(new Set(decisions).size > 1, "every player decided identically -- jitter is not varying anything");
});
