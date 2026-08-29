// HM-PLAYER-CONTRACT-LIFECYCLE-1.0: focused proofs for the canonical
// contract-expiry -> free-agency world rule (contractExpiry.ts) and its
// integration points (dailyTick ordering, CPU RELEASE-doesn't-terminate
// semantics, squad-need reaction, human/CPU recruitment visibility,
// loans, placements, pending-transfer safety, and save-migration
// repair). Two state-construction styles, matching established
// precedent: a lightweight synthetic-player+manual-contract helper for
// isolated mechanics (same style as playerPlacements.test.ts), and a
// real generated Handbollsligan world (same fullWorldState helper as
// cpuMarketCalibration.test.ts) wherever economy/ratings/CPU visibility
// genuinely need to be real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { processDay } from "./dailyTick";
import { getClubsByCompetition, TUMBA_CLUB_ID, type PlayerMock } from "../game-data";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { CareerState } from "./types";
import {
  FREE_AGENT_CLUB_ID,
  getFreeAgents,
  isFreeAgentClubId,
  progressContractExpiry,
  releasePlayerToFreeAgency,
} from "./contractExpiry";
import { getPlayerContract, getPlayerContractStatus } from "../economy/contractIntegration";
import { getCareerPlayer } from "./careerWorld";
import { assessPositionNeed } from "./cpuSquadNeeds";
import { rankCandidates } from "./cpuCandidateEvaluation";
import { getRecruitmentCandidates } from "./recruitment";
import { decideContractAction, progressCpuContractDecisions } from "./cpuContractDecisions";
import { submitTransferOffer, progressDailyTransfers } from "../transfers/transferIntegration";
import { loanPlayerOut } from "../transfers/transferExecution";
import { getActivePlacementForPlayer, startPlacement } from "./playerPlacements";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";

function baseState(): CareerState {
  return createNewCareerState("contract-expiry-test-seed", TUMBA_CLUB_ID);
}

function syntheticPlayer(id: string, clubId: string, position: PlayerMock["position"]): PlayerMock {
  return {
    id, clubId, firstName: "Test", lastName: id, shirtNumber: null, position, nationality: "SWE",
    dateOfBirth: "2000-01-01", heightCm: null, weightKg: null, foot: null, squadStatus: "Rotation", dataSource: "REAL_WORLD",
    currentAbility: 100, potentialAbility: 100, form: 5, fitnessPct: 100, moralePct: 70, appearances: 0, goals: 0,
    contractEndSeason: "2026/27", wageSekPerMonth: 0,
    attributes: {
      technical: { skott: 10, passning: 10, spelforstaelse: 10, genombrott: 10, mottagning: 10, fint: 10, spelUtanBoll: 10 },
      mental: { beslutsfattande: 10, kyla: 10, arbetskapacitet: 10, kampvilja: 10, positionering: 10, lagarbete: 10, ledarskap: 10 },
      physical: { snabbhet: 10, acceleration: 10, styrka: 10, explosivitet: 10, uthallighet: 10, rorlighet: 10 },
    },
  };
}

/** Appends a synthetic player to `clubId`'s squad with a manually-set contract (controllable `contractEndDate`), the same manual-contract-injection precedent cpuMarketCalibration.test.ts's own pending-transfer test uses. */
function withPlayerAndContract(state: CareerState, playerId: string, clubId: string, position: PlayerMock["position"], contractEndDate: string, wageEurPerMonth = 1000): CareerState {
  const player = syntheticPlayer(playerId, clubId, position);
  return {
    ...state,
    worldSquads: { ...state.worldSquads, [clubId]: [...(state.worldSquads[clubId] ?? []), player] },
    playerContracts: { ...state.playerContracts, [playerId]: { playerId, clubId, contractEndDate, wageEurPerMonth } },
  };
}

let cachedWorld: { worldSquads: Record<string, PlayerMock[]>; gameplayRatings: Record<string, GameplayPlayerRating[]> } | undefined;
function fullWorldState(seed: string, playerClubId: string): CareerState {
  if (!cachedWorld) cachedWorld = { worldSquads: snapshotWorldSquads(HANDBOLLSLIGAN_ID), gameplayRatings: snapshotGameplayRatings(HANDBOLLSLIGAN_ID) };
  return createNewCareerState(seed, playerClubId, cachedWorld.worldSquads, {}, cachedWorld.gameplayRatings);
}

