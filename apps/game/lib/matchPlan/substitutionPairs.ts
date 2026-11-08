// HM-TACTICS-1.0 Part G/K: attack/defence substitution-pair validation.
// A pair only ever declares coach INTENT -- whether the swap actually
// succeeds during a real transition is the future Match Engine's job.
import { matchSquadPlayerIds, type MatchPlanValidationResult } from "./matchSquad";
import type { MatchPlan, MatchSquad, SubstitutionPair } from "./types";

/** Phase exchanges must produce one physical player per slot, even for stale saved pairs. */
export function activeSubstitutionPairs(plan: MatchPlan): SubstitutionPair[] {
  const squad = matchSquadPlayerIds(plan.squad);
  const attackers = new Set(plan.attackStartingUnit.slots.filter(s => s.playerId && s.position !== 'GK').map(s => s.playerId));
  const starters = new Set(plan.attackStartingUnit.slots.map(s => s.playerId));
  const used = new Set<string>();
  return plan.substitutionPairs.filter(pair => {
    if (!squad.has(pair.attackPlayerId) || !squad.has(pair.defencePlayerId) || !attackers.has(pair.attackPlayerId) || starters.has(pair.defencePlayerId) || used.has(pair.attackPlayerId) || used.has(pair.defencePlayerId)) return false;
    used.add(pair.attackPlayerId);
    used.add(pair.defencePlayerId);
    return true;
  });
}

function ok(): MatchPlanValidationResult {
  return { ok: true, errors: [] };
}
function fail(errors: string[]): MatchPlanValidationResult {
  return { ok: false, errors };
}

/**
 * Both players must be in the 16-player match squad, no self-pair, and
 * -- to keep pairing intent unambiguous -- no player may appear in
 * more than one pair (as either the attack or defence member). A
 * future milestone can relax this if a real multi-pair scenario turns
 * up; this milestone keeps it simple per Part K's "do not
 * over-engineer validation."
 */
export function validateSubstitutionPairs(pairs: readonly SubstitutionPair[], squad: MatchSquad): MatchPlanValidationResult {
  const errors: string[] = [];
  const squadIds = matchSquadPlayerIds(squad);
  const seenPlayers = new Set<string>();

  for (const pair of pairs) {
    if (pair.attackPlayerId === pair.defencePlayerId) {
      errors.push(`Substitution pair cannot pair "${pair.attackPlayerId}" with themselves.`);
    }
    if (!squadIds.has(pair.attackPlayerId)) {
      errors.push(`Substitution pair references "${pair.attackPlayerId}", who is not in the match squad.`);
    }
    if (!squadIds.has(pair.defencePlayerId)) {
      errors.push(`Substitution pair references "${pair.defencePlayerId}", who is not in the match squad.`);
    }
    for (const playerId of [pair.attackPlayerId, pair.defencePlayerId]) {
      if (seenPlayers.has(playerId)) {
        errors.push(`Player "${playerId}" belongs to more than one substitution pair.`);
      }
      seenPlayers.add(playerId);
    }
  }

  return errors.length === 0 ? ok() : fail(errors);
}
