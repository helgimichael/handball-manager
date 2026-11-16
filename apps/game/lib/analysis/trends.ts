// Arena Nights -- ANL-02 A trend dashboard, ANL-03 A mirror comparison, ANL-04 A window-aware tables.
// Pure selectors over ClubMatchStatRow[] (lib/analysis/matchHistory.ts) and the stored match results.
// Every ratio uses lib/analysis/metrics.ts so there is still one formula per metric; a missing
// denominator stays null, never 0.
import type { CareerState } from "../career/types";
import * as metrics from "./metrics";
import type { ClubMatchStatRow } from "./types";

export type TrendMetricId = "GF" | "GA" | "SHOT_PCT" | "SAVE_PCT" | "TURNOVERS" | "TWO_MIN" | "SEVEN_M";
export interface TrendMetric {
  id: TrendMetricId;
  label: string;
  short: string;
  pct: boolean;
  higherIsBetter: boolean;
  /** Aggregate over a set of matches (one match for a single point). */
  of: (rows: readonly ClubMatchStatRow[]) => number | null;
  /** Where a manager acts on it. */
  href: string;
  cta: string;
}

export const TREND_METRICS: readonly TrendMetric[] = [
  { id: "GF", label: "Mål per match", short: "Mål", pct: false, higherIsBetter: true, of: metrics.goalsPerMatch, href: "/career/tactics#plan-attack", cta: "Anfallsplanen" },
  { id: "GA", label: "Insläppta per match", short: "Insläppta", pct: false, higherIsBetter: false, of: metrics.goalsConcededPerMatch, href: "/career/tactics#plan-attack", cta: "Försvarsplanen" },
  { id: "SHOT_PCT", label: "Mål/skott %", short: "Skott %", pct: true, higherIsBetter: true, of: metrics.shootingPct, href: "/career/training", cta: "Avslutsträning" },
  { id: "SAVE_PCT", label: "Räddning %", short: "Räddn. %", pct: true, higherIsBetter: true, of: metrics.savePct, href: "/career/training", cta: "Målvaktsträning" },
  { id: "TURNOVERS", label: "Bollförluster per match", short: "Bollförl.", pct: false, higherIsBetter: false, of: metrics.turnoversPerMatch, href: "/career/training", cta: "Bollbehandling i träningen" },
  { id: "TWO_MIN", label: "Utvisningar per match", short: "2 min", pct: false, higherIsBetter: false, of: metrics.twoMinPerMatch, href: "/career/tactics#plan-attack", cta: "Försvarets aggressivitet" },
  { id: "SEVEN_M", label: "7m-effektivitet", short: "7m %", pct: true, higherIsBetter: true, of: metrics.sevenMetreConversion, href: "/career/tactics#plan-squad", cta: "7-metersskyttar" },
];
export const trendMetric = (id: TrendMetricId) => TREND_METRICS.find((m) => m.id === id)!;

export interface TrendPoint { fixtureId: string; date: string; opponentClubId: string; value: number | null; rolling: number | null }

/** One value per match plus a rolling average over the last `window` matches (fewer at the start of the season). */
export function trendSeries(rows: readonly ClubMatchStatRow[], id: TrendMetricId, window = 3): TrendPoint[] {
  const m = trendMetric(id);
  return rows.map((r, i) => ({ fixtureId: r.fixtureId, date: r.date, opponentClubId: r.opponentClubId, value: m.of([r]), rolling: m.of(rows.slice(Math.max(0, i - window + 1), i + 1)) }));
}

export interface KpiTile { id: TrendMetricId; label: string; pct: boolean; recent: number | null; season: number | null; delta: number | null; better: boolean | null; spark: (number | null)[] }

/** KPI tiles: the last `recentN` matches against the whole season, with a per-match sparkline. */
export function kpiTiles(rows: readonly ClubMatchStatRow[], recentN = 5): KpiTile[] {
  const recent = rows.slice(-recentN);
  return TREND_METRICS.map((m) => {
    const r = m.of(recent), s = m.of(rows);
    const delta = r !== null && s !== null && rows.length > recent.length ? r - s : null;
    return { id: m.id, label: m.label, pct: m.pct, recent: r, season: s, delta, better: delta === null || Math.abs(delta) < 1e-9 ? null : (delta > 0) === m.higherIsBetter, spark: rows.slice(-10).map((row) => m.of([row])) };
  });
}

export interface ChangeCard { id: TrendMetricId; label: string; recent: number; season: number; pct: boolean; relative: number; better: boolean; href: string; cta: string }

