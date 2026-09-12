// HUMAN QA CORRECTION: a man on his way to his role is not a pass option.
//
// A human watched a centre throw-off and saw M6 take a pass twenty metres from
// goal, several passes after the restart, standing between two backs like a
// third one. Establishment timing was not the cause and Fix 2B did not claim to
// fix it: the attack had legitimately reached READY. What was wrong was one
// player's responsibility inside it.
//
// The test that must never be deleted is "a returning six-metre player is not
// a candidate at all". The tempting version of this rule ranks him last instead
// of removing him, and that version was written, measured and rejected twice:
// ordinary passes go negative once the distance and commitment penalties apply,
// so a last-resort score keeps winning ties it should never have been in, and
// the reset outlet has a fallback that never consults the ranking anyway.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { scenario, requireScenarioPlayer } from "../scenarios/matchScenario";
import { simulateGameSequence } from "./gameFlow";
import { decideAttackAction } from "./attackDecision";
import { createPossessionRng } from "./possessionRng";
import { attackRoleResponsibilityOf, SIX_METRE_ROLE_DEPTH_METERS, SIX_METRE_ROLES } from "./attackRoleResponsibility";
import { goalCentre } from "../domain/match/possession";
import { distanceBetween } from "../domain/geometry/coordinates";
import type { HandballState } from "../domain/handball/state";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const SIX_METRE_LABELS = new Set(["V6", "H6", "M6", "M6B"]);

// ---------------------------------------------------------------------------
// 1. The responsibility itself
// ---------------------------------------------------------------------------

test("a six-metre player is RETURNING until he reaches his line, and IN_ROLE after", () => {
  const base = scenario({ ballCarrier: "M9" }).handball;
  const pivot = base.players.find((p) => p.team === "ATTACK" && p.role === "PIVOT")!;
  const at = (y: number) => ({ ...pivot, position: { x: 10, y } });
  assert.equal(attackRoleResponsibilityOf(at(20), "TOP"), "RETURNING_TO_ROLE", "still up the court");
  assert.equal(attackRoleResponsibilityOf(at(7), "TOP"), "IN_ROLE", "down on his line");
  assert.equal(
    attackRoleResponsibilityOf(at(SIX_METRE_ROLE_DEPTH_METERS - 0.1), "TOP"),
    "IN_ROLE",
    "and the boundary is where it says it is",
  );
});

test("a back is never returning: working out there is what a back does", () => {
  const base = scenario({ ballCarrier: "M9" }).handball;
  for (const player of base.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER")) {
    if (SIX_METRE_ROLES.includes(player.role)) continue;
    const far = { ...player, position: { x: 10, y: 24 } };
    assert.equal(attackRoleResponsibilityOf(far, "TOP"), "IN_ROLE", `${player.role} has no six-metre job to return to`);
  }
});

// ---------------------------------------------------------------------------
// 2. He is not a candidate -- by construction, not by ranking
// ---------------------------------------------------------------------------

/** An organized attack with the pivot still running back from the halfway line. */
function pivotStillReturning(): HandballState {
  return scenario({
    ballCarrier: "M9",
    attackers: { M9: { x: 10, y: 12 }, V9: { x: 5, y: 11 }, H9: { x: 15, y: 11 }, M6: { x: 10, y: 22 } },
    phase: "CIRCULATION",
  }).handball;
}

function optionsFor(state: HandballState) {
  const carrier = requireScenarioPlayer(state, "M9");
  return decideAttackAction({
    state,
    goalSide: "TOP",
    carrier,
    trigger: "SETTLED",
    drivingGapId: null,
    passesMade: 1,
    resets: 0,
    possessionSeconds: 4,
    lastPasserId: null,
    rng: createPossessionRng(7),
  });
}

test("a returning six-metre player is not a candidate at all", () => {
  // THE ONE THAT MUST NOT BE DELETED. Not "ranked last" -- absent. A future
  // change that reinstates him with a low score will pass nothing here.
  const state = pivotStillReturning();
  const pivot = requireScenarioPlayer(state, "M6");
  assert.equal(attackRoleResponsibilityOf(pivot, "TOP"), "RETURNING_TO_ROLE", "the fixture really has him coming back");
  const decision = optionsFor(state);
  assert.ok(decision.options.length > 0, "the carrier still has things he can do");
  for (const option of decision.options) {
    assert.notEqual(option.targetPlayerId, pivot.id, `${option.kind} must not name a man who is still running back`);
  }
});

