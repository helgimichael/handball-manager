// HM-CPU-CONTRACT-DECISIONS-1.1: focused proofs for the rebuilt CPU
// contract renewal/release decision model on top of the stabilized
// contract-expiry lifecycle (commit 2548f67). Two layers, matching this
// codebase's own precedent (cpuMarketCalibration.test.ts etc.):
// unit-level tests against decideContractAction's pure, literal-input
// signature for exact per-factor behavior, and CareerState-level tests
// against progressCpuContractDecisions/a real generated world to prove
// the glue (squad depth after departure, position rank, wage fairness,
// agreed-incoming detection) is actually wired correctly end-to-end.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getClubsByCompetition, type PlayerMock } from "../game-data";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { addDays } from "./dateUtils";
import type { CareerState } from "./types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { getPlayerContract, getPlayerContractStatus } from "../economy/contractIntegration";
import { decideContractAction, progressCpuContractDecisions, DECISION_FORCE_WITHIN_DAYS } from "./cpuContractDecisions";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";

let cached: { worldSquads: Record<string, PlayerMock[]>; gameplayRatings: Record<string, GameplayPlayerRating[]> } | undefined;
function fullWorldState(seed: string, playerClubId: string): CareerState {
  if (!cached) cached = { worldSquads: snapshotWorldSquads(HANDBOLLSLIGAN_ID), gameplayRatings: snapshotGameplayRatings(HANDBOLLSLIGAN_ID) };
  return createNewCareerState(seed, playerClubId, cached.worldSquads, {}, cached.gameplayRatings);
}

function rivalClubId(state: CareerState, exclude: readonly string[] = []): string {
  return getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== state.playerClubId && !exclude.includes(c.id))!.id;
}

// ---------------------------------------------------------------------------
// Unit-level: decideContractAction's own pure decision tree.
// ---------------------------------------------------------------------------

const BASE = {
  age: 27, ca: 130, paHeadroom: 0, positionRank: 1, caGapToPositionBest: 0, caVsClubAvg: 1.0,
  wageEurPerMonth: 1000, fairWageEurPerMonth: 1000, financialPressure: "NONE" as const,
  daysUntilExpiry: 200, needIfLeaves: "MEDIUM" as const, needIfLeavesSaturated: false, hasAgreedReplacement: false,
};

test("KEY_PLAYER: a useful, affordable key player is renewed", () => {
  const result = decideContractAction({ ...BASE, tier: "KEY_PLAYER", age: 28, ca: 145, positionRank: 1, wageEurPerMonth: 2000, fairWageEurPerMonth: 2000 });
  assert.equal(result.decision, "RENEW");
});

test("KEY_PLAYER: a marginally-lower-CA teammate at the same position never counts as 'clearly replaced' -- two similarly elite players can coexist", () => {
  // The season-boundary audit's own first run found this exact case (positionRank 2 with only a tiny CA gap) firing RELEASE for essentially every KEY_PLAYER at a club carrying two similarly-elite players at one position.
  const result = decideContractAction({ ...BASE, tier: "KEY_PLAYER", age: 28, ca: 140, positionRank: 2, caGapToPositionBest: 3, wageEurPerMonth: 1800, fairWageEurPerMonth: 1800 });
  assert.equal(result.decision, "RENEW");
});

test("KEY_PLAYER: a genuine, large CA gap to the position's own best player is a real 'clearly replaced' signal", () => {
  const result = decideContractAction({ ...BASE, tier: "KEY_PLAYER", age: 28, ca: 110, positionRank: 2, caGapToPositionBest: 25, needIfLeaves: "LOW", wageEurPerMonth: 1800, fairWageEurPerMonth: 1800 });
  assert.equal(result.decision, "RELEASE");
});

test("KEY_PLAYER: an extreme bad-value, aging key player can resolve to RELEASE when the position tolerates it", () => {
  const result = decideContractAction({
    ...BASE, tier: "KEY_PLAYER", age: 36, wageEurPerMonth: 6000, fairWageEurPerMonth: 1500, needIfLeaves: "LOW",
  });
  assert.equal(result.decision, "RELEASE");
});

test("KEY_PLAYER: an aging, overpaid key player under financial pressure but not yet near expiry WAITs rather than acting immediately", () => {
  const result = decideContractAction({
    ...BASE, tier: "KEY_PLAYER", age: 33, wageEurPerMonth: 1500, fairWageEurPerMonth: 1200, financialPressure: "SERIOUS", daysUntilExpiry: 200,
  });
  assert.equal(result.decision, "WAIT");
});

