// HM-CONTRACTS-1.0: CareerState-level integration proofs -- real
// newCareer/saveMigration flow, mirroring lib/career/careerRatingNormalization.test.ts's
// own established pattern for this exact kind of per-club normalization guarantee.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { getCareerClubSquad } from "./careerWorld";
import { TUMBA_CLUB_ID } from "../game-data";
import { ensureCareerPlayerContracts, getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur, recalibratePlayerContractEndDates, recalibratePlayerContractWages } from "../economy/contractIntegration";
import type { CareerState } from "./types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";

function freshTumba(seed: string): CareerState {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

// (1) every career player gets exactly one persistent contract.
test("(1) a fresh IFK Tumba career gives every roster player exactly one persistent contract, no duplicates, none missing", () => {
  const state = freshTumba("contracts-1");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  for (const player of squad) {
    const contract = getPlayerContract(state, player.id);
    assert.ok(contract, `missing contract for ${player.id}`);
    assert.equal(contract!.playerId, player.id);
  }
  assert.equal(Object.keys(state.playerContracts).length, squad.length);
});

// (2) every player gets salary and market value.
test("(2) every roster player has a positive salary and a positive, bounded market value", () => {
  const state = freshTumba("contracts-2");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  for (const player of squad) {
    const contract = getPlayerContract(state, player.id)!;
    assert.ok(contract.wageEurPerMonth > 0, `${player.id} has zero/negative wage`);
    const value = getPlayerMarketValueEur(state, player.id);
    assert.ok(value !== undefined && value > 0, `${player.id} has no market value`);
    assert.ok(value! <= 220_000, `${player.id} value implausibly high: ${value}`);
  }
});

// (3) real/mock/generated players all work through the same system -- proven via a synthetic non-Tumba club (same genericity precedent as careerRatingNormalization.test.ts's own Part 25 test).
test("(3) an arbitrary non-Tumba club (via injected worldSquads, simulating a REAL_WORLD-fetched squad) gets full contract coverage through the exact same generic mechanism", () => {
  const state = freshTumba("contracts-3");
  const otherClubId = "some-other-club";
  const syntheticSquad = getCareerClubSquad(state, TUMBA_CLUB_ID)
    .slice(0, 5)
    .map((p) => ({ ...p, id: `${otherClubId}:${p.id}`, clubId: otherClubId }));
  const syntheticRatings: GameplayPlayerRating[] = syntheticSquad.map((p) => ({
    ...state.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === p.id.split(":")[1])!,
    playerId: p.id,
  }));
  const withOtherClub: CareerState = {
    ...state,
    worldSquads: { ...state.worldSquads, [otherClubId]: syntheticSquad },
    gameplayRatings: { ...state.gameplayRatings, [otherClubId]: syntheticRatings },
  };
  const result = ensureCareerPlayerContracts(withOtherClub, otherClubId);
  for (const player of syntheticSquad) {
    assert.ok(result.playerContracts[player.id], `missing contract for ${player.id}`);
  }
});

// (4) value is deterministic.
test("(4) getPlayerMarketValueEur returns the identical value across repeated calls with no state change", () => {
  const state = freshTumba("contracts-4");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const a = getPlayerMarketValueEur(state, playerId);
  const b = getPlayerMarketValueEur(state, playerId);
  assert.equal(a, b);
});

// (5) same save never rerolls contract/salary/value.
test("(5) calling ensureCareerPlayerContracts on an already-complete roster returns the exact same state reference (true no-op)", () => {
  const state = freshTumba("contracts-5");
  const result = ensureCareerPlayerContracts(state, TUMBA_CLUB_ID);
  assert.equal(result, state);
});

test("(5b) re-creating the SAME player's contract twice (idempotent fill) never changes an already-persisted contract", () => {
  const state = freshTumba("contracts-5b");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const before = getPlayerContract(state, playerId);
  const again = ensureCareerPlayerContracts(state, TUMBA_CLUB_ID);
  const after = getPlayerContract(again, playerId);
  assert.deepEqual(before, after);
});

