// MATCH-EXPERIENCE-2.0 M24: the 3:2:1.
//
// The test that must never be deleted is "one attack, three different
// problems". A third system is only worth having if the same attacking state
// meets something genuinely different in front of it than it does against a
// 6:0 or a 5:1. If the three produce the same lanes and the same gaps, the
// engine has three names for one defence.
//
// The second thing under test is the handover. A three-layer defence is held
// together by men GIVING THREATS UP -- the point man to the half-spaces, the
// half-spaces to the line -- and the failure mode is a defender who keeps
// chasing, which is man-marking with extra steps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scenario, requireScenarioPlayer } from "../../scenarios/matchScenario";
import { evaluateSixZeroDefense, SIX_ZERO_DEFENSE_FORMATION_ID } from "./sixZeroDefensePolicy";
import { passingLaneControl, perceiveGaps } from "../../simulation/attackDecision";
import { pointControl, constantSpeedProfileOf } from "../../simulation/spatialControl";
import { defensiveReaches } from "../../simulation/defensiveReach";
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import {
  FIVE_ONE_DEFENSE_FORMATION_ID,
  THREE_TWO_ONE_BASE_ROLE_ORDER,
  THREE_TWO_ONE_DEFENSE_FORMATION_ID,
  THREE_TWO_ONE_INTERMEDIATE_ROLES,
  defensiveHomePosition,
  defensiveLayerOf,
  frontDefenderRoleOf,
  intermediateRolesOf,
} from "./defensiveSystem";
import type { HandballState } from "../../domain/handball/state";
import type { DefenseRole } from "../../domain/handball/player";

const SIX_ZERO = SIX_ZERO_DEFENSE_FORMATION_ID;
const FIVE_ONE = FIVE_ONE_DEFENSE_FORMATION_ID;
const THREE_TWO_ONE = THREE_TWO_ONE_DEFENSE_FORMATION_ID;

/** The same attacking situation, in front of whichever system. */
function attackAgainst(system: string, overrides: Parameters<typeof scenario>[0] = {}): HandballState {
  return scenario({
    ballCarrier: "M9",
    attackers: { M9: { x: 10, y: 13 } },
    defenceSystem: system as never,
    phase: "CIRCULATION",
    ...overrides,
  }).handball;
}

const defendersOf = (state: HandballState) => state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER");
const layerOf = (role: DefenseRole) => defensiveLayerOf(THREE_TWO_ONE, role);
const reactionFor = (state: HandballState, role: DefenseRole) =>
  evaluateSixZeroDefense(state).reactions.find((r) => r.role === role);

// ---------------------------------------------------------------------------
// 1. Shape and layers
// ---------------------------------------------------------------------------

test("a 3:2:1 is three, then two, then one", () => {
  const state = attackAgainst(THREE_TWO_ONE);
  const defenders = defendersOf(state);
  assert.equal(defenders.length, 6, "still six men -- it is a system, not a substitution");

  const counts = { BASE: 0, INTERMEDIATE: 0, FRONT: 0 };
  for (const d of defenders) counts[layerOf(d.role as DefenseRole)] += 1;
  assert.deepEqual(counts, { BASE: 3, INTERMEDIATE: 2, FRONT: 1 });
});

test("the three depths are genuinely distinct, and in the right order", () => {
  const depth = (role: DefenseRole) => defensiveHomePosition(THREE_TWO_ONE, role, "TOP")!.y;
  const base = THREE_TWO_ONE_BASE_ROLE_ORDER.map(depth);
  const middle = THREE_TWO_ONE_INTERMEDIATE_ROLES.map(depth);
  const front = depth(frontDefenderRoleOf(THREE_TWO_ONE)!);

  assert.ok(Math.max(...base) < Math.min(...middle) - 2, "the line is clearly behind the half-spaces");
  assert.ok(Math.max(...middle) < front - 2, "and the half-spaces clearly behind the point");
});

test("the 3:2:1 is symmetric about the middle of the court", () => {
  const x = (role: DefenseRole) => defensiveHomePosition(THREE_TWO_ONE, role, "TOP")!.x;
  assert.equal(x("L1") + x("R1"), 20, "the two outside men mirror each other");
  assert.equal(x("L2") + x("R2"), 20, "and so do the two half-space men");
  assert.equal(x("R3"), 10, "the middle of the line is in the middle");
  assert.equal(x(frontDefenderRoleOf(THREE_TWO_ONE)!), 10, "and so is the point");
});

