/**
 * MATCH-EXPERIENCE-2.0 M16: the match bench.
 *
 * The permanent version of the throwaway harness M13's calibration was measured
 * with. Its whole purpose is one sentence:
 *
 *   change the engine -> run the same deterministic bench -> compare
 *
 * DELIBERATELY SMALL. No dashboard, no database, no stored history, no CI
 * matrix. It is a function that plays a fixed list of seeds and returns
 * numbers, plus a formatter that prints them. A developer runs it before and
 * after a change and reads the two outputs side by side. Anything more would be
 * a second product to maintain.
 *
 * IT MEASURES, IT NEVER DECIDES. Nothing here can influence a match: it plays
 * matches through the ordinary `simulateMatch` and then counts what came out.
 * Deleting this whole directory would change no scoreline.
 *
 * THE COUNTING IS M15'S. Every match fact it reports comes from the canonical
 * event stream rather than from a second derivation of segments and outcomes.
 * That is the point of having a canonical layer: the bench, the career adapter
 * and any future analytics all count the same events the same way, so a bench
 * number and a career number can never disagree about what happened.
 */
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulateMatch, type MatchResult, type SimulateMatchOptions } from "../simulation/matchRunner";
import { autonomousCoach } from "../simulation/coach";
import { buildCanonicalMatchEvents, eventsOfType, type CanonicalMatchEvent } from "../simulation/canonicalEvents";
import type { FullCourtMatchState } from "../domain/match/possession";

/**
 * The bench's own seed set. Explicit and fixed: a bench whose seeds moved
 * between runs would compare two different questions.
 *
 * Twenty-four is enough to expose a systematic shift without turning a bench
 * run into a long job. Change it only deliberately, and say so when you do --
 * numbers from a different seed set are not comparable with numbers from this
 * one.
 */
export const DEFAULT_BENCH_SEEDS: readonly number[] = Object.freeze([
  1, 3, 5, 7, 11, 12, 17, 23, 29, 33, 41, 47, 53, 59, 61, 71, 77, 83, 89, 97, 101, 103, 107, 109,
]);

export type BenchConfig = {
  readonly seeds?: readonly number[];
  /** The state every match starts from. Defaults to the canonical full-court 6v6. */
  readonly initialState?: FullCourtMatchState;
  /** Whether both benches have M12's automatic coach. On by default: that is how a match ships. */
  readonly coached?: boolean;
  /** Anything else a caller wants to hold fixed -- ratings, instructions, a real bench. */
  readonly options?: Omit<SimulateMatchOptions, "coaches">;
};

/** What one match contributed. Every field is a count, not a rate. */
export type BenchMatchRow = {
  readonly seed: number;
  readonly possessions: number;
  readonly segments: number;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly goals: number;
  readonly shots: number;
  readonly onTarget: number;
  readonly saves: number;
  readonly missed: number;
  readonly blocked: number;
  readonly turnovers: number;
  readonly sevenMetreAttempts: number;
  readonly sevenMetreGoals: number;
  readonly freeThrows: number;
  readonly suspensions: number;
  /**
   * M18: where the contact happened.
   *
   * Bench-only, and read from the segment each foul belongs to -- a segment
   * already knows whether it was an organized possession, a transition or a
   * restart, so nothing has to be added to the canonical event stream to
   * measure this. M13 found that essentially every foul in a match came from
   * the break, and this is how that is watched.
   */
  /** M18: contact episodes in organized play -- the opportunity count. */
  readonly organizedContacts: number;
  /** M19: how many of those episodes were put to a decision. */
  readonly organizedContactsResolved: number;
  readonly organizedFouls: number;
  readonly organizedFreeThrows: number;
  readonly organizedSevenMetres: number;
  readonly organizedTwoMinutes: number;
  readonly transitionFouls: number;
  readonly transitionFreeThrows: number;
  readonly transitionSevenMetres: number;
  readonly transitionTwoMinutes: number;
  readonly substitutions: number;
  readonly timeouts: number;
  readonly interventions: number;
  readonly simulationSeconds: number;
};

/** A distribution, not just an average -- a mean alone hides the thing you are usually looking for. */
export type BenchDistribution = {
  readonly mean: number;
  readonly min: number;
  readonly p25: number;
  readonly median: number;
  readonly p75: number;
  readonly max: number;
};

export type BenchReport = {
  readonly seeds: readonly number[];
  readonly rows: readonly BenchMatchRow[];
  readonly counts: Readonly<Record<CountedMetric, BenchDistribution>>;
  readonly rates: {
    /** Goals per possession. */
    readonly goalsPerPossession: number;
    /** Goals per shot, blocked attempts included -- the career's own convention. */
    readonly shotConversion: number;
    /** Saves as a share of shots that reached the goal. */
    readonly goalkeeperSaveRate: number;
    readonly shotsPerPossession: number;
    readonly turnoverRate: number;
  };
  readonly symmetry: {
    readonly homeGoals: number;
    readonly awayGoals: number;
    /** Share of all goals scored by the home side. 0.5 is balanced. */
    readonly homeShare: number;
  };
};

