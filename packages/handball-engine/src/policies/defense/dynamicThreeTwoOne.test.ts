// HUMAN QA CORRECTION: the 3:2:1 as responsibility moving through a defence.
//
// QA Fix 2C answered "the 3:2:1 looks static" by making the triangle slide
// further, and a human looked at the result and said a moving triangle is still
// a triangle. He was right. Every target in it was a point computed from the
// ball's x, so nothing in it could ever answer a question, only occupy a place.
//
// The test that must never be deleted is "the ball comes back to the point man
// when it comes back to the middle". It is the one sentence that separates a
// defensive system from six men racing for the ball, and it is the one a future
// change breaks first -- by assigning the press to whoever is quickest, which
// sounds right and is not, because whoever pressed last is already standing on
// the spot and is therefore always quickest.
//
// The second thing under test is the chain. When a man is beaten, the defender
// behind him takes the ball AND the defender behind THAT one takes over the job
// the helper just left, with the line player still accounted for throughout.
// A defence that helps without redistributing has simply moved its hole.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scenario, requireScenarioPlayer } from "../../scenarios/matchScenario";
import { distanceBetween } from "../../domain/geometry/coordinates";
import { evaluateSixZeroDefense, SIX_ZERO_DEFENSE_FORMATION_ID } from "./sixZeroDefensePolicy";
import { perceiveAttack, shiftedHomes, homeOf } from "./collectiveDefense";
import { observeDefensiveThreat } from "./threat";
import { SIX_ZERO_ROLE_ORDER, type SixZeroDefender } from "./responsibility";
import {
  FIVE_ONE_DEFENSE_FORMATION_ID,
  LINE_SHIFT_MAX_METERS,
  LINE_SHIFT_PER_METER,
  THREE_TWO_ONE_BASE_ROLE_ORDER,
  THREE_TWO_ONE_DEFENSE_FORMATION_ID,
  THREE_TWO_ONE_INTERMEDIATE_ROLES,
  defensiveLayerOf,
  frontDefenderRoleOf,
  systemHoldsWidth,
} from "./defensiveSystem";
import { step } from "../../simulation/engine";
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import type { HandballState } from "../../domain/handball/state";
import type { DefenseRole } from "../../domain/handball/player";
import type { DefensiveDuty } from "./threeTwoOneDuties";

const T321 = THREE_TWO_ONE_DEFENSE_FORMATION_ID;
const DT = 0.05;
const ALL_ROLES: readonly DefenseRole[] = ["L3", "L2", "R2", "L1", "R3", "R1"];
const FRONT = frontDefenderRoleOf(T321)!;

const defendersIn = (state: HandballState): readonly SixZeroDefender[] =>
  state.players.filter(
    (p): p is SixZeroDefender => p.team === "DEFENSE" && SIX_ZERO_ROLE_ORDER.includes(p.role as DefenseRole),
  );

/** A backcourt in front of a 3:2:1, with a line player, ready to circulate. */
function build(goalSide: "TOP" | "BOTTOM" = "TOP"): HandballState {
  const at = (y: number) => (goalSide === "TOP" ? y : mirrorYForOppositeGoalSide(y));
  return scenario({
    ballCarrier: "M9",
    attackers: {
      M9: { x: 10, y: at(12) },
      V9: { x: 4.5, y: at(11) },
      H9: { x: 15.5, y: at(11) },
      M6: { x: 10.5, y: at(6.8) },
    },
    defenceSystem: T321 as never,
    phase: "CIRCULATION",
    attackingGoalSide: goalSide,
  }).handball;
}

function settle(state: HandballState, steps = 40): HandballState {
  let current = state;
  for (let i = 0; i < steps; i += 1) current = step(current, { actions: evaluateSixZeroDefense(current).actions }, DT);
  return current;
}

/** The ball is played to this man. Circulation, not a move order. */
function passTo(state: HandballState, label: string): HandballState {
  const receiver = requireScenarioPlayer(state, label);
  return { ...state, ball: { position: { ...receiver.position }, possessorId: receiver.id, status: "POSSESSED", flight: null } };
}