test("only the systems that have layers report them", () => {
  assert.deepEqual(intermediateRolesOf(SIX_ZERO), []);
  assert.deepEqual(intermediateRolesOf(FIVE_ONE), [], "a 5:1 has a point and a line, and nothing between");
  assert.deepEqual(intermediateRolesOf(THREE_TWO_ONE), THREE_TWO_ONE_INTERMEDIATE_ROLES);
  for (const role of ["L1", "L2", "L3", "R3", "R2", "R1"] as const) {
    assert.equal(defensiveLayerOf(SIX_ZERO, role), "BASE", "every man in a flat system is in the line");
  }
});

// ---------------------------------------------------------------------------
// 2. One attack, three different problems
// ---------------------------------------------------------------------------

test("the same central attack meets measurably different space in all three systems", () => {
  const carrier = (state: HandballState) => requireScenarioPlayer(state, "M9");
  const spaceAt = (state: HandballState) =>
    pointControl(
      carrier(state).position,
      constantSpeedProfileOf(carrier(state)),
      defendersOf(state).map((d) => constantSpeedProfileOf(d)),
    ).marginSeconds;

  const six = spaceAt(attackAgainst(SIX_ZERO));
  const five = spaceAt(attackAgainst(FIVE_ONE));
  const three = spaceAt(attackAgainst(THREE_TWO_ONE));

  assert.ok(five < six, `a 5:1 takes time off the centre back (${five.toFixed(2)}s vs ${six.toFixed(2)}s)`);
  assert.ok(three < six, `and so does a 3:2:1 (${three.toFixed(2)}s vs ${six.toFixed(2)}s)`);
  assert.equal(new Set([six.toFixed(3), five.toFixed(3), three.toFixed(3)]).size, 3, "and all three differ");
});

test("the half-space lane is a different question in each system", () => {
  // Centre back to left back: the pass a 3:2:1's left half-space man exists to
  // contest, and which a flat six leaves alone.
  const lane = (system: string) => {
    const state = attackAgainst(system);
    return passingLaneControl(
      state,
      requireScenarioPlayer(state, "M9").position,
      requireScenarioPlayer(state, "V9").position,
    ).marginSeconds;
  };
  const values = [lane(SIX_ZERO), lane(FIVE_ONE), lane(THREE_TWO_ONE)].map((v) => v.toFixed(3));
  assert.equal(new Set(values).size, 3, `the backcourt pass is contested three different ways (${values.join(" / ")})`);
});

test("the gaps a carrier can attack differ against a three-layer defence", () => {
  const gapsOf = (system: string) => {
    const state = attackAgainst(system, { attackers: { M9: { x: 10, y: 9 } } });
    return perceiveGaps(state, "TOP", requireScenarioPlayer(state, "M9"))
      .map((g) => `${g.gapId}:${g.openness.toFixed(2)}`)
      .join("|");
  };
  assert.notEqual(gapsOf(THREE_TWO_ONE), gapsOf(SIX_ZERO), "three men across the line is not six");

  // And what this deliberately does NOT assert, because it is not true: gap
  // OPENNESS does not separate a 3:2:1 from a 5:1. M6's openness measure
  // saturates at 1.0 once the line has fewer than six men in it, so both read
  // as wide open and the metric has nothing left to say. The attack still tells
  // the two apart -- through lane control and reach, which the tests above
  // measure -- but not through this number, and pretending otherwise would be
  // asserting something the engine does not do.
  assert.equal(gapsOf(THREE_TWO_ONE), gapsOf(FIVE_ONE), "openness saturates on any thinned line; the difference is in the lanes");
});

test("the wing has more room against a 3:2:1, because its outside men came inside", () => {
  // A statement about SPACE and only about space. The three-man line is tighter
  // than a six-man one, so its outside men stand further in and the man on the
  // touchline is less contested. Whether the attack then USES that room is a
  // different question and not this test's -- measured over the bench the
  // 3:2:1 actually concedes fewer wing shots, which is worth knowing and is not
  // what "there is space there" claims.
  const wingSpace = (system: string) => {
    const state = attackAgainst(system, { attackers: { M9: { x: 10, y: 12 }, V6: { x: 1.2, y: 4.0 } } });
    const wing = requireScenarioPlayer(state, "V6");
    return pointControl(
      wing.position,
      constantSpeedProfileOf(wing),
      defendersOf(state).map((d) => constantSpeedProfileOf(d)),
    ).marginSeconds;
  };
  assert.ok(
    wingSpace(THREE_TWO_ONE) > wingSpace(SIX_ZERO),
    `the wing has more room against a 3:2:1 (${wingSpace(THREE_TWO_ONE).toFixed(2)}s vs ${wingSpace(SIX_ZERO).toFixed(2)}s)`,
  );
});

