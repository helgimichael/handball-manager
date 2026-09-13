import { CANONICAL_COURT_LENGTH_METERS, CANONICAL_COURT_WIDTH_METERS } from "@handball-manager/match-contract";
import { distanceBetween } from "../domain/geometry/coordinates";
import { playerById, type ActionKind, type Player, type RuleProfile, type ScenarioState } from "./model";

// IHF 2025, 10:3b / 10:4. Geometry of the body is an explicit conservative disc.
// Source: https://www.ihf.info/sites/default/files/2025-07/09A%20-%20Rules%20of%20the%20Game_Indoor%20Handball_E.pdf
export const IHF_2025: RuleProfile = {
  id: "IHF_INDOOR_2025_AREA", effectiveFrom: "2025-07-01",
  throwOff: { variant: "AREA", centre: { x: CANONICAL_COURT_WIDTH_METERS / 2, y: CANONICAL_COURT_LENGTH_METERS / 2 }, radius: 2, releaseWithinMs: 3000, ballRadius: 0.1 },
};

export function whollyInsideArea(state: ScenarioState, point: { x: number; y: number }, radius: number): boolean {
  return distanceBetween(point, state.ruleProfile.throwOff.centre) + radius <= state.ruleProfile.throwOff.radius;
}

export function preparationIssues(state: ScenarioState): string[] {
  const issues: string[] = [];
  const taker = playerById(state, state.restart.takerId);
  const receiver = playerById(state, state.restart.receiverId);
  if (taker.identity.teamId !== state.restart.owner || receiver.identity.teamId !== state.restart.owner || taker === receiver) issues.push("Restart participants must be distinct teammates of the owner");
  if (!whollyInsideArea(state, taker.position, taker.bodyRadius)) issues.push("Taker is not completely inside the throw-off area");
  if (!whollyInsideArea(state, state.ball.position, state.ruleProfile.throwOff.ballRadius)) issues.push("Ball is not completely inside the throw-off area");
  if (state.ball.controllerId !== taker.identity.id) issues.push("Taker does not control the ball");
  for (const player of state.players) {
    const owningTeam = player.identity.teamId === state.restart.owner;
    const inside = whollyInsideArea(state, player.position, player.bodyRadius);
    const ownGoalTop = owningTeam ? state.direction === "BOTTOM" : state.direction === "TOP";
    const inOwnHalf = ownGoalTop ? player.position.y + player.bodyRadius <= 20 : player.position.y - player.bodyRadius >= 20;
    if (!owningTeam && distanceBetween(player.position, state.ruleProfile.throwOff.centre) - player.bodyRadius < state.ruleProfile.throwOff.radius) issues.push(`${player.identity.id}: opponent encroaches on throw-off area`);
    if ((owningTeam || state.restart.context === "OPENING_HALF") && !inOwnHalf && !inside) issues.push(`${player.identity.id}: wrong half before whistle`);
  }
  return issues;
}

export function ordinaryPlayAllowed(state: ScenarioState): boolean {
  return state.restart.phase === "COMPLETED" && state.ball.inPlay && state.status !== "FAILED";
}

export function actionEligible(state: ScenarioState, player: Player, kind: ActionKind): boolean {
  if (state.status !== "RUNNING") return false;
  const duty = player.assignment.responsibility;
  switch (kind) {
    case "REPOSITION": return state.restart.phase === "PREPARING";
    case "PREPARE_THROW_OFF": return duty === "TAKE_RESTART" && state.restart.phase === "PREPARING";
    case "EXECUTE_THROW": return duty === "TAKE_RESTART" && state.restart.phase === "AUTHORISED" && preparationIssues(state).length === 0;
    case "RECEIVE": return duty === "RECEIVE_RESTART" && state.restart.phase === "AUTHORISED";
  }
}

/** Rule completion requires a released-ball interaction, never a ready position. */
export function completionEvidence(state: ScenarioState, touchedByPlayerId: string | null): "TEAMMATE_TOUCH" | "AREA_EXIT" | null {
  const flight = state.ball.flight;
  if (!flight || state.restart.phase !== "EXECUTING") return null;
  if (touchedByPlayerId && touchedByPlayerId !== flight.passerId && playerById(state, touchedByPlayerId).identity.teamId === state.restart.owner) return "TEAMMATE_TOUCH";
  if (distanceBetween(state.ball.position, state.ruleProfile.throwOff.centre) - state.ruleProfile.throwOff.ballRadius > state.ruleProfile.throwOff.radius) return "AREA_EXIT";
  return null;
}
