// HM-ALPHA2-02A: unified workload ledger -- units, windows, idempotency,
// persistence and the match/training integrations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { TUMBA_CLUB_ID } from "../game-data";
import { addDays } from "../career/dateUtils";
import { addTrainingSession, mondayOf, resolveTrainingWeek, setTrainingDayType } from "./trainingSchedule";
import { executeTrainingDay } from "./trainingExecution";
import { computePlayerSessionEnergyDelta } from "./trainingLoad";
import { rolloverSeason } from "../career/seasonRollover";
import { migrateCareerState } from "../career/saveMigration";
import {
  RECENT_LOAD_DAILY_DECAY,
  WORKLOAD_RETENTION_DAYS,
  decayedRecentWorkload,
  emptyWorkloadLedger,
  matchWorkload,
  recordWorkload,
  startWorkloadLedger,
  trainingWorkload,
  workloadWindow,
  type WorkloadEntry,
} from "./workloadLedger";
import type { CareerState } from "../career/types";

const D0 = "2026-09-01";
const entry = (playerId: string, id: string, date: string, load: number, source: WorkloadEntry["source"] = "TRAINING", minutes?: number) =>
  ({ playerId, id, date, source, load, quality: source === "MATCH" ? "MEASURED" as const : "MODELLED" as const, basis: source === "MATCH" ? "ENGINE_ENERGY_DEMAND" as const : "TRAINING_SESSION_COST" as const, ref: id, ...(minutes === undefined ? {} : { minutes }) });

function trainingState(seed: string, configure: (week: ReturnType<typeof resolveTrainingWeek>, date: string) => ReturnType<typeof resolveTrainingWeek>) {
  const state = createNewCareerState(seed, TUMBA_CLUB_ID);
  const date = state.gameDate;
  const weekStart = mondayOf(date);
  return { state: { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: configure(resolveTrainingWeek(state, weekStart), date) } }, date };
}

// --- 1/5: units ---------------------------------------------------------

test("match and training workload share one unit (energy-reservoir points); minutes are a separate field", () => {
  const field = matchWorkload({ kind: "FIELD_PLAYER", condition: { energy: 0.55, courtMs: 45 * 60000, physicalLoad: { energyDemand: 0.523 } } }, 100);
  assert.deepEqual(field, { load: 52.3, quality: "MEASURED", basis: "ENGINE_ENERGY_DEMAND", minutes: 45 });
  // A training session's own energy cost is the same quantity: points of the 0-100 reservoir.
  const delta = computePlayerSessionEnergyDelta({ id: "s", type: "CONDITIONING", intensity: "HIGH", duration: "NORMAL", target: "ALL" } as never, "FULL", 10.5);
  assert.ok(delta < 0);
  assert.deepEqual(trainingWorkload(delta), { load: Math.round(-delta * 10) / 10, quality: "MODELLED", basis: "TRAINING_SESSION_COST" });
  // Load is never minutes: same minutes, different physical demand => different load.
  const lighter = matchWorkload({ kind: "FIELD_PLAYER", condition: { energy: 0.8, courtMs: 45 * 60000, physicalLoad: { energyDemand: 0.31 } } }, 100);
  assert.equal(lighter!.minutes, field!.minutes);
  assert.notEqual(lighter!.load, field!.load);
});

test("no activity generates no workload: unused substitutes, rest, recovery sessions", () => {
  assert.equal(matchWorkload({ kind: "FIELD_PLAYER", condition: { energy: 1, courtMs: 0, physicalLoad: { energyDemand: 0 } } }, 100), null);
  assert.equal(trainingWorkload(0), null, "REST load setting / no session");
  assert.equal(trainingWorkload(+8), null, "a RECOVERY session restores energy -- it is not workload");
});

test("substitutes are charged only for their actual participation", () => {
  const sub = matchWorkload({ kind: "FIELD_PLAYER", condition: { energy: 0.93, courtMs: 6 * 60000, physicalLoad: { energyDemand: 0.071 } } }, 100);
  assert.deepEqual(sub, { load: 7.1, quality: "MEASURED", basis: "ENGINE_ENERGY_DEMAND", minutes: 6 });
});

test("goalkeepers (no engine work log) are an explicit ESTIMATED lower bound from net energy drop", () => {
  const gk = matchWorkload({ kind: "GOALKEEPER", condition: { energy: 0.82, courtMs: 60 * 60000 } }, 97);
  assert.deepEqual(gk, { load: 15, quality: "ESTIMATED", basis: "ENGINE_NET_ENERGY_DROP", minutes: 60 });
  const recovered = matchWorkload({ kind: "GOALKEEPER", condition: { energy: 1, courtMs: 60000 } }, 95);
  assert.equal(recovered!.load, 0, "never negative");
});

