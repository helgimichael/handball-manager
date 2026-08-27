// HM-TRANSFERS-1.0: the core roster-move mechanics, tested directly
// against real generated careers (Tumba + a real-world Handbollsligan
// competition) rather than hand-built fixtures, so squad/rating/
// contract consistency is proven end-to-end.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { getClubsByCompetition, TUMBA_CLUB_ID } from "../game-data";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { getCareerClubSquad, getCareerPlayer } from "../career/careerWorld";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { getPlayerContract } from "../economy/contractIntegration";
import { getPlayerClubHistory } from "../economy/clubHistoryIntegration";
import { computeNewContractEndDate, loanPlayerOut, returnPlayerFromLoan, transferPlayerPermanently } from "./transferExecution";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";

function realWorldState(playerClubId: string) {
  const worldSquads = snapshotWorldSquads(HANDBOLLSLIGAN_ID);
  const gameplayRatings = snapshotGameplayRatings(HANDBOLLSLIGAN_ID);
  return createNewCareerState(`transfer-exec-${playerClubId}`, playerClubId, worldSquads, {}, gameplayRatings);
}

test("(1) transferPlayerPermanently moves the player out of the old club's squad and into the new club's, with clubId updated", () => {
  const state = realWorldState("se_club_ifk_skovde_hk");
  const fromClubId = getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== "se_club_ifk_skovde_hk")!.id;
  const player = state.worldSquads[fromClubId][0];
  const next = transferPlayerPermanently(state, player.id, fromClubId, "se_club_ifk_skovde_hk", 1000, "2029-06-30");

  assert.ok(!getCareerClubSquad(next, fromClubId).some((p) => p.id === player.id));
  const moved = getCareerClubSquad(next, "se_club_ifk_skovde_hk").find((p) => p.id === player.id);
  assert.ok(moved);
  assert.equal(moved!.clubId, "se_club_ifk_skovde_hk");
});

test("(2) transferPlayerPermanently moves the player's own GameplayPlayerRating array entry to the new club", () => {
  const state = realWorldState("se_club_ifk_skovde_hk");
  const fromClubId = getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== "se_club_ifk_skovde_hk")!.id;
  const player = state.worldSquads[fromClubId][0];
  const next = transferPlayerPermanently(state, player.id, fromClubId, "se_club_ifk_skovde_hk", 1000, "2029-06-30");

  assert.ok(!next.gameplayRatings[fromClubId]?.some((r) => r.playerId === player.id));
  assert.ok(next.gameplayRatings["se_club_ifk_skovde_hk"]?.some((r) => r.playerId === player.id));
  assert.equal(getCareerPlayerRating(next, player.id, "se_club_ifk_skovde_hk")?.playerId, player.id);
});

test("(3) transferPlayerPermanently writes a brand-new PlayerContract at the new club with the given wage/end date", () => {
  const state = realWorldState("se_club_ifk_skovde_hk");
  const fromClubId = getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== "se_club_ifk_skovde_hk")!.id;
  const player = state.worldSquads[fromClubId][0];
  const next = transferPlayerPermanently(state, player.id, fromClubId, "se_club_ifk_skovde_hk", 1234, "2030-01-15");

  const contract = getPlayerContract(next, player.id)!;
  assert.equal(contract.clubId, "se_club_ifk_skovde_hk");
  assert.equal(contract.wageEurPerMonth, 1234);
  assert.equal(contract.contractEndDate, "2030-01-15");
});

test("(4) transferPlayerPermanently appends a real club-history entry for the departing club", () => {
  const state = realWorldState("se_club_ifk_skovde_hk");
  const fromClubId = getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== "se_club_ifk_skovde_hk")!.id;
  const player = state.worldSquads[fromClubId][0];
  const before = getPlayerClubHistory(state, player.id)?.entries.length ?? 0;
  const next = transferPlayerPermanently(state, player.id, fromClubId, "se_club_ifk_skovde_hk", 1000, "2029-06-30");

  const history = getPlayerClubHistory(next, player.id)!;
  assert.equal(history.entries.length, before + 1);
  const appended = history.entries[history.entries.length - 1];
  assert.equal(appended.clubId, fromClubId);
  assert.ok(appended.toAge > appended.fromAge);
});

