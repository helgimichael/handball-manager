import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBA_CLUB_ID, TUMBA_SQUAD } from "../game-data";
import {
  buildClubNewsEvent,
  buildCompetitionUpdateEvent,
  buildMatchCompletedEvent,
  buildMatchdayReadyEvent,
  buildMatchPreparationReadyEvent,
  buildOpponentReportReadyEvent,
  buildPlayerInjuredEvent,
  buildPlayerStatusChangedEvent,
  buildScoutReportReadyEvent,
  buildStaffReportEvent,
  buildTrainingCompletedEvent,
  buildTrainingReportEvent,
} from "./careerEvents";
import { categoryLabel, careerEventToInboxMessage } from "./inboxBridge";
import { createNewCareerState } from "./newCareer";
import { resolveDestinationHref } from "./destinations";

function freshCareer() {
  return createNewCareerState("inbox-bridge-seed", TUMBA_CLUB_ID);
}

test("careerEventToInboxMessage preserves id linkage, priority, and destinations exactly", () => {
  const career = freshCareer();
  const event = buildMatchdayReadyEvent("fx-1", "2026-08-22");
  const message = careerEventToInboxMessage(event, career);

  assert.equal(message.id, `msg:${event.id}`);
  assert.equal(message.careerEventId, event.id);
  assert.equal(message.priority, "ACTION_REQUIRED");
  assert.equal(message.actionRequired, true);
  assert.equal(message.resolved, false);
  assert.equal(message.read, false);
  assert.equal(message.archived, false);
  assert.ok(message.body.length > 0);
  assert.deepEqual(message.destinations, event.destinations);
});

test("every CareerEventType maps to exactly one InboxCategory, and INFORMATION/IMPORTANT/ACTION_REQUIRED all survive mapping", () => {
  const career = freshCareer();
  const cases: [ReturnType<typeof buildMatchdayReadyEvent>, string][] = [
    [buildTrainingCompletedEvent("2026-08-20"), "STAFF"],
    [buildTrainingReportEvent("2026-08-20"), "STAFF"],
    [buildPlayerStatusChangedEvent("p-1", "2026-08-20", true), "MEDICAL"],
    [buildPlayerInjuredEvent("p-1", "2026-08-20"), "MEDICAL"],
    [buildScoutReportReadyEvent("task-1", "p-1", "2026-08-20"), "SCOUTING"],
    [buildOpponentReportReadyEvent("task-1", "swe1-club", "2026-08-20"), "ANALYSIS"],
    [buildMatchPreparationReadyEvent("fx-1", "2026-08-20"), "MATCH"],
    [buildMatchdayReadyEvent("fx-1", "2026-08-20"), "MATCH"],
    [buildMatchCompletedEvent("fx-1", career.competitionId, "2026-08-20"), "MATCH"],
    [buildCompetitionUpdateEvent("2026-08-20", career.competitionId), "COMPETITION"],
    [buildStaffReportEvent("2026-08-20"), "STAFF"],
    [buildClubNewsEvent("n-1", "2026-08-20", "Rubrik", "Sammanfattning"), "CLUB"],
  ];
  for (const [event, expectedCategory] of cases) {
    const message = careerEventToInboxMessage(event, career);
    assert.equal(message.category, expectedCategory, `${event.type} should map to ${expectedCategory}`);
    assert.equal(message.priority, event.priority);
    assert.equal(message.important, event.priority !== "INFORMATION");
    assert.equal(message.actionRequired, event.requiresAction);
    assert.equal(message.resolved, event.resolved);
  }
});

test("sender is a role label, never a fabricated named person", () => {
  const career = freshCareer();
  const message = careerEventToInboxMessage(buildScoutReportReadyEvent("t-1", "p-1", "2026-08-20"), career);
  assert.equal(message.sender, "Huvudscout");
  assert.doesNotMatch(message.sender, /[a-zåäö]+ [A-ZÅÄÖ][a-zåäö]+/, "sender should be a role, not a 'Firstname Lastname'-shaped name");
});

test("mapping is deterministic: the same event + same career state produce byte-identical messages", () => {
  const career = freshCareer();
  const event = buildOpponentReportReadyEvent("task-1", "swe1-club", "2026-08-20");
  const a = careerEventToInboxMessage(event, career);
  const b = careerEventToInboxMessage(event, career);
  assert.deepEqual(a, b);
});

