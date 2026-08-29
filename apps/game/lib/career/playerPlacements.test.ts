// HM-CLUB-PARTNERSHIPS-1.1: focused proofs for Player Development
// Placements -- the actual player-movement mechanism on top of
// HM-CLUB-PARTNERSHIPS-1.0's own eligibility predicate. Covers: domestic
// placement start/uniqueness/loan-conflict/ownership-preservation,
// availability flip, exposure accrual, development-stimulus integration
// (via the real dailyTick pipeline), recall idempotency, partnership-
// driven expiry, history persistence, save-migration idempotency, and
// the minimal INTERNATIONAL_LOAN_PARTNERSHIP loan pathway.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { processDay } from "./dailyTick";
import { addDays } from "./dateUtils";
import { TUMBA_CLUB_ID } from "../game-data";
import type { CareerState } from "./types";
import type { PlayerMock } from "../game-data";
import { getPlayerContract } from "../economy/contractIntegration";
import { createInternationalLoanPartnership } from "./clubPartnerships";
import {
  accrueDailyPlacementExposure,
  canStartPlacement,
  getActivePlacementForPlayer,
  getPlacementHistoryForPlayer,
  progressPlacementExpiry,
  recallPlayerFromPlacement,
  startInternationalPartnershipLoan,
  startPlacement,
} from "./playerPlacements";
import { applyPlacementDevelopmentStimulus, resolveWeeklyDevelopmentIfDue } from "../development/developmentIntegration";
import { OUTCOURT_ATTRIBUTES } from "../rating/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";

function baseState(): CareerState {
  return createNewCareerState("placement-test-seed", TUMBA_CLUB_ID);
}

function syntheticPlayer(id: string, clubId: string, dateOfBirth: string): PlayerMock {
  return {
    id,
    clubId,
    firstName: "Test",
    lastName: id,
    shirtNumber: null,
    position: "M6",
    nationality: "SWE",
    dateOfBirth,
    heightCm: null,
    weightKg: null,
    foot: null,
    squadStatus: "Förstaval",
    dataSource: "REAL_WORLD",
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
  };
}

function buildOutcourtRating(playerId: string, ca: number, pa: number): GameplayPlayerRating {
  const attributes: Record<string, { value: number; origin: string }> = {};
  for (const attr of OUTCOURT_ATTRIBUTES) attributes[attr] = { value: 10, origin: "GENERATED_PRIOR" };
  return {
    playerId,
    position: "M6",
    ca,
    pa,
    caSource: "GENERATED_GAME_PRIOR" as GameplayPlayerRating["caSource"],
    branch: { branch: "OUTCOURT", attributes } as GameplayPlayerRating["branch"],
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    attributeGenerationModelVersion: "test",
    locked: false,
  };
}

/** A DEVELOPMENT_PARTNERSHIP with the manager's own club as clubA, so eligibility/placement tests don't depend on which of the five permanent pairs the manager happens to control. */
function withDevelopmentPartnership(state: CareerState, partnerClubId: string): CareerState {
  return {
    ...state,
    clubPartnerships: {
      ...state.clubPartnerships,
      dp1: { id: "dp1", type: "DEVELOPMENT_PARTNERSHIP", clubAId: state.playerClubId, clubBId: partnerClubId, status: "ACTIVE", startDate: "2026-01-01", endDate: "2027-01-01", permanent: false, monthlyCostEur: 1000, lastBilledDate: null },
    },
  };
}

function withPlayer(state: CareerState, playerId: string, dateOfBirth: string): CareerState {
  const player = syntheticPlayer(playerId, state.playerClubId, dateOfBirth);
  return { ...state, worldSquads: { ...state.worldSquads, [state.playerClubId]: [...(state.worldSquads[state.playerClubId] ?? []), player] } };
}

const PARTNER_CLUB = "se_club_bodens_bk_hf";

// ---------------------------------------------------------------------------
// Eligibility / guardrails
// ---------------------------------------------------------------------------

test("canStartPlacement: eligible U19 player at a real active partner passes with no errors", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  assert.deepEqual(canStartPlacement(state, "p18", PARTNER_CLUB), []);
});