/** This man beats his defender and drives inside, ball and all. */
function drivesTo(state: HandballState, label: string, to: { x: number; y: number }): HandballState {
  const driver = requireScenarioPlayer(state, label);
  return {
    ...state,
    players: state.players.map((p) => (p.id === driver.id ? { ...p, position: { ...to } } : p)),
    ball: { position: { ...to }, possessorId: driver.id, status: "POSSESSED", flight: null },
  };
}

const dutiesOf = (state: HandballState) =>
  new Map(
    evaluateSixZeroDefense(state).reactions.map((r) => [r.role as DefenseRole, (r as { duty?: DefensiveDuty }).duty]),
  );
const ownerOf = (state: HandballState, duty: DefensiveDuty): DefenseRole | undefined =>
  [...dutiesOf(state)].find(([, d]) => d === duty)?.[0];
const layerOf = (role: DefenseRole) => defensiveLayerOf(T321, role);

// ---------------------------------------------------------------------------
// 1. The controlled circulation: M9 -> V9 -> M9 -> H9 -> M9
// ---------------------------------------------------------------------------

type Stage = { readonly ball: string; readonly state: HandballState };

function circulation(goalSide: "TOP" | "BOTTOM" = "TOP"): readonly Stage[] {
  const stages: Stage[] = [];
  let state = settle(build(goalSide), 100);
  for (const ball of ["M9", "V9", "M9", "H9", "M9"]) {
    state = settle(passTo(state, ball));
    stages.push({ ball, state });
  }
  return stages;
}

const RUN = circulation("TOP");

test("every job is owned, every man has one, and nobody has two", () => {
  for (const { ball, state } of RUN) {
    const duties = dutiesOf(state);
    assert.equal(duties.size, 6, `${ball}: six men`);
    for (const role of ALL_ROLES) assert.ok(duties.get(role), `${ball}: ${role} has a job`);
    assert.equal([...duties.values()].filter((d) => d === "PRESS_BALL").length, 1, `${ball}: exactly one man on the ball`);
    assert.ok([...duties.values()].includes("PIVOT"), `${ball}: somebody has the line player`);
  }
});

test("the ball comes back to the point man when it comes back to the middle", () => {
  // THE ONE THAT MUST NOT BE DELETED. The point man owns the central corridor;
  // whoever happens to be nearest does not. Assigning the press by reach alone
  // is self-reinforcing -- the man who pressed last is standing on the spot --
  // and it left the point empty for the rest of the possession.
  for (const stage of RUN) {
    if (stage.ball !== "M9") continue;
    assert.equal(ownerOf(stage.state, "PRESS_BALL"), FRONT, "a central back is the point man's");
  }
});

test("a ball in a half-space belongs to that half-space defender", () => {
  const left = RUN.find((s) => s.ball === "V9")!;
  const right = RUN.find((s) => s.ball === "H9")!;
  assert.equal(ownerOf(left.state, "PRESS_BALL"), "L2", "the left back is the left half-space defender's");
  assert.equal(ownerOf(right.state, "PRESS_BALL"), "R2", "and the right back the right one's");
});

test("the man who gives the ball up does not chase it", () => {
  // He takes his NEXT job -- watching the pass, or holding the inside -- rather
  // than following the man he just handed on.
  const left = RUN.find((s) => s.ball === "V9")!;
  const duties = dutiesOf(left.state);
  assert.notEqual(duties.get(FRONT), "PRESS_BALL", "the point man has handed the ball over");
  assert.ok(
    ["NEXT_THREAT", "INSIDE_LANE", "RECOVER"].includes(duties.get(FRONT)!),
    `and has gone to his next responsibility instead (${duties.get(FRONT)})`,
  );
});

test("the ball-side base covers behind the man who has gone out", () => {
  const left = RUN.find((s) => s.ball === "V9")!;
  const right = RUN.find((s) => s.ball === "H9")!;
  const cover = (state: HandballState) => ownerOf(state, "COVER_BEHIND");
  assert.equal(layerOf(cover(left.state)!), "BASE", "covering behind is the line's job");
  assert.ok(["L1", "R3"].includes(cover(left.state)!), `and it is the ball-side man (${cover(left.state)})`);
  assert.ok(["R1", "R3"].includes(cover(right.state)!), `mirrored on the other side (${cover(right.state)})`);
});