const COUNTED_METRICS = [
  "possessions",
  "segments",
  "goals",
  "shots",
  "onTarget",
  "saves",
  "missed",
  "blocked",
  "turnovers",
  "sevenMetreAttempts",
  "sevenMetreGoals",
  "freeThrows",
  "suspensions",
  "organizedContacts",
  "organizedContactsResolved",
  "organizedFouls",
  "organizedFreeThrows",
  "organizedSevenMetres",
  "organizedTwoMinutes",
  "transitionFouls",
  "transitionFreeThrows",
  "transitionSevenMetres",
  "transitionTwoMinutes",
  "substitutions",
  "timeouts",
  "interventions",
  "simulationSeconds",
] as const;
export type CountedMetric = (typeof COUNTED_METRICS)[number];

function distribution(values: readonly number[]): BenchDistribution {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
  return {
    mean: sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length),
    min: at(0),
    p25: at(0.25),
    median: at(0.5),
    p75: at(0.75),
    max: at(1),
  };
}

/**
 * One match's numbers, counted from its canonical events.
 *
 * The only things NOT read from events are possession and segment counts, which
 * are structural properties of the run rather than facts that happened in it,
 * and the simulated seconds the match consumed.
 */
export function measureMatch(seed: number, match: MatchResult, events: readonly CanonicalMatchEvent[]): BenchMatchRow {
  const shots = eventsOfType(events, "SHOT");
  const goals = eventsOfType(events, "GOAL");
  const sevenMetres = shots.filter((s) => s.sevenMetre);
  const interventions = match.segments.flatMap((s) => s.interventions);
  // A TRANSITION segment is the break; everything else -- an organized
  // possession, a centre restart, a free-throw continuation -- is set play.
  const foulsIn = (fromBreak: boolean) =>
    match.segments.filter((s) => (s.kind === "TRANSITION") === fromBreak).flatMap((s) => s.fouls);
  const organized = foulsIn(false);
  const transition = foulsIn(true);
  return {
    seed,
    possessions: match.totalPossessions,
    segments: match.totalSegments,
    homeGoals: goals.filter((g) => g.teamId === "HOME").length,
    awayGoals: goals.filter((g) => g.teamId === "AWAY").length,
    goals: goals.length,
    shots: shots.length,
    onTarget: shots.filter((s) => s.outcome === "GOAL" || s.outcome === "SAVED").length,
    saves: shots.filter((s) => s.outcome === "SAVED").length,
    missed: shots.filter((s) => s.outcome === "MISSED").length,
    blocked: shots.filter((s) => s.outcome === "BLOCKED").length,
    turnovers: eventsOfType(events, "TURNOVER").length,
    sevenMetreAttempts: sevenMetres.length,
    sevenMetreGoals: sevenMetres.filter((s) => s.outcome === "GOAL").length,
    freeThrows: eventsOfType(events, "FOUL").filter((f) => f.restart === "FREE_THROW").length,
    suspensions: eventsOfType(events, "SUSPENSION").length,
    organizedContacts: match.segments.reduce((n, s) => n + (s.kind === "TRANSITION" ? 0 : s.contacts), 0),
    organizedContactsResolved: match.segments.reduce((n, s) => n + (s.kind === "TRANSITION" ? 0 : s.resolvedContacts), 0),
    organizedFouls: organized.length,
    organizedFreeThrows: organized.filter((f) => f.restart === "FREE_THROW").length,
    organizedSevenMetres: organized.filter((f) => f.restart === "SEVEN_METRE").length,
    organizedTwoMinutes: organized.filter((f) => f.suspend).length,
    transitionFouls: transition.length,
    transitionFreeThrows: transition.filter((f) => f.restart === "FREE_THROW").length,
    transitionSevenMetres: transition.filter((f) => f.restart === "SEVEN_METRE").length,
    transitionTwoMinutes: transition.filter((f) => f.suspend).length,
    substitutions: eventsOfType(events, "SUBSTITUTION_COMPLETED").length,
    timeouts: eventsOfType(events, "TIMEOUT_STARTED").length,
    interventions: interventions.length,
    simulationSeconds: Math.round(match.simulationSeconds * 10) / 10,
  };
}

/**
 * Plays the seed set and reports what came out.
 *
 * Deterministic by construction: fixed seeds, a fixed starting state, no wall
 * clock, and coaches that draw no random numbers of their own. The same config
 * always produces byte-identical output.
 */
