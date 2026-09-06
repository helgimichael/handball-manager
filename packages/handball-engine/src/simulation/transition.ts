/**
 * MATCH-EXPERIENCE-2.0 M2: change of possession and the full-court transition.
 *
 * CONTINUITY IS THE POINT. A save or a turnover does not end the world and
 * start a new one -- the ball stays exactly where the action left it, every
 * player stays exactly where they were standing, and the SAME FullCourtMatchState
 * carries on. What changes is who is attacking, which goal they attack, and
 * what each player is trying to do. Nothing is reconstructed, re-formed or
 * teleported between the shot and the fast break.
 *
 * That is why M1 insisted on a full-court world. The transition below moves
 * players and the ball across the halfway line in ordinary metres, using the
 * ordinary fixed-step integrator -- no second coordinate space, no separate
 * "transition simulation", no reset.
 */
import {
  changesPossession,
  goalCentre,
  type AttackingGoalSide,
  type FullCourtMatchState,
  type PossessionOutcome,
} from "../domain/match/possession";
import { oppositeGoalSide } from "@handball-manager/match-contract";
import { COURT_WIDTH_METERS } from "../domain/geometry/court";
import { distanceBetween } from "../domain/geometry/coordinates";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { AttackRole, DefenseRole, Player, PlayerRole } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";
import { createHalfCourt6v6StateWithGoalkeeper } from "../scenarios/halfCourt6v6";

/** Attack roles assigned left-to-right across the court when a team gains the ball. */
const ATTACK_ROLE_BY_LANE: readonly AttackRole[] = ["LEFT_WING", "LEFT_BACK", "CENTER_BACK", "RIGHT_BACK", "RIGHT_WING", "PIVOT"];
/** Defence roles assigned left-to-right across the court when a team loses it. */
const DEFENSE_ROLE_BY_LANE: readonly DefenseRole[] = ["L1", "L2", "L3", "R3", "R2", "R1"];

/**
 * Reassigns a squad's roles by their CURRENT lateral position, so the player
 * standing widest left becomes the left wing (or L1) rather than being handed
 * a role from a formation template. Deterministic: ties break on player id.
 */
function reassignRolesByLane(players: readonly Player[], roles: readonly PlayerRole[]): Map<string, PlayerRole> {
  const ordered = [...players].sort((a, b) => a.position.x - b.position.x || a.id.localeCompare(b.id));
  const assignment = new Map<string, PlayerRole>();
  ordered.forEach((player, index) => {
    assignment.set(player.id, roles[Math.min(index, roles.length - 1)]);
  });
  return assignment;
}

function unitToward(from: MeterPoint, to: MeterPoint): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return { x: 0, y: 1 };
  return { x: dx / length, y: dy / length };
}

export type PossessionSwitch = {
  readonly state: FullCourtMatchState;
  /** The player who now has the ball -- the goalkeeper after a save, the winner after a turnover. */
  readonly regainingPlayerId: string;
  readonly previousGoalSide: AttackingGoalSide;
  readonly newGoalSide: AttackingGoalSide;
};

/**
 * Turns a completed defensive regain into the start of a transition, IN PLACE
 * on the existing state.
 *
 * - the teams swap: whoever defended is now ATTACK, and vice versa
 * - the attacking goal side flips TOP <-> BOTTOM
 * - roles are reassigned from where players actually stand
 * - the ball is possessed by `regainingPlayerId`, at that player's position
 * - positions, velocities and the court are otherwise untouched
 */
