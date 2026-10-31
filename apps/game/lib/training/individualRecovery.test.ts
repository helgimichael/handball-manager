// HM-ALPHA2-02B: individual recovery -- the ten required scenarios.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { TUMBA_CLUB_ID } from "../game-data";
import { addDays } from "../career/dateUtils";
import { migrateCareerState } from "../career/saveMigration";
import { executeTrainingDay } from "./trainingExecution";
import { applyOvernightRecovery, applyRestDayBonus } from "./trainingLoad";
import { addTrainingSession, mondayOf, resolveTrainingWeek, setTrainingDayType } from "./trainingSchedule";
import { applyIndividualRecovery, recoveryProfile, recoveryProfileFor, RECOVERY_TUNING, type RecoveryInputs } from "./individualRecovery";
import { emptyWorkloadLedger, recordWorkload, workloadWindow, type WorkloadEntry, type WorkloadLedger } from "./workloadLedger";
import { kickoffEnergy, MATCH_KICKOFF_ENERGY_FLOOR } from "../career/productionMatch";
import type { CareerState } from "../career/types";

const NIGHT = "2026-10-15";
const asOf = addDays(NIGHT, -1);
type Rec = WorkloadEntry & { playerId: string };
const match = (playerId: string, date: string, load = 70): Rec => ({ playerId, id: `match:${date}`, date, source: "MATCH", load, quality: "MEASURED", basis: "ENGINE_ENERGY_DEMAND", minutes: 60, ref: date });
const session = (playerId: string, date: string, load = 8): Rec => ({ playerId, id: `training:${date}:s`, date, source: "TRAINING", load, quality: "MODELLED", basis: "TRAINING_SESSION_COST", ref: "s" });

/** A full 28-day history: `weeklyMatches` per week for weeks 2-4, then the last 7 days as given. */
function history(playerId: string, weeklyMatches: number, recent: Rec[]): WorkloadLedger {
  const recs: Rec[] = [];
  for (let d = 27; d >= 7; d--) {
    const date = addDays(asOf, -d);
    recs.push(session(playerId, date));
    if (d % 7 === 0) for (let m = 0; m < weeklyMatches; m++) recs.push(match(playerId, addDays(date, -m)));
  }
  return recordWorkload(emptyWorkloadLedger(addDays(asOf, -40)), [...recs, ...recent], asOf);
}
function inputs(ledger: WorkloadLedger | undefined, playerId: string, over: Partial<RecoveryInputs> = {}): RecoveryInputs {
  const last = [...(ledger?.entries[playerId] ?? [])].reverse().find((e) => e.source === "MATCH");
  return {
    endurance: 12, repeatSprint: 12, age: 25,
    window7: workloadWindow(ledger, playerId, asOf, 7), window28: workloadWindow(ledger, playerId, asOf, 28),
    lastMatch: last ? { daysSince: Math.round((Date.parse(NIGHT) - Date.parse(last.date)) / 864e5), load: last.load } : null,
    injured: false, ...over,
  };
}
const baselineNight = (e: number) => applyOvernightRecovery(e);

test("(1) identical energy, different workload: the overloaded player recovers less and is capped", () => {
  const busy = history("a", 1, [match("a", addDays(asOf, -5)), match("a", addDays(asOf, -3)), match("a", addDays(asOf, -1)), session("a", addDays(asOf, -2), 12)]);
  const calm = history("b", 1, [session("b", addDays(asOf, -2))]);
  const pa = recoveryProfile(inputs(busy, "a")), pb = recoveryProfile(inputs(calm, "b"));
  assert.ok(pa.workloadDataComplete && pb.workloadDataComplete);
  assert.ok(pa.spike! > pb.spike!);
  assert.ok(pa.loadFactor < 1 && pb.loadFactor === 1, `${pa.loadFactor} ${pb.loadFactor}`);
  assert.ok(pa.ceiling < 100 && pb.ceiling === 100);
  const ea = applyIndividualRecovery(50, baselineNight(50), pa), eb = applyIndividualRecovery(50, baselineNight(50), pb);
  assert.ok(ea < eb, `${ea} < ${eb}`);
  assert.ok(ea > 50, "recovery still happens after heavy workload");
});

test("(2) identical workload, different physical capacity: better endurance tolerates and recovers more", () => {
  const ledger = history("p", 1, [match("p", addDays(asOf, -4)), match("p", addDays(asOf, -2)), session("p", addDays(asOf, -1))]);
  const fit = recoveryProfile(inputs(ledger, "p", { endurance: 18, repeatSprint: 17 }));
  const unfit = recoveryProfile(inputs(ledger, "p", { endurance: 5, repeatSprint: 6 }));
  assert.equal(fit.spike, unfit.spike, "same workload, same spike");
  assert.ok(fit.capacity > unfit.capacity);
  assert.ok(fit.loadFactor >= unfit.loadFactor);
  assert.ok(fit.efficiency > unfit.efficiency);
  assert.ok(applyIndividualRecovery(45, baselineNight(45), fit) > applyIndividualRecovery(45, baselineNight(45), unfit));
  // older players recover a little more slowly, never dramatically
  const veteran = recoveryProfile(inputs(ledger, "p", { age: 35 }));
  assert.ok(veteran.ageFactor < 1 && veteran.ageFactor >= 1 - RECOVERY_TUNING.ageMaxLoss);
});