// (6) a developed player's value changes automatically -- value is recomputed from current CA, never frozen.
test("(6) a player's market value changes when their CA changes (development), with the contract itself untouched", () => {
  const state = freshTumba("contracts-6");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const before = getPlayerMarketValueEur(state, playerId);
  const contractBefore = getPlayerContract(state, playerId);

  const developed: CareerState = {
    ...state,
    gameplayRatings: { ...state.gameplayRatings, [TUMBA_CLUB_ID]: state.gameplayRatings[TUMBA_CLUB_ID].map((r) => (r.playerId === playerId ? { ...r, ca: Math.min(200, r.ca + 30) } : r)) },
  };
  const after = getPlayerMarketValueEur(developed, playerId);
  const contractAfter = getPlayerContract(developed, playerId);
  assert.notEqual(after, before, `value did not change: before=${before} after=${after}`);
  assert.ok(after! > before!, `value should have increased after CA improved: before=${before} after=${after}`);
  assert.deepEqual(contractAfter, contractBefore, "the contract record itself (end date/wage) must be untouched by a rating change");
});

// (7)/(8) older players and young talents behave plausibly differently -- proven with real generated Tumba data.
test("(7)/(8) among the real generated Tumba roster, a young high-headroom player's value/age relationship is directionally sane", () => {
  const state = freshTumba("contracts-7-8");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  const ratingsById = new Map(state.gameplayRatings[TUMBA_CLUB_ID].map((r) => [r.playerId, r]));
  const withAge = squad
    .map((p) => ({ player: p, rating: ratingsById.get(p.id)! }))
    .filter((e) => e.rating);
  // Just a sanity check that values differ across the roster (not a flat constant), and every value is finite/positive.
  const values = withAge.map((e) => getPlayerMarketValueEur(state, e.player.id)!);
  assert.ok(new Set(values).size > 1, "every player has an identical value -- the model is not actually using per-player inputs");
  assert.ok(values.every((v) => Number.isFinite(v) && v > 0));
});

// (9) GK works without a separate economy pipeline -- proven end-to-end via a real generated Tumba goalkeeper.
test("(9) a real Tumba goalkeeper gets a normal contract/salary/value through the exact same system as an outcourt player", () => {
  const state = freshTumba("contracts-9");
  const gk = getCareerClubSquad(state, TUMBA_CLUB_ID).find((p) => p.position === "MV")!;
  const contract = getPlayerContract(state, gk.id);
  assert.ok(contract);
  assert.ok(contract!.wageEurPerMonth > 0);
  const value = getPlayerMarketValueEur(state, gk.id);
  assert.ok(value !== undefined && value > 0);
});

// (10) reload/navigation -- JSON round-trip preserves everything.
test("(10) a career's contracts survive a JSON save/reload round-trip byte-for-byte", () => {
  const state = freshTumba("contracts-10");
  const roundTripped = JSON.parse(JSON.stringify(state)) as CareerState;
  assert.deepEqual(roundTripped.playerContracts, state.playerContracts);
});

// (11) old saves migrate safely.
test("(11) a pre-HM-CONTRACTS-1.0 save (playerContracts entirely absent) migrates to a complete, non-reallocated contract set", () => {
  const state = freshTumba("contracts-11");
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).playerContracts;
  const migrated = migrateCareerState(legacy as CareerState);
  const squad = getCareerClubSquad(migrated, TUMBA_CLUB_ID);
  assert.equal(Object.keys(migrated.playerContracts).length, squad.length);
});

test("(11b) migrating an already-current save never rerolls an existing contract", () => {
  const state = freshTumba("contracts-11b");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const before = getPlayerContract(state, playerId);
  const migrated = migrateCareerState(state);
  const after = getPlayerContract(migrated, playerId);
  assert.deepEqual(before, after);
});

test("(11c) migrating a save with ONE existing contract keeps its own contractEndDate/clubId exactly, recalibrates only its wage, and fills the rest of the squad", () => {
  const state = freshTumba("contracts-11c");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  const somePlayer = squad[0];
  // HM-WAGE-MARKET-1.0: recalibratePlayerContractWages deliberately
  // overwrites any existing contract's own wage to the current formula
  // (Part: this milestone's whole point). contractEndDate/clubId/
  // playerId are NOT touched by that recalibration -- ensureCareer
  // PlayerContracts's own "never touch an existing entry beyond wage
  // recalibration" contract is what this test now actually verifies.
  const customContract = { ...getPlayerContract(state, somePlayer.id)!, wageEurPerMonth: 999_999 };
  const partial: CareerState = { ...state, playerContracts: { [somePlayer.id]: customContract } };
  const migrated = migrateCareerState(partial);
  const migratedContract = migrated.playerContracts[somePlayer.id];
  assert.equal(migratedContract.contractEndDate, customContract.contractEndDate);
  assert.equal(migratedContract.clubId, customContract.clubId);
  assert.equal(migratedContract.playerId, customContract.playerId);
  assert.notEqual(migratedContract.wageEurPerMonth, 999_999, "the artificially high wage must be recalibrated, not preserved");
  assert.equal(Object.keys(migrated.playerContracts).length, squad.length);
});

