// MATCH-EXPERIENCE-2.0 M22: seven against six, and an empty goal.
//
// The test that must never be deleted is "no goalkeeper contest happens when
// there is no goalkeeper". Everything else in this milestone is a convenience
// on top of that one fact: 7v6 is only honest if the goal is genuinely empty,
// and the moment a hidden keeper is produced to contest a shot -- or a bonus is
// added because there isn't one -- the whole thing becomes a modifier wearing a
// handball costume.
//
// The second thing under test is the population. Seven is seven. A milestone
// that adds a player is one bug away from putting eight on the court, so every
// state these tests build is checked for a legal side.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scenario, requireScenarioPlayer } from "../scenarios/matchScenario";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { resolveShot } from "./possessionEngine";
import { organizedShapeTargetFor } from "./organizedAttack";
import { perceiveAttack } from "../policies/defense/collectiveDefense";
import { evaluateSixZeroDefense } from "../policies/defense/sixZeroDefensePolicy";
import { observeDefensiveThreat } from "../policies/defense/threat";
import { perceiveTransition, decideBreakAction } from "./transitionDecision";
import { createPossessionRng } from "./possessionRng";
import { stepWithSubstitutions } from "./substitutionExit";
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import { goalCentre } from "../domain/match/possession";
import {
  COURT_SIDE_SIZE,
  courtPopulationIsLegal,
  emptyGoalDistance,
  endSevenVsSix,
  fieldPlayersOnCourt,
  goalkeeperOnCourt,
  isSevenVsSix,
  ownGoalIsEmpty,
  startSevenVsSix,
} from "./sevenVsSix";
import type { HandballState } from "../domain/handball/state";
import type { MeterPoint } from "../domain/geometry/coordinates";

const ratings = undefined;

/** An organized attack playing seven out: no keeper of their own, a second man on the line. */
function sevenOut(overrides: { extraAttacker?: MeterPoint; attackingGoalSide?: "TOP" | "BOTTOM" } = {}): HandballState {
  return scenario({
    attackingGoalSide: overrides.attackingGoalSide ?? "TOP",
    ballCarrier: "M9",
    without: ["GK_ATTACK"],
    extraAttacker: overrides.extraAttacker ?? { x: 14.5, y: 6.7 },
    phase: "CIRCULATION",
  }).handball;
}

/** The same attack, still with its keeper -- the 6v6 twin to compare against. */
function sixOut(): HandballState {
  return scenario({ ballCarrier: "M9", phase: "CIRCULATION" }).handball;
}

// ---------------------------------------------------------------------------
// 1. Legal population
// ---------------------------------------------------------------------------

test("seven out means seven outfield players and no goalkeeper, never eight of anything", () => {
  const state = sevenOut();
  assert.equal(fieldPlayersOnCourt(state, "ATTACK").length, COURT_SIDE_SIZE, "seven outfield attackers");
  assert.equal(goalkeeperOnCourt(state, "ATTACK"), null, "and no goalkeeper of their own");
  assert.equal(isSevenVsSix(state, "ATTACK"), true);
  assert.equal(ownGoalIsEmpty(state, "ATTACK", "BOTTOM"), true, "so their goal is empty");

  // The other side is untouched and still a normal six plus a keeper.
  assert.equal(fieldPlayersOnCourt(state, "DEFENSE").length, 6);
  assert.ok(goalkeeperOnCourt(state, "DEFENSE"), "the defence still has its keeper");
  assert.equal(isSevenVsSix(state, "DEFENSE"), false);

  for (const team of ["ATTACK", "DEFENSE"] as const) {
    assert.ok(courtPopulationIsLegal(state, team), `${team} has a legal side`);
  }
});

test("asking for seven out twice cannot put eight men on the court", () => {
  const base = createFullCourt6v6State({ attackingGoalSide: "TOP" }).handball;
  const seventh = { ...requireScenarioPlayer(base, "M6"), id: "seventh" };
  const once = startSevenVsSix(base, "ATTACK", seventh);
  const twice = startSevenVsSix(once, "ATTACK", { ...seventh, id: "eighth" });
  assert.equal(twice, once, "the second request is refused outright, not queued");
  assert.ok(courtPopulationIsLegal(twice, "ATTACK"));
});