export function runMatchBench(config: BenchConfig = {}): BenchReport {
  const seeds = config.seeds ?? DEFAULT_BENCH_SEEDS;
  const initialState = config.initialState ?? createFullCourt6v6State({ attackingGoalSide: "TOP" });
  const coached = config.coached ?? true;

  const rows = seeds.map((seed) => {
    const match = simulateMatch(initialState, seed, {
      ...config.options,
      ...(coached ? { coaches: { HOME: autonomousCoach(), AWAY: autonomousCoach() } } : {}),
    });
    return measureMatch(seed, match, buildCanonicalMatchEvents(match));
  });

  const total = (key: CountedMetric | "homeGoals" | "awayGoals") => rows.reduce((sum, row) => sum + row[key], 0);
  const counts = Object.fromEntries(COUNTED_METRICS.map((key) => [key, distribution(rows.map((r) => r[key]))])) as Record<
    CountedMetric,
    BenchDistribution
  >;
  const safe = (numerator: number, denominator: number) => (denominator === 0 ? 0 : numerator / denominator);

  return {
    seeds,
    rows,
    counts,
    rates: {
      goalsPerPossession: safe(total("goals"), total("possessions")),
      shotConversion: safe(total("goals"), total("shots")),
      goalkeeperSaveRate: safe(total("saves"), total("onTarget")),
      shotsPerPossession: safe(total("shots"), total("possessions")),
      turnoverRate: safe(total("turnovers"), total("possessions")),
    },
    symmetry: {
      homeGoals: total("homeGoals"),
      awayGoals: total("awayGoals"),
      homeShare: safe(total("homeGoals"), total("homeGoals") + total("awayGoals")),
    },
  };
}

// ---------------------------------------------------------------------------
// Printing it
// ---------------------------------------------------------------------------

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function line(d: BenchDistribution): string {
  return `${d.mean.toFixed(1).padStart(7)}   [min ${d.min.toFixed(1)} | p25 ${d.p25.toFixed(1)} | med ${d.median.toFixed(1)} | p75 ${d.p75.toFixed(1)} | max ${d.max.toFixed(1)}]`;
}

/**
 * The report as text, for reading two runs side by side.
 *
 * Stable output for a stable report: the same numbers always format the same
 * way, so a diff of two bench runs shows only what actually moved.
 */
export function formatBenchReport(report: BenchReport): string {
  const out: string[] = [];
  out.push(`match bench: ${report.seeds.length} deterministic matches (seeds ${report.seeds.join(", ")})`);
  out.push("");
  out.push("COUNTS PER MATCH");
  for (const key of COUNTED_METRICS) out.push(`  ${pad(key, 20)}${line(report.counts[key])}`);
  out.push("");
  out.push("RATES");
  out.push(`  ${pad("goals/possession", 20)}${(report.rates.goalsPerPossession * 100).toFixed(1)}%`);
  out.push(`  ${pad("shot conversion", 20)}${(report.rates.shotConversion * 100).toFixed(1)}%`);
  out.push(`  ${pad("GK save rate", 20)}${(report.rates.goalkeeperSaveRate * 100).toFixed(1)}%`);
  out.push(`  ${pad("shots/possession", 20)}${report.rates.shotsPerPossession.toFixed(2)}`);
  out.push(`  ${pad("turnover rate", 20)}${(report.rates.turnoverRate * 100).toFixed(1)}%`);
  out.push("");
  out.push("FOUL ORIGIN");
  const episodes = report.counts.organizedContacts.mean;
  const perEpisode = episodes === 0 ? 0 : (report.counts.organizedFouls.mean / episodes) * 100;
  out.push(`  organized contact episodes  ${episodes.toFixed(1)}  (resolved ${report.counts.organizedContactsResolved.mean.toFixed(1)})`);
  out.push(`  organized fouls / episode   ${perEpisode.toFixed(1)}%`);
  const share = (a: number, b: number) => (a + b === 0 ? 0 : (a / (a + b)) * 100);
  out.push(
    `  organized/transition fouls ${report.counts.organizedFouls.mean.toFixed(1)} / ${report.counts.transitionFouls.mean.toFixed(1)}  (${share(report.counts.organizedFouls.mean, report.counts.transitionFouls.mean).toFixed(1)}% organized)`,
  );
  out.push(`  organized free throws / 7m / 2min  ${report.counts.organizedFreeThrows.mean.toFixed(1)} / ${report.counts.organizedSevenMetres.mean.toFixed(1)} / ${report.counts.organizedTwoMinutes.mean.toFixed(1)}`);
  out.push(`  transition free throws / 7m / 2min ${report.counts.transitionFreeThrows.mean.toFixed(1)} / ${report.counts.transitionSevenMetres.mean.toFixed(1)} / ${report.counts.transitionTwoMinutes.mean.toFixed(1)}`);
  out.push("");
  out.push("SYMMETRY");
  out.push(`  home/away goals     ${report.symmetry.homeGoals} / ${report.symmetry.awayGoals}  (${(report.symmetry.homeShare * 100).toFixed(1)}% home)`);
  out.push("");
  out.push("SCORELINES");
  out.push(`  ${report.rows.map((r) => `${r.seed}:${r.homeGoals}-${r.awayGoals}`).join("  ")}`);
  return out.join("\n");
}
