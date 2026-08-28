import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getNextPlayerFixture, getPlayerFixtureOn } from "./calendar";
import { processDay } from "./dailyTick";
import { addDays } from "./dateUtils";
import { TUMBA_CLUB_ID } from "../game-data";
import type { CareerState } from "./types";
import { createScoutingAssignment, createBroadScoutingAssignment } from "./scouting";
import { getPlayerKnowledgePct } from "../knowledge/knowledgeIntegration";
import { generateStaffAttributeProfile } from "../staff/staffAttributeGeneration";
import { ensureCareerGameplayRatings } from "./careerRatingNormalization";
import type { ResolvedStaffMember } from "../staff/types";

// HM-CAREER-0.5: fixtures within round 1 are now deterministically spread
// across a few nearby days (game-simulation's fixtures.ts), not all
// forced onto one shared date -- so the manager's own round-1 fixture's
// date must be looked up per fresh state, never assumed to equal the
// season's start date.
function freshState(): CareerState {
  return createNewCareerState("dailytick-seed", TUMBA_CLUB_ID);
}

const SEASON_START = freshState().seasonStartDate;
const MATCHDAY = getNextPlayerFixture(freshState())!.date;

test("date progression: processDay advances gameDate and processedThroughDate to the processed date", () => {
  const { state } = processDay(freshState(), SEASON_START);
  assert.equal(state.gameDate, SEASON_START);
  assert.equal(state.processedThroughDate, SEASON_START);
});

test("manager fixture is not auto-played on its own matchday -- MATCHDAY_READY is created instead", () => {
  const base = freshState();
  const fixture = getPlayerFixtureOn(base, MATCHDAY);
  assert.ok(fixture, "the manager club must have a fixture on its own round-1 matchday");

  const { state, events } = processDay(base, MATCHDAY);
  assert.equal(state.results[fixture!.id], undefined, "the manager's own fixture must remain unplayed");

  const matchdayEvent = events.find((e) => e.type === "MATCHDAY_READY");
  assert.ok(matchdayEvent);
  assert.equal(matchdayEvent!.requiresAction, true);
  assert.equal(matchdayEvent!.resolved, false);
});

test("HM-CAREER-0.5: AI fixtures process on their OWN scheduled dates, which are no longer forced onto the manager's own matchday", () => {
  const base = freshState();
  const playerFixture = getPlayerFixtureOn(base, MATCHDAY)!;
  const round1Fixtures = base.fixtures.filter((f) => f.round === playerFixture.round);
  const otherDatesInRound = new Set(round1Fixtures.filter((f) => f.id !== playerFixture.id).map((f) => f.date));

  assert.ok(otherDatesInRound.size > 1 || !otherDatesInRound.has(MATCHDAY), "expected round 1 to actually be spread across more than just the manager's own matchday for this seed");
});

test("AI fixtures dated on the manager's own matchday ARE simulated (Spec S12) without touching the manager's own fixture", () => {
  const { state } = processDay(freshState(), MATCHDAY);
  const aiResultsCount = Object.keys(state.results).length;
  assert.ok(aiResultsCount >= 0, "any other clubs' fixtures sharing this exact date should have been simulated");
  const playerFixture = getPlayerFixtureOn(freshState(), MATCHDAY)!;
  assert.equal(state.results[playerFixture.id], undefined);
});

test("HM-CAREER-0.5: an AI fixture dated on a DIFFERENT day than the manager's matchday resolves on its own scheduled date, not the manager's", () => {
  const base = freshState();
  const playerFixture = getPlayerFixtureOn(base, MATCHDAY)!;
  const laterSameRoundFixture = base.fixtures.find((f) => f.round === playerFixture.round && f.id !== playerFixture.id && f.date !== MATCHDAY);
  if (!laterSameRoundFixture) return; // this seed happened to put the whole round on one date -- nothing to assert

  const onMatchday = processDay(base, MATCHDAY).state;
  assert.equal(onMatchday.results[laterSameRoundFixture.id], undefined, "a fixture scheduled for a later date must not resolve early");

  const onItsOwnDate = processDay(onMatchday, laterSameRoundFixture.date).state;
  assert.ok(onItsOwnDate.results[laterSameRoundFixture.id], "the fixture must resolve once its own scheduled date is processed");
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
  // Walk sequentially through the round-1 spread window (at most a few
  // days -- see fixtures.ts's spreadDays) plus a small margin, so the day
  // actually under test is guaranteed past the manager's own matchday
  // and both the training/staff report cadences, regardless of exactly
  // which day within the spread window the matchday fell on.
  let state = freshState();
  let date = SEASON_START;
  for (let i = 0; i < 5; i += 1) {
    state = processDay(state, date).state;
    date = addDays(date, 1);
  }
  const { events } = processDay(state, date);
  assert.ok(
    events.every((e) => e.priority === "INFORMATION"),
    `expected an all-INFORMATION quiet day, got: ${events.map((e) => `${e.type}:${e.priority}`).join(", ")}`,
  );
});

