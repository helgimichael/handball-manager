// MATCH-EXPERIENCE-2.0 M23: the 5:1.
//
// The test that must never be deleted is "the same attack meets a different
// problem". A defensive system is only real if it changes the court -- if 5:1
// and 6:0 produce the same lanes, the same reach and the same gaps, then the
// formation id is a label and the milestone has failed however much machinery
// sits behind it. Everything else here supports that one comparison.
//
// The second thing under test is that 6:0 is untouched. A new system must not
// be bought by changing the old one, so several of these read the 6:0 side of
// the comparison as much as the 5:1 side.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scenario, requireScenarioPlayer } from "../../scenarios/matchScenario";
import { evaluateSixZeroDefense, SIX_ZERO_DEFENSE_FORMATION_ID } from "./sixZeroDefensePolicy";
import { perceiveAttack } from "./collectiveDefense";
import { observeDefensiveThreat } from "./threat";
import { passingLaneControl, perceiveGaps } from "../../simulation/attackDecision";
import { pointControl, constantSpeedProfileOf } from "../../simulation/spatialControl";
import { defensiveReaches } from "../../simulation/defensiveReach";
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import {
  FIVE_ONE_BASE_ROLE_ORDER,
  FIVE_ONE_DEFENSE_FORMATION_ID,
  FIVE_ONE_FRONT_ROLE,
  fiveOneHomePosition,
  frontDefenderRoleOf,
} from "./defensiveSystem";
import type { HandballState } from "../../domain/handball/state";
import type { MeterPoint } from "../../domain/geometry/coordinates";

/** The same central attacking situation, in front of whichever system. */
function attackAgainst(system: string, overrides: Parameters<typeof scenario>[0] = {}): HandballState {
  return scenario({
    ballCarrier: "M9",
    attackers: { M9: { x: 10, y: 12 } },
    defenceSystem: system as never,
    phase: "CIRCULATION",
    ...overrides,
  }).handball;
}

const defendersOf = (state: HandballState) => state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER");

// ---------------------------------------------------------------------------
// 1. Shape
// ---------------------------------------------------------------------------

test("a 5:1 is five men on a line and one in front of it", () => {
  const state = attackAgainst(FIVE_ONE_DEFENSE_FORMATION_ID);
  const defenders = defendersOf(state);
  assert.equal(defenders.length, 6, "still six defenders -- it is a system, not a substitution");

  const front = defenders.find((d) => d.role === FIVE_ONE_FRONT_ROLE);
  const base = defenders.filter((d) => d.role !== FIVE_ONE_FRONT_ROLE);
  assert.ok(front, "there is a man in front");
  assert.equal(base.length, 5, "and five behind him");

  // He is genuinely ahead: further from the goal he defends than every one of them.
  for (const man of base) {
    assert.ok(front.position.y > man.position.y + 2, `the front man is ahead of ${man.role}`);
  }

  // And the five hold the width the six used to.
  const sixZero = defendersOf(attackAgainst(SIX_ZERO_DEFENSE_FORMATION_ID));
  const width = (players: readonly { position: MeterPoint }[]) =>
    Math.max(...players.map((p) => p.position.x)) - Math.min(...players.map((p) => p.position.x));
  assert.ok(width(base) >= width(sixZero) - 0.5, "five men still cover the court, so they stand further apart");
});

test("the base of five is symmetric about the middle of the court", () => {
  const xs = FIVE_ONE_BASE_ROLE_ORDER.map((role) => fiveOneHomePosition(role, "TOP")!.x).sort((a, b) => a - b);
  for (let i = 0; i < Math.floor(xs.length / 2); i += 1) {
    assert.ok(
      Math.abs((xs[i] - 10) + (xs[xs.length - 1 - i] - 10)) < 1e-9,
      `${xs[i].toFixed(2)} and ${xs[xs.length - 1 - i].toFixed(2)} mirror each other`,
    );
  }
  assert.equal(fiveOneHomePosition(FIVE_ONE_FRONT_ROLE, "TOP")!.x, 10, "and the man in front stands in the middle");
});

test("only a 5:1 has a front role", () => {
  assert.equal(frontDefenderRoleOf(SIX_ZERO_DEFENSE_FORMATION_ID), null);
  assert.equal(frontDefenderRoleOf(FIVE_ONE_DEFENSE_FORMATION_ID), FIVE_ONE_FRONT_ROLE);
});