test("ROTATION: a thin position renews an otherwise unremarkable rotation player", () => {
  const result = decideContractAction({ ...BASE, tier: "ROTATION", needIfLeaves: "HIGH" });
  assert.equal(result.decision, "RENEW");
});

test("ROTATION: a saturated position releases a redundant rotation player", () => {
  const result = decideContractAction({ ...BASE, tier: "ROTATION", needIfLeaves: "LOW", needIfLeavesSaturated: true, positionRank: 4, caVsClubAvg: 0.8, wageEurPerMonth: 1500, fairWageEurPerMonth: 1000 });
  assert.equal(result.decision, "RELEASE");
});

test("SQUAD_PLAYER: useful cheap depth in a thin squad is renewed", () => {
  const result = decideContractAction({ ...BASE, tier: "SQUAD_PLAYER", needIfLeaves: "HIGH", wageEurPerMonth: 500, fairWageEurPerMonth: 800 });
  assert.equal(result.decision, "RENEW");
});

test("SQUAD_PLAYER: redundant expensive depth is released", () => {
  const result = decideContractAction({ ...BASE, tier: "SQUAD_PLAYER", needIfLeaves: "LOW", needIfLeavesSaturated: true, positionRank: 5, caVsClubAvg: 0.7, wageEurPerMonth: 2000, fairWageEurPerMonth: 900 });
  assert.equal(result.decision, "RELEASE");
});

test("TALENT: a young player with real development headroom is protected even at low current CA", () => {
  const result = decideContractAction({ ...BASE, tier: "TALENT", age: 19, ca: 90, paHeadroom: 30, needIfLeaves: "LOW", needIfLeavesSaturated: true, wageEurPerMonth: 400, fairWageEurPerMonth: 450 });
  assert.equal(result.decision, "RENEW");
});

test("TALENT: an older squad player is not protected by tier label alone when there is no real remaining potential", () => {
  const result = decideContractAction({ ...BASE, tier: "TALENT", age: 27, ca: 110, paHeadroom: 2, needIfLeaves: "LOW", needIfLeavesSaturated: true, wageEurPerMonth: 1200, fairWageEurPerMonth: 900, daysUntilExpiry: DECISION_FORCE_WITHIN_DAYS });
  assert.equal(result.decision, "RELEASE");
});

test("Incoming transfer: an already-agreed replacement at the same position tips an otherwise-thin-position renewal toward RELEASE", () => {
  const withoutReplacement = decideContractAction({ ...BASE, tier: "ROTATION", needIfLeaves: "HIGH", hasAgreedReplacement: false });
  const withReplacement = decideContractAction({ ...BASE, tier: "ROTATION", needIfLeaves: "HIGH", hasAgreedReplacement: true });
  assert.equal(withoutReplacement.decision, "RENEW");
  assert.equal(withReplacement.decision, "RELEASE");
});

test("Finances: poor finances plus an expensive marginal player raises RELEASE likelihood relative to the same player at a healthy club", () => {
  const healthy = decideContractAction({ ...BASE, tier: "ROTATION", needIfLeaves: "MEDIUM", wageEurPerMonth: 1500, fairWageEurPerMonth: 1100, financialPressure: "NONE" });
  const pressured = decideContractAction({ ...BASE, tier: "ROTATION", needIfLeaves: "MEDIUM", wageEurPerMonth: 1500, fairWageEurPerMonth: 1100, financialPressure: "CRITICAL", daysUntilExpiry: DECISION_FORCE_WITHIN_DAYS });
  assert.notEqual(pressured.decision, "RENEW");
  assert.notEqual(healthy.decision, "RELEASE");
});

test("WAIT: a genuinely borderline case, months from expiry, WAITs rather than forcing a premature decision", () => {
  const result = decideContractAction({ ...BASE, tier: "FIRST_CHOICE", needIfLeaves: "MEDIUM", caVsClubAvg: 0.95, wageEurPerMonth: 1300, fairWageEurPerMonth: 1100, daysUntilExpiry: 200 });
  assert.equal(result.decision, "WAIT");
});

test("WAIT: the exact same borderline case, very close to expiry, resolves to a concrete RENEW or RELEASE, never WAIT", () => {
  const result = decideContractAction({ ...BASE, tier: "FIRST_CHOICE", needIfLeaves: "MEDIUM", caVsClubAvg: 0.95, wageEurPerMonth: 1300, fairWageEurPerMonth: 1100, daysUntilExpiry: DECISION_FORCE_WITHIN_DAYS });
  assert.notEqual(result.decision, "WAIT");
});

