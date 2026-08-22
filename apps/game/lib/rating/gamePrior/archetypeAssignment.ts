// HM-RATINGS-0.6 Part D/F: deterministic archetype assignment. For
// outcourt positions this reuses the EXISTING ATTACK_ROLES_BY_POSITION
// vocabulary directly (Part F: "prefer existing project role
// vocabulary") -- assigning one of a position's real attack roles is
// what lets HM-RATINGS-0.4's already-built ROLE_ATTRIBUTE_ASSOCIATIONS
// differentiate a generated player's attribute profile, with zero new
// attribute-generation logic. Goalkeepers get one of 4 small archetypes
// this milestone adds (see generation/priors.ts
// GOALKEEPER_ARCHETYPE_ATTRIBUTE_ASSOCIATIONS).
import { seededOffset } from "../generation/deterministicVariation";
import { ATTACK_ROLES_BY_POSITION, type AttackRole, type OutcourtPositionId, type Position } from "../types";
import { GOALKEEPER_ARCHETYPES, type GoalkeeperArchetype } from "./types";

function pickDeterministic<T>(candidates: readonly T[], seedKey: string): T {
  // seededOffset is symmetric around 0; shift to a non-negative index space.
  const raw = seededOffset(seedKey, 10_000);
  const index = ((raw % candidates.length) + candidates.length) % candidates.length;
  return candidates[index];
}

export function assignOutcourtArchetype(playerId: string, position: OutcourtPositionId, modelVersion: string): AttackRole {
  const candidates = ATTACK_ROLES_BY_POSITION[position];
  return pickDeterministic(candidates, `${playerId}:archetype:${modelVersion}`);
}

export function assignGoalkeeperArchetype(playerId: string, modelVersion: string): GoalkeeperArchetype {
  return pickDeterministic(GOALKEEPER_ARCHETYPES, `${playerId}:archetype:${modelVersion}`);
}

export function assignArchetypeForPosition(playerId: string, position: Position, modelVersion: string): AttackRole | GoalkeeperArchetype {
  return position === "GK" ? assignGoalkeeperArchetype(playerId, modelVersion) : assignOutcourtArchetype(playerId, position, modelVersion);
}
