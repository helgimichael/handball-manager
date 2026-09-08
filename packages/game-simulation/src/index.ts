export { createRng, seedFromString, nextGaussian, type Rng } from "./rng";
export {
  simulateMatch,
  simulateMatchSegment,
  type SimulateMatchInput,
  type SimulateMatchSegmentInput,
  type MatchSegmentResult,
} from "./matchEngine";
export { generateDoubleRoundRobin, type GeneratedFixture, type FixtureGeneratorOptions } from "./fixtures";
export { simulateFixture, simulateSeason, type StrengthLookup, type RosterLookup, type TacticalAdjustment } from "./season";
export { computeStandings, ALLSVENSKAN_POINTS_RULE, type StandingRow, type CompletedResult, type PointsRule } from "./table";
export type {
  ClubStrength,
  TeamMatchStats,
  MatchEvent,
  MatchEventType,
  PlayerMatchContribution,
  FastMatchResult,
  MatchEngineId,
  MatchRosterPlayer,
} from "./types";
