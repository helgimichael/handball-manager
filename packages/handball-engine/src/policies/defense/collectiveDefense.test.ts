// MATCH-EXPERIENCE-2.0 M7: the 6:0 as a coordinated unit.
//
// The test that must never be deleted is "a step-out is read by the attack":
// M7's claim is that the defence's collective movement is real spatial state
// that M6's carrier perceives and reacts to. A defence that produced targets
// the attack could not see, or an attack that stopped reading defender
// positions, would pass most of the rest of this file and still break the
// state -> decision -> action loop in both directions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullCourt6v6State } from "../../scenarios/fullCourt6v6";
import { step } from "../../simulation/engine";
import { SIMULATION_DT_SECONDS } from "../../simulation/fixedStep";
import { simulatePossession } from "../../simulation/possessionEngine";
import { simulateGameSequence } from "../../simulation/gameFlow";
import { evaluateSixZeroDefense, SIX_ZERO_DEFENSE_LIMITS } from "./sixZeroDefensePolicy";
import { COLLECTIVE_DEFENSE_LIMITS, defendedGoalSideOf, perceiveAttack } from "./collectiveDefense";
import { observeDefensiveThreat } from "./threat";
import { distanceBetween, type MeterPoint } from "../../domain/geometry/coordinates";
import type { AttackGapId } from "../../domain/geometry/attackGaps";
import type { DefenseRole, Player } from "../../domain/handball/player";
import type { HandballState } from "../../domain/handball/state";
import type { SixZeroDefender } from "./responsibility";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const BOTTOM = createFullCourt6v6State({ attackingGoalSide: "BOTTOM" });

const CENTRE_BACK = "attack-attack-6-3";
const LEFT_BACK = "attack-attack-6-2";
const RIGHT_BACK = "attack-attack-6-4";
const RIGHT_WING = "attack-attack-6-5";
const PIVOT = "attack-attack-6-6";

function playerById(state: HandballState, id: string): Player {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
}

function roleOf(state: HandballState, id: string | null): DefenseRole | null {
  return id ? (playerById(state, id).role as DefenseRole) : null;
}

function byRole(state: HandballState, role: DefenseRole): Player {
  const p = state.players.find((x) => x.team === "DEFENSE" && x.role === role);
  if (!p) throw new Error(`no ${role}`);
  return p;
}

function homeOf(state: HandballState, id: string): MeterPoint {
  return state.defense.homePositions.find((h) => h.playerId === id)!.position;
}

/** The same world with players stood elsewhere and, optionally, the ball in someone else's hands. */
function withPositions(state: HandballState, moves: Record<string, MeterPoint>, carrierId?: string): HandballState {
  const players = state.players.map((p) => (moves[p.id] ? { ...p, position: { ...moves[p.id] } } : p));
  const carrier = carrierId ? players.find((p) => p.id === carrierId)! : players.find((p) => p.id === state.ball.possessorId)!;
  return { ...state, players, ball: { ...state.ball, possessorId: carrier.id, position: { ...carrier.position }, status: "POSSESSED", flight: null } };
}

/** The carrier driving at `gapId` from where he stands. */
function driving(state: HandballState, carrierId: string, gapId: AttackGapId, target: MeterPoint): HandballState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === carrierId ? { ...p, intent: { type: "ATTACK", gapId, target: { ...target }, completed: false } } : p)),
  };
}

function reactionOf(result: ReturnType<typeof evaluateSixZeroDefense>, id: string) {
  return result.reactions.find((r) => r.defenderId === id)!;
}

// ---------------------------------------------------------------------------
// Responsibility follows the ball and the threat
// ---------------------------------------------------------------------------

