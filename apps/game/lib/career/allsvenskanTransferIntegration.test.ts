// HM-DATA-ALLSVENSKAN-1.1: proves Transfer 1.0's first real test in
// Allsvenskan -- IFK Tumba (the manager's own club) can find, price,
// bid on, and complete a permanent transfer AND a loan for a real
// player at another real Allsvenskan club, exactly mirroring
// transferCareerIntegration.test.ts's own established Handbollsligan
// pattern.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getCareerClubSquad, getCareerPlayer } from "./careerWorld";
import { getClubsByCompetition, TUMBA_CLUB_ID } from "../game-data";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { submitTransferOffer } from "../transfers/transferIntegration";
import { getPlayerContract, getPlayerMarketValueEur } from "../economy/contractIntegration";
import type { CareerState } from "./types";

const ALLSVENSKAN_ID = "swe-2";

function tumbaState(seed: string): CareerState {
  const worldSquads = snapshotWorldSquads(ALLSVENSKAN_ID);
  const gameplayRatings = snapshotGameplayRatings(ALLSVENSKAN_ID);
  return createNewCareerState(seed, TUMBA_CLUB_ID, worldSquads, {}, gameplayRatings);
}

function pickSellerAndPlayer(state: CareerState) {
  const sellerClubId = getClubsByCompetition(ALLSVENSKAN_ID).find((c) => c.id !== TUMBA_CLUB_ID && (state.worldSquads[c.id]?.length ?? 0) > 3)!.id;
  const player = state.worldSquads[sellerClubId][0];
  return { sellerClubId, player };
}

test("(1) IFK Tumba's worldSquads is populated with real players from every other real-world Allsvenskan club, not just its own", () => {
  const state = tumbaState("as-xfer-setup");
  const otherClubIds = getClubsByCompetition(ALLSVENSKAN_ID).filter((c) => c.id !== TUMBA_CLUB_ID);
  assert.ok(otherClubIds.length >= 10);
  const clubsWithSquads = otherClubIds.filter((c) => (state.worldSquads[c.id]?.length ?? 0) > 0);
  assert.equal(clubsWithSquads.length, otherClubIds.length, "expected every other Allsvenskan club to have a real, non-empty squad");
});

test("(2) IFK Tumba can see an opponent player's real profile: market value and contract both resolve", () => {
  const state = tumbaState("as-xfer-2");
  const { player } = pickSellerAndPlayer(state);
  const value = getPlayerMarketValueEur(state, player.id);
  const contract = getPlayerContract(state, player.id);
  assert.ok(value !== null && value! > 0, "expected a resolvable market value");
  assert.ok(contract !== undefined, "expected a resolvable contract");
});

test("(3) a well-priced permanent offer from IFK Tumba to another Allsvenskan club moves the player and is COMPLETED", () => {
  const state = tumbaState("as-xfer-3");
  const { sellerClubId, player } = pickSellerAndPlayer(state);
  const value = getPlayerMarketValueEur(state, player.id)!;
  const currentWage = getPlayerContract(state, player.id)!.wageEurPerMonth;
  const result = submitTransferOffer(state, { dealType: "PERMANENT", playerId: player.id, toClubId: TUMBA_CLUB_ID, transferFeeEur: Math.round(value * 1.5), newWageEurPerMonth: currentWage + 200, contractYears: 3 });

  assert.equal(result.offer.status, "COMPLETED");
  assert.equal(getCareerPlayer(result.state, player.id)?.clubId, TUMBA_CLUB_ID);
  const contract = getPlayerContract(result.state, player.id)!;
  assert.equal(contract.clubId, TUMBA_CLUB_ID);
  assert.equal(contract.wageEurPerMonth, currentWage + 200);
  assert.ok(getCareerClubSquad(result.state, TUMBA_CLUB_ID).some((p) => p.id === player.id));
  assert.ok(!getCareerClubSquad(result.state, sellerClubId).some((p) => p.id === player.id));
});

test("(4) IFK Tumba can loan in a real player from another Allsvenskan club with a simple wage share", () => {
  const state = tumbaState("as-xfer-4");
  const { sellerClubId, player } = pickSellerAndPlayer(state);
  const currentWage = getPlayerContract(state, player.id)!.wageEurPerMonth;
  const result = submitTransferOffer(state, {
    dealType: "LOAN",
    playerId: player.id,
    toClubId: TUMBA_CLUB_ID,
    transferFeeEur: 0,
    newWageEurPerMonth: currentWage,
    loanTerms: { endDate: "2027-06-30", wageShareBorrowingPct: 60 },
  });

  assert.equal(result.offer.status, "COMPLETED");
  assert.equal(getCareerPlayer(result.state, player.id)?.clubId, TUMBA_CLUB_ID);
  assert.ok(Object.values(result.state.loans).some((l) => l.playerId === player.id && l.borrowingClubId === TUMBA_CLUB_ID && l.parentClubId === sellerClubId));
});

test("(5) an unaffordable offer from IFK Tumba to another Allsvenskan club is blocked, never silently completed", () => {
  const state = tumbaState("as-xfer-5");
  const { player } = pickSellerAndPlayer(state);
  const result = submitTransferOffer(state, { dealType: "PERMANENT", playerId: player.id, toClubId: TUMBA_CLUB_ID, transferFeeEur: 50_000_000, newWageEurPerMonth: 500_000, contractYears: 3 });
  assert.equal(result.offer.status, "BLOCKED_UNAFFORDABLE");
  assert.equal(getCareerPlayer(result.state, player.id)?.clubId, player.clubId, "player must not move on a blocked offer");
});
