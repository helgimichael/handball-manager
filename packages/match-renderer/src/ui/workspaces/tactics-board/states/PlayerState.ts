import { getPlayerStateDefinition } from "./PlayerStateRegistry.ts";
import type { PlayerState, PlayerStateStyle, PlayerStateType } from "./PlayerStateTypes.ts";

export type CreatePlayerStateInput = {
  id: string;
  type: PlayerStateType;
  playerId: string;
  style?: Partial<PlayerStateStyle>;
};

export function createPlayerState(input: CreatePlayerStateInput): PlayerState {
  const definition = getPlayerStateDefinition(input.type);

  return Object.freeze({
    id: input.id,
    type: input.type,
    playerId: input.playerId,
    style: Object.freeze({
      ...definition.style,
      ...input.style,
    }),
  });
}
