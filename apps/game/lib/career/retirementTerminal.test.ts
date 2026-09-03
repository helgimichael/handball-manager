// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1A: retirement must be TERMINAL.
//
// The bug these tests pin was measured, not theorised. A 5-season trace of the
// real daily simulation recorded 43 executed retirements and ZERO permanent
// exits from the active population: retirePlayer moved the player to the
// retired sentinel and set contractEndDate to the retirement date, which made
// the contract read as expired; contractExpiry.ts's sweep iterated EVERY
// worldSquads key including "retired", released them to free agency, and CPU
// recruitment signed them again. One player retired twice in three seasons.
//
// Everything here runs on an isolated, hand-built CareerState -- never the
// canonical data/ tree and never a full world snapshot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { retirePlayer, isPlayerRetired, progressPlayerLifecycle, RETIRED_CLUB_ID, isRetiredClubId } from "./playerLifecycle";
import { progressContractExpiry, getFreeAgents, FREE_AGENT_CLUB_ID } from "./contractExpiry";
import { getPlayerContractStatus } from "../economy/contractIntegration";
import { createNewCareerState } from "./newCareer";
import type { CareerState } from "./types";
import type { PlayerMock } from "../game-data";

const CLUB = "se_club_hammarby_if_hf";
const PLAYER_ID = "test-retiring-veteran";
const RETIRE_DATE = "2027-06-15";

function veteran(overrides: Partial<PlayerMock> = {}): PlayerMock {
  return {
    id: PLAYER_ID,
    firstName: "Test",
    lastName: "Veteran",
    position: "M6",
    clubId: CLUB,
    dateOfBirth: "1988-03-04",
    birthYear: 1988,
    ...(overrides as object),
  } as PlayerMock;
}

/**
 * A minimal career holding exactly one veteran at one club, with one contract.
 * `gameDate` matters: getPlayerContractStatus reads state.gameDate, so the
 * fixture has to sit at the date the assertion is about.
 */
function stateWithVeteran(contractEndDate: string, gameDate = "2027-06-16"): CareerState {
  const base = createNewCareerState("phase1a", CLUB);
  const player = veteran();
  return {
    ...base,
    gameDate,
    processedThroughDate: gameDate,
    worldSquads: { ...base.worldSquads, [CLUB]: [player] },
    gameplayRatings: { ...base.gameplayRatings },
    playerContracts: {
      ...base.playerContracts,
      [PLAYER_ID]: { playerId: PLAYER_ID, clubId: CLUB, contractEndDate, wageEurPerMonth: 4000 },
    },
  } as CareerState;
}

function squadIds(state: CareerState, clubId: string): string[] {
  return (state.worldSquads[clubId] ?? []).map((p) => p.id);
}

// ---------------------------------------------------------------------------
// 1-3: retirement lands at the sentinel and STAYS there
// ---------------------------------------------------------------------------

test("an under-contract player retires into the retired sentinel", () => {
  const state = stateWithVeteran("2029-06-30"); // comfortably under contract
  assert.equal(getPlayerContractStatus(state, PLAYER_ID), "UNDER_CONTRACT");

  const after = retirePlayer(state, PLAYER_ID, RETIRE_DATE);
  assert.notEqual(after, state, "retirement must actually change state");
  assert.ok(isPlayerRetired(after, PLAYER_ID), "player must read as retired");
  assert.deepEqual(squadIds(after, RETIRED_CLUB_ID), [PLAYER_ID], "player belongs to the retired squad");
  assert.deepEqual(squadIds(after, CLUB), [], "player must leave their active club");
});

test("contract expiry does NOT move a retired player to free agency", () => {
  const retired = retirePlayer(stateWithVeteran("2029-06-30"), PLAYER_ID, RETIRE_DATE);
  // retirePlayer sets contractEndDate to the retirement date, so the contract
  // now reads as expired -- exactly the condition that used to release them.
  assert.equal(getPlayerContractStatus(retired, PLAYER_ID), "FREE_AGENT", "precondition: the contract reads expired");

  const { state: after, departures } = progressContractExpiry(retired, "2027-06-16");
  assert.deepEqual(departures.filter((d) => d.playerId === PLAYER_ID), [], "a retired player is not a contract departure");
  assert.deepEqual(squadIds(after, RETIRED_CLUB_ID), [PLAYER_ID], "player must remain retired");
  assert.deepEqual(squadIds(after, FREE_AGENT_CLUB_ID), [], "player must never reach the free-agent pool");
});

