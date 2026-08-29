// HM-CPU-SQUAD-BUILDING-1.0B: regression + stabilization proofs for the
// corruption/churn issues the 1.0A market audit found -- overlapping
// pending transfers, stale fromClubId execution, the squad-need quality
// feedback loop, pending-incoming depth projection, WAIT log dedup, and
// the smoothed international reach model. Real generated careers for
// anything touching the actual transfer pipeline (same precedent as
// transferExecution.test.ts/cpuSquadBuilding.test.ts); lighter synthetic
// fixtures for pure squad-need scoring, where real-world data isn't
// needed to prove the rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { getClubsByCompetition, type PlayerMock } from "../game-data";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { getCareerPlayer } from "./careerWorld";
import { getPlayerContract, getPlayerMarketValueEur } from "../economy/contractIntegration";
import { submitTransferOffer, progressDailyTransfers, hasActivePendingTransfer } from "../transfers/transferIntegration";
import { addDays } from "./dateUtils";
import type { CareerState } from "./types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { assessPositionNeed, priorityNeeds, assessSquadNeeds } from "./cpuSquadNeeds";
import { rankCandidates, ownLevelScore } from "./cpuCandidateEvaluation";
import { progressCpuRecruitment, cpuRecruiterClubIds, getCpuRecruitmentPlansForClub } from "./cpuRecruitment";
import { progressCpuContractDecisions } from "./cpuContractDecisions";
import { WORLD_POOL_COMPETITION_IDS } from "./careerWorld";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";
const CLOSED_WINDOW_DATE = "2026-11-15"; // outside both summer (Jun-Sep) and winter (Jan) windows -- every PERMANENT deal here lands AGREED_AWAITING_WINDOW.

// Snapshotting real-world data is expensive -- computed ONCE per shape
// and reused across every test in this file (createNewCareerState itself
// is cheap given pre-fetched data).
let cachedHblSnapshots: { worldSquads: Record<string, PlayerMock[]>; gameplayRatings: Record<string, GameplayPlayerRating[]> } | undefined;
let cachedHblPlusIntlSnapshots: { worldSquads: Record<string, PlayerMock[]>; gameplayRatings: Record<string, GameplayPlayerRating[]> } | undefined;

function fullWorldState(seed: string, playerClubId: string): CareerState {
  if (!cachedHblSnapshots) {
    cachedHblSnapshots = { worldSquads: snapshotWorldSquads(HANDBOLLSLIGAN_ID), gameplayRatings: snapshotGameplayRatings(HANDBOLLSLIGAN_ID) };
  }
  return createNewCareerState(seed, playerClubId, cachedHblSnapshots.worldSquads, {}, cachedHblSnapshots.gameplayRatings);
}

/** Like fullWorldState, but also snapshots every World Pool competition -- only the international-reach test needs this (real Division1/domestic-only fixtures have zero international candidates by construction, which would make that test meaningless). */
function fullWorldStateWithIntl(seed: string, playerClubId: string): CareerState {
  if (!cachedHblPlusIntlSnapshots) {
    let worldSquads = snapshotWorldSquads(HANDBOLLSLIGAN_ID);
    let gameplayRatings = snapshotGameplayRatings(HANDBOLLSLIGAN_ID);
    for (const id of WORLD_POOL_COMPETITION_IDS) {
      worldSquads = { ...worldSquads, ...snapshotWorldSquads(id) };
      gameplayRatings = { ...gameplayRatings, ...snapshotGameplayRatings(id) };
    }
    cachedHblPlusIntlSnapshots = { worldSquads, gameplayRatings };
  }
  return createNewCareerState(seed, playerClubId, cachedHblPlusIntlSnapshots.worldSquads, {}, cachedHblPlusIntlSnapshots.gameplayRatings);
}

function rivalClubId(state: CareerState, exclude: readonly string[] = []): string {
  return getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== state.playerClubId && !exclude.includes(c.id))!.id;
}

/** A realistic, market-value-anchored bid -- avoids the affordability check rejecting the offer before the invariant under test is even reached. */
function realisticBid(state: CareerState, playerId: string): { feeEur: number; wageEurPerMonth: number } {
  const marketValue = getPlayerMarketValueEur(state, playerId) ?? 1000;
  const currentWage = getPlayerContract(state, playerId)?.wageEurPerMonth ?? 0;
  return { feeEur: Math.round(marketValue), wageEurPerMonth: Math.round(currentWage * 1.1) };
}