test("the line player is owned by the line, at every point of the circulation", () => {
  for (const { ball, state } of RUN) {
    const owner = ownerOf(state, "PIVOT");
    assert.ok(owner, `${ball}: somebody has him`);
    assert.equal(layerOf(owner), "BASE", `${ball}: and it is a base defender (${owner})`);
  }
});

test("responsibility really moves: the press changes hands as the ball circulates", () => {
  const pressers = RUN.map((s) => ownerOf(s.state, "PRESS_BALL"));
  assert.deepEqual(pressers, [FRONT, "L2", FRONT, "R2", FRONT], `the press follows the ball's corridor (${pressers.join(" -> ")})`);
  assert.ok(new Set(pressers).size === 3, "three different men are on the ball during one circulation");
});

test("the defence still stands in three layers while all this happens", () => {
  for (const { ball, state } of RUN) {
    const depth = (role: DefenseRole) => state.players.find((p) => p.team === "DEFENSE" && p.role === role)!.position.y;
    const base = Math.max(...THREE_TWO_ONE_BASE_ROLE_ORDER.map(depth));
    const middle = Math.min(...THREE_TWO_ONE_INTERMEDIATE_ROLES.map(depth));
    assert.ok(base < middle, `${ball}: the line is behind the half-spaces (${base.toFixed(1)} < ${middle.toFixed(1)})`);
    assert.ok(middle < depth(FRONT) + 0.5, `${ball}: and the half-spaces behind the point`);
  }
});

