/**
 * Deterministic double round-robin fixture generator (circle method).
 * For N clubs (N even): N-1 rounds for the first leg, each round is a
 * complete pairing of all clubs (N/2 matches), then a second leg with
 * home/away reversed. Every club plays every other club exactly twice
 * (once home, once away), and every club plays exactly N-1 matches per
 * leg / 2*(N-1) total -- for the 14-club Allsvenskan this is 26 matches
 * per club, 182 total, matching the HM-GAME-0.2A brief exactly.
 */

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
};

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function generateDoubleRoundRobin(options: FixtureGeneratorOptions): GeneratedFixture[] {
  const { competitionId, clubIds, seasonStartDate } = options;
  const daysBetweenRounds = options.daysBetweenRounds ?? 7;

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
      const date = addDays(seasonStartDate, (round - 1) * daysBetweenRounds);
      const pairs = pairingsForRound(roundIndex);
      pairs.forEach(([a, b], matchIndex) => {
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
