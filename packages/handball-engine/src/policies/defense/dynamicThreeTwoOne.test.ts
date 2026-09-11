// HUMAN QA FIX 2C: the 3:2:1 as a moving system.
//
// M24 gave the system three genuine depths and a handover, and a human watching
// it said the thing the shape could not: it looked like a static triangle. He
// was right, and it measured. Over a full circulation from the left wing to the
// right the point man covered nearly eight metres and the two half-space men
// stepped out and recovered, while the three men on the line moved 1.18m
// between the two extremes and the middle one moved half of that. Two men
// working in front of a wall is not a system shifting as one unit.
//
// The test that must never be deleted is "the base three shift with the ball".
// It is the whole of what this pass is about, it is the number a human can see
// from the stands, and it is the one a future change can quietly undo by
// treating the line shift as a single constant shared by every system again.
//
// The second thing under test is that the system stays a 3:2:1 while it moves.
// A defence that shifts far enough stops being three layers and becomes six men
// chasing a ball, so the depth ordering is asserted at every stage of the
// circulation rather than only at home.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scenario } from "../../scenarios/matchScenario";
import { evaluateSixZeroDefense, SIX_ZERO_DEFENSE_FORMATION_ID } from "./sixZeroDefensePolicy";
import { perceiveAttack, shiftedHomes, homeOf } from "./collectiveDefense";
import { observeDefensiveThreat } from "./threat";
import { SIX_ZERO_ROLE_ORDER, type SixZeroDefender } from "./responsibility";

/** The six who make up a defensive shape, as the policy itself selects them. */
const defendersIn = (state: HandballState): readonly SixZeroDefender[] =>
  state.players.filter(
    (p): p is SixZeroDefender =>
      p.team === "DEFENSE" && SIX_ZERO_ROLE_ORDER.includes(p.role as DefenseRole),
  );
import {
  FIVE_ONE_DEFENSE_FORMATION_ID,
  THREE_TWO_ONE_BASE_ROLE_ORDER,
  THREE_TWO_ONE_DEFENSE_FORMATION_ID,
  THREE_TWO_ONE_INTERMEDIATE_ROLES,
  defensiveLayerOf,
  frontDefenderRoleOf,
  shiftProfileOf,
} from "./defensiveSystem";
import { step } from "../../simulation/engine";
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import type { HandballState } from "../../domain/handball/state";
import type { DefenseRole } from "../../domain/handball/player";
import type { MeterPoint } from "../../domain/geometry/coordinates";

const T321 = THREE_TWO_ONE_DEFENSE_FORMATION_ID;
const DT = 0.05;
const ALL_ROLES: readonly DefenseRole[] = ["L3", "L2", "R2", "L1", "R3", "R1"];
const FRONT = frontDefenderRoleOf(T321)!;

// ---------------------------------------------------------------------------
// The controlled circulation: LEFT -> CENTRE -> RIGHT -> CENTRE
// ---------------------------------------------------------------------------

function build(goalSide: "TOP" | "BOTTOM" = "TOP"): HandballState {
  const y = goalSide === "TOP" ? 13 : 27;
  return scenario({
    ballCarrier: "M9",
    attackers: { M9: { x: 10, y } },
    defenceSystem: T321 as never,
    phase: "CIRCULATION",
    attackingGoalSide: goalSide,
  }).handball;
}

/** Let the defence run until it stops moving, or for `steps` at most. */
function settle(state: HandballState, steps = 90): HandballState {
  let current = state;
  for (let i = 0; i < steps; i += 1) current = step(current, { actions: evaluateSixZeroDefense(current).actions }, DT);
  return current;
}

/** Put the ball and its carrier at `x`, which is what a circulation does. */
function circulateTo(state: HandballState, x: number, y: number): HandballState {
  const carrier = state.players.find((p) => p.id === state.ball.possessorId)!;
  return {
    ...state,
    players: state.players.map((p) => (p.id === carrier.id ? { ...p, position: { x, y } } : p)),
    ball: { ...state.ball, position: { x, y } },
  };
}

const defenderAt = (state: HandballState, role: DefenseRole) =>
  state.players.find((p) => p.team === "DEFENSE" && p.role === role)!;
const reactionFor = (state: HandballState, role: DefenseRole) =>
  evaluateSixZeroDefense(state).reactions.find((r) => r.role === role);

type Stage = { readonly label: string; readonly state: HandballState };

