// HM-TRAINING-1.0 Part 30: week generation, fixture-awareness, and the
// pure edit operations (lib/training/trainingSchedule.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CareerFixture } from "../career/types";
import { MAX_SESSIONS_PER_DAY, addTrainingSession, buildTrainingWeek, mondayOf, removeTrainingSession, setTrainingDayType, updateTrainingSession } from "./trainingSchedule";

const CLUB_ID = "c1";
const OPPONENT_ID = "c2";

function fixture(id: string, date: string, homeClubId = CLUB_ID, awayClubId = OPPONENT_ID): CareerFixture {
  return { id, competitionId: "comp", round: 1, date, homeClubId, awayClubId };
}

// (1) week has 7 dates.
test("(1) buildTrainingWeek always produces exactly 7 days, Monday through Sunday", () => {
  const week = buildTrainingWeek("2026-08-17", [], CLUB_ID);
  assert.equal(week.days.length, 7);
  assert.equal(week.days[0].date, "2026-08-17"); // Monday
  assert.equal(week.days[6].date, "2026-08-23"); // Sunday
});

test("mondayOf resolves any day of the week to that week's own Monday", () => {
  assert.equal(mondayOf("2026-08-17"), "2026-08-17"); // Monday itself
  assert.equal(mondayOf("2026-08-19"), "2026-08-17"); // Wednesday
  assert.equal(mondayOf("2026-08-23"), "2026-08-17"); // Sunday
});

// (2) max 2 sessions/day if enforced.
test("(2) no template day ever exceeds MAX_SESSIONS_PER_DAY sessions", () => {
  for (const template of ["BALANCED", "TACTICAL", "PHYSICAL", "RECOVERY", "MATCH_HEAVY"] as const) {
    const week = buildTrainingWeek("2026-08-17", [], CLUB_ID, template);
    for (const day of week.days) {
      assert.ok(day.sessions.length <= MAX_SESSIONS_PER_DAY, `${template} ${day.date} had ${day.sessions.length} sessions`);
    }
  }
});

test("addTrainingSession refuses to exceed MAX_SESSIONS_PER_DAY", () => {
  const week = buildTrainingWeek("2026-08-17", [], CLUB_ID, "RECOVERY"); // Monday has 1 session in this template
  const seed = { type: "TECHNICAL" as const, intensity: "NORMAL" as const, duration: "NORMAL" as const, target: "ALL" as const };
  const withOne = week.days[0].sessions.length;
  const afterAdd1 = addTrainingSession(week, "2026-08-17", seed);
  const afterAdd2 = addTrainingSession(afterAdd1, "2026-08-17", seed);
  const day = afterAdd2.days[0];
  assert.ok(day.sessions.length <= MAX_SESSIONS_PER_DAY, `expected <= ${MAX_SESSIONS_PER_DAY}, started with ${withOne}, got ${day.sessions.length}`);
});

// (3) template generation deterministic.
test("(3) buildTrainingWeek is deterministic -- identical inputs always produce an identical week", () => {
  const fixtures = [fixture("f1", "2026-08-22")];
  const a = buildTrainingWeek("2026-08-17", fixtures, CLUB_ID, "BALANCED");
  const b = buildTrainingWeek("2026-08-17", fixtures, CLUB_ID, "BALANCED");
  assert.deepEqual(a, b);
});

// (4) fixture day cannot accidentally execute normal hard training.
test("(4) a fixture date is always forced to dayType MATCH with zero sessions, regardless of template", () => {
  const fixtures = [fixture("f1", "2026-08-19")]; // Wednesday
  for (const template of ["BALANCED", "TACTICAL", "PHYSICAL", "RECOVERY", "MATCH_HEAVY"] as const) {
    const week = buildTrainingWeek("2026-08-17", fixtures, CLUB_ID, template);
    const matchDay = week.days.find((d) => d.date === "2026-08-19")!;
    assert.equal(matchDay.dayType, "MATCH");
    assert.equal(matchDay.sessions.length, 0);
  }
});

test("a fixture where the club is the AWAY side is detected identically to a HOME fixture", () => {
  const fixtures = [fixture("f1", "2026-08-19", OPPONENT_ID, CLUB_ID)];
  const week = buildTrainingWeek("2026-08-17", fixtures, CLUB_ID, "BALANCED");
  const matchDay = week.days.find((d) => d.date === "2026-08-19")!;
  assert.equal(matchDay.dayType, "MATCH");
});

// (10)/(11) goalkeeper/outcourt targeting.
test("(10)/(11) BALANCED template's physical day targets outcourt and goalkeepers with SEPARATE sessions", () => {
  const week = buildTrainingWeek("2026-08-17", [], CLUB_ID, "BALANCED");
  const tuesday = week.days[1];
  const outcourtSession = tuesday.sessions.find((s) => s.target === "OUTCOURT");
  const gkSession = tuesday.sessions.find((s) => s.target === "GOALKEEPERS");
  assert.ok(outcourtSession, "expected an OUTCOURT-targeted session");
  assert.ok(gkSession, "expected a GOALKEEPERS-targeted session");
});

