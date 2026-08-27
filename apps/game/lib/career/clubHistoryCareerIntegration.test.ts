// HM-CONTRACTS-1.0A: CareerState-level integration proofs for club/youth
// history, training compensation, and the SEK->EUR contract migration --
// mirroring contractCareerIntegration.test.ts's own established pattern.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { getCareerClubSquad } from "./careerWorld";
import { TUMBA_CLUB_ID } from "../game-data";
import { ensureCareerPlayerClubHistory, getPlayerClubHistory } from "../economy/clubHistoryIntegration";
import { getPlayerTrainingCompensation } from "../economy/trainingCompensationIntegration";
import { EUR_TO_SEK_REFERENCE_RATE } from "../economy/currency";
import type { CareerState } from "./types";
import type { PlayerContract } from "../economy/types";

function freshTumba(seed: string): CareerState {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

// (1) every career player gets a persistent club history entry (even if empty).
test("(1) a fresh IFK Tumba career gives every roster player a persistent club-history record", () => {
  const state = freshTumba("club-history-1");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  for (const player of squad) {
    const history = getPlayerClubHistory(state, player.id);
    assert.ok(history, `missing club history for ${player.id}`);
    assert.equal(history!.playerId, player.id);
  }
  assert.equal(Object.keys(state.playerClubHistory).length, squad.length);
});

// (2) history is a true no-op once complete.
test("(2) calling ensureCareerPlayerClubHistory on an already-complete roster returns the exact same state reference", () => {
  const state = freshTumba("club-history-2");
  const result = ensureCareerPlayerClubHistory(state, TUMBA_CLUB_ID);
  assert.equal(result, state);
});

// (3) history persists across a JSON round-trip.
test("(3) a career's club history survives a JSON save/reload round-trip byte-for-byte", () => {
  const state = freshTumba("club-history-3");
  const roundTripped = JSON.parse(JSON.stringify(state)) as CareerState;
  assert.deepEqual(roundTripped.playerClubHistory, state.playerClubHistory);
});

// (4) old saves migrate club history safely.
test("(4) a pre-HM-CONTRACTS-1.0A save (playerClubHistory entirely absent) migrates to a complete history set", () => {
  const state = freshTumba("club-history-4");
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).playerClubHistory;
  const migrated = migrateCareerState(legacy as CareerState);
  const squad = getCareerClubSquad(migrated, TUMBA_CLUB_ID);
  assert.equal(Object.keys(migrated.playerClubHistory).length, squad.length);
});

test("(4b) migrating an already-current save never rerolls an existing club history entry", () => {
  const state = freshTumba("club-history-4b");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const before = getPlayerClubHistory(state, playerId);
  const migrated = migrateCareerState(state);
  const after = getPlayerClubHistory(migrated, playerId);
  assert.deepEqual(before, after);
});

// (5) training compensation is derivable end-to-end from a real career, and is architecturally separate (its own accessor, never folded into contracts/market value).
test("(5) getPlayerTrainingCompensation resolves for a real roster player without crashing, and is versioned/provenanced", () => {
  const state = freshTumba("club-history-5");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const result = getPlayerTrainingCompensation(state, playerId);
  assert.ok(result, "expected a defined result (zero-or-positive), never undefined for a real roster player with a known age");
  assert.ok(result!.totalEur >= 0);
  assert.ok(result!.ruleSetVersion.length > 0);
});

// (6) real/mock/generated players all work identically -- proven via a synthetic non-Tumba club, same precedent as contractCareerIntegration.test.ts's own test (3).
test("(6) an arbitrary non-Tumba club (synthetic worldSquads) gets full club-history coverage through the exact same generic mechanism", () => {
  const state = freshTumba("club-history-6");
  const otherClubId = "some-other-club-ch";
  const syntheticSquad = getCareerClubSquad(state, TUMBA_CLUB_ID)
    .slice(0, 5)
    .map((p) => ({ ...p, id: `${otherClubId}:${p.id}`, clubId: otherClubId }));
  const withOtherClub: CareerState = {
    ...state,
    worldSquads: { ...state.worldSquads, [otherClubId]: syntheticSquad },
  };
  const result = ensureCareerPlayerClubHistory(withOtherClub, otherClubId);
  for (const player of syntheticSquad) {
    assert.ok(result.playerClubHistory[player.id], `missing club history for ${player.id}`);
  }
});

// ---------------------------------------------------------------------------
// SEK -> EUR contract migration (career-state schema v22, part 1/2).
// ---------------------------------------------------------------------------

test("(7) an HM-CONTRACTS-1.0-era save's legacy wageSekPerMonth converts to wageEurPerMonth at the documented fixed rate, exactly once", () => {
  const state = freshTumba("club-history-7");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const originalWageEur = state.playerContracts[playerId].wageEurPerMonth;
  const oldSekWage = originalWageEur * EUR_TO_SEK_REFERENCE_RATE; // reconstruct what an HM-CONTRACTS-1.0-era save would have stored

  const legacyContract = { ...state.playerContracts[playerId] } as Partial<PlayerContract> & Record<string, unknown>;
  delete legacyContract.wageEurPerMonth;
  legacyContract.wageSekPerMonth = oldSekWage;

  const legacyState: CareerState = {
    ...state,
    playerContracts: { ...state.playerContracts, [playerId]: legacyContract as unknown as PlayerContract },
  };

  const migrated = migrateCareerState(legacyState);
  const migratedContract = migrated.playerContracts[playerId] as PlayerContract & { wageSekPerMonth?: number };

  assert.equal(migratedContract.wageEurPerMonth, Math.round(oldSekWage / EUR_TO_SEK_REFERENCE_RATE));
  assert.equal(migratedContract.wageEurPerMonth, originalWageEur, "round-tripping through the fixed reference rate must recover the original EUR figure");
  assert.equal(migratedContract.wageSekPerMonth, undefined, "the legacy SEK field must not survive migration");
});

test("(7b) migrating an already-EUR contract never re-converts it (no accidental double-division)", () => {
  const state = freshTumba("club-history-7b");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const before = state.playerContracts[playerId].wageEurPerMonth;
  const migrated = migrateCareerState(state);
  assert.equal(migrated.playerContracts[playerId].wageEurPerMonth, before);
});

test("(7c) a migrated SEK wage never ends up implausibly high (would indicate a bare rename instead of a real unit conversion)", () => {
  const state = freshTumba("club-history-7c");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const originalWageEur = state.playerContracts[playerId].wageEurPerMonth;
  const oldSekWage = originalWageEur * EUR_TO_SEK_REFERENCE_RATE;

  const legacyContract = { ...state.playerContracts[playerId] } as Partial<PlayerContract> & Record<string, unknown>;
  delete legacyContract.wageEurPerMonth;
  legacyContract.wageSekPerMonth = oldSekWage;
  const legacyState: CareerState = { ...state, playerContracts: { ...state.playerContracts, [playerId]: legacyContract as unknown as PlayerContract } };

  const migrated = migrateCareerState(legacyState);
  // A bare rename bug would leave wageEurPerMonth == oldSekWage (~11x too high).
  assert.notEqual(migrated.playerContracts[playerId].wageEurPerMonth, oldSekWage);
  assert.ok(migrated.playerContracts[playerId].wageEurPerMonth <= 13_000, `migrated wage implausibly high: ${migrated.playerContracts[playerId].wageEurPerMonth}`);
});
