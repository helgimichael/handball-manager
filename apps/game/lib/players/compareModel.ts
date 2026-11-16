// Arena Nights -- SQD-04 (A) "Head-to-head with delta bars". Pure, read-only comparison model.
// Each row carries both sides' values; a numeric delta (and a "better" side) is only produced when both
// sides are comparable numbers -- season stats always, 1-20 attributes only own-vs-own. External players'
// ability / potential / value are knowledge-gated RANGES (careerPlayerVisibility / resolveMarketValueRange);
// true CA/PA and raw attributes of external players never enter this model.
import type { CareerState } from "../career/types";
import type { PlayerMock } from "../game-data";
import { getCareerSquad } from "../career/careerWorld";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { averageRating, emptyPlayerSeasonStats } from "../career/types";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getPlayerMarketValueEur } from "../economy/contractIntegration";
import { getPlayerKnowledgePct } from "../knowledge/knowledgeIntegration";
import { careerPlayerVisibility } from "../knowledge/careerVisibility";
import { resolveMarketValueRange } from "../knowledge/scoutReportVisibility";
import type { StarRange } from "../knowledge/playerVisibility";

/** Role-relevant attributes per position (moved from the compare page). */
export const ROLE_ATTRIBUTES: Record<string, string[]> = {
  MV: ["GK_POSITIONING", "REACTION", "LOW_SAVES", "HIGH_SAVES", "ONE_ON_ONE", "OUTLET_PASSING"],
  V6: ["FINISHING", "SHOOTING_PLACEMENT", "TOP_SPEED", "ACCELERATION", "GAME_READING", "DEFENSIVE_POSITIONING"],
  H6: ["FINISHING", "SHOOTING_PLACEMENT", "TOP_SPEED", "ACCELERATION", "GAME_READING", "DEFENSIVE_POSITIONING"],
  M6: ["FINISHING", "BALL_HANDLING", "CONTACT_ABILITY", "STRENGTH", "DEFENSIVE_POSITIONING", "GAME_READING"],
  M9: ["PASSING", "GAME_READING", "DECISION_MAKING", "BREAKTHROUGH", "BALL_HANDLING", "DEFENSIVE_POSITIONING"],
  V9: ["SHOOTING_POWER", "SHOOTING_PLACEMENT", "BREAKTHROUGH", "PASSING", "DECISION_MAKING", "CONTACT_ABILITY"],
  H9: ["SHOOTING_POWER", "SHOOTING_PLACEMENT", "BREAKTHROUGH", "PASSING", "DECISION_MAKING", "CONTACT_ABILITY"],
};

export interface CompareSide {
  kind: "PLAYER" | "SQUAD_AVG";
  player: PlayerMock | null;
  own: boolean;
  label: string;
  knowledge: number;
  ability: StarRange | null;
  potential: StarRange | null;
  value: { min: number; max: number } | null;
  /** Numeric metrics (stats; attributes only for own players / squad average). */
  metrics: Record<string, number | null>;
}

export type CompareCell = { kind: "num"; value: number | null } | { kind: "range"; value: StarRange | null } | { kind: "money"; value: { min: number; max: number } | null };
export interface CompareRow {
  key: string;
  label: string;
  group: "Bedömning" | "Prestation" | "Egenskaper";
  left: CompareCell;
  right: CompareCell;
  /** right - left, only when both sides are comparable numbers. */
  delta: number | null;
  /** Which side is better (higher is better for every compared metric), or null. */
  better: "left" | "right" | null;
  /** Scale for the delta bar (max absolute delta that fills half the bar). */
  scale: number;
  unit?: string;
}