// (18) fixture-aware template does not schedule absurd pre-match hard load (also (25)).
test("(18)/(25) the day immediately before a fixture is always downgraded to a single low-intensity MATCH_PREPARATION session, never a hard CONDITIONING/STRENGTH/HIGH session", () => {
  const fixtures = [fixture("f1", "2026-08-22")]; // Saturday
  for (const template of ["BALANCED", "TACTICAL", "PHYSICAL", "RECOVERY", "MATCH_HEAVY"] as const) {
    const week = buildTrainingWeek("2026-08-17", fixtures, CLUB_ID, template);
    const friday = week.days.find((d) => d.date === "2026-08-21")!;
    assert.equal(friday.sessions.length, 1, `${template}: expected exactly 1 session the day before a match`);
    assert.equal(friday.sessions[0].type, "MATCH_PREPARATION");
    assert.equal(friday.sessions[0].intensity, "LOW");
    for (const session of friday.sessions) {
      assert.notEqual(session.type, "CONDITIONING");
      assert.notEqual(session.type, "STRENGTH");
      assert.notEqual(session.intensity, "HIGH");
      assert.notEqual(session.intensity, "VERY_HIGH");
    }
  }
});

test("(28) MATCH_PREPARATION references the actual upcoming fixture id", () => {
  const fixtures = [fixture("f1", "2026-08-22")];
  const week = buildTrainingWeek("2026-08-17", fixtures, CLUB_ID, "BALANCED");
  const friday = week.days.find((d) => d.date === "2026-08-21")!;
  assert.equal(friday.sessions[0].matchPreparationFixtureId, "f1");
});

// (19)/(24) multiple matches per week.
test("(19)/(24) a two-match week generates safely -- both fixture days are MATCH, both eve-of-match days are downgraded", () => {
  const fixtures = [fixture("f1", "2026-08-19"), fixture("f2", "2026-08-22")]; // Wed + Sat
  const week = buildTrainingWeek("2026-08-17", fixtures, CLUB_ID, "PHYSICAL");
  assert.equal(week.days.find((d) => d.date === "2026-08-19")!.dayType, "MATCH");
  assert.equal(week.days.find((d) => d.date === "2026-08-22")!.dayType, "MATCH");
  assert.equal(week.days.find((d) => d.date === "2026-08-18")!.sessions[0].type, "MATCH_PREPARATION"); // Tue, eve of Wed match
  assert.equal(week.days.find((d) => d.date === "2026-08-21")!.sessions[0].type, "MATCH_PREPARATION"); // Fri, eve of Sat match
  assert.equal(week.days.length, 7);
});

// (21) same schedule inputs deterministic (edit operations too).
test("(21) an edit sequence applied twice to the same starting week produces identical results", () => {
  const week = buildTrainingWeek("2026-08-17", [], CLUB_ID, "BALANCED");
  const seed = { type: "TECHNICAL" as const, intensity: "HIGH" as const, duration: "SHORT" as const, target: "ALL" as const };
  const applyEdits = (w: typeof week) => updateTrainingSession(addTrainingSession(w, "2026-08-19", seed), "2026-08-19", "2026-08-19:s0", { intensity: "VERY_HIGH" });
  const a = applyEdits(week);
  const b = applyEdits(week);
  assert.deepEqual(a, b);
});

test("removeTrainingSession removes exactly the targeted session and leaves others untouched", () => {
  const week = buildTrainingWeek("2026-08-17", [], CLUB_ID, "BALANCED");
  const thursday = week.days[3]; // BALANCED Thursday has 2 sessions
  assert.equal(thursday.sessions.length, 2);
  const removed = removeTrainingSession(week, thursday.date, thursday.sessions[0].id);
  const updatedDay = removed.days.find((d) => d.date === thursday.date)!;
  assert.equal(updatedDay.sessions.length, 1);
  assert.equal(updatedDay.sessions[0].id, thursday.sessions[1].id);
});

test("setTrainingDayType to REST clears any existing sessions", () => {
  const week = buildTrainingWeek("2026-08-17", [], CLUB_ID, "BALANCED");
  const thursday = week.days[3];
  assert.ok(thursday.sessions.length > 0);
  const rested = setTrainingDayType(week, thursday.date, "REST");
  const updatedDay = rested.days.find((d) => d.date === thursday.date)!;
  assert.equal(updatedDay.dayType, "REST");
  assert.equal(updatedDay.sessions.length, 0);
});

test("an already-executed day's sessions cannot be edited (mapDay's own guard)", () => {
  const week = buildTrainingWeek("2026-08-17", [], CLUB_ID, "BALANCED");
  const monday = week.days[0];
  const executedWeek = { ...week, days: week.days.map((d) => (d.date === monday.date ? { ...d, executed: true } : d)) };
  const attempted = removeTrainingSession(executedWeek, monday.date, monday.sessions[0].id);
  const stillThere = attempted.days.find((d) => d.date === monday.date)!;
  assert.equal(stillThere.sessions.length, monday.sessions.length);
});
