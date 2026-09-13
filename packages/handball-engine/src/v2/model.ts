/** V2 owns its state. No legacy gameplay state or command enters this boundary. */
export const ENGINE_VERSION = "2.0.0-centre-throw-off.1";
export const TICK_MS = 50;
export type Point = { x: number; y: number };
export type TeamId = "HOME" | "AWAY";
export type Direction = "TOP" | "BOTTOM";
export type RestartContext = "OPENING_HALF" | "POST_GOAL";
export type Stage = "DEAD_BALL" | "RESTART_PREPARATION" | "TAKER_READY" | "AUTHORISED" |
  "THROW_RELEASE" | "BALL_IN_FLIGHT" | "RECEIVER_ENCOUNTER" | "CONTROL_COMPLETION" | "LIVE_PLAY";
export type ActionPhase = "PREPARING" | "COMMITTED" | "EXECUTING" | "COMPLETED" | "INTERRUPTED" | "FAILED";
export type ActionKind = "REPOSITION" | "PREPARE_THROW_OFF" | "EXECUTE_THROW" | "RECEIVE";
export type Responsibility = "TAKE_RESTART" | "RECEIVE_RESTART" | "WAIT_LEGALLY";
export type IntentKind = "REACH_RESTART_POSITION" | "PREPARE_RESTART" | "DELIVER_RESTART" | "CONTROL_INCOMING_BALL" | "WAIT";
export type Intent = { id: string; kind: IntentKind; responsibility: Responsibility; targetPlayerId: string | null };
export type Action = {
  id: string; causalId: string; intentId: string; kind: ActionKind; phase: ActionPhase;
  startedTick: number; phaseTick: number; elapsedTicks: number; durationTicks: number;
  movementTarget: Point | null;
};
export type Player = {
  identity: { id: string; teamId: TeamId; kind: "FIELD_PLAYER" | "GOALKEEPER" };
  assignment: { role: string; responsibility: Responsibility };
  position: Point; velocity: Point; bodyRadius: number;
  intent: Intent; action: Action | null;
};
export type Flight = {
  actionId: string; causalId: string; passerId: string; receiverId: string;
  origin: Point; target: Point; velocity: Point; releasedTick: number;
};
export type RuleProfile = {
  id: "IHF_INDOOR_2025_AREA"; effectiveFrom: "2025-07-01";
  throwOff: { variant: "AREA"; centre: Point; radius: number; releaseWithinMs: number; ballRadius: number };
};
export type EventType = "RESTART_PREPARATION" | "TAKER_READY" | "RESTART_AUTHORISED" |
  "ACTION_CHANGED" | "THROW_RELEASED" | "RECEIVER_ENCOUNTER" | "PASS_RECEIVED" |
  "RESTART_COMPLETED" | "LIVE_PLAY_STARTED" | "SCENARIO_FAILED" | "SCENARIO_INCOMPLETE";
export type CanonicalEvent = {
  id: string; sequence: number; tick: number; timeMs: number; officialTimeMs: number;
  type: EventType; causalId: string; actionId: string | null; playerId: string | null;
  details: Record<string, string | number>;
};
export type ScenarioState = {
  engineVersion: typeof ENGINE_VERSION; scenarioId: "CENTRE_THROW_OFF_BASELINE";
  seed: number; rng: { algorithm: "mulberry32"; state: number; draws: number };
  tick: number; timeMs: number; officialClock: { timeMs: number; running: boolean };
  direction: Direction; ruleProfile: RuleProfile;
  stage: Stage; stageTick: number; status: "RUNNING" | "SUCCESS" | "FAILED" | "INCOMPLETE";
  failure: string | null;
  restart: {
    id: string; type: "CENTRE_THROW_OFF"; owner: TeamId; context: RestartContext;
    phase: "DEAD" | "PREPARING" | "READY" | "AUTHORISED" | "EXECUTING" | "COMPLETED" | "FAILED";
    takerId: string; receiverId: string; authorisedTick: number | null; completedTick: number | null;
  };
  ball: {
    status: "DEAD" | "CONTROLLED" | "RELEASED" | "IN_FLIGHT" | "CONTROLLED_BY_RECEIVER";
    inPlay: boolean; position: Point; controllerId: string | null;
    intendedReceiverId: string | null; flight: Flight | null;
  };
  players: Player[];
  /** Controlled scenario tasks, not autonomous tactical choices. All persist in saves. */
  programme: {
    targets: Record<string, Point>; autoAuthorise: boolean; autoExecute: boolean;
    observationTicks: number; prepareTicks: number; throwTicks: number; passSpeed: number;
    maxTicks: number; maxFlightTicks: number;
  };
  nextId: number; events: CanonicalEvent[];
};
export type TickInput = { authorise?: boolean; execute?: boolean; interruptPlayerId?: string };

export function playerById(state: ScenarioState, id: string): Player {
  const player = state.players.find((p) => p.identity.id === id);
  if (!player) throw new Error(`Unknown V2 player: ${id}`);
  return player;
}

export { nextRandom } from './primitives';