test("responsibility changes with ball and threat location", () => {
  const h = TOP.handball;
  const left = driving(withPositions(h, { [LEFT_BACK]: { x: 5.5, y: 10 } }, LEFT_BACK), LEFT_BACK, "V2_V3", { x: 6.5, y: 7 });
  const right = driving(withPositions(h, { [RIGHT_BACK]: { x: 14.5, y: 10 } }, RIGHT_BACK), RIGHT_BACK, "H3_H2", { x: 13.4, y: 7 });
  const leftPrimary = roleOf(h, evaluateSixZeroDefense(left).primaryDefenderId);
  const rightPrimary = roleOf(h, evaluateSixZeroDefense(right).primaryDefenderId);
  assert.ok(leftPrimary === "L2" || leftPrimary === "L3", `a drive at V2/V3 is L2 or L3's (${leftPrimary})`);
  assert.ok(rightPrimary === "R3" || rightPrimary === "R2", `a drive at H3/H2 is R3 or R2's (${rightPrimary})`);
  assert.notEqual(leftPrimary, rightPrimary);

  // With the ball merely held, the line slides toward it and the defender in front presses.
  const heldLeft = evaluateSixZeroDefense(withPositions(h, {}, LEFT_BACK));
  const heldRight = evaluateSixZeroDefense(withPositions(h, {}, RIGHT_BACK));
  assert.ok(heldLeft.lineShift < 0 && heldRight.lineShift > 0, "the line shifts toward whichever side has the ball");
  const meanX = (r: typeof heldLeft) => r.reactions.reduce((s, x) => s + x.target.x, 0) / r.reactions.length;
  assert.ok(meanX(heldLeft) < meanX(heldRight) - 1, "and the whole line's targets move with it");
  assert.notEqual(heldLeft.summary, heldRight.summary);
});

// ---------------------------------------------------------------------------
// Step-out from an actual threat, help beside it
// ---------------------------------------------------------------------------

test("the step-out happens from an actual drive, not from the ball being held", () => {
  const h = TOP.handball;
  const held = evaluateSixZeroDefense(h);
  assert.equal(held.primaryDefenderId, null);
  for (const r of held.reactions) {
    assert.notEqual(r.reactionType, "ENGAGE");
    const off = Math.abs(r.target.y - homeOf(h, r.defenderId).y);
    assert.ok(off <= COLLECTIVE_DEFENSE_LIMITS.pivotMarkReachMeters + 1e-9, `${r.role} stays on the line (${off.toFixed(2)}m off it)`);
  }
  const target = { x: 9.98, y: 8.1 };
  const drive = evaluateSixZeroDefense(driving(h, CENTRE_BACK, "V3_H3", target));
  assert.ok(drive.primaryDefenderId, "a drive produces a responsible defender");
  const primary = reactionOf(drive, drive.primaryDefenderId!);
  assert.equal(primary.reactionType, "ENGAGE");
  const stepped = distanceBetween(primary.target, homeOf(h, primary.defenderId));
  assert.ok(stepped > 0.8, `he actually steps out (${stepped.toFixed(2)}m)`);
  assert.ok(primary.target.y > homeOf(h, primary.defenderId).y, "toward the carrier, i.e. away from his own goal");
  assert.ok(primary.target.y < playerById(h, CENTRE_BACK).position.y, "but goal-side of him");
});

test("adjacent help closes toward the gap the step-out opened, on the line", () => {
  const h = TOP.handball;
  const drive = evaluateSixZeroDefense(driving(h, CENTRE_BACK, "V3_H3", { x: 9.98, y: 8.1 }));
  const primary = playerById(h, drive.primaryDefenderId!);
  assert.ok(drive.supportDefenderIds.length >= 1, "at least one neighbour helps");
  for (const helperId of drive.supportDefenderIds) {
    const helper = reactionOf(drive, helperId);
    assert.equal(helper.reactionType, "SUPPORT");
    const before = Math.abs(homeOf(h, helperId).x - homeOf(h, primary.id).x);
    const after = Math.abs(helper.target.x - homeOf(h, primary.id).x);
    assert.ok(after < before, `${helper.role} closes laterally toward ${primary.role}'s spot`);
    assert.ok(Math.abs(helper.target.y - homeOf(h, helperId).y) < 0.3, "and stays on the line rather than following him out");
  }
});

// ---------------------------------------------------------------------------
// Pivot
// ---------------------------------------------------------------------------

test("somebody is responsible for the pivot, and stands goal-side of him", () => {
  const h = TOP.handball;
  const result = evaluateSixZeroDefense(h);
  assert.ok(result.pivotMarkerId, "a pivot on the line has a marker");
  const marker = reactionOf(result, result.pivotMarkerId!);
  assert.equal(marker.reactionType, "MARK_PIVOT");
  const pivot = playerById(h, PIVOT).position;
  assert.ok(marker.target.y < pivot.y, "goal-side of the pivot");
  assert.ok(Math.abs(marker.target.x - pivot.x) < 1.5, "and laterally on him");
  assert.ok(result.responsibilities.some((r) => r.defenderId === result.pivotMarkerId && r.kind === "PIVOT"));
  assert.ok(result.summary.includes("marks the pivot"));
});