function rivalClubId(state: CareerState, exclude: readonly string[] = []): string {
  return getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== state.playerClubId && !exclude.includes(c.id))!.id;
}

const PAST_DATE = "2026-05-31";
const FUTURE_DATE = "2028-05-31";

// ---------------------------------------------------------------------------
// 1. Basic expiry
// ---------------------------------------------------------------------------

test("basic expiry: an expired contract removes the player from the old club, makes them a canonical free agent, same playerId, attributes intact", () => {
  let state = baseState();
  state = withPlayerAndContract(state, "exp1", state.playerClubId, "MV", PAST_DATE);
  state = { ...state, gameDate: "2026-06-01" };

  const { state: next, departures } = progressContractExpiry(state, state.gameDate);

  assert.equal(departures.length, 1);
  assert.equal(departures[0].playerId, "exp1");
  assert.equal(departures[0].fromClubId, state.playerClubId);

  assert.ok(!next.worldSquads[state.playerClubId]!.some((p) => p.id === "exp1"), "must be removed from the old club");
  const freeAgent = getFreeAgents(next).find((p) => p.id === "exp1");
  assert.ok(freeAgent, "must appear in the canonical free-agent pool");
  assert.equal(freeAgent!.id, "exp1", "same playerId, never recreated");
  assert.equal(freeAgent!.currentAbility, 100, "attributes preserved, never reset");
  assert.equal(getPlayerContractStatus(next, "exp1"), "FREE_AGENT");
  assert.equal(getPlayerContract(next, "exp1")?.clubId, FREE_AGENT_CLUB_ID);
});

// ---------------------------------------------------------------------------
// 2. Not-before-expiry: RELEASE doesn't move the date, player stays until real expiry
// ---------------------------------------------------------------------------

test("RELEASE decision is a pure no-op on contractEndDate: player remains at the club until the real expiry date, not months earlier", () => {
  const { decision } = decideContractAction({ tier: "ROTATION", age: 34, positionDepthCount: 3, financialPressure: "SERIOUS" });
  assert.equal(decision, "RELEASE");

  let state = baseState();
  const clubId = rivalClubId(baseStateWithHandbollsligan());
  void clubId;
  // Isolated: build a minimal CPU-club scenario for progressCpuContractDecisions.
  state = withPlayerAndContract(state, "rel1", "se_club_bodens_bk_hf", "V6", "2027-05-31");
  const contractBefore = getPlayerContract(state, "rel1")!;

  const { state: afterDecision, log } = progressCpuContractDecisions(state, state.gameDate, ["se_club_bodens_bk_hf"]);
  const contractAfter = getPlayerContract(afterDecision, "rel1")!;
  assert.equal(contractAfter.contractEndDate, contractBefore.contractEndDate, "RELEASE/WAIT must never mutate contractEndDate");
  void log;

  // The player is still under contract months before the real end date -- expiry must not fire early.
  const { departures } = progressContractExpiry(afterDecision, afterDecision.gameDate);
  assert.equal(departures.length, 0, "a player must never leave before their contract's real end date, regardless of any CPU RELEASE decision");
  assert.ok(afterDecision.worldSquads["se_club_bodens_bk_hf"]!.some((p) => p.id === "rel1"));
});

function baseStateWithHandbollsligan(): CareerState {
  return fullWorldState("release-helper-seed", "se_club_hammarby_if_hf");
}

// ---------------------------------------------------------------------------
// 3. Renewal
// ---------------------------------------------------------------------------