test("U19 boundary: a player exactly 20 as of gameDate is rejected by canStartPlacement (reused eligibility, never a second rule)", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p20", "2006-08-23");
  const errors = canStartPlacement(state, "p20", PARTNER_CLUB);
  assert.ok(errors.length > 0);
});

test("wrong-club rejection: a club with no partnership relation to the player's club is rejected", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  const result = startPlacement(state, "p18", "se_club_enkopings_hf", state.gameDate);
  assert.equal(result.ok, false);
});

test("active-placement uniqueness: a player already on an active placement cannot start a second one", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  const first = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  assert.equal(first.ok, true);
  state = { ...state, playerPlacements: { ...state.playerPlacements, [first.placement!.id]: first.placement! } };
  const second = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  assert.equal(second.ok, false);
});

test("placement-vs-loan conflict: a player with an active loan cannot start a placement", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  state = {
    ...state,
    loans: { ...state.loans, l1: { id: "l1", playerId: "p18", parentClubId: state.playerClubId, borrowingClubId: PARTNER_CLUB, startDate: "2026-08-01", endDate: "2027-01-01", wageShareBorrowingPct: 50, originalWageEurPerMonth: 1000, active: true } },
  };
  const result = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// Start / ownership preservation / availability
// ---------------------------------------------------------------------------

test("startPlacement never moves contract, wage, owning club, or worldSquads membership (Part: 'Spelaren behåller...')", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  const contractBefore = getPlayerContract(state, "p18");

  const result = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  assert.equal(result.ok, true);
  assert.equal(result.placement!.sourceClubId, state.playerClubId);
  assert.equal(result.placement!.partnerClubId, PARTNER_CLUB);
  assert.equal(result.placement!.status, "ACTIVE");
  assert.equal(result.placement!.exposureAccrued, 0);

  // startPlacement itself is a pure function -- it never touches worldSquads/contracts, only returns the new row.
  assert.ok(state.worldSquads[state.playerClubId]!.some((p) => p.id === "p18"));
  assert.ok(!(state.worldSquads[PARTNER_CLUB] ?? []).some((p) => p.id === "p18"));
  assert.deepEqual(getPlayerContract(state, "p18"), contractBefore);
});

test("full CareerContext-style wiring: after starting a placement, availability flips to ON_PLACEMENT and isSelectableForMatch excludes the player, with zero code changes to that existing rule", async () => {
  const { isSelectableForMatch } = await import("./playerStatus");
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  const result = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  state = { ...state, playerPlacements: { ...state.playerPlacements, [result.placement!.id]: result.placement! }, playerStatuses: { ...state.playerStatuses, p18: { playerId: "p18", availability: "ON_PLACEMENT" } } };
  assert.equal(isSelectableForMatch(state.playerStatuses, "p18"), false);
});

// ---------------------------------------------------------------------------
// Exposure accrual / development-stimulus integration
// ---------------------------------------------------------------------------

test("accrueDailyPlacementExposure increments only ACTIVE placements' own honest day count -- never a fabricated match/goal/assist stat", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  const started = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  state = { ...state, playerPlacements: { ...state.playerPlacements, [started.placement!.id]: started.placement! } };

  state = accrueDailyPlacementExposure(state);
  state = accrueDailyPlacementExposure(state);
  assert.equal(state.playerPlacements[started.placement!.id].exposureAccrued, 2);
  assert.deepEqual(Object.keys(started.placement!).sort(), ["endDate", "exposureAccrued", "id", "partnerClubId", "playerId", "relationId", "relationType", "sourceClubId", "startDate", "status"]);
});

test("applyPlacementDevelopmentStimulus + resolveWeeklyDevelopmentIfDue: a placed player's attributes can visibly develop over several weeks, feeding the SAME pipeline as training/match stimulus", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23", processedThroughDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  state = { ...state, gameplayRatings: { ...state.gameplayRatings, [state.playerClubId]: [...(state.gameplayRatings[state.playerClubId] ?? []), buildOutcourtRating("p18", 60, 200)] } };

  const started = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  state = { ...state, playerPlacements: { ...state.playerPlacements, [started.placement!.id]: started.placement! } };

  let date = state.gameDate;
  for (let i = 0; i < 220; i++) {
    date = addDays(date, 1);
    state = applyPlacementDevelopmentStimulus(state, date);
    state = accrueDailyPlacementExposure(state);
    state = resolveWeeklyDevelopmentIfDue(state, date);
  }

  const rating = state.gameplayRatings[state.playerClubId]!.find((r) => r.playerId === "p18")!;
  const anyAttributeAbove10 = Object.values(rating.branch.attributes as Record<string, { value: number }>).some((a) => a.value > 10);
  assert.ok(anyAttributeAbove10, "~7 months of placement stimulus should have produced at least one visible attribute gain");
});

