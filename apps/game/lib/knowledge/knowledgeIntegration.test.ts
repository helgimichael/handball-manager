// HM-DATA-ALLSVENSKAN-1.1B Parts 11/12/13: knowledge integration proofs
// -- real newCareer flow, mirroring squadStatus.test.ts's own pattern.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { getClubsByCompetition, TUMBA_CLUB_ID } from "../game-data";
import { getClubKnowledgePct, getPlayerKnowledgePct, setClubKnowledgePct, setPlayerKnowledgePct } from "./knowledgeIntegration";
import { DEFAULT_EXTERNAL_KNOWLEDGE_PCT, OWN_CLUB_KNOWLEDGE_PCT } from "./types";
import type { CareerState } from "../career/types";

function freshTumba(seed: string): CareerState {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

test("(1) the manager's own club is always fully known, with no stored row required", () => {
  const state = freshTumba("knowledge-1");
  assert.equal(getClubKnowledgePct(state, TUMBA_CLUB_ID), OWN_CLUB_KNOWLEDGE_PCT);
  assert.equal(state.clubKnowledge[TUMBA_CLUB_ID], undefined, "own club should need no stored row at all");
});

test("(2) an external club with no stored knowledge defaults to DEFAULT_EXTERNAL_KNOWLEDGE_PCT", () => {
  const state = freshTumba("knowledge-2");
  const otherClubId = getClubsByCompetition(state.competitionId).map((c) => c.id).find((id) => id !== TUMBA_CLUB_ID)!;
  assert.equal(getClubKnowledgePct(state, otherClubId), DEFAULT_EXTERNAL_KNOWLEDGE_PCT);
});

test("(3) a fresh career's knowledge maps are empty -- never pre-seeded with one row per club/player in the world", () => {
  const state = freshTumba("knowledge-3");
  assert.deepEqual(state.clubKnowledge, {});
  assert.deepEqual(state.playerKnowledge, {});
});

test("(4) setClubKnowledgePct persists and clamps to [0,100]; is a no-op when re-setting the identical value", () => {
  const state = freshTumba("knowledge-4");
  const otherClubId = getClubsByCompetition(state.competitionId).map((c) => c.id).find((id) => id !== TUMBA_CLUB_ID)!;
  const raised = setClubKnowledgePct(state, otherClubId, 200);
  assert.equal(getClubKnowledgePct(raised, otherClubId), 100);
  const noOp = setClubKnowledgePct(raised, otherClubId, 100);
  assert.equal(noOp, raised);

  const negative = setClubKnowledgePct(state, otherClubId, -50);
  assert.equal(getClubKnowledgePct(negative, otherClubId), 0);
});

test("(5) a player's own knowledge defaults to their club's knowledge, unless a player-specific override exists", () => {
  const state = freshTumba("knowledge-5");
  const otherClubId = getClubsByCompetition(state.competitionId).map((c) => c.id).find((id) => id !== TUMBA_CLUB_ID)!;
  assert.equal(getPlayerKnowledgePct(state, "some-player", otherClubId), DEFAULT_EXTERNAL_KNOWLEDGE_PCT);

  const withRaisedClub = setClubKnowledgePct(state, otherClubId, 60);
  assert.equal(getPlayerKnowledgePct(withRaisedClub, "some-player", otherClubId), 60, "player should inherit the raised club knowledge");

  const withPlayerOverride = setPlayerKnowledgePct(withRaisedClub, "some-player", 90);
  assert.equal(getPlayerKnowledgePct(withPlayerOverride, "some-player", otherClubId), 90, "explicit player-level knowledge should win over the club default");
  assert.equal(getPlayerKnowledgePct(withPlayerOverride, "another-player", otherClubId), 60, "an untouched player at the same club still inherits the club level");
});

test("(6) the manager's own player is always fully known regardless of any stored playerKnowledge row", () => {
  const state = freshTumba("knowledge-6");
  const withLowOverride = setPlayerKnowledgePct(state, "own-player-id", 5);
  assert.equal(getPlayerKnowledgePct(withLowOverride, "own-player-id", TUMBA_CLUB_ID), OWN_CLUB_KNOWLEDGE_PCT);
});

test("(7) a career's knowledge maps survive a JSON save/reload round-trip byte-for-byte", () => {
  const state = freshTumba("knowledge-7");
  const otherClubId = getClubsByCompetition(state.competitionId).map((c) => c.id).find((id) => id !== TUMBA_CLUB_ID)!;
  const withData = setClubKnowledgePct(state, otherClubId, 42);
  const roundTripped = JSON.parse(JSON.stringify(withData)) as CareerState;
  assert.deepEqual(roundTripped.clubKnowledge, withData.clubKnowledge);
  assert.deepEqual(roundTripped.playerKnowledge, withData.playerKnowledge);
});