test("(5) transferPlayerPermanently into IFK Tumba materializes worldSquads[TUMBA_CLUB_ID] and getCareerPlayer resolves the player there afterward", () => {
  const state = realWorldState("se_club_ifk_skovde_hk");
  const fromClubId = "se_club_ifk_skovde_hk";
  const player = state.worldSquads[fromClubId][0];
  // Tumba isn't this career's own club here, so it starts with no worldSquads entry at all.
  assert.equal(state.worldSquads[TUMBA_CLUB_ID], undefined);
  const next = transferPlayerPermanently(state, player.id, fromClubId, TUMBA_CLUB_ID, 500, "2029-06-30");

  assert.ok(next.worldSquads[TUMBA_CLUB_ID]);
  assert.ok(next.worldSquads[TUMBA_CLUB_ID].some((p) => p.id === player.id));
  assert.equal(getCareerPlayer(next, player.id)?.clubId, TUMBA_CLUB_ID);
});

test("(6) transferPlayerPermanently out of IFK Tumba never mutates the shared static TUMBA_SQUAD import", () => {
  const state = createNewCareerState("transfer-exec-tumba-out", TUMBA_CLUB_ID);
  const player = getCareerClubSquad(state, TUMBA_CLUB_ID)[0];
  const otherClubId = getClubsByCompetition(state.competitionId).find((c) => c.id !== TUMBA_CLUB_ID)!.id;
  const beforeCount = getCareerClubSquad(state, TUMBA_CLUB_ID).length;

  transferPlayerPermanently(state, player.id, TUMBA_CLUB_ID, otherClubId, 500, "2029-06-30");

  // Re-deriving a FRESH career must still see the untouched, full-size static squad.
  const freshState = createNewCareerState("transfer-exec-tumba-out-2", TUMBA_CLUB_ID);
  assert.equal(getCareerClubSquad(freshState, TUMBA_CLUB_ID).length, beforeCount);
  assert.ok(getCareerClubSquad(freshState, TUMBA_CLUB_ID).some((p) => p.id === player.id));
});

test("(7) loanPlayerOut moves squad/rating to the borrowing club and reduces the contract's own wage to the wage share, without touching club history", () => {
  const state = realWorldState("se_club_ifk_skovde_hk");
  const parentClubId = getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== "se_club_ifk_skovde_hk")!.id;
  const player = state.worldSquads[parentClubId][0];
  const originalWage = getPlayerContract(state, player.id)!.wageEurPerMonth;
  const historyBefore = getPlayerClubHistory(state, player.id)?.entries.length ?? 0;

  const next = loanPlayerOut(state, player.id, parentClubId, "se_club_ifk_skovde_hk", 60);

  assert.equal(getCareerPlayer(next, player.id)?.clubId, "se_club_ifk_skovde_hk");
  const loanContract = getPlayerContract(next, player.id)!;
  assert.equal(loanContract.clubId, "se_club_ifk_skovde_hk");
  assert.equal(loanContract.wageEurPerMonth, Math.round((originalWage * 60) / 100));
  assert.equal(getPlayerClubHistory(next, player.id)?.entries.length ?? 0, historyBefore, "a loan must never append club history");
});

test("(8) returnPlayerFromLoan is the exact inverse of loanPlayerOut -- squad/rating/contract restored to the parent club with the original wage", () => {
  const state = realWorldState("se_club_ifk_skovde_hk");
  const parentClubId = getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== "se_club_ifk_skovde_hk")!.id;
  const player = state.worldSquads[parentClubId][0];
  const originalContract = getPlayerContract(state, player.id)!;

  const onLoan = loanPlayerOut(state, player.id, parentClubId, "se_club_ifk_skovde_hk", 50);
  const returned = returnPlayerFromLoan(onLoan, player.id, parentClubId, "se_club_ifk_skovde_hk", originalContract.wageEurPerMonth, originalContract.contractEndDate);

  assert.equal(getCareerPlayer(returned, player.id)?.clubId, parentClubId);
  assert.ok(!getCareerClubSquad(returned, "se_club_ifk_skovde_hk").some((p) => p.id === player.id));
  assert.deepEqual(getPlayerContract(returned, player.id), originalContract);
  assert.ok(getCareerPlayerRating(returned, player.id, parentClubId));
});

test("(9) computeNewContractEndDate is deterministic and lands in the expected season", () => {
  const a = computeNewContractEndDate("p-1", "2026-08-19", 3);
  const b = computeNewContractEndDate("p-1", "2026-08-19", 3);
  assert.equal(a, b);
  assert.ok(a >= "2029-01-01" && a <= "2029-12-31", `expected ~3 seasons out, got ${a}`);
});