function syntheticPlayer(id: string, clubId: string, position: PlayerMock["position"], dateOfBirth = "2000-01-01"): PlayerMock {
  return {
    id, clubId, firstName: "Test", lastName: id, shirtNumber: null, position, nationality: "SWE",
    dateOfBirth, heightCm: null, weightKg: null, foot: null, squadStatus: "Rotation", dataSource: "REAL_WORLD",
    currentAbility: 100, potentialAbility: 100, form: 5, fitnessPct: 100, moralePct: 70, appearances: 0, goals: 0,
    contractEndSeason: "2026/27", wageSekPerMonth: 0,
    attributes: {
      technical: { skott: 10, passning: 10, spelforstaelse: 10, genombrott: 10, mottagning: 10, fint: 10, spelUtanBoll: 10 },
      mental: { beslutsfattande: 10, kyla: 10, arbetskapacitet: 10, kampvilja: 10, positionering: 10, lagarbete: 10, ledarskap: 10 },
      physical: { snabbhet: 10, acceleration: 10, styrka: 10, explosivitet: 10, uthallighet: 10, rorlighet: 10 },
    },
  };
}

/**
 * Replaces ONLY the given position's players with `count` synthetic
 * (weak, CA~100) ones, leaving every OTHER real position untouched --
 * critical for the quality-rule tests, which compare the target
 * position's own average CA against the CLUB's overall average: if this
 * replaced the whole squad, position average would trivially equal club
 * average (both would be the same synthetic players) and the rule could
 * never be exercised honestly.
 */
function withSyntheticSquad(state: CareerState, clubId: string, count: number, position: PlayerMock["position"] = "MV"): CareerState {
  const players = Array.from({ length: count }, (_, i) => syntheticPlayer(`${clubId}-${position}-${i}`, clubId, position));
  const ratingPosition = position === "MV" ? "GK" : position;
  const ratings: GameplayPlayerRating[] = players.map((p, i) => ({
    playerId: p.id, position: ratingPosition, ca: 100 + i, pa: 150, caSource: "GENERATED_GAME_PRIOR" as GameplayPlayerRating["caSource"],
    branch: { branch: position === "MV" ? "GOALKEEPER" : "OUTCOURT", attributes: {} } as GameplayPlayerRating["branch"],
    attackRoleProficiencies: [], defenceRoleProficiencies: [], attributeGenerationModelVersion: "test", locked: false,
  }));
  const restOfSquad = (state.worldSquads[clubId] ?? []).filter((p) => p.position !== position);
  const restOfSquadIds = new Set(restOfSquad.map((p) => p.id));
  const restOfRatings = (state.gameplayRatings[clubId] ?? []).filter((r) => restOfSquadIds.has(r.playerId));
  return {
    ...state,
    worldSquads: { ...state.worldSquads, [clubId]: [...restOfSquad, ...players] },
    gameplayRatings: { ...state.gameplayRatings, [clubId]: [...restOfRatings, ...ratings] },
  };
}

// ---------------------------------------------------------------------------
// Part 1/4: overlapping offer prevention
// ---------------------------------------------------------------------------

test("BLOCKED_PENDING_TRANSFER: a second offer for a player who already has an AGREED_AWAITING_WINDOW offer is rejected outright", () => {
  const state = fullWorldState("stabilize-pending-1", "se_club_hammarby_if_hf");
  const buyerB = rivalClubId(state);
  const buyerC = rivalClubId(state, [buyerB]);
  const sellerA = rivalClubId(state, [buyerB, buyerC]);
  const player = state.worldSquads[sellerA][0];

  const stateOnClosedWindow = { ...state, gameDate: CLOSED_WINDOW_DATE };
  const bid = realisticBid(stateOnClosedWindow, player.id);
  const first = submitTransferOffer(stateOnClosedWindow, { dealType: "PERMANENT", playerId: player.id, toClubId: buyerB, transferFeeEur: bid.feeEur, newWageEurPerMonth: bid.wageEurPerMonth, contractYears: 3 });
  assert.equal(first.offer.status, "AGREED_AWAITING_WINDOW");

  assert.equal(hasActivePendingTransfer(first.state, player.id), true);

  const bid2 = realisticBid(first.state, player.id);
  const second = submitTransferOffer(first.state, { dealType: "PERMANENT", playerId: player.id, toClubId: buyerC, transferFeeEur: bid2.feeEur, newWageEurPerMonth: bid2.wageEurPerMonth, contractYears: 3 });
  assert.equal(second.offer.status, "BLOCKED_PENDING_TRANSFER");
  // The player must not have moved at all from the second (blocked) attempt.
  assert.equal(getCareerPlayer(second.state, player.id)?.clubId, sellerA);
});