// ---------------------------------------------------------------------------
// 3. What each layer does
// ---------------------------------------------------------------------------

test("the point man presses, and exactly one man does", () => {
  const result = evaluateSixZeroDefense(attackAgainst(THREE_TWO_ONE));
  assert.equal(result.reactions.filter((r) => r.reactionType === "FRONT").length, 1);
});

test("a half-space defender steps out at a back in his own half of the court", () => {
  // The left back on the ball, near the left half-space: L2's man.
  const state = attackAgainst(THREE_TWO_ONE, { ballCarrier: "V9", attackers: { V9: { x: 5.5, y: 11.0 } } });
  const his = reactionFor(state, "L2");
  assert.ok(his);
  assert.equal(his.reactionType, "STEP_OUT", "he comes forward out of the middle layer");
  assert.ok(his.target.y > defensiveHomePosition(THREE_TWO_ONE, "L1", "TOP")!.y, "and is ahead of the line while he does");
});

test("a half-space defender does not follow a man across the court", () => {
  // The same threat, on the OTHER side. R2's man, not L2's -- and L2 going
  // after him would be man-marking, which is the thing a layer is not.
  const state = attackAgainst(THREE_TWO_ONE, { ballCarrier: "H9", attackers: { H9: { x: 14.5, y: 11.0 } } });
  const wrongSide = reactionFor(state, "L2");
  const rightSide = reactionFor(state, "R2");
  assert.ok(wrongSide && rightSide);
  assert.equal(rightSide.reactionType, "STEP_OUT", "the man whose half it is takes him");
  assert.notEqual(wrongSide.reactionType, "STEP_OUT", "and the man whose half it is not, does not");
});

test("a half-space defender who has been gone past hands the man on instead of chasing", () => {
  // THE handover. The carrier is between him and the goal he defends: that is
  // the base's problem now, and his job is to get back into his layer.
  const state = attackAgainst(THREE_TWO_ONE, { ballCarrier: "V9", attackers: { V9: { x: 5.8, y: 5.5 } } });
  const home = defensiveHomePosition(THREE_TWO_ONE, "L2", "TOP")!;
  assert.ok(home.y > 5.5, "the fixture really has the carrier past him");
  const his = reactionFor(state, "L2");
  assert.ok(his);
  assert.equal(his.reactionType, "RECOVER", "he recovers rather than chasing from behind");
});

test("the point man hands on too, when he is beaten", () => {
  const state = attackAgainst(THREE_TWO_ONE, { attackers: { M9: { x: 10, y: 9.0 } } });
  const his = reactionFor(state, frontDefenderRoleOf(THREE_TWO_ONE)!);
  assert.ok(his);
  assert.equal(his.reactionType, "RECOVER");
});

test("a threat moving from the point through the half-space to the line changes owner each time", () => {
  // The same man, three depths, and each layer in turn is the one doing
  // something about him. Nobody follows him down the court.
  const at = (y: number) => attackAgainst(THREE_TWO_ONE, { ballCarrier: "V9", attackers: { V9: { x: 6.0, y } } });
  const front = frontDefenderRoleOf(THREE_TWO_ONE)!;

  const high = at(13.5);
  const middle = at(10.5);
  const low = at(5.0);

  // Deep in his own half, the half-space man is the one who commits.
  assert.equal(reactionFor(middle, "L2")?.reactionType, "STEP_OUT", "the half-space takes him at half-space depth");
  // Once he is past that layer, its man is recovering and the line has him.
  assert.equal(reactionFor(low, "L2")?.reactionType, "RECOVER", "and gives him up once he is through");
  const lineHasHim = evaluateSixZeroDefense(low);
  assert.ok(
    lineHasHim.primaryDefenderId !== null || lineHasHim.pivotMarkerId !== null,
    "somebody on the line is responsible for him now",
  );
  // And high up, the point man is still in front of him.
  assert.equal(reactionFor(high, front)?.reactionType, "FRONT", "while high up it was the point man's problem");
});

test("space really can open behind a committed half-space defender", () => {
  // He steps out; the ground he vacated is measurably easier for the attack to
  // reach than it was before he moved. That is the cost of the layer, and it
  // has to be real or the system is free.
  const state = attackAgainst(THREE_TWO_ONE, { ballCarrier: "V9", attackers: { V9: { x: 5.5, y: 11.0 } } });
  const stepping = reactionFor(state, "L2");
  assert.ok(stepping && stepping.reactionType === "STEP_OUT");

  const vacated = defensiveHomePosition(THREE_TWO_ONE, "L2", "TOP")!;
  const carrier = requireScenarioPlayer(state, "V9");
  const before = pointControl(
    vacated,
    constantSpeedProfileOf(carrier),
    defendersOf(state).map((d) => constantSpeedProfileOf(d)),
  ).marginSeconds;
  const after = pointControl(
    vacated,
    constantSpeedProfileOf(carrier),
    defendersOf(state).map((d) => constantSpeedProfileOf(d.id === stepping.defenderId ? { ...d, position: stepping.target } : d)),
  ).marginSeconds;
  assert.ok(after > before, `the space behind him opens as he goes (${after.toFixed(2)}s vs ${before.toFixed(2)}s)`);
});

