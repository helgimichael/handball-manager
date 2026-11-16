// Arena Nights Phase 2 completion -- pure helpers for the remaining tactics-board recommendations
// (TRN-02a guard preview, TRN-02e overlay legend, TRN-02f trade-off lines, TRN-02g 7 m statistics,
// TRN-02i bench strip). Read-only: they describe or diff existing plans and results; every write still
// goes through the existing match-plan operations. Trade-off sentences paraphrase what the native V2
// engine actually does with each instruction (packages/handball-engine/src/v2/core: defence.ts AGGRESSION,
// coaching.ts TEMPO_PROFILES / ROTATION_PROFILES / sevenVSixWanted, engage.ts attackIdentity preferences).
import type { CareerState } from "../career/types";
import type { MatchPlan } from "./types";
import type { PlayerMock } from "../game-data";
import { readinessSummary } from "../training/readinessSummary";
import { isSelectableForMatch } from "../career/playerStatus";
import { careerArchiveSummaries } from "../career/matchArchiveSummary";

// ---------------------------------------------------------------- TRN-02f trade-off lines
export const COACHING_TRADEOFFS = {
  defence: {
    "6:0": "Sex försvarare i linjen vid sex meter, var och en i sin zon.",
    "5:1": "En framskjuten spets möter bakspelarna högre upp; fem försvarar linjen bakom honom.",
  },
  aggression: {
    LOW: "Linjen stannar nära hemma: sparar ben, men skytten får stå friare på distans.",
    BALANCED: "Lagets kalibrerade linje: klivet ut och hjälpen följer hotet.",
    HIGH: "Försvaret kliver ut tidigare och längre och hjälper mer: närmare bollen, fler löpmeter och ytor bakom.",
  },
  tempo: {
    SLOW: "Bollhållaren läser längre och återvinner hellre bollen; omställningar trycks mindre.",
    BALANCED: "Lagets vanliga rytm i anfallet.",
    QUICK: "Bollhållaren spelar tidigare, utnyttjar ett övertag direkt och trycker på i omställning. Snabbhet och precision är spelarnas egna.",
  },
  attack: {
    BALANCED: "Ingen särskild preferens: spelarna väljer bland alla lägen.",
    COMBINATION: "Söker frispelade passningar och finter före egna avslut.",
    WIDTH: "Söker kanterna och växlar spelet över planen.",
    DIRECT: "Söker avslut och anfall mot luckor; återvinner bollen mer sällan.",
  },
  rotation: {
    SHORT: "Assistenten byter först när en spelare är under 50 % energi och väljer den starkare ersättaren.",
    BALANCED: "Assistenten byter under 62 % energi och väljer den piggare ersättaren.",
    WIDE: "Assistenten byter redan under 72 % energi och väljer den piggare ersättaren.",
  },
  sevenVSix: {
    OFF: "Målvakten står kvar i målet i varje anfall.",
    SITUATIONAL: "Sjunde utespelare i etablerat anfall sent i matchen vid underläge, eller när motståndaren har fler på planen. Målet står tomt.",
    ALWAYS: "Sjunde utespelare i varje etablerat anfall. Målet står tomt vid bollförlust.",
  },
} as const;

/** Rotation trade-offs only apply when the assistant handles substitutions. */
export const ROTATION_NEEDS_ASSISTANT = "Gäller när assisterande tränaren sköter bytena (Assistentbyten på).";

// ---------------------------------------------------------------- TRN-02e overlay legend
export type OverlayMode = "ENERGY" | "SUITABILITY" | "LAST_MATCH" | "LAST_5_MATCHES";
export interface LegendEntry { tone: "pos" | "info" | "warn" | "neg" | "base" | "none"; label: string }
/** The exact thresholds the court chips use for each overlay (app/career/tactics getVisualModeDisplay). */
export const OVERLAY_LEGEND: Record<OverlayMode, { label: string; caption: string; entries: LegendEntry[] }> = {
  ENERGY: { label: "Energi", caption: "Dagsaktuell energi. Stapeln visar procent.", entries: [{ tone: "base", label: "75 % och mer" }, { tone: "neg", label: "Under 75 % – markeras låg" }] },
  SUITABILITY: { label: "Lämplighet", caption: "Hur väl spelaren passar platsen.", entries: [{ tone: "pos", label: "Naturlig roll" }, { tone: "warn", label: "Sekundär roll" }, { tone: "neg", label: "Ovan roll" }] },
  LAST_MATCH: { label: "Senaste match", caption: "Betyget från spelarens senaste match.", entries: [{ tone: "pos", label: "7,5 och mer" }, { tone: "info", label: "6,5–7,4" }, { tone: "warn", label: "Under 6,5" }, { tone: "none", label: "Ingen match" }] },
  LAST_5_MATCHES: { label: "Form (5 matcher)", caption: "Snittbetyg över de senaste fem matcherna.", entries: [{ tone: "pos", label: "7,5 och mer" }, { tone: "info", label: "6,5–7,4" }, { tone: "warn", label: "Under 6,5" }, { tone: "none", label: "Inga matcher" }] },
};