test("he is out of the reset outlet too, which has its own fallback", () => {
  // The hole the first version left: the reset option picks its target outside
  // the ranking loop, so filtering inside the loop never touched it and wings
  // kept taking the ball at fourteen and twenty-six metres.
  const state = pivotStillReturning();
  const pivot = requireScenarioPlayer(state, "M6");
  const resets = optionsFor(state).options.filter((o) => o.kind === "RESET");
  assert.ok(resets.length > 0, "there is a reset available");
  for (const option of resets) assert.notEqual(option.targetPlayerId, pivot.id);
});

test("the moment he is in role he is an ordinary receiver again", () => {
  // Nothing reinstates him: the same question simply starts answering yes.
  const state = pivotStillReturning();
  const pivot = requireScenarioPlayer(state, "M6");
  const arrived: HandballState = {
    ...state,
    players: state.players.map((p) => (p.id === pivot.id ? { ...p, position: { x: 10.5, y: 6.8 } } : p)),
  };
  assert.equal(attackRoleResponsibilityOf(requireScenarioPlayer(arrived, "M6"), "TOP"), "IN_ROLE");
  const named = optionsFor(arrived).options.filter((o) => o.targetPlayerId === pivot.id);
  assert.ok(named.length > 0, "he is back on the menu, with no announcement");
  assert.ok(named.some((o) => o.kind === "PLAY_PIVOT"), "including as the pivot he is");
});

// ---------------------------------------------------------------------------
// 3. Through real restarts
// ---------------------------------------------------------------------------

test("a six-metre player may throw off, then runs to his line, and takes no pass on the way", () => {
  let threwOffHigh = 0;
  let travelled = 0;
  let passesToSixMetre = 0;
  let passesWhileReturning = 0;

  for (const seed of [12, 3, 7, 21, 44, 2, 9, 15]) {
    const run = simulateGameSequence(TOP, seed, { maxPossessions: 40 });

    for (const segment of run.segments.filter((s) => s.kind === "CENTRE_RESTART")) {
      const entries = run.trace.filter(
        (e) => e.possessionNumber === segment.possessionNumber && e.possessionTeam === segment.team,
      );
      const goal = goalCentre(segment.attackingGoalSide);
      const first = entries.find((e) => /centre restart/.test(e.note)) ?? entries[0];
      const thrower = first?.ballPossessorId;
      if (!thrower) continue;
      const start = first.playerPositions.find((p) => p.playerId === thrower);
      const end = entries[entries.length - 1].playerPositions.find((p) => p.playerId === thrower);
      if (!start || !end) continue;
      const from = distanceBetween(start.position, goal);
      if (from <= SIX_METRE_ROLE_DEPTH_METERS) continue;
      threwOffHigh += 1;
      if (distanceBetween(end.position, goal) < from - 2) travelled += 1;
    }

    // Every reception by a six-metre role that was actually a PASS -- somebody
    // on the same side held the ball immediately before it.
    for (let i = 1; i < run.trace.length; i += 1) {
      const entry = run.trace[i];
      const label = /^([A-Z0-9]+) \S+ receives/.exec(entry.note)?.[1];
      if (!label || !SIX_METRE_LABELS.has(label) || !entry.ballPossessorId) continue;
      const receiver = entry.playerPositions.find((p) => p.playerId === entry.ballPossessorId);
      if (!receiver) continue;
      let previous: string | null = null;
      for (
        let k = i - 1;
        k >= 0 &&
        run.trace[k].possessionNumber === entry.possessionNumber &&
        run.trace[k].possessionTeam === entry.possessionTeam;
        k -= 1
      ) {
        if (run.trace[k].ballPossessorId) {
          previous = run.trace[k].ballPossessorId;
          break;
        }
      }
      if (previous === null || previous === entry.ballPossessorId) continue; // a possession beginning, not a pass
      passesToSixMetre += 1;
      if (distanceBetween(receiver.position, goalCentre(entry.attackingGoalSide)) > SIX_METRE_ROLE_DEPTH_METERS) {
        passesWhileReturning += 1;
      }
    }
  }

  assert.ok(threwOffHigh > 10, `six-metre players really do take throw-offs (${threwOffHigh})`);
  assert.equal(travelled, threwOffHigh, "and every one of them then runs toward his line");
  assert.ok(passesToSixMetre > 100, `they receive plenty of passes once they are there (${passesToSixMetre})`);
  assert.equal(passesWhileReturning, 0, "and none at all while still returning");
});