/** "Vad har ändrats": the biggest relative changes of the last five against the season (only with a season to compare with). */
export function whatChanged(rows: readonly ClubMatchStatRow[], recentN = 5, limit = 3, threshold = 0.1): ChangeCard[] {
  if (rows.length <= recentN) return [];
  const recent = rows.slice(-recentN);
  const out: ChangeCard[] = [];
  for (const m of TREND_METRICS) {
    const r = m.of(recent), s = m.of(rows);
    if (r === null || s === null || s === 0) continue;
    const relative = (r - s) / Math.abs(s);
    if (Math.abs(relative) < threshold) continue;
    out.push({ id: m.id, label: m.label, recent: r, season: s, pct: m.pct, relative, better: (relative > 0) === m.higherIsBetter, href: m.href, cta: m.cta });
  }
  return out.sort((a, b) => Math.abs(b.relative) - Math.abs(a.relative) || a.id.localeCompare(b.id)).slice(0, limit);
}

// ---------------------------------------------------------------- mirror (ANL-03)
export interface MirrorRow { id: string; label: string; pct: boolean; them: number | null; us: number | null; higherIsBetter: boolean; stronger: "them" | "us" | "even" | null }

const MIRROR: { id: string; label: string; pct: boolean; higherIsBetter: boolean; of: (rows: readonly ClubMatchStatRow[]) => number | null }[] = [
  { id: "GF", label: "Mål / match", pct: false, higherIsBetter: true, of: metrics.goalsPerMatch },
  { id: "SHOTS", label: "Skott / match", pct: false, higherIsBetter: true, of: metrics.shotsPerMatch },
  { id: "SHOT_PCT", label: "Skotteffektivitet", pct: true, higherIsBetter: true, of: metrics.shootingPct },
  { id: "TURNOVERS", label: "Bollförluster / match", pct: false, higherIsBetter: false, of: metrics.turnoversPerMatch },
  { id: "SEVEN_M", label: "7m-effektivitet", pct: true, higherIsBetter: true, of: metrics.sevenMetreConversion },
  { id: "GA", label: "Insläppta / match", pct: false, higherIsBetter: false, of: metrics.goalsConcededPerMatch },
  { id: "SAVE_PCT", label: "Räddningsprocent", pct: true, higherIsBetter: true, of: metrics.savePct },
  { id: "TWO_MIN", label: "Utvisningar / match", pct: false, higherIsBetter: false, of: metrics.twoMinPerMatch },
];

/** Them vs us per metric over the same window, and who is stronger (5 % tolerance counts as even). */
export function mirrorRows(them: readonly ClubMatchStatRow[], us: readonly ClubMatchStatRow[]): MirrorRow[] {
  return MIRROR.map((m) => {
    const t = them.length ? m.of(them) : null, u = us.length ? m.of(us) : null;
    let stronger: MirrorRow["stronger"] = null;
    if (t !== null && u !== null) {
      const scale = Math.max(Math.abs(t), Math.abs(u), 1e-9);
      stronger = Math.abs(t - u) / scale < 0.05 ? "even" : (t > u) === m.higherIsBetter ? "them" : "us";
    }
    return { id: m.id, label: m.label, pct: m.pct, them: t, us: u, higherIsBetter: m.higherIsBetter, stronger };
  });
}

// ---------------------------------------------------------------- window-aware player tables (ANL-04)
export interface WindowPlayerRow { playerId: string; matches: number; starts: number; goals: number; shots: number; saves: number; shotsFaced: number; ratingSum: number; averageRating: number | null }

/** The club's own player contributions summed over exactly the given matches (so the table follows the window toggle). */
export function windowPlayerTotals(state: Pick<CareerState, "results">, rows: readonly ClubMatchStatRow[]): WindowPlayerRow[] {
  const by = new Map<string, WindowPlayerRow>();
  for (const row of rows) {
    const r = state.results[row.fixtureId];
    if (!r) continue;
    for (const c of row.isHome ? r.homePlayerContributions : r.awayPlayerContributions) {
      const p = by.get(c.playerId) ?? { playerId: c.playerId, matches: 0, starts: 0, goals: 0, shots: 0, saves: 0, shotsFaced: 0, ratingSum: 0, averageRating: null };
      p.matches++; p.starts += c.started ? 1 : 0; p.goals += c.goals; p.shots += c.shots; p.saves += c.saves ?? 0; p.shotsFaced += c.shotsFaced ?? 0; p.ratingSum += c.rating;
      by.set(c.playerId, p);
    }
  }
  return [...by.values()].map((p) => ({ ...p, averageRating: p.matches ? p.ratingSum / p.matches : null })).sort((a, b) => b.goals - a.goals || (b.averageRating ?? 0) - (a.averageRating ?? 0) || a.playerId.localeCompare(b.playerId));
}

/** Display: per-match numbers with one decimal, ratios as whole percent. */
export function fmtMetric(value: number | null, pct: boolean): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return pct ? `${Math.round(value * 100)} %` : value.toFixed(1).replace(".", ",");
}