// --- career-level helpers --------------------------------------------------

function career(seed: string): CareerState {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}
function setDay(state: CareerState, date: string, kind: "REST" | "TRAINING" | "HEAVY"): CareerState {
  const ws = mondayOf(date);
  let week = setTrainingDayType(resolveTrainingWeek(state, ws), date, kind === "REST" ? "REST" : "TRAINING");
  if (kind !== "REST") week = { ...week, days: week.days.map((d) => (d.date === date ? { ...d, sessions: [] } : d)) };
  if (kind === "HEAVY") week = addTrainingSession(week, date, { type: "CONDITIONING", intensity: "VERY_HIGH", duration: "LONG", target: "ALL" });
  if (kind === "TRAINING") week = addTrainingSession(week, date, { type: "TEAM_TACTICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL" });
  return { ...state, trainingWeeks: { ...state.trainingWeeks, [ws]: week } };
}
function run(state: CareerState, start: string, days: ("REST" | "TRAINING" | "HEAVY")[]): CareerState {
  let s = state;
  days.forEach((kind, i) => { const date = addDays(start, i); s = executeTrainingDay(setDay(s, date, kind), date); });
  return s;
}
function withEnergy(state: CareerState, playerIds: string[], energy: number, date: string): CareerState {
  return { ...state, playerPhysicalState: { ...state.playerPhysicalState, ...Object.fromEntries(playerIds.map((id) => [id, { playerId: id, currentEnergy: energy, lastUpdatedDate: date, recentLoad: 0 }])) } };
}

test("(3) three matches in one week: readiness stays lower than after one, but keeps recovering", () => {
  const base = career("recovery-three-matches");
  const [a, b] = Object.keys(base.playerStatuses).slice(0, 2);
  const start = addDays(base.gameDate, 35);
  const recs: Rec[] = [];
  for (let d = 34; d >= 8; d--) for (const id of [a, b]) recs.push(session(id, addDays(start, -d)));
  for (let w = 1; w <= 3; w++) for (const id of [a, b]) recs.push(match(id, addDays(start, -7 * w - 1)));
  recs.push(match(a, addDays(start, -6)), match(a, addDays(start, -4)), match(a, addDays(start, -2)), match(b, addDays(start, -2)));
  let s: CareerState = { ...withEnergy(base, [a, b], 45, addDays(start, -1)), workloadLedger: recordWorkload(emptyWorkloadLedger(addDays(start, -40)), recs, addDays(start, -1)) };
  const trace: [number, number][] = [];
  for (let i = 0; i < 6; i++) { s = run(s, addDays(start, i), ["TRAINING"]); trace.push([s.playerPhysicalState[a].currentEnergy, s.playerPhysicalState[b].currentEnergy]); }
  assert.ok(trace.every(([x, y]) => x <= y), `congested player never ahead: ${JSON.stringify(trace)}`);
  assert.ok(trace[0][0] < trace[0][1], "the congested week shows on the first night");
  assert.ok(trace[5][0] > trace[0][0], "and recovery continues -- no trap");
});

test("(4) a player rested for several days recovers steadily, not instantly to 100", () => {
  const base = career("recovery-rest");
  const ids = Object.keys(base.playerStatuses).slice(0, 4);
  const start = addDays(base.gameDate, 1);
  let s = withEnergy(base, ids, 40, base.gameDate);
  const curve: number[] = [];
  for (let i = 0; i < 4; i++) { s = run(s, addDays(start, i), ["REST"]); curve.push(s.playerPhysicalState[ids[0]].currentEnergy); }
  assert.ok(curve.every((e, i) => i === 0 || e >= curve[i - 1]), `monotonic ${curve}`);
  assert.ok(curve[0] < 80, `one rest day is not a full reset (${curve[0]})`);
  assert.ok(curve[3] > 90, `several rest days restore readiness (${curve[3]})`);
  // rest is genuinely better than training
  const trained = run(withEnergy(base, ids, 40, base.gameDate), start, ["TRAINING"]);
  assert.ok(curve[0] > trained.playerPhysicalState[ids[0]].currentEnergy);
});

