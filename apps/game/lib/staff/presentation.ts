// HM-DATA-ALLSVENSKAN-1.1B Part 7: PRESENTATION LAYER for staff-facing
// numbers. `computeRoleSuitability` (roleSuitability.ts) stays a real,
// useful 1-20 mechanism canonically -- normal game UI must never show
// that raw system score, only a 1-5 star / verbal impression (same
// "hide the raw number behind stars" boundary already established for
// player CA/PA -- lib/development/types.ts's abilityStarsFromCA).
export function roleSuitabilityStars(suitability1To20: number): number {
  return Math.max(1, Math.min(5, Math.ceil(suitability1To20 / 4)));
}

const ROLE_SUITABILITY_VERBAL_SV = ["Olämplig", "Mindre lämplig", "Godtagbar", "Bra", "Utmärkt"] as const;

/** A short verbal impression matching the same 1-5 star tier, for a context (e.g. a table cell) where a full star glyph doesn't fit well. */
export function roleSuitabilityVerbal(suitability1To20: number): string {
  return ROLE_SUITABILITY_VERBAL_SV[roleSuitabilityStars(suitability1To20) - 1];
}
