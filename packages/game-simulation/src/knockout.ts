// HM-ALPHA3-M03: deciding a knockout game that is level after 60 minutes.
//
// Regulation time is never touched: this runs only AFTER a finished result
// (fast, spatial or V2) and only when the competition says the game must
// produce a winner. It adds the minimum the Swedish rules need:
// - overtime rounds of 2x5 minutes (SM-slutspel and kval: up to two rounds,
//   THB 2025/26 and 2026/27 §2:13), simulated with the same deterministic
//   segment model the engine already uses for mid-match changes;
// - then a shootout of five throws each, followed by sudden death (Svenska
//   cupen goes straight to it). The game uses 7 m throws -- see the rules
//   config in the app for why that choice is an isolated assumption.
// Overtime goals count in the match score (handball convention); shootout
// goals are kept separately.
import { createRng, seedFromString } from "./rng";
import { simulateMatchSegment } from "./matchEngine";
import type { ClubStrength, FastMatchResult, MatchDecider } from "./types";

export type KnockoutDeciderInput = {
  result: FastMatchResult;
  seedPrefix: string;
  homeStrength: ClubStrength;
  awayStrength: ClubStrength;
  /** Number of 2x5-minute overtime rounds before a shootout (0 = straight to the shootout). */
  overtimeRounds: number;
  /** Goals already scored in earlier legs of the tie, added before deciding whether the tie is level (two-legged ties). */
  aggregateBefore?: { home: number; away: number };
};

const SHOOTOUT_BASE = 0.72;

function shootoutProbability(shooter: ClubStrength, keeper: ClubStrength): number {
  return Math.max(0.55, Math.min(0.88, SHOOTOUT_BASE + (shooter.attack - keeper.goalkeeper) / 200));
}

/** Returns the result unchanged when the tie is already decided; otherwise adds overtime and/or a shootout and a `decider`. */
export function resolveKnockoutDecider(input: KnockoutDeciderInput): FastMatchResult {
  const { result } = input;
  const before = input.aggregateBefore ?? { home: 0, away: 0 };
  const level = (home: number, away: number) => home + before.home === away + before.away;
  if (!level(result.homeGoals, result.awayGoals)) return result;

  let homeGoals = result.homeGoals;
  let awayGoals = result.awayGoals;
  const overtime: MatchDecider["overtime"] = [];
  for (let round = 0; round < input.overtimeRounds && level(homeGoals, awayGoals); round++) {
    const segment = simulateMatchSegment({
      seed: seedFromString(`${input.seedPrefix}:${result.fixtureId}:ot${round + 1}`),
      startMinute: 60 + round * 10,
      endMinute: 70 + round * 10,
      homeClubId: result.homeClubId,
      awayClubId: result.awayClubId,
      homeStrength: input.homeStrength,
      awayStrength: input.awayStrength,
    });
    overtime.push({ homeGoals: segment.homeGoals, awayGoals: segment.awayGoals });
    homeGoals += segment.homeGoals;
    awayGoals += segment.awayGoals;
  }

  const withScore: FastMatchResult = {
    ...result,
    homeGoals,
    awayGoals,
    homeStats: { ...result.homeStats, goals: homeGoals },
    awayStats: { ...result.awayStats, goals: awayGoals },
  };
  if (!level(homeGoals, awayGoals)) {
    const winnerClubId = homeGoals + before.home > awayGoals + before.away ? result.homeClubId : result.awayClubId;
    return { ...withScore, decider: { overtime, winnerClubId, method: "OVERTIME" } };
  }

  // Shootout: five throws each, alternating (home first), then sudden death in pairs.
  const rng = createRng(seedFromString(`${input.seedPrefix}:${result.fixtureId}:shootout`));
  const pHome = shootoutProbability(input.homeStrength, input.awayStrength);
  const pAway = shootoutProbability(input.awayStrength, input.homeStrength);
  const kicks: { side: "HOME" | "AWAY"; scored: boolean }[] = [];
  let home = 0;
  let away = 0;
  for (let k = 0; k < 5; k++) {
    const h = rng.chance(pHome);
    kicks.push({ side: "HOME", scored: h });
    if (h) home++;
    if (home > away + (5 - k)) break; // away cannot catch up
    const a = rng.chance(pAway);
    kicks.push({ side: "AWAY", scored: a });
    if (a) away++;
    const remaining = 4 - k;
    if (home > away + remaining || away > home + remaining) break;
  }
  for (let pair = 0; home === away && pair < 50; pair++) {
    const h = rng.chance(pHome);
    const a = rng.chance(pAway);
    kicks.push({ side: "HOME", scored: h }, { side: "AWAY", scored: a });
    if (h) home++;
    if (a) away++;
  }
  if (home === away) home++; // unreachable in practice; guarantees a winner
  const winnerClubId = home > away ? result.homeClubId : result.awayClubId;
  return { ...withScore, decider: { overtime, shootout: { home, away, kicks }, winnerClubId, method: "SHOOTOUT" } };
}

/** The winner of a finished game: the decider's when present, otherwise the higher score (null for a draw). */
export function matchWinnerClubId(result: FastMatchResult): string | null {
  if (result.decider) return result.decider.winnerClubId;
  if (result.homeGoals === result.awayGoals) return null;
  return result.homeGoals > result.awayGoals ? result.homeClubId : result.awayClubId;
}