test("AGREED_AWAITING_WINDOW candidate excluded: rankCandidates never surfaces a player who already has a pending deal", () => {
  const state = fullWorldState("stabilize-pending-2", "se_club_hammarby_if_hf");
  const buyerB = rivalClubId(state);
  const buyerC = rivalClubId(state, [buyerB]);
  const sellerA = rivalClubId(state, [buyerB, buyerC]);
  const player = state.worldSquads[sellerA][0];

  const stateOnClosedWindow = { ...state, gameDate: CLOSED_WINDOW_DATE };
  const bid = realisticBid(stateOnClosedWindow, player.id);
  const { state: afterFirst, offer } = submitTransferOffer(stateOnClosedWindow, { dealType: "PERMANENT", playerId: player.id, toClubId: buyerB, transferFeeEur: bid.feeEur, newWageEurPerMonth: bid.wageEurPerMonth, contractYears: 3 });
  assert.equal(offer.status, "AGREED_AWAITING_WINDOW");

  const candidates = rankCandidates(afterFirst, buyerC, player.position, CLOSED_WINDOW_DATE);
  assert.ok(!candidates.some((c) => c.playerId === player.id), "a player with a pending deal must never appear as a candidate for a different buyer");
});

// ---------------------------------------------------------------------------
// Part 2/3/4: ownership execution guard + squad uniqueness
// ---------------------------------------------------------------------------

test("stale fromClubId cannot execute: reproduces the exact 1.0A corruption class end-to-end", () => {
  const state = fullWorldState("stabilize-corruption", "se_club_hammarby_if_hf");
  const buyerB = rivalClubId(state);
  const buyerC = rivalClubId(state, [buyerB]);
  const sellerA = rivalClubId(state, [buyerB, buyerC]);
  const player = state.worldSquads[sellerA][0];

  const stateOnClosedWindow = { ...state, gameDate: CLOSED_WINDOW_DATE };
  const bid = realisticBid(stateOnClosedWindow, player.id);
  const { state: afterFirst, offer: firstOffer } = submitTransferOffer(stateOnClosedWindow, { dealType: "PERMANENT", playerId: player.id, toClubId: buyerB, transferFeeEur: bid.feeEur, newWageEurPerMonth: bid.wageEurPerMonth, contractYears: 3 });
  assert.equal(firstOffer.status, "AGREED_AWAITING_WINDOW");

  // Manually construct the exact pre-1.0B pathological state: a SECOND
  // AGREED_AWAITING_WINDOW offer for the SAME player with the SAME stale
  // fromClubId, as if it had been created before the BLOCKED_PENDING_TRANSFER
  // guard existed (Part 2/4's own defense-in-depth: this must still be
  // safe even if a stale offer somehow exists, e.g. on an old save).
  const staleOfferId = "stale-test-offer";
  const staleOffer = { ...firstOffer, id: staleOfferId, toClubId: buyerC, transferFeeEur: 2_000_000 };
  let stateWithStaleOffer: CareerState = { ...afterFirst, transferOffers: { ...afterFirst.transferOffers, [staleOfferId]: staleOffer } };

  // Open the window and let progressDailyTransfers execute both.
  const windowOpenDate = "2027-06-15";
  stateWithStaleOffer = { ...stateWithStaleOffer, gameDate: windowOpenDate };
  const executed = progressDailyTransfers(stateWithStaleOffer, windowOpenDate);

  // The legitimate first offer completed normally.
  assert.equal(executed.transferOffers[firstOffer.id].status, "COMPLETED");
  // The stale second offer must be cancelled, never executed.
  assert.equal(executed.transferOffers[staleOfferId].status, "CANCELLED_STALE");

  // Squad uniqueness invariant: the player exists in EXACTLY one club's squad.
  const clubsContainingPlayer = Object.entries(executed.worldSquads).filter(([, squad]) => squad.some((p) => p.id === player.id));
  assert.equal(clubsContainingPlayer.length, 1, `expected the player in exactly one squad, found: ${clubsContainingPlayer.map(([id]) => id).join(", ")}`);
  assert.equal(clubsContainingPlayer[0][0], buyerB, "player must be at the club the LEGITIMATE offer targeted");
  assert.ok(!executed.worldSquads[buyerC]?.some((p) => p.id === player.id), "player must NOT be duplicated into the stale offer's target club");
  assert.ok(!executed.worldSquads[sellerA]?.some((p) => p.id === player.id), "player must be absent from the original selling club");

  // Contract/rating consistency: contract.clubId matches the real destination.
  const finalContract = getPlayerContract(executed, player.id)!;
  assert.equal(finalContract.clubId, buyerB);
  assert.ok(executed.gameplayRatings[buyerB]?.some((r) => r.playerId === player.id));
  assert.ok(!executed.gameplayRatings[buyerC]?.some((r) => r.playerId === player.id));

  // Re-running progressDailyTransfers again later must never re-execute the stale offer.
  const rerun = progressDailyTransfers(executed, addDays(windowOpenDate, 30));
  assert.equal(rerun.transferOffers[staleOfferId].status, "CANCELLED_STALE");
  assert.equal(Object.entries(rerun.worldSquads).filter(([, squad]) => squad.some((p) => p.id === player.id)).length, 1);
});

