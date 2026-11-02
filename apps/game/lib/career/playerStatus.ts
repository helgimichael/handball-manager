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

// HM-INJURIES-1.0 Part 15: "LIMITED" added -- the RETURN_TO_PLAY rehab
// phase's own external status (lib/medical/types.ts's RehabPhase is the
// detailed internal driver; this stays the coarse external signal every
// other system reads, per this module's own existing "not a full injury
// simulator" scope). A LIMITED player IS selectable for a match (see
// isSelectableForMatch below) but not treated as fully AVAILABLE.
//
// HM-CLUB-PARTNERSHIPS-1.1: "ON_PLACEMENT" added -- a player currently
// developing at a B-team/development-partner club (lib/career/
// playerPlacements.ts). Deliberately its OWN value, never a squashed
// reuse of INJURED/SUSPENDED (the player is fully fit, just training
// elsewhere -- reusing an injury-flavoured status would be dishonest).
// Falls into isSelectableForMatch's existing "not AVAILABLE/LIMITED"
// branch automatically (excluded from the parent club's own match
// selection, Part: "Ingen dubbel matchrepresentation" without any new
// eligibility code), and into effectiveTrainingLoadSetting's existing
// "not AVAILABLE, not LIMITED" branch (forced REST at the PARENT club --
// correct, since the player trains at the partner club instead, not a
// second, divergent availability rule).
// HM-ALPHA3-M10: "NATIONAL_TEAM" -- away with the national team for a window
// (lib/nationalTeam), back on its returnDate like every other status.
export type PlayerAvailability = "AVAILABLE" | "INJURED" | "SUSPENDED" | "RECOVERING" | "LIMITED" | "ON_PLACEMENT" | "NATIONAL_TEAM";

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

/**
 * HM-INJURIES-1.0 Part 15/16/17: the ONE eligibility rule for match
 * selection -- AVAILABLE or LIMITED (a returning player restricted but
 * not excluded, Part 17's chosen model) may be selected; INJURED/
 * SUSPENDED/RECOVERING may not. Every match-squad consumer (tumbaRoster.ts's
 * buildMatchRoster, matchSquad.ts's validateMatchSquad) reads this SAME
 * function -- never a duplicated rule (Part 15: "do not duplicate
 * availability rules across UI").
 */
export function isSelectableForMatch(statuses: Record<string, PlayerCareerStatus>, playerId: string): boolean {
  const availability = statuses[playerId]?.availability ?? "AVAILABLE";
  return availability === "AVAILABLE" || availability === "LIMITED";
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
    case "LIMITED":
      return "Begränsad";
    case "ON_PLACEMENT":
      return "Utplacerad hos partnerklubb";
    default:
      return player.squadStatus;
  }
}
