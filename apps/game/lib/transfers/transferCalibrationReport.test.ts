// HM-TRANSFERS-1.0: the mandatory example report -- real engine output
// for the five required deal archetypes, logged for manual review (same
// "report actual numbers" philosophy as every prior milestone's own
// calibration report).
import { test } from "node:test";
import { createNewCareerState } from "../career/newCareer";
import { getClubsByCompetition } from "../game-data";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { submitTransferOffer, progressDailyTransfers } from "./transferIntegration";
import { getPlayerContract, getPlayerMarketValueEur } from "../economy/contractIntegration";
import { getPlayerTrainingCompensation } from "../economy/trainingCompensationIntegration";
import { getCareerPlayer } from "../career/careerWorld";
import { formatEur } from "../economy/currency";
import type { CareerState } from "../career/types";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";
const BUYER = "se_club_ov_helsingborg"; // richest sampled Handbollsligan club -- genuinely affords deals.

function reportRow(label: string, offer: ReturnType<typeof submitTransferOffer>["offer"], marketValueEur: number | undefined) {
  return {
    DEAL: label,
    "MARKET VALUE": marketValueEur !== undefined ? formatEur(marketValueEur) : "—",
    OFFER: formatEur(offer.transferFeeEur),
    "TRANSFER FEE": formatEur(offer.transferFeeEur),
    "TRAINING COMP": formatEur(offer.trainingCompensationEur),
    WAGE: formatEur(offer.newWageEurPerMonth) + "/mån",
    "TOTAL COST": formatEur(offer.transferFeeEur + offer.trainingCompensationEur),
    RESULT: offer.status,
  };
}

test("Part: HM-TRANSFERS-1.0 example report -- five required deal archetypes, real engine output", () => {
  const worldSquads = snapshotWorldSquads(HANDBOLLSLIGAN_ID);
  const gameplayRatings = snapshotGameplayRatings(HANDBOLLSLIGAN_ID);
  const state = createNewCareerState("report-transfers", BUYER, worldSquads, {}, gameplayRatings);
  const otherClubId = getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== BUYER && (state.worldSquads[c.id]?.length ?? 0) > 3)!.id;
  const rows: ReturnType<typeof reportRow>[] = [];

  // 1. Normal permanent transfer.
  const normalTarget = state.worldSquads[otherClubId][0];
  const normalValue = getPlayerMarketValueEur(state, normalTarget.id)!;
  const normalFee = Math.round(normalValue * 1.5);
  const normalResult = submitTransferOffer(state, { dealType: "PERMANENT", playerId: normalTarget.id, toClubId: BUYER, transferFeeEur: normalFee, newWageEurPerMonth: getPlayerContract(state, normalTarget.id)!.wageEurPerMonth + 200, contractYears: 3 });
  rows.push(reportRow("1. Normal permanent övergång", normalResult.offer, normalValue));

  // 2. Free agent.
  const faCandidate = state.worldSquads[otherClubId].find((p) => p.id !== normalTarget.id)!;
  const faState: CareerState = { ...state, playerContracts: { ...state.playerContracts, [faCandidate.id]: { ...state.playerContracts[faCandidate.id], contractEndDate: "2020-01-01" } } };
  const faWage = Math.round(state.playerContracts[faCandidate.id].wageEurPerMonth * 1.3);
  const faResult = submitTransferOffer(faState, { dealType: "PERMANENT", playerId: faCandidate.id, toClubId: BUYER, transferFeeEur: 0, newWageEurPerMonth: faWage, contractYears: 2 });
  rows.push(reportRow("2. Free agent (kontraktslös)", faResult.offer, getPlayerMarketValueEur(faState, faCandidate.id)));

  // 3. Young Bosman with training compensation.
  const allHlPlayers = Object.keys(state.worldSquads).flatMap((cid) => state.worldSquads[cid]);
  const bosmanCandidate = allHlPlayers.find((p) => (getPlayerTrainingCompensation(state, p.id)?.totalEur ?? 0) > 0)!;
  const bosmanState: CareerState = { ...state, playerContracts: { ...state.playerContracts, [bosmanCandidate.id]: { ...state.playerContracts[bosmanCandidate.id], contractEndDate: "2020-01-01" } } };
  const bosmanWage = Math.round(state.playerContracts[bosmanCandidate.id].wageEurPerMonth * 1.3);
  const bosmanResult = submitTransferOffer(bosmanState, { dealType: "PERMANENT", playerId: bosmanCandidate.id, toClubId: BUYER, transferFeeEur: 0, newWageEurPerMonth: bosmanWage, contractYears: 3 });
  rows.push(reportRow("3. Ung Bosman (fri övergång + utbildningsersättning)", bosmanResult.offer, getPlayerMarketValueEur(bosmanState, bosmanCandidate.id)));

  // 4. Loan.
  const loanClub = getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== BUYER && c.id !== otherClubId && (state.worldSquads[c.id]?.length ?? 0) > 3)!.id;
  const loanCandidate = state.worldSquads[loanClub].find((p) => p.squadStatus === "Rotation" || p.squadStatus === "Ungdom") ?? state.worldSquads[loanClub][2];
  const loanWage = getPlayerContract(state, loanCandidate.id)!.wageEurPerMonth;
  const loanResult = submitTransferOffer(state, { dealType: "LOAN", playerId: loanCandidate.id, toClubId: BUYER, transferFeeEur: 0, newWageEurPerMonth: loanWage, loanTerms: { endDate: "2027-01-15", wageShareBorrowingPct: 60 } });
  rows.push(reportRow("4. Lån (60% löneandel)", loanResult.offer, getPlayerMarketValueEur(state, loanCandidate.id)));
  if (loanResult.offer.status === "COMPLETED") {
    const afterLoan = progressDailyTransfers(loanResult.state, "2027-01-16");
    // eslint-disable-next-line no-console
    console.log(`  -> loan return: player back at ${getCareerPlayer(afterLoan, loanCandidate.id)?.clubId}, wage restored to ${formatEur(getPlayerContract(afterLoan, loanCandidate.id)!.wageEurPerMonth)}/mån`);
  }

  // 5. Unaffordable / rejected deal.
  const expensiveTarget = [...state.worldSquads[otherClubId]].sort((a, b) => b.currentAbility - a.currentAbility)[0];
  const expensiveValue = getPlayerMarketValueEur(state, expensiveTarget.id)!;
  const rejectedResult = submitTransferOffer(state, { dealType: "PERMANENT", playerId: expensiveTarget.id, toClubId: BUYER, transferFeeEur: 20_000_000, newWageEurPerMonth: 100_000, contractYears: 3 });
  rows.push(reportRow("5. Orimligt bud (ej råd)", rejectedResult.offer, expensiveValue));

  // eslint-disable-next-line no-console
  console.log("HM-TRANSFERS-1.0 example report -- five required deal archetypes:");
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(rows, null, 1));

  // Note: IFK Tumba (Allsvenskan) is not used for this report -- confirmed
  // by audit that its own competition is mock-only besides Tumba itself
  // (no other Allsvenskan club has real squad data), so there are no
  // real trading partners to browse for it today -- a pre-existing
  // HM-DATA-0.2 data-availability limitation, not a bug in this engine
  // (transferExecution.test.ts's own tests (5)/(6) prove the mechanism
  // itself works correctly for Tumba when a real player IS moved
  // to/from it).
});
