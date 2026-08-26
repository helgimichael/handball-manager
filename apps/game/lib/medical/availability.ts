// HM-INJURIES-1.0 Part 15/18: the canonical CareerState-level
// availability helper -- every UI/system consumer (Squad, Player
// Profile, Training, Tactics) reads THIS, never re-derives its own
// eligibility rule (Part 15). lib/career/playerStatus.ts stays the
// lower-level statuses-map primitive (kept there to avoid a circular
// CareerState <-> playerStatus.ts import); this module is the one that
// actually takes a full CareerState, since it lives outside lib/career.
import { isAvailable, isSelectableForMatch } from "../career/playerStatus";
import type { CareerState } from "../career/types";
import type { PlayerTrainingLoadSetting } from "../training/types";

/**
 * Part 15: `AVAILABLE` (fully fit), `LIMITED` (return-to-play, selectable
 * but restricted), or `UNAVAILABLE` (injured/suspended/recovering, never
 * selectable). Collapses lib/career/playerStatus.ts's finer
 * PlayerAvailability vocabulary into exactly the three buckets every
 * consumer actually needs to branch on.
 */
export type PlayerMatchAvailability = "AVAILABLE" | "LIMITED" | "UNAVAILABLE";

export function getPlayerAvailability(state: CareerState, playerId: string): PlayerMatchAvailability {
  const status = state.playerStatuses[playerId];
  if (!status || status.availability === "AVAILABLE") return "AVAILABLE";
  if (status.availability === "LIMITED") return "LIMITED";
  return "UNAVAILABLE";
}

/** Part 16: the ids currently excluded from match selection for one club's own squad. */
export function unavailablePlayerIdsForClub(state: CareerState, squadPlayerIds: readonly string[]): string[] {
  return squadPlayerIds.filter((id) => !isSelectableForMatch(state.playerStatuses, id));
}

/**
 * Part 18/22/23/33: caps a player's REQUESTED training load setting down
 * to what their injury status actually allows -- automatic, the manager
 * never has to remember. Fully unavailable (INJURED/SUSPENDED/RECOVERING):
 * forced to REST (zero training exposure -- Part 18's "REHAB only").
 * LIMITED (return-to-play): capped at REDUCED, even if FULL was
 * requested. AVAILABLE: untouched.
 */
export function effectiveTrainingLoadSetting(state: CareerState, playerId: string, requested: PlayerTrainingLoadSetting): PlayerTrainingLoadSetting {
  if (isAvailable(state.playerStatuses, playerId)) return requested;
  const availability = getPlayerAvailability(state, playerId);
  if (availability === "LIMITED") {
    return requested === "FULL" ? "REDUCED" : requested;
  }
  return "REST";
}
