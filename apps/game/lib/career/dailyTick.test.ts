import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getPlayerFixtureOn } from "./calendar";
import { processDay } from "./dailyTick";
import { addDays } from "./dateUtils";
import { TUMBA_CLUB_ID } from "../game-data";
import type { CareerState } from "./types";

const SEASON_START = "2026-08-19"; // round 1's date -- see game-simulation's fixtures.ts (seasonStartDate is round 1's date).

function freshState(): CareerState {
  return createNewCareerState("dailytick-seed", TUMBA_CLUB_ID);
}

test("date progression: processDay advances gameDate and processedThroughDate to the processed date", () => {
  const { state } = processDay(freshState(), SEASON_START);
  assert.equal(state.gameDate, SEASON_START);
  assert.equal(state.processedThroughDate, SEASON_START);
});

test("manager fixture is not auto-played on its own matchday -- MATCHDAY_READY is created instead", () => {
  const base = freshState();
  const fixture = getPlayerFixtureOn(base, SEASON_START);
  assert.ok(fixture, "the manager club must have a fixture on round 1's date (every club plays every round)");

  const { state, events } = processDay(base, SEASON_START);
  assert.equal(state.results[fixture!.id], undefined, "the manager's own fixture must remain unplayed");

  const matchdayEvent = events.find((e) => e.type === "MATCHDAY_READY");
  assert.ok(matchdayEvent);
  assert.equal(matchdayEvent!.requiresAction, true);
  assert.equal(matchdayEvent!.resolved, false);
});

test("AI fixtures on the same matchday date ARE simulated (Spec S12) without touching the manager's own fixture", () => {
  const { state } = processDay(freshState(), SEASON_START);
  const aiResultsCount = Object.keys(state.results).length;
  assert.ok(aiResultsCount > 0, "other clubs' fixtures on the same date should have been simulated");
  const playerFixture = getPlayerFixtureOn(freshState(), SEASON_START)!;
  assert.equal(state.results[playerFixture.id], undefined);
});

test("the same day is never processed twice: re-processing produces zero new events and no duplicate results", () => {
  const once = processDay(freshState(), SEASON_START);
  const resultsCountAfterFirst = Object.keys(once.state.results).length;
  const eventCountAfterFirst = once.state.careerEvents.length;

  const twice = processDay(once.state, SEASON_START);
  assert.equal(twice.events.length, 0, "reprocessing the same date must not generate any new events");
  assert.equal(twice.state.careerEvents.length, eventCountAfterFirst, "careerEvents log must not grow");
  assert.equal(Object.keys(twice.state.results).length, resultsCountAfterFirst, "no fixture may be re-simulated");
});

test("a quiet day (no fixture, no scheduled report) produces only INFORMATION-level domain state and never stops Continue", () => {
  const afterMatchday = processDay(freshState(), SEASON_START).state;
  const { events } = processDay(afterMatchday, addDays(SEASON_START, 1));
  assert.ok(events.every((e) => e.priority === "INFORMATION"));
});

test("event generation ordering is stable and matches the spec's Daily World Tick order within one day", () => {
  const { events } = processDay(freshState(), SEASON_START);
  const order = events.map((e) => e.type);
  const trainingIndex = order.indexOf("TRAINING_COMPLETED");
  const matchdayIndex = order.indexOf("MATCHDAY_READY");
  assert.ok(trainingIndex >= 0 && matchdayIndex >= 0);
  assert.ok(trainingIndex < matchdayIndex, "Training/Recovery (step 3) must be emitted before Fixtures (step 6)");
});

test("a seeded player recovery transition fires PLAYER_STATUS_CHANGED exactly on its return date, and dedup holds across many days", () => {
  let state = freshState();
  const returnDate = state.playerStatuses["p-holmgren"].returnDate!;
  let date = SEASON_START;
  let recoveryEvents = 0;
  const seenIds = new Set<string>();

  while (date <= returnDate) {
    const result = processDay(state, date);
    state = result.state;
    for (const e of result.events) {
      assert.ok(!seenIds.has(e.id), `duplicate event id emitted: ${e.id}`);
      seenIds.add(e.id);
      if (e.type === "PLAYER_STATUS_CHANGED" && e.primaryEntity?.entityId === "p-holmgren") {
        recoveryEvents += 1;
      }
    }
    date = addDays(date, 1);
  }

  assert.equal(recoveryEvents, 1);
  assert.equal(state.playerStatuses["p-holmgren"].availability, "AVAILABLE");
});
