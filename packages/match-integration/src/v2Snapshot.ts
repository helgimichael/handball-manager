import type { MatchRenderSnapshot } from "@handball-manager/match-contract";
import type { ScenarioState } from "@handball-manager/handball-engine/src/v2/model";

/** Exact historical V2 state -> existing FIELD boundary. No gameplay or interpolation. */
export function v2RenderSnapshot(state: ScenarioState): MatchRenderSnapshot {
  return {
    simulationTime: state.timeMs / 1000,
    court: { view: "FULL_COURT", widthMeters: 20, lengthMeters: 40, attackingGoalSide: state.direction },
    players: state.players.map((player) => ({
      id: player.identity.id, side: player.identity.teamId === state.restart.owner ? "ATTACK" : "DEFENSE", kind: player.identity.kind,
      x: player.position.x, y: player.position.y, roleLabel: player.assignment.role,
      orientationDegrees: Math.hypot(player.velocity.x, player.velocity.y) > 0 ? (Math.atan2(player.velocity.x, -player.velocity.y) * 180 / Math.PI + 360) % 360 : null,
    })),
    ball: { x: state.ball.position.x, y: state.ball.position.y, possessorPlayerId: state.ball.controllerId,
      // DEAD has no equivalent in the coarse render contract; omit status and inspect
      // authoritative V2 state alongside FIELD. Never label dead possession as live.
      ...(state.ball.status === "DEAD" ? {} : { status: state.ball.flight ? "IN_FLIGHT" as const : "POSSESSED" as const }),
    },
  };
}