test("when the pivot's marker is the one who must step out, the pivot is handed to a neighbour", () => {
  const h = TOP.handball;
  // Pivot sits right in front of L3; M9 drives at L3's gap.
  const l3 = byRole(h, "L3");
  const state = withPositions(h, { [PIVOT]: { x: l3.position.x, y: l3.position.y + 0.4 }, [CENTRE_BACK]: { x: l3.position.x + 0.3, y: 11 } }, CENTRE_BACK);
  const rest = evaluateSixZeroDefense(state);
  assert.equal(roleOf(h, rest.pivotMarkerId), "L3", "at rest L3 has the pivot");
  const drive = evaluateSixZeroDefense(driving(state, CENTRE_BACK, "V2_V3", { x: l3.position.x - 0.2, y: 8.2 }));
  assert.equal(roleOf(h, drive.primaryDefenderId), "L3", "L3 must step out");
  assert.notEqual(drive.pivotMarkerId, drive.primaryDefenderId, "so he no longer marks the pivot");
  assert.ok(["L2", "R3"].includes(roleOf(h, drive.pivotMarkerId)!), `a neighbour takes him (${roleOf(h, drive.pivotMarkerId)})`);
  // And that neighbour is NOT also asked to help -- two threats, two jobs.
  assert.ok(!drive.supportDefenderIds.includes(drive.pivotMarkerId!), "the pivot's marker is not pulled off him to help");
});

