// Player Career Status (HM-GAME-0.3, Spec S7/S15).
//
// The static mock squad (lib/game-data players.ts) is never mutated at
// runtime (see career/types.ts's existing doc comment). This module adds
// the one thing that WAS missing: a per-save, time-aware availability
// slice that Career Rhythm can actually change day by day. v0.1 only
// implements the smallest safe transition the spec asks for -- an
// injured/suspended player recovering on a scheduled date -- not a full
// injury simulator (Spec S15: "Do not build a complete injury simulator").

import type { PlayerMock } from "../game-data";
import { addDays } from "./dateUtils";

export type PlayerAvailability = "AVAILABLE" | "INJURED" | "SUSPENDED" | "RECOVERING";

export interface PlayerCareerStatus {
  playerId: string;
  availability: PlayerAvailability;
  /** ISO date the player becomes AVAILABLE again. Absent when already AVAILABLE. */
  returnDate?: string;
}

/**
 * Seeds the per-save status slice from the static mock's `squadStatus` at
 * career creation. Mock "Skadad"/"Avstängd" players get a deterministic
 * return date (seasonStartDate + a fixed offset) so v0.1 can prove a real
 * PLAYER_STATUS_CHANGED recovery transition without inventing medical
 * realism (no severity model, no randomness).
 */
export function seedPlayerStatuses(seasonStartDate: string, squad: readonly PlayerMock[]): Record<string, PlayerCareerStatus> {
  const statuses: Record<string, PlayerCareerStatus> = {};
  for (const player of squad) {
    if (player.squadStatus === "Skadad") {
      statuses[player.id] = { playerId: player.id, availability: "INJURED", returnDate: addDays(seasonStartDate, 21) };
    } else if (player.squadStatus === "Avstängd") {
      statuses[player.id] = { playerId: player.id, availability: "SUSPENDED", returnDate: addDays(seasonStartDate, 7) };
    } else {
      statuses[player.id] = { playerId: player.id, availability: "AVAILABLE" };
    }
  }
  return statuses;
}

export function isAvailable(statuses: Record<string, PlayerCareerStatus>, playerId: string): boolean {
  return (statuses[playerId]?.availability ?? "AVAILABLE") === "AVAILABLE";
}

/** Live status label, falling back to the static mock's squadStatus for players Career Rhythm has no live override for (Rotation/Förstaval/Ungdom aren't tracked here). */
export function resolveStatusLabel(statuses: Record<string, PlayerCareerStatus>, player: PlayerMock): string {
  const live = statuses[player.id];
  if (!live) return player.squadStatus;
  switch (live.availability) {
    case "AVAILABLE":
      return player.squadStatus === "Skadad" || player.squadStatus === "Avstängd" ? "Förstaval" : player.squadStatus;
    case "INJURED":
      return "Skadad";
    case "SUSPENDED":
      return "Avstängd";
    case "RECOVERING":
      return "Under rehab";
    default:
      return player.squadStatus;
  }
}
