import { exactSnapshot, fingerprint } from './primitives';
export { exactSnapshot, fingerprint } from './primitives';
import { scenarioTick } from "./executor";
import { ENGINE_VERSION, TICK_MS, type ScenarioState } from "./model";
import { IHF_2025 } from "./rules";

export function stateHash(state: ScenarioState): string { return fingerprint(state); }
export function eventHash(state: ScenarioState): string { return fingerprint(state.events); }


function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Invalid V2 save: ${message}`); }
function integer(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
function point(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const p = value as { x: unknown; y: unknown };
  return typeof p.x === "number" && Number.isFinite(p.x) && typeof p.y === "number" && Number.isFinite(p.y);
}

/** Saves are versioned engine state, not arbitrary state edits or a legacy match import. */
export function assertScenarioState(state: ScenarioState): void {
  check(state && state.engineVersion === ENGINE_VERSION && state.scenarioId === "CENTRE_THROW_OFF_BASELINE", "engine/scenario version");
  check(fingerprint(state.ruleProfile) === fingerprint(IHF_2025), "unsupported rule profile");
  check(integer(state.seed) && state.seed <= 0xffffffff, "seed");
  check(state.rng?.algorithm === "mulberry32" && integer(state.rng.state) && state.rng.state <= 0xffffffff && integer(state.rng.draws), "RNG");
  check(integer(state.tick) && state.timeMs === state.tick * TICK_MS && integer(state.stageTick) && state.stageTick <= state.tick, "tick/time");
  check(["TOP", "BOTTOM"].includes(state.direction), "direction");
  check(["DEAD_BALL", "RESTART_PREPARATION", "TAKER_READY", "AUTHORISED", "THROW_RELEASE", "BALL_IN_FLIGHT", "RECEIVER_ENCOUNTER", "CONTROL_COMPLETION", "LIVE_PLAY"].includes(state.stage), "stage");
  check(["RUNNING", "SUCCESS", "FAILED", "INCOMPLETE"].includes(state.status), "status");
  check(state.failure === null || typeof state.failure === "string", "failure");
  check(integer(state.officialClock?.timeMs) && typeof state.officialClock.running === "boolean", "official clock");
  check(state.restart && state.restart.type === "CENTRE_THROW_OFF" && state.restart.owner === "HOME" && typeof state.restart.id === "string", "restart");
  check(["OPENING_HALF", "POST_GOAL"].includes(state.restart.context) && ["DEAD", "PREPARING", "READY", "AUTHORISED", "EXECUTING", "COMPLETED", "FAILED"].includes(state.restart.phase), "restart phase/context");
  for (const tick of [state.restart.authorisedTick, state.restart.completedTick]) check(tick === null || integer(tick) && tick <= state.tick, "restart timestamp");
  check(integer(state.nextId) && state.nextId > 0 && Array.isArray(state.players) && state.players.length === 14, "identities");
  const ids = new Set<string>();
  for (const player of state.players) {
    check(player.identity && typeof player.identity.id === "string" && ["HOME", "AWAY"].includes(player.identity.teamId) && ["FIELD_PLAYER", "GOALKEEPER"].includes(player.identity.kind), "player identity");
    check(!ids.has(player.identity.id), "duplicate player"); ids.add(player.identity.id);
    check(point(player.position) && player.position.x >= 0 && player.position.x <= 20 && player.position.y >= 0 && player.position.y <= 40 && point(player.velocity), "player geometry");
    check(player.bodyRadius === 0.28 && typeof player.assignment?.role === "string" && ["TAKE_RESTART", "RECEIVE_RESTART", "WAIT_LEGALLY"].includes(player.assignment.responsibility), "assignment");
    check(typeof player.intent?.id === "string" && ["REACH_RESTART_POSITION", "PREPARE_RESTART", "DELIVER_RESTART", "CONTROL_INCOMING_BALL", "WAIT"].includes(player.intent.kind) && player.intent.responsibility === player.assignment.responsibility, "intent");
    const action = player.action;
    if (action !== null) {
      check(action && typeof action.id === "string" && action.causalId === state.restart.id && action.intentId === player.intent.id, "action identity");
      check(["REPOSITION", "PREPARE_THROW_OFF", "EXECUTE_THROW", "RECEIVE"].includes(action.kind) && ["PREPARING", "COMMITTED", "EXECUTING", "COMPLETED", "INTERRUPTED", "FAILED"].includes(action.phase), "action lifecycle");
      check([action.startedTick, action.phaseTick, action.elapsedTicks, action.durationTicks].every(integer) && action.phaseTick <= state.tick && action.startedTick <= action.phaseTick, "action time");
      check(action.movementTarget === null || point(action.movementTarget), "action target");
    }
  }
  check(ids.has(state.restart.takerId) && ids.has(state.restart.receiverId) && state.restart.takerId !== state.restart.receiverId, "participants");
  check(state.ball && point(state.ball.position) && ["DEAD", "CONTROLLED", "RELEASED", "IN_FLIGHT", "CONTROLLED_BY_RECEIVER"].includes(state.ball.status), "ball");
  check(state.ball.controllerId === null || ids.has(state.ball.controllerId), "ball controller");
  check(state.ball.intendedReceiverId === state.restart.receiverId && typeof state.ball.inPlay === "boolean", "ball permissions");
  if (state.ball.flight !== null) {
    const flight = state.ball.flight;
    check(flight && point(flight.origin) && point(flight.target) && point(flight.velocity) && integer(flight.releasedTick) && flight.releasedTick <= state.tick, "flight");
    check(flight.causalId === state.restart.id && typeof flight.actionId === "string" && ids.has(flight.passerId) && flight.receiverId === state.restart.receiverId && state.ball.controllerId === null, "flight ownership");
  }
  check(state.ball.inPlay === (state.restart.phase === "COMPLETED"), "live permission");
  if (state.restart.phase === "COMPLETED") check(state.ball.controllerId === state.restart.receiverId && state.ball.status === "CONTROLLED_BY_RECEIVER" && state.ball.flight === null && state.restart.completedTick !== null, "completion evidence");
  if (state.status === "SUCCESS") check(state.stage === "LIVE_PLAY" && state.restart.phase === "COMPLETED", "success");
  const plan = state.programme;
  check(plan && typeof plan.autoAuthorise === "boolean" && typeof plan.autoExecute === "boolean", "programme");
  check([plan.observationTicks, plan.prepareTicks, plan.throwTicks, plan.maxTicks, plan.maxFlightTicks].every(integer) && plan.maxTicks >= 1 && plan.maxTicks <= 10000 && plan.maxFlightTicks > 0 && plan.passSpeed > 0 && plan.passSpeed <= 12, "programme timing");
  check(plan.targets && [...ids].every((id) => point(plan.targets[id])), "controlled targets");
  check(Array.isArray(state.events) && state.events.length < 10000, "events");
  state.events.forEach((event, index) => {
    check(event.sequence === index && event.id === `${state.restart.id}-event-${index}` && integer(event.tick) && event.tick <= state.tick && event.timeMs === event.tick * TICK_MS && integer(event.officialTimeMs), "event chronology");
    check(event.causalId === state.restart.id && (event.actionId === null || typeof event.actionId === "string") && (event.playerId === null || ids.has(event.playerId)), "event causality");
    check(index === 0 || event.tick >= state.events[index - 1].tick, "event ordering");
  });
}

export function saveScenario(state: ScenarioState): string {
  assertScenarioState(state);
  return JSON.stringify({ format: "HANDBALL_V2_SCENARIO_SAVE_1", stateHash: stateHash(state), eventHash: eventHash(state), state }, null, 2);
}
export function loadScenario(json: string): ScenarioState {
  check(json.length <= 2000000, "file too large");
  const value = JSON.parse(json);
  check(value?.format === "HANDBALL_V2_SCENARIO_SAVE_1", "save format");
  assertScenarioState(value.state);
  check(value.stateHash === stateHash(value.state) && value.eventHash === eventHash(value.state), "fingerprint mismatch");
  return exactSnapshot(value.state);
}

export type Replay = { snapshots: readonly ScenarioState[]; cursor: number; remainderMs: number };
export function createReplay(state: ScenarioState): Replay { return { snapshots: [exactSnapshot(state)], cursor: 0, remainderMs: 0 }; }
export function currentSnapshot(replay: Replay): ScenarioState { return replay.snapshots[replay.cursor]; }
export function stepReplay(replay: Replay): Replay {
  if (replay.cursor + 1 < replay.snapshots.length) return { ...replay, cursor: replay.cursor + 1 };
  const previous = currentSnapshot(replay);
  if (previous.status !== "RUNNING") return replay;
  const next = exactSnapshot(scenarioTick(previous));
  return { ...replay, snapshots: [...replay.snapshots, next], cursor: replay.cursor + 1 };
}
export function seekReplay(replay: Replay, cursor: number): Replay {
  if (!Number.isInteger(cursor) || cursor < 0 || cursor >= replay.snapshots.length) throw new Error("Unknown historical snapshot");
  return { ...replay, cursor, remainderMs: 0 };
}
/** Wall time/speed select ticks only. Neither enters the engine. */
export function advancePlayback(replay: Replay, elapsedMs: number, speed: number): Replay {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || ![0.25, 0.5, 1, 2, 4].includes(speed)) throw new Error("Invalid playback clock");
  let next = { ...replay, remainderMs: replay.remainderMs + Math.min(elapsedMs, 1000) * speed };
  while (next.remainderMs >= TICK_MS) {
    next = stepReplay(next);
    next = { ...next, remainderMs: next.remainderMs - TICK_MS };
    if (currentSnapshot(next).status !== "RUNNING" && next.cursor === next.snapshots.length - 1) { next.remainderMs = 0; break; }
  }
  return next;
}