export function switchPossession(
  current: FullCourtMatchState,
  outcome: PossessionOutcome,
  regainingPlayerId: string,
): PossessionSwitch {
  if (!changesPossession(outcome)) {
    throw new Error(`switchPossession called for ${outcome}, which does not change possession.`);
  }
  const handball = current.handball;
  const regaining = handball.players.find((p) => p.id === regainingPlayerId);
  if (!regaining) throw new Error(`Unknown regaining player: ${regainingPlayerId}`);

  const previousGoalSide = current.possession.attackingGoalSide;
  const newGoalSide = oppositeGoalSide(previousGoalSide);

  // The team that was DEFENSE becomes ATTACK. Field players only take outfield
  // roles; a goalkeeper stays a goalkeeper whichever way the ball is going.
  const newAttackers = handball.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER");
  const newDefenders = handball.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER");
  const attackRoles = reassignRolesByLane(newAttackers, ATTACK_ROLE_BY_LANE);
  const defenceRoles = reassignRolesByLane(newDefenders, DEFENSE_ROLE_BY_LANE);

  // The team that just lost the ball must now defend the goal at the OTHER
  // end -- the one the new attackers are heading for.
  const ownGoal = goalCentre(newGoalSide);
  const targetGoal = goalCentre(newGoalSide);

  const players = handball.players.map((player) => {
    const becomesAttacker = player.team === "DEFENSE";
    const nextTeam = becomesAttacker ? "ATTACK" : "DEFENSE";
    const role =
      player.kind === "GOALKEEPER"
        ? player.role
        : ((becomesAttacker ? attackRoles.get(player.id) : defenceRoles.get(player.id)) ?? player.role);
    // Everyone turns to face where they are now going: attackers up the court,
    // defenders back toward the goal they must now protect.
    const facingTarget = becomesAttacker ? targetGoal : ownGoal;
    return {
      ...player,
      team: nextTeam,
      role,
      facing: unitToward(player.position, facingTarget),
      // Velocity is NOT zeroed -- a player who was already moving keeps his
      // momentum through the turnover, which is what makes a fast break
      // spatially earned rather than granted.
      intent: { type: "IDLE" as const },
    } as Player;
  });

  const next: HandballState = {
    ...handball,
    players,
    ball: { position: { ...regaining.position }, possessorId: regaining.id, status: "POSSESSED", flight: null },
    defense: {
      ...handball.defense,
      // The 6:0 home positions belong to the shape that has just been broken
      // up; the retreating team has no organized shape until it recovers.
      homePositions: [],
      lastReaction: null,
    },
  };

  return {
    state: {
      handball: next,
      possession: {
        attackingTeam: "ATTACK",
        attackingGoalSide: newGoalSide,
        phase: "POSSESSION_CHANGE",
        outcome: null,
      },
    },
    regainingPlayerId,
    previousGoalSide,
    newGoalSide,
  };
}

// ---------------------------------------------------------------------------
// Transition movement targets -- all derived from real positions
// ---------------------------------------------------------------------------

/** How far up the court a breaking attacker aims, as a fraction of the distance to the target goal. */
const BREAK_DEPTH_FRACTION = 0.82;
/** Distance in front of their own goal at which retreating defenders re-form. */
const RETREAT_DEPTH_METERS = 7;

/**
 * Where a breaking attacker runs. Lanes are spread across the court width from
 * the player's own current x, so the wave fans out rather than converging into
 * a queue behind the ball.
 */
export function firstWaveTarget(player: Player, goalSide: AttackingGoalSide): MeterPoint {
  const goal = goalCentre(goalSide);
  const laneX = Math.max(1.5, Math.min(COURT_WIDTH_METERS - 1.5, player.position.x));
  return { x: laneX, y: player.position.y + (goal.y - player.position.y) * BREAK_DEPTH_FRACTION };
}

/** Where a retreating defender runs: goal-side, in his own lane, in front of the goal he must now protect. */
export function retreatTarget(player: Player, ownGoalSide: AttackingGoalSide): MeterPoint {
  const goal = goalCentre(ownGoalSide);
  const laneX = Math.max(2, Math.min(COURT_WIDTH_METERS - 2, player.position.x));
  const depth = ownGoalSide === "TOP" ? RETREAT_DEPTH_METERS : goal.y - RETREAT_DEPTH_METERS;
  return { x: laneX, y: depth };
}

