import { distanceBetween } from "../domain/geometry/coordinates";
import { actionPhase, beginAction, emit, executeActions } from "./actions";
import { playerById, TICK_MS, type Player, type Point, type ScenarioState, type Stage, type TickInput } from "./model";
import { completionEvidence, preparationIssues, whollyInsideArea } from "./rules";

export function situationOf(state: ScenarioState) {
  return { stage: state.stage, preparationIssues: preparationIssues(state), taker: playerById(state, state.restart.takerId), receiver: playerById(state, state.restart.receiverId) };
}

function stage(state: ScenarioState, next: Stage): void { state.stage = next; state.stageTick = state.tick; }

function fail(state: ScenarioState, reason: string, interruptedId?: string): void {
  state.status = "FAILED";
  state.failure = reason;
  state.restart.phase = "FAILED";
  state.ball.inPlay = false;
  for (const player of state.players) {
    if (player.action && !["COMPLETED", "FAILED", "INTERRUPTED"].includes(player.action.phase)) actionPhase(state, player, player.identity.id === interruptedId ? "INTERRUPTED" : "FAILED");
    player.velocity = { x: 0, y: 0 };
  }
  emit(state, "SCENARIO_FAILED", null, { reason });
}

function authorise(state: ScenarioState): void {
  const situation = situationOf(state);
  if (state.stage !== "TAKER_READY") return;
  if (situation.preparationIssues.length) { fail(state, situation.preparationIssues.join("; ")); return; }
  state.restart.phase = "AUTHORISED";
  state.restart.authorisedTick = state.tick;
  state.officialClock.running = true;
  stage(state, "AUTHORISED");
  emit(state, "RESTART_AUTHORISED", situation.taker);
}

function release(state: ScenarioState, taker: Player): void {
  const receiver = playerById(state, state.restart.receiverId);
  const issues = preparationIssues(state);
  if (issues.length) { fail(state, issues.join("; ")); return; }
  // Milestone scope restriction, NOT an IHF prohibition on passing outside the area.
  // Baseline uses the teammate-touch completion branch, so reception precedes live play.
  if (!whollyInsideArea(state, receiver.position, receiver.bodyRadius)) { fail(state, "Baseline receiver must be inside the area; outside-area throws are outside this scenario"); return; }
  const origin = { ...state.ball.position };
  const target = { ...receiver.position };
  const distance = distanceBetween(origin, target);
  if (distance <= taker.bodyRadius + receiver.bodyRadius) { fail(state, "Throw participants overlap"); return; }
  const velocity = { x: (target.x - origin.x) / distance * state.programme.passSpeed, y: (target.y - origin.y) / distance * state.programme.passSpeed };
  state.ball = { status: "RELEASED", inPlay: false, position: origin, controllerId: null, intendedReceiverId: receiver.identity.id,
    flight: { actionId: taker.action!.id, causalId: state.restart.id, passerId: taker.identity.id, receiverId: receiver.identity.id, origin, target, velocity, releasedTick: state.tick } };
  state.restart.phase = "EXECUTING";
  actionPhase(state, taker, "COMPLETED");
  stage(state, "THROW_RELEASE");
  emit(state, "THROW_RELEASED", taker, { receiverId: receiver.identity.id, x: origin.x, y: origin.y });
}

function nextBallPosition(state: ScenarioState): Point {
  const velocity = state.ball.flight!.velocity;
  return { x: state.ball.position.x + velocity.x * TICK_MS / 1000, y: state.ball.position.y + velocity.y * TICK_MS / 1000 };
}

/** Swept ball/receiving-hand envelope: catches cannot tunnel or teleport to the receiver. */
export function encounterPoint(from: Point, to: Point, receiver: Player, radius: number): Point | null {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return distanceBetween(from, receiver.position) <= radius ? { ...from } : null;
  const t = Math.max(0, Math.min(1, ((receiver.position.x - from.x) * dx + (receiver.position.y - from.y) * dy) / length2));
  const point = { x: from.x + t * dx, y: from.y + t * dy };
  return distanceBetween(point, receiver.position) <= radius ? point : null;
}

function receive(state: ScenarioState, receiver: Player, position: Point): void {
  const evidence = completionEvidence(state, receiver.identity.id);
  if (evidence !== "TEAMMATE_TOUCH") { fail(state, "Missing released-ball completion evidence"); return; }
  const throwActionId = state.ball.flight!.actionId;
  state.ball = { ...state.ball, status: "CONTROLLED_BY_RECEIVER", position, controllerId: receiver.identity.id, flight: null, inPlay: true };
  actionPhase(state, receiver, "COMPLETED");
  state.restart.phase = "COMPLETED";
  state.restart.completedTick = state.tick;
  stage(state, "RECEIVER_ENCOUNTER");
  // Both events describe the same atomic, completed state transition.
  emit(state, "RECEIVER_ENCOUNTER", receiver, { kind: "PHYSICAL_CONTACT_AND_CONTROL", throwActionId, x: position.x, y: position.y });
  emit(state, "PASS_RECEIVED", receiver, { throwActionId, x: position.x, y: position.y });
  emit(state, "RESTART_COMPLETED", receiver, { evidence, throwActionId });
}

