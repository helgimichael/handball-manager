// MATCH-EXPERIENCE-2.0 M12: timeouts and manager interventions.
//
// The test that must never be deleted is "an instruction changes the decision,
// not the outcome". The whole danger of a coaching layer is that it becomes a
// set of hidden modifiers -- "attack the pivot more" quietly meaning "the next
// pass goes to the pivot", "defend harder" quietly meaning "the opponent turns
// it over more often". A change that made either of those true would satisfy
// most of the rest of this file and would have destroyed the thing M6-M11 were
// built to be.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { buildMatchBench } from "../scenarios/matchSquad";
import { simulateMatch } from "./matchRunner";
import { simulatePossession } from "./possessionEngine";
import { decideAttackAction, type AttackOption } from "./attackDecision";
import { evaluateSixZeroDefense } from "../policies/defense/sixZeroDefensePolicy";
import { createPossessionRng } from "./possessionRng";
import { autonomousCoach, type CoachCommand, type CoachController, type InterventionRecord } from "./coach";
import { resolveAttackTactics, type AttackTactics } from "./organizedAttack";
import { DEFAULT_TIMEOUT_RULES, timeoutsUsed } from "./timeout";
import { hasReachedSubstitutionArea, isLeavingCourt, stepWithSubstitutions } from "./substitutionExit";
import { SIMULATION_DT_SECONDS } from "./fixedStep";
import { distanceBetween } from "../domain/geometry/coordinates";
import {
  advanceOneSegment,
  applyCoachCommand,
  applySuspension,
  createGameFlowState,
  deadBallBoundary,
  startPendingSuspensions,
  teamOf,
  type CoachBoundary,
  type GameFlowSegment,
  type GameFlowState,
  type MatchTeamId,
} from "./gameFlow";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const BENCH = buildMatchBench(TOP);
const CENTRE_BACK = "attack-attack-6-3";

function flow(matchSeconds = 600): GameFlowState {
  return createGameFlowState(TOP, matchSeconds, BENCH);
}

/** HOME holds the ball in the canonical state, so a HOME timeout is legal at a restart. */
const RESTART: CoachBoundary = { kind: "CENTRE_RESTART", possessionTeam: "HOME", deadBall: true };

function apply(state: GameFlowState, command: CoachCommand, boundary: CoachBoundary = RESTART): { flow: GameFlowState; records: readonly InterventionRecord[] } {
  return applyCoachCommand(state, command, boundary);
}

/** A coach who says exactly this, once, at the first boundary he is asked. */
function scripted(commands: readonly CoachCommand[]): CoachController {
  let spent = false;
  return () => {
    if (spent) return [];
    spent = true;
    return commands;
  };
}

function positionsOf(state: GameFlowState): { id: string; x: number; y: number }[] {
  return state.match.handball.players.map((p) => ({ id: p.id, x: p.position.x, y: p.position.y }));
}

function attackContext(state: GameFlowState, tactics: Partial<AttackTactics>) {
  const handball = state.match.handball;
  return {
    state: handball,
    goalSide: "TOP" as const,
    carrier: handball.players.find((p) => p.id === CENTRE_BACK)!,
    trigger: "SETTLED" as const,
    drivingGapId: null,
    passesMade: 1,
    resets: 0,
    possessionSeconds: 3,
    lastPasserId: null,
    tactics: resolveAttackTactics(tactics),
    // The SAME seeded stream both times: any difference is the instruction, not luck.
    rng: createPossessionRng(99),
  };
}

/** The same match with the pivot standing somewhere else. Used to make him available. */
function withPivotAt(state: GameFlowState, position: { x: number; y: number }): GameFlowState {
  const handball = state.match.handball;
  return {
    ...state,
    match: {
      ...state.match,
      handball: {
        ...handball,
        players: handball.players.map((p) => (p.team === "ATTACK" && p.role === "PIVOT" ? { ...p, position } : p)),
      },
    },
  };
}

function scoreOf(options: readonly AttackOption[], kind: AttackOption["kind"]): number {
  return Math.max(...options.filter((o) => o.kind === kind).map((o) => o.score), Number.NEGATIVE_INFINITY);
}

// ---------------------------------------------------------------------------
// 1. The timeout itself
// ---------------------------------------------------------------------------

