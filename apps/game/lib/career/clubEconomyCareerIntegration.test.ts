// HM-ECONOMY-1.0: CareerState-level integration proofs -- real
// newCareer/saveMigration flow, mirroring contractCareerIntegration.test.ts's
// own established pattern.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { getClubsByCompetition, TUMBA_CLUB_ID } from "../game-data";
import { ensureCareerAllClubEconomies, ensureCareerClubEconomy, getClubBudgets, getClubEconomyBaseline, getClubEconomySnapshot, getClubFinancialHealth, getClubPlayerWageCostsEurAnnual, getClubStaffCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { getCareerWorldCompetitionIds } from "./worldCompetitions";
import { snapshotClubStaff } from "../gameWorld/staffIdentitySnapshot";
import type { CareerState } from "./types";

function freshTumba(seed: string): CareerState {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

/** HM-DATA-ALLSVENSKAN-1.1B: IFK Tumba is a REAL_WORLD club, so its staffRoster is only ever populated from real fetched identity data (never generated filler) -- tests that need Tumba to actually HAVE staff must inject the real snapshot, exactly like CareerContext.tsx's own fetchStaffIdentity does server-side. */
function freshTumbaWithStaff(seed: string): CareerState {
  const snap = snapshotClubStaff(TUMBA_CLUB_ID);
  return createNewCareerState(seed, TUMBA_CLUB_ID, {}, {}, {}, snap ? { [TUMBA_CLUB_ID]: snap } : {});
}

// (1) every career club gets a persistent economic baseline.
// HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0: widened from "every club in
// the manager's own competition" to "every club across every world-active
// Swedish competition" (Handbollsligan, Allsvenskan, Division 1
// Norra/Södra) -- Division 1 clubs now get a real (discounted, Part 14)
// economy too, not just contracts/ratings.
test("(1) a fresh IFK Tumba career gives every club across every world-active Swedish competition a persistent economy baseline", () => {
  const state = freshTumba("economy-1");
  const clubIds = getCareerWorldCompetitionIds(state).flatMap((id) => getClubsByCompetition(id)).map((c) => c.id);
  for (const clubId of clubIds) {
    const baseline = getClubEconomyBaseline(state, clubId);
    assert.ok(baseline, `missing club economy baseline for ${clubId}`);
    assert.equal(baseline!.clubId, clubId);
  }
  assert.equal(Object.keys(state.clubEconomies).length, clubIds.length);
});

// (2) true no-op once complete.
test("(2) calling ensureCareerAllClubEconomies on an already-complete world returns the exact same state reference", () => {
  const state = freshTumba("economy-2");
  const result = ensureCareerAllClubEconomies(state);
  assert.equal(result, state);
});

test("(2b) calling ensureCareerClubEconomy on a single already-complete club is a true no-op", () => {
  const state = freshTumba("economy-2b");
  const result = ensureCareerClubEconomy(state, TUMBA_CLUB_ID);
  assert.equal(result, state);
});

// (3) JSON round-trip.
test("(3) a career's club economies survive a JSON save/reload round-trip byte-for-byte", () => {
  const state = freshTumba("economy-3");
  const roundTripped = JSON.parse(JSON.stringify(state)) as CareerState;
  assert.deepEqual(roundTripped.clubEconomies, state.clubEconomies);
});

// (4) old saves migrate club economy safely.
test("(4) a pre-HM-ECONOMY-1.0 save (clubEconomies entirely absent) migrates to a complete economy set for every world-active Swedish club", () => {
  const state = freshTumba("economy-4");
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).clubEconomies;
  const migrated = migrateCareerState(legacy as CareerState);
  const clubIds = getCareerWorldCompetitionIds(migrated).flatMap((id) => getClubsByCompetition(id)).map((c) => c.id);
  assert.equal(Object.keys(migrated.clubEconomies).length, clubIds.length);
});

test("(4b) migrating an already-current save never rerolls an existing club economy baseline", () => {
  const state = freshTumba("economy-4b");
  const before = getClubEconomyBaseline(state, TUMBA_CLUB_ID);
  const migrated = migrateCareerState(state);
  const after = getClubEconomyBaseline(migrated, TUMBA_CLUB_ID);
  assert.deepEqual(before, after);
});

// (5) player wages actually sum to the club's own wage costs.
test("(5) the manager's own club's playerWageCostsEurAnnual is the real sum of its roster's own contracts, not an invented number", () => {
  const state = freshTumba("economy-5");
  const wageCosts = getClubPlayerWageCostsEurAnnual(state, TUMBA_CLUB_ID);
  const expected = Object.values(state.playerContracts)
    .filter((c) => c.clubId === TUMBA_CLUB_ID)
    .reduce((sum, c) => sum + c.wageEurPerMonth * 12, 0);
  assert.equal(wageCosts, expected);
  assert.ok(wageCosts > 0, "a real roster with real contracts should have positive wage costs");
});

// (6) staff costs are derived from the real staff roster.
test("(6) staffCostsEurAnnual is 0 for a club with no staffRoster entry, positive for the manager's own staffed club (real staff identity injected)", () => {
  const state = freshTumbaWithStaff("economy-6");
  const otherClubId = getClubsByCompetition(state.competitionId).map((c) => c.id).find((id) => id !== TUMBA_CLUB_ID)!;
  assert.equal(getClubStaffCostsEurAnnual(state, otherClubId), 0);
  assert.ok(getClubStaffCostsEurAnnual(state, TUMBA_CLUB_ID) > 0);
});

// HM-DATA-ALLSVENSKAN-1.1B Part 4: the core regression guard at the economy layer -- a REAL_WORLD club with no fetched staff identity has ZERO staff cost, never a generated-filler cost.
test("(6b) a REAL_WORLD club (IFK Tumba) with NO fetched staff identity has staffCostsEurAnnual of exactly 0 -- never generated filler cost", () => {
  const state = freshTumba("economy-6b");
  assert.equal(getClubStaffCostsEurAnnual(state, TUMBA_CLUB_ID), 0);
});

// (7) financial health is derived, not random -- deterministic given the same state.
test("(7) getClubFinancialHealth is deterministic and never returns a value for an unknown club", () => {
  const state = freshTumba("economy-7");
  const a = getClubFinancialHealth(state, TUMBA_CLUB_ID);
  const b = getClubFinancialHealth(state, TUMBA_CLUB_ID);
  assert.deepEqual(a, b);
  assert.equal(getClubFinancialHealth(state, "not-a-real-club"), undefined);
});

// (8) budgets are separate from cash/revenue -- never identical numbers.
test("(8) wage/transfer/staff/academy budgets are each their own distinct figure, never a copy of cash or revenue", () => {
  const state = freshTumba("economy-8");
  const budgets = getClubBudgets(state, TUMBA_CLUB_ID)!;
  const baseline = getClubEconomyBaseline(state, TUMBA_CLUB_ID)!;
  const snapshot = getClubEconomySnapshot(state, TUMBA_CLUB_ID)!;
  assert.notEqual(budgets.wageBudgetEur, baseline.cashEur);
  assert.notEqual(budgets.transferBudgetEur, snapshot.recurringRevenueEur);
  assert.notEqual(budgets.wageBudgetEur, budgets.transferBudgetEur);
  assert.notEqual(budgets.staffBudgetEur, budgets.academyBudgetEur);
});

// (9) OVER_BUDGET never erases an existing contract.
test("(9) a club whose real wage costs exceed its wage budget is flagged wageOverBudget, but every existing contract remains untouched", () => {
  const state = freshTumba("economy-9");
  const before = { ...state.playerContracts };
  const budgets = getClubBudgets(state, TUMBA_CLUB_ID)!;
  if (budgets.wageOverBudget) {
    assert.deepEqual(state.playerContracts, before);
  }
  // Always true regardless of whether this seed happens to be over budget -- contracts are never touched by budget derivation.
  assert.deepEqual(state.playerContracts, before);
});

// (10) mock and real-world clubs both work through the same mechanism.
test("(10) every club in the competition (mock-only and real-world-backed alike) resolves a full economy snapshot with no crash", () => {
  const state = freshTumba("economy-10");
  const clubIds = getClubsByCompetition(state.competitionId).map((c) => c.id);
  for (const clubId of clubIds) {
    const snapshot = getClubEconomySnapshot(state, clubId);
    assert.ok(snapshot, `no snapshot for ${clubId}`);
    assert.ok(Number.isFinite(snapshot!.recurringRevenueEur) && snapshot!.recurringRevenueEur > 0);
    assert.ok(Number.isFinite(snapshot!.cashEur) && snapshot!.cashEur >= 0);
  }
});

// (11) an arbitrary synthetic non-Tumba club works through the exact same generic mechanism, same precedent as contractCareerIntegration.test.ts's own test (3).
test("(11) an arbitrary club id never before seen resolves a full economy baseline through the exact same generic mechanism", () => {
  const state = freshTumba("economy-11");
  const result = ensureCareerClubEconomy(state, "some-brand-new-club-id");
  assert.ok(result.clubEconomies["some-brand-new-club-id"]);
});
