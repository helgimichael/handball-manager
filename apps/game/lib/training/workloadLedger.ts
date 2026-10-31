// HM-ALPHA2-02A: the unified player workload ledger -- one bounded,
// per-player history of match and training workload in ONE unit, so that
// later recovery/accumulated-fatigue work has a trustworthy input.
//
// Unit: the WORKLOAD POINT (WP) = one percentage point of a player's
// energy reservoir that an activity DEMANDS. Both systems already price
// work on that same 0-100 reservoir:
//   - match:    the v2 engine's per-player `physicalLoad.energyDemand`
//               (0-1, gross requested cost before the 0.15 floor) x 100;
//   - training: the session's own energy cost from trainingLoad.ts
//               (`computePlayerSessionEnergyDelta`, already in points).
// So the training<->match conversion is 1 WP = 1 WP; nothing is rescaled.
// Playing minutes are stored beside the load, never added to it.
//
// Nothing here changes energy, injury probabilities or performance by
// itself; it records and summarises. Pure and filesystem-free.
import { daysBetween, addDays } from "../career/dateUtils";

export const WORKLOAD_MODEL = "HM-WORKLOAD-1" as const;
/** Entries older than this (relative to the newest write) are dropped: the 28-day window plus a margin. */
export const WORKLOAD_RETENTION_DAYS = 42;

export type WorkloadSource = "MATCH" | "TRAINING";
/**
 * MEASURED: simulated physical work integrated by the match engine.
 * MODELLED: the training model's own deterministic session cost.
 * ESTIMATED: a reconstruction where no physical log exists (goalkeepers'
 * net energy drop; quick-simulated CPU matches, HM-ALPHA2-02C).
 */
export type WorkloadQuality = "MEASURED" | "MODELLED" | "ESTIMATED";
export type WorkloadBasis = "ENGINE_ENERGY_DEMAND" | "ENGINE_NET_ENERGY_DROP" | "TRAINING_SESSION_COST" | "QUICKSIM_MINUTES_ESTIMATE";

export type WorkloadEntry = {
  /** Idempotency key: `match:<fixtureId>` or `training:<date>:<sessionId>`. */
  id: string;
  date: string;
  source: WorkloadSource;
  /** Workload points (WP), rounded to 0.1. */
  load: number;
  quality: WorkloadQuality;
  basis: WorkloadBasis;
  /** Match only: time on court, a separate quantity from `load`. */
  minutes?: number;
  /** fixtureId or training sessionId. */
  ref: string;
};

