/**
 * MATCH-EXPERIENCE-2.0 M16: controlled spatial situations, without hunting for
 * a lucky seed.
 *
 * Up to now, testing a specific handball situation meant scanning thousands of
 * seeds until one happened to produce it, then pinning that seed as a witness.
 * That works, but it is fragile -- every behavioural milestone from M6 onward
 * has had to re-pin its witnesses, because a real change to the attack changes
 * every trajectory. This module lets a test SAY what situation it wants.
 *
 * WHAT IT IS. A way of placing the canonical 6v6 exactly where you want it. It
 * starts from `createFullCourt6v6State` -- the same court, the same formation
 * data, the same roles, the same movement profiles the engine plays with -- and
 * then moves, removes or re-arms the players the scenario names. Every
 * coordinate you do not specify stays canonical.
 *
 * WHAT IT IS NOT. It is not a second simulation and it holds no opinion about
 * what should happen next. A scenario is INPUT: a world state. It contains no
 * expected action, no expected outcome and no assertion. A test builds a
 * situation with it, calls the REAL decision code, and judges the answer
 * separately. Anything else would be a fixture marking its own homework.
 */
import { createFullCourt6v6State } from "./fullCourt6v6";
import { attackRoleLabel, type AttackRoleLabel } from "../simulation/organizedAttack";
import { SIX_ZERO_ROLE_ORDER } from "../policies/defense/responsibility";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { DefenseRole, Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";
import type { AttackingGoalSide, FullCourtMatchState, PossessionPhase } from "../domain/match/possession";

/** How a scenario names a player: by his handball role, or by his id. */
export type PlayerRef = AttackRoleLabel | DefenseRole | "GK_ATTACK" | "GK_DEFENCE" | (string & {});

export type MatchScenarioSpec = {
  /** Which goal the attacking side drives at. Defaults to the canonical TOP. */
  readonly attackingGoalSide?: AttackingGoalSide;
  /** Who has the ball. Defaults to whoever the canonical state gave it to. */
  readonly ballCarrier?: PlayerRef;
  /** Where named attackers stand. Anybody omitted keeps his canonical spot. */
  readonly attackers?: Partial<Record<AttackRoleLabel, MeterPoint>>;
  /** Where named defenders stand, by 6:0 court role. */
  readonly defenders?: Partial<Record<DefenseRole, MeterPoint>>;
  /** Where the goalkeepers stand. */
  readonly goalkeepers?: { readonly attacking?: MeterPoint; readonly defending?: MeterPoint };
  /**
   * Where the ball is. Defaults to the carrier's own position, which is what a
   * possessed ball means -- specify it only for a loose or in-flight ball.
   */
  readonly ball?: MeterPoint;
  readonly ballStatus?: HandballState["ball"]["status"];
  /**
   * Players to take off the court entirely, for numerical situations: a
   * transition two-on-one, a side serving a suspension, an empty net.
   */
  readonly without?: readonly PlayerRef[];
  /** The possession phase the situation is in. Defaults to ORGANIZED_SETUP. */
  readonly phase?: PossessionPhase;
  /** The spatial clock this situation starts at. Defaults to 0. */
  readonly simulationTime?: number;
};

function isDefenseRole(ref: string): ref is DefenseRole {
  return (SIX_ZERO_ROLE_ORDER as readonly string[]).includes(ref);
}

/**
 * Which player a reference names, in a given state.
 *
 * Resolution order is deliberately unambiguous: an exact id first, then an
 * attacking role label, then a 6:0 defensive role, then the two goalkeepers.
 */
export function scenarioPlayer(state: HandballState, ref: PlayerRef): Player | undefined {
  const byId = state.players.find((p) => p.id === ref);
  if (byId) return byId;
  if (ref === "GK_ATTACK") return state.players.find((p) => p.kind === "GOALKEEPER" && p.team === "ATTACK");
  if (ref === "GK_DEFENCE") return state.players.find((p) => p.kind === "GOALKEEPER" && p.team === "DEFENSE");
  if (isDefenseRole(ref)) return state.players.find((p) => p.team === "DEFENSE" && p.role === ref);
  return state.players.find((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER" && attackRoleLabel(p.role) === ref);
}

/** The same, but it throws rather than returning undefined -- a scenario that names a missing player is a broken scenario. */
export function requireScenarioPlayer(state: HandballState, ref: PlayerRef): Player {
  const player = scenarioPlayer(state, ref);
  if (!player) throw new Error(`Scenario references a player who is not on the court: ${ref}`);
  return player;
}

function moved(player: Player, position: MeterPoint): Player {
  return { ...player, position: { ...position }, velocity: { x: 0, y: 0 }, intent: { type: "IDLE" } };
}

/**
 * A controlled spatial situation, built on the canonical court.
 *
 * Pure and deterministic: the same spec always produces the same state, and it
 * reads no clock and draws no random number. What it returns is an ordinary
 * `FullCourtMatchState` -- the exact type every engine entry point already
 * takes -- so a scenario can be handed straight to `decideAttackAction`,
 * `evaluateSixZeroDefense`, `simulatePossession`, `simulateTransition` or
 * `resolveShot` with nothing in between.
 */
export function scenario(spec: MatchScenarioSpec = {}): FullCourtMatchState {
  const canonical = createFullCourt6v6State({ attackingGoalSide: spec.attackingGoalSide ?? "TOP" });
  let players = canonical.handball.players;

  // Move whoever the scenario placed. Everybody else keeps his canonical spot.
  const relocate = (ref: PlayerRef, position: MeterPoint) => {
    const target = requireScenarioPlayer({ ...canonical.handball, players }, ref);
    players = players.map((p) => (p.id === target.id ? moved(p, position) : p));
  };
  for (const [label, position] of Object.entries(spec.attackers ?? {})) {
    if (position) relocate(label as AttackRoleLabel, position);
  }
  for (const [role, position] of Object.entries(spec.defenders ?? {})) {
    if (position) relocate(role as DefenseRole, position);
  }
  if (spec.goalkeepers?.attacking) relocate("GK_ATTACK", spec.goalkeepers.attacking);
  if (spec.goalkeepers?.defending) relocate("GK_DEFENCE", spec.goalkeepers.defending);

  // Take anybody the scenario wants off the court. Done after the moves, so a
  // spec can place a player and then remove a different one without ordering
  // surprises.
  const removedIds = new Set<string>();
  for (const ref of spec.without ?? []) {
    const target = scenarioPlayer({ ...canonical.handball, players }, ref);
    if (target) removedIds.add(target.id);
  }
  if (removedIds.size > 0) players = players.filter((p) => !removedIds.has(p.id));

  // Who has it, and where it is. A possessed ball sits on its carrier unless
  // the scenario says otherwise, because that is what possession means.
  const carrier = spec.ballCarrier ? scenarioPlayer({ ...canonical.handball, players }, spec.ballCarrier) : undefined;
  if (spec.ballCarrier && !carrier) throw new Error(`Scenario gives the ball to a player who is not on the court: ${spec.ballCarrier}`);
  const possessorId = carrier ? carrier.id : (canonical.handball.ball.possessorId ?? null);
  const holder = possessorId ? players.find((p) => p.id === possessorId) : undefined;
  const status = spec.ballStatus ?? (holder ? "POSSESSED" : "LOOSE");
  const position = spec.ball ?? (holder ? holder.position : canonical.handball.ball.position);

  return {
    handball: {
      ...canonical.handball,
      simulationTime: spec.simulationTime ?? canonical.handball.simulationTime,
      players,
      ball: {
        position: { ...position },
        possessorId: status === "POSSESSED" ? (holder?.id ?? null) : null,
        status,
        flight: null,
      },
    },
    possession: { ...canonical.possession, phase: spec.phase ?? canonical.possession.phase },
  };
}

// ---------------------------------------------------------------------------
// A small set of reusable situations
// ---------------------------------------------------------------------------

/**
 * The four scenarios below are the representative set, one per engine domain.
 * They are ordinary specs, exported so a test can use one directly or spread it
 * and change a single field. None of them asserts anything.
 */

/**
 * ORGANIZED ATTACK. The centre back has the ball at nine metres against a set
 * 6:0, with the pivot free on the line and a clear lane to him.
 *
 * The canonical shape marks the pivot (his nearest defender is 0.75m away), so
 * a scenario that wants him AVAILABLE has to say so -- which is exactly the
 * kind of thing this layer exists for.
 */
export const PIVOT_AVAILABLE: MatchScenarioSpec = Object.freeze({
  ballCarrier: "M9",
  attackers: { M6: { x: 7.2, y: 6.6 } },
});

/**
 * The same attack with the pivot MARKED. It differs from the one above by a
 * single defender, placed goal-side of him -- which is the whole situation.
 */
export const PIVOT_MARKED: MatchScenarioSpec = Object.freeze({
  ballCarrier: "M9",
  attackers: { M6: { x: 7.2, y: 6.6 } },
  defenders: { L2: { x: 7.2, y: 5.9 } },
});

/**
 * DEFENSIVE STEP-OUT. A back driving at the gap between L3 and R3 with the
 * defender in front of him having left the line to meet it -- the situation M7
 * resolves into help, handover and a hole behind.
 */
export const DEFENDER_STEPPED_OUT: MatchScenarioSpec = Object.freeze({
  ballCarrier: "V9",
  attackers: { V9: { x: 7, y: 9.5 } },
  defenders: { L3: { x: 7.2, y: 8.2 } },
});

/**
 * TRANSITION RACE. A breaking carrier past halfway with one defender chasing
 * and the rest of the defence taken off the court -- the numerical situation
 * M8's race model is built to read.
 */
export const TRANSITION_TWO_ON_ONE: MatchScenarioSpec = Object.freeze({
  ballCarrier: "M9",
  attackers: { M9: { x: 10, y: 17 }, V6: { x: 4, y: 15 } },
  defenders: { L3: { x: 10, y: 13 } },
  without: ["L1", "L2", "R1", "R2", "R3"],
  phase: "FIRST_WAVE",
});

/**
 * SHOT CONTEST. A shooter alone at eight metres, central, with only the
 * goalkeeper between him and the goal -- the M9 contest with nothing else in
 * the way.
 */
export const CLEAR_SHOT_AT_EIGHT_METRES: MatchScenarioSpec = Object.freeze({
  ballCarrier: "M9",
  attackers: { M9: { x: 10, y: 8 } },
  without: ["L1", "L2", "L3", "R3", "R2", "R1"],
});

/** Every scenario this module ships, so a test can walk the set. */
export const REUSABLE_SCENARIOS: Readonly<Record<string, MatchScenarioSpec>> = Object.freeze({
  PIVOT_AVAILABLE,
  PIVOT_MARKED,
  DEFENDER_STEPPED_OUT,
  TRANSITION_TWO_ON_ONE,
  CLEAR_SHOT_AT_EIGHT_METRES,
});
