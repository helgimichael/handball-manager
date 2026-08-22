// HM-TACTICS-1.0 Part A/K: MatchSquad validation.
import { MATCH_SQUAD_MAX_PLAYERS, MATCH_SQUAD_MIN_PLAYERS, type MatchSquad } from "./types";

export interface MatchPlanValidationResult {
  ok: boolean;
  errors: string[];
}

function ok(): MatchPlanValidationResult {
  return { ok: true, errors: [] };
}

function fail(...errors: string[]): MatchPlanValidationResult {
  return { ok: false, errors };
}

/**
 * Validates a MatchSquad in isolation. `availablePlayerIds`, when
 * given, is the club's actual available roster for this fixture (e.g.
 * `career.worldSquads[clubId].map(p => p.id)`) -- every selected
 * player must belong to it (Part A: "players must belong to the
 * available squad source"). Omit it only for pure/headless tests that
 * don't model an external roster.
 */
export function validateMatchSquad(squad: MatchSquad, availablePlayerIds?: readonly string[]): MatchPlanValidationResult {
  const errors: string[] = [];

  if (squad.players.length < MATCH_SQUAD_MIN_PLAYERS) {
    errors.push(`Match squad must have at least ${MATCH_SQUAD_MIN_PLAYERS} player(s), got ${squad.players.length}.`);
  }
  if (squad.players.length > MATCH_SQUAD_MAX_PLAYERS) {
    errors.push(`Match squad may have at most ${MATCH_SQUAD_MAX_PLAYERS} players, got ${squad.players.length}.`);
  }

  const seen = new Set<string>();
  for (const player of squad.players) {
    if (seen.has(player.playerId)) {
      errors.push(`Duplicate player "${player.playerId}" in match squad.`);
    }
    seen.add(player.playerId);
  }

  if (availablePlayerIds) {
    const available = new Set(availablePlayerIds);
    for (const player of squad.players) {
      if (!available.has(player.playerId)) {
        errors.push(`Player "${player.playerId}" is not part of the available squad source for this fixture.`);
      }
    }
  }

  return errors.length === 0 ? ok() : fail(...errors);
}

export function matchSquadPlayerIds(squad: MatchSquad): ReadonlySet<string> {
  return new Set(squad.players.map((p) => p.playerId));
}