test("nobody is attached to an attacker: everybody is near his own post", () => {
  for (const { ball, state } of RUN) {
    const defenders = defendersIn(state);
    const homes = shiftedHomes(state, defenders, perceiveAttack(state, observeDefensiveThreat(state), defenders));
    for (const defender of defenders) {
      const post = homes.get(defender.id)!;
      assert.ok(
        Math.hypot(defender.position.x - post.x, defender.position.y - post.y) < 5,
        `${ball}: ${defender.role} is doing a job, not following a man`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 2. The breakthrough chain
// ---------------------------------------------------------------------------

test("when the first defender is beaten, the chain redistributes behind him", () => {
  // THE SECOND ONE THAT MUST NOT BE DELETED. Help on its own is not a system:
  // if the man who helps is not replaced in the job he left, the defence has
  // moved its hole rather than closed it.
  const before = settle(passTo(settle(build(), 100), "V9"));
  const pressedBy = ownerOf(before, "PRESS_BALL")!;
  const coveredBy = ownerOf(before, "COVER_BEHIND")!;
  const pivotBy = ownerOf(before, "PIVOT")!;
  assert.equal(layerOf(pressedBy), "INTERMEDIATE", "the half-space defender is on the ball");
  assert.equal(layerOf(coveredBy), "BASE", "and a base defender is behind him");

  // He goes past him and drives inside.
  const through = settle(drivesTo(before, "V9", { x: 7.0, y: 7.5 }), 25);
  const nowPressedBy = ownerOf(through, "PRESS_BALL")!;
  const nowCoveredBy = ownerOf(through, "COVER_BEHIND")!;

  assert.notEqual(nowPressedBy, pressedBy, "the beaten man is no longer on the ball");
  assert.equal(nowPressedBy, coveredBy, "the man who was covering behind him now has him");
  assert.notEqual(nowCoveredBy, coveredBy, "and somebody else has taken over covering");
  assert.equal(layerOf(nowCoveredBy), "BASE", "from the line, where that job lives");
  assert.equal(ownerOf(through, "PIVOT"), pivotBy, "and the line player is still accounted for throughout");

  // And what the BEATEN man does, stated precisely rather than narrated. He
  // relinquishes the ball and takes a support responsibility -- watching the
  // next pass, or holding the inside -- which is not the same thing as
  // "recovering" and is emphatically not the same thing as staying attached to
  // the man who went past him.
  const beatenDuty = dutiesOf(through).get(pressedBy as DefenseRole);
  assert.notEqual(beatenDuty, "PRESS_BALL", "the beaten man is not chasing from behind");
  assert.ok(
    ["NEXT_THREAT", "INSIDE_LANE", "RECOVER", "COMPACT_INSIDE"].includes(beatenDuty!),
    `he takes a support or recovery job instead (${beatenDuty})`,
  );
  const carrier = requireScenarioPlayer(through, "V9");
  const beatenTarget = evaluateSixZeroDefense(through).reactions.find((r) => r.role === pressedBy)!.target;
  const goal = { x: 10, y: 0 };
  assert.ok(
    beatenTarget.y > carrier.position.y,
    `and he drops back toward his layer rather than following the carrier goalwards (${beatenTarget.y.toFixed(1)} vs ${carrier.position.y.toFixed(1)})`,
  );
  assert.ok(
    distanceBetween(beatenTarget, goal) > distanceBetween(carrier.position, goal),
    "he is behind the play, not in front of it",
  );
});

// ---------------------------------------------------------------------------
// 3. Symmetry and determinism
// ---------------------------------------------------------------------------

test("the same jobs are assigned at either end of the court", () => {
  const top = circulation("TOP").map((s) => `${s.ball}:${ownerOf(s.state, "PRESS_BALL")}`);
  const bottom = circulation("BOTTOM").map((s) => `${s.ball}:${ownerOf(s.state, "PRESS_BALL")}`);
  assert.deepEqual(top, bottom);
});

test("left and right are mirror images of each other", () => {
  const left = RUN.find((s) => s.ball === "V9")!.state;
  const right = RUN.find((s) => s.ball === "H9")!.state;
  const mirror: Readonly<Record<string, DefenseRole>> = { L1: "R1", R1: "L1", L2: "R2", R2: "L2", L3: "L3", R3: "R3" };
  for (const duty of ["PRESS_BALL", "COVER_BEHIND"] as const) {
    const onLeft = ownerOf(left, duty);
    const onRight = ownerOf(right, duty);
    assert.ok(onLeft && onRight);
    assert.equal(onRight, mirror[onLeft], `${duty} mirrors (${onLeft} / ${onRight})`);
  }
});

test("the same state assigns the same jobs every time", () => {
  const once = dutiesOf(RUN[1].state);
  const twice = dutiesOf(RUN[1].state);
  assert.deepEqual([...once], [...twice]);
});

// ---------------------------------------------------------------------------
// 4. The flat systems are untouched
// ---------------------------------------------------------------------------

test("only the 3:2:1 concedes the width", () => {
  assert.equal(systemHoldsWidth(SIX_ZERO_DEFENSE_FORMATION_ID), true);
  assert.equal(systemHoldsWidth(FIVE_ONE_DEFENSE_FORMATION_ID), true);
  assert.equal(systemHoldsWidth(T321), false);
});

test("a flat defence still leans by the line shift and nothing else", () => {
  // Behavioural, and the guard against this machinery leaking sideways: with
  // the ball off centre, every 6:0 home is its canonical spot plus the shared
  // lean, at unchanged depth. No duty, no step-up, no narrowing.
  const flat = scenario({ ballCarrier: "M9", attackers: { M9: { x: 4, y: 13 } }, phase: "CIRCULATION" }).handball;
  const defenders = defendersIn(flat);
  const perception = perceiveAttack(flat, observeDefensiveThreat(flat), defenders);
  assert.equal(perception.lineShift, Math.max(-LINE_SHIFT_MAX_METERS, LINE_SHIFT_PER_METER * (4 - 10)));
  const homes = shiftedHomes(flat, defenders, perception);
  for (const defender of defenders) {
    const canonical = homeOf(flat, defender).position;
    const shifted = homes.get(defender.id)!;
    assert.equal(shifted.y, canonical.y, `${defender.role} does not change depth in a flat system`);
    const offset = shifted.x - canonical.x;
    assert.ok(
      Math.abs(offset - perception.lineShift) < 1e-9 || Math.abs(offset - perception.lineShift * 0.3) < 1e-9,
      `${defender.role} slides by the line shift alone (${offset.toFixed(4)}m)`,
    );
  }
});

test("a flat defence is never handed a duty", () => {
  const flat = scenario({ ballCarrier: "M9", attackers: { M9: { x: 4, y: 13 } }, phase: "CIRCULATION" }).handball;
  for (const reaction of evaluateSixZeroDefense(flat).reactions) {
    assert.equal((reaction as { duty?: DefensiveDuty }).duty, undefined, `${reaction.role} runs the flat model`);
  }
});