const STAT_ROWS: { key: string; label: string; scale: number; unit?: string; gkOnly?: boolean; outOnly?: boolean }[] = [
  { key: "appearances", label: "Matcher", scale: 20 },
  { key: "starts", label: "Starter", scale: 20 },
  { key: "goals", label: "Mål", scale: 60, outOnly: true },
  { key: "goalsPerMatch", label: "Mål / match", scale: 5, outOnly: true },
  { key: "shotPct", label: "Skotteffektivitet", scale: 40, unit: "%", outOnly: true },
  { key: "savePct", label: "Räddningsprocent", scale: 30, unit: "%", gkOnly: true },
  { key: "avgRating", label: "Snittbetyg", scale: 3 },
];

function round1(n: number) { return Math.round(n * 10) / 10; }

function statMetrics(state: CareerState, playerId: string): Record<string, number | null> {
  const s = state.playerSeasonStats[playerId] ?? emptyPlayerSeasonStats(playerId);
  return {
    appearances: s.appearances, starts: s.starts, goals: s.goals,
    goalsPerMatch: s.appearances ? round1(s.goals / s.appearances) : null,
    shotPct: s.shots ? Math.round((s.goals / s.shots) * 100) : null,
    savePct: s.shotsFaced ? Math.round((s.saves / s.shotsFaced) * 100) : null,
    avgRating: s.appearances ? round1(averageRating(s)) : null,
  };
}

export function buildCompareSide(state: CareerState, player: PlayerMock): CompareSide {
  const own = player.clubId === state.playerClubId;
  const rating = getCareerPlayerRating(state, player.id, player.clubId);
  const knowledge = own ? 100 : getPlayerKnowledgePct(state, player.id, player.clubId);
  const metrics = statMetrics(state, player.id);
  let ability: StarRange | null = null, potential: StarRange | null = null;
  if (rating) {
    const vis = careerPlayerVisibility(state, rating, player.id, knowledge);
    ability = vis.abilityRange; potential = vis.potentialRange;
    if (own) for (const [k, a] of Object.entries(rating.branch.attributes as Record<string, { value: number }>)) metrics[`attr:${k}`] = a.value;
  }
  const trueValue = getPlayerMarketValueEur(state, player.id);
  const value = trueValue === undefined ? null : own ? { min: trueValue, max: trueValue } : resolveMarketValueRange(trueValue, knowledge, player.id);
  return { kind: "PLAYER", player, own, label: `${player.firstName} ${player.lastName}`, knowledge: Math.round(knowledge), ability, potential, value, metrics };
}

/** The own squad's average (stats for players with appearances; attributes from own ratings), optionally for one position. */
export function buildSquadAverageSide(state: CareerState, position?: string): CompareSide {
  const squad = getCareerSquad(state).filter((p) => !position || p.position === position);
  const sums = new Map<string, { s: number; n: number }>();
  for (const p of squad) {
    const side = buildCompareSide(state, p);
    const played = (state.playerSeasonStats[p.id]?.appearances ?? 0) > 0;
    for (const [k, v] of Object.entries(side.metrics)) {
      if (v == null || (!played && !k.startsWith("attr:"))) continue;
      const cur = sums.get(k) ?? { s: 0, n: 0 };
      cur.s += v; cur.n++; sums.set(k, cur);
    }
  }
  const metrics: Record<string, number | null> = {};
  for (const [k, { s, n }] of sums) metrics[k] = n ? round1(s / n) : null;
  return { kind: "SQUAD_AVG", player: null, own: true, label: position ? `Truppsnitt ${position}` : "Truppsnitt", knowledge: 100, ability: null, potential: null, value: null, metrics };
}

function numRow(key: string, label: string, group: CompareRow["group"], l: number | null | undefined, r: number | null | undefined, scale: number, unit?: string): CompareRow {
  const left = l ?? null, right = r ?? null;
  const delta = left != null && right != null ? round1(right - left) : null;
  return { key, label, group, left: { kind: "num", value: left }, right: { kind: "num", value: right }, delta, better: delta == null || delta === 0 ? null : delta > 0 ? "right" : "left", scale, unit };
}

/**
 * Comparison rows. Attribute rows are produced for the union of both positions' role attributes; their
 * values are only present for own players / the squad average, so an external side yields no delta.
 */
