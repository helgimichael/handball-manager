// Arena Nights -- SQD-02j (A) "Heat matrix" + SQD-02c attributes & development workspace + SQD-02d curve.
// Pure presentation model for the manager's OWN players' 1-20 attributes (external players never reach this
// model -- they keep the knowledge-gated views). Deltas come from the stored development history
// (playerDevelopmentState.developmentHistory, bounded); nothing is recomputed or invented.
import type { CareerState } from "../career/types";
import { getCareerSquad } from "../career/careerWorld";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { GOALKEEPER_ATTRIBUTE_FAMILIES, OUTCOURT_ATTRIBUTE_FAMILIES } from "../rating/types";
import { getAttributeFamilyLabel, getAttributeLabel } from "../rating/attributeVocabulary";
import { addDays } from "../career/dateUtils";

export type AttributeTier = "elite" | "strong" | "solid" | "weak";
/** Same thresholds the old panel used (>=15, >=12, >=9, else) -- now a token ramp instead of hard-coded colours. */
export function attributeTier(value: number): AttributeTier {
  return value >= 15 ? "elite" : value >= 12 ? "strong" : value >= 9 ? "solid" : "weak";
}
export const ATTRIBUTE_TIER_LABEL_SV: Record<AttributeTier, string> = { elite: "15–20 Spetsklass", strong: "12–14 Stark", solid: "9–11 Godkänd", weak: "1–8 Svag" };

/** Role-relevant attributes per position (same list the compare page highlights). */
export const ROLE_RELEVANT_ATTRIBUTES: Record<string, readonly string[]> = {
  MV: ["GK_POSITIONING", "REACTION", "LOW_SAVES", "HIGH_SAVES", "ONE_ON_ONE", "OUTLET_PASSING"],
  V6: ["FINISHING", "SHOOTING_PLACEMENT", "TOP_SPEED", "ACCELERATION", "GAME_READING", "DEFENSIVE_POSITIONING"],
  H6: ["FINISHING", "SHOOTING_PLACEMENT", "TOP_SPEED", "ACCELERATION", "GAME_READING", "DEFENSIVE_POSITIONING"],
  M6: ["FINISHING", "BALL_HANDLING", "CONTACT_ABILITY", "STRENGTH", "DEFENSIVE_POSITIONING", "GAME_READING"],
  M9: ["PASSING", "GAME_READING", "DECISION_MAKING", "BREAKTHROUGH", "BALL_HANDLING", "DEFENSIVE_POSITIONING"],
  V9: ["SHOOTING_POWER", "SHOOTING_PLACEMENT", "BREAKTHROUGH", "PASSING", "DECISION_MAKING", "CONTACT_ABILITY"],
  H9: ["SHOOTING_POWER", "SHOOTING_PLACEMENT", "BREAKTHROUGH", "PASSING", "DECISION_MAKING", "CONTACT_ABILITY"],
};

export interface AttributeEvent { date: string; attribute: string; from: number; to: number; source: string }
export interface AttributeTile {
  key: string; label: string; value: number; tier: AttributeTier;
  /** Net change over the last 30 days from stored development events (0 when none). */
  delta: number;
  relevant: boolean;
  origin: string | null;
  /** Overlay value (another own player or the squad average); null without an overlay. */
  compare: number | null;
}
export interface AttributeFamilyColumn { key: string; label: string; avg: number; compareAvg: number | null; tiles: AttributeTile[] }
export interface AttributeMatrix { goalkeeper: boolean; families: AttributeFamilyColumn[]; deltaWindow: { from: string; to: string }; changedCount: number }

