// HM-RATINGS-0.6: barrel re-export for the game-prior layer. NOTE:
// clubContextTier.ts (and therefore applyGamePrior.ts, which imports
// it) touches the filesystem -- this barrel is SERVER-ONLY, unlike
// lib/rating/types.ts, generation/, and caEstimation/. Never import
// this from a client component.
export * from "./types";
export * from "./populationModel";
export * from "./archetypeAssignment";
export * from "./clubContextTier";
export * from "./applyGamePrior";
