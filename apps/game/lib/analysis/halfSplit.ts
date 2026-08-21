// Half-split selector for a single match (HM-ANALYSIS-0.1, Spec §12/S17).
//
// Reuses liveMatchView.ts's exact event-tally formulas (tallyTeamStats)
// rather than reimplementing them, and partitions by the timeline's own
// `minute` field -- never derived by dividing final totals in half
// (Spec S17: "do not use final totals and divide them heuristically").
import type { FastMatchResult } from "@handball-manager/game-simulation";
import { tallyTeamStats, type LiveTeamStats } from "../liveMatch/liveMatchView";
import { HALF_TIME_MINUTE } from "./calibration";

export interface HalfSplit {
  home: LiveTeamStats;
  away: LiveTeamStats;
}

function tallyHalf(result: FastMatchResult, predicate: (minute: number) => boolean): HalfSplit {
  const events = result.events.filter((e) => predicate(e.minute));
  const homeShotTypes = new Set(["GOAL", "MISS", "SAVE"]);
  const homeShots = events.filter((e) => e.side === "home" && homeShotTypes.has(e.type)).length;
  const awayShots = events.filter((e) => e.side === "away" && homeShotTypes.has(e.type)).length;
  return {
    home: tallyTeamStats(events, "home", awayShots),
    away: tallyTeamStats(events, "away", homeShots),
  };
}

/** First-half (minute <= 30) and second-half (minute > 30) team stats, each independently reconstructed from the timeline -- their sum equals the match's own final TeamMatchStats by construction (proven in matchEngine.test.ts's HM-MATCH-0.1 invariants). */
export function computeHalfSplit(result: FastMatchResult): { firstHalf: HalfSplit; secondHalf: HalfSplit } {
  return {
    firstHalf: tallyHalf(result, (minute) => minute <= HALF_TIME_MINUTE),
    secondHalf: tallyHalf(result, (minute) => minute > HALF_TIME_MINUTE),
  };
}