test("(5) heavy training between matches lowers readiness and raises recorded workload", () => {
  const base = career("recovery-heavy-training");
  const ids = Object.keys(base.playerStatuses).slice(0, 3);
  const start = addDays(base.gameDate, 1);
  const light = run(withEnergy(base, ids, 80, base.gameDate), start, ["TRAINING", "TRAINING", "TRAINING"]);
  const heavy = run(withEnergy(base, ids, 80, base.gameDate), start, ["HEAVY", "HEAVY", "HEAVY"]);
  const end = addDays(start, 2);
  for (const id of ids) {
    assert.ok(heavy.playerPhysicalState[id].currentEnergy < light.playerPhysicalState[id].currentEnergy);
    assert.ok(workloadWindow(heavy.workloadLedger, id, end, 7).total > workloadWindow(light.workloadLedger, id, end, 7).total);
  }
});

test("(6) consecutive high-load weeks become the new normal: no permanent penalty", () => {
  // Four identical heavy weeks: acute equals chronic, so the spike is ~1 and nothing is penalised.
  const recs: Rec[] = [];
  for (let d = 27; d >= 0; d--) { recs.push(session("p", addDays(asOf, -d), 12)); if (d % 7 === 1 || d % 7 === 4) recs.push(match("p", addDays(asOf, -d))); }
  const ledger = recordWorkload(emptyWorkloadLedger(addDays(asOf, -40)), recs, asOf);
  const p = recoveryProfile(inputs(ledger, "p", { lastMatch: null }));
  assert.ok(p.spike! > 0.9 && p.spike! < 1.1, `spike ${p.spike}`);
  assert.equal(p.loadFactor, 1);
  assert.equal(p.ceiling, 100);
});

test("(7) existing save without workload history: neutral workload terms, nothing invented", () => {
  const base = career("recovery-old-save");
  const id = Object.keys(base.playerStatuses)[0];
  const old = withEnergy(base, [id], 50, base.gameDate);
  delete (old as Partial<CareerState>).workloadLedger;
  const migrated = migrateCareerState(JSON.parse(JSON.stringify(old)));
  assert.equal(migrated.workloadLedger, undefined);
  const p = recoveryProfileFor(migrated, id, addDays(base.gameDate, 1));
  assert.equal(p.workloadDataComplete, false);
  assert.deepEqual([p.spike, p.loadFactor, p.ceiling, p.postMatchFactor], [null, 1, 100, 1]);
  assert.equal(p.efficiency, Math.round(p.capacity * p.ageFactor * 100) / 100, "only the player's own attributes/age apply");
  const next = run(migrated, addDays(base.gameDate, 1), ["REST"]);
  assert.ok(next.playerPhysicalState[id].currentEnergy > 50);
  assert.deepEqual(next.workloadLedger!.entries, {}, "a rest day records no workload");
});

test("(8) save/reload gives the identical recovery result", () => {
  const base = career("recovery-reload");
  const ids = Object.keys(base.playerStatuses).slice(0, 5);
  const start = addDays(base.gameDate, 1);
  const s = run(withEnergy(base, ids, 55, base.gameDate), start, ["TRAINING", "HEAVY"]);
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(s)));
  const a = run(s, addDays(start, 2), ["REST", "TRAINING"]);
  const b = run(reloaded, addDays(start, 2), ["REST", "TRAINING"]);
  assert.deepEqual(b.playerPhysicalState, a.playerPhysicalState);
  assert.deepEqual(b.workloadLedger, a.workloadLedger);
});

test("(9) replaying a completed day never recovers twice", () => {
  const base = career("recovery-replay");
  const id = Object.keys(base.playerStatuses)[0];
  const date = addDays(base.gameDate, 1);
  const once = executeTrainingDay(setDay(withEnergy(base, [id], 40, base.gameDate), date, "REST"), date);
  const twice = executeTrainingDay(once, date);
  assert.deepEqual(twice.playerPhysicalState, once.playerPhysicalState);
  assert.ok(once.playerPhysicalState[id].currentEnergy < applyRestDayBonus(applyOvernightRecovery(applyRestDayBonus(applyOvernightRecovery(40)))));
});

test("(10) career->match energy contract: kickoff energy is clamped to the engine's [15,100] range", () => {
  assert.equal(MATCH_KICKOFF_ENERGY_FLOOR, 15);
  assert.equal(kickoffEnergy(undefined), 100, "untracked players stay fully fresh (unchanged)");
  assert.equal(kickoffEnergy(63.4), 63.4, "in-range readiness passes through untouched");
  assert.equal(kickoffEnergy(4), 15, "below the engine floor: handed over at the floor the engine would apply itself");
  assert.equal(kickoffEnergy(120), 100);
});

test("recovery is never negative and always possible from any state", () => {
  for (const efficiency of [0.6, 1, 1.2]) for (const ceiling of [80, 100]) for (const e of [0, 15, 50, 79, 85, 100]) {
    const out = applyIndividualRecovery(e, baselineNight(e), { capacity: 1, ageFactor: 1, spike: null, loadFactor: 1, postMatchFactor: 1, medicalFactor: 1, efficiency, ceiling, workloadDataComplete: true });
    assert.ok(out >= e && out <= 100, `${e} -> ${out}`);
    if (e < ceiling) assert.ok(out > e, "some recovery whenever below the ceiling");
  }
});