// --- 2: windows -----------------------------------------------------------

test("rolling 7- and 28-day windows: totals, rest days count as zero, multiple activities per day", () => {
  let ledger = emptyWorkloadLedger(D0);
  ledger = recordWorkload(ledger, [
    entry("p", "training:d0:a", D0, 10),
    entry("p", "training:d0:b", D0, 5), // two sessions, same day
    entry("p", "match:f1", addDays(D0, 3), 60, "MATCH", 58),
    entry("p", "training:d10", addDays(D0, 10), 8),
    entry("p", "match:f2", addDays(D0, 20), 70, "MATCH", 60),
  ], addDays(D0, 20));
  const asOf = addDays(D0, 27);
  const w7 = workloadWindow(ledger, "p", asOf, 7);
  assert.deepEqual([w7.total, w7.match, w7.training, w7.activeDays, w7.matches, w7.minutes], [0, 0, 0, 0, 0, 0], "a week of rest is zero workload");
  const w28 = workloadWindow(ledger, "p", asOf, 28);
  assert.deepEqual([w28.total, w28.match, w28.training, w28.activeDays, w28.matches, w28.minutes], [153, 130, 23, 4, 2, 118]);
  assert.equal(w28.dailyAverage, 5.5);
  assert.equal(w28.measuredShare, 0.85);
  const w7b = workloadWindow(ledger, "p", addDays(D0, 3), 7);
  assert.equal(w7b.total, 75, "window includes its end date");
});

test("window completeness: before the ledger began, or for players whose training is not tracked (CPU)", () => {
  const ledger = emptyWorkloadLedger(D0);
  assert.equal(workloadWindow(ledger, "p", addDays(D0, 5), 7).complete, false);
  assert.equal(workloadWindow(ledger, "p", addDays(D0, 6), 7).complete, true);
  assert.equal(workloadWindow(ledger, "p", addDays(D0, 27), 28).complete, true);
  assert.equal(workloadWindow(ledger, "p", addDays(D0, 27), 28, false).complete, false);
  assert.equal(workloadWindow(undefined, "p", D0, 7).complete, false);
});

// --- 4: idempotency / bounded ---------------------------------------------

test("recording is idempotent by id (retried match completion / reload) and bounded by retention", () => {
  const records = [entry("p", "match:f1", D0, 60, "MATCH", 60)];
  const once = recordWorkload(emptyWorkloadLedger(D0), records, D0);
  const twice = recordWorkload(once, records, D0);
  assert.deepEqual(twice, once);
  assert.equal(once.entries.p.length, 1);
  const later = recordWorkload(once, [entry("p", "training:x", addDays(D0, WORKLOAD_RETENTION_DAYS), 4)], addDays(D0, WORKLOAD_RETENTION_DAYS));
  assert.deepEqual(later.entries.p.map((e) => e.id), ["training:x"], "entries older than the retention window are dropped");
  assert.equal(recordWorkload(once, [], D0), once, "nothing recorded -> same object");
});

// --- recentLoad derivation ------------------------------------------------

test("decayed recent workload: same daily decay for every source, carry-in for pre-ledger saves", () => {
  const ledger = recordWorkload(startWorkloadLedger({ playerPhysicalState: { p: { recentLoad: 20, lastUpdatedDate: D0 } } }, D0), [entry("p", "match:f1", addDays(D0, 1), 60, "MATCH", 60)], addDays(D0, 1));
  assert.deepEqual(ledger.carryIn, { p: { value: 20, date: D0 } });
  assert.equal(decayedRecentWorkload(ledger, "p", addDays(D0, 1)), Math.round((60 + 20 * RECENT_LOAD_DAILY_DECAY) * 10) / 10);
  assert.equal(decayedRecentWorkload(ledger, "p", addDays(D0, 2)), Math.round((60 * RECENT_LOAD_DAILY_DECAY + 20 * RECENT_LOAD_DAILY_DECAY ** 2) * 10) / 10);
  assert.equal(decayedRecentWorkload(undefined, "p", D0), 0);
  assert.deepEqual(startWorkloadLedger({ playerPhysicalState: {} }, D0).carryIn, {}, "a new career carries nothing");
});

// --- training integration -------------------------------------------------

