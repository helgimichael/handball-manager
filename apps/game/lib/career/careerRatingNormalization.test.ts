// HM-RATINGS-CAREER-1.0 Part 28/31: directional proofs for the
// universal roster-rating guarantee -- real CareerState throughout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { ensureCareerGameplayRatings, getCareerPlayerRating } from "./careerRatingNormalization";
import { getCareerClubSquad } from "./careerWorld";
import { TUMBA_CLUB_ID } from "../game-data";
import type { CareerState } from "./types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";

function freshTumba(seed: string) {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

// (2) every mock roster player gets rating.
test("(2)/(4) a fresh IFK Tumba career has a rating for every roster player, none omitted", () => {
  const state = freshTumba("norm-2-4");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  const ratings = state.gameplayRatings[TUMBA_CLUB_ID] ?? [];
  const ratedIds = new Set(ratings.map((r) => r.playerId));
  for (const player of squad) {
    assert.ok(ratedIds.has(player.id), `missing rating for ${player.id}`);
  }
  assert.equal(ratings.length, squad.length);
});

// (25) additional mock club works without Tumba hardcode.
test("(25) an arbitrary non-Tumba mock club (via worldSquads) gets full rating coverage through the exact same generic mechanism", () => {
  const state = freshTumba("norm-25");
  const otherClubId = "some-other-mock-club";
  const syntheticSquad = getCareerClubSquad(state, TUMBA_CLUB_ID).slice(0, 5).map((p) => ({ ...p, id: `${otherClubId}:${p.id}`, clubId: otherClubId }));
  const withOtherClub: CareerState = { ...state, worldSquads: { ...state.worldSquads, [otherClubId]: syntheticSquad } };

  const result = ensureCareerGameplayRatings(withOtherClub, otherClubId);
  const ratings = result.gameplayRatings[otherClubId] ?? [];
  assert.equal(ratings.length, syntheticSquad.length);
  for (const player of syntheticSquad) {
    assert.ok(ratings.some((r) => r.playerId === player.id), `missing rating for ${player.id}`);
  }
});

// (5) no duplicate player profile resolution / (6) evidence-backed wins over generated fallback.
test("(5)/(6)/(24) an existing (evidence-backed OR already-developed) rating always wins -- ensureCareerGameplayRatings never overwrites it", () => {
  const state = freshTumba("norm-5-6-24");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  const somePlayer = squad[0];
  const existingRating = state.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === somePlayer.id)!;
  const developedRating: GameplayPlayerRating = { ...existingRating, ca: existingRating.ca + 17 }; // simulate a developed value
  const withDeveloped: CareerState = { ...state, gameplayRatings: { ...state.gameplayRatings, [TUMBA_CLUB_ID]: state.gameplayRatings[TUMBA_CLUB_ID].map((r) => (r.playerId === somePlayer.id ? developedRating : r)) } };

  const result = ensureCareerGameplayRatings(withDeveloped, TUMBA_CLUB_ID);
  const found = result.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === somePlayer.id);
  assert.deepEqual(found, developedRating, "an existing rating (developed or evidence-backed) must never be overwritten");
  // No duplicate entries for the same playerId.
  const countForPlayer = result.gameplayRatings[TUMBA_CLUB_ID].filter((r) => r.playerId === somePlayer.id).length;
  assert.equal(countForPlayer, 1);
});

// (7) existing rating preserved byte-for-byte where appropriate.
test("(7) calling ensureCareerGameplayRatings on an already-complete roster returns the exact same state reference (true no-op)", () => {
  const state = freshTumba("norm-7");
  const result = ensureCareerGameplayRatings(state, TUMBA_CLUB_ID);
  assert.equal(result, state, "expected the identical object reference back, not just a deep-equal copy");
});

// (9) generated rating stable across repeated normalization.
test("(9)/(21) normalization is idempotent -- calling it twice produces byte-identical ratings", () => {
  const state = freshTumba("norm-9-21");
  // Force a fresh (unnormalized) state by stripping ratings, then normalize twice.
  const stripped: CareerState = { ...state, gameplayRatings: { ...state.gameplayRatings, [TUMBA_CLUB_ID]: [] } };
  const once = ensureCareerGameplayRatings(stripped, TUMBA_CLUB_ID);
  const twice = ensureCareerGameplayRatings(once, TUMBA_CLUB_ID);
  assert.deepEqual(once.gameplayRatings[TUMBA_CLUB_ID], twice.gameplayRatings[TUMBA_CLUB_ID]);
  assert.equal(once, twice, "the second call must be a true no-op (same reference)");
});

// (22) empty gameplayRatings becomes complete.
test("(22) an empty gameplayRatings[club] becomes fully complete after normalization", () => {
  const state = freshTumba("norm-22");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  const stripped: CareerState = { ...state, gameplayRatings: { [TUMBA_CLUB_ID]: [] } };
  const result = ensureCareerGameplayRatings(stripped, TUMBA_CLUB_ID);
  assert.equal(result.gameplayRatings[TUMBA_CLUB_ID].length, squad.length);
});

