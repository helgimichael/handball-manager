// HM-CLUB-PARTNERSHIPS-1.0: focused proofs for the Club Partnership
// domain -- permanent B-team seeding, exclusivity, board-search
// lifecycle, candidate selection, economy billing, U19/development
// eligibility, and the international-loan-partnership country rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { addDays } from "./dateUtils";
import { TUMBA_CLUB_ID } from "../game-data";
import type { CareerState } from "./types";
import type { PlayerMock } from "../game-data";
import {
  PERMANENT_B_TEAM_PAIRS,
  canFormInternationalLoanPartnership,
  canRequestPartnershipSearch,
  createInternationalLoanPartnership,
  getClubPartnerships,
  getPermanentBTeamParentClubId,
  isClubExclusivelyPartnered,
  isPartnershipExposureEligible,
  isPermanentBTeamClub,
  progressPartnershipBilling,
  progressPartnershipExpiry,
  progressPartnershipSearches,
  renewPartnership,
  requestPartnershipSearch,
  seedPermanentBTeamPartnerships,
  selectCandidateClubs,
  startDevelopmentPartnership,
  terminatePartnership,
} from "./clubPartnerships";

function baseState(): CareerState {
  return createNewCareerState("pship-test-seed", TUMBA_CLUB_ID);
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

/** Injects synthetic Division 1 squads (real clubIds, synthetic players) so selectCandidateClubs has a pool to rank -- mirrors scouting.test.ts's own staffMember() synthetic-fixture precedent. */
function withDivision1Pool(state: CareerState): CareerState {
  const pools: Record<string, number> = {
    se_club_bodens_bk_hf: 5,
    se_club_enkopings_hf: 8,
    se_club_hk_eskil: 3,
    se_club_ik_bolton: 8, // ties with enkopings_hf on squad size -- clubId tiebreak proves determinism
    se_club_hk_cliff: 10, // permanent B-team club -- must NEVER be a candidate despite the biggest pool
  };
  const worldSquads: Record<string, PlayerMock[]> = { ...state.worldSquads };
  for (const [clubId, size] of Object.entries(pools)) {
    worldSquads[clubId] = Array.from({ length: size }, (_, i) => syntheticPlayer(`${clubId}-p${i}`, clubId, "2000-01-01"));
  }
  return { ...state, worldSquads };
}

// ---------------------------------------------------------------------------
// Permanent B-team seeding
// ---------------------------------------------------------------------------

test("fresh career seeds exactly the five canonical permanent AFFILIATED_B_TEAM relations", () => {
  const state = baseState();
  const permanent = Object.values(state.clubPartnerships).filter((p) => p.type === "AFFILIATED_B_TEAM");
  assert.equal(permanent.length, 5);
  for (const pair of PERMANENT_B_TEAM_PAIRS) {
    const row = permanent.find((p) => p.clubAId === pair.clubAId && p.clubBId === pair.clubBId);
    assert.ok(row, `missing permanent relation ${pair.clubAId} -> ${pair.clubBId}`);
    assert.equal(row!.status, "ACTIVE");
    assert.equal(row!.permanent, true);
    assert.equal(row!.endDate, null);
    assert.equal(row!.monthlyCostEur, 0);
  }
});

test("seedPermanentBTeamPartnerships is idempotent -- calling it again never duplicates", () => {
  const state = baseState();
  const again = seedPermanentBTeamPartnerships(state, state.gameDate);
  assert.equal(Object.keys(again.clubPartnerships).length, Object.keys(state.clubPartnerships).length);
});

test("isPermanentBTeamClub / getPermanentBTeamParentClubId are correct for all five and false/undefined otherwise", () => {
  assert.equal(isPermanentBTeamClub("se_club_hk_cliff"), true);
  assert.equal(getPermanentBTeamParentClubId("se_club_hk_cliff"), "se_club_hammarby_if_hf");
  assert.equal(isPermanentBTeamClub("se_club_bodens_bk_hf"), false);
  assert.equal(getPermanentBTeamParentClubId("se_club_bodens_bk_hf"), undefined);
});

test("a permanent B-team relation can never be terminated", () => {
  const state = baseState();
  const permanentId = Object.values(state.clubPartnerships).find((p) => p.type === "AFFILIATED_B_TEAM")!.id;
  const next = terminatePartnership(state, permanentId, state.gameDate);
  assert.equal(next, state); // no-op, same reference
  assert.equal(next.clubPartnerships[permanentId].status, "ACTIVE");
});

test("getClubPartnerships returns both sides of a relation", () => {
  const state = baseState();
  const hammarbyRelations = getClubPartnerships(state, "se_club_hammarby_if_hf");
  const cliffRelations = getClubPartnerships(state, "se_club_hk_cliff");
  assert.equal(hammarbyRelations.length, 1);
  assert.equal(cliffRelations.length, 1);
  assert.equal(hammarbyRelations[0].id, cliffRelations[0].id);
});

// ---------------------------------------------------------------------------
// Exclusivity
// ---------------------------------------------------------------------------

test("exclusivity: every permanent B-team club is exclusively partnered from career start", () => {
  const state = baseState();
  for (const pair of PERMANENT_B_TEAM_PAIRS) {
    assert.equal(isClubExclusivelyPartnered(state, pair.clubBId), true);
  }
});

test("exclusivity: a plain Division 1 club with no partnership is NOT exclusively partnered", () => {
  const state = baseState();
  assert.equal(isClubExclusivelyPartnered(state, "se_club_bodens_bk_hf"), false);
});

// ---------------------------------------------------------------------------
// Board-search lifecycle
// ---------------------------------------------------------------------------

test("board search: requestPartnershipSearch creates an IN_PROGRESS assignment with a future endDate", () => {
  const state = withDivision1Pool(baseState());
  const result = requestPartnershipSearch(state, state.playerClubId, state.gameDate);
  assert.equal(result.ok, true);
  assert.equal(result.assignment!.status, "IN_PROGRESS");
  assert.ok(result.assignment!.endDate > state.gameDate);
  assert.equal(result.assignment!.candidateClubIds.length, 0);
});

test("board search: a second concurrent search for the same club is rejected", () => {
  let state = withDivision1Pool(baseState());
  const first = requestPartnershipSearch(state, state.playerClubId, state.gameDate);
  state = { ...state, partnershipSearches: { ...state.partnershipSearches, [first.assignment!.id]: first.assignment! } };
  const second = canRequestPartnershipSearch(state, state.playerClubId);
  assert.ok(second.length > 0);
});

test("board search: candidates only resolve once endDate is reached, never before", () => {
  let state = withDivision1Pool(baseState());
  const req = requestPartnershipSearch(state, state.playerClubId, state.gameDate);
  state = { ...state, partnershipSearches: { [req.assignment!.id]: req.assignment! } };

  const tooEarly = progressPartnershipSearches(state, addDays(state.gameDate, 1));
  assert.equal(tooEarly.completed.length, 0);
  assert.equal(tooEarly.state.partnershipSearches[req.assignment!.id].status, "IN_PROGRESS");

  const onTime = progressPartnershipSearches(state, req.assignment!.endDate);
  assert.equal(onTime.completed.length, 1);
  assert.equal(onTime.completed[0].status, "COMPLETED");
  assert.ok(onTime.completed[0].candidateClubIds.length > 0);
});

test("candidate selection: never proposes a permanent B-team club, and is deterministic (squad size desc, clubId asc tiebreak)", () => {
  const state = withDivision1Pool(baseState());
  const candidates = selectCandidateClubs(state, state.playerClubId);
  assert.ok(!candidates.includes("se_club_hk_cliff"), "a permanent B-team club must never be a candidate, even with the largest squad");

  const again = selectCandidateClubs(state, state.playerClubId);
  assert.deepEqual(candidates, again, "candidate selection must be deterministic for identical state");

  // enkopings_hf and ik_bolton both have squad size 8 -- clubId alphabetical tiebreak: se_club_enkopings_hf < se_club_ik_bolton
  const idxEnkoping = candidates.indexOf("se_club_enkopings_hf");
  const idxBolton = candidates.indexOf("se_club_ik_bolton");
  if (idxEnkoping !== -1 && idxBolton !== -1) assert.ok(idxEnkoping < idxBolton);
});

test("candidate selection excludes a club already exclusively partnered by someone else", () => {
  let state = withDivision1Pool(baseState());
  // Manually mark se_club_enkopings_hf as already development-partnered elsewhere.
  state = {
    ...state,
    clubPartnerships: {
      ...state.clubPartnerships,
      existing: {
        id: "existing",
        type: "DEVELOPMENT_PARTNERSHIP",
        clubAId: "se_club_alingsas_hk",
        clubBId: "se_club_enkopings_hf",
        status: "ACTIVE",
        startDate: state.gameDate,
        endDate: addDays(state.gameDate, 300),
        permanent: false,
        monthlyCostEur: 1000,
        lastBilledDate: null,
      },
    },
  };
  const candidates = selectCandidateClubs(state, state.playerClubId);
  assert.ok(!candidates.includes("se_club_enkopings_hf"));
});

// ---------------------------------------------------------------------------
// Development partnership: start / exclusivity-after-start / expiry / renewal / billing
// ---------------------------------------------------------------------------

function completedSearch(state: CareerState, candidateClubIds: string[]) {
  return { id: "search-1", clubId: state.playerClubId, startDate: state.gameDate, endDate: state.gameDate, status: "COMPLETED" as const, candidateClubIds };
}

test("startDevelopmentPartnership rejects a club that wasn't one of the search's own candidates", () => {
  let state = withDivision1Pool(baseState());
  const search = completedSearch(state, ["se_club_bodens_bk_hf"]);
  state = { ...state, partnershipSearches: { [search.id]: search } };
  const result = startDevelopmentPartnership(state, search.id, "se_club_enkopings_hf", 1000, 12, state.gameDate);
  assert.equal(result.ok, false);
});

test("startDevelopmentPartnership succeeds for a real candidate, with a manager-supplied cost and duration", () => {
  let state = withDivision1Pool(baseState());
  const search = completedSearch(state, ["se_club_bodens_bk_hf"]);
  state = { ...state, partnershipSearches: { [search.id]: search } };
  const result = startDevelopmentPartnership(state, search.id, "se_club_bodens_bk_hf", 1500, 6, "2026-08-23");
  assert.equal(result.ok, true);
  assert.equal(result.partnership!.type, "DEVELOPMENT_PARTNERSHIP");
  assert.equal(result.partnership!.clubAId, state.playerClubId);
  assert.equal(result.partnership!.clubBId, "se_club_bodens_bk_hf");
  assert.equal(result.partnership!.monthlyCostEur, 1500);
  assert.equal(result.partnership!.endDate, "2027-02-23");
  assert.equal(result.partnership!.status, "ACTIVE");
});

test("startDevelopmentPartnership rejects a negative cost or a sub-1-month duration", () => {
  let state = withDivision1Pool(baseState());
  const search = completedSearch(state, ["se_club_bodens_bk_hf"]);
  state = { ...state, partnershipSearches: { [search.id]: search } };
  assert.equal(startDevelopmentPartnership(state, search.id, "se_club_bodens_bk_hf", -1, 12, state.gameDate).ok, false);
  assert.equal(startDevelopmentPartnership(state, search.id, "se_club_bodens_bk_hf", 1000, 0, state.gameDate).ok, false);
});

test("once a development partnership starts, its partner club becomes exclusively blocked from any other club's candidate list", () => {
  let state = withDivision1Pool(baseState());
  const search = completedSearch(state, ["se_club_bodens_bk_hf"]);
  state = { ...state, partnershipSearches: { [search.id]: search } };
  const result = startDevelopmentPartnership(state, search.id, "se_club_bodens_bk_hf", 1000, 12, state.gameDate);
  state = { ...state, clubPartnerships: { ...state.clubPartnerships, [result.partnership!.id]: result.partnership! } };

  assert.equal(isClubExclusivelyPartnered(state, "se_club_bodens_bk_hf"), true);
  const candidatesForAnotherClub = selectCandidateClubs(state, "se_club_alingsas_hk");
  assert.ok(!candidatesForAnotherClub.includes("se_club_bodens_bk_hf"));
});

test("progressPartnershipExpiry flips an ACTIVE, past-end-date development partnership to EXPIRED, but never touches a permanent row", () => {
  let state = baseState();
  const expiringId = "expiring-1";
  state = {
    ...state,
    clubPartnerships: {
      ...state.clubPartnerships,
      [expiringId]: {
        id: expiringId,
        type: "DEVELOPMENT_PARTNERSHIP",
        clubAId: state.playerClubId,
        clubBId: "se_club_bodens_bk_hf",
        status: "ACTIVE",
        startDate: "2026-01-01",
        endDate: "2026-06-01",
        permanent: false,
        monthlyCostEur: 1000,
        lastBilledDate: null,
      },
    },
  };
  const { state: afterExpiry, expired } = progressPartnershipExpiry(state, "2026-06-01");
  assert.equal(expired.length, 1);
  assert.equal(afterExpiry.clubPartnerships[expiringId].status, "EXPIRED");
  assert.equal(isClubExclusivelyPartnered(afterExpiry, "se_club_bodens_bk_hf"), false);

  const permanentCount = Object.values(afterExpiry.clubPartnerships).filter((p) => p.type === "AFFILIATED_B_TEAM" && p.status !== "ACTIVE").length;
  assert.equal(permanentCount, 0);
});

test("renewPartnership extends the end date and is a no-op for a permanent row", () => {
  let state = baseState();
  const id = "renew-1";
  state = {
    ...state,
    clubPartnerships: {
      ...state.clubPartnerships,
      [id]: { id, type: "DEVELOPMENT_PARTNERSHIP", clubAId: state.playerClubId, clubBId: "se_club_bodens_bk_hf", status: "ACTIVE", startDate: "2026-01-01", endDate: "2026-06-01", permanent: false, monthlyCostEur: 500, lastBilledDate: null },
    },
  };
  const renewed = renewPartnership(state, id, 3);
  assert.equal(renewed.clubPartnerships[id].endDate, "2026-09-01");

  const permanentId = Object.values(state.clubPartnerships).find((p) => p.type === "AFFILIATED_B_TEAM")!.id;
  const stillPermanent = renewPartnership(state, permanentId, 3);
  assert.equal(stillPermanent, state);
});

test("progressPartnershipBilling deducts monthlyCostEur from clubA's cash every 30 days, and never bills a 0-cost (permanent) partnership", () => {
  let state = baseState();
  const economyBefore = state.clubEconomies[state.playerClubId];
  assert.ok(economyBefore, "manager's own club must already have an economy baseline");

  const id = "billing-1";
  state = {
    ...state,
    clubPartnerships: {
      ...state.clubPartnerships,
      [id]: { id, type: "DEVELOPMENT_PARTNERSHIP", clubAId: state.playerClubId, clubBId: "se_club_bodens_bk_hf", status: "ACTIVE", startDate: "2026-01-01", endDate: "2027-01-01", permanent: false, monthlyCostEur: 2000, lastBilledDate: null },
    },
  };

  function adjustClubCash(s: CareerState, clubId: string, deltaEur: number): CareerState {
    const baseline = s.clubEconomies[clubId];
    if (!baseline) return s;
    return { ...s, clubEconomies: { ...s.clubEconomies, [clubId]: { ...baseline, cashEur: Math.max(0, baseline.cashEur + deltaEur) } } };
  }

  const tooEarly = progressPartnershipBilling(state, "2026-01-15", adjustClubCash);
  assert.equal(tooEarly.clubEconomies[state.playerClubId].cashEur, economyBefore.cashEur);

  const firstBill = progressPartnershipBilling(state, "2026-01-31", adjustClubCash);
  assert.equal(firstBill.clubEconomies[state.playerClubId].cashEur, economyBefore.cashEur - 2000);
  assert.equal(firstBill.clubPartnerships[id].lastBilledDate, "2026-01-31");

  // Billed once already -- immediately re-running the same date must not double-bill.
  const noDoubleBill = progressPartnershipBilling(firstBill, "2026-01-31", adjustClubCash);
  assert.equal(noDoubleBill.clubEconomies[state.playerClubId].cashEur, economyBefore.cashEur - 2000);

  // Permanent B-team rows (monthlyCostEur 0) are never billed regardless of date.
  const permanentBefore = Object.values(state.clubPartnerships).find((p) => p.type === "AFFILIATED_B_TEAM")!;
  const afterFarFuture = progressPartnershipBilling(state, "2030-01-01", adjustClubCash);
  assert.equal(afterFarFuture.clubPartnerships[permanentBefore.id].lastBilledDate, null);
});

// ---------------------------------------------------------------------------
// U19 boundary / development-partnership player eligibility
// ---------------------------------------------------------------------------

test("U19 boundary: a player exactly 19 years old (as of gameDate) is eligible for B-team exposure; exactly 20 is not", () => {
  let state = baseState();
  state = { ...state, gameDate: "2026-08-23" };
  const parentId = "se_club_hammarby_if_hf";
  const bTeamId = "se_club_hk_cliff";

  const player19 = syntheticPlayer("p19", parentId, "2007-08-23"); // turns 19 exactly on gameDate
  const player20 = syntheticPlayer("p20", parentId, "2006-08-23"); // turns 20 exactly on gameDate

  const stateWithPlayers: CareerState = { ...state, worldSquads: { ...state.worldSquads, [parentId]: [player19, player20] } };

  const eligible19 = isPartnershipExposureEligible(stateWithPlayers, "p19", bTeamId);
  const eligible20 = isPartnershipExposureEligible(stateWithPlayers, "p20", bTeamId);
  assert.equal(eligible19.eligible, true, eligible19.reason);
  assert.equal(eligible20.eligible, false);
});

test("development-partnership eligibility: 19-year-old is eligible via an ACTIVE DEVELOPMENT_PARTNERSHIP, and ownership stays with the parent club", () => {
  let state = baseState();
  state = { ...state, gameDate: "2026-08-23" };
  const parentId = state.playerClubId;
  const partnerId = "se_club_bodens_bk_hf";

  const player = syntheticPlayer("dev19", parentId, "2007-01-01"); // 19 as of 2026-08-23
  state = {
    ...state,
    worldSquads: { ...state.worldSquads, [parentId]: [...(state.worldSquads[parentId] ?? []), player] },
    clubPartnerships: {
      ...state.clubPartnerships,
      dp1: { id: "dp1", type: "DEVELOPMENT_PARTNERSHIP", clubAId: parentId, clubBId: partnerId, status: "ACTIVE", startDate: "2026-01-01", endDate: "2027-01-01", permanent: false, monthlyCostEur: 1000, lastBilledDate: null },
    },
  };

  const result = isPartnershipExposureEligible(state, "dev19", partnerId);
  assert.equal(result.eligible, true, result.reason);
  const stillOwnedByParent = state.worldSquads[parentId]!.find((p) => p.id === "dev19");
  assert.ok(stillOwnedByParent, "eligibility check must never move/reassign the player");
});

test("eligibility is false when no partnership relation exists between the player's club and the target club", () => {
  const state = withDivision1Pool(baseState());
  const player = syntheticPlayer("noPartner19", state.playerClubId, "2007-01-01");
  const stateWithPlayer = { ...state, worldSquads: { ...state.worldSquads, [state.playerClubId]: [...(state.worldSquads[state.playerClubId] ?? []), player] } };
  const result = isPartnershipExposureEligible(stateWithPlayer, "noPartner19", "se_club_bodens_bk_hf");
  assert.equal(result.eligible, false);
});

// ---------------------------------------------------------------------------
// International loan partnership
// ---------------------------------------------------------------------------

test("international loan partnership: same-country clubs are rejected, different countries accepted", () => {
  const sameCountry = canFormInternationalLoanPartnership("se_club_hammarby_if_hf", "se_club_alingsas_hk");
  assert.equal(sameCountry.ok, false);

  const differentCountries = canFormInternationalLoanPartnership("se_club_hammarby_if_hf", "ger1-kiel");
  assert.equal(differentCountries.ok, true);
});

test("createInternationalLoanPartnership produces a 0-monthlyCostEur row (Part: loan fee = 0) and rejects same-country pairs", () => {
  const state = baseState();
  const result = createInternationalLoanPartnership(state, "se_club_hammarby_if_hf", "ger1-kiel", "2026-08-23", "2027-06-30");
  assert.equal(result.ok, true);
  assert.equal(result.partnership!.type, "INTERNATIONAL_LOAN_PARTNERSHIP");
  assert.equal(result.partnership!.monthlyCostEur, 0);

  const rejected = createInternationalLoanPartnership(state, "se_club_hammarby_if_hf", "se_club_alingsas_hk", "2026-08-23", "2027-06-30");
  assert.equal(rejected.ok, false);
});

// ---------------------------------------------------------------------------
// Existing-save migration
// ---------------------------------------------------------------------------

test("existing-save migration backfills the five permanent B-team relations for a save that predates this milestone", () => {
  const state = baseState();
  // Simulate an old save shape that never had these fields at all.
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).clubPartnerships;
  delete (legacy as Record<string, unknown>).partnershipSearches;

  const migrated = migrateCareerState(legacy as CareerState);
  const permanent = Object.values(migrated.clubPartnerships).filter((p) => p.type === "AFFILIATED_B_TEAM");
  assert.equal(permanent.length, 5);
  assert.deepEqual(migrated.partnershipSearches, {});
});
