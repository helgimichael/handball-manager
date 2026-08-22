// HM-TACTICS-1.0 Part D/E/F/K: per-player match usage validation --
// every squad player needs exactly one PlayerMatchUsage entry (match
// role + playing-time intention + phase usage all required, per the
// type itself being non-optional -- this validator checks COVERAGE:
// no squad player missing an entry, no entry for a non-squad player,
// no duplicate entries for one player).
import { matchSquadPlayerIds, type MatchPlanValidationResult } from "./matchSquad";
import type { MatchSquad, PlayerMatchUsage } from "./types";

function ok(): MatchPlanValidationResult {
  return { ok: true, errors: [] };
}
function fail(errors: string[]): MatchPlanValidationResult {
  return { ok: false, errors };
}

export function validatePlayerUsage(usage: readonly PlayerMatchUsage[], squad: MatchSquad): MatchPlanValidationResult {
  const errors: string[] = [];
  const squadIds = matchSquadPlayerIds(squad);

  const seen = new Set<string>();
  for (const entry of usage) {
    if (!squadIds.has(entry.playerId)) {
      errors.push(`Player usage entry references "${entry.playerId}", who is not in the match squad.`);
    }
    if (seen.has(entry.playerId)) {
      errors.push(`Duplicate player usage entry for "${entry.playerId}".`);
    }
    seen.add(entry.playerId);
  }

  for (const playerId of squadIds) {
    if (!seen.has(playerId)) {
      errors.push(`Squad player "${playerId}" has no match-role/playing-time/phase-usage entry.`);
    }
  }

  return errors.length === 0 ? ok() : fail(errors);
}