test("Age: no bare age>32 cliff -- an old but still-useful, affordable key player at a healthy club renews", () => {
  const result = decideContractAction({ ...BASE, tier: "KEY_PLAYER", age: 33, wageEurPerMonth: 1500, fairWageEurPerMonth: 1400, financialPressure: "NONE", needIfLeaves: "MEDIUM" });
  assert.equal(result.decision, "RENEW");
});

test("Age: a young but expensive, redundant squad player can still be released -- age alone never protects", () => {
  const result = decideContractAction({ ...BASE, tier: "SQUAD_PLAYER", age: 24, needIfLeaves: "LOW", needIfLeavesSaturated: true, wageEurPerMonth: 2500, fairWageEurPerMonth: 1000 });
  assert.equal(result.decision, "RELEASE");
});

test("Determinism: identical inputs always produce an identical decision", () => {
  const inputs = { ...BASE, tier: "FIRST_CHOICE" as const, needIfLeaves: "MEDIUM" as const };
  assert.deepEqual(decideContractAction(inputs), decideContractAction(inputs));
  assert.deepEqual(decideContractAction(inputs), decideContractAction(inputs));
});

test("Release volume: 0 RELEASE is no longer structurally guaranteed -- a real redundant/overpaid case genuinely resolves to RELEASE", () => {
  const result = decideContractAction({ ...BASE, tier: "ROTATION", needIfLeaves: "LOW", needIfLeavesSaturated: true, wageEurPerMonth: 3000, fairWageEurPerMonth: 1000 });
  assert.equal(result.decision, "RELEASE");
});

// ---------------------------------------------------------------------------
// CareerState-level: proves the glue (real squad depth after departure,
// position rank, wage fairness, agreed-incoming) is wired correctly.
// ---------------------------------------------------------------------------

function syntheticPlayer(id: string, clubId: string, position: PlayerMock["position"], dateOfBirth = "1996-01-01"): PlayerMock {
  return {
    id, clubId, firstName: "Test", lastName: id, shirtNumber: null, position, nationality: "SWE",
    dateOfBirth, heightCm: null, weightKg: null, foot: null, squadStatus: "Rotation", dataSource: "REAL_WORLD",
    currentAbility: 110, potentialAbility: 110, form: 5, fitnessPct: 100, moralePct: 70, appearances: 0, goals: 0,
    contractEndSeason: "2026/27", wageSekPerMonth: 0,
    attributes: {
      technical: { skott: 10, passning: 10, spelforstaelse: 10, genombrott: 10, mottagning: 10, fint: 10, spelUtanBoll: 10 },
      mental: { beslutsfattande: 10, kyla: 10, arbetskapacitet: 10, kampvilja: 10, positionering: 10, lagarbete: 10, ledarskap: 10 },
      physical: { snabbhet: 10, acceleration: 10, styrka: 10, explosivitet: 10, uthallighet: 10, rorlighet: 10 },
    },
  };
}

function ratingFor(playerId: string, position: "GK" | "V6" | "H6" | "V9" | "M9" | "H9" | "M6", ca: number): GameplayPlayerRating {
  return {
    playerId, position, ca, pa: ca, caSource: "GENERATED_GAME_PRIOR" as GameplayPlayerRating["caSource"],
    branch: { branch: position === "GK" ? "GOALKEEPER" : "OUTCOURT", attributes: {} } as GameplayPlayerRating["branch"],
    attackRoleProficiencies: [], defenceRoleProficiencies: [], attributeGenerationModelVersion: "test", locked: false,
  };
}

/** Replaces a club's own MV entirely with `count` synthetic goalkeepers (real contracts, real ratings), leaving every other position untouched -- same isolate-one-position precedent as cpuMarketCalibration.test.ts's own withSyntheticSquad. */
function withGoalkeepers(state: CareerState, clubId: string, count: number, expiringDays: number | null): CareerState {
  const players = Array.from({ length: count }, (_, i) => syntheticPlayer(`${clubId}-mv-${i}`, clubId, "MV"));
  const ratings = players.map((p, i) => ratingFor(p.id, "GK", 120 + i));
  const restSquad = (state.worldSquads[clubId] ?? []).filter((p) => p.position !== "MV");
  const restRatings = (state.gameplayRatings[clubId] ?? []).filter((r) => restSquad.some((p) => p.id === r.playerId));
  const contracts: CareerState["playerContracts"] = { ...state.playerContracts };
  players.forEach((p, i) => {
    contracts[p.id] = { playerId: p.id, clubId, contractEndDate: i === 0 && expiringDays !== null ? addDays(state.gameDate, expiringDays) : "2029-05-31", wageEurPerMonth: 1000 };
  });
  return {
    ...state,
    worldSquads: { ...state.worldSquads, [clubId]: [...restSquad, ...players] },
    gameplayRatings: { ...state.gameplayRatings, [clubId]: [...restRatings, ...ratings] },
    playerContracts: contracts,
  };
}

