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
  /** HM-ALPHA3-M06: keys the stable scouting estimate (falls back to the rating itself). */
  playerId?: string;
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

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * HM-ALPHA3-M06 (critical information rule): what the club's scouting
 * believes, not the truth. Below HIGH knowledge the estimate can be a star
 * off -- stable per player (never re-rolled per view), less likely with a
 * better scout -- and the shown range is centred on the ESTIMATE, so its
 * midpoint no longer gives the true value away. The true value always
 * stays inside the range.
 */
export function scoutingStarOffset(key: string, tier: KnowledgeTier, scoutSuitability1to20 = 10.5): -1 | 0 | 1 {
  if (tier === "HIGH") return 0;
  const base = tier === "MINIMAL" ? 0.6 : tier === "LOW" ? 0.5 : 0.3;
  const errChance = base * Math.max(0.5, Math.min(1.3, 1.3 - (scoutSuitability1to20 / 20) * 0.8));
  if (hash(`${key}:err`) >= errChance) return 0;
  return hash(`${key}:dir`) < 0.5 ? -1 : 1;
}

function rangeForTier(trueStars: number, tier: KnowledgeTier, offset: -1 | 0 | 1 = 0): StarRange {
  const spread = tier === "HIGH" ? 0 : tier === "MEDIUM" ? 1 : tier === "LOW" ? 1 : 2;
  const estimate = clampStar(trueStars + offset);
  return { min: clampStar(estimate - spread), max: clampStar(estimate + spread) };
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
export function resolvePlayerVisibility(rating: KnowledgeRatingInput, knowledgePct: number, scoutSuitability1to20?: number): PlayerVisibleView {
  const tier = knowledgeTier(knowledgePct);
  const trueAbilityStars = abilityStarsFromCA(rating.ca);
  const truePotentialStars = potentialStarsFromPA(rating.pa);

  const key = rating.playerId ?? `${rating.position}:${rating.ca}:${rating.pa}`;
  const abilityRange = rangeForTier(trueAbilityStars, tier, scoutingStarOffset(`${key}:ca`, tier, scoutSuitability1to20));

  if (tier === "MINIMAL" || tier === "LOW") {
    return { tier, abilityRange, potentialRange: null, archetype: null, strengths: null, weaknesses: null };
  }

  const potentialRange = rangeForTier(truePotentialStars, tier, scoutingStarOffset(`${key}:pa`, tier, scoutSuitability1to20));
  const roleProficiencies = rating.branch.branch === "GOALKEEPER" ? [] : rating.attackRoleProficiencies;
  const archetype = roleProficiencies.length > 0 ? presentTacticalRole(roleProficiencies[0].role) : rating.defenceRoleProficiencies.length > 0 ? presentTacticalRole(rating.defenceRoleProficiencies[0].role) : null;

  const attrCount = tier === "HIGH" ? 3 : 1;
  const strengths = topAttributes(rating.branch.attributes, attrCount, "desc");
  const weaknesses = topAttributes(rating.branch.attributes, attrCount, "asc");

  return { tier, abilityRange, potentialRange, archetype, strengths, weaknesses };
}