// ---------------------------------------------------------------------------
// 2. The same attack meets a different problem
// ---------------------------------------------------------------------------

test("central play is harder against a 5:1, and the lanes say so", () => {
  const sixZero = attackAgainst(SIX_ZERO_DEFENSE_FORMATION_ID);
  const fiveOne = attackAgainst(FIVE_ONE_DEFENSE_FORMATION_ID);

  const carrier = (state: HandballState) => requireScenarioPlayer(state, "M9");
  // The centre back's own space: how quickly can the defence get to where he stands?
  const spaceAt = (state: HandballState) =>
    pointControl(
      carrier(state).position,
      constantSpeedProfileOf(carrier(state)),
      defendersOf(state).map((d) => constantSpeedProfileOf(d)),
    ).marginSeconds;

  assert.ok(
    spaceAt(fiveOne) < spaceAt(sixZero),
    `the man in front takes time off the centre back (${spaceAt(fiveOne).toFixed(2)}s vs ${spaceAt(sixZero).toFixed(2)}s)`,
  );

  // And somebody can genuinely reach him, which against a flat six nobody could.
  const reachOf = (state: HandballState) => defensiveReaches(state, carrier(state), "TOP")[0];
  assert.ok(
    reachOf(fiveOne).defenderSeconds < reachOf(sixZero).defenderSeconds,
    "the quickest defender to him is quicker in a 5:1",
  );
});

test("the cross-court lane past the front man is a different question from the flat one", () => {
  const sixZero = attackAgainst(SIX_ZERO_DEFENSE_FORMATION_ID);
  const fiveOne = attackAgainst(FIVE_ONE_DEFENSE_FORMATION_ID);
  const lane = (state: HandballState) =>
    passingLaneControl(state, requireScenarioPlayer(state, "M9").position, requireScenarioPlayer(state, "V9").position)
      .marginSeconds;
  assert.notEqual(
    lane(fiveOne).toFixed(3),
    lane(sixZero).toFixed(3),
    "the backcourt pass is contested differently once a man stands in the middle of it",
  );
});

test("the space behind the front man is real, and the attack can see it", () => {
  // The trade a 5:1 makes: pressure at the top, thinner line behind. The gaps
  // the attack perceives must actually differ, or the trade does not exist.
  const carrierAt = { x: 10, y: 12 };
  const sixZero = attackAgainst(SIX_ZERO_DEFENSE_FORMATION_ID, { attackers: { M9: carrierAt } });
  const fiveOne = attackAgainst(FIVE_ONE_DEFENSE_FORMATION_ID, { attackers: { M9: carrierAt } });

  const gapsOf = (state: HandballState) =>
    perceiveGaps(state, "TOP", requireScenarioPlayer(state, "M9")).map((g) => `${g.gapId}:${g.openness.toFixed(2)}`);
  assert.notDeepEqual(gapsOf(fiveOne), gapsOf(sixZero), "the gaps in front of him are not the same gaps");
});

// ---------------------------------------------------------------------------
// 3. What the front man does
// ---------------------------------------------------------------------------

test("the front man presses the carrier, and is the only one who does that job", () => {
  const state = attackAgainst(FIVE_ONE_DEFENSE_FORMATION_ID);
  const result = evaluateSixZeroDefense(state);
  const fronts = result.reactions.filter((r) => r.reactionType === "FRONT");
  assert.equal(fronts.length, 1, "exactly one man plays in front");
  assert.equal(fronts[0].role, FIVE_ONE_FRONT_ROLE);

  // He steps toward the ball rather than standing on a spot.
  const home = fiveOneHomePosition(FIVE_ONE_FRONT_ROLE, "TOP")!;
  const carrier = requireScenarioPlayer(state, "M9");
  assert.ok(
    Math.abs(fronts[0].target.x - carrier.position.x) <= Math.abs(home.x - carrier.position.x) + 1e-9,
    "and he works toward the man with the ball",
  );
});

test("a 6:0 never produces a front defender", () => {
  const result = evaluateSixZeroDefense(attackAgainst(SIX_ZERO_DEFENSE_FORMATION_ID));
  assert.equal(result.reactions.filter((r) => r.reactionType === "FRONT").length, 0);
  assert.equal(result.reactions.length, 6, "and still fields a full line");
});