// ---------------------------------------------------------------------------
// 4. The three behind
// ---------------------------------------------------------------------------

test("the line of three stays coherent and still covers the pivot", () => {
  const state = attackAgainst(THREE_TWO_ONE);
  const result = evaluateSixZeroDefense(state);
  assert.ok(result.pivotMarkerId, "somebody is responsible for the line player");

  const markerRole = state.players.find((p) => p.id === result.pivotMarkerId)?.role as DefenseRole;
  assert.equal(layerOf(markerRole), "BASE", "and he is one of the three, not a man pulled out of a forward layer");
});

test("three men cannot cover six attackers", () => {
  const state = attackAgainst(THREE_TWO_ONE);
  const result = evaluateSixZeroDefense(state);
  const accounted = new Set(
    [result.primaryDefenderId, result.pivotMarkerId, ...result.supportDefenderIds].filter((id): id is string => id !== null),
  );
  assert.ok(accounted.size < 6, "being outnumbered in the layers behind is a real cost");
});

// ---------------------------------------------------------------------------
// 5. Seven attackers
// ---------------------------------------------------------------------------

test("a 3:2:1 facing seven attackers stays legal and coherent", () => {
  const state = scenario({
    ballCarrier: "M9",
    attackers: { M9: { x: 10, y: 12 } },
    without: ["GK_ATTACK"],
    extraAttacker: { x: 14.5, y: 6.7 },
    defenceSystem: THREE_TWO_ONE as never,
    phase: "CIRCULATION",
  }).handball;

  assert.equal(state.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER").length, 7);
  assert.equal(defendersOf(state).length, 6);

  const result = evaluateSixZeroDefense(state);
  assert.equal(result.implemented, true);
  assert.equal(result.reactions.length, 6, "every defender still has a job");
  assert.equal(result.reactions.filter((r) => r.reactionType === "FRONT").length, 1, "and one is still at the point");
  assert.deepEqual(evaluateSixZeroDefense(state).reactions, result.reactions, "deterministic");
});

// ---------------------------------------------------------------------------
// 6. Symmetry and determinism
// ---------------------------------------------------------------------------

test("the 3:2:1 is the same defence at either end of the court", () => {
  for (const role of ["L1", "L2", "L3", "R3", "R2", "R1"] as const) {
    const top = defensiveHomePosition(THREE_TWO_ONE, role, "TOP")!;
    const bottom = defensiveHomePosition(THREE_TWO_ONE, role, "BOTTOM")!;
    assert.equal(top.x, bottom.x, `${role} keeps his lane`);
    assert.equal(top.y.toFixed(6), mirrorYForOppositeGoalSide(bottom.y).toFixed(6), `${role} mirrors in depth`);
  }
});

test("a left-side threat and its right-side twin are handled the same way", () => {
  const left = attackAgainst(THREE_TWO_ONE, { ballCarrier: "V9", attackers: { V9: { x: 6.0, y: 11.0 } } });
  const right = attackAgainst(THREE_TWO_ONE, { ballCarrier: "H9", attackers: { H9: { x: 14.0, y: 11.0 } } });
  assert.equal(reactionFor(left, "L2")?.reactionType, reactionFor(right, "R2")?.reactionType, "the mirrored man does the mirrored job");
});

test("the same 3:2:1 situation is read the same way every time", () => {
  const state = attackAgainst(THREE_TWO_ONE);
  assert.deepEqual(evaluateSixZeroDefense(state), evaluateSixZeroDefense(state));
});

test("reach readings are shared machinery, not per-system code", () => {
  // A defender races an attacker the same way in every system; what differs is
  // where he was standing when the race started.
  for (const system of [SIX_ZERO, FIVE_ONE, THREE_TWO_ONE]) {
    const state = attackAgainst(system);
    const reaches = defensiveReaches(state, requireScenarioPlayer(state, "M9"), "TOP");
    assert.equal(reaches.length, 6, `${system}: every defender gets a reading`);
    assert.ok(reaches.every((r) => Number.isFinite(r.defenderSeconds)), `${system}: from the same race model`);
  }
});
