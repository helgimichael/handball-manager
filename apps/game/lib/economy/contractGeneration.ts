// HM-CONTRACTS-1.0: deterministic, one-time contract generation --
// reuses the existing PlayerMock.contractEndSeason hand-authored (mock)
// or real-world-fetched (Handbollsligan) field as a REAL signal/anchor
// rather than discarding it and inventing a number from nothing (Part:
// "Återanvänd befintliga modeller och helpers"), while still producing a
// properly DIFFERENTIATED, per-player end date -- a flat literal season
// string (e.g. every REAL_WORLD player with no fetched contract data all
// fall back to the exact same "2026/27", per gameWorld/gameWorldAdapter.ts)
// would otherwise make an entire club's contracts expire on the
// identical calendar day, which reads as an obvious generation artifact
// rather than a real roster. The wage itself is always freshly computed
// (computePlayerSalaryEurPerMonth) -- PlayerMock's own legacy
// `wageSekPerMonth` mock field is never read here (HM-CONTRACTS-1.0A:
// EUR is canonical; that SEK field is unrelated static seed data).
import { addDays } from "../career/dateUtils";
import { seededOffset } from "../rating/generation/deterministicVariation";
import { computePlayerSalaryEurPerMonth, type EconomyProfileInputs } from "./marketValue";
import type { PlayerContract } from "./types";

/** "2027/28" -> 2028 (the season's own second/ending year). Tolerant of any 4-digit-leading format; never throws. */
function parseSeasonEndYear(seasonLabel: string, fallbackYear: number): number {
  const match = /^(\d{4})/.exec(seasonLabel);
  if (!match) return fallbackYear;
  return Number(match[1]) + 1;
}

/**
 * Part 4: called ONCE per player, at career creation/migration --
 * deterministic, never re-rolled on a later call for the same player
 * (the caller, contractIntegration.ts's ensureCareerPlayerContracts,
 * enforces the "only fill what's missing" guarantee).
 */
export function generateContractEndDate(playerId: string, contractEndSeasonHint: string, fallbackYear: number): string {
  const endYear = parseSeasonEndYear(contractEndSeasonHint, fallbackYear);
  // Swedish handball seasons run roughly Sept-June -- June 30 is a
  // reasonable "season end" anchor. +/- ~4 months deterministic spread
  // so an entire cohort sharing the same hint (e.g. every REAL_WORLD
  // player with no fetched contract data) doesn't all expire on one
  // identical calendar day.
  const anchor = `${endYear}-06-30`;
  const spreadDays = seededOffset(`${playerId}:contract:end-date-spread`, 120);
  return addDays(anchor, spreadDays);
}

export function generateInitialContract(playerId: string, clubId: string, contractEndSeasonHint: string, fallbackYear: number, economyInputs: EconomyProfileInputs): PlayerContract {
  return {
    playerId,
    clubId,
    contractEndDate: generateContractEndDate(playerId, contractEndSeasonHint, fallbackYear),
    wageEurPerMonth: computePlayerSalaryEurPerMonth(economyInputs),
  };
}