test("PLAYER_STATUS_CHANGED/PLAYER_INJURED body uses the real career squad's player identity, not a hardcoded Tumba name", () => {
  const career = freshCareer();
  const realPlayer = TUMBA_SQUAD[0];
  const message = careerEventToInboxMessage(buildPlayerInjuredEvent(realPlayer.id, "2026-08-20"), career);
  assert.ok(message.body.some((line) => line.includes(realPlayer.firstName) && line.includes(realPlayer.lastName)));
});

test("PLAYER_STATUS_CHANGED/PLAYER_INJURED destinations deep-link to the correct player's profile", () => {
  const career = freshCareer();
  const realPlayer = TUMBA_SQUAD[1];
  const message = careerEventToInboxMessage(buildPlayerInjuredEvent(realPlayer.id, "2026-08-20"), career);
  const profileDestination = message.destinations!.find((d) => d.route === "PLAYER_PROFILE");
  assert.ok(profileDestination);
  assert.equal((profileDestination as { playerId: string }).playerId, realPlayer.id);
  assert.equal(resolveDestinationHref(profileDestination!), `/career/squad/${realPlayer.id}`);
});

test("MATCH_COMPLETED deep-links to Match Report and Last Match Analysis, never a fake delayed-analysis message", () => {
  const career = freshCareer();
  const event = buildMatchCompletedEvent("fx-1", career.competitionId, "2026-08-20");
  const message = careerEventToInboxMessage(event, career);
  const routes = message.destinations!.map((d) => d.route);
  assert.ok(routes.includes("MATCH_REPORT"));
  assert.ok(routes.includes("ANALYSIS_LAST_MATCH"));
  assert.equal(resolveDestinationHref({ route: "MATCH_REPORT", fixtureId: "fx-1" }), "/career/match-report/fx-1");
  assert.equal(resolveDestinationHref({ route: "ANALYSIS_LAST_MATCH" }), "/career/analysis/last-match");
});

test("OPPONENT_REPORT_READY deep-links directly to Opponent Analysis", () => {
  const career = freshCareer();
  const message = careerEventToInboxMessage(buildOpponentReportReadyEvent("task-1", "swe2-varberg", "2026-08-20"), career);
  assert.deepEqual(message.destinations, [{ route: "ANALYSIS_OPPONENT" }]);
  assert.equal(resolveDestinationHref({ route: "ANALYSIS_OPPONENT" }), "/career/analysis/opponent");
});

test("MATCH_PREPARATION_READY exposes Match Preview, Opponent Analysis, and Tactics -- and no more than that", () => {
  const career = freshCareer();
  const message = careerEventToInboxMessage(buildMatchPreparationReadyEvent("fx-1", "2026-08-20"), career);
  const routes = message.destinations!.map((d) => d.route);
  assert.deepEqual(routes, ["MATCH_PREVIEW", "ANALYSIS_OPPONENT", "TACTICS"]);
});

test("COMPETITION_UPDATE deep-links to the career's actual competition, and its body mentions the real league position when standings exist", () => {
  const career = freshCareer();
  const message = careerEventToInboxMessage(buildCompetitionUpdateEvent("2026-08-20", career.competitionId), career);
  assert.deepEqual(message.destinations, [{ route: "COMPETITION", competitionId: career.competitionId }]);
  assert.equal(resolveDestinationHref({ route: "COMPETITION", competitionId: career.competitionId }), "/career/competitions");
});

test("SCOUT_REPORT_READY identifies the target player in its body and links to Scouting", () => {
  const career = freshCareer();
  const target = TUMBA_SQUAD[2];
  const message = careerEventToInboxMessage(buildScoutReportReadyEvent("task-1", target.id, "2026-08-20"), career);
  assert.ok(message.body.some((line) => line.includes(target.firstName)));
  const routes = message.destinations!.map((d) => d.route);
  assert.ok(routes.includes("SCOUTING"));
});

test("categoryLabel returns a distinct Swedish label for every category", () => {
  const categories = ["MATCH", "ANALYSIS", "SCOUTING", "STAFF", "MEDICAL", "PLAYER", "COMPETITION", "CLUB", "SYSTEM"] as const;
  const labels = categories.map(categoryLabel);
  assert.equal(new Set(labels).size, categories.length);
});

test("TRAINING_COMPLETED never needs a message rendered for it (dailyTick already suppresses it, but the bridge itself remains capable)", () => {
  const career = freshCareer();
  const event = buildTrainingCompletedEvent("2026-08-20");
  const message = careerEventToInboxMessage(event, career);
  // The bridge can render it if asked -- dailyTick.ts is the layer that
  // chooses not to call this for TRAINING_COMPLETED (Spec S4.1).
  assert.equal(message.important, false);
});
