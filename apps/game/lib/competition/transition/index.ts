export { planCompetitionTransition } from "./planner";
export { previewSeasonTransition } from "./preview";
export type { SeasonTransitionPreview, LeagueTransitionPreview } from "./preview";
export { SWEDISH_2026_RULES, SWEDISH_FAMILIES, SWEDISH_LEAGUES } from "./sweden2026";
export type * from "./types";
// The optional career/catalog adapter is a separate import so the pure planner has no live dependencies.

export { SWEDISH_COMPETITION_DATA, previewSwedishDataCompletion } from './swedenDataCompletion';