// ---------------------------------------------------------------- TRN-02a guard preview
export interface LineupDiff {
  slots: { position: string; label: string; from?: string; to?: string; changed: boolean }[];
  added: string[];
  removed: string[];
  changes: number;
}
const SLOT_ORDER = ["GK", "V6", "V9", "M9", "H9", "H6", "M6"];
/** What applying `proposed` would change compared with `current` (starting seven + squad). Pure. */
export function diffLineups(current: MatchPlan | null | undefined, proposed: MatchPlan): LineupDiff {
  const slot = (p: MatchPlan | null | undefined, pos: string) => p?.attackStartingUnit.slots.find((s) => s.position === pos)?.playerId || undefined;
  const slots = SLOT_ORDER.map((pos) => { const from = slot(current, pos), to = slot(proposed, pos); return { position: pos, label: pos === "GK" ? "MV" : pos, from, to, changed: from !== to }; });
  const before = new Set((current?.squad.players ?? []).map((p) => p.playerId));
  const after = new Set(proposed.squad.players.map((p) => p.playerId));
  const added = [...after].filter((id) => !before.has(id)).sort();
  const removed = [...before].filter((id) => !after.has(id)).sort();
  return { slots, added, removed, changes: slots.filter((s) => s.changed).length + added.length + removed.length };
}

// ---------------------------------------------------------------- TRN-02g 7 m statistics
export interface PenaltyStats { goals: number; attempts: number }
/** 7 m goals/attempts this season per player, counted from stored results' SEVEN_M events (current fixtures + archive summaries). */
export function penaltyStatsThisSeason(state: CareerState): Record<string, PenaltyStats> {
  const out: Record<string, PenaltyStats> = {};
  const seen = new Set<string>();
  const results = [...Object.entries(state.results), ...Object.values(careerArchiveSummaries(state)).map((a) => [a.fixture.id, a.result] as const)];
  const thisSeason = new Set(state.fixtures.map((f) => f.id));
  for (const [id, r] of results) {
    if (seen.has(id) || !thisSeason.has(id) || !r) continue;
    seen.add(id);
    for (const e of r.events ?? []) {
      if (e.type !== "SEVEN_M" || !e.playerId) continue;
      const s = (out[e.playerId] ??= { goals: 0, attempts: 0 });
      s.attempts++;
      if (e.sevenMetreOutcome === "GOAL") s.goals++;
    }
  }
  return out;
}
export function moveInOrder(order: readonly string[], index: number, delta: -1 | 1): string[] {
  const next = [...order];
  const j = index + delta;
  if (j < 0 || j >= next.length) return next;
  [next[index], next[j]] = [next[j]!, next[index]!];
  return next;
}

// ---------------------------------------------------------------- TRN-02i bench strip
export interface StripSlot { kind: "COURT" | "BENCH" | "EMPTY"; playerId?: string; label?: string; readiness?: number }
export const MATCH_SQUAD_SLOTS = 16;
/** 16 slots: the seven on court (attack shape), then the bench, then empty places up to 16. */
export function benchStrip(state: CareerState, plan: MatchPlan): { slots: StripSlot[]; registered: number; starters: number } {
  const starters = SLOT_ORDER.map((pos) => ({ pos, id: plan.attackStartingUnit.slots.find((s) => s.position === pos)?.playerId })).filter((s) => s.id);
  const starterIds = new Set(starters.map((s) => s.id));
  const ready = (id: string) => Math.round(readinessSummary(state, id).readiness);
  const slots: StripSlot[] = [
    ...starters.map((s) => ({ kind: "COURT" as const, playerId: s.id!, label: s.pos === "GK" ? "MV" : s.pos, readiness: ready(s.id!) })),
    ...plan.squad.players.filter((p) => !starterIds.has(p.playerId)).map((p) => ({ kind: "BENCH" as const, playerId: p.playerId, label: p.position === "GK" ? "MV" : p.position, readiness: ready(p.playerId) })),
  ];
  while (slots.length < MATCH_SQUAD_SLOTS) slots.push({ kind: "EMPTY" });
  return { slots: slots.slice(0, Math.max(MATCH_SQUAD_SLOTS, slots.length)), registered: plan.squad.players.length, starters: starters.length };
}
/** "Ej uttagna": available players outside the match squad, freshest first. */
export function outsideByReadiness(state: CareerState, plan: MatchPlan, squad: readonly PlayerMock[]): { player: PlayerMock; readiness: number; available: boolean }[] {
  const inSquad = new Set(plan.squad.players.map((p) => p.playerId));
  return squad.filter((p) => !inSquad.has(p.id)).map((player) => ({ player, readiness: Math.round(readinessSummary(state, player.id).readiness), available: isSelectableForMatch(state.playerStatuses, player.id) }))
    .sort((a, b) => Number(b.available) - Number(a.available) || b.readiness - a.readiness || a.player.lastName.localeCompare(b.player.lastName, "sv"));
}