function advanceFlight(state: ScenarioState): void {
  const flight = state.ball.flight!;
  const receiver = playerById(state, flight.receiverId);
  const next = nextBallPosition(state);
  const compatible = receiver.action?.kind === "RECEIVE" && receiver.action.phase === "EXECUTING" && receiver.identity.teamId === state.restart.owner;
  const encounter = compatible ? encounterPoint(state.ball.position, next, receiver, 0.12) : null;
  if (encounter) { receive(state, receiver, encounter); return; }
  state.ball.position = next;
  state.ball.status = "IN_FLIGHT";
  if (state.stage === "THROW_RELEASE") stage(state, "BALL_IN_FLIGHT");
  // The constrained baseline never exits the area normally. Do not invent a catch
  // for a moved/missing receiver or freeze a flight at its originally intended target.
  if (completionEvidence(state, null) === "AREA_EXIT") fail(state, "Ball left baseline area without receiver control (outside scenario scope)");
  else if (state.tick - flight.releasedTick >= state.programme.maxFlightTicks) fail(state, "No compatible receiver encounter before flight budget");
}

/** One atomic V2 tick. Commands are authorisations, not movement targets or outcomes. */
export function stepV2(previous: ScenarioState, input: TickInput = {}): ScenarioState {
  if (Object.keys(input).some((key) => !["authorise", "execute", "interruptPlayerId"].includes(key))) throw new Error("Unsupported V2 input; ordinary play is not implemented");
  if (previous.status !== "RUNNING") return previous;
  const state: ScenarioState = JSON.parse(JSON.stringify(previous));
  state.tick += 1;
  state.timeMs = state.tick * TICK_MS;
  if (state.officialClock.running) state.officialClock.timeMs += TICK_MS;
  if (state.tick > state.programme.maxTicks) {
    state.status = "INCOMPLETE";
    state.failure = "Scenario tick budget exhausted without completion";
    emit(state, "SCENARIO_INCOMPLETE", null, { reason: state.failure });
    return state;
  }
  if (input.interruptPlayerId) {
    playerById(state, input.interruptPlayerId);
    fail(state, "Action interrupted by scenario control", input.interruptPlayerId);
    return state;
  }
  if (state.stage === "CONTROL_COMPLETION") {
    stage(state, "LIVE_PLAY"); state.status = "SUCCESS"; emit(state, "LIVE_PLAY_STARTED"); return state;
  }
  if (state.stage === "RECEIVER_ENCOUNTER" && state.restart.phase === "COMPLETED") {
    // Completed control remains inspectable before the scenario stops at live play.
    stage(state, "CONTROL_COMPLETION"); return state;
  }
  if (state.stage === "DEAD_BALL") {
    state.restart.phase = "PREPARING";
    stage(state, "RESTART_PREPARATION");
    emit(state, "RESTART_PREPARATION");
    for (const player of state.players) beginAction(state, player, "REPOSITION", "REACH_RESTART_POSITION", 0, state.programme.targets[player.identity.id]);
    return state;
  }
  const taker = playerById(state, state.restart.takerId);
  const receiver = playerById(state, state.restart.receiverId);
  if (state.restart.phase === "AUTHORISED") {
    if (preparationIssues(state).length) { fail(state, "Restart preparation became invalid before release"); return state; }
    if ((state.tick - state.restart.authorisedTick!) * TICK_MS > state.ruleProfile.throwOff.releaseWithinMs) { fail(state, "Three-second throw execution deadline expired"); return state; }
  }
  if (input.authorise) authorise(state);
  if (state.status !== "RUNNING") return state;
  if (input.execute && state.restart.phase === "AUTHORISED" && taker.action?.kind !== "EXECUTE_THROW") {
    beginAction(state, taker, "EXECUTE_THROW", "DELIVER_RESTART", state.programme.throwTicks);
    beginAction(state, receiver, "RECEIVE", "CONTROL_INCOMING_BALL", 0);
  }
  const wasFlying = state.ball.flight !== null;
  const releasedBy = executeActions(state);
  if (state.ball.controllerId === taker.identity.id) state.ball.position = { ...taker.position };
  if (releasedBy) release(state, releasedBy);
  else if (wasFlying) advanceFlight(state);
  else if (state.restart.phase === "PREPARING") {
    if (taker.action?.kind === "REPOSITION" && state.players.every((p) => p.action?.phase === "COMPLETED")) {
      state.ball.status = "CONTROLLED";
      beginAction(state, taker, "PREPARE_THROW_OFF", "PREPARE_RESTART", state.programme.prepareTicks);
    } else if (taker.action?.kind === "PREPARE_THROW_OFF" && taker.action.phase === "COMPLETED" && preparationIssues(state).length === 0) {
      state.restart.phase = "READY"; stage(state, "TAKER_READY"); emit(state, "TAKER_READY", taker);
    }
  }
  return state;
}

/** Controlled scenario director supplies explicit authorisation/execution to the real executor. */
export function scenarioTick(state: ScenarioState): ScenarioState {
  const observed = state.tick - state.stageTick >= state.programme.observationTicks;
  return stepV2(state, {
    authorise: state.programme.autoAuthorise && state.stage === "TAKER_READY" && observed,
    execute: state.programme.autoExecute && state.stage === "AUTHORISED" && observed,
  });
}
