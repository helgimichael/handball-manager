import { COURT_BOUNDS_METERS } from "../geometry/court";
import { isPointWithinBounds, pointsEqual } from "../geometry/coordinates";
import type { HandballState } from "./state";
import type { TeamId } from "./player";

export type WorldValidationIssue = {
  code:
    | "DUPLICATE_PLAYER_ID"
    | "PLAYER_OUT_OF_BOUNDS"
    | "INVALID_BALL_POSSESSOR"
    | "POSSESSED_BALL_WITHOUT_POSSESSOR"
    | "POSSESSED_BALL_WITH_FLIGHT"
    | "IN_FLIGHT_BALL_WITH_POSSESSOR"
    | "IN_FLIGHT_BALL_WITHOUT_FLIGHT"
    | "LOOSE_BALL_WITH_POSSESSOR"
    | "LOOSE_BALL_WITH_FLIGHT"
    | "POSSESSED_BALL_POSITION_MISMATCH"
    | "STANDARD_SCENARIO_TEAM_COUNT";
  message: string;
};

export type WorldValidationResult = {
  valid: boolean;
  issues: readonly WorldValidationIssue[];
};

function countTeamPlayers(state: HandballState, team: TeamId): number {
  return state.players.filter((player) => player.team === team).length;
}

export function validateHandballState(state: HandballState): WorldValidationResult {
  const issues: WorldValidationIssue[] = [];
  const playerIds = new Set<string>();

  for (const player of state.players) {
    if (playerIds.has(player.id)) {
      issues.push({
        code: "DUPLICATE_PLAYER_ID",
        message: `Duplicate player id: ${player.id}.`
      });
    }
    playerIds.add(player.id);

    if (!isPointWithinBounds(player.position, COURT_BOUNDS_METERS)) {
      issues.push({
        code: "PLAYER_OUT_OF_BOUNDS",
        message: `Player ${player.id} is outside court bounds.`
      });
    }
  }

  const possessor =
    state.ball.possessorId === null ? null : state.players.find((player) => player.id === state.ball.possessorId) ?? null;

  if (state.ball.possessorId !== null && possessor === null) {
    issues.push({
      code: "INVALID_BALL_POSSESSOR",
      message: `Ball possessor does not reference an existing player: ${state.ball.possessorId}.`
    });
  }

  if (state.ball.status === "POSSESSED" && state.ball.possessorId === null) {
    issues.push({
      code: "POSSESSED_BALL_WITHOUT_POSSESSOR",
      message: "A possessed ball must have a possessorId."
    });
  }

  if (state.ball.status === "POSSESSED" && state.ball.flight !== null) {
    issues.push({
      code: "POSSESSED_BALL_WITH_FLIGHT",
      message: "A possessed ball must not carry pass flight metadata."
    });
  }

  if (state.ball.status === "IN_FLIGHT" && state.ball.possessorId !== null) {
    issues.push({
      code: "IN_FLIGHT_BALL_WITH_POSSESSOR",
      message: "An in-flight ball must not have a possessorId."
    });
  }

  if (state.ball.status === "IN_FLIGHT" && state.ball.flight === null) {
    issues.push({
      code: "IN_FLIGHT_BALL_WITHOUT_FLIGHT",
      message: "An in-flight ball must carry pass flight metadata."
    });
  }

  if (state.ball.status === "LOOSE" && state.ball.possessorId !== null) {
    issues.push({
      code: "LOOSE_BALL_WITH_POSSESSOR",
      message: "A loose ball must not have a possessorId."
    });
  }

  if (state.ball.status === "LOOSE" && state.ball.flight !== null) {
    issues.push({
      code: "LOOSE_BALL_WITH_FLIGHT",
      message: "A loose ball must not carry pass flight metadata."
    });
  }

  if (state.ball.status === "POSSESSED" && possessor !== null && !pointsEqual(state.ball.position, possessor.position)) {
    issues.push({
      code: "POSSESSED_BALL_POSITION_MISMATCH",
      message: "A possessed ball must share the possessor's current position in v0.1."
    });
  }

  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues)
  });
}

export function validateStandardSixVsSixState(state: HandballState): WorldValidationResult {
  const baseResult = validateHandballState(state);
  const issues = [...baseResult.issues];
  const attackCount = countTeamPlayers(state, "ATTACK");
  const defenseCount = countTeamPlayers(state, "DEFENSE");

  if (attackCount !== 6 || defenseCount !== 6) {
    issues.push({
      code: "STANDARD_SCENARIO_TEAM_COUNT",
      message: `A standard 6v6 state must contain 6 ATTACK and 6 DEFENSE players. Got ${attackCount} and ${defenseCount}.`
    });
  }

  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues)
  });
}

export function assertValidHandballState(state: HandballState): void {
  const result = validateHandballState(state);
  if (!result.valid) {
    throw new Error(result.issues.map((issue) => issue.message).join(" "));
  }
}
