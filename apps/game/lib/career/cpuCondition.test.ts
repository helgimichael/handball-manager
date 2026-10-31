// HM-ALPHA2-02C: CPU workload & recovery -- the ten required scenarios plus
// proof that CPU readiness actually reaches both match paths.
import test from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { simulateAiFixturesForDate } from "./calendar";
import { createProductionSession } from "./productionMatch";
import { buildMatchdayReadyEvent } from "./careerEvents";
import { getCareerClubSquad } from "./careerWorld";
import { addDays } from "./dateUtils";
import { rolloverSeason } from "./seasonRollover";
import { migrateCareerState } from "./saveMigration";
import { computePlayerMatchStrengthAdjustment, resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { applyCpuDailyCondition as applyCpuDailyRecovery, cpuStartingEnergies, cpuTrainingDay, estimateQuickSimPlayerMatch, quickSimParticipation, QUICKSIM_WP_PER_MINUTE } from "./cpuCondition";
import { emptyWorkloadLedger, recordWorkload, type WorkloadEntry } from "../training/workloadLedger";
import type { CareerFixture, CareerState } from "./types";

let cached: CareerState | null = null;
function career(): CareerState {
  cached ??= createNewCareerState("cpu-condition-2026", "swe2-tumba", snapshotWorldSquads("swe-2"), undefined, snapshotGameplayRatings("swe-2"));
  return structuredClone(cached);
}
function aiFixtures(state: CareerState): CareerFixture[] {
  return state.fixtures.filter((f) => f.homeClubId !== state.playerClubId && f.awayClubId !== state.playerClubId).sort((a, b) => a.date.localeCompare(b.date));
}
const ESTIMATED = (s: CareerState, fixtureId: string) => Object.values(s.workloadLedger?.entries ?? {}).flat().filter((e) => e.id === `match:${fixtureId}`);

test("(1) consecutive CPU matches: quick-sim participants get estimated workload and carry readiness into the next match", () => {
  let s = career();
  const first = aiFixtures(s)[0];
  s = simulateAiFixturesForDate(s, first.date).state;
  const entries = ESTIMATED(s, first.id);
  assert.ok(entries.length >= 14, `participants recorded: ${entries.length}`);
  assert.ok(entries.every((e) => e.quality === "ESTIMATED" && e.basis === "QUICKSIM_MINUTES_ESTIMATE"));
  const tired = entries.filter((e) => e.load > 0).map((e) => Object.entries(s.workloadLedger!.entries).find(([, es]) => es.includes(e))![0]);
  assert.ok(tired.every((id) => s.playerPhysicalState[id].currentEnergy < 100), "CPU no longer resets to 100");
  // next fixture of the same club starts from tracked readiness
  const club = first.homeClubId;
  const next = aiFixtures(s).find((f) => f.date > first.date && (f.homeClubId === club || f.awayClubId === club))!;
  const start = cpuStartingEnergies(s, [club]);
  assert.ok([...start.values()].some((e) => e < 100));
  let lowestBetween = 100;
  for (let d = addDays(first.date, 1); d <= next.date; d = addDays(d, 1)) {
    s = applyCpuDailyRecovery(s, d);
    if (d < next.date) lowestBetween = Math.min(lowestBetween, ...[...cpuStartingEnergies(s, [club]).values()]);
  }
  const atKickoff = cpuStartingEnergies(s, [club]);
  const lowest = [...start.entries()].sort((a, b) => a[1] - b[1])[0];
  assert.ok(atKickoff.get(lowest[0])! > lowest[1], "the most tired player recovered between fixtures");
  const squad = getCareerClubSquad(s, club).map((p) => p.id);
  assert.ok(squad.some((id) => (s.workloadLedger!.entries[id] ?? []).some((e) => e.source === "TRAINING" && e.date > first.date && e.date < next.date)), "the club trained between its fixtures");
  assert.ok(lowestBetween < 100, "training days lower readiness between fixtures");
});

function cpuSetup(energy: number, loads: { date: string; load: number }[]) {
  const s = career();
  const club = aiFixtures(s)[0].homeClubId;
  const ids = getCareerClubSquad(s, club).filter((p) => p.position !== "MV").slice(0, 6).map((p) => p.id);
  const recs: (WorkloadEntry & { playerId: string })[] = ids.flatMap((playerId) => loads.map((l) => ({ playerId, id: `match:${l.date}`, date: l.date, source: "MATCH" as const, load: l.load, quality: "ESTIMATED" as const, basis: "QUICKSIM_MINUTES_ESTIMATE" as const, minutes: 60, ref: l.date })));
  const day0 = "2026-11-10";
  return {
    club, ids, day0,
    state: { ...s, workloadLedger: recordWorkload(emptyWorkloadLedger(addDays(day0, -60)), recs, addDays(day0, -1)), playerPhysicalState: { ...s.playerPhysicalState, ...Object.fromEntries(ids.map((id) => [id, { playerId: id, currentEnergy: energy, lastUpdatedDate: addDays(day0, -1), recentLoad: 0 }])) } } as CareerState,
  };
}
const weekly = (day0: string, weeks: number) => Array.from({ length: weeks }, (_, w) => ({ date: addDays(day0, -7 * (w + 1) - 1), load: 72 }));

test("(2) three matches within seven days: slower, capped recovery than one match -- but recovery continues", () => {
  const busy = cpuSetup(50, [...weekly("2026-11-10", 3), { date: "2026-11-04", load: 72 }, { date: "2026-11-06", load: 72 }, { date: "2026-11-09", load: 72 }]);
  const calm = cpuSetup(50, [...weekly("2026-11-10", 3), { date: "2026-11-09", load: 72 }]);
  let b = busy.state, c = calm.state;
  const trace: [number, number][] = [];
  for (let i = 0; i < 4; i++) { const d = addDays(busy.day0, i); b = applyCpuDailyRecovery(b, d); c = applyCpuDailyRecovery(c, d); trace.push([b.playerPhysicalState[busy.ids[0]].currentEnergy, c.playerPhysicalState[calm.ids[0]].currentEnergy]); }
  assert.ok(trace.every(([x, y]) => x <= y), JSON.stringify(trace));
  assert.ok(trace[0][0] < trace[0][1]);
  assert.ok(Math.max(...trace.map(([x]) => x)) > 50, `no trap: ${JSON.stringify(trace)}`);
});

test("(3) rest days recover more than training days, and never reset to 100 at once", () => {
  const { state, club, ids, day0 } = cpuSetup(40, [...weekly("2026-11-10", 3), { date: "2026-11-09", load: 72 }]);
  const days = Array.from({ length: 21 }, (_, i) => addDays(day0, i));
  const rest = days.find((d) => cpuTrainingDay(state, club, d).dayType === "REST")!;
  const training = days.find((d) => cpuTrainingDay(state, club, d).dayType === "TRAINING" && cpuTrainingDay(state, club, d).sessions.length > 0)!;
  const gain = (date: string) => applyCpuDailyRecovery({ ...state, playerPhysicalState: { ...state.playerPhysicalState, [ids[0]]: { ...state.playerPhysicalState[ids[0]], lastRecoveryDate: addDays(date, -1) } } }, date).playerPhysicalState[ids[0]].currentEnergy - 40;
  assert.ok(gain(rest) > gain(training), `rest ${gain(rest)} > training ${gain(training)}`);
  assert.ok(40 + gain(rest) < 100, "one rest day is not a full reset");
  let s = state;
  for (const d of days.slice(0, 10)) s = applyCpuDailyRecovery(s, d);
  assert.ok(s.playerPhysicalState[ids[0]].currentEnergy > 70, `ten days later ${s.playerPhysicalState[ids[0]].currentEnergy}`);
});

test("(4) different physical capacity: CPU players with better endurance recover more from the same state", () => {
  const { state, club, day0 } = cpuSetup(50, [{ date: "2026-11-09", load: 72 }]);
  const ratings = state.gameplayRatings[club];
  const byEndurance = ratings.filter((r) => r.branch.branch === "OUTCOURT" && r.branch.attributes.ENDURANCE).sort((a, b) => (a.branch.branch === "OUTCOURT" ? a.branch.attributes.ENDURANCE!.value : 0) - (b.branch.branch === "OUTCOURT" ? b.branch.attributes.ENDURANCE!.value : 0));
  const low = byEndurance[0].playerId, high = byEndurance.at(-1)!.playerId;
  const s0: CareerState = { ...state, playerPhysicalState: { ...state.playerPhysicalState, [low]: { playerId: low, currentEnergy: 50, lastUpdatedDate: addDays(day0, -1), recentLoad: 0 }, [high]: { playerId: high, currentEnergy: 50, lastUpdatedDate: addDays(day0, -1), recentLoad: 0 } } };
  const s1 = applyCpuDailyRecovery(s0, day0);
  assert.ok(s1.playerPhysicalState[high].currentEnergy > s1.playerPhysicalState[low].currentEnergy, `${s1.playerPhysicalState[high].currentEnergy} > ${s1.playerPhysicalState[low].currentEnergy}`);
});

test("(5) estimated quick-sim workload matches measured v2 magnitudes and is marked distinctly", () => {
  const field = estimateQuickSimPlayerMatch("V9", 60, 14, 100)!;
  assert.ok(Math.abs(field.load - 69.4) / 69.4 < 0.15, `60' field estimate ${field.load} vs measured 69.4 WP`);
  const keeper = estimateQuickSimPlayerMatch("MV", 60, undefined, 100)!;
  assert.ok(Math.abs(keeper.load - 17) < 3, `keeper ${keeper.load} vs measured ~17`);
  assert.ok(estimateQuickSimPlayerMatch("M6", 40, 10, 100)!.load > estimateQuickSimPlayerMatch("M6", 40, 18, 100)!.load, "endurance lowers the per-minute cost");
  assert.equal(estimateQuickSimPlayerMatch("V6", 0, 14, 100), null, "no court time, no workload");
  assert.ok(field.endEnergy < 100 && field.endEnergy >= 15);
  assert.deepEqual(Object.keys(QUICKSIM_WP_PER_MINUTE).sort(), ["H6", "H9", "M6", "M9", "MV", "V6", "V9"]);
});

test("(6) CPU substitutions and playing time come from the quick simulation's own usage timeline", () => {
  const s = career();
  const f = aiFixtures(s)[0];
  const plan = resolveClubMatchPlanForFixture(f.homeClubId, f.id, getCareerClubSquad(s, f.homeClubId), undefined);
  const parts = quickSimParticipation(s, f.homeClubId, plan, `${s.saveSeed}:${f.id}:home`, new Map());
  const keeperMinutes = parts.filter((p) => p.position === "MV").reduce((a, p) => a + p.minutes, 0);
  const fieldMinutes = parts.filter((p) => p.position !== "MV").reduce((a, p) => a + p.minutes, 0);
  assert.equal(keeperMinutes, 60);
  assert.ok(fieldMinutes >= 360 && fieldMinutes <= 420, `field minutes ${fieldMinutes}`);
  assert.ok(parts.every((p) => p.minutes % 10 === 0 && p.minutes > 0 && p.minutes <= 60));
  assert.ok(parts.some((p) => p.minutes < 60), "rotation: some players play part of the match");
  assert.ok(parts.length < getCareerClubSquad(s, f.homeClubId).length, "unused players get nothing");
});

test("(7) season transition keeps CPU readiness and workload; recovery continues", () => {
  let s = career();
  const f = aiFixtures(s)[0];
  s = simulateAiFixturesForDate(s, f.date).state;
  const rolled = rolloverSeason(s);
  assert.deepEqual(rolled.playerPhysicalState, s.playerPhysicalState);
  assert.deepEqual(rolled.workloadLedger, s.workloadLedger);
  const after = applyCpuDailyRecovery(rolled, addDays(f.date, 1));
  assert.ok(Object.keys(rolled.playerPhysicalState).some((id) => after.playerPhysicalState[id].lastRecoveryDate === addDays(f.date, 1) && after.playerPhysicalState[id].currentEnergy !== rolled.playerPhysicalState[id].currentEnergy));
});

test("(8) save/reload gives identical CPU results, readiness and workload", () => {
  const s = career();
  const [f1] = aiFixtures(s);
  const a1 = simulateAiFixturesForDate(s, f1.date).state;
  const b1 = simulateAiFixturesForDate(migrateCareerState(JSON.parse(JSON.stringify(s))), f1.date).state;
  assert.deepEqual(b1.results, a1.results);
  assert.deepEqual(b1.playerPhysicalState, a1.playerPhysicalState);
  assert.deepEqual(b1.workloadLedger, a1.workloadLedger);
  const d = addDays(f1.date, 1);
  assert.deepEqual(applyCpuDailyRecovery(migrateCareerState(JSON.parse(JSON.stringify(a1))), d).playerPhysicalState, applyCpuDailyRecovery(a1, d).playerPhysicalState);
});

test("(9) no duplicates: re-simulating a date and re-running a recovery night change nothing", () => {
  const s = career();
  const f = aiFixtures(s)[0];
  const once = simulateAiFixturesForDate(s, f.date).state;
  const twice = simulateAiFixturesForDate(once, f.date).state;
  assert.deepEqual(twice.workloadLedger, once.workloadLedger);
  assert.deepEqual(twice.playerPhysicalState, once.playerPhysicalState);
  const d = addDays(f.date, 1);
  const r1 = applyCpuDailyRecovery(once, d);
  assert.deepEqual(applyCpuDailyRecovery(r1, d), r1, "one recovery per CPU player per calendar date");
});

test("(10) old save without CPU state: identical first quick-sim inputs, nothing invented", () => {
  const s = career();
  const old = migrateCareerState(JSON.parse(JSON.stringify({ ...s, workloadLedger: undefined })));
  const f = aiFixtures(old)[0];
  assert.equal(cpuStartingEnergies(old, [f.homeClubId, f.awayClubId]).size, 0);
  const home = resolveClubMatchPlanForFixture(f.homeClubId, f.id, getCareerClubSquad(old, f.homeClubId), undefined);
  const away = resolveClubMatchPlanForFixture(f.awayClubId, f.id, getCareerClubSquad(old, f.awayClubId), undefined);
  const before = computePlayerMatchStrengthAdjustment(home, old.gameplayRatings[f.homeClubId] ?? [], away, old.gameplayRatings[f.awayClubId] ?? [], `${old.saveSeed}:${f.id}`);
  const now = computePlayerMatchStrengthAdjustment(home, old.gameplayRatings[f.homeClubId] ?? [], away, old.gameplayRatings[f.awayClubId] ?? [], `${old.saveSeed}:${f.id}`, new Map());
  assert.deepEqual(now, before, "no tracked CPU state -> exactly the pre-02C quick-sim inputs");
  // 02C.1: the first processed day starts CPU state from full readiness -- only that day's training, no invented history.
  const day = addDays(f.date, -1);
  const started = applyCpuDailyRecovery(old, day);
  const cpuIds = getCareerClubSquad(old, f.homeClubId).map((p) => p.id);
  assert.ok(cpuIds.every((id) => started.playerPhysicalState[id].currentEnergy <= 100 && started.playerPhysicalState[id].lastRecoveryDate === day));
  assert.ok(cpuIds.every((id) => (started.workloadLedger!.entries[id] ?? []).every((e) => e.date === day && e.source === "TRAINING")));
});

// --- HM-ALPHA2-02C.1: CPU training parity ------------------------------------

test("(P1) CPU clubs follow the same fixture-aware default week as the manager's club", () => {
  const s = career();
  const club = aiFixtures(s)[0].homeClubId;
  const own = (f: CareerFixture) => f.homeClubId === club || f.awayClubId === club;
  const matchDay = s.fixtures.filter(own)[1].date;
  assert.equal(cpuTrainingDay(s, club, matchDay).dayType, "MATCH");
  assert.deepEqual(cpuTrainingDay(s, club, matchDay).sessions, []);
  const eve = cpuTrainingDay(s, club, addDays(matchDay, -1));
  if (!s.fixtures.some((f) => own(f) && f.date === addDays(matchDay, -1))) {
    assert.deepEqual(eve.sessions.map((x) => [x.type, x.intensity]), [["MATCH_PREPARATION", "LOW"]], "light preparation the day before");
  }
  // identical rules: the manager's own club gets the very same generator output
  const managerDay = s.fixtures.find((f) => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)!.date;
  assert.deepEqual(cpuTrainingDay(s, s.playerClubId, managerDay), (s.trainingWeeks[managerDay] ?? cpuTrainingDay(s, s.playerClubId, managerDay)));
});

test("(P2) CPU training load uses the manager's session cost, is MODELLED, and respects rest and match days", () => {
  const s = career();
  const club = aiFixtures(s)[0].homeClubId;
  const days = Array.from({ length: 14 }, (_, i) => addDays(s.gameDate, i + 1));
  let st = s;
  for (const d of days) st = applyCpuDailyRecovery(st, d);
  const squad = getCareerClubSquad(st, club);
  for (const d of days) {
    const day = cpuTrainingDay(st, club, d);
    const entries = squad.flatMap((p) => (st.workloadLedger!.entries[p.id] ?? []).filter((e) => e.date === d && e.source === "TRAINING"));
    if (day.dayType === "REST" || day.dayType === "MATCH") assert.equal(entries.length, 0, `${d} ${day.dayType} has no training`);
    assert.ok(entries.every((e) => e.quality === "MODELLED" && e.basis === "TRAINING_SESSION_COST" && e.id.startsWith(`training:${d}:`)));
  }
  const trainingDay = days.find((d) => cpuTrainingDay(st, club, d).dayType === "TRAINING" && cpuTrainingDay(st, club, d).sessions.length)!;
  assert.ok(squad.some((p) => (st.workloadLedger!.entries[p.id] ?? []).some((e) => e.date === trainingDay && e.source === "TRAINING")), "training days are charged");
});


test("(D) CPU readiness reaches both match paths at kickoff", () => {
  const s = career();
  // Full engine: the opponent's tracked readiness is its v2 kickoff energy.
  const fixture = s.fixtures.find((f) => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)!;
  const cpuClub = fixture.homeClubId === s.playerClubId ? fixture.awayClubId : fixture.homeClubId;
  const cpuPlayers = getCareerClubSquad(s, cpuClub);
  const tired: CareerState = { ...s, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)], playerPhysicalState: { ...s.playerPhysicalState, ...Object.fromEntries(cpuPlayers.map((p) => [p.id, { playerId: p.id, currentEnergy: 55, lastUpdatedDate: fixture.date, recentLoad: 0 }])) } };
  const session = createProductionSession(tired, fixture);
  const cpuTeam = fixture.homeClubId === cpuClub ? "HOME" : "AWAY";
  const cpuPeople = session.people.filter((p) => p.team === cpuTeam);
  assert.ok(cpuPeople.length >= 7 && cpuPeople.every((p) => p.startEnergy === 55));
  assert.ok(session.core.players.filter((p) => p.team === cpuTeam).every((p) => p.condition.energy === 0.55));
  // Quick sim: a tired side is weaker through the existing strength trace.
  const f = aiFixtures(s)[0];
  const home = resolveClubMatchPlanForFixture(f.homeClubId, f.id, getCareerClubSquad(s, f.homeClubId), undefined);
  const away = resolveClubMatchPlanForFixture(f.awayClubId, f.id, getCareerClubSquad(s, f.awayClubId), undefined);
  const fresh = computePlayerMatchStrengthAdjustment(home, s.gameplayRatings[f.homeClubId] ?? [], away, s.gameplayRatings[f.awayClubId] ?? [], "x");
  const homeTired = computePlayerMatchStrengthAdjustment(home, s.gameplayRatings[f.homeClubId] ?? [], away, s.gameplayRatings[f.awayClubId] ?? [], "x", new Map(getCareerClubSquad(s, f.homeClubId).map((p) => [p.id, 45])));
  assert.ok(homeTired.home < fresh.home, `tired home side weaker: ${homeTired.home} < ${fresh.home}`);
});
