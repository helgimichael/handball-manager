/**
 * MATCH-EXPERIENCE-2.0 M1: an organized 6v6 positioned inside the CANONICAL
 * FULL COURT, at either goal.
 *
 * The formation data itself is reused unchanged from the existing
 * halfCourt6v6 scenario (which in turn reads FIELD's own formation canonicals
 * through fieldFormationAdapter) -- this module does not invent a second set
 * of handball positions. What it adds is that the situation is expressed in
 * full-court space and can be placed at the TOP goal (y = 0) or the BOTTOM
 * goal (y = 40), because a match engine must be able to attack in both
 * directions from the very first milestone.
 *
 * Mirroring uses the contract's own `mirrorYForOppositeGoalSide` rather than a
 * local `40 - y`, so SIM and FIELD can never disagree about what the other end
 * of the court is.
 */
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import { createHalfCourt6v6StateWithGoalkeeper } from "./halfCourt6v6";
import type { FormationScenarioSelection } from "./fieldFormationAdapter";
import type { HandballState } from "../domain/handball/state";
import type { Player } from "../domain/handball/player";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { AttackingGoalSide, FullCourtMatchState } from "../domain/match/possession";

/** The goal the reused formation data is authored against. */
const SOURCE_GOAL_SIDE: AttackingGoalSide = "TOP";

function mirrorPoint(point: MeterPoint): MeterPoint {
  return { x: point.x, y: mirrorYForOppositeGoalSide(point.y) };
}

function mirrorPlayer(player: Player): Player {
  return {
    ...player,
    position: mirrorPoint(player.position),
    // Mirroring across the horizontal midline flips the y component of any
    // direction; x is untouched.
    facing: { x: player.facing.x, y: -player.facing.y },
    velocity: { x: player.velocity.x, y: -player.velocity.y },
    intent:
      player.intent.type === "MOVE" || player.intent.type === "ATTACK"
        ? { ...player.intent, target: mirrorPoint(player.intent.target) }
        : player.intent,
  };
}

function mirrorState(state: HandballState): HandballState {
  return {
    ...state,
    players: state.players.map(mirrorPlayer),
    ball: {
      ...state.ball,
      position: mirrorPoint(state.ball.position),
      flight: state.ball.flight
        ? { ...state.ball.flight, from: mirrorPoint(state.ball.flight.from), to: mirrorPoint(state.ball.flight.to) }
        : null,
    },
    defense: {
      ...state.defense,
      homePositions: state.defense.homePositions.map((home) => ({ ...home, position: mirrorPoint(home.position) })),
      // A reaction computed against the source end is meaningless once
      // mirrored; the policy recomputes it on the first simulated step.
      lastReaction: null,
    },
  };
}

/**
 * The id of the second goalkeeper -- the one guarding the goal the attacking
 * team is NOT attacking, i.e. their own.
 *
 * A full court has two defended goals. The reused half-court scenario supplies
 * only the goalkeeper at the end being attacked, which was fine while play
 * never left that half, but breaks the moment possession changes: the team that
 * regains the ball turns and attacks the far goal, and that goal must already
 * have somebody in it. Without this the transition resolved shots against an
 * unattended net and derived events with a null goalkeeper.
 */
const ATTACKING_TEAM_GOALKEEPER_ID = "attack-goalkeeper";

/**
 * Adds the attacking team's own goalkeeper, standing in the goal they defend --
 * the opposite end from the one they are attacking. Positioned by mirroring the
 * existing keeper's own depth through the canonical contract, so both keepers
 * stand the same distance off their respective lines and no second set of
 * goalkeeper coordinates is invented.
 */
function withAttackingTeamGoalkeeper(state: HandballState): HandballState {
  const defendingKeeper = state.players.find((p) => p.kind === "GOALKEEPER");
  if (!defendingKeeper) return state;
  const ownGoalKeeper: Player = {
    ...defendingKeeper,
    id: ATTACKING_TEAM_GOALKEEPER_ID,
    team: "ATTACK",
    position: mirrorPoint(defendingKeeper.position),
    facing: { x: defendingKeeper.facing.x, y: -defendingKeeper.facing.y },
    velocity: { x: 0, y: 0 },
    intent: { type: "IDLE" },
  };
  return { ...state, players: [...state.players, ownGoalKeeper] };
}

export type FullCourt6v6Selection = FormationScenarioSelection & {
  /** Which goal the attacking team drives at. Defaults to the TOP goal the formation data is authored against. */
  readonly attackingGoalSide?: AttackingGoalSide;
};

/**
 * An organized 6v6 attack placed in the canonical full court at the requested
 * goal: 6 outfield attackers, 6 outfield defenders, and BOTH goalkeepers --
 * one in each goal -- with the ball possessed by an attacker.
 */
export function createFullCourt6v6State(selection: FullCourt6v6Selection = {}): FullCourtMatchState {
  const attackingGoalSide = selection.attackingGoalSide ?? SOURCE_GOAL_SIDE;
  const source = withAttackingTeamGoalkeeper(createHalfCourt6v6StateWithGoalkeeper(selection));
  const handball = attackingGoalSide === SOURCE_GOAL_SIDE ? source : mirrorState(source);

  return {
    handball,
    possession: {
      attackingTeam: "ATTACK",
      attackingGoalSide,
      phase: "ORGANIZED_SETUP",
      outcome: null,
    },
  };
}