/** The four positions of the circulation, each settled. */
function circulation(goalSide: "TOP" | "BOTTOM" = "TOP"): readonly Stage[] {
  const y = goalSide === "TOP" ? 13 : 27;
  const stages: Stage[] = [];
  let state = settle(build(goalSide), 120);
  stages.push({ label: "HOME", state });
  for (const [label, x] of [["LEFT", 4], ["CENTRE", 10], ["RIGHT", 16], ["BACK", 10]] as const) {
    state = settle(circulateTo(state, x, y));
    stages.push({ label, state });
  }
  return stages;
}

const RUN = circulation("TOP");
const stage = (label: string) => RUN.find((s) => s.label === label)!.state;
const xOf = (label: string, role: DefenseRole) => defenderAt(stage(label), role).position.x;
const depthOf = (label: string, role: DefenseRole) => defenderAt(stage(label), role).position.y;
const rangeOf = (role: DefenseRole) => {
  const xs = RUN.map((s) => defenderAt(s.state, role).position.x);
  return Math.max(...xs) - Math.min(...xs);
};

// ---------------------------------------------------------------------------
// 1. The base three move
// ---------------------------------------------------------------------------

test("the base three shift with the ball", () => {
  // THE ONE THAT MUST NOT BE DELETED. Measured at 1.18m mean lateral range
  // before this pass, against 7.83m for the point man: a wall with two men
  // working in front of it.
  const ranges = THREE_TWO_ONE_BASE_ROLE_ORDER.map(rangeOf);
  const mean = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  assert.ok(mean > 3, `the line travels with the ball (mean ${mean.toFixed(2)}m across the circulation)`);
  for (const role of THREE_TWO_ONE_BASE_ROLE_ORDER) {
    assert.ok(rangeOf(role) > 1.5, `${role} is not frozen (${rangeOf(role).toFixed(2)}m)`);
  }
});

test("every layer takes part in the shift", () => {
  const meanFor = (roles: readonly DefenseRole[]) => roles.map(rangeOf).reduce((a, b) => a + b, 0) / roles.length;
  const base = meanFor(THREE_TWO_ONE_BASE_ROLE_ORDER);
  const middle = meanFor(THREE_TWO_ONE_INTERMEDIATE_ROLES);
  const front = rangeOf(FRONT);
  for (const [name, value] of [["base", base], ["intermediate", middle], ["front", front]] as const) {
    assert.ok(value > 2, `the ${name} layer moves with the ball (${value.toFixed(2)}m)`);
  }
  // And it is still a shape rather than a chase. The half-space men travel
  // FURTHEST, which is not a mistake and is the thing worth stating: they are
  // the ones who go out to a back on their side and come back. The point man
  // travels least of the three, because he holds the point and hands a
  // circulated ball on rather than following it out to the wing -- a point man
  // with the largest range would be the man-marking failure M24 warned about.
  // Whether the layers stay separated is asserted on depth, above, where it
  // belongs; lateral range alone cannot say it.
  assert.ok(
    middle > base && middle > front,
    `the half-spaces cover the most ground (${middle.toFixed(2)} vs base ${base.toFixed(2)}, point ${front.toFixed(2)})`,
  );
  assert.ok(front < middle, `and the point man is not chasing the ball across the court (${front.toFixed(2)}m)`);
});

test("it is still a 3:2:1 at every point of the circulation", () => {
  for (const { label, state } of RUN) {
    const deepest = (roles: readonly DefenseRole[]) =>
      Math.max(...roles.map((r) => Math.abs(defenderAt(state, r).position.y)));
    const base = deepest(THREE_TWO_ONE_BASE_ROLE_ORDER);
    const middle = Math.min(...THREE_TWO_ONE_INTERMEDIATE_ROLES.map((r) => defenderAt(state, r).position.y));
    const front = defenderAt(state, FRONT).position.y;
    assert.ok(base < middle, `${label}: the line is still behind the half-spaces (${base.toFixed(1)} < ${middle.toFixed(1)})`);
    assert.ok(middle < front + 0.01, `${label}: and the half-spaces still behind the point`);
  }
});

// ---------------------------------------------------------------------------
// 2. Ball-side shift, layer by layer
// ---------------------------------------------------------------------------

test("the whole system leans to the side the ball is on", () => {
  for (const role of ALL_ROLES) {
    assert.ok(xOf("LEFT", role) < xOf("CENTRE", role), `${role} is further left with the ball on the left`);
    assert.ok(xOf("RIGHT", role) > xOf("CENTRE", role), `${role} is further right with the ball on the right`);
  }
});

