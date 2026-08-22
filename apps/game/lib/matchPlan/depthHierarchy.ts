// HM-TACTICS-1.0 Part H/K: generic depth/hierarchy validation. A
// generic priority structure rather than one hardcoded per position --
// `groupKey` is free-form (a position, a role, a custom bucket).
import { matchSquadPlayerIds, type MatchPlanValidationResult } from "./matchSquad";
import type { DepthHierarchy, MatchSquad } from "./types";

function ok(): MatchPlanValidationResult {
  return { ok: true, errors: [] };
}
function fail(errors: string[]): MatchPlanValidationResult {
  return { ok: false, errors };
}

export function validateDepthHierarchy(hierarchy: DepthHierarchy, squad: MatchSquad): MatchPlanValidationResult {
  const errors: string[] = [];
  const squadIds = matchSquadPlayerIds(squad);

  for (const group of hierarchy) {
    const seenPlayers = new Set<string>();
    const seenPriorities = new Set<number>();
    for (const entry of group.entries) {
      if (!squadIds.has(entry.playerId)) {
        errors.push(`Depth group "${group.groupKey}" references "${entry.playerId}", who is not in the match squad.`);
      }
      if (seenPlayers.has(entry.playerId)) {
        errors.push(`Depth group "${group.groupKey}" lists "${entry.playerId}" more than once.`);
      }
      seenPlayers.add(entry.playerId);

      if (!Number.isInteger(entry.priority) || entry.priority < 1) {
        errors.push(`Depth group "${group.groupKey}" has an invalid priority ${entry.priority} for "${entry.playerId}" -- must be a positive integer.`);
      }
      if (seenPriorities.has(entry.priority)) {
        errors.push(`Depth group "${group.groupKey}" has duplicate priority ${entry.priority}.`);
      }
      seenPriorities.add(entry.priority);
    }
  }

  return errors.length === 0 ? ok() : fail(errors);
}
