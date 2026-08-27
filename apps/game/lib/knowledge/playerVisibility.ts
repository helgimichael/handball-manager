// HM-DATA-ALLSVENSKAN-1.1B Part 12: TRUE WORLD STATE (a real
// GameplayPlayerRating) -> MANAGER KNOWLEDGE (knowledgePct) -> PLAYER-
// FACING VIEW (PlayerVisibleView). Pure, client-safe (no filesystem, no
// CareerState) -- takes exactly the same client-safe rating shape the
// Player Profile page already fetches (components/GameplayProfilePanels.tsx's
// GameplayRatingRow structurally satisfies this).
//
// Raw CA/PA NEVER appear anywhere in the returned view, at any
// knowledge level -- same absolute rule as abilityStarsFromCA/
// potentialStarsFromPA (lib/development/types.ts) for the manager's OWN
// players, just now also gating WHICH star range is shown at all for an
// unfamiliar external player.
import { abilityStarsFromCA, potentialStarsFromPA } from "../development/types";
import { getAttributeLabel } from "../rating/attributeVocabulary";
import type { GoalkeeperAttribute, OutcourtAttribute } from "../rating/types";
import { presentTacticalRole } from "../rating/presentation";
import { knowledgeTier, type KnowledgeTier } from "./types";

export interface KnowledgeRatingInput {
  position: string;
  ca: number;
  pa: number;
  branch: { branch: "OUTCOURT" | "GOALKEEPER"; attributes: Record<string, { value: number; origin: string }> };
  attackRoleProficiencies: { role: string }[];
  defenceRoleProficiencies: { role: string }[];
}

export interface StarRange {
  min: number;
  max: number;
}

export interface PlayerVisibleView {
  tier: KnowledgeTier;
  /** Always present -- even MINIMAL knowledge gives a coarse level picture, per this milestone's own spec. Collapses to min===max only at HIGH. */
  abilityRange: StarRange;
  /** null until MEDIUM knowledge ("ökande knowledge: ... bättre potential estimate"). */
  potentialRange: StarRange | null;
  /** null until MEDIUM knowledge. */
  archetype: string | null;
  /** null until MEDIUM knowledge; longer/more precise at HIGH. Real attribute names, drawn from the actual branch -- never invented. */
  strengths: string[] | null;
  weaknesses: string[] | null;
}

function clampStar(value: number): number {
  return Math.max(1, Math.min(5, value));
}

function rangeForTier(trueStars: number, tier: KnowledgeTier): StarRange {
  const spread = tier === "HIGH" ? 0 : tier === "MEDIUM" ? 1 : tier === "LOW" ? 1 : 2;
  return { min: clampStar(trueStars - spread), max: clampStar(trueStars + spread) };
}

function topAttributes(attributes: Record<string, { value: number }>, count: number, order: "desc" | "asc"): string[] {
  const entries = Object.entries(attributes).sort(([keyA, a], [keyB, b]) => (order === "desc" ? b.value - a.value || keyA.localeCompare(keyB) : a.value - b.value || keyA.localeCompare(keyB)));
  return entries.slice(0, count).map(([key]) => getAttributeLabel(key as OutcourtAttribute | GoalkeeperAttribute));
}

/**
 * Resolves what the manager should actually SEE for one player, given
 * how well they know them. Never mutates/reads back into `rating` --
 * purely a redaction/fuzzing view over the real data.
 */
export function resolvePlayerVisibility(rating: KnowledgeRatingInput, knowledgePct: number): PlayerVisibleView {
  const tier = knowledgeTier(knowledgePct);
  const trueAbilityStars = abilityStarsFromCA(rating.ca);
  const truePotentialStars = potentialStarsFromPA(rating.pa);

  const abilityRange = rangeForTier(trueAbilityStars, tier);

  if (tier === "MINIMAL" || tier === "LOW") {
    return { tier, abilityRange, potentialRange: null, archetype: null, strengths: null, weaknesses: null };
  }

  const potentialRange = rangeForTier(truePotentialStars, tier);
  const roleProficiencies = rating.branch.branch === "GOALKEEPER" ? [] : rating.attackRoleProficiencies;
  const archetype = roleProficiencies.length > 0 ? presentTacticalRole(roleProficiencies[0].role) : rating.defenceRoleProficiencies.length > 0 ? presentTacticalRole(rating.defenceRoleProficiencies[0].role) : null;

  const attrCount = tier === "HIGH" ? 3 : 1;
  const strengths = topAttributes(rating.branch.attributes, attrCount, "desc");
  const weaknesses = topAttributes(rating.branch.attributes, attrCount, "asc");

  return { tier, abilityRange, potentialRange, archetype, strengths, weaknesses };
}