// ---------------------------------------------------------------------------
// 2. The extra man is a real extra threat
// ---------------------------------------------------------------------------

test("the seventh attacker works the line, in a different gap from the pivot", () => {
  const state = sevenOut();
  const pivot = state.players.find((p) => p.team === "ATTACK" && p.role === "PIVOT");
  const extra = state.players.find((p) => p.role === "EXTRA_ATTACKER");
  assert.ok(pivot && extra, "both line players exist");

  const target = organizedShapeTargetFor(extra, state, "TOP");
  assert.ok(target, "the shape knows where to put him -- he is not a player without a spot");
  assert.ok(
    Math.abs(target.x - pivot.position.x) > 1.5,
    `he takes a different gap from the pivot (his ${target.x.toFixed(1)} vs pivot ${pivot.position.x.toFixed(1)})`,
  );
});

test("the defence sees seven attackers and two men on the line, not six and one", () => {
  const seven = sevenOut();
  const six = sixOut();
  const perceptionOf = (state: HandballState) =>
    perceiveAttack(
      state,
      observeDefensiveThreat(state),
      state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER") as never,
    );

  const withSeven = perceptionOf(seven);
  const withSix = perceptionOf(six);
  assert.equal(withSeven.attackers.length, 7, "the defence counts seven");
  assert.equal(withSix.attackers.length, 6);
  assert.ok(
    withSeven.linePlayers.length > withSix.linePlayers.length,
    `and more of them on the line (${withSeven.linePlayers.length} vs ${withSix.linePlayers.length})`,
  );
});

test("six defenders cannot cover seven attackers", () => {
  // The point of being outnumbered: somebody is free. The defence may pick up a
  // second line player when a man happens to be spare, but it can never account
  // for all seven, and this pins that rather than hoping for it.
  const state = sevenOut();
  const result = evaluateSixZeroDefense(state);
  const accounted = new Set(
    [result.primaryDefenderId, result.pivotMarkerId, ...result.supportDefenderIds].filter((id): id is string => id !== null),
  );
  assert.ok(result.reactions.length === 6, "there are still only six defenders");
  assert.ok(accounted.size < 7, "and they cannot between them be responsible for seven men");
});

// ---------------------------------------------------------------------------
// 3. The empty goal
// ---------------------------------------------------------------------------

test("a shot at an empty goal is never contested by a goalkeeper who is not there", () => {
  // THE test. The keeper is off the court, so no read, no dive, no save.
  const state = scenario({
    ballCarrier: "M9",
    attackers: { M9: { x: 10, y: 9 } },
    without: ["GK_DEFENCE"],
    phase: "ATTACK_ACTION",
  }).handball;
  assert.equal(goalkeeperOnCourt(state, "DEFENSE"), null, "the fixture really has an empty goal");

  const shooter = requireScenarioPlayer(state, "M9");
  const event = resolveShot(state, shooter, "TOP", createPossessionRng(7), ratings);
  assert.equal(event.resolution.keeperRead, null, "nobody read the shot");
  assert.equal(event.resolution.contest, null, "and nobody contested it");
  assert.equal(event.resolution.keeperAtArrival, null, "there was no keeper to arrive");
  // It is still a shot, not a gift: it has to be on target and unblocked.
  assert.ok(["SHOT_GOAL", "SHOT_MISSED"].includes(event.resolution.outcome));
});

test("an empty goal still has to be hit", () => {
  // Over many attempts from a long way out, an unguarded goal is missed
  // sometimes -- because M9 resolves the geometry rather than awarding a goal.
  const state = scenario({
    ballCarrier: "M9",
    attackers: { M9: { x: 10, y: 26 } },
    without: ["GK_DEFENCE"],
    phase: "ATTACK_ACTION",
  }).handball;
  const shooter = requireScenarioPlayer(state, "M9");
  const outcomes = new Set<string>();
  for (let seed = 1; seed <= 60; seed += 1) {
    outcomes.add(resolveShot(state, shooter, "TOP", createPossessionRng(seed), ratings).resolution.outcome);
  }
  assert.ok(outcomes.has("SHOT_MISSED"), "a long shot at an open net can still miss");
});

