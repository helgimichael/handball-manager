// MATCH-EXPERIENCE-2.0 M6: organized attack intelligence.
//
// The test that must never be deleted is "the carrier's decision changes after
// the defensive reaction": M6's entire claim is that a tactical action is an
// intention read from real state, and that the NEXT action is read from what
// the defence did about it. A change that let a drive script its own ending
// (run there, then shoot) would pass most of the rest of this file and still
// put the legacy "invent the animation" architecture back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { createHalfCourt6v6StateWithGoalkeeper } from "../scenarios/halfCourt6v6";
import { simulatePossession } from "./possessionEngine";
import { simulateGameSequence } from "./gameFlow";
import { createPossessionRng } from "./possessionRng";
import { decideAttackAction, perceiveGaps, type DecisionContext } from "./attackDecision";
import {
  DEFAULT_ATTACK_TACTICS,
  ORGANIZED_ATTACK_LABELS,
  attackRoleLabel,
  ensureSixZeroHomePositions,
  organizedRolePosition,
  outfieldAttackWidth,
  pivotTarget,
} from "./organizedAttack";
import type { FullCourtMatchState } from "../domain/match/possession";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });

/** Witness seeds from a 4000-seed scan; the assertions are what matter, the seeds only make them deterministic. */
const SEED_BLOCKED_THEN_PASS = 4;
const SEED_PIVOT_FEED = 1;
const SEED_BLOCKED_THEN_RESET = 6;

function possession(seed: number, initialState: FullCourtMatchState = TOP) {
  return simulatePossession({ seed, initialState });
}

function decisions(seed: number) {
  return possession(seed).trace.flatMap((t) => (t.decision ? [{ entry: t, decision: t.decision }] : []));
}

function playerById(state: HandballState, id: string): Player {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new Error(`no player ${id}`);
  return player;
}

/** The same world with some players stood somewhere else -- nothing else changed. */
function withPositions(state: HandballState, moves: Record<string, MeterPoint>): HandballState {
  return { ...state, players: state.players.map((p) => (moves[p.id] ? { ...p, position: { ...moves[p.id] } } : p)) };
}

const CENTRE_BACK = "attack-attack-6-3";
const PIVOT = "attack-attack-6-6";
const L3 = "defense-defence-6-0-3";