test("Goalkeeper: 2 MV with one expiring projects to 1 after departure -- strong renewal pressure", () => {
  const state = fullWorldState("cpucd-gk-thin", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const withGk = withGoalkeepers(state, clubId, 2, 150);
  const expiringId = `${clubId}-mv-0`;

  const { log } = progressCpuContractDecisions(withGk, withGk.gameDate, [clubId]);
  const entry = log.find((e) => e.playerId === expiringId);
  assert.ok(entry, "the expiring goalkeeper must have been evaluated");
  assert.equal(entry!.decision, "RENEW");
});

test("Goalkeeper: 4 MV plus an agreed incoming fifth makes the marginal expiring MV likely RELEASE", () => {
  const state = fullWorldState("cpucd-gk-saturated", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  let withGk = withGoalkeepers(state, clubId, 4, 150);
  const expiringId = `${clubId}-mv-0`;
  // Make the expiring one clearly the weakest and overpaid, matching "marginal expiring MV".
  withGk = {
    ...withGk,
    gameplayRatings: { ...withGk.gameplayRatings, [clubId]: withGk.gameplayRatings[clubId]!.map((r) => (r.playerId === expiringId ? { ...r, ca: 90, pa: 90 } : r)) },
    playerContracts: { ...withGk.playerContracts, [expiringId]: { ...withGk.playerContracts[expiringId], wageEurPerMonth: 4000 } },
  };

  // An agreed incoming fifth goalkeeper -- a real pending offer row, same
  // direct-construction precedent cpuMarketCalibration.test.ts's own
  // "pending incoming counts toward depth" test uses (never fabricated
  // depth -- pendingIncomingCount's own real scan just needs a real
  // AGREED_AWAITING_WINDOW row to find, not a full negotiation replay).
  const seller = getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== clubId && c.id !== withGk.playerClubId)!.id;
  const incoming = syntheticPlayer("incoming-fifth-mv", seller, "MV");
  const withIncoming: CareerState = {
    ...withGk,
    worldSquads: { ...withGk.worldSquads, [seller]: [...(withGk.worldSquads[seller] ?? []), incoming] },
    gameplayRatings: { ...withGk.gameplayRatings, [seller]: [...(withGk.gameplayRatings[seller] ?? []), ratingFor(incoming.id, "GK", 115)] },
    playerContracts: { ...withGk.playerContracts, [incoming.id]: { playerId: incoming.id, clubId: seller, contractEndDate: "2028-05-31", wageEurPerMonth: 1000 } },
    transferOffers: {
      ...withGk.transferOffers,
      "incoming-fifth-mv-offer": {
        id: "incoming-fifth-mv-offer", dealType: "PERMANENT", playerId: incoming.id, fromClubId: seller, toClubId: clubId,
        transferFeeEur: 15_000, trainingCompensationEur: 0, newWageEurPerMonth: 1500, newContractEndDate: "2029-05-31",
        status: "AGREED_AWAITING_WINDOW", offeredDate: withGk.gameDate, scheduledCompletionDate: addDays(withGk.gameDate, 30),
      },
    },
  };

  const { log } = progressCpuContractDecisions(withIncoming, withIncoming.gameDate, [clubId]);
  const entry = log.find((e) => e.playerId === expiringId);
  assert.ok(entry, "the marginal expiring goalkeeper must have been evaluated");
  assert.equal(entry!.decision, "RELEASE");
});

test("Human club: progressCpuContractDecisions produces zero decisions for state.playerClubId", () => {
  const state = fullWorldState("cpucd-human-exclusion", "se_club_hammarby_if_hf");
  const withExpiring = withGoalkeepers(state, state.playerClubId, 1, 150);
  const { log } = progressCpuContractDecisions(withExpiring, withExpiring.gameDate, [state.playerClubId]);
  assert.equal(log.length, 0);
});

test("Determinism: progressCpuContractDecisions on the same real-world state and date produces identical decisions and contract mutations", () => {
  const state = fullWorldState("cpucd-determinism", "se_club_hammarby_if_hf");
  const clubIds = getClubsByCompetition(HANDBOLLSLIGAN_ID).map((c) => c.id).filter((id) => id !== state.playerClubId);
  const a = progressCpuContractDecisions(state, state.gameDate, clubIds);
  const b = progressCpuContractDecisions(state, state.gameDate, clubIds);
  assert.deepEqual(a.log, b.log);
  assert.deepEqual(a.state.playerContracts, b.state.playerContracts);
});

test("Lifecycle: a RELEASE decision never immediately removes the player -- contractEndDate is untouched and the player stays until real expiry", () => {
  const state = fullWorldState("cpucd-lifecycle-release", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  // 5 MV total -- removing the expiring one still leaves 4 (saturated), so RELEASE fires on genuine redundant depth, not merely because expiry is close.
  let withGk = withGoalkeepers(state, clubId, 5, 150);
  const expiringId = `${clubId}-mv-0`;
  withGk = {
    ...withGk,
    gameplayRatings: { ...withGk.gameplayRatings, [clubId]: withGk.gameplayRatings[clubId]!.map((r) => (r.playerId === expiringId ? { ...r, ca: 90, pa: 90 } : r)) },
    playerContracts: { ...withGk.playerContracts, [expiringId]: { ...withGk.playerContracts[expiringId], wageEurPerMonth: 4000 } },
  };
  const contractBefore = getPlayerContract(withGk, expiringId)!;

  const { state: after, log } = progressCpuContractDecisions(withGk, withGk.gameDate, [clubId]);
  const entry = log.find((e) => e.playerId === expiringId);
  assert.equal(entry?.decision, "RELEASE");

  const contractAfter = getPlayerContract(after, expiringId)!;
  assert.equal(contractAfter.contractEndDate, contractBefore.contractEndDate, "RELEASE must never mutate contractEndDate");
  assert.notEqual(getPlayerContractStatus(after, expiringId), "FREE_AGENT");
  assert.ok(after.worldSquads[clubId]!.some((p) => p.id === expiringId), "the player must remain in the squad until the real expiry date");
});

test("RENEW correctness: a short (1-year) renewal anchors to the EXISTING contract end date, not today's calendar year -- must always move strictly forward and exit EXPIRING_SOON immediately", () => {
  // HM-CPU-SQUAD-RESILIENCE-1.0 regression: the 5-year world-stability
  // re-audit found the SAME playerId logged as RENEW on nearly every
  // single day for months -- computeNewContractEndDate was anchored to
  // `date` (today) instead of the existing contract's own end-date year,
  // so an old player's 1-year renewal evaluated any time after 1 June
  // computed a fallback year that could equal (or even predate) the
  // contract's own already-later end date, making the "renewal" a silent
  // no-op that never actually moved the player out of the EXPIRING_SOON
  // window. Fixture below reproduces that exact scenario: gameDate in
  // August, contract already extending to the following 31 May (within
  // EXPIRING_SOON), an old (32) FIRST_CHOICE player (RENEWAL_YEARS_BY_TIER
  // gives 2 years, age >= 31 drops it to 1 -- the precise buggy case).
  const clubId = "se_club_bodens_bk_hf";
  const player: PlayerMock = { ...syntheticPlayer("renew-anchor-1", clubId, "V6", "1994-01-01"), squadStatus: "Förstaval" };
  let state = fullWorldState("cpucd-renew-anchor", "se_club_hammarby_if_hf");
  state = {
    ...state,
    gameDate: "2026-08-19",
    worldSquads: { ...state.worldSquads, [clubId]: [player] },
    gameplayRatings: { ...state.gameplayRatings, [clubId]: [ratingFor(player.id, "V6", 120)] },
    playerContracts: { ...state.playerContracts, [player.id]: { playerId: player.id, clubId, contractEndDate: "2027-05-31", wageEurPerMonth: 1000 } },
  };
  const before = getPlayerContract(state, player.id)!.contractEndDate;

  const { log, state: after } = progressCpuContractDecisions(state, state.gameDate, [clubId]);
  const entry = log.find((e) => e.playerId === player.id);
  assert.equal(entry?.decision, "RENEW", "fixture assumption: a lone, useful player at a thin position must be renewed");

  const afterDate = getPlayerContract(after, player.id)!.contractEndDate;
  assert.ok(new Date(afterDate).getTime() > new Date(before).getTime(), `RENEW must always move contractEndDate strictly forward (before=${before}, after=${afterDate})`);
  assert.equal(getPlayerContractStatus(after, player.id), "UNDER_CONTRACT", "a genuinely renewed contract must exit the EXPIRING_SOON window immediately -- never still due for re-evaluation the very next check");
});
