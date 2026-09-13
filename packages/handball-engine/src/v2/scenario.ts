import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import { ENGINE_VERSION, nextRandom, type Direction, type Player, type RestartContext, type ScenarioState } from "./model";
import { IHF_2025 } from "./rules";

export type ScenarioOptions = { seed?: number; direction?: Direction; context?: RestartContext; autoAuthorise?: boolean; autoExecute?: boolean; maxTicks?: number };

export function createCentreThrowOff(options: ScenarioOptions = {}): ScenarioState {
  const seed = options.seed ?? 12;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Seed must be an unsigned 32-bit integer");
  const direction = options.direction ?? "TOP";
  const context = options.context ?? "OPENING_HALF";
  if (!["TOP", "BOTTOM"].includes(direction) || !["OPENING_HALF", "POST_GOAL"].includes(context)) throw new Error("Invalid scenario context");
  const at = (x: number, y: number) => ({ x, y: direction === "TOP" ? y : mirrorYForOppositeGoalSide(y) });
  const targets: ScenarioState["programme"]["targets"] = {};
  const players: Player[] = [];
  const roles = ["V6", "V9", "M9", "H9", "H6", "M6", "GK"];
  for (const teamId of ["HOME", "AWAY"] as const) {
    roles.forEach((role, index) => {
      const id = `${teamId}-${role}`;
      const taker = id === "HOME-M9";
      const receiver = id === "HOME-H9";
      const responsibility = taker ? "TAKE_RESTART" : receiver ? "RECEIVE_RESTART" : "WAIT_LEGALLY";
      const x = [2, 5, 9, 13, 18, 15, 10][index];
      const y = role === "GK" ? 38 : 25 + index * 0.3;
      const position = at(x, teamId === "HOME" ? y : 40 - y);
      // Post-goal defender deliberately remains in the opponent's half, outside the area.
      if (context === "POST_GOAL" && id === "AWAY-H6") Object.assign(position, at(17, 24));
      targets[id] = taker ? at(9.2, 20.2) : receiver ? at(10.8, 20.4) : { ...position };
      players.push({ identity: { id, teamId, kind: role === "GK" ? "GOALKEEPER" : "FIELD_PLAYER" }, assignment: { role, responsibility }, position, velocity: { x: 0, y: 0 }, bodyRadius: 0.28,
        intent: { id: `initial-${id}`, kind: "WAIT", responsibility, targetPlayerId: null }, action: null });
    });
  }
  const rng: ScenarioState["rng"] = { algorithm: "mulberry32", state: seed, draws: 0 };
  const prepareTicks = 6 + Math.floor(nextRandom(rng) * 5);
  const maxTicks = options.maxTicks ?? 600;
  if (!Number.isInteger(maxTicks) || maxTicks < 1 || maxTicks > 10000) throw new Error("Invalid tick budget");
  return {
    engineVersion: ENGINE_VERSION, scenarioId: "CENTRE_THROW_OFF_BASELINE", seed, rng,
    tick: 0, timeMs: 0, officialClock: { timeMs: context === "OPENING_HALF" ? 0 : 300000, running: context === "POST_GOAL" },
    direction, ruleProfile: JSON.parse(JSON.stringify(IHF_2025)), stage: "DEAD_BALL", stageTick: 0, status: "RUNNING", failure: null,
    restart: { id: `restart-${seed}-1`, type: "CENTRE_THROW_OFF", owner: "HOME", context, phase: "DEAD", takerId: "HOME-M9", receiverId: "HOME-H9", authorisedTick: null, completedTick: null },
    ball: { status: "DEAD", inPlay: false, position: { ...players.find((p) => p.identity.id === "HOME-M9")!.position }, controllerId: "HOME-M9", intendedReceiverId: "HOME-H9", flight: null },
    players, programme: { targets, autoAuthorise: options.autoAuthorise ?? true, autoExecute: options.autoExecute ?? true, observationTicks: 6, prepareTicks, throwTicks: 5, passSpeed: 6, maxTicks, maxFlightTicks: 40 }, nextId: 1, events: [],
  };
}