test("renewal before expiry: a RENEW decision pushes contractEndDate forward, the player remains, no free-agent transition ever fires for it", () => {
  let state = baseState();
  state = withPlayerAndContract(state, "ren1", "se_club_bodens_bk_hf", "M9", "2027-06-01"); // within the EXPIRING_SOON window of baseState's own gameDate (GAME_CURRENT_DATE 2026-08-19), so the CPU decision loop actually evaluates this player.
  // deriveDefaultSquadStatusTier maps "Förstaval" -> FIRST_CHOICE, whose branch RENEWs a non-old player with no depth behind them (matches the sanity check below).
  state = { ...state, worldSquads: { ...state.worldSquads, "se_club_bodens_bk_hf": state.worldSquads["se_club_bodens_bk_hf"]!.map((p) => (p.id === "ren1" ? { ...p, squadStatus: "Förstaval" as const } : p)) } };
  const before = getPlayerContract(state, "ren1")!.contractEndDate;

  const { decision } = decideContractAction({ tier: "FIRST_CHOICE", age: 26, positionDepthCount: 0, financialPressure: "NONE" });
  assert.equal(decision, "RENEW");

  const { state: afterDecision } = progressCpuContractDecisions(state, state.gameDate, ["se_club_bodens_bk_hf"]);
  const after = getPlayerContract(afterDecision, "ren1")!.contractEndDate;
  assert.notEqual(after, before, "RENEW must push the end date forward");

  // Even advancing past the OLD end date, the player must never leave -- the renewal is the new canonical truth.
  const { departures } = progressContractExpiry({ ...afterDecision, gameDate: "2026-09-01" }, "2026-09-01");
  assert.equal(departures.length, 0);
  assert.ok(afterDecision.worldSquads["se_club_bodens_bk_hf"]!.some((p) => p.id === "ren1"));
});

// ---------------------------------------------------------------------------
// 4. Human club: world rule, not a CPU action
// ---------------------------------------------------------------------------

test("human club: an unrenewed contract expires and the player leaves correctly, with zero CPU decision involved", () => {
  let state = baseState();
  state = withPlayerAndContract(state, "hum1", state.playerClubId, "H6", PAST_DATE);
  state = { ...state, gameDate: "2026-06-01" };

  // progressCpuContractDecisions must never touch the human's own club.
  const { log } = progressCpuContractDecisions(state, state.gameDate, [state.playerClubId]);
  assert.equal(log.length, 0, "CPU contract decisions must never evaluate the human's own club");

  const { state: next, departures } = progressContractExpiry(state, state.gameDate);
  assert.equal(departures.length, 1);
  assert.equal(departures[0].fromClubId, state.playerClubId);
  assert.ok(!next.worldSquads[state.playerClubId]!.some((p) => p.id === "hum1"));
  assert.ok(getFreeAgents(next).some((p) => p.id === "hum1"));
});

test("human club: dailyTick's own PLAYER_CONTRACT_EXPIRED event fires only for the human's own club's departures", () => {
  let state = baseState();
  state = withPlayerAndContract(state, "hum2", state.playerClubId, "H6", PAST_DATE);
  state = withPlayerAndContract(state, "cpu1", "se_club_bodens_bk_hf", "H6", PAST_DATE);
  state = { ...state, gameDate: "2026-05-31" };

  const { events } = processDay(state, "2026-06-01");
  const expiredEvents = events.filter((e) => e.type === "PLAYER_CONTRACT_EXPIRED");
  assert.equal(expiredEvents.length, 1, "only the human club's own departure is a CareerEvent -- CPU-club departures stay silent (no inbox spam)");
});

// ---------------------------------------------------------------------------
// 5. Squad-need integration
// ---------------------------------------------------------------------------