export type WorkloadLedger = {
  model: typeof WORKLOAD_MODEL;
  /** First date this career recorded workload; windows reaching before it are incomplete. */
  trackedSince: string;
  /**
   * Pre-ledger `recentLoad` per player at the moment the ledger started
   * (older saves only) -- decays like any entry, so an existing career's
   * injury inputs never jump when the ledger first appears.
   */
  carryIn: Record<string, { value: number; date: string }>;
  entries: Record<string, WorkloadEntry[]>;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The minimal engine-side shape this needs (CorePlayer); kept structural so nothing in the engine is imported or changed. */
export type EnginePlayerWorkloadInput = {
  kind: "FIELD_PLAYER" | "GOALKEEPER" | string;
  condition: { energy: number; courtMs: number; physicalLoad?: { energyDemand?: number } };
};

/** Match workload for one player, or null when the player never took the court. */
export function matchWorkload(player: EnginePlayerWorkloadInput, startEnergy0to100: number): Pick<WorkloadEntry, "load" | "quality" | "basis" | "minutes"> | null {
  const courtMs = player.condition.courtMs;
  if (!(courtMs > 0)) return null;
  const minutes = round1(courtMs / 60000);
  const demand = player.condition.physicalLoad?.energyDemand;
  if (player.kind !== "GOALKEEPER" && typeof demand === "number" && Number.isFinite(demand)) {
    return { load: round1(Math.max(0, demand) * 100), quality: "MEASURED", basis: "ENGINE_ENERGY_DEMAND", minutes };
  }
  // Goalkeepers (and any field player without a physical log) keep only a
  // start/end energy: the net drop is a lower bound of the work done.
  return { load: round1(Math.max(0, startEnergy0to100 - player.condition.energy * 100)), quality: "ESTIMATED", basis: "ENGINE_NET_ENERGY_DROP", minutes };
}

/** Training workload from the session's own energy delta (negative = cost). Recovery gains and rest are no workload. */
export function trainingWorkload(sessionEnergyDelta: number): Pick<WorkloadEntry, "load" | "quality" | "basis"> | null {
  const cost = round1(Math.max(0, -sessionEnergyDelta));
  return cost > 0 ? { load: cost, quality: "MODELLED", basis: "TRAINING_SESSION_COST" } : null;
}

export function emptyWorkloadLedger(date: string, carryIn: WorkloadLedger["carryIn"] = {}): WorkloadLedger {
  return { model: WORKLOAD_MODEL, trackedSince: date, carryIn, entries: {} };
}

/** First ledger for a career: carries any pre-ledger `recentLoad` forward (older saves); a new career carries nothing. */
export function startWorkloadLedger(state: { playerPhysicalState: Record<string, { recentLoad?: number; lastUpdatedDate?: string }> }, date: string): WorkloadLedger {
  const carryIn: WorkloadLedger["carryIn"] = {};
  for (const [playerId, physical] of Object.entries(state.playerPhysicalState ?? {})) {
    if ((physical?.recentLoad ?? 0) > 0) carryIn[playerId] = { value: round1(physical.recentLoad!), date: physical.lastUpdatedDate && physical.lastUpdatedDate <= date ? physical.lastUpdatedDate : date };
  }
  return emptyWorkloadLedger(date, carryIn);
}

/**
 * Upserts entries by id (so a retried match completion or a re-executed
 * day can never double-count) and drops anything older than the
 * retention window relative to `asOfDate`. Returns the same object when
 * nothing changes.
 */
export function recordWorkload(ledger: WorkloadLedger, records: readonly (WorkloadEntry & { playerId: string })[], asOfDate: string): WorkloadLedger {
  const cutoff = addDays(asOfDate, -(WORKLOAD_RETENTION_DAYS - 1));
  const touched = new Set(records.map((r) => r.playerId));
  if (touched.size === 0) return ledger;
  const entries = { ...ledger.entries };
  for (const playerId of touched) {
    const byId = new Map((entries[playerId] ?? []).map((e) => [e.id, e] as const));
    for (const { playerId: pid, ...entry } of records) if (pid === playerId) byId.set(entry.id, entry);
    entries[playerId] = [...byId.values()].filter((e) => e.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }
  return { ...ledger, entries };
}

export type WorkloadWindow = {
  days: number;
  from: string;
  to: string;
  total: number;
  match: number;
  training: number;
  /** Total / window length, i.e. average workload per calendar day (rest days count as 0). */
  dailyAverage: number;
  activeDays: number;
  matches: number;
  minutes: number;
  /** Share of `total` that is MEASURED (rest is MODELLED/ESTIMATED). */
  measuredShare: number | null;
  /** False when the window starts before the ledger began, or training is not tracked for this player (e.g. CPU clubs). */
  complete: boolean;
};

/** Rolling window ending on (and including) `asOfDate`. */
export function workloadWindow(ledger: WorkloadLedger | undefined, playerId: string, asOfDate: string, days: 7 | 28, trainingTracked = true): WorkloadWindow {
  const from = addDays(asOfDate, -(days - 1));
  const inWindow = (ledger?.entries[playerId] ?? []).filter((e) => e.date >= from && e.date <= asOfDate);
  const sum = (pred: (e: WorkloadEntry) => boolean) => round1(inWindow.filter(pred).reduce((a, e) => a + e.load, 0));
  const total = sum(() => true);
  return {
    days,
    from,
    to: asOfDate,
    total,
    match: sum((e) => e.source === "MATCH"),
    training: sum((e) => e.source === "TRAINING"),
    dailyAverage: round1(total / days),
    activeDays: new Set(inWindow.map((e) => e.date)).size,
    matches: inWindow.filter((e) => e.source === "MATCH").length,
    minutes: round1(inWindow.reduce((a, e) => a + (e.minutes ?? 0), 0)),
    measuredShare: total > 0 ? Math.round((sum((e) => e.quality === "MEASURED") / total) * 100) / 100 : null,
    complete: !!ledger && trainingTracked && ledger.trackedSince <= from,
  };
}

/**
 * Daily decay of the derived `recentLoad` injury input. Calibrated in
 * HM-ALPHA2-02A against the pre-ledger training series (see the release
 * notes): the old figure decayed once per write, i.e. ~0.49/day on a
 * one-session day.
 */
export const RECENT_LOAD_DAILY_DECAY = 0.49;

/** The decaying recent-workload figure (WP) the injury model reads as `recentLoad`, derived only from the ledger. */
export function decayedRecentWorkload(ledger: WorkloadLedger | undefined, playerId: string, asOfDate: string): number {
  if (!ledger) return 0;
  let value = 0;
  for (const e of ledger.entries[playerId] ?? []) {
    const age = daysBetween(e.date, asOfDate);
    if (age >= 0) value += e.load * RECENT_LOAD_DAILY_DECAY ** age;
  }
  const carry = ledger.carryIn[playerId];
  if (carry) value += carry.value * RECENT_LOAD_DAILY_DECAY ** Math.max(0, daysBetween(carry.date, asOfDate));
  return round1(value);
}