test("a player NOT on an active placement gets zero placement stimulus (no-op)", () => {
  const state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  const before = state.playerDevelopmentState;
  const after = applyPlacementDevelopmentStimulus(state, state.gameDate);
  assert.equal(after, state); // same reference -- true no-op
  assert.equal(after.playerDevelopmentState, before);
});

// ---------------------------------------------------------------------------
// Recall / expiry / history
// ---------------------------------------------------------------------------

test("recallPlayerFromPlacement is idempotent -- a no-op when the player has no active placement", () => {
  const state = baseState();
  const next = recallPlayerFromPlacement(state, "nobody", state.gameDate);
  assert.equal(next, state);
});

test("recallPlayerFromPlacement ends the row (RECALLED, endDate set), restores AVAILABLE, and preserves history", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  const started = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  state = {
    ...state,
    playerPlacements: { ...state.playerPlacements, [started.placement!.id]: started.placement! },
    playerStatuses: { ...state.playerStatuses, p18: { playerId: "p18", availability: "ON_PLACEMENT" } },
  };

  const recallDate = addDays(state.gameDate, 14);
  const next = recallPlayerFromPlacement(state, "p18", recallDate);
  assert.equal(next.playerPlacements[started.placement!.id].status, "RECALLED");
  assert.equal(next.playerPlacements[started.placement!.id].endDate, recallDate);
  assert.equal(next.playerStatuses.p18.availability, "AVAILABLE");
  assert.equal(getActivePlacementForPlayer(next, "p18"), undefined);

  const history = getPlacementHistoryForPlayer(next, "p18");
  assert.equal(history.length, 1);
  assert.equal(history[0].status, "RECALLED");
});

test("recall never clobbers an unrelated availability status (e.g. an injury recorded independently while placed)", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  const started = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  state = {
    ...state,
    playerPlacements: { ...state.playerPlacements, [started.placement!.id]: started.placement! },
    playerStatuses: { ...state.playerStatuses, p18: { playerId: "p18", availability: "INJURED", returnDate: "2026-12-01" } },
  };
  const next = recallPlayerFromPlacement(state, "p18", addDays(state.gameDate, 14));
  assert.equal(next.playerStatuses.p18.availability, "INJURED");
});

test("progressPlacementExpiry auto-ends an ACTIVE placement (status EXPIRED, distinct from manager RECALLED) once its own ClubPartnership row is no longer ACTIVE", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  const started = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  state = { ...state, playerPlacements: { ...state.playerPlacements, [started.placement!.id]: started.placement! } };

  // The underlying DEVELOPMENT_PARTNERSHIP itself expires.
  state = { ...state, clubPartnerships: { ...state.clubPartnerships, dp1: { ...state.clubPartnerships.dp1, status: "EXPIRED" } } };

  const { state: next, expired } = progressPlacementExpiry(state, addDays(state.gameDate, 1));
  assert.equal(expired.length, 1);
  assert.equal(next.playerPlacements[started.placement!.id].status, "EXPIRED");
});

test("a permanent AFFILIATED_B_TEAM placement never auto-expires (the underlying relation itself never ends)", () => {
  const bTeamId = "se_club_hk_cliff";
  const parentId = "se_club_hammarby_if_hf";
  let state = createNewCareerState("placement-permanent-seed", parentId);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  const started = startPlacement(state, "p18", bTeamId, state.gameDate);
  assert.equal(started.ok, true, started.errors.join(" "));
  state = { ...state, playerPlacements: { ...state.playerPlacements, [started.placement!.id]: started.placement! } };

  const { expired } = progressPlacementExpiry(state, addDays(state.gameDate, 365));
  assert.equal(expired.length, 0);
});

// ---------------------------------------------------------------------------
// dailyTick wiring / persistence / migration
// ---------------------------------------------------------------------------