test("a covered pivot is covered; when responsibility breaks down he becomes an opportunity", () => {
  const h = TOP.handball;
  const perception = perceiveAttack(h, observeDefensiveThreat(h), h.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER") as SixZeroDefender[]);
  assert.equal(perception.pivot?.id, PIVOT, "the defence perceives who the pivot is");
  // Intact line: the natural marker sits on him.
  const rest = evaluateSixZeroDefense(h);
  const reach = (r: ReturnType<typeof evaluateSixZeroDefense>) => distanceBetween(reactionOf(r, r.pivotMarkerId!).target, playerById(h, PIVOT).position);
  assert.ok(reach(rest) < 1.2, `with the line intact the marker is on him (${reach(rest).toFixed(2)}m)`);
  // Breakdown: the pivot stands in front of the defender who has to step out
  // at a drive. The pivot is handed to a neighbour whose bounded reach from
  // the line cannot get to him -- which is the pivot opportunity M6 reads.
  const marker = playerById(h, rest.pivotMarkerId!);
  const drive = driving(
    withPositions(h, { [PIVOT]: { x: marker.position.x, y: marker.position.y + 0.4 }, [CENTRE_BACK]: { x: marker.position.x, y: 11 } }, CENTRE_BACK),
    CENTRE_BACK,
    marker.role === "L3" ? "V2_V3" : "H3_H2",
    { x: marker.position.x, y: 8.2 },
  );
  const broken = evaluateSixZeroDefense(drive);
  assert.equal(broken.primaryDefenderId, marker.id, "the marker is the one who must step out");
  assert.notEqual(broken.pivotMarkerId, marker.id);
  const handedReach = distanceBetween(reactionOf(broken, broken.pivotMarkerId!).target, playerById(drive, PIVOT).position);
  assert.ok(handedReach > reach(rest) + 0.5, `the stand-in cannot get as close (${handedReach.toFixed(2)}m vs ${reach(rest).toFixed(2)}m)`);
});

// ---------------------------------------------------------------------------
// Handover and recovery through real movement
// ---------------------------------------------------------------------------

test("responsibility is handed over when the carrier crosses into the next zone, with hysteresis", () => {
  const h = TOP.handball;
  let state = driving(withPositions(h, { [CENTRE_BACK]: { x: 8.5, y: 9.5 } }, CENTRE_BACK), CENTRE_BACK, "V3_H3", { x: 9.9, y: 8.1 });
  let result = evaluateSixZeroDefense(state);
  const first = roleOf(h, result.primaryDefenderId);
  assert.equal(first, "L3");
  // A few centimetres to the right: the same defender keeps it.
  state = { ...state, defense: { ...state.defense, lastReaction: result } };
  state = withPositions(state, { [CENTRE_BACK]: { x: 10.2, y: 9.5 } }, CENTRE_BACK);
  result = evaluateSixZeroDefense(state);
  assert.equal(roleOf(h, result.primaryDefenderId), "L3", "no handover on a small lateral move");
  // Clearly into R3's zone: handed over.
  state = { ...state, defense: { ...state.defense, lastReaction: result } };
  state = withPositions(state, { [CENTRE_BACK]: { x: 12.4, y: 9.5 } }, CENTRE_BACK);
  result = evaluateSixZeroDefense(state);
  assert.equal(roleOf(h, result.primaryDefenderId), "R3", "handed over once he is really in the next zone");
});

test("after the drive ends the defence recovers to the line by running, never snapping", () => {
  let state = driving(TOP.handball, CENTRE_BACK, "V3_H3", { x: 9.98, y: 8.1 });
  const policy = (s: HandballState) => evaluateSixZeroDefense(s);
  // Let the step-out develop.
  for (let i = 0; i < 16; i += 1) state = step(state, { defensivePolicy: policy }, SIMULATION_DT_SECONDS);
  const primaryId = state.defense.lastReaction!.primaryDefenderId!;
  const steppedOut = distanceBetween(playerById(state, primaryId).position, homeOf(state, primaryId));
  assert.ok(steppedOut > 0.6, `the primary has physically stepped out (${steppedOut.toFixed(2)}m)`);
  // The drive ends: carrier goes idle with the ball. Recovery must be gradual.
  state = { ...state, players: state.players.map((p) => (p.id === CENTRE_BACK ? { ...p, intent: { type: "IDLE" } } : p)) };
  const maxPerStep = playerById(state, primaryId).movementProfile.maxSpeed * SIMULATION_DT_SECONDS + 1e-6;
  let previous = playerById(state, primaryId).position;
  let recovered = false;
  for (let i = 0; i < 60 && !recovered; i += 1) {
    state = step(state, { defensivePolicy: policy }, SIMULATION_DT_SECONDS);
    const now = playerById(state, primaryId).position;
    assert.ok(distanceBetween(previous, now) <= maxPerStep, "no teleporting: one step of movement per fixed step");
    previous = now;
    const shifted = { x: homeOf(state, primaryId).x + state.defense.lastReaction!.lineShift, y: homeOf(state, primaryId).y };
    recovered = distanceBetween(now, shifted) < 0.6;
  }
  assert.ok(recovered, "he ran back to the (shifted) line within three seconds");
});

// ---------------------------------------------------------------------------
// Line integrity over a whole run
// ---------------------------------------------------------------------------

test("line width and depth remain healthy over repeated possessions", () => {
  const run = simulateGameSequence(TOP, 12, { maxPossessions: 30 });
  const organized = run.trace.filter((t) => t.phase === "CIRCULATION" || t.phase === "ATTACK_ACTION");
  assert.ok(organized.length > 100);
  let narrow = 0;
  let deep = 0;
  let widthSum = 0;
  for (const t of organized) {
    const defending = t.playerPositions.filter((p) => !run.finalState.rosters[t.possessionTeam].includes(p.playerId) && !p.playerId.includes("goalkeeper"));
    const xs = defending.map((p) => p.position.x);
    const ys = defending.map((p) => p.position.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...ys) - Math.min(...ys);
    widthSum += width;
    if (width < 10) narrow += 1;
    if (depth > 9) deep += 1;
  }
  assert.ok(widthSum / organized.length > 13, `the 6:0 stays wide (mean ${(widthSum / organized.length).toFixed(2)}m)`);
  assert.ok(narrow / organized.length < 0.05, "it never collapses into a cluster");
  assert.ok(deep / organized.length < 0.25, "and it does not spread into six ball-chasers at different depths");
});

test("wing defenders hold width against a wide attacker instead of following the line inward", () => {
  const h = TOP.handball;
  const ballLeft = withPositions(h, {}, LEFT_BACK); // ball on the V side: the line shifts left
  const withWing = evaluateSixZeroDefense(ballLeft);
  // FIELD's canonical H9 also stands wide, so both right-side attackers must
  // be absent before R1 has nobody to hold width against.
  const noWing = evaluateSixZeroDefense({ ...ballLeft, players: ballLeft.players.filter((p) => p.id !== RIGHT_WING && p.id !== RIGHT_BACK) });
  const r1 = byRole(h, "R1").id;
  assert.ok(withWing.reactions.find((r) => r.defenderId === r1)!.target.x > noWing.reactions.find((r) => r.defenderId === r1)!.target.x + 0.5, "R1 stays wider while H6 holds width");
  assert.ok(withWing.summary.includes("hold width"));
});

// ---------------------------------------------------------------------------
// Two threats, different states, both goals, determinism
// ---------------------------------------------------------------------------

test("different attacking states produce different defensive responses", () => {
  const h = TOP.handball;
  const drive = driving(h, CENTRE_BACK, "V3_H3", { x: 9.98, y: 8.1 });
  const withPivot = evaluateSixZeroDefense(drive);
  const noPivot = evaluateSixZeroDefense({ ...drive, players: drive.players.filter((p) => p.id !== PIVOT) });
  assert.ok(withPivot.pivotMarkerId && !noPivot.pivotMarkerId, "the pivot is marked only when there is one");
  assert.ok(noPivot.supportDefenderIds.length >= withPivot.supportDefenderIds.length, "without a pivot to mark, more of the line is free to help");
  assert.notDeepEqual(withPivot.reactions.map((r) => [r.role, r.reactionType]), noPivot.reactions.map((r) => [r.role, r.reactionType]));
  // And a wide drive engages a wide defender, a central drive a central one.
  const wide = evaluateSixZeroDefense(driving(withPositions(h, {}, RIGHT_BACK), RIGHT_BACK, "H2_H1", { x: 16.5, y: 4 }));
  assert.notEqual(roleOf(h, wide.primaryDefenderId), roleOf(h, withPivot.primaryDefenderId));
});

test("the defence works identically at the BOTTOM goal, stepping toward its own goal side", () => {
  const h = BOTTOM.handball;
  assert.equal(defendedGoalSideOf(h), "BOTTOM");
  const carrier = playerById(h, CENTRE_BACK);
  const drive = driving(h, CENTRE_BACK, "V3_H3", { x: 9.98, y: 40 - 8.1 });
  const result = evaluateSixZeroDefense(drive);
  const primary = reactionOf(result, result.primaryDefenderId!);
  assert.ok(primary.target.y > carrier.position.y, "goal-side means BETWEEN the carrier and the BOTTOM goal");
  assert.ok(primary.target.y < homeOf(h, primary.defenderId).y, "and he steps OUT of the line toward the carrier");
  assert.ok(result.pivotMarkerId, "the pivot is marked at this end too");
  assert.ok(reactionOf(result, result.pivotMarkerId!).target.y > playerById(h, PIVOT).position.y, "goal-side of him");
});

test("a step-out is read by the attack -- the same collective movement M6 decides from", () => {
  // A possession's trace must show the defence's assignment changing AND the
  // carrier re-deciding because of a defender who is, at that moment,
  // physically displaced from the line. Scanned rather than pinned so the
  // property, not a seed, is what is asserted.
  let witnessed = false;
  for (let seed = 1; seed <= 40 && !witnessed; seed += 1) {
    const result = simulatePossession({ seed, initialState: TOP });
    const homes = result.finalState.handball.defense.homePositions;
    for (const entry of result.trace) {
      const d = entry.decision;
      if (!d || !d.blockedBy || d.trigger !== "DRIVE_REEVALUATION") continue;
      const blocker = entry.playerPositions.find((p) => p.playerId === d.blockedBy)!.position;
      const home = homes.find((h) => h.playerId === d.blockedBy)!.position;
      if (distanceBetween(blocker, home) < 0.5) continue;
      assert.ok(result.trace.some((t) => t.note.startsWith("defence:") && t.note.includes("steps out")), "the defence traced the step-out as a collective assignment");
      witnessed = true;
      break;
    }
  }
  assert.ok(witnessed, "in 40 seeds a carrier re-decided because of a defender who had really stepped out");
});

test("the same state and seed give an identical defence and an identical possession", () => {
  const drive = driving(TOP.handball, CENTRE_BACK, "V3_H3", { x: 9.98, y: 8.1 });
  assert.deepEqual(evaluateSixZeroDefense(drive), evaluateSixZeroDefense(drive));
  const a = simulatePossession({ seed: 12, initialState: TOP });
  const b = simulatePossession({ seed: 12, initialState: TOP });
  assert.deepEqual(b.trace, a.trace);
  assert.ok(a.trace.some((t) => t.note.startsWith("defence:")), "the defence's assignments are part of the trace");
  // Ability is an input, not a random effect: a braver defender steps further.
  const brave = evaluateSixZeroDefense(drive, { ratings: { [evaluateSixZeroDefense(drive).primaryDefenderId!]: { defending: 18 } } });
  const timid = evaluateSixZeroDefense(drive, { ratings: { [evaluateSixZeroDefense(drive).primaryDefenderId!]: { defending: 3 } } });
  const home = homeOf(TOP.handball, brave.primaryDefenderId!);
  assert.ok(distanceBetween(reactionOf(brave, brave.primaryDefenderId!).target, home) > distanceBetween(reactionOf(timid, timid.primaryDefenderId!).target, home));
  assert.ok(SIX_ZERO_DEFENSE_LIMITS.primaryMaxDisplacementMeters > 0);
});
