import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePlayerInterest,
  matchesInterestFilter,
} from "./playerInterest";
import { startTransferNegotiation } from "./negotiationIntegration";
import { createNewCareerState } from "../career/newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { getCareerClubSquad } from "../career/careerWorld";
import { caOf } from "../players/dynamicsState";
import { TUMBA_CLUB_ID } from "../game-data";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";
const SAVEHOF_ID = "se_club_ik_savehof";
const TUMBA_ID = TUMBA_CLUB_ID;

function makeTestState(playerClubId: string = TUMBA_ID) {
  const worldSquads = snapshotWorldSquads(HANDBOLLSLIGAN_ID);
  const gameplayRatings = snapshotGameplayRatings(HANDBOLLSLIGAN_ID);
  return createNewCareerState(`interest-test-${playerClubId}`, playerClubId, worldSquads, {}, gameplayRatings);
}

test("HM-PLAYTEST-IMPROVEMENT-02: Allsvenskan club cannot negotiate with top Handbollsligan stars (IMPOSSIBLE gate)", () => {
  const state = makeTestState(TUMBA_ID); // Tumba is Allsvenskan (tier 2)
  const savehofSquad = getCareerClubSquad(state, SAVEHOF_ID);
  assert.ok(savehofSquad.length > 0);

  // Find a top star at Sävehof (CA >= 130)
  const topStar = savehofSquad.find((p) => caOf(state, p.id) >= 130);
  if (topStar) {
    const interest = evaluatePlayerInterest(state, topStar.id, TUMBA_ID);
    assert.equal(interest.interestLevel, "IMPOSSIBLE");
    assert.equal(interest.willEnterNegotiations, false);
    assert.match(interest.reason, /Allsvenskan/i);

    // Attempting to open talks must refuse
    const result = startTransferNegotiation(state, topStar.id, "PERMANENT");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /avböjer samtal direkt/i);
    }
  }
});

test("HM-PLAYTEST-IMPROVEMENT-02: players stepping up in tier are highly interested", () => {
  const state = makeTestState(SAVEHOF_ID); // Sävehof is Handbollsligan (tier 1)
  const tumbaSquad = getCareerClubSquad(state, TUMBA_ID);
  assert.ok(tumbaSquad.length > 0);

  // Pick an Allsvenskan player
  const tumbaPlayer = tumbaSquad[0];
  const interest = evaluatePlayerInterest(state, tumbaPlayer.id, SAVEHOF_ID);
  assert.equal(interest.interestLevel, "HIGH");
  assert.equal(interest.willEnterNegotiations, true);
  assert.match(interest.reason, /Handbollsligan/i);

  const result = startTransferNegotiation(state, tumbaPlayer.id, "PERMANENT");
  assert.equal(result.ok, true);
});

test("HM-PLAYTEST-IMPROVEMENT-02: interest filters (REALISTIC vs PERSUADABLE vs ALL)", () => {
  const realisticInterest = {
    playerId: "p1",
    toClubId: "c1",
    interestLevel: "INTERESTED" as const,
    label: "Intresserad",
    tone: "positive" as const,
    reason: "Ok",
    willEnterNegotiations: true,
    wagePremiumMultiplier: 1.0,
  };

  const unsureInterest = {
    playerId: "p2",
    toClubId: "c1",
    interestLevel: "UNSURE" as const,
    label: "Möjligen övertalbar",
    tone: "caution" as const,
    reason: "Tveksam",
    willEnterNegotiations: true,
    wagePremiumMultiplier: 1.2,
  };

  const impossibleInterest = {
    playerId: "p3",
    toClubId: "c1",
    interestLevel: "IMPOSSIBLE" as const,
    label: "Helt ointresserad",
    tone: "negative" as const,
    reason: "Nej",
    willEnterNegotiations: false,
    wagePremiumMultiplier: 1.0,
  };

  assert.equal(matchesInterestFilter(realisticInterest, "REALISTIC"), true);
  assert.equal(matchesInterestFilter(realisticInterest, "PERSUADABLE"), true);
  assert.equal(matchesInterestFilter(realisticInterest, "ALL"), true);

  assert.equal(matchesInterestFilter(unsureInterest, "REALISTIC"), false);
  assert.equal(matchesInterestFilter(unsureInterest, "PERSUADABLE"), true);
  assert.equal(matchesInterestFilter(unsureInterest, "ALL"), true);

  assert.equal(matchesInterestFilter(impossibleInterest, "REALISTIC"), false);
  assert.equal(matchesInterestFilter(impossibleInterest, "PERSUADABLE"), false);
  assert.equal(matchesInterestFilter(impossibleInterest, "ALL"), true);
});
