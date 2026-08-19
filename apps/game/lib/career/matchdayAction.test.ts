import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getPlayerFixtureOn } from "./calendar";
import { processDay } from "./dailyTick";
import { playManagerFixture } from "./matchdayAction";
import { TUMBA_CLUB_ID } from "../game-data";

const SEASON_START = "2026-08-19";

function stateAtMatchday() {
  const fresh = createNewCareerState("matchday-action-seed", TUMBA_CLUB_ID);
  return processDay(fresh, SEASON_START).state;
}

test("playManagerFixture resolves the manager's own fixture, resolves MATCHDAY_READY, and creates MATCH_COMPLETED", () => {
  const state = stateAtMatchday();
  const fixture = getPlayerFixtureOn(state, SEASON_START)!;

  const { state: next, result } = playManagerFixture(state);
  assert.ok(result);
  assert.equal(result!.fixtureId, fixture.id);
  assert.ok(next.results[fixture.id]);

  const matchdayEvent = next.careerEvents.find((e) => e.type === "MATCHDAY_READY");
  assert.ok(matchdayEvent);
  assert.equal(matchdayEvent!.resolved, true);
  assert.equal(matchdayEvent!.read, true);

  const completedEvent = next.careerEvents.find((e) => e.type === "MATCH_COMPLETED");
  assert.ok(completedEvent);
  assert.equal(completedEvent!.primaryEntity?.entityId, fixture.id);
  assert.ok(next.inbox.some((m) => m.careerEventId === completedEvent!.id));

  // The original MATCHDAY_READY inbox message must also stop showing its
  // action-required badge once resolved -- not only the domain event.
  const matchdayMessage = next.inbox.find((m) => m.careerEventId === matchdayEvent!.id);
  assert.ok(matchdayMessage);
  assert.equal(matchdayMessage!.actionRequired, false);
  assert.equal(matchdayMessage!.read, true);
});

test("playManagerFixture updates club form and IFK Tumba's own player season stats", () => {
  const state = stateAtMatchday();
  const fixture = getPlayerFixtureOn(state, SEASON_START)!;
  const { state: next } = playManagerFixture(state);

  assert.ok(next.clubForm[fixture.homeClubId]?.length);
  assert.ok(next.clubForm[fixture.awayClubId]?.length);
  assert.ok(Object.keys(next.playerSeasonStats).length > 0);
});

test("playManagerFixture is a safe no-op when there is no unplayed manager fixture for the current date", () => {
  const fresh = createNewCareerState("matchday-action-seed-2", TUMBA_CLUB_ID);
  // gameDate here is the pre-season default with no processed matchday.
  const { state, result } = playManagerFixture(fresh);
  assert.equal(result, null);
  assert.equal(state, fresh);
});

test("playManagerFixture never re-simulates an already-played fixture (idempotent)", () => {
  const state = stateAtMatchday();
  const fixture = getPlayerFixtureOn(state, SEASON_START)!;
  const first = playManagerFixture(state);
  assert.ok(first.result);

  const second = playManagerFixture(first.state);
  assert.equal(second.result, null, "the fixture is already resolved -- nothing left to simulate");
  const completedEvents = second.state.careerEvents.filter((e) => e.type === "MATCH_COMPLETED" && e.primaryEntity?.entityId === fixture.id);
  assert.equal(completedEvents.length, 1, "MATCH_COMPLETED must not duplicate");
});
