// Scoring-run detection (HM-ANALYSIS-0.1, Spec §11/S16).
//
// A run is consecutive GOAL events by the same side before the other
// side scores. This is a presentation rule over the real timeline, not
// a claim of tactical momentum (Spec §11: "do not automatically call
// this momentum").
import type { MatchEvent } from "@handball-manager/game-simulation";
import { SCORING_RUN_THRESHOLD } from "./calibration";

export interface ScoringRun {
  side: "home" | "away";
  startMinute: number;
  endMinute: number;
  goals: number;
  /** The score immediately after the run's last goal. */
  scoreAfter: { home: number; away: number };
}

/** Detects every run of >= SCORING_RUN_THRESHOLD consecutive goals by one side, in chronological order. Deterministic: only reads `type === "GOAL"` events in the order they already appear in the timeline. */
export function detectScoringRuns(events: readonly MatchEvent[]): ScoringRun[] {
  const goals = events.filter((e) => e.type === "GOAL").sort((a, b) => a.minute - b.minute);
  const runs: ScoringRun[] = [];

  let current: MatchEvent[] = [];
  const flush = () => {
    if (current.length >= SCORING_RUN_THRESHOLD) {
      const first = current[0];
      const last = current[current.length - 1];
      runs.push({
        side: first.side,
        startMinute: first.minute,
        endMinute: last.minute,
        goals: current.length,
        scoreAfter: { home: last.homeScoreAfter ?? 0, away: last.awayScoreAfter ?? 0 },
      });
    }
    current = [];
  };

  for (const goal of goals) {
    if (current.length === 0 || current[current.length - 1].side === goal.side) {
      current.push(goal);
    } else {
      flush();
      current.push(goal);
    }
  }
  flush();

  return runs;
}