test("training integration: each participant's session cost is recorded once; energy outcomes unchanged; re-execution is a no-op", () => {
  const { state, date } = trainingState("workload-training", (week, d) => addTrainingSession(setTrainingDayType(week, d, "TRAINING"), d, { type: "CONDITIONING", intensity: "HIGH", duration: "NORMAL", target: "ALL" }));
  const done = executeTrainingDay(state, date);
  const day = done.trainingWeeks[mondayOf(date)].days.find((d) => d.date === date)!;
  const conditioning = day.sessions.find((s) => s.type === "CONDITIONING")!;
  const result = day.results!.find((r) => r.sessionId === conditioning.id)!;
  assert.ok(result.participants.length > 0);
  for (const playerId of result.participants) {
    const own = (done.workloadLedger!.entries[playerId] ?? []).filter((e) => e.ref === conditioning.id);
    const cost = -result.loadByPlayer[playerId];
    assert.equal(own.length, cost > 0 ? 1 : 0, "one entry per costed session, none for a zero-load participant");
    if (cost > 0) assert.equal(own[0].load, Math.round(cost * 10) / 10, "workload = the session's own energy cost");
    // every session of the day is recorded exactly once, recovery/zero sessions not at all
    const expected = day.results!.filter((r) => r.participants.includes(playerId) && (r.loadByPlayer[playerId] ?? 0) < 0).length;
    assert.equal((done.workloadLedger!.entries[playerId] ?? []).length, expected);
    // energy is untouched by the ledger: the last session's post-energy stands
    assert.equal(done.playerPhysicalState[playerId].currentEnergy, day.results!.filter((r) => r.participants.includes(playerId)).at(-1)!.postEnergyByPlayer[playerId]);
    assert.equal(done.playerPhysicalState[playerId].recentLoad, decayedRecentWorkload(done.workloadLedger, playerId, date));
  }
  const again = executeTrainingDay(done, date);
  assert.deepEqual(again.workloadLedger, done.workloadLedger);
  assert.deepEqual(again.playerPhysicalState, done.playerPhysicalState);
});

test("rest day: no training entries, recentLoad decays", () => {
  const { state, date } = trainingState("workload-rest", (week, d) => setTrainingDayType(week, d, "REST"));
  const done = executeTrainingDay(state, date);
  assert.deepEqual(done.workloadLedger!.entries, {});
  assert.equal(done.workloadLedger!.trackedSince, date);
});

// --- 6/7: persistence -------------------------------------------------------

test("old save without a ledger: loads unchanged, then starts a ledger carrying its existing recentLoad", () => {
  const { state, date } = trainingState("workload-old-save", (week, d) => setTrainingDayType(week, d, "REST"));
  const playerId = Object.keys(state.playerStatuses)[0];
  const old: CareerState = { ...state, playerPhysicalState: { [playerId]: { playerId, currentEnergy: 80, lastUpdatedDate: addDays(date, -1), recentLoad: 30 } } };
  delete (old as Partial<CareerState>).workloadLedger;
  const migrated = migrateCareerState(JSON.parse(JSON.stringify(old)));
  assert.equal(migrated.workloadLedger, undefined, "no migration writes a ledger");
  assert.equal(migrated.playerPhysicalState[playerId].recentLoad, 30);
  const next = executeTrainingDay(migrated, date);
  assert.deepEqual(next.workloadLedger!.carryIn[playerId], { value: 30, date: addDays(date, -1) });
  assert.equal(next.playerPhysicalState[playerId].recentLoad, Math.round(30 * RECENT_LOAD_DAILY_DECAY * 10) / 10, "decays smoothly instead of resetting to 0");
});

test("ledger survives JSON save/reload deterministically and season rollover", () => {
  const { state, date } = trainingState("workload-reload", (week, d) => addTrainingSession(setTrainingDayType(week, d, "TRAINING"), d, { type: "PHYSICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL" }));
  const done = executeTrainingDay(state, date);
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(done)));
  assert.deepEqual(reloaded.workloadLedger, done.workloadLedger);
  const playerId = Object.keys(done.workloadLedger!.entries)[0];
  assert.deepEqual(workloadWindow(reloaded.workloadLedger, playerId, date, 7), workloadWindow(done.workloadLedger, playerId, date, 7));
  assert.deepEqual(executeTrainingDay(reloaded, date).workloadLedger, done.workloadLedger, "re-processing after reload adds nothing");
  assert.deepEqual(rolloverSeason(done).workloadLedger, done.workloadLedger, "calendar-continuous across seasons");
});
