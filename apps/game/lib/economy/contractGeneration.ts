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
import { computePlayerSalaryEurPerMonth, type EconomyProfileInputs } from "./marketValue";
import type { PlayerContract } from "./types";

/** "2027/28" -> 2028 (the season's own second/ending year). Tolerant of any 4-digit-leading format; never throws. */
function parseSeasonEndYear(seasonLabel: string, fallbackYear: number): number {
  const match = /^(\d{4})/.exec(seasonLabel);
  if (!match) return fallbackYear;
  return Number(match[1]) + 1;
}

/**
 * Part 4/HM-DATA-ALLSVENSKAN-1.1B: called ONCE per player, at career
 * creation/migration -- deterministic, never re-rolled on a later call
 * for the same player (the caller, contractIntegration.ts's
 * ensureCareerPlayerContracts, enforces the "only fill what's missing"
 * guarantee).
 *
 * Swedish handball's normal season/contract-year logic is 1 June -> 31
 * May -- every generated/default contract expires on 31 May of its
 * end year, never a randomly-spread calendar day (that read as an
 * obvious generation artifact, e.g. "15 augusti"/"27 mars", and isn't
 * how Swedish club contracts actually work). A shared literal end date
 * across a cohort with no differentiating source hint is the CORRECT,
 * realistic outcome here, not a bug to hide with artificial spread --
 * differentiation between players instead comes from `playerId` (for a
 * genuinely different `contractEndSeasonHint`) and, when the hint really
 * is genuinely uniform, from wage/value (never date).
 */
export function generateContractEndDate(playerId: string, contractEndSeasonHint: string, fallbackYear: number): string {
  const endYear = parseSeasonEndYear(contractEndSeasonHint, fallbackYear);
  return `${endYear}-05-31`;
}

export function generateInitialContract(playerId: string, clubId: string, contractEndSeasonHint: string, fallbackYear: number, economyInputs: EconomyProfileInputs): PlayerContract {
  return {
    playerId,
    clubId,
    contractEndDate: generateContractEndDate(playerId, contractEndSeasonHint, fallbackYear),
    wageEurPerMonth: computePlayerSalaryEurPerMonth(economyInputs),
  };
}