test("a front man who has been beaten recovers instead of pressing from behind", () => {
  // The carrier is past him, between him and the goal he defends. Pressure from
  // behind a man is not pressure -- M18 established that for the line and it is
  // no more true for the man in front.
  const state = attackAgainst(FIVE_ONE_DEFENSE_FORMATION_ID, { attackers: { M9: { x: 10, y: 8.5 } } });
  const front = state.players.find((p) => p.role === FIVE_ONE_FRONT_ROLE);
  assert.ok(front);
  assert.ok(front.position.y > 8.5, "the fixture really has the carrier past him");

  const result = evaluateSixZeroDefense(state);
  const his = result.reactions.find((r) => r.role === FIVE_ONE_FRONT_ROLE);
  assert.ok(his);
  assert.equal(his.reactionType, "RECOVER", "he turns and goes back to his line");
});

test("the front man does not mark the pivot or hold width -- those are the line's jobs", () => {
  const state = attackAgainst(FIVE_ONE_DEFENSE_FORMATION_ID);
  const result = evaluateSixZeroDefense(state);
  const frontId = state.players.find((p) => p.role === FIVE_ONE_FRONT_ROLE)?.id;
  assert.ok(frontId);
  assert.notEqual(result.pivotMarkerId, frontId, "somebody on the line takes the pivot");
  assert.ok(!result.supportDefenderIds.includes(frontId), "and he is not helping inside the line either");
});

// ---------------------------------------------------------------------------
// 4. The five behind
// ---------------------------------------------------------------------------

test("the five behind stay a coherent line and still cover the pivot", () => {
  const state = attackAgainst(FIVE_ONE_DEFENSE_FORMATION_ID);
  const result = evaluateSixZeroDefense(state);
  assert.ok(result.pivotMarkerId, "somebody is responsible for the line player");

  const perception = perceiveAttack(state, observeDefensiveThreat(state), defendersOf(state) as never);
  assert.ok(perception.attackers.length >= 6, "the defence still sees the whole attack");

  // Everybody who is not the front man has a job on the line.
  const frontId = state.players.find((p) => p.role === FIVE_ONE_FRONT_ROLE)?.id;
  const base = result.reactions.filter((r) => r.defenderId !== frontId);
  assert.equal(base.length, 5);
  assert.ok(base.every((r) => r.reactionType !== "FRONT"), "and none of them is playing in front");
});

// ---------------------------------------------------------------------------
// 5. Seven attackers against it
// ---------------------------------------------------------------------------

test("a 5:1 facing seven attackers stays legal and coherent", () => {
  const state = scenario({
    ballCarrier: "M9",
    attackers: { M9: { x: 10, y: 12 } },
    without: ["GK_ATTACK"],
    extraAttacker: { x: 14.5, y: 6.7 },
    defenceSystem: FIVE_ONE_DEFENSE_FORMATION_ID,
    phase: "CIRCULATION",
  }).handball;

  assert.equal(state.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER").length, 7);
  assert.equal(defendersOf(state).length, 6);

  const result = evaluateSixZeroDefense(state);
  assert.equal(result.implemented, true, "the system still runs");
  assert.equal(result.reactions.length, 6, "every defender still has a job");
  assert.equal(result.reactions.filter((r) => r.reactionType === "FRONT").length, 1, "and one of them is still in front");
  // Deterministic under the same state.
  assert.deepEqual(evaluateSixZeroDefense(state).reactions, result.reactions);
});

// ---------------------------------------------------------------------------
// 6. Symmetry and determinism
// ---------------------------------------------------------------------------

test("the 5:1 is the same defence at either end of the court", () => {
  for (const role of [...FIVE_ONE_BASE_ROLE_ORDER, FIVE_ONE_FRONT_ROLE]) {
    const top = fiveOneHomePosition(role, "TOP")!;
    const bottom = fiveOneHomePosition(role, "BOTTOM")!;
    assert.equal(top.x, bottom.x, `${role} keeps his lane`);
    assert.equal(top.y.toFixed(6), mirrorYForOppositeGoalSide(bottom.y).toFixed(6), `${role} mirrors in depth`);
  }
});

test("the same 5:1 situation is read the same way every time", () => {
  const state = attackAgainst(FIVE_ONE_DEFENSE_FORMATION_ID);
  assert.deepEqual(evaluateSixZeroDefense(state), evaluateSixZeroDefense(state));
});