test("the ball-side base defender closes up behind his intermediate", () => {
  // Depth, not just width. The man on the ball side steps off the line into the
  // space the half-space defender has vacated by going out.
  const ballSideLeft: DefenseRole = "L1";
  const ballSideRight: DefenseRole = "R1";
  assert.ok(depthOf("LEFT", ballSideLeft) > depthOf("CENTRE", ballSideLeft), "L1 steps up when the ball is left");
  assert.ok(depthOf("RIGHT", ballSideRight) > depthOf("CENTRE", ballSideRight), "R1 steps up when the ball is right");
});

test("the weak-side base defender narrows without abandoning his side", () => {
  const weakOnLeftBall: DefenseRole = "R1";
  const home = xOf("CENTRE", weakOnLeftBall);
  const narrowed = xOf("LEFT", weakOnLeftBall);
  assert.ok(narrowed < home, "he draws in toward the middle");
  assert.ok(narrowed > 10, "and is still on his own side of the court");
});

test("the middle of the base holds the inside rather than stepping up", () => {
  // He is the man who owns the line and the pivot, and he has no side to be on.
  const middle: DefenseRole = "R3";
  assert.ok(
    Math.abs(depthOf("LEFT", middle) - depthOf("CENTRE", middle)) < 1,
    "the central base defender does not leave the line to chase the ball side",
  );
});

// ---------------------------------------------------------------------------
// 3. Handover and recovery
// ---------------------------------------------------------------------------

test("the point man hands a circulated ball to the half-space defender", () => {
  // The lateral half of the handover chain. With the ball at the top of the
  // attack he presses it himself; once it has gone to a back out in the
  // half-space, the intermediate is plainly closer and the point man goes back
  // to the point instead of leaning at a man he cannot reach.
  assert.equal(reactionFor(stage("CENTRE"), FRONT)?.reactionType, "FRONT", "he presses the ball in the middle");
  for (const label of ["LEFT", "RIGHT"]) {
    assert.equal(reactionFor(stage(label), FRONT)?.reactionType, "RECOVER", `${label}: he gives the man up`);
  }
});

test("a defender who has handed over recovers instead of chasing", () => {
  // He does not follow the ball to the wing: with the ball out on the left he
  // is still nearer the middle of the court than the carrier is.
  assert.ok(xOf("LEFT", FRONT) > 6, `the point man stays at the point (${xOf("LEFT", FRONT).toFixed(1)})`);
  assert.ok(xOf("RIGHT", FRONT) < 14, `and on the other side too (${xOf("RIGHT", FRONT).toFixed(1)})`);
});

test("the half-space defenders alternate stepping out and supporting", () => {
  const left: DefenseRole = "L2";
  const right: DefenseRole = "R2";
  assert.equal(reactionFor(stage("LEFT"), left)?.reactionType, "STEP_OUT", "the left half-space takes a ball on his side");
  assert.equal(reactionFor(stage("LEFT"), right)?.reactionType, "SHIFT", "and the right one supports rather than following");
  assert.equal(reactionFor(stage("RIGHT"), right)?.reactionType, "STEP_OUT", "mirrored on the other side");
  assert.equal(reactionFor(stage("RIGHT"), left)?.reactionType, "SHIFT");
});

test("the defence recentres when the ball comes back", () => {
  // The fourth position of the circulation. Everybody who went with the ball
  // comes back, and the system is where it was before it shifted.
  for (const role of ALL_ROLES) {
    assert.ok(
      Math.abs(xOf("BACK", role) - xOf("CENTRE", role)) < 1.5,
      `${role} returns to where he stood with the ball in the middle`,
    );
  }
});

test("nobody chases indefinitely", () => {
  // A defender who followed the ball would end the circulation far from his
  // home; every man is back within a couple of metres of his shape.
  const back = stage("BACK");
  const defenders = defendersIn(back);
  const homes = shiftedHomes(back, defenders, perceiveAttack(back, observeDefensiveThreat(back), defenders));
  for (const defender of defenders) {
    const home = homes.get(defender.id)!;
    assert.ok(
      Math.hypot(defender.position.x - home.x, defender.position.y - home.y) < 3,
      `${defender.role} is back in his layer, not attached to an attacker`,
    );
  }
});

test("the pivot stays the base's responsibility throughout", () => {
  // The trade a dynamic 3:2:1 makes is pressure outside for space behind, and
  // it only works while the line still owns the line. An advanced defender who
  // quietly became the pivot marker would be giving away the base's job.
  for (const { label, state } of RUN) {
    const marker = evaluateSixZeroDefense(state).reactions.find((r) => r.reactionType === "MARK_PIVOT");
    if (!marker) continue;
    assert.equal(
      defensiveLayerOf(T321, marker.role),
      "BASE",
      `${label}: the pivot is marked by the line (${marker.role}), not by the point or a half-space`,
    );
  }
});