/**
 * How close to their own goal a retreating defender must actually be before he
 * counts as having recovered a useful defensive position.
 *
 * Being merely "goal-side of the ball" is NOT sufficient and was measurably
 * wrong: immediately after a save the ball sits behind every outfield player at
 * the far end, so a goal-side test is trivially true for the whole team and the
 * break would settle before anyone had run anywhere. Recovery therefore
 * requires genuine proximity to the defended goal AS WELL AS being goal-side of
 * the ball -- i.e. the retreat has to be physically completed.
 */
const RECOVERED_DEPTH_METERS = 12;

/**
 * True once the retreating team is physically set in front of its own goal.
 *
 * Depth only, deliberately. An earlier version also required each defender to
 * be goal-side of the ball, which is self-defeating: that can only become true
 * once the break has already failed, so it could never fire in time and
 * ORGANIZED_ATTACK_REACHED was unreachable across 4000 seeds. Whether the
 * carrier has beaten the defence is decided separately, by the shot condition.
 */
export function defenceHasRecovered(state: HandballState, defendedGoal: AttackingGoalSide): boolean {
  const defenders = state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER");
  if (defenders.length === 0) return true;
  const goal = goalCentre(defendedGoal);
  const recovered = defenders.filter((d) => distanceBetween(d.position, goal) <= RECOVERED_DEPTH_METERS).length;
  return recovered >= Math.ceil(defenders.length * 0.66);
}

/** The attacker furthest up the court toward `goalSide` -- the natural outlet for the first pass. */
export function leadRunner(state: HandballState, goalSide: AttackingGoalSide, excludePlayerId?: string): Player | undefined {
  const goal = goalCentre(goalSide);
  const candidates = state.players.filter(
    (p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER" && p.id !== excludePlayerId,
  );
  if (candidates.length === 0) return undefined;
  return [...candidates].sort(
    (a, b) => distanceBetween(a.position, goal) - distanceBetween(b.position, goal) || a.id.localeCompare(b.id),
  )[0];
}


// ---------------------------------------------------------------------------
// Organized positional shape
// ---------------------------------------------------------------------------

/**
 * The lateral lane each handball role occupies, read ONCE from FIELD's own
 * canonical 6v6 formation rather than invented here. Wings sit wide, backs
 * inside them, the centre back and pivot central; the 6:0 defenders spread
 * L1..R1 across the goal.
 *
 * WHY THIS EXISTS. Every movement target in M1-M4 pulls a player toward the
 * goal or the ball: the attacking drive alone moves a carrier 35% of the way
 * toward goal.x (the centre line) each time he attacks. Nothing ever restored
 * organized shape, so across a full match every outfield player converged on
 * x = 10 -- measured mean outfield width fell from 18.8m at kickoff to 1.11m,
 * with 93% of frames under 8m on a 20m court. The six roles stopped occupying
 * recognisable handball positions and the attack became a single file through
 * the centre.
 */
const ROLE_LANE_X: Record<string, number> = (() => {
  const lanes: Record<string, number> = {};
  for (const player of createHalfCourt6v6StateWithGoalkeeper().players) {
    if (player.kind === "GOALKEEPER") continue;
    lanes[player.role] = player.position.x;
  }
  return lanes;
})();

/** The canonical lane for a role, or undefined for a role the formation does not define. */
export function roleLaneX(role: string): number | undefined {
  return ROLE_LANE_X[role];
}

/**
 * Where a player should stand to re-establish organized width, keeping his
 * CURRENT depth. Only the lateral position is restored -- how deep the attack
 * stands is left to the possession itself.
 */
export function organizedShapeTarget(player: Player): MeterPoint | null {
  const lane = roleLaneX(player.role);
  if (lane === undefined) return null;
  if (Math.abs(player.position.x - lane) < 0.6) return null; // already in his lane
  return { x: lane, y: player.position.y };
}
