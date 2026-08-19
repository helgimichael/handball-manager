import { COURT_BOUNDS_METERS } from "../domain/geometry/court";
import { clampPointToBounds } from "../domain/geometry/coordinates";
import type { Player } from "../domain/handball/player";

export function clampPlayerToCourt(player: Player): Player {
  return {
    ...player,
    position: clampPointToBounds(player.position, COURT_BOUNDS_METERS)
  };
}