// ---------------------------------------------------------------------------
// 4. Symmetry
// ---------------------------------------------------------------------------

/** The system's own answer -- its shifted homes -- with the ball at `x`. */
function homesWithBallAt(state: HandballState, x: number, y: number): Map<DefenseRole, MeterPoint> {
  const moved = circulateTo(state, x, y);
  const defenders = defendersIn(moved);
  const homes = shiftedHomes(moved, defenders, perceiveAttack(moved, observeDefensiveThreat(moved), defenders));
  return new Map(defenders.map((d) => [d.role as DefenseRole, homes.get(d.id)!]));
}

test("the shift is left/right symmetric", () => {
  // Measured on the system's own response rather than on settled positions,
  // because the attack in front of it is not itself symmetric and the defenders
  // would inherit that asymmetry.
  const base = build("TOP");
  const left = homesWithBallAt(base, 4, 13);
  const right = homesWithBallAt(base, 16, 13);
  const partner: Readonly<Record<string, DefenseRole>> = { L1: "R1", R1: "L1", L2: "R2", R2: "L2", L3: "L3", R3: "R3" };
  for (const role of ALL_ROLES) {
    const mine = left.get(role)!;
    const theirs = right.get(partner[role])!;
    assert.ok(Math.abs(mine.x - 10 + (theirs.x - 10)) < 1e-6, `${role} mirrors ${partner[role]} laterally`);
    assert.ok(Math.abs(mine.y - theirs.y) < 1e-6, `${role} and ${partner[role]} take the same depth`);
  }
});

test("the shift is the same at either end of the court", () => {
  const top = homesWithBallAt(build("TOP"), 4, 13);
  const bottom = homesWithBallAt(build("BOTTOM"), 4, 27);
  for (const role of ALL_ROLES) {
    assert.ok(Math.abs(top.get(role)!.x - bottom.get(role)!.x) < 1e-6, `${role} shifts the same way at either goal`);
    assert.ok(
      Math.abs(top.get(role)!.y - mirrorYForOppositeGoalSide(bottom.get(role)!.y)) < 1e-6,
      `${role} takes the mirrored depth`,
    );
  }
});

// ---------------------------------------------------------------------------
// 5. The flat systems are untouched
// ---------------------------------------------------------------------------

test("6:0 and 5:1 shift exactly as they always did", () => {
  // The dynamic behaviour is a property of the SYSTEM, and only one system
  // asked for a new one. These are the numbers every system used to share.
  for (const id of [SIX_ZERO_DEFENSE_FORMATION_ID, FIVE_ONE_DEFENSE_FORMATION_ID]) {
    const profile = shiftProfileOf(id);
    assert.equal(profile.perMeter, 0.12);
    assert.equal(profile.maxMeters, 1.2);
    assert.equal(profile.holdsWidth, true);
    assert.equal(profile.ballSideBaseCloseMeters, 0);
    assert.equal(profile.weakSideNarrowFraction, 0);
    assert.deepEqual(profile.layerFraction, { BASE: 1, INTERMEDIATE: 1, FRONT: 1 });
  }
});

test("a flat defence's homes are unchanged by the new machinery", () => {
  // Behavioural rather than structural: with the ball off centre, every 6:0
  // home is its canonical spot plus the old line shift and nothing else.
  const flat = scenario({ ballCarrier: "M9", attackers: { M9: { x: 4, y: 13 } }, phase: "CIRCULATION" }).handball;
  const defenders = defendersIn(flat);
  const perception = perceiveAttack(flat, observeDefensiveThreat(flat), defenders);
  const homes = shiftedHomes(flat, defenders, perception);
  assert.ok(Math.abs(perception.lineShift + 0.72) < 1e-9, "the 6:0 still leans 0.72m at six metres off centre");
  for (const defender of defenders) {
    const canonical = homeOf(flat, defender).position;
    const shifted = homes.get(defender.id)!;
    assert.equal(shifted.y, canonical.y, `${defender.role} does not change depth in a flat system`);
    // Either he follows the whole lean, or he is a wing minding an attacker and
    // follows the documented fraction of it. Nothing else, and no new term.
    const offset = shifted.x - canonical.x;
    const full = perception.lineShift;
    const held = perception.lineShift * 0.3;
    assert.ok(
      Math.abs(offset - full) < 1e-9 || Math.abs(offset - held) < 1e-9,
      `${defender.role} slides by the line shift alone (${offset.toFixed(4)}m, expected ${full.toFixed(4)} or ${held.toFixed(4)})`,
    );
  }
});