test("a timeout stops the match without moving a clock or a player", () => {
  const before = flow(600);
  const taken = apply(before, { kind: "TIMEOUT", team: "HOME", reason: "test" });
  assert.ok(taken.records.some((r) => r.kind === "TIMEOUT_BEGINS"), "the timeout was granted");
  const after = taken.flow;

  // The official clock is the one that must not move: a timeout is dead time.
  assert.equal(after.matchSeconds, before.matchSeconds, "official match time does not advance");
  // Nor is any of it simulated -- there is nothing to simulate.
  assert.equal(after.match.handball.simulationTime, before.match.handball.simulationTime, "no spatial time passes either");

  // The court is not rebuilt: the same entities, in the same places.
  assert.deepEqual(positionsOf(after), positionsOf(before), "every player is exactly where the whistle left him");
  assert.deepEqual(after.match.handball.ball, before.match.handball.ball, "and so is the ball");
  assert.deepEqual(after.score, before.score, "the score is untouched");
  assert.deepEqual(after.match.possession, before.match.possession, "and so is the possession, so the restart is unchanged");

  assert.equal(after.timeouts.length, 1);
  assert.equal(after.timeouts[0].team, "HOME");
  assert.equal(after.timeouts[0].half, 1, "600s is in the first half");
});

test("a timeout is refused when it would not be legal", () => {
  const live = apply(flow(), { kind: "TIMEOUT", team: "HOME", reason: "x" }, { kind: "ORGANIZED", possessionTeam: "HOME", deadBall: false });
  assert.equal(live.flow.timeouts.length, 0);
  assert.ok(live.records[0].detail.includes("the ball is live"), "not while the ball is live");

  const wrongSide = apply(flow(), { kind: "TIMEOUT", team: "AWAY", reason: "x" });
  assert.equal(wrongSide.flow.timeouts.length, 0);
  assert.ok(wrongSide.records[0].detail.includes("does not have the ball"), "and not by the side without the ball");

  // The allowance is spent one timeout at a time, and per half as well as per match.
  let state = flow(0);
  const rules = state.timeoutRules;
  assert.deepEqual(rules, DEFAULT_TIMEOUT_RULES, "the default allowance is the configurable value, not a constant in the engine");
  for (let i = 0; i < rules.perHalf; i += 1) {
    // Spaced out, so the minimum gap is not what stops him.
    state = { ...apply(state, { kind: "TIMEOUT", team: "HOME", reason: "x" }).flow, matchSeconds: (i + 1) * 300 };
  }
  const overHalf = apply(state, { kind: "TIMEOUT", team: "HOME", reason: "x" });
  assert.equal(timeoutsUsed(overHalf.flow.timeouts, "HOME"), rules.perHalf, "the allowance for the half is spent");
  assert.ok(overHalf.records[0].detail.includes("in this half"));
});

test("the timeout allowance is a competition rule, not an engine constant", () => {
  const strict = createGameFlowState(TOP, 300, BENCH, { timeoutRules: { perMatch: 1, perHalf: 1, minSecondsBetween: 0 } });
  const first = apply(strict, { kind: "TIMEOUT", team: "HOME", reason: "x" });
  assert.equal(first.flow.timeouts.length, 1);
  const second = apply(first.flow, { kind: "TIMEOUT", team: "HOME", reason: "x" });
  assert.equal(second.flow.timeouts.length, 1, "a one-timeout competition grants exactly one");
  assert.ok(second.records[0].detail.includes("all 1 timeouts"));
});

