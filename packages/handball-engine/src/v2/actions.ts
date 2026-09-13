import { distanceBetween } from "../domain/geometry/coordinates";
import { TICK_MS, type ActionKind, type ActionPhase, type CanonicalEvent, type IntentKind, type Player, type Point, type ScenarioState } from "./model";
import { actionEligible } from "./rules";

export function emit(state: ScenarioState, type: CanonicalEvent["type"], player: Player | null = null, details: CanonicalEvent["details"] = {}, actionId = player?.action?.id ?? null): void {
  const sequence = state.events.length;
  state.events.push({ id: `${state.restart.id}-event-${sequence}`, sequence, tick: state.tick, timeMs: state.timeMs, officialTimeMs: state.officialClock.timeMs, type, causalId: state.restart.id, actionId, playerId: player?.identity.id ?? null, details });
}

export function actionPhase(state: ScenarioState, player: Player, phase: ActionPhase): void {
  if (!player.action) throw new Error("No action to transition");
  player.action.phase = phase;
  player.action.phaseTick = state.tick;
  emit(state, "ACTION_CHANGED", player, { kind: player.action.kind, phase });
}

export function beginAction(state: ScenarioState, player: Player, kind: ActionKind, intentKind: IntentKind, durationTicks: number, movementTarget: Point | null = null): void {
  if (!actionEligible(state, player, kind)) throw new Error(`Ineligible ${kind} for ${player.identity.id}`);
  const id = `${state.restart.id}-action-${state.nextId++}`;
  player.intent = { id: `${id}-intent`, kind: intentKind, responsibility: player.assignment.responsibility, targetPlayerId: kind === "EXECUTE_THROW" ? state.restart.receiverId : null };
  player.action = { id, causalId: state.restart.id, intentId: player.intent.id, kind, phase: "PREPARING", startedTick: state.tick, phaseTick: state.tick, elapsedTicks: 0, durationTicks, movementTarget: movementTarget && { ...movementTarget } };
  emit(state, "ACTION_CHANGED", player, { kind, phase: "PREPARING" });
}

/** Straight restart repositioning, acceleration/braking bounded; never integrates legacy intents. */
function move(player: Player, target: Point): boolean {
  const distance = distanceBetween(player.position, target);
  const dt = TICK_MS / 1000;
  const current = Math.hypot(player.velocity.x, player.velocity.y);
  const speed = Math.min(2, current + 3 * dt, Math.sqrt(2 * 3 * distance));
  const travel = Math.min(distance, speed * dt);
  if (distance > 0) {
    const dx = (target.x - player.position.x) / distance;
    const dy = (target.y - player.position.y) / distance;
    player.position = { x: player.position.x + dx * travel, y: player.position.y + dy * travel };
    player.velocity = { x: dx * speed, y: dy * speed };
  }
  if (distance - travel <= 1e-8) {
    player.position = { ...target };
    player.velocity = { x: 0, y: 0 };
    return true;
  }
  return false;
}

/** Returns a finished throw for the interaction resolver; receiving completes only on contact. */
export function executeActions(state: ScenarioState): Player | null {
  let releasedBy: Player | null = null;
  for (const player of state.players) {
    const action = player.action;
    if (!action || action.phaseTick === state.tick) continue;
    if (action.phase === "PREPARING") { actionPhase(state, player, "COMMITTED"); continue; }
    if (action.phase === "COMMITTED") { actionPhase(state, player, "EXECUTING"); continue; }
    if (action.phase !== "EXECUTING") continue;
    action.elapsedTicks += 1;
    if (action.kind === "RECEIVE") continue;
    const done = action.kind === "REPOSITION"
      ? action.movementTarget !== null && move(player, action.movementTarget)
      : action.elapsedTicks >= action.durationTicks;
    if (done) {
      if (action.kind === "EXECUTE_THROW") releasedBy = player;
      else actionPhase(state, player, "COMPLETED");
    }
  }
  return releasedBy;
}
