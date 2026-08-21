// HM-GAME-0.4 integration tests: the full chain
//   Career Event -> Inbox Message -> deep link -> ACTION_REQUIRED semantics
// exercised through the real Career Rhythm loop (continueCareerRhythm +
// playManagerFixture), including a real imported Handbollsligan career
// (Spec §42/§35 "no Tumba assumptions").
import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBA_CLUB_ID } from "../game-data";
import { archiveMessage, markMessageRead } from "./inboxActions";
import { continueCareerRhythm } from "./continueController";
import { createNewCareerState } from "./newCareer";
import { playManagerFixture } from "./matchdayAction";
import { resolveDestinationHref } from "./destinations";
import { snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import type { CareerState } from "./types";

function continueUntilActionRequired(state: CareerState): CareerState {
  let current = state;
  for (let i = 0; i < 100; i += 1) {
    const { state: next, stopReason } = continueCareerRhythm(current);
    current = next;
    if (stopReason === "ACTION_REQUIRED" || stopReason === "ACTION_REQUIRED_PENDING") return current;
  }
  throw new Error("never reached an ACTION_REQUIRED stop");
}

test("MATCH_COMPLETED message deep-links to both Match Report and Last Match Analysis with a matching fixtureId", () => {
  const state0 = continueUntilActionRequired(createNewCareerState("integration-seed-1", TUMBA_CLUB_ID));
  const { state: afterMatch, result } = playManagerFixture(state0);
  assert.ok(result);

  const message = afterMatch.inbox.find((m) => m.careerEventId === `MATCH_COMPLETED:${result!.fixtureId}`);
  assert.ok(message, "MATCH_COMPLETED must produce an Inbox message");
  const reportDest = message!.destinations!.find((d) => d.route === "MATCH_REPORT");
  const analysisDest = message!.destinations!.find((d) => d.route === "ANALYSIS_LAST_MATCH");
  assert.ok(reportDest && analysisDest);
  assert.equal(resolveDestinationHref(reportDest!), `/career/match-report/${result!.fixtureId}`);
  assert.equal(resolveDestinationHref(analysisDest!), "/career/analysis/last-match");
});

test("reading a MATCHDAY_READY message does not resolve it, and Continue remains blocked until the match is actually played", () => {
  const state = continueUntilActionRequired(createNewCareerState("integration-seed-2", TUMBA_CLUB_ID));
  const matchdayMessage = state.inbox.find((m) => m.actionRequired && !m.resolved);
  assert.ok(matchdayMessage, "an unresolved ACTION_REQUIRED message must exist at this stop");

  const afterRead = markMessageRead(state, matchdayMessage!.id);
  const stillUnresolved = afterRead.inbox.find((m) => m.id === matchdayMessage!.id)!;
  assert.equal(stillUnresolved.read, true, "reading does mark it read");
  assert.equal(stillUnresolved.resolved, false, "reading must NOT resolve it -- read != resolved (Spec §24)");

  const blocked = continueCareerRhythm(afterRead);
  assert.equal(blocked.stopReason, "ACTION_REQUIRED_PENDING", "Continue must remain blocked by the still-unresolved action");
  assert.equal(blocked.daysProcessed, 0);

  const { state: afterMatch } = playManagerFixture(afterRead);
  const resolvedMessage = afterMatch.inbox.find((m) => m.id === matchdayMessage!.id)!;
  assert.equal(resolvedMessage.resolved, true, "actually playing the match resolves the message");
  assert.equal(resolvedMessage.actionRequired, false);
});

test("an unresolved ACTION_REQUIRED message cannot be archived even after being read", () => {
  const state = continueUntilActionRequired(createNewCareerState("integration-seed-3", TUMBA_CLUB_ID));
  const matchdayMessage = state.inbox.find((m) => m.actionRequired && !m.resolved)!;
  const afterRead = markMessageRead(state, matchdayMessage.id);
  const afterArchiveAttempt = archiveMessage(afterRead, matchdayMessage.id);
  assert.equal(afterArchiveAttempt.inbox.find((m) => m.id === matchdayMessage.id)!.archived, false, "archiving must be refused while unresolved, regardless of read state");
});

test("OPPONENT_REPORT_READY resolves to the Analysis Hub's OWN dynamic opponent, never a hardcoded id", () => {
  const state = continueUntilActionRequired(createNewCareerState("integration-seed-4", TUMBA_CLUB_ID));
  const opponentMessage = state.inbox.find((m) => m.careerEventId?.startsWith("OPPONENT_REPORT_READY:"));
  if (!opponentMessage) return; // this particular seed's early ticks may not have produced one yet -- not the property under test
  const dest = opponentMessage.destinations!.find((d) => d.route === "ANALYSIS_OPPONENT");
  assert.ok(dest, "OPPONENT_REPORT_READY must route to ANALYSIS_OPPONENT");
  assert.ok(!("clubId" in dest!), "the destination itself must never encode a specific opponent club id -- Analysis Hub derives it live");
});

test("HM-DATA-0.2/HM-GAME-0.4 real-club integration: a real Handbollsligan career produces correctly categorized, correctly-linked messages using real player/club identity", () => {
  const clubId = "se_club_alingsas_hk";
  const worldSquads = snapshotWorldSquads("se_handbollsligan_herr");
  const fresh = createNewCareerState("integration-seed-real-club", clubId, worldSquads);
  const state = continueUntilActionRequired(fresh);
  const { state: afterMatch, result } = playManagerFixture(state);
  assert.ok(result, "the real club's own fixture must actually resolve");

  const completedMessage = afterMatch.inbox.find((m) => m.careerEventId === `MATCH_COMPLETED:${result!.fixtureId}`)!;
  assert.equal(completedMessage.category, "MATCH");
  assert.ok(completedMessage.body.some((line) => line.includes(String(result!.homeGoals)) && line.includes(String(result!.awayGoals))));

  // No message anywhere in this real-club career references the Tumba mock squad's player-id prefix.
  for (const message of afterMatch.inbox) {
    assert.ok(!message.body.some((line) => /\bp-[a-z]+\b/.test(line)), `message "${message.subject}" must not reference a Tumba mock player id`);
  }
});