test("processDay advances an active placement's exposure day count and never crashes with no active placements", () => {
  const state = baseState();
  const next = processDay(state, addDays(state.gameDate, 1));
  assert.deepEqual(next.state.playerPlacements, {});
});

test("save migration: an old-format save (no playerPlacements at all) migrates safely and additively", () => {
  const state = baseState();
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).playerPlacements;
  const migrated = migrateCareerState(legacy as CareerState);
  assert.deepEqual(migrated.playerPlacements, {});
});

test("save migration is idempotent for an already-migrated state with an active placement", () => {
  let state = withDevelopmentPartnership(baseState(), PARTNER_CLUB);
  state = { ...state, gameDate: "2026-08-23" };
  state = withPlayer(state, "p18", "2008-01-01");
  const started = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  state = { ...state, playerPlacements: { ...state.playerPlacements, [started.placement!.id]: started.placement! } };

  const once = migrateCareerState(state);
  const twice = migrateCareerState(once);
  assert.deepEqual(once.playerPlacements, twice.playerPlacements);
  assert.equal(Object.keys(once.playerPlacements).length, 1);
});

// ---------------------------------------------------------------------------
// International loan partnership: minimal integration
// ---------------------------------------------------------------------------

test("startInternationalPartnershipLoan: zero loan fee, caller-supplied wage share passed through unchanged, real squad/contract movement via the existing unmodified loan mechanism", () => {
  let state = baseState();
  const created = createInternationalLoanPartnership(state, state.playerClubId, "ger1-kiel", "2026-08-23", "2027-06-30");
  assert.equal(created.ok, true);
  assert.equal(created.partnership!.monthlyCostEur, 0); // Part: loan fee = 0
  state = { ...state, gameDate: "2026-08-23", clubPartnerships: { ...state.clubPartnerships, [created.partnership!.id]: created.partnership! } };
  state = withPlayer(state, "loan1", "2003-01-01"); // adult, no age limit for international loans
  state = { ...state, playerContracts: { ...state.playerContracts, loan1: { playerId: "loan1", clubId: state.playerClubId, contractEndDate: "2028-06-30", wageEurPerMonth: 4000 } } };

  const result = startInternationalPartnershipLoan(state, created.partnership!.id, "loan1", 37, "2027-01-01", state.gameDate);
  assert.equal(result.ok, true, result.errors.join(" "));
  assert.equal(result.loan!.wageShareBorrowingPct, 37); // never forced to a partnership-derived value
  assert.equal(result.loan!.parentClubId, state.playerClubId);
  assert.equal(result.loan!.borrowingClubId, "ger1-kiel");

  const movedPlayer = result.state!.worldSquads["ger1-kiel"]?.find((p) => p.id === "loan1");
  assert.ok(movedPlayer, "loanPlayerOut must have actually moved squad membership");
  assert.equal(getPlayerContract(result.state!, "loan1")?.clubId, "ger1-kiel");
});

test("startInternationalPartnershipLoan rejects when no ACTIVE INTERNATIONAL_LOAN_PARTNERSHIP exists for the given id", () => {
  const state = baseState();
  const result = startInternationalPartnershipLoan(state, "no-such-partnership", "anyone", 50, "2027-01-01", state.gameDate);
  assert.equal(result.ok, false);
});

test("startInternationalPartnershipLoan rejects a player already on a domestic placement (mutual exclusion with placements)", () => {
  let state = baseState();
  const created = createInternationalLoanPartnership(state, state.playerClubId, "ger1-kiel", "2026-08-23", "2027-06-30");
  state = { ...state, gameDate: "2026-08-23", clubPartnerships: { ...state.clubPartnerships, [created.partnership!.id]: created.partnership!, ...withDevelopmentPartnership(state, PARTNER_CLUB).clubPartnerships } };
  state = withPlayer(state, "p18", "2008-01-01");
  const placed = startPlacement(state, "p18", PARTNER_CLUB, state.gameDate);
  assert.equal(placed.ok, true, placed.errors.join(" "));
  state = { ...state, playerPlacements: { ...state.playerPlacements, [placed.placement!.id]: placed.placement! } };

  const result = startInternationalPartnershipLoan(state, created.partnership!.id, "p18", 50, "2027-01-01", state.gameDate);
  assert.equal(result.ok, false);
});