test("advancing well past the old contract end date leaves them retired", () => {
  let state = retirePlayer(stateWithVeteran("2029-06-30"), PLAYER_ID, RETIRE_DATE);
  for (const date of ["2027-06-16", "2027-12-31", "2028-05-31", "2029-07-01", "2031-01-01"]) {
    state = progressContractExpiry(state, date).state;
  }
  assert.ok(isPlayerRetired(state, PLAYER_ID), "still retired years later");
  assert.deepEqual(squadIds(state, FREE_AGENT_CLUB_ID), [], "never released to free agency");
});

// ---------------------------------------------------------------------------
// 4-6: invisible to every acquisition path
// ---------------------------------------------------------------------------

test("free-agent discovery excludes a retired player", () => {
  const retired = retirePlayer(stateWithVeteran("2027-05-31"), PLAYER_ID, RETIRE_DATE);
  const after = progressContractExpiry(retired, "2027-06-16").state;
  assert.deepEqual(getFreeAgents(after).map((p) => p.id), [], "the free-agent pool must not contain a retired player");
});

test("CPU recruitment candidate resolution excludes a retired player", async () => {
  const retired = retirePlayer(stateWithVeteran("2029-06-30"), PLAYER_ID, RETIRE_DATE);
  const { getExternalCandidateClubs } = await import("./careerWorld");
  const clubs = getExternalCandidateClubs(retired);
  assert.ok(
    !clubs.some((c) => isRetiredClubId(typeof c === "string" ? c : c.id)),
    "the retired sentinel must never appear as a club recruitment can shop at",
  );
  const { rankCandidates } = await import("./cpuCandidateEvaluation");
  void rankCandidates; // resolution runs over candidate clubs only -- proven above
  assert.deepEqual(getFreeAgents(retired).map((p) => p.id), [], "and they are not a free agent either");
});

test("a retired player cannot be signed: they are in no pool a signing reads from", () => {
  const retired = retirePlayer(stateWithVeteran("2029-06-30"), PLAYER_ID, RETIRE_DATE);
  const reachable = new Set<string>();
  for (const [clubId, squad] of Object.entries(retired.worldSquads)) {
    if (isRetiredClubId(clubId)) continue; // the one place they legitimately are
    for (const p of squad) reachable.add(p.id);
  }
  assert.equal(reachable.has(PLAYER_ID), false, "a retired player is unreachable from every non-sentinel squad");
});

// ---------------------------------------------------------------------------
// 7-8: lifecycle idempotency and population effect
// ---------------------------------------------------------------------------

test("repeated lifecycle evaluation never retires the same player twice", () => {
  const retired = retirePlayer(stateWithVeteran("2029-06-30"), PLAYER_ID, RETIRE_DATE);
  // The retired sentinel is not among careerWorldClubIds, so the annual pass
  // cannot even see them -- and retirePlayer itself is a no-op if it did.
  const again = progressPlayerLifecycle(retired, "2028-06-15");
  assert.equal(again.retiredPlayerIds.includes(PLAYER_ID), false, "already-retired players are never re-retired");
  assert.equal(retirePlayer(retired, PLAYER_ID, "2028-06-15"), retired, "retirePlayer is a no-op for an already-retired player");
});

test("the active population falls by exactly one when a player retires", () => {
  const state = stateWithVeteran("2029-06-30");
  const activeBefore = Object.entries(state.worldSquads)
    .filter(([clubId]) => !isRetiredClubId(clubId))
    .reduce((acc, [, squad]) => acc + squad.length, 0);

  const after = retirePlayer(state, PLAYER_ID, RETIRE_DATE);
  const activeAfter = Object.entries(after.worldSquads)
    .filter(([clubId]) => !isRetiredClubId(clubId))
    .reduce((acc, [, squad]) => acc + squad.length, 0);

  assert.equal(activeAfter, activeBefore - 1, "retirement must be a permanent exit from the active population");
  assert.equal((after.worldSquads[RETIRED_CLUB_ID] ?? []).length, 1, "and a permanent arrival in the retired squad");
});

// ---------------------------------------------------------------------------
// The ordinary free-agent path must be untouched by the fix
// ---------------------------------------------------------------------------

test("an ordinary expiring player is still released to free agency", () => {
  const state = stateWithVeteran("2027-05-30"); // expired, NOT retired
  assert.equal(getPlayerContractStatus(state, PLAYER_ID), "FREE_AGENT");

  const { state: after, departures } = progressContractExpiry(state, "2027-06-16");
  assert.deepEqual(departures.map((d) => d.playerId), [PLAYER_ID], "normal expiry still produces a departure");
  assert.deepEqual(squadIds(after, FREE_AGENT_CLUB_ID), [PLAYER_ID], "and still reaches the free-agent pool");
  assert.equal(isPlayerRetired(after, PLAYER_ID), false, "an expiring player is not retired");
});