test("persistence/reload: the corruption-free invariant survives a save/migrate round-trip", () => {
  const state = fullWorldState("stabilize-persist", "se_club_hammarby_if_hf");
  const buyerB = rivalClubId(state);
  const sellerA = rivalClubId(state, [buyerB]);
  const player = state.worldSquads[sellerA][0];

  const stateOnClosedWindow = { ...state, gameDate: CLOSED_WINDOW_DATE };
  const bid = realisticBid(stateOnClosedWindow, player.id);
  const { state: afterOffer, offer } = submitTransferOffer(stateOnClosedWindow, { dealType: "PERMANENT", playerId: player.id, toClubId: buyerB, transferFeeEur: bid.feeEur, newWageEurPerMonth: bid.wageEurPerMonth, contractYears: 3 });
  assert.equal(offer.status, "AGREED_AWAITING_WINDOW");
  const executed = progressDailyTransfers({ ...afterOffer, gameDate: "2027-06-15" }, "2027-06-15");

  // Simulate a save/reload round-trip via JSON (exactly what localStorage persistence does) + migration.
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(executed)));
  const clubsContainingPlayer = Object.entries(reloaded.worldSquads).filter(([, squad]) => (squad as PlayerMock[]).some((p) => p.id === player.id));
  assert.equal(clubsContainingPlayer.length, 1);
  assert.equal(getPlayerContract(reloaded, player.id)?.clubId, buyerB);
});

// ---------------------------------------------------------------------------
// Part 6/7: pending incoming counts toward projected depth
// ---------------------------------------------------------------------------

test("pending incoming counts toward depth: an AGREED_AWAITING_WINDOW signee lowers the buyer's own need for that position", () => {
  let state = fullWorldState("stabilize-incoming", "se_club_hammarby_if_hf");
  const buyer = rivalClubId(state);
  state = withSyntheticSquad(state, buyer, 1, "MV"); // exactly one usable MV -> HIGH need on its own.
  const before = assessPositionNeed(state, buyer, "MV", state.worldSquads[buyer]);
  assert.equal(before.level, "HIGH");

  const sellerA = rivalClubId(state, [buyer]);
  const incomingGk = syntheticPlayer("incoming-gk", sellerA, "MV");
  state = { ...state, worldSquads: { ...state.worldSquads, [sellerA]: [...state.worldSquads[sellerA], incomingGk] } };
  const contract = { playerId: incomingGk.id, clubId: sellerA, contractEndDate: "2028-06-30", wageEurPerMonth: 1000 };
  state = { ...state, playerContracts: { ...state.playerContracts, [incomingGk.id]: contract } };
  state = {
    ...state,
    transferOffers: {
      ...state.transferOffers,
      "pending-gk-offer": {
        id: "pending-gk-offer", dealType: "PERMANENT", playerId: incomingGk.id, fromClubId: sellerA, toClubId: buyer,
        transferFeeEur: 1000, trainingCompensationEur: 0, newWageEurPerMonth: 1000, newContractEndDate: "2030-06-30",
        status: "AGREED_AWAITING_WINDOW", offeredDate: state.gameDate, scheduledCompletionDate: "2027-06-01",
      },
    },
  };

  const after = assessPositionNeed(state, buyer, "MV", state.worldSquads[buyer]);
  assert.equal(after.pendingIncoming, 1);
  assert.notEqual(after.level, "HIGH", "an already-agreed incoming goalkeeper should lower urgency from HIGH");
});