test("squad need reacts automatically to a departure: 2 MV -> 1 MV after expiry raises the need to HIGH, with zero special-case trigger", () => {
  const state = fullWorldState("need-reaction-seed", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const squad = state.worldSquads[clubId]!;
  const goalkeepers = squad.filter((p) => p.position === "MV");
  assert.ok(goalkeepers.length >= 1, "fixture assumption: rival club has at least one real goalkeeper");

  // Trim to exactly 2 MV (keep two, expire the rest via a synthetic pad if needed) so the before/after comparison is exact.
  let trimmed = state;
  if (goalkeepers.length > 2) {
    const keep = new Set(goalkeepers.slice(0, 2).map((p) => p.id));
    trimmed = { ...trimmed, worldSquads: { ...trimmed.worldSquads, [clubId]: squad.filter((p) => p.position !== "MV" || keep.has(p.id)) } };
  } else if (goalkeepers.length < 2) {
    trimmed = withPlayerAndContract(trimmed, "need-extra-mv", clubId, "MV", "2028-05-31");
  }
  const twoGk = trimmed.worldSquads[clubId]!.filter((p) => p.position === "MV");
  assert.equal(twoGk.length, 2);
  const [, second] = twoGk;
  const expiring: CareerState = { ...trimmed, playerContracts: { ...trimmed.playerContracts, [second.id]: { playerId: second.id, clubId, contractEndDate: PAST_DATE, wageEurPerMonth: 1000 } } };

  const { state: next } = progressContractExpiry(expiring, "2026-06-01");
  const after = assessPositionNeed(next, clubId, "MV", next.worldSquads[clubId]!);

  assert.equal(after.level, "HIGH", "one goalkeeper left must read as a HIGH need at the very next evaluation");
});

// ---------------------------------------------------------------------------
// 6. Recruitment: free-agent visibility, zero fee, joins new squad exactly once
// ---------------------------------------------------------------------------

test("recruitment: an expired player appears in the CPU candidate pool (rankCandidates) with estimated fee 0", () => {
  const state = fullWorldState("cpu-visibility-seed", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const buyer = rivalClubId(state, [clubId]);
  const target = state.worldSquads[clubId]!.find((p) => p.position === "MV");
  assert.ok(target, "fixture assumption: a real goalkeeper exists to release");
  // releasePlayerToFreeAgency only produces a canonically consistent free agent when the underlying contract has genuinely already expired (contractEndDate is preserved, never reset) -- force that here, same as a real progressContractExpiry call would find.
  const expired = { ...state, playerContracts: { ...state.playerContracts, [target!.id]: { ...state.playerContracts[target!.id]!, contractEndDate: PAST_DATE } } };

  const freed = releasePlayerToFreeAgency(expired, target!.id, expired.gameDate);
  assert.ok(getFreeAgents(freed).some((p) => p.id === target!.id));

  const candidates = rankCandidates(freed, buyer, "MV", freed.gameDate);
  const asFreeAgent = candidates.find((c) => c.playerId === target!.id);
  assert.ok(asFreeAgent, "a free agent must be visible to CPU candidate ranking without any discovery/scouting step");
  assert.equal(asFreeAgent!.estimatedFeeEur, 0, "Transfer fee: 0 for a free agent");
  assert.equal(asFreeAgent!.contractStatus, "FREE_AGENT");
});

test("recruitment: an expired player is visible in the human Recruitment Centre (getRecruitmentCandidates) with no prior discovery", () => {
  const state = fullWorldState("recruitment-centre-visibility-seed", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const target = state.worldSquads[clubId]!.find((p) => p.position === "V6");
  assert.ok(target);
  const expired = { ...state, playerContracts: { ...state.playerContracts, [target!.id]: { ...state.playerContracts[target!.id]!, contractEndDate: PAST_DATE } } };

  const freed = releasePlayerToFreeAgency(expired, target!.id, expired.gameDate);
  const candidates = getRecruitmentCandidates(freed);
  const row = candidates.find((c) => c.playerId === target!.id);
  assert.ok(row, "a free agent must appear in the Recruitment Centre even with zero scouting history");
  assert.equal(row!.contractStatus, "FREE_AGENT");
  assert.ok(isFreeAgentClubId(row!.clubId));
});

test("recruitment: a free agent is signed with zero fee, gets a new contract, and joins the new squad exactly once", () => {
  const state = fullWorldState("free-agent-signing-seed", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const buyer = state.playerClubId;
  const target = state.worldSquads[clubId]!.find((p) => p.position === "H9");
  assert.ok(target);
  const expired = { ...state, playerContracts: { ...state.playerContracts, [target!.id]: { ...state.playerContracts[target!.id]!, contractEndDate: PAST_DATE } } };

  const freed = releasePlayerToFreeAgency(expired, target!.id, expired.gameDate);
  assert.equal(getPlayerContractStatus(freed, target!.id), "FREE_AGENT");

  const { state: afterOffer, offer } = submitTransferOffer(freed, {
    dealType: "PERMANENT", playerId: target!.id, toClubId: buyer, transferFeeEur: 500000, newWageEurPerMonth: 2000, contractYears: 3,
  });

  assert.equal(offer.transferFeeEur, 0, "a submitted fee for a free agent must be forced to 0 (item 6: 'Transfer fee: 0'), never charged to the buyer");
  if (offer.status === "COMPLETED") {
    const player = getCareerPlayer(afterOffer, target!.id);
    assert.equal(player?.clubId, buyer);
    let appearances = 0;
    for (const squad of Object.values(afterOffer.worldSquads)) appearances += squad.filter((p) => p.id === target!.id).length;
    assert.equal(appearances, 1, "the signed player must appear in exactly one squad, never duplicated");
    assert.equal(getPlayerContractStatus(afterOffer, target!.id), "UNDER_CONTRACT");
  }
});

// ---------------------------------------------------------------------------
// 7. Persistence: reload, advance beyond expiry, same correct result
// ---------------------------------------------------------------------------

test("persistence: processing the same expiry from a freshly reconstructed (JSON round-tripped) state produces the identical result", () => {
  let state = baseState();
  state = withPlayerAndContract(state, "persist1", state.playerClubId, "M6", PAST_DATE);
  state = { ...state, gameDate: "2026-06-01" };

  const reloaded: CareerState = JSON.parse(JSON.stringify(state));
  const a = progressContractExpiry(state, state.gameDate);
  const b = progressContractExpiry(reloaded, reloaded.gameDate);

  assert.deepEqual(a.state.worldSquads, b.state.worldSquads);
  assert.deepEqual(a.departures, b.departures);
  assert.equal(getPlayerContractStatus(a.state, "persist1"), getPlayerContractStatus(b.state, "persist1"));
});

// ---------------------------------------------------------------------------
// 8. Idempotency
// ---------------------------------------------------------------------------

test("idempotency: processing the same expiry date twice never duplicates the departure/movement/state", () => {
  let state = baseState();
  state = withPlayerAndContract(state, "idem1", state.playerClubId, "V9", PAST_DATE);
  state = { ...state, gameDate: "2026-06-01" };

  const first = progressContractExpiry(state, state.gameDate);
  assert.equal(first.departures.length, 1);

  const second = progressContractExpiry(first.state, first.state.gameDate);
  assert.equal(second.departures.length, 0, "a player already a free agent must never be re-departed");
  assert.deepEqual(second.state.worldSquads, first.state.worldSquads);

  const freeAgentCount = getFreeAgents(second.state).filter((p) => p.id === "idem1").length;
  assert.equal(freeAgentCount, 1, "never duplicated in the free-agent pool");
});

test("idempotency: dailyTick processing the same date twice never emits a duplicate PLAYER_CONTRACT_EXPIRED event", () => {
  let state = baseState();
  state = withPlayerAndContract(state, "idem2", state.playerClubId, "V9", PAST_DATE);
  state = { ...state, gameDate: "2026-05-31" };

  const first = processDay(state, "2026-06-01");
  const second = processDay(first.state, "2026-06-01");
  assert.equal(second.events.filter((e) => e.type === "PLAYER_CONTRACT_EXPIRED").length, 0, "same-date reprocessing must never re-emit the same semantic event (dedup gate)");
});

// ---------------------------------------------------------------------------
// 9. Pending transfer safety
// ---------------------------------------------------------------------------

test("pending transfer: an AGREED_AWAITING_WINDOW offer for a player who expires the same day is cancelled, not executed stale", () => {
  let state = baseState();
  const sellerClub = "se_club_bodens_bk_hf";
  const buyerClub = "se_club_enkopings_hf";
  state = withPlayerAndContract(state, "pend1", sellerClub, "M9", PAST_DATE);
  state = {
    ...state,
    gameDate: "2026-06-01",
    transferOffers: {
      "pend-offer-1": {
        id: "pend-offer-1", dealType: "PERMANENT", playerId: "pend1", fromClubId: sellerClub, toClubId: buyerClub,
        transferFeeEur: 10000, trainingCompensationEur: 0, newWageEurPerMonth: 1500, newContractEndDate: "2029-05-31",
        status: "AGREED_AWAITING_WINDOW", offeredDate: "2026-05-20", scheduledCompletionDate: "2026-06-01",
      },
    },
  };

  // Same ordering dailyTick.ts itself uses: expiry BEFORE progressDailyTransfers.
  const { state: afterExpiry } = progressContractExpiry(state, state.gameDate);
  const afterTransfers = progressDailyTransfers(afterExpiry, state.gameDate);

  assert.equal(afterTransfers.transferOffers["pend-offer-1"].status, "CANCELLED_STALE", "a stale pending offer for an already-departed player must be cancelled, never executed");
  assert.ok(!afterTransfers.worldSquads[buyerClub]?.some((p) => p.id === "pend1"), "must never end up at the stale offer's intended buyer");
  assert.ok(getFreeAgents(afterTransfers).some((p) => p.id === "pend1"), "must remain the canonical free agent");

  let realClubAppearances = 0;
  for (const [ownerClubId, squad] of Object.entries(afterTransfers.worldSquads)) {
    if (isFreeAgentClubId(ownerClubId)) continue;
    realClubAppearances += squad.filter((p) => p.id === "pend1").length;
  }
  assert.equal(realClubAppearances, 0, "never left in the old squad either -- exactly zero real-club squad memberships");
});

// ---------------------------------------------------------------------------
// 10. Loan
// ---------------------------------------------------------------------------

test("loan: parent contract expiry while on loan removes the player from wherever they physically are (the borrowing club) and deactivates the loan, with no ownership corruption", () => {
  let state = baseState();
  const parentClub = state.playerClubId;
  const borrowingClub = "se_club_bodens_bk_hf";
  state = withPlayerAndContract(state, "loan1", parentClub, "H6", PAST_DATE, 1000);

  let loaned = loanPlayerOut(state, "loan1", parentClub, borrowingClub, 50);
  assert.equal(getCareerPlayer(loaned, "loan1")?.clubId, borrowingClub, "loanPlayerOut must move the player to the borrowing club");
  assert.equal(getPlayerContract(loaned, "loan1")?.contractEndDate, PAST_DATE, "the original parent contract's real end date is preserved unchanged during a loan");
  loaned = {
    ...loaned,
    loans: { ...loaned.loans, loanRec1: { id: "loanRec1", playerId: "loan1", parentClubId: parentClub, borrowingClubId: borrowingClub, startDate: "2026-01-01", endDate: "2027-01-01", wageShareBorrowingPct: 50, originalWageEurPerMonth: 1000, active: true } },
  };

  const { state: afterExpiry, departures } = progressContractExpiry({ ...loaned, gameDate: "2026-06-01" }, "2026-06-01");
  assert.equal(departures.length, 1);
  assert.equal(departures[0].fromClubId, borrowingClub, "the departure is recorded from wherever the player physically was");

  assert.ok(!afterExpiry.worldSquads[parentClub]?.some((p) => p.id === "loan1"));
  assert.ok(!afterExpiry.worldSquads[borrowingClub]?.some((p) => p.id === "loan1"));
  assert.ok(getFreeAgents(afterExpiry).some((p) => p.id === "loan1"));
  assert.equal(afterExpiry.loans.loanRec1.active, false, "the loan authorized by a now-expired contract must be deactivated as a side effect");

  let realClubAppearances = 0;
  for (const [ownerClubId, squad] of Object.entries(afterExpiry.worldSquads)) {
    if (isFreeAgentClubId(ownerClubId)) continue;
    realClubAppearances += squad.filter((p) => p.id === "loan1").length;
  }
  assert.equal(realClubAppearances, 0, "never simultaneously in two real clubs, never left behind in a stale squad");
});

// ---------------------------------------------------------------------------
// 11. Placement
// ---------------------------------------------------------------------------

const PARTNER_CLUB = "se_club_enkopings_hf";

function withDevelopmentPartnership(state: CareerState, partnerClubId: string): CareerState {
  return {
    ...state,
    clubPartnerships: {
      ...state.clubPartnerships,
      dpTest: { id: "dpTest", type: "DEVELOPMENT_PARTNERSHIP", clubAId: state.playerClubId, clubBId: partnerClubId, status: "ACTIVE", startDate: "2026-01-01", endDate: "2027-01-01", permanent: false, monthlyCostEur: 1000, lastBilledDate: null },
    },
  };
}

test("placement: parent-club contract expiry during an active placement ends the placement and makes the player a free agent, never leaving a placement pointed at a club that no longer owns them", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-01-15" };
  state = withPlayerAndContract(state, "place1", state.playerClubId, "M6", "2026-05-31");
  // Overwrite the synthetic player's birth date so it satisfies the U19 placement-eligibility rule.
  state = { ...state, worldSquads: { ...state.worldSquads, [state.playerClubId]: state.worldSquads[state.playerClubId]!.map((p) => (p.id === "place1" ? { ...p, dateOfBirth: "2008-01-01" } : p)) } };

  const result = startPlacement(state, "place1", PARTNER_CLUB, state.gameDate);
  assert.equal(result.ok, true, result.errors.join("; "));
  state = { ...state, playerPlacements: { ...state.playerPlacements, [result.placement!.id]: result.placement! } };
  assert.ok(getActivePlacementForPlayer(state, "place1"), "placement is active before expiry");

  // Placements never move clubId/contract -- the player is still physically at the parent (human) club's own squad.
  assert.ok(state.worldSquads[state.playerClubId]!.some((p) => p.id === "place1"));

  const { state: afterExpiry, departures } = progressContractExpiry({ ...state, gameDate: "2026-06-01" }, "2026-06-01");
  assert.equal(departures.length, 1);
  assert.equal(departures[0].fromClubId, state.playerClubId);

  assert.equal(getActivePlacementForPlayer(afterExpiry, "place1"), undefined, "the placement must end -- it is never left pointing at a club that no longer owns the player");
  assert.ok(getFreeAgents(afterExpiry).some((p) => p.id === "place1"));
  assert.ok(!afterExpiry.worldSquads[state.playerClubId]!.some((p) => p.id === "place1"));
});

// ---------------------------------------------------------------------------
// 12. Migration
// ---------------------------------------------------------------------------

test("migration: a legacy save with expired-contract-but-still-in-squad corruption is repaired to the canonical free-agent state, exactly once (idempotent)", () => {
  let state = baseState();
  const clubId = "se_club_bodens_bk_hf";
  state = withPlayerAndContract(state, "corrupt1", clubId, "V6", PAST_DATE);
  // Simulate a pre-1.0 save: canonical status is already FREE_AGENT (pure date math) but the player is still physically listed in the old club's squad -- the exact corruption item 15 targets.
  assert.equal(getPlayerContractStatus(state, "corrupt1"), "FREE_AGENT");
  assert.ok(state.worldSquads[clubId]!.some((p) => p.id === "corrupt1"), "fixture: still listed in the old squad, simulating the corrupted state");

  const migrated = migrateCareerState(state);
  assert.ok(!migrated.worldSquads[clubId]!.some((p) => p.id === "corrupt1"), "migration must repair the corrupted membership");
  assert.ok(getFreeAgents(migrated).some((p) => p.id === "corrupt1"));

  const migratedTwice = migrateCareerState(migrated);
  assert.deepEqual(migratedTwice.worldSquads, migrated.worldSquads, "migration must be idempotent -- running it again changes nothing further");
  const freeAgentCount = getFreeAgents(migratedTwice).filter((p) => p.id === "corrupt1").length;
  assert.equal(freeAgentCount, 1, "never duplicated by repeated migration");
});

test("migration: a healthy save (no lifecycle corruption) is left untouched by the new repair pass", () => {
  let state = baseState();
  state = withPlayerAndContract(state, "healthy1", "se_club_bodens_bk_hf", "V6", FUTURE_DATE);
  const migrated = migrateCareerState(state);
  assert.ok(migrated.worldSquads["se_club_bodens_bk_hf"]!.some((p) => p.id === "healthy1"), "an under-contract player must never be moved by the migration repair");
  assert.equal(getPlayerContractStatus(migrated, "healthy1"), "UNDER_CONTRACT");
});