type Attrs = Record<string, { value: number; origin?: string } | undefined>;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildAttributeMatrix(input: {
  branch: "OUTCOURT" | "GOALKEEPER"; attributes: Attrs; position: string; events: readonly AttributeEvent[]; gameDate: string;
  compare?: Record<string, number> | null;
}): AttributeMatrix {
  const goalkeeper = input.branch === "GOALKEEPER";
  const fam = (goalkeeper ? GOALKEEPER_ATTRIBUTE_FAMILIES : OUTCOURT_ATTRIBUTE_FAMILIES) as Record<string, readonly string[]>;
  const from = addDays(input.gameDate, -30);
  const recent = input.events.filter((e) => e.date > from && e.date <= input.gameDate);
  const delta = new Map<string, number>();
  for (const e of recent) delta.set(e.attribute, (delta.get(e.attribute) ?? 0) + (e.to - e.from));
  const relevant = new Set(ROLE_RELEVANT_ATTRIBUTES[goalkeeper ? "MV" : input.position] ?? []);
  const families = Object.entries(fam).map(([key, list]): AttributeFamilyColumn => {
    const tiles = list.filter((a) => typeof input.attributes[a]?.value === "number").map((a): AttributeTile => {
      const v = input.attributes[a]!.value;
      return { key: a, label: getAttributeLabel(a as never), value: v, tier: attributeTier(v), delta: delta.get(a) ?? 0, relevant: relevant.has(a), origin: input.attributes[a]!.origin ?? null, compare: input.compare ? input.compare[a] ?? null : null };
    });
    const avg = tiles.length ? round1(tiles.reduce((s, t) => s + t.value, 0) / tiles.length) : 0;
    const cmp = tiles.map((t) => t.compare).filter((v): v is number => v != null);
    return { key, label: getAttributeFamilyLabel(key as never), avg, compareAvg: input.compare && cmp.length ? round1(cmp.reduce((s, v) => s + v, 0) / cmp.length) : null, tiles };
  });
  return { goalkeeper, families, deltaWindow: { from, to: input.gameDate }, changedCount: [...delta.values()].filter((d) => d !== 0).length };
}

/** Own-squad average per attribute for the same branch (own players only -- never external ratings). */
export function squadAttributeAverage(state: CareerState, branch: "OUTCOURT" | "GOALKEEPER", excludeId?: string): Record<string, number> {
  const sums = new Map<string, { s: number; n: number }>();
  for (const p of getCareerSquad(state)) {
    if (p.id === excludeId) continue;
    const r = getCareerPlayerRating(state, p.id, p.clubId);
    if (!r || r.branch.branch !== branch) continue;
    for (const [k, e] of Object.entries(r.branch.attributes as Attrs)) {
      if (typeof e?.value !== "number") continue;
      const cur = sums.get(k) ?? { s: 0, n: 0 };
      cur.s += e.value; cur.n += 1; sums.set(k, cur);
    }
  }
  return Object.fromEntries([...sums].map(([k, { s, n }]) => [k, round1(s / n)]));
}

/** Another OWN player's attributes for the compare overlay (undefined for anyone outside the squad). */
export function ownPlayerAttributes(state: CareerState, playerId: string): Record<string, number> | undefined {
  const p = getCareerSquad(state).find((x) => x.id === playerId);
  if (!p) return undefined;
  const r = getCareerPlayerRating(state, p.id, p.clubId);
  if (!r) return undefined;
  return Object.fromEntries(Object.entries(r.branch.attributes as Attrs).filter(([, e]) => typeof e?.value === "number").map(([k, e]) => [k, e!.value]));
}

// ---------------------------------------------------------------- SQD-02d development curve (non-numeric)
export interface DevelopmentCurvePoint { date: string; /** cumulative net attribute change up to this date */ net: number; up: boolean; label: string; attribute: string; from: number; to: number; source: string }
/**
 * The development curve: the running sum of stored attribute changes over time, so the shape (rising, flat,
 * falling) is visible without exposing any ability number. Events are sorted by date.
 */
export function developmentCurve(events: readonly AttributeEvent[]): DevelopmentCurvePoint[] {
  let net = 0;
  return [...events].sort((a, b) => a.date.localeCompare(b.date)).map((e) => {
    net += e.to - e.from;
    return { date: e.date, net, up: e.to >= e.from, label: getAttributeLabel(e.attribute as never), attribute: e.attribute, from: e.from, to: e.to, source: e.source };
  });
}