// (23) partial gameplayRatings only fills gaps.
test("(23) a partial gameplayRatings[club] only gains the MISSING players, existing ones untouched", () => {
  const state = freshTumba("norm-23");
  const full = state.gameplayRatings[TUMBA_CLUB_ID];
  const partial = full.slice(0, 3);
  const withPartial: CareerState = { ...state, gameplayRatings: { [TUMBA_CLUB_ID]: partial } };
  const result = ensureCareerGameplayRatings(withPartial, TUMBA_CLUB_ID);
  assert.equal(result.gameplayRatings[TUMBA_CLUB_ID].length, full.length);
  for (const original of partial) {
    const stillThere = result.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === original.playerId);
    assert.deepEqual(stillThere, original, "an existing partial-set entry must never be regenerated");
  }
});

// getCareerPlayerRating helper (Part 12).
test("getCareerPlayerRating finds a player's own rating with or without an explicit clubId", () => {
  const state = freshTumba("norm-lookup");
  const somePlayerId = state.gameplayRatings[TUMBA_CLUB_ID][0].playerId;
  assert.ok(getCareerPlayerRating(state, somePlayerId));
  assert.ok(getCareerPlayerRating(state, somePlayerId, TUMBA_CLUB_ID));
  assert.equal(getCareerPlayerRating(state, "no-such-player"), undefined);
});

// ---------------------------------------------------------------------------
// Migration tests (Part 31).
// ---------------------------------------------------------------------------

// (46) v17 save with empty ratings backfills.
test("(46) a v17-shaped save (gameplayRatings deleted entirely) migrates to a full roster of ratings", () => {
  const state = freshTumba("migration-46");
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).gameplayRatings;
  const migrated = migrateCareerState(legacy as CareerState);
  const squad = getCareerClubSquad(migrated, TUMBA_CLUB_ID);
  assert.equal(migrated.gameplayRatings[TUMBA_CLUB_ID].length, squad.length);
});

// (47)/(48) v17 save with partial ratings preserves existing, evidence-backed ratings not regenerated.
test("(47)/(48) a save with an existing evidence-backed rating for one player preserves it exactly through migration, only filling the rest", () => {
  const state = freshTumba("migration-47-48");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  const evidenceRating: GameplayPlayerRating = { ...state.gameplayRatings[TUMBA_CLUB_ID][0], caSource: "CALIBRATED", ca: 175 };
  const partial: CareerState = { ...state, gameplayRatings: { [TUMBA_CLUB_ID]: [evidenceRating] } };
  const migrated = migrateCareerState(partial);
  assert.equal(migrated.gameplayRatings[TUMBA_CLUB_ID].length, squad.length);
  const preserved = migrated.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === evidenceRating.playerId);
  assert.deepEqual(preserved, evidenceRating);
});

// (49) developed career rating not reverted.
test("(49) a developed (CA-changed) rating survives migration unchanged", () => {
  const state = freshTumba("migration-49");
  const developed: GameplayPlayerRating = { ...state.gameplayRatings[TUMBA_CLUB_ID][0], ca: state.gameplayRatings[TUMBA_CLUB_ID][0].ca + 5 };
  const withDeveloped: CareerState = { ...state, gameplayRatings: { ...state.gameplayRatings, [TUMBA_CLUB_ID]: state.gameplayRatings[TUMBA_CLUB_ID].map((r) => (r.playerId === developed.playerId ? developed : r)) } };
  const migrated = migrateCareerState(withDeveloped);
  const found = migrated.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === developed.playerId);
  assert.deepEqual(found, developed);
});

// (50) migration/load normalization deterministic.
test("(50) migrating the same legacy state twice produces byte-identical results", () => {
  const state = freshTumba("migration-50");
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).gameplayRatings;
  const a = migrateCareerState(legacy as CareerState);
  const b = migrateCareerState(legacy as CareerState);
  assert.deepEqual(a.gameplayRatings, b.gameplayRatings);
});

// (51) save/reload does not reroll generated PA -- covered by idempotent-migration below, explicit PA check.
test("(51) re-migrating an already-migrated state does not reroll any player's PA", () => {
  const state = freshTumba("migration-51");
  const once = migrateCareerState(state);
  const twice = migrateCareerState(once);
  const pasOnce = once.gameplayRatings[TUMBA_CLUB_ID].map((r) => r.pa);
  const pasTwice = twice.gameplayRatings[TUMBA_CLUB_ID].map((r) => r.pa);
  assert.deepEqual(pasOnce, pasTwice);
});

// (52) no fixture/history/tactics/training/staff state lost.
test("(52) migration's rating normalization does not touch any other CareerState field", () => {
  const state = freshTumba("migration-52");
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).gameplayRatings;
  const migrated = migrateCareerState(legacy as CareerState);
  assert.deepEqual(migrated.fixtures, state.fixtures);
  assert.deepEqual(migrated.tactics, state.tactics);
  assert.deepEqual(migrated.trainingWeeks, state.trainingWeeks);
  assert.deepEqual(migrated.staffRoster, state.staffRoster);
  assert.deepEqual(migrated.playerStatuses, state.playerStatuses);
});