export function buildCompareRows(left: CompareSide | null, right: CompareSide | null, attributeLabel: (key: string) => string): CompareRow[] {
  const rows: CompareRow[] = [];
  const rangeRow = (key: string, label: string, l: StarRange | null, r: StarRange | null): CompareRow => {
    // Ranges only compare when they do not overlap -- otherwise the knowledge says "too close to call".
    const better = l && r ? (r.min > l.max ? "right" : l.min > r.max ? "left" : null) : null;
    return { key, label, group: "Bedömning", left: { kind: "range", value: l }, right: { kind: "range", value: r }, delta: null, better, scale: 1 };
  };
  if (left?.kind === "PLAYER" || right?.kind === "PLAYER") {
    rows.push(rangeRow("ability", "Bedömd nivå", left?.ability ?? null, right?.ability ?? null));
    rows.push(rangeRow("potential", "Bedömd potential", left?.potential ?? null, right?.potential ?? null));
    const lv = left?.value ?? null, rv = right?.value ?? null;
    rows.push({ key: "value", label: "Marknadsvärde", group: "Bedömning", left: { kind: "money", value: lv }, right: { kind: "money", value: rv }, delta: null, better: null, scale: 1 });
  }
  const positions = [left?.player?.position, right?.player?.position].filter(Boolean) as string[];
  const gk = positions.length > 0 && positions.every((p) => p === "MV");
  const out = positions.length > 0 && positions.every((p) => p !== "MV");
  for (const s of STAT_ROWS) {
    if ((s.gkOnly && out) || (s.outOnly && gk)) continue;
    rows.push(numRow(s.key, s.label, "Prestation", left?.metrics[s.key], right?.metrics[s.key], s.scale, s.unit));
  }
  const keys = [...new Set(positions.flatMap((p) => ROLE_ATTRIBUTES[p] ?? []))];
  for (const k of keys) rows.push(numRow(`attr:${k}`, attributeLabel(k), "Egenskaper", left?.metrics[`attr:${k}`], right?.metrics[`attr:${k}`], 10));
  return rows;
}

/** Delta bar geometry: centre axis at 50 %, bar grows right (right side better) or left; clamped to the half. */
export function deltaBar(delta: number | null, scale: number): { left: number; width: number; dir: "left" | "right" | "none" } {
  if (delta == null || delta === 0 || scale <= 0) return { left: 50, width: 0, dir: "none" };
  const w = Math.min(50, (Math.abs(delta) / scale) * 50);
  return delta > 0 ? { left: 50, width: round1(w), dir: "right" } : { left: round1(50 - w), width: round1(w), dir: "left" };
}

export type CompareSortMode = "DEFAULT" | "DELTA";
export function sortCompareRows(rows: readonly CompareRow[], mode: CompareSortMode): CompareRow[] {
  if (mode === "DEFAULT") return [...rows];
  const score = (r: CompareRow) => (r.delta == null ? -1 : Math.abs(r.delta) / r.scale);
  return [...rows].sort((a, b) => score(b) - score(a));
}

/** Searchable picker matches (own squad first). */
export function searchPlayers(players: readonly PlayerMock[], ownClubId: string, query: string, clubName: (id: string) => string, limit = 12): PlayerMock[] {
  const term = query.trim().toLocaleLowerCase("sv");
  return players
    .filter((p) => !term || `${p.firstName} ${p.lastName} ${p.position} ${p.clubId ? clubName(p.clubId) : "fri agent"}`.toLocaleLowerCase("sv").includes(term))
    .sort((a, b) => Number(b.clubId === ownClubId) - Number(a.clubId === ownClubId) || a.lastName.localeCompare(b.lastName, "sv"))
    .slice(0, limit);
}

export function ageOf(state: CareerState, p: PlayerMock): number | null { return playerAgeAtDate(p.dateOfBirth, p.birthYear, state.gameDate); }