function context(state: HandballState, carrierId: string, overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    state,
    goalSide: "TOP",
    carrier: playerById(state, carrierId),
    trigger: "SETTLED",
    drivingGapId: null,
    passesMade: 6,
    resets: 0,
    possessionSeconds: 8,
    lastPasserId: null,
    rng: createPossessionRng(1),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Canonical six roles
// ---------------------------------------------------------------------------

test("organized shape uses FIELD's canonical six roles, at either goal", () => {
  const canonical = createHalfCourt6v6StateWithGoalkeeper().players.filter((p) => p.team === "ATTACK");
  assert.equal(canonical.length, 6);
  const labels = new Set(canonical.map((p) => attackRoleLabel(p.role)));
  assert.deepEqual([...labels].sort(), [...ORGANIZED_ATTACK_LABELS].sort(), "V6 V9 M9 H9 H6 M6, once each");
  for (const p of canonical) {
    const top = organizedRolePosition(p.role, "TOP")!;
    const bottom = organizedRolePosition(p.role, "BOTTOM")!;
    assert.ok(Math.abs(top.x - p.position.x) < 1e-9 && Math.abs(top.y - p.position.y) < 1e-9, `${p.role} shape IS the canonical spot at TOP`);
    assert.ok(Math.abs(bottom.y - (40 - p.position.y)) < 1e-9, `${p.role} mirrors to the BOTTOM goal`);
  }
  // Width and depth are both recognisable: wings wide, backs outside 9m, pivot on the line.
  const at = (role: Player["role"]) => organizedRolePosition(role, "TOP")!;
  assert.ok(at("LEFT_WING").x < 2 && at("RIGHT_WING").x > 18, "wings are wide");
  assert.ok(at("CENTER_BACK").y > 9, "the centre back starts outside 9m");
  assert.ok(at("PIVOT").y > 6 && at("PIVOT").y < 7.5, "the pivot lives on the 6:0 line");
  // And a possession actually assigns all six.
  const seen = new Set(decisions(1).map((d) => d.decision.carrierLabel));
  assert.ok(seen.size >= 4, `several distinct roles carried the ball (${[...seen].join(", ")})`);
});

// ---------------------------------------------------------------------------
// 2. Circulation follows handball structure
// ---------------------------------------------------------------------------

test("ball circulation respects plausible role relationships", () => {
  const NATURAL = new Set(["V6>V9", "V9>V6", "V9>M9", "M9>V9", "M9>H9", "H9>M9", "H9>H6", "H6>H9", "M6>M9", "M6>V9", "M6>H9"]);
  let natural = 0;
  let total = 0;
  for (let seed = 1; seed <= 100; seed += 1) {
    const result = possession(seed);
    for (const t of result.trace) {
      const d = t.decision;
      if (!d || d.trigger !== "SETTLED" || d.chosen.kind !== "PASS") continue;
      const receiver = playerById(result.finalState.handball, d.chosen.targetPlayerId!);
      const pair = `${d.carrierLabel}>${attackRoleLabel(receiver.role)}`;
      total += 1;
      if (NATURAL.has(pair)) natural += 1;
      assert.notEqual(pair, "V6>H6");
      assert.notEqual(pair, "H6>V6", "a wing never fires the ball across the whole court to the other wing");
    }
  }
  assert.ok(total > 200, `enough circulation to judge (${total} passes)`);
  assert.ok(natural / total > 0.85, `${((natural / total) * 100).toFixed(0)}% of circulation follows V9 <-> M9 <-> H9 with wing/pivot involvement`);
});

// ---------------------------------------------------------------------------
// 3. Gaps
// ---------------------------------------------------------------------------

test("multiple different gaps can be selected, and each corresponds to a real gap in the line", () => {
  const chosen = new Map<string, number>();
  for (let seed = 1; seed <= 150; seed += 1) {
    for (const { entry, decision } of decisions(seed)) {
      if (decision.chosen.kind !== "ATTACK_GAP") continue;
      chosen.set(decision.chosen.gapId!, (chosen.get(decision.chosen.gapId!) ?? 0) + 1);
      // The target is the gap as it stands NOW: between its two responsible defenders.
      const carrier = entry.playerPositions.find((p) => p.playerId === decision.carrierId)!.position;
      const target = decision.chosen.target!;
      assert.ok(target.y < carrier.y, "the drive goes toward the TOP goal");
      assert.ok(Math.hypot(target.x - 10, target.y) > 3, "and not to the goal centre -- it stops in front of the line");
      assert.ok(target.y > 2.5, "wing gaps sit shallow, but never on the goal line");
    }
  }
  assert.ok(chosen.size >= 3, `at least three distinct gaps were attacked (${[...chosen.keys()].join(", ")})`);
  assert.ok(!chosen.has("V3_H3") || chosen.get("V3_H3")! < [...chosen.values()].reduce((a, b) => a + b, 0) * 0.8, "not everything goes through the middle");
});

test("gap perception is measured from where the defenders actually stand", () => {
  const rest = perceiveGaps(TOP.handball, "TOP");
  assert.equal(rest.length, 5, "all five gaps of a 6:0 are perceived");
  const l3 = playerById(TOP.handball, L3);
  // L3 steps out 1.2m toward the left back: the gaps either side of him change.
  const stepped = withPositions(TOP.handball, { [L3]: { x: l3.position.x - 0.8, y: l3.position.y + 1.2 } });
  const after = perceiveGaps(stepped, "TOP");
  const v2v3 = (g: typeof rest) => g.find((x) => x.gapId === "V2_V3")!;
  assert.ok(after.find((g) => g.gapId === "V2_V3")!.depthSplit > rest.find((g) => g.gapId === "V2_V3")!.depthSplit, "the step-out is read as a depth split");
  assert.notDeepEqual(v2v3(after).attackPoint, v2v3(rest).attackPoint, "and the attack point moves with the defenders");
});

// ---------------------------------------------------------------------------
// 4. The core of M6 -- do not delete
// ---------------------------------------------------------------------------

test("the ball carrier's decision changes after the defensive reaction", () => {
  const result = possession(SEED_BLOCKED_THEN_PASS);
  const homes = result.finalState.handball.defense.homePositions;
  const trace = result.trace;
  const index = trace.findIndex((t) => t.decision?.trigger === "DRIVE_REEVALUATION" && t.decision.blockedBy && t.decision.chosen.kind === "PASS");
  assert.ok(index >= 0, "a drive was re-decided as a pass because a defender closed it");
  const reevaluation = trace[index].decision!;
  // The decision BEFORE it, by the same carrier, was to attack that very gap.
  const previous = [...trace.slice(0, index)].reverse().find((t) => t.decision && t.decision.carrierId === reevaluation.carrierId)!.decision!;
  assert.equal(previous.chosen.kind, "ATTACK_GAP");
  assert.notEqual(previous.chosen.kind, reevaluation.chosen.kind, "the second decision differs from the first");
  // And the reason is a real defensive movement: the blocker has left his home
  // and is standing on the carrier's path.
  const blockerNow = trace[index].playerPositions.find((p) => p.playerId === reevaluation.blockedBy)!.position;
  const blockerHome = homes.find((h) => h.playerId === reevaluation.blockedBy)!.position;
  assert.ok(Math.hypot(blockerNow.x - blockerHome.x, blockerNow.y - blockerHome.y) > 0.5, "the blocking defender physically stepped out of the line");
  assert.ok(trace[index].note.includes("steps out and closes"), "the trace explains the change of plan by the step-out");
  // The state at the re-decision is not the state at the first decision.
  const carrierThen = trace.findIndex((t) => t.decision === previous);
  assert.notDeepEqual(trace[carrierThen].playerPositions, trace[index].playerPositions);
});

// ---------------------------------------------------------------------------
// 5. Pivot
// ---------------------------------------------------------------------------

test("the play-pivot option can be selected, and the pivot then really has the ball", () => {
  const result = possession(SEED_PIVOT_FEED);
  const index = result.trace.findIndex((t) => t.decision?.chosen.kind === "PLAY_PIVOT");
  assert.ok(index >= 0, "the pivot was fed");
  const feed = result.trace[index].decision!;
  assert.equal(playerById(result.finalState.handball, feed.chosen.targetPlayerId!).role, "PIVOT");
  assert.ok(feed.chosen.detail.includes("pivot free"), "he was chosen because he had room, not by script");
  const later = result.trace.slice(index + 1).find((t) => t.ballPossessorId === feed.chosen.targetPlayerId);
  assert.ok(later, "the ball actually arrived at the pivot through real flight");
  assert.ok(later!.note.includes("M6"), "and the pivot's own next decision is traced as the pivot's");
});

test("the pivot works the actual defensive line and is affected by nearby defenders", () => {
  const rest = pivotTarget(TOP.handball, "TOP", 10)!;
  assert.ok(rest.y > 6 && rest.y < 8, "on the line, not at goal centre");
  // Crowd the middle: the pivot slides to where there is room.
  const l3 = playerById(TOP.handball, L3);
  const r3 = playerById(TOP.handball, "defense-defence-6-0-4");
  const crowded = withPositions(TOP.handball, {
    [L3]: { x: rest.x - 0.5, y: l3.position.y },
    "defense-defence-6-0-4": { x: rest.x + 0.5, y: r3.position.y },
  });
  const moved = pivotTarget(crowded, "TOP", 10)!;
  assert.ok(Math.abs(moved.x - rest.x) > 1.5, "the pivot moved away from the two defenders closing on his spot");
  // And an unavailable pivot is not fed: with a defender on him he is scored as not available.
  const marked = withPositions(TOP.handball, { [L3]: playerById(TOP.handball, PIVOT).position });
  const decision = decideAttackAction(context(marked, CENTRE_BACK));
  const pivotOption = decision.options.find((o) => o.kind === "PLAY_PIVOT")!;
  assert.equal(pivotOption.score, 0);
  assert.ok(pivotOption.detail.includes("not available"));
});

// ---------------------------------------------------------------------------
// 6. Reset instead of a forced shot
// ---------------------------------------------------------------------------

test("a closed gap can cause a reset rather than a forced shot", () => {
  const result = possession(SEED_BLOCKED_THEN_RESET);
  const index = result.trace.findIndex((t) => t.decision?.blockedBy && t.decision.chosen.kind === "RESET");
  assert.ok(index >= 0, "a closed gap led to a reset");
  const entry = result.trace[index];
  const reset = entry.decision!;
  assert.notEqual(reset.chosen.kind, "SHOOT");
  const carrier = entry.playerPositions.find((p) => p.playerId === reset.carrierId)!.position;
  const outlet = entry.playerPositions.find((p) => p.playerId === reset.chosen.targetPlayerId)!.position;
  const toGoal = (p: MeterPoint) => Math.hypot(p.x - 10, p.y);
  assert.ok(toGoal(outlet) >= toGoal(carrier), "the ball goes back OUT, never deeper toward the goal");
  assert.ok(["LEFT_BACK", "CENTER_BACK", "RIGHT_BACK"].includes(playerById(result.finalState.handball, reset.chosen.targetPlayerId!).role), "to a back");
  assert.ok(result.trace.slice(index + 1).some((t) => t.note.includes("re-forms")), "and the attack re-forms rather than ending");
  assert.ok(result.trace.slice(index + 1).some((t) => t.decision), "then decides again from the new situation");
});

// ---------------------------------------------------------------------------
// 7. Width
// ---------------------------------------------------------------------------

test("width remains healthy over repeated possessions", () => {
  const run = simulateGameSequence(TOP, 12, { maxPossessions: 30 });
  const organized = run.trace.filter((t) => t.phase === "CIRCULATION" || t.phase === "ATTACK_ACTION");
  assert.ok(organized.length > 100, "enough organized play to judge");
  const widths = organized.map((t) => {
    const attackers = run.finalState.rosters[t.possessionTeam].filter((id) => !id.includes("goalkeeper"));
    const xs = t.playerPositions.filter((p) => attackers.includes(p.playerId)).map((p) => p.position.x);
    return Math.max(...xs) - Math.min(...xs);
  });
  const mean = widths.reduce((a, b) => a + b, 0) / widths.length;
  const narrow = widths.filter((w) => w < 8).length / widths.length;
  assert.ok(mean > 12, `mean organized width ${mean.toFixed(2)}m stays recognisably wide`);
  assert.ok(narrow < 0.05, `${(narrow * 100).toFixed(1)}% of organized frames narrower than 8m`);
  assert.ok(outfieldAttackWidth(TOP.handball) > 15, "and the canonical shape itself is wide");
});

// ---------------------------------------------------------------------------
// 8 & 10. State dependence
// ---------------------------------------------------------------------------

test("action selection depends on spatial state", () => {
  const rest = decideAttackAction(context(TOP.handball, CENTRE_BACK));
  assert.ok(!rest.options.some((o) => o.kind === "SHOOT"), "from 12m out a shot is not even on the menu");
  assert.ok(rest.options.some((o) => o.kind === "ATTACK_GAP" && o.score > 0), "attacking a gap is");
  // Same player, same seed, stood 8m from goal with the defence still at rest.
  const close = withPositions(TOP.handball, { [CENTRE_BACK]: { x: 10, y: 8.5 } });
  const near = decideAttackAction(context(close, CENTRE_BACK));
  assert.ok(near.options.some((o) => o.kind === "SHOOT"), "from 8.5m the shot exists as an option");
  assert.notDeepEqual(
    near.options.map((o) => [o.kind, o.gapId ?? o.targetPlayerId]),
    rest.options.map((o) => [o.kind, o.gapId ?? o.targetPlayerId]),
    "the option set itself is different",
  );
  assert.notEqual(near.chosen.kind === rest.chosen.kind && near.chosen.gapId === rest.chosen.gapId && near.chosen.targetPlayerId === rest.chosen.targetPlayerId, true, "and so is the choice");
});

test("different defensive states produce different actions for the same attacking player", () => {
  // M9 mid-drive at V2_V3, 2.5m short of the line.
  const gaps = perceiveGaps(TOP.handball, "TOP");
  const target = gaps.find((g) => g.gapId === "V2_V3")!.attackPoint;
  const driving = withPositions(TOP.handball, { [CENTRE_BACK]: { x: target.x + 0.6, y: target.y + 2.5 } });
  const asDriver = (state: HandballState): HandballState => ({
    ...state,
    players: state.players.map((p) => (p.id === CENTRE_BACK ? { ...p, intent: { type: "ATTACK", gapId: "V2_V3", target: { ...target }, completed: false } } : p)),
    ball: { ...state.ball, possessorId: CENTRE_BACK, position: { ...playerById(state, CENTRE_BACK).position } },
  });
  const open = decideAttackAction(context(asDriver(driving), CENTRE_BACK, { trigger: "DRIVE_REEVALUATION", drivingGapId: "V2_V3" }));
  assert.equal(open.blockedBy, null, "with the defence at rest the drive is open");
  assert.equal(open.chosen.kind, "CONTINUE");
  assert.ok(open.chosen.detail.includes("still open"));

  // Now L3 has stepped into the path, 1m ahead.
  const l3Blocking = { x: target.x + 0.6, y: target.y + 1.4 };
  const blocked = decideAttackAction(context(asDriver(withPositions(driving, { [L3]: l3Blocking })), CENTRE_BACK, { trigger: "DRIVE_REEVALUATION", drivingGapId: "V2_V3" }));
  assert.equal(blocked.blockedBy, L3, "the step-out is read from L3's real position");
  assert.ok(!blocked.options.some((o) => o.kind === "CONTINUE" && o.detail.includes("still open")), "the open drive is no longer an option");
  const changed = blocked.chosen.kind !== "CONTINUE" || blocked.chosen.detail.includes("takes on");
  assert.ok(changed, `the same player now does something else: ${blocked.chosen.kind} (${blocked.chosen.detail})`);
  assert.notDeepEqual(blocked.chosen, open.chosen);
});

// ---------------------------------------------------------------------------
// 9. Determinism
// ---------------------------------------------------------------------------

test("the same state and seed produce an identical decision trace", () => {
  const a = decisions(12).map((d) => d.decision);
  const b = decisions(12).map((d) => d.decision);
  assert.ok(a.length >= 3, "the possession contains several decisions");
  assert.deepEqual(b, a, "byte-for-byte identical decisions, options and scores");
  const x = decideAttackAction(context(TOP.handball, CENTRE_BACK));
  const y = decideAttackAction(context(TOP.handball, CENTRE_BACK));
  assert.deepEqual(y, x);
  // ...and the trace explains every decision from its situation.
  for (const { entry } of decisions(12)) {
    assert.ok(entry.decision!.options.length > 0);
    assert.ok(entry.decision!.chosen.detail.length > 0, "every chosen option carries its reason");
  }
});

// ---------------------------------------------------------------------------
// Tactical input and defensive homes
// ---------------------------------------------------------------------------

test("the decision layer honours a tactical side preference without any script", () => {
  const hSide = (side: number) => {
    let h = 0;
    let v = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      for (const t of simulatePossession({ seed, initialState: TOP, tactics: { side } }).trace) {
        const gap = t.decision?.chosen.kind === "ATTACK_GAP" ? t.decision.chosen.gapId! : null;
        if (gap === "H2_H1" || gap === "H3_H2") h += 1;
        if (gap === "V1_V2" || gap === "V2_V3") v += 1;
      }
    }
    return { h, v };
  };
  const left = hSide(-1);
  const right = hSide(1);
  assert.ok(right.h / Math.max(1, right.h + right.v) > left.h / Math.max(1, left.h + left.v), "preferring the H side shifts the attacks toward it");
  // M12 adds a fifth dial (gapAppetite). The point of this assertion is that
  // the DEFAULT is neutral on every dial there is -- so it grows with them.
  assert.deepEqual(DEFAULT_ATTACK_TACTICS, { width: 0, tempo: 0, side: 0, pivotUsage: 0, gapAppetite: 0 });
});

test("an organized possession gives a home-less 6:0 its canonical homes, and leaves an existing shape alone", () => {
  const homeless: HandballState = { ...TOP.handball, defense: { ...TOP.handball.defense, homePositions: [] } };
  const restored = ensureSixZeroHomePositions(homeless, "TOP");
  assert.equal(restored.defense.homePositions.length, 6);
  for (const home of restored.defense.homePositions) {
    const canonical = TOP.handball.defense.homePositions.find((h) => h.role === home.role)!;
    assert.deepEqual(home.position, canonical.position, `${home.role} gets FIELD's canonical 6:0 home`);
  }
  assert.strictEqual(ensureSixZeroHomePositions(TOP.handball, "TOP"), TOP.handball, "a defence that already has a shape is untouched");
  const bottom = ensureSixZeroHomePositions(homeless, "BOTTOM");
  assert.ok(bottom.defense.homePositions.every((h) => h.position.y > 30), "at the far goal the homes are mirrored, not copied");
});