test("nothing anywhere adds a bonus for an empty goal", () => {
  // Structural. If the words for a modifier ever appear in the 7v6 module, the
  // milestone has become the thing it was written to avoid.
  const source = readFileSync("src/simulation/sevenVsSix.ts", "utf8");
  for (const word of ["goalProbability", "multiplier", "SHOT_GOAL", "rng", "chance", "Math.random"]) {
    assert.ok(!source.includes(word), `sevenVsSix.ts must not mention ${word}`);
  }
});

// ---------------------------------------------------------------------------
// 4. Losing it
// ---------------------------------------------------------------------------

test("a break sees the empty goal and may shoot from outside the usual range", () => {
  // Same runner, same distance, same defenders: the only difference is whether
  // anybody is in the goal.
  const at = { x: 10, y: 17 };
  const guarded = scenario({ ballCarrier: "M9", attackers: { M9: at }, phase: "FIRST_WAVE" }).handball;
  const empty = scenario({ ballCarrier: "M9", attackers: { M9: at }, without: ["GK_DEFENCE"], phase: "FIRST_WAVE" }).handball;

  const decisionIn = (state: HandballState) => {
    const perception = perceiveTransition(state, "TOP");
    assert.ok(perception.carrier);
    return { perception, decision: decideBreakAction(perception, perception.carrier, false) };
  };

  const withKeeper = decisionIn(guarded);
  const withoutKeeper = decisionIn(empty);
  assert.equal(withKeeper.perception.goalIsEmpty, false);
  assert.equal(withoutKeeper.perception.goalIsEmpty, true, "the break can see the goal is empty");
  assert.notEqual(withKeeper.decision.kind, "SHOOT", "17m out against a keeper is not a shot");
  assert.equal(withoutKeeper.decision.kind, "SHOOT", "17m out at an empty net is");
  assert.ok(withoutKeeper.decision.detail.includes("empty"), "and the trace says why");
});

test("an empty goal is still not a shot with a defender on top of him", () => {
  // The empty goal removes the keeper, not the defence. Being clear is still
  // required, which is the condition that was already there.
  const state = scenario({
    ballCarrier: "M9",
    attackers: { M9: { x: 10, y: 17 } },
    defenders: { L3: { x: 10, y: 16 } },
    without: ["GK_DEFENCE"],
    phase: "FIRST_WAVE",
  }).handball;
  const perception = perceiveTransition(state, "TOP");
  assert.ok(perception.carrier);
  const decision = decideBreakAction(perception, perception.carrier, false);
  assert.notEqual(decision.kind, "SHOOT", "a man in his face is still a man in his face");
});

test("how far away the empty goal is, is a fact and not a verdict", () => {
  const state = sevenOut();
  const shooter = requireScenarioPlayer(state, "M9");
  assert.equal(emptyGoalDistance(state, shooter, "BOTTOM", "ATTACK") !== null, true, "their goal is open");
  assert.equal(emptyGoalDistance(state, shooter, "TOP", "DEFENSE"), null, "the other one is not");
});

// ---------------------------------------------------------------------------
// 5. The keeper coming back
// ---------------------------------------------------------------------------