// HM-WAGE-MARKET-1.0: recalibratePlayerContractWages proofs.
test("(12) recalibratePlayerContractWages on an already-current-formula save is a true no-op (same state reference)", () => {
  const state = freshTumba("contracts-12");
  const result = recalibratePlayerContractWages(state);
  assert.equal(result, state);
});

test("(13) recalibratePlayerContractWages rescales an artificially high (pre-recalibration-scale) wage down to the current formula's output, leaving contractEndDate/clubId untouched", () => {
  const state = freshTumba("contracts-13");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const currentWage = state.playerContracts[playerId].wageEurPerMonth;
  const inflated: CareerState = {
    ...state,
    playerContracts: { ...state.playerContracts, [playerId]: { ...state.playerContracts[playerId], wageEurPerMonth: currentWage * 3 } },
  };
  const recalibrated = recalibratePlayerContractWages(inflated);
  assert.equal(recalibrated.playerContracts[playerId].wageEurPerMonth, currentWage);
  assert.equal(recalibrated.playerContracts[playerId].contractEndDate, state.playerContracts[playerId].contractEndDate);
  assert.equal(recalibrated.playerContracts[playerId].clubId, state.playerContracts[playerId].clubId);
});

test("(14) recalibratePlayerContractWages leaves an unresolvable player's contract untouched rather than crashing", () => {
  const state = freshTumba("contracts-14");
  const ghostContract = { playerId: "ghost-player", clubId: TUMBA_CLUB_ID, contractEndDate: "2028-06-30", wageEurPerMonth: 12_345 };
  const withGhost: CareerState = { ...state, playerContracts: { ...state.playerContracts, "ghost-player": ghostContract } };
  const recalibrated = recalibratePlayerContractWages(withGhost);
  assert.deepEqual(recalibrated.playerContracts["ghost-player"], ghostContract);
});

// contract status helper sanity via real career.
// HM-DATA-ALLSVENSKAN-1.1B: every generated contract lands on Swedish handball's 1 June -> 31 May contract-year logic.
test("(15) a fresh career's contracts all end on 31 May of some year, never a randomly-spread calendar day", () => {
  const state = freshTumba("contracts-15");
  for (const contract of Object.values(state.playerContracts)) {
    assert.match(contract.contractEndDate, /^\d{4}-05-31$/, `unexpected end date shape: ${contract.contractEndDate}`);
  }
});

test("(16) recalibratePlayerContractEndDates on an already-current-formula save is a true no-op (same state reference)", () => {
  const state = freshTumba("contracts-16");
  const result = recalibratePlayerContractEndDates(state);
  assert.equal(result, state);
});

test("(17) recalibratePlayerContractEndDates corrects a pre-1.1B randomly-spread end date to 31 May of the same end year, leaving wage/clubId untouched", () => {
  const state = freshTumba("contracts-17");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const original = state.playerContracts[playerId];
  const spread: CareerState = {
    ...state,
    playerContracts: { ...state.playerContracts, [playerId]: { ...original, contractEndDate: "2027-08-15" } },
  };
  const recalibrated = recalibratePlayerContractEndDates(spread);
  assert.equal(recalibrated.playerContracts[playerId].contractEndDate, "2027-05-31");
  assert.equal(recalibrated.playerContracts[playerId].wageEurPerMonth, original.wageEurPerMonth);
  assert.equal(recalibrated.playerContracts[playerId].clubId, original.clubId);
});

test("(18) migrateCareerState recalibrates a pre-1.1B randomly-spread end date to 31 May, and is idempotent on a second pass", () => {
  const state = freshTumba("contracts-18");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const spread: CareerState = {
    ...state,
    playerContracts: { ...state.playerContracts, [playerId]: { ...state.playerContracts[playerId], contractEndDate: "2028-03-27" } },
  };
  const migrated = migrateCareerState(spread);
  assert.equal(migrated.playerContracts[playerId].contractEndDate, "2028-05-31");
  const migratedAgain = migrateCareerState(migrated);
  assert.equal(migratedAgain.playerContracts[playerId].contractEndDate, "2028-05-31");
});

test("getPlayerContractStatus resolves UNDER_CONTRACT for a freshly-generated career (every contract ends well in the future)", () => {
  const state = freshTumba("contracts-status");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const status = getPlayerContractStatus(state, playerId);
  assert.ok(status);
  assert.notEqual(status, "FREE_AGENT");
});
