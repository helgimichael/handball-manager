import type { HandballState } from "../domain/handball/state";

export type SimActionMode = "NONE" | "MOVE" | "PASS" | "ATTACK";

export type PostPassActionHandoff = {
  selectedPlayerId: string;
  activeAction: SimActionMode;
  receivedPlayerId: string | null;
};

function isAttackingPossessor(state: HandballState, playerId: string | null): playerId is string {
  if (!playerId || state.ball.status !== "POSSESSED" || state.ball.possessorId !== playerId) {
    return false;
  }
  return state.players.some((player) => player.id === playerId && player.team === "ATTACK");
}

export function canPlayerChooseAttack(state: HandballState, selectedPlayerId: string): boolean {
  return isAttackingPossessor(state, selectedPlayerId);
}

export function resolvePostPassActionHandoff(
  previousState: HandballState | null,
  currentState: HandballState,
  selectedPlayerId: string,
  activeAction: SimActionMode
): PostPassActionHandoff {
  const completedReceiverId =
    previousState?.ball.status === "IN_FLIGHT" &&
    previousState.ball.flight !== null &&
    currentState.ball.status === "POSSESSED" &&
    currentState.ball.possessorId === previousState.ball.flight.receiverId
      ? previousState.ball.flight.receiverId
      : null;

  const fallbackReceiverId =
    completedReceiverId === null &&
    activeAction === "PASS" &&
    currentState.ball.status === "POSSESSED" &&
    currentState.ball.possessorId !== null &&
    currentState.ball.possessorId !== selectedPlayerId &&
    isAttackingPossessor(currentState, currentState.ball.possessorId)
      ? currentState.ball.possessorId
      : null;

  const receivedPlayerId = completedReceiverId ?? fallbackReceiverId;
  if (!receivedPlayerId) {
    return { selectedPlayerId, activeAction, receivedPlayerId: null };
  }

  return {
    selectedPlayerId: receivedPlayerId,
    activeAction: activeAction === "PASS" ? "NONE" : activeAction,
    receivedPlayerId
  };
}
