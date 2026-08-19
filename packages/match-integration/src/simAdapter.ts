/**
 * MatchStateAdapter (SIM -> MatchRenderSnapshot).
 *
 * The only file in this package allowed to import
 * @handball-manager/handball-engine. It must never import
 * @handball-manager/match-renderer or React -- see fieldAdapter.ts for
 * the other half of the bridge, which is the mirror restriction.
 *
 * This is a pure, read-only reshape: per the HM-0.2D audit, SIM and
 * FIELD already share one coordinate convention (20x40m court,
 * top-left origin, x-right/y-down axes), so no coordinate transform is
 * applied here -- only field selection and vector-to-degrees conversion
 * for orientation. HandballState is never mutated.
 */

import type { HandballState } from "@handball-manager/handball-engine/src/domain/handball/state.ts";
import type { Player } from "@handball-manager/handball-engine/src/domain/handball/player.ts";
import type { Ball } from "@handball-manager/handball-engine/src/domain/handball/ball.ts";
import type { MeterVector } from "@handball-manager/handball-engine/src/domain/geometry/coordinates.ts";
import type {
  MatchBallRenderState,
  MatchBallStatus,
  MatchPlayerRenderState,
  MatchRenderSnapshot,
} from "@handball-manager/match-contract";

/**
 * Inverse of handball-engine's own scenarios/fieldFormationAdapter.ts
 * rotationToFacing(): recovers a FIELD-style rotation-degrees value from
 * SIM's unit-vector facing. rotationToFacing(deg) = { x: sin(rad),
 * y: -cos(rad) }, so the inverse is atan2(x, -y). Duplicated here (not
 * imported) because rotationToFacing is not exported from
 * fieldFormationAdapter.ts -- it is a private helper -- and this
 * adapter package intentionally does not modify handball-engine to
 * export it (see HM-0.2E report Section 4: prefer adapter-side code
 * over touching the migrated core).
 */
function facingToRotationDegrees(facing: MeterVector): number {
  const radians = Math.atan2(facing.x, -facing.y);
  const degrees = (radians * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
}

function mapSide(team: Player["team"]): MatchPlayerRenderState["side"] {
  return team;
}

/**
 * SIM has no goalkeeper entity (see HM-0.2D report Section 2 and the
 * Goalkeeper Rule in the HM-0.2E brief): domain/handball/player.ts's
 * TeamId is only "ATTACK"|"DEFENSE" and DefenseRole is only the six
 * field-defender slots. Every SIM player is therefore always mapped to
 * kind "FIELD_PLAYER" -- this function exists as a single, explicit,
 * commented place recording that fact, rather than leaving the literal
 * "FIELD_PLAYER" unexplained at each call site.
 */
function mapKind(): MatchPlayerRenderState["kind"] {
  return "FIELD_PLAYER";
}

function mapPlayer(player: Player): MatchPlayerRenderState {
  return {
    id: player.id,
    side: mapSide(player.team),
    kind: mapKind(),
    x: player.position.x,
    y: player.position.y,
    orientationDegrees: facingToRotationDegrees(player.facing),
    roleLabel: player.role,
  };
}

function mapBallStatus(status: Ball["status"]): MatchBallStatus {
  return status;
}

function mapBall(ball: Ball): MatchBallRenderState {
  return {
    x: ball.position.x,
    y: ball.position.y,
    status: mapBallStatus(ball.status),
    possessorPlayerId: ball.possessorId,
  };
}

export type MatchStateAdapterOptions = {
  /**
   * SIM's createHalfCourt6v6State always sets up the attack team driving
   * toward the y=0 (TOP) goal (see HM-0.2D report Section 2) -- this is
   * the only scenario the adapter has been exercised against so far, so
   * the default matches it. A future scenario that attacks the BOTTOM
   * goal must pass this explicitly; the adapter does not infer it from
   * player positions.
   */
  attackingGoalSide?: "TOP" | "BOTTOM";
  courtView?: "HALF_COURT" | "FULL_COURT";
};

/**
 * Converts one HandballState into one immutable MatchRenderSnapshot.
 * Read-only: does not mutate `state` or anything reachable from it.
 */
export function toMatchRenderSnapshot(
  state: HandballState,
  options: MatchStateAdapterOptions = {},
): MatchRenderSnapshot {
  return {
    simulationTime: state.simulationTime,
    court: {
      view: options.courtView ?? "HALF_COURT",
      widthMeters: 20,
      lengthMeters: 40,
      attackingGoalSide: options.attackingGoalSide ?? "TOP",
    },
    players: state.players.map(mapPlayer),
    ball: mapBall(state.ball),
  };
}