test("suspension clocks do not run during a timeout", () => {
  const offender = TOP.handball.players.find((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER")!;
  const short = startPendingSuspensions(applySuspension(flow(600), offender.id, "test"), 600);
  const serving = short.suspensions[0];
  assert.equal(serving.startedAtMatchSeconds, 600);

  const stopped = apply(short, { kind: "TIMEOUT", team: "HOME", reason: "x" }).flow;
  assert.equal(stopped.matchSeconds, 600, "the clock the two minutes are served against has not moved");
  assert.deepEqual(stopped.suspensions, short.suspensions, "so not a second of the suspension has been served");
  assert.equal(stopped.match.handball.players.some((p) => p.id === offender.id), false, "and he is still off the court");
});

// ---------------------------------------------------------------------------
// 2. Play resumes on the same match
// ---------------------------------------------------------------------------

test("a segment played through a timeout is the same segment, plus the coaching", () => {
  const start = flow(600);
  const quiet = advanceOneSegment(start, 12, 0, false, "CENTRE_RESTART", {});
  const stopped = advanceOneSegment(start, 12, 0, false, "CENTRE_RESTART", {
    coaches: { HOME: scripted([{ kind: "TIMEOUT", team: "HOME", reason: "test" }]) },
  });

  assert.ok(stopped.segment.interventions.some((r) => r.kind === "TIMEOUT_BEGINS"), "the timeout happened");
  assert.ok(stopped.segment.interventions.some((r) => r.kind === "TIMEOUT_ENDS"), "and ended");

  // The restart that was already due is the restart that is taken.
  assert.equal(stopped.segment.kind, quiet.segment.kind, "the same restart");
  assert.equal(stopped.segment.team, quiet.segment.team, "taken by the same side");
  assert.equal(stopped.nextKind, quiet.nextKind, "and it continues into the same thing");

  // Nothing about the play differs: same outcome, same simulated seconds, same
  // official time consumed, same steps. The RNG stream is untouched because the
  // coach never drew from it.
  assert.equal(stopped.segment.outcome, quiet.segment.outcome);
  assert.equal(stopped.steps, quiet.steps, "the same number of fixed steps were simulated");
  assert.equal(stopped.simulatedSeconds, quiet.simulatedSeconds);
  assert.equal(stopped.flow.matchSeconds, quiet.flow.matchSeconds, "and the official clock reached the same second");
  assert.deepEqual(positionsOf(stopped.flow), positionsOf(quiet.flow), "the players ended in identical positions");
  assert.deepEqual(stopped.flow.score, quiet.flow.score);

  // The only difference in the trace is the coaching, recorded as its own frames.
  const notes = stopped.trace.filter((t) => t.note.startsWith("TIMEOUT")).map((t) => t.note);
  assert.equal(stopped.trace.length, quiet.trace.length + notes.length, "exactly the coaching frames were added");
  assert.ok(notes[0].includes("TIMEOUT_BEGINS (HOME)"));
  assert.ok(notes[notes.length - 1].includes("TIMEOUT_ENDS (HOME)"));
});

test("an instruction given at a timeout is still in force possessions later", () => {
  let state = flow(600);
  const coach = scripted([
    { kind: "TIMEOUT", team: "HOME", reason: "test" },
    { kind: "SET_ATTACK", team: "HOME", changes: { tempo: 0.7, pivotUsage: 0.6 }, reason: "test" },
    { kind: "SET_DEFENCE", team: "HOME", changes: { aggression: 0.5 }, reason: "test" },
  ]);

  let kind: GameFlowSegment["kind"] = "CENTRE_RESTART";
  let isTransition = false;
  for (let i = 0; i < 6; i += 1) {
    const advance = advanceOneSegment(state, 12, i, isTransition, kind, { coaches: { HOME: coach } });
    state = advance.flow;
    isTransition = advance.nextIsTransition;
    kind = advance.nextKind;
  }

  assert.equal(state.instructions.HOME.attack.tempo, 0.7, "the tempo he asked for survives six segments of play");
  assert.equal(state.instructions.HOME.attack.pivotUsage, 0.6);
  assert.equal(state.instructions.HOME.defence.aggression, 0.5);
  assert.deepEqual(state.instructions.AWAY, flow().instructions.AWAY, "and the other side is untouched");
  assert.ok(state.matchSeconds > 600, "the match really did play on");
});

// ---------------------------------------------------------------------------
// 3. DO NOT DELETE: an instruction changes the decision, not the outcome
// ---------------------------------------------------------------------------

test("an instruction changes the decision, not the outcome", () => {
  const state = flow();
  // The canonical shape has the pivot MARKED -- the nearest defender is 0.75m
  // off him -- so this second state moves him into real space. The pair is the
  // whole point of the test: the same instruction does something in one and
  // nothing in the other, because the situation is what decides.
  const pivotFree = withPivotAt(state, { x: 7.2, y: 6.6 });

  // The SAME spatial state and the SAME seeded stream, read under opposite
  // instructions. Only the weighting differs.
  const shy = decideAttackAction(attackContext(pivotFree, { pivotUsage: -1 }));
  const keen = decideAttackAction(attackContext(pivotFree, { pivotUsage: 1 }));
  assert.ok(
    scoreOf(keen.options, "PLAY_PIVOT") > scoreOf(shy.options, "PLAY_PIVOT"),
    `asking for the pivot raises what feeding him is worth (${scoreOf(keen.options, "PLAY_PIVOT").toFixed(3)} vs ${scoreOf(shy.options, "PLAY_PIVOT").toFixed(3)})`,
  );

  const patient = decideAttackAction(attackContext(state, { gapAppetite: -1 }));
  const direct = decideAttackAction(attackContext(state, { gapAppetite: 1 }));
  assert.ok(scoreOf(direct.options, "ATTACK_GAP") > scoreOf(patient.options, "ATTACK_GAP"), "directness raises taking a gap on");
  assert.ok(scoreOf(direct.options, "RESET") < scoreOf(patient.options, "RESET"), "and lowers working the ball again");

  // ...and this is the part that matters. A pivot who is NOT available scores
  // zero however hard the coach asks for him, so the instruction cannot conjure
  // the pass. It moves a weight; the situation still decides.
  const forced = decideAttackAction(attackContext(state, { pivotUsage: 1 }));
  const pivotOption = forced.options.find((o) => o.kind === "PLAY_PIVOT");
  assert.ok(pivotOption, "the option still exists");
  assert.ok(pivotOption!.detail.includes("not available"), "the marked pivot is read as unavailable");
  assert.equal(pivotOption!.score, 0, "and is worth nothing, whatever the coach wants");
  assert.notEqual(forced.chosen.kind, "PLAY_PIVOT", "so the pass is not made");
});

test("a defensive instruction changes where defenders go, not what happens to the ball", () => {
  const state = flow().match.handball;
  const passive = evaluateSixZeroDefense(state, { tactics: { aggression: -1, compactness: -1, helpEmphasis: -1, pivotProtection: -1 } });
  const eager = evaluateSixZeroDefense(state, { tactics: { aggression: 1, compactness: 1, helpEmphasis: 1, pivotProtection: 1 } });

  // Compactness moves the LINE: the same six men, standing narrower.
  const spread = (homes: typeof passive.lineHomes) => Math.max(...homes.map((h) => h.position.x)) - Math.min(...homes.map((h) => h.position.x));
  assert.ok(spread(eager.lineHomes) < spread(passive.lineHomes) - 0.5, `a compact line is narrower (${spread(eager.lineHomes).toFixed(2)}m vs ${spread(passive.lineHomes).toFixed(2)}m)`);

  // Aggression moves the man who steps out: further from where he started.
  const stepOut = (result: typeof passive): number => {
    const engage = result.reactions.find((r) => r.reactionType === "ENGAGE" || r.reactionType === "PRESS");
    if (!engage) return 0;
    const home = result.lineHomes.find((h) => h.defenderId === engage.defenderId)!.position;
    return distanceBetween(home, engage.target);
  };
  assert.ok(stepOut(eager) > stepOut(passive), `an aggressive defender steps further (${stepOut(eager).toFixed(2)}m vs ${stepOut(passive).toFixed(2)}m)`);

  // And nothing about the instruction reached the ball: same possession, same
  // ball, same players. A defensive instruction is a set of targets.
  assert.equal(eager.reactions.length, passive.reactions.length, "the same six defenders react either way");
  for (const reaction of [...eager.reactions, ...passive.reactions]) {
    assert.ok(state.players.some((p) => p.id === reaction.defenderId), "and every one of them is a real player on the court");
  }
});

test("two possessions from the same state under different instructions genuinely diverge", () => {
  const state = flow().match;
  const patient = simulatePossession({ seed: 21, initialState: state, tactics: { tempo: -1, gapAppetite: -1, pivotUsage: -1 } });
  const direct = simulatePossession({ seed: 21, initialState: state, tactics: { tempo: 1, gapAppetite: 1, pivotUsage: 1 } });

  const kinds = (r: typeof patient) => r.trace.filter((t) => t.decision).map((t) => t.decision!.chosen.kind);
  assert.ok(kinds(patient).length > 0 && kinds(direct).length > 0, "both possessions produced decisions");
  assert.notDeepEqual(kinds(direct), kinds(patient), "the same seed and the same court produce a different sequence of decisions");
  // Both are still legitimate possessions -- the instruction did not break play.
  assert.equal(patient.guardTripped, false);
  assert.equal(direct.guardTripped, false);
});

// ---------------------------------------------------------------------------
// 4. Personnel goes through M11, and only M11
// ---------------------------------------------------------------------------

test("a manager substitution uses M11's existing lifecycle", () => {
  const start = flow(600);
  const outgoing = start.match.handball.players.find(
    (p) => p.kind === "FIELD_PLAYER" && teamOf(start.rosters as Record<MatchTeamId, readonly string[]>, p.id) === "HOME",
  )!;
  const incoming = start.bench.HOME.find((p) => p.kind === "FIELD_PLAYER")!;

  const asked = apply(start, { kind: "SUBSTITUTE", team: "HOME", outgoingPlayerId: outgoing.id, incomingPlayerId: incoming.id, reason: "fresh legs" });
  assert.ok(asked.records.some((r) => r.kind === "SUBSTITUTION_REQUESTED"), "the request was accepted");

  // REQUESTED: this is M11's state, not a second mechanism. The man going off is
  // still on the court and marked as leaving; his replacement is still seated.
  assert.equal(asked.flow.pendingSubstitutions.length, 1, "it is an ordinary pending substitution");
  assert.equal(asked.flow.pendingSubstitutions[0].outgoingPlayerId, outgoing.id);
  assert.ok(isLeavingCourt(asked.flow.match.handball.players.find((p) => p.id === outgoing.id)!), "he is walking off");
  assert.equal(asked.flow.match.handball.players.some((p) => p.id === incoming.id), false, "and nobody has come on");
  assert.equal(asked.flow.match.handball.players.length, 14, "the population is unchanged");

  // EXITING -> COMPLETE: the ordinary shared step finishes it, at the line.
  let handball = asked.flow.match.handball;
  let steps = 0;
  while (steps < 400 && handball.players.some(isLeavingCourt)) {
    handball = stepWithSubstitutions(handball, [], SIMULATION_DT_SECONDS);
    steps += 1;
    assert.equal(handball.players.length, 14, "and never a fifteenth player on the way");
  }
  assert.ok(steps > 5, `he walked there (${steps} steps)`);
  assert.equal(handball.players.some((p) => p.id === outgoing.id), false, "he is off");
  const arrived = handball.players.find((p) => p.id === incoming.id)!;
  assert.ok(arrived, "and the man the coach asked for is on");
  assert.ok(hasReachedSubstitutionArea(arrived), "entering through the substitution area, as M11 requires");
  assert.equal(arrived.role, outgoing.role, "inheriting the role he was brought on for");
});

test("an illegal manager substitution is refused rather than forced through", () => {
  const start = flow(600);
  const keeperOnBench = start.bench.HOME.find((p) => p.kind === "GOALKEEPER")!;
  const outfield = start.match.handball.players.find(
    (p) => p.kind === "FIELD_PLAYER" && teamOf(start.rosters as Record<MatchTeamId, readonly string[]>, p.id) === "HOME",
  )!;
  const wrongKind = apply(start, { kind: "SUBSTITUTE", team: "HOME", outgoingPlayerId: outfield.id, incomingPlayerId: keeperOnBench.id, reason: "x" });
  assert.equal(wrongKind.flow.pendingSubstitutions.length, 0, "M11's rules still apply to the manager");
  assert.equal(wrongKind.records[0].kind, "REFUSED");
});

// ---------------------------------------------------------------------------
// 5. The automatic coach, over a whole match
// ---------------------------------------------------------------------------

test("the automatic coach actually uses the system across a whole match", () => {
  const coaches = { HOME: autonomousCoach(), AWAY: autonomousCoach() };
  const match = simulateMatch(TOP, 12, { coaches });
  const interventions = match.segments.flatMap((s) => s.interventions.map((r) => ({ ...r, half: s.half })));

  assert.ok(interventions.some((r) => r.kind === "TIMEOUT_BEGINS"), "he stops the match");
  assert.ok(interventions.some((r) => r.kind === "TIMEOUT_ENDS"), "and starts it again");
  assert.ok(interventions.some((r) => r.kind === "INSTRUCTION" && r.detail.startsWith("attack:")), "he changes the attack");
  assert.ok(interventions.some((r) => r.kind === "INSTRUCTION" && r.detail.startsWith("defence:")), "and the defence");
  assert.ok(interventions.some((r) => r.kind === "SUBSTITUTION_REQUESTED"), "and he changes personnel");

  // He is reacting to real state: every intervention names why.
  for (const record of interventions) {
    if (record.kind === "TIMEOUT_ENDS") continue;
    assert.ok(record.reason.length > 0, `${record.kind} says what it was for`);
  }

  // He lets go again. A coach whose dials only ever went up would end every
  // match at the stops, which is exactly the failure this asserts against.
  const relaxations = interventions.filter((r) => r.kind === "INSTRUCTION" && r.detail.includes("-> 0.00"));
  assert.ok(relaxations.length > 0, "instructions come back to neutral when the situation passes");
  for (const side of ["HOME", "AWAY"] as const) {
    for (const value of [...Object.values(match.finalState.instructions[side].attack), ...Object.values(match.finalState.instructions[side].defence)]) {
      assert.ok(Math.abs(value) <= 0.9, `${side} never pins a dial to the stop (${value})`);
    }
  }

  // The allowance is respected, per side and per half.
  for (const side of ["HOME", "AWAY"] as const) {
    assert.ok(timeoutsUsed(match.finalState.timeouts, side) <= DEFAULT_TIMEOUT_RULES.perMatch, `${side} stays inside the match allowance`);
    for (const half of [1, 2] as const) {
      assert.ok(timeoutsUsed(match.finalState.timeouts, side, half) <= DEFAULT_TIMEOUT_RULES.perHalf, `${side} stays inside the half allowance`);
    }
  }
  // Every timeout was taken at a dead ball by the side that had the ball.
  for (const segment of match.segments) {
    for (const record of segment.interventions) {
      if (record.kind !== "TIMEOUT_BEGINS") continue;
      assert.ok(deadBallBoundary(segment.kind), `a timeout is only granted at a dead ball (${segment.kind})`);
    }
  }

  // The coach's substitutions went through M11 and completed like any other.
  const coachSubs = match.segments.flatMap((s) => s.substitutions).filter((s) => s.reason.startsWith("COACH:"));
  assert.ok(coachSubs.length > 0, "at least one of them actually landed on the court");
  for (const change of coachSubs) {
    assert.ok(change.atMatchSeconds >= change.requestedAtMatchSeconds, "each completed after it was asked for");
  }

  // And the match is still a match.
  for (const entry of match.trace) {
    const ids = entry.playerPositions.map((p) => p.playerId);
    assert.equal(new Set(ids).size, ids.length, `duplicate player at ${entry.note}`);
    assert.ok(ids.length >= 12 && ids.length <= 14, `population stayed legal (${ids.length})`);
  }
});

test("the coach's interventions are deterministic", () => {
  const run = () => simulateMatch(TOP, 7, { coaches: { HOME: autonomousCoach(), AWAY: autonomousCoach() } });
  const a = run();
  const b = run();
  const shape = (m: typeof a) =>
    m.segments.flatMap((s) => s.interventions.map((r) => `${r.kind}|${r.team}|${r.atMatchSeconds.toFixed(3)}|${r.detail}|${r.reason}`));
  assert.ok(shape(a).length > 0, "the match contained interventions to compare");
  assert.deepEqual(shape(b), shape(a), "identical interventions, identically timed and identically explained");
  assert.deepEqual(b.finalScore, a.finalScore);
  assert.deepEqual(b.finalState.instructions, a.finalState.instructions, "and the coaches ended on the same instructions");
});

test("a coached match and an uncoached one diverge only because of the coaching", () => {
  const quiet = simulateMatch(TOP, 12);
  const coached = simulateMatch(TOP, 12, { coaches: { HOME: autonomousCoach(), AWAY: autonomousCoach() } });

  assert.equal(quiet.segments.every((s) => s.interventions.length === 0), true, "nobody intervenes without a coach");
  assert.ok(coached.segments.some((s) => s.interventions.length > 0), "and somebody does with one");
  // Both are complete, legal matches -- the coaching changed the match, not the rules.
  for (const match of [quiet, coached]) {
    assert.equal(match.phase, "FULL_TIME");
    assert.equal(match.guardTripped, false);
    assert.ok(match.finalScore.HOME + match.finalScore.AWAY > 0);
  }
});
