/**
 * Deterministic double round-robin fixture generator (circle method).
 * For N clubs (N even): N-1 rounds for the first leg, each round is a
 * complete pairing of all clubs (N/2 matches), then a second leg with
 * home/away reversed. Every club plays every other club exactly twice
 * (once home, once away), and every club plays exactly N-1 matches per
 * leg / 2*(N-1) total -- for the 14-club Allsvenskan this is 26 matches
 * per club, 182 total, matching the HM-GAME-0.2A brief exactly.
 *
 * HM-CAREER-0.5: fixtures within one round no longer all share the exact
 * same date. Each round still has a single fixed BASE date (`daysBetweenRounds`
 * apart, as before); every fixture within that round then gets a small,
 * deterministic day offset added to it (`spreadDays`, default 4 -- e.g. a
 * round starting on a Wednesday spreads across Wed/Thu/Fri/Sat), so a
 * round is genuinely distributed across a few nearby days instead of
 * every club playing on one shared instant. The offset is derived purely
 * from (competitionId, round, position-within-round) via this package's
 * own seeded rng (rng.ts) -- fully deterministic and isolated from match
 * simulation/save seeds, so the exact same schedule is generated every
 * time for the same inputs. `spreadDays` is always clamped to at most
 * `daysBetweenRounds`, which guarantees consecutive rounds' date ranges
 * never overlap (round R's fixtures land in
 * [base(R), base(R) + spreadDays - 1], and base(R+1) = base(R) +
 * daysBetweenRounds >= base(R) + spreadDays). This is deliberately
 * PROVISIONAL game scheduling for pacing/presentation purposes only --
 * it is not researched real-world 2026/27 fixture data.
 */
import { createRng, seedFromString } from "./rng";

export type GeneratedFixture = {
  id: string;
  competitionId: string;
  round: number;
  date: string; // ISO date
  homeClubId: string;
  awayClubId: string;
};

export type FixtureGeneratorOptions = {
  competitionId: string;
  clubIds: readonly string[];
  seasonStartDate: string; // ISO date, first round's date
  /** Days between rounds -- weekly by default, matching the existing mock schedule's cadence. */
  daysBetweenRounds?: number;
  /**
   * How many distinct consecutive days one round's fixtures may be
   * deterministically spread across (default 4). `1` reproduces the old
   * "every fixture in a round shares one date" behavior exactly -- useful
   * for tests/callers that still want that. Always clamped to at most
   * `daysBetweenRounds` so rounds can never overlap.
   */
  spreadDays?: number;
};

const DEFAULT_SPREAD_DAYS = 4;

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Deterministic day offset (0..spreadDays-1) for the fixture at `matchIndex` within `round`. */
function fixtureDateOffset(competitionId: string, round: number, matchIndex: number, spreadDays: number): number {
  if (spreadDays <= 1) return 0;
  const seed = seedFromString(`${competitionId}:round-date-spread:${round}:${matchIndex}`);
  return createRng(seed).nextInt(0, spreadDays - 1);
}

export function generateDoubleRoundRobin(options: FixtureGeneratorOptions): GeneratedFixture[] {
  const { competitionId, clubIds, seasonStartDate } = options;
  const daysBetweenRounds = options.daysBetweenRounds ?? 7;
  const spreadDays = Math.max(1, Math.min(options.spreadDays ?? DEFAULT_SPREAD_DAYS, daysBetweenRounds));

  if (clubIds.length % 2 !== 0) {
    throw new Error(`generateDoubleRoundRobin requires an even number of clubs, got ${clubIds.length}.`);
  }

  const n = clubIds.length;
  const half = n / 2;
  // Circle method: club[0] is fixed, the rest rotate each round.
  const rotating = clubIds.slice(1);
  const fixtures: GeneratedFixture[] = [];
  let fixtureCounter = 0;

  function pairingsForRound(roundIndex: number): Array<[string, string]> {
    // Rotate the non-fixed clubs by roundIndex positions -- the
    // standard circle-method construction for a single round-robin leg.
    const rotatedRotating = [...rotating.slice(roundIndex), ...rotating.slice(0, roundIndex)];
    const full = [clubIds[0], ...rotatedRotating];
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < half; i += 1) {
      pairs.push([full[i], full[n - 1 - i]]);
    }
    return pairs;
  }

  const totalRoundsFirstLeg = n - 1;

  for (let leg = 0; leg < 2; leg += 1) {
    for (let roundIndex = 0; roundIndex < totalRoundsFirstLeg; roundIndex += 1) {
      const round = leg * totalRoundsFirstLeg + roundIndex + 1;
      const roundBaseDate = (round - 1) * daysBetweenRounds;
      const pairs = pairingsForRound(roundIndex);
      pairs.forEach(([a, b], matchIndex) => {
        const date = addDays(seasonStartDate, roundBaseDate + fixtureDateOffset(competitionId, round, matchIndex, spreadDays));
        // Alternate which side of the pairing is "home" each round so
        // no single club is permanently favoured by the pairing order;
        // the second leg additionally swaps home/away relative to the
        // first leg for the SAME pairing, guaranteeing each pair meets
        // once at each club's home venue across the full season.
        const swapWithinRound = (roundIndex + matchIndex) % 2 === 1;
        let home = swapWithinRound ? b : a;
        let away = swapWithinRound ? a : b;
        if (leg === 1) {
          [home, away] = [away, home];
        }
        fixtureCounter += 1;
        fixtures.push({
          id: `${competitionId}-f${fixtureCounter}`,
          competitionId,
          round,
          date,
          homeClubId: home,
          awayClubId: away,
        });
      });
    }
  }

  return fixtures;
}