// ---------------------------------------------------------------------------
// Part 5: squad-need feedback loop / goalkeeper count scenarios
// ---------------------------------------------------------------------------

test("1 GK = HIGH", () => {
  const state = fullWorldState("stabilize-gk-1", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const withGk = withSyntheticSquad(state, clubId, 1, "MV");
  assert.equal(assessPositionNeed(withGk, clubId, "MV", withGk.worldSquads[clubId]).level, "HIGH");
});

test("2 GK is MEDIUM (sensible, not HIGH, not satisfied)", () => {
  const state = fullWorldState("stabilize-gk-2", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const withGk = withSyntheticSquad(state, clubId, 2, "MV");
  assert.equal(assessPositionNeed(withGk, clubId, "MV", withGk.worldSquads[clubId]).level, "MEDIUM");
});

test("3 usable GK is satisfied (LOW), even when their average quality is weak relative to the club", () => {
  const state = fullWorldState("stabilize-gk-3", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  // 3 weak goalkeepers (CA ~100-102) alongside the real (much stronger) outfield squad -- exactly the scenario the 85% rule used to keep escalating.
  const withGk = withSyntheticSquad(state, clubId, 3, "MV");
  const assessment = assessPositionNeed(withGk, clubId, "MV", withGk.worldSquads[clubId]);
  assert.equal(assessment.level, "LOW");
});

test("5+ GK never generates HIGH solely from the quality rule (the confirmed 1.0A feedback loop)", () => {
  const state = fullWorldState("stabilize-gk-5", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  for (const count of [5, 7, 10]) {
    const withGk = withSyntheticSquad(state, clubId, count, "MV");
    const assessment = assessPositionNeed(withGk, clubId, "MV", withGk.worldSquads[clubId]);
    assert.notEqual(assessment.level, "HIGH", `${count} goalkeepers must never register as HIGH need`);
    assert.notEqual(assessment.level, "MEDIUM", `${count} goalkeepers must never register as MEDIUM need`);
  }
});

test("quality rule still matters when depth is genuinely thin (1-2 players, weak relative to club)", () => {
  const state = fullWorldState("stabilize-quality-thin", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  // Exactly 2 MVs, deliberately far below any real squad's own average CA
  // (real Handbollsligan CA baselines run ~100+) -- an unambiguous gap
  // regardless of this specific club's own real average, so quality
  // should be able to bump MEDIUM -> HIGH.
  const withGk = withSyntheticSquad(state, clubId, 2, "MV");
  const veryWeak = { ...withGk, gameplayRatings: { ...withGk.gameplayRatings, [clubId]: withGk.gameplayRatings[clubId]!.map((r) => (r.position === "GK" ? { ...r, ca: 20 } : r)) } };
  const assessment = assessPositionNeed(veryWeak, clubId, "MV", veryWeak.worldSquads[clubId]);
  assert.equal(assessment.level, "HIGH", "2 goalkeepers far weaker than the club's own real average should escalate MEDIUM -> HIGH");
  assert.match(assessment.reason, /klart under klubbens eget snitt/);
});

test("solved need clears pursuit: a SEARCHING plan for a now-adequate position transitions to SATISFIED", () => {
  const state = fullWorldState("stabilize-satisfied", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const withOneGk = withSyntheticSquad(state, clubId, 1, "MV"); // HIGH need.

  // Inject a plan that's still ACTIVELY SEARCHING (no candidate resolved
  // yet) -- the real scenario this clears: a pursuit hasn't found/closed
  // a deal, and in the meantime the need resolves some other way (e.g.
  // a pending-incoming signing, or here, direct squad growth).
  const planId = `${clubId}:MV`;
  const searchingPlan = {
    id: planId, clubId, targetPosition: "MV" as const, need: "HIGH" as const, candidatePlayerId: null,
    status: "SEARCHING" as const, createdAt: withOneGk.gameDate, lastEvaluatedAt: withOneGk.gameDate,
    offerId: null, cooldownUntil: null, reason: "test fixture -- still searching",
  };
  let next: CareerState = { ...withOneGk, cpuRecruitmentPlans: { [planId]: searchingPlan } };

  // Squad now has plenty of goalkeepers -- the need is objectively solved.
  next = withSyntheticSquad(next, clubId, 4, "MV");
  next = { ...next, cpuClubEvaluationSchedule: { ...next.cpuClubEvaluationSchedule, [clubId]: next.gameDate } };
  const after = progressCpuRecruitment(next, next.gameDate);
  const planAfter = after.cpuRecruitmentPlans[planId];
  assert.equal(planAfter.status, "SATISFIED");
});

test("one pursuit per position: a club never has two SEARCHING plans for the same position", () => {
  const state = fullWorldState("stabilize-one-pursuit", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const withGk = withSyntheticSquad({ ...state, cpuClubEvaluationSchedule: { [rivalClubId(state)]: state.gameDate } }, clubId, 1, "MV");
  const next = progressCpuRecruitment({ ...withGk, cpuClubEvaluationSchedule: { [clubId]: withGk.gameDate } }, withGk.gameDate);
  const plans = getCpuRecruitmentPlansForClub(next, clubId).filter((p) => p.status === "SEARCHING");
  const positions = plans.map((p) => p.targetPosition);
  assert.equal(new Set(positions).size, positions.length);
});

// ---------------------------------------------------------------------------
// Part 9: WAIT logging deduplication
// ---------------------------------------------------------------------------

test("WAIT logging deduplicated: re-evaluating the same stable WAIT decision every day does not log every day", () => {
  const state = fullWorldState("stabilize-wait-log", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const squad = state.worldSquads[clubId];
  const player = squad.find((p) => p.position !== "MV") ?? squad[0];
  const contract = getPlayerContract(state, player.id)!;
  const withGoodDepth = withSyntheticSquad(state, clubId, 3, player.position); // ensures depth >= 2 so WAIT (not RENEW) is the decision.
  const withExpiring: CareerState = { ...withGoodDepth, playerContracts: { ...withGoodDepth.playerContracts, [player.id]: { ...contract, clubId, contractEndDate: addDays(state.gameDate, 200) } }, worldSquads: { ...withGoodDepth.worldSquads, [clubId]: [...withGoodDepth.worldSquads[clubId], { ...player, clubId }] } };

  let logCount = 0;
  let current = withExpiring;
  let date = current.gameDate;
  for (let i = 0; i < 60; i++) {
    date = addDays(date, 1);
    const result = progressCpuContractDecisions(current, date, [clubId]);
    current = result.state;
    logCount += result.log.filter((e) => e.playerId === player.id).length;
  }
  assert.ok(logCount < 10, `expected far fewer than 60 WAIT log entries over 60 days, got ${logCount}`);
});

test("WAIT logging: decision LOGIC itself is unchanged -- RENEW/RELEASE still happen exactly when expected and are always logged immediately", () => {
  const state = fullWorldState("stabilize-wait-logic", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const player = state.worldSquads[clubId].find((p) => p.position === "MV")!;
  const contract = getPlayerContract(state, player.id)!;
  const expiring = { ...state, playerContracts: { ...state.playerContracts, [player.id]: { ...contract, contractEndDate: addDays(state.gameDate, 90) } } };
  const { log } = progressCpuContractDecisions(expiring, expiring.gameDate, [clubId]);
  const entry = log.find((e) => e.playerId === player.id);
  assert.ok(entry, "a RENEW/RELEASE decision must always be logged the first day it's decided, never delayed by the WAIT throttle");
});

// ---------------------------------------------------------------------------
// Part 10: smoothed international reach
// ---------------------------------------------------------------------------

test("international reach has no hard 130 cliff: score changes gradually, not as a single-point on/off switch", () => {
  const state = fullWorldStateWithIntl("stabilize-intl-smooth", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const withScout = { ...state, staffRoster: { ...state.staffRoster, [clubId]: [{ id: "s1", displayName: "Scout", roles: ["SCOUT"], clubId, nationality: "SWE", attributes: {} } as never] } };

  // Force the WHOLE club's own level to a value just under the old 130
  // cliff -- every rated player, not just one position, so ownLevelScore
  // (which averages the best-per-position CA across up to 7 positions)
  // reliably lands below 130 regardless of this club's real data.
  const lowered: CareerState = {
    ...withScout,
    gameplayRatings: { ...withScout.gameplayRatings, [clubId]: withScout.gameplayRatings[clubId]!.map((r) => ({ ...r, ca: 128 })) },
  };
  const own = ownLevelScore(lowered, clubId);
  assert.ok(own < 130, `expected a below-threshold own level for this fixture, got ${own}`);

  // Find a position with at least one real international candidate in
  // this snapshot (not every position is populated in every competition).
  const worldPoolClubIds = new Set(WORLD_POOL_COMPETITION_IDS.flatMap((id) => getClubsByCompetition(id).map((c) => c.id)));
  const position = (["MV", "V6", "H6", "V9", "M9", "H9", "M6"] as const).find((pos) => [...worldPoolClubIds].some((id) => (lowered.worldSquads[id] ?? []).some((p) => p.position === pos)));
  assert.ok(position, "expected at least one international candidate at some position in this snapshot");

  const candidates = rankCandidates(lowered, clubId, position!, lowered.gameDate);
  // With the OLD hard cliff, a club at ~128 would see ZERO international
  // candidates at all. With the smooth model, international candidates
  // may still appear (penalized in score, not filtered out) as long as
  // the club is above the wide hard floor (130-40=90).
  const anyIntl = candidates.some((c) => worldPoolClubIds.has(c.clubId));
  assert.ok(anyIntl, "a club a few CA points below the old hard threshold should still see international candidates under the smooth model, just penalized");
});

// ---------------------------------------------------------------------------
// Human club invariant / determinism (still hold after all fixes)
// ---------------------------------------------------------------------------

test("human club unaffected: submitTransferOffer's new BLOCKED_PENDING_TRANSFER guard and cpuSquadNeeds changes never touch state.playerClubId", () => {
  const state = fullWorldState("stabilize-human", "se_club_hammarby_if_hf");
  const next = progressCpuRecruitment(state, state.gameDate);
  assert.ok(!Object.values(next.cpuRecruitmentPlans).some((p) => p.clubId === state.playerClubId));
  assert.equal(next.cpuClubEvaluationSchedule[state.playerClubId], undefined);
  assert.equal(cpuRecruiterClubIds(state).includes(state.playerClubId), false);
});

test("deterministic behavior preserved: identical state + date -> identical progressCpuRecruitment result after all 1.0B changes", () => {
  const state = fullWorldState("stabilize-determinism", "se_club_hammarby_if_hf");
  const seeded = { ...state, cpuClubEvaluationSchedule: Object.fromEntries(cpuRecruiterClubIds(state).map((id) => [id, state.gameDate])) };
  const a = progressCpuRecruitment(seeded, state.gameDate);
  const b = progressCpuRecruitment(seeded, state.gameDate);
  assert.deepEqual(a.cpuRecruitmentPlans, b.cpuRecruitmentPlans);
  assert.deepEqual(a.transferOffers, b.transferOffers);
});

test("priorityNeeds still excludes LOW/NONE after the quality-gate change (no accidental over-broadening)", () => {
  const state = fullWorldState("stabilize-priority-sanity", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const assessment = assessSquadNeeds(withSyntheticSquad(state, clubId, 5, "MV"), clubId, state.gameDate);
  const mv = assessment.positions.find((p) => p.position === "MV")!;
  assert.ok(mv.level === "LOW" || mv.level === "NONE");
  assert.ok(!priorityNeeds(assessment).some((p) => p.position === "MV"));
});
