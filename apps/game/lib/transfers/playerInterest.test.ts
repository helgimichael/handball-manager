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
import { playerAgeAtDate } from "../development/developmentIntegration";
import { TUMBA_CLUB_ID } from "../game-data";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";
const SAVEHOF_ID = "se_club_ik_savehof";
const TUMBA_ID = TUMBA_CLUB_ID;

function makeTestState(playerClubId: string = TUMBA_ID) {
  const worldSquads = {
    ...snapshotWorldSquads(HANDBOLLSLIGAN_ID),
    ...snapshotWorldSquads("swe-2"),
  };
  const gameplayRatings = {
    ...snapshotGameplayRatings(HANDBOLLSLIGAN_ID),
    ...snapshotGameplayRatings("swe-2"),
  };
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

test("HM-PLAYTEST-IMPROVEMENT-02: interest evaluation uses continuous scoring and never leaks CA in reasons", () => {
  const state = makeTestState(SAVEHOF_ID);
  const squad = getCareerClubSquad(state, SAVEHOF_ID);

  for (const player of squad.slice(0, 10)) {
    const interest = evaluatePlayerInterest(state, player.id, TUMBA_ID);
    assert.ok(typeof interest.score === "number");
    assert.ok(interest.score >= 0 && interest.score <= 100);

    // Reason must NEVER leak internal CA ratings, formulas or brackets
    assert.doesNotMatch(interest.reason, /\bCA\b/i, "Reason must never leak CA");
    assert.doesNotMatch(interest.reason, /\bscore\b/i);
    assert.doesNotMatch(interest.reason, /\b1[0-9]{2}\b/, "Reason must not leak numeric rating brackets");
    assert.doesNotMatch(interest.label, /\bCA\b/i);
  }
});

test("HM-PLAYTEST-IMPROVEMENT-02: exceptional circumstances allow veteran homecoming negotiations", () => {
  const state = makeTestState(TUMBA_ID);
  const savehofSquad = getCareerClubSquad(state, SAVEHOF_ID);
  const veteran = savehofSquad.find((p) => (playerAgeAtDate(p.dateOfBirth, p.birthYear, state.gameDate) ?? 0) >= 32);

  if (veteran) {
    // Inject club history with Tumba
    const stateWithHistory = {
      ...state,
      playerClubHistory: {
        ...state.playerClubHistory,
        [veteran.id]: {
          playerId: veteran.id,
          entries: [{ clubId: TUMBA_ID, fromAge: 16, toAge: 24, appearances: 180, goals: 620 }],
        },
      },
    };

    const interest = evaluatePlayerInterest(stateWithHistory, veteran.id, TUMBA_ID);
    assert.ok(
      interest.interestLevel === "HIGH" ||
        interest.interestLevel === "INTERESTED" ||
        interest.interestLevel === "UNSURE",
      `Former club veteran should be persuadable (got ${interest.interestLevel})`
    );
    assert.equal(interest.willEnterNegotiations, true);
    assert.match(interest.reason, /koppling till klubben|återkomst/i);
  }
});