test("the goalkeeper is not in his goal until he has actually come on", () => {
  const base = createFullCourt6v6State({ attackingGoalSide: "TOP" }).handball;
  const keeper = requireScenarioPlayer(base, "GK_ATTACK");
  const seventh = { ...requireScenarioPlayer(base, "M6"), id: "seventh" };

  // Out he goes -- and he is still on the court until he reaches the line.
  const going = startSevenVsSix(base, "ATTACK", seventh);
  assert.ok(goalkeeperOnCourt(going, "ATTACK"), "he has been told to go, not teleported off");
  assert.equal(ownGoalIsEmpty(going, "ATTACK", "BOTTOM"), false, "and the goal is not empty yet");

  // Run the ordinary substitution machinery until the swap completes.
  let state = going;
  for (let step = 0; step < 400 && goalkeeperOnCourt(state, "ATTACK"); step += 1) {
    state = stepWithSubstitutions(state, [], 0.05);
    assert.ok(courtPopulationIsLegal(state, "ATTACK"), "never more than seven, at any instant of the walk");
  }
  assert.equal(goalkeeperOnCourt(state, "ATTACK"), null, "he is off");
  assert.equal(ownGoalIsEmpty(state, "ATTACK", "BOTTOM"), true, "and only now is the goal empty");
  assert.equal(fieldPlayersOnCourt(state, "ATTACK").length, COURT_SIDE_SIZE, "with seven out");

  // And back again, through the same machinery.
  const returning = endSevenVsSix(state, "ATTACK", keeper);
  assert.equal(ownGoalIsEmpty(returning, "ATTACK", "BOTTOM"), true, "asking for him back does not put him back");

  // He has to be driven back to his goal, which is what the possession engine
  // does for an arriving keeper. Stepping with no orders at all would only prove
  // that a man nobody has told to move does not move.
  let coming = returning;
  let stepsToReturn = 0;
  const ownGoal = goalCentre("BOTTOM");
  for (; stepsToReturn < 600 && ownGoalIsEmpty(coming, "ATTACK", "BOTTOM"); stepsToReturn += 1) {
    const back = goalkeeperOnCourt(coming, "ATTACK");
    const actions = back
      ? [{ type: "MOVE" as const, playerId: back.id, target: { x: ownGoal.x, y: ownGoal.y - 0.5 } }]
      : [];
    coming = stepWithSubstitutions(coming, actions, 0.05);
    assert.ok(courtPopulationIsLegal(coming, "ATTACK"), "still never eight");
  }
  assert.ok(goalkeeperOnCourt(coming, "ATTACK"), "he is on");
  assert.equal(ownGoalIsEmpty(coming, "ATTACK", "BOTTOM"), false, "and the goal is guarded once he is in it");
  assert.ok(stepsToReturn > 0, "and it took him real time to get there -- the race the opponent is running against");
});

// ---------------------------------------------------------------------------
// 6. Symmetry and determinism
// ---------------------------------------------------------------------------

test("seven out reads the same at either end of the court", () => {
  const mirror = (p: MeterPoint): MeterPoint => ({ x: p.x, y: mirrorYForOppositeGoalSide(p.y) });
  const top = sevenOut({ extraAttacker: { x: 14.5, y: 6.7 } });
  const bottom = sevenOut({ attackingGoalSide: "BOTTOM", extraAttacker: mirror({ x: 14.5, y: 6.7 }) });

  assert.equal(isSevenVsSix(top, "ATTACK"), isSevenVsSix(bottom, "ATTACK"));
  const extraTop = top.players.find((p) => p.role === "EXTRA_ATTACKER");
  const extraBottom = bottom.players.find((p) => p.role === "EXTRA_ATTACKER");
  assert.ok(extraTop && extraBottom);
  const a = organizedShapeTargetFor(extraTop, top, "TOP");
  const b = organizedShapeTargetFor(extraBottom, bottom, "BOTTOM");
  assert.ok(a && b);
  assert.equal(a.x.toFixed(6), b.x.toFixed(6), "the same gap");
  assert.equal(a.y.toFixed(6), mirrorYForOppositeGoalSide(b.y).toFixed(6), "at the mirrored depth");
});

test("the same seven-out situation resolves the same way every time", () => {
  const state = sevenOut();
  const shooter = requireScenarioPlayer(state, "M9");
  const a = resolveShot(state, shooter, "TOP", createPossessionRng(11), ratings);
  const b = resolveShot(state, shooter, "TOP", createPossessionRng(11), ratings);
  assert.equal(a.resolution.outcome, b.resolution.outcome);
  assert.equal(a.resolution.detail, b.resolution.detail);
});
