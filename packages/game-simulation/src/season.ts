import { simulateMatch } from "./matchEngine";
import { seedFromString } from "./rng";
import type { GeneratedFixture } from "./fixtures";
import type { ClubStrength, FastMatchResult, MatchRosterPlayer } from "./types";

export type StrengthLookup = (clubId: string) => ClubStrength;
export type RosterLookup = (clubId: string, fixture: GeneratedFixture) => readonly MatchRosterPlayer[] | undefined;

/**
 * Simulates one fixture with a seed deterministically derived from
 * `${seedPrefix}:${fixture.id}` (see rng.ts's seedFromString) -- the
 * scheme documented in the HM-GAME-0.2A report's determinism section.
 * Because the seed depends only on the save's own seed and the
 * fixture's own stable id (never on simulation order, wall-clock time,
 * or how many other fixtures have been played), calling this for the
 * same fixture twice with the same seedPrefix always reproduces the
 * exact same result -- the property both the "no duplicate simulation"
 * and "persisted/resumed season matches uninterrupted season" HM-0.2A
 * regression requirements depend on.
 */
export function simulateFixture(
  fixture: GeneratedFixture,
  seedPrefix: string,
  getStrength: StrengthLookup,
  getRoster?: RosterLookup,
): FastMatchResult {
  return simulateMatch({
    fixtureId: fixture.id,
    seed: seedFromString(`${seedPrefix}:${fixture.id}`),
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    homeStrength: getStrength(fixture.homeClubId),
    awayStrength: getStrength(fixture.awayClubId),
    homeRoster: getRoster?.(fixture.homeClubId, fixture),
    awayRoster: getRoster?.(fixture.awayClubId, fixture),
  });
}

/** Simulates every fixture in the given list, in order. Pure -- does not mutate its inputs. */
export function simulateSeason(
  fixtures: readonly GeneratedFixture[],
  seedPrefix: string,
  getStrength: StrengthLookup,
  getRoster?: RosterLookup,
): FastMatchResult[] {
  return fixtures.map((fixture) => simulateFixture(fixture, seedPrefix, getStrength, getRoster));
}