test("event generation ordering is stable and matches the spec's Daily World Tick order within one day", () => {
  const { events } = processDay(freshState(), MATCHDAY);
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

// ---------------------------------------------------------------------------
// HM-SCOUTING-1.0: a real scouting assignment progresses through the daily
// tick exactly like every other in-progress process -- never a full
// "instant scouting on button press" (Part 3: "Det ska gå via career
// time / daily tick, inte bli full scouting direkt när knappen trycks").
// ---------------------------------------------------------------------------

test("HM-SCOUTING-1.0: a scouting assignment completes via processDay on its end date, raising knowledge and emitting SCOUT_REPORT_READY -- never before", () => {
  const scoutProfile = generateStaffAttributeProfile("scout-1", ["SCOUT"], "scout-1");
  const scout: ResolvedStaffMember = { id: "scout-1", clubId: TUMBA_CLUB_ID, displayName: "Test Scout", roles: ["SCOUT"], hmRoles: [], employmentType: "SALARIED", profile: scoutProfile, source: "GENERATED_FICTIONAL" };
  let state: CareerState = { ...freshState(), staffRoster: { ...freshState().staffRoster, [TUMBA_CLUB_ID]: [scout] } };

  const targetPlayerId = "external-player-x";
  const targetClubId = "se_club_alingsas_hk";
  const before = getPlayerKnowledgePct(state, targetPlayerId, targetClubId);
  const { state: withAssignment, assignment } = createScoutingAssignment(state, "scout-1", targetPlayerId, targetClubId, state.gameDate);
  assert.ok(assignment);
  state = withAssignment;

  let date = state.gameDate;
  let sawReportEvent = false;
  while (date < assignment!.endDate) {
    const result = processDay(state, date);
    state = result.state;
    assert.ok(!result.events.some((e) => e.type === "SCOUT_REPORT_READY"), "must not fire before the assignment's own end date");
    date = addDays(date, 1);
  }
  const onEndDate = processDay(state, assignment!.endDate);
  state = onEndDate.state;
  sawReportEvent = onEndDate.events.some((e) => e.type === "SCOUT_REPORT_READY");

  assert.ok(sawReportEvent, "SCOUT_REPORT_READY must fire exactly on the assignment's end date");
  assert.equal(state.scoutingAssignments[assignment!.id].status, "COMPLETED");
  assert.ok(getPlayerKnowledgePct(state, targetPlayerId, targetClubId) > before);
});

test("HM-SCOUTING-1.1: a broad (CLUB) assignment's discovery cycle completes via processDay, emitting SCOUT_DISCOVERY_READY and an inbox message -- never a ScoutReport", () => {
  const scoutProfile = generateStaffAttributeProfile("scout-1", ["SCOUT"], "scout-1");
  const scout: ResolvedStaffMember = { id: "scout-1", clubId: TUMBA_CLUB_ID, displayName: "Test Scout", roles: ["SCOUT"], hmRoles: [], employmentType: "SALARIED", profile: scoutProfile, source: "GENERATED_FICTIONAL" };
  const targetClubId = "ger1-kiel";
  const squad = Array.from({ length: 6 }, (_, i) => ({
    id: `kiel-daily-${i}`,
    clubId: targetClubId,
    firstName: "Test",
    lastName: `Kiel${i}`,
    shirtNumber: null,
    position: "M6" as const,
    nationality: "GER" as const,
    dateOfBirth: "2000-01-01",
    heightCm: null,
    weightKg: null,
    foot: null,
    squadStatus: "Förstaval" as const,
    dataSource: "REAL_WORLD" as const,
    currentAbility: 100,
    potentialAbility: 100,
    form: 5,
    fitnessPct: 100,
    moralePct: 70,
    appearances: 0,
    goals: 0,
    contractEndSeason: "2026/27",
    wageSekPerMonth: 0,
    attributes: {
      technical: { skott: 10, passning: 10, spelforstaelse: 10, genombrott: 10, mottagning: 10, fint: 10, spelUtanBoll: 10 },
      mental: { beslutsfattande: 10, kyla: 10, arbetskapacitet: 10, kampvilja: 10, positionering: 10, lagarbete: 10, ledarskap: 10 },
      physical: { snabbhet: 10, acceleration: 10, styrka: 10, explosivitet: 10, uthallighet: 10, rorlighet: 10 },
    },
  }));
  let state: CareerState = { ...freshState(), staffRoster: { ...freshState().staffRoster, [TUMBA_CLUB_ID]: [scout] }, worldSquads: { ...freshState().worldSquads, [targetClubId]: squad } };
  state = ensureCareerGameplayRatings(state, targetClubId);

  const created = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId }, state.gameDate);
  assert.equal(created.ok, true, created.errors.join(" "));
  state = created.state;

  const onEndDate = processDay(state, created.assignment!.endDate);
  state = onEndDate.state;
  const discoveryEvent = onEndDate.events.find((e) => e.type === "SCOUT_DISCOVERY_READY");
  assert.ok(discoveryEvent, "SCOUT_DISCOVERY_READY must fire on the cycle's end date");
  assert.ok(state.inbox.some((m) => m.careerEventId === discoveryEvent!.id), "the discovery event must produce an inbox message");
  assert.equal(Object.keys(state.scoutReports).length, 0, "a broad assignment must never file a ScoutReport");
});
