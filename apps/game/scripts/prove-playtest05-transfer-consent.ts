// Production verification: Transfer Consent Workflow for IFK Tumba
import assert from "node:assert/strict";
import { createNewCareerState } from "../lib/career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../lib/gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../lib/gameWorld/staffIdentitySnapshot";
import type { CareerState } from "../lib/career/types";
import { getCareerClubSquad } from "../lib/career/careerWorld";
import { ensureClubFinances } from "../lib/economy/ledger";
import {
  counterIncomingOffer,
  progressIncomingOffers,
  confirmIncomingSale,
  rejectIncomingSale,
  withdrawIncomingOffer,
} from "../lib/players/market";
import { addDaysIso } from "../lib/players/dynamicsState";

const TUMBA = "swe2-tumba";
const COMPS = ["se_handbollsligan_herr", "swe-2"];
const noEmit = () => undefined;

function setupTumbaCareer(date = "2026-07-06"): CareerState {
  const squads = Object.assign({}, ...COMPS.map((c) => snapshotWorldSquads(c)));
  const ratings = Object.assign({}, ...COMPS.map((c) => snapshotGameplayRatings(c)));
  const staff = Object.assign({}, ...COMPS.map((c) => snapshotAllClubsStaff(c)));
  const s = createNewCareerState("tumba-p05-consent", TUMBA, squads, undefined, ratings, staff);
  return ensureClubFinances({ ...s, gameDate: date, requireFinalTransferApproval: true }, date);
}

function runTransferConsentAudit() {
  console.log("=== 1. INITIALIZING REAL IFK TUMBA CAREER ===");
  let state = setupTumbaCareer("2026-07-06"); // Transfer window is open
  const squad = getCareerClubSquad(state, TUMBA);
  console.log(`IFK Tumba Squad size: ${squad.length}`);
  assert.ok(squad.length >= 14, "IFK Tumba must have a full squad");

  const targetPlayer = squad[0]!;
  console.log(`Target player: ${targetPlayer.name} (${targetPlayer.id}), Role: ${targetPlayer.role}`);

  const initialCash = state.clubEconomies[TUMBA]!.cashEur;
  console.log(`Initial Tumba cash balance: €${initialCash}`);

  // -------------------------------------------------------------
  // TEST SCENARIO A: Counteroffer -> Buyer Accepts -> AWAITING_FINAL_APPROVAL -> REJECT
  // -------------------------------------------------------------
  console.log("\n=== 2. RECEIVE INCOMING TRANSFER OFFER ===");
  const offerA = {
    id: "in:offer-a",
    playerId: targetPlayer.id,
    fromClubId: "swe2-guif",
    foreign: false,
    openedOn: state.gameDate,
    feeEur: 30000,
    maxFeeEur: 60000,
    wageEurPerMonth: 2500,
    contractYears: 2,
    status: "OPEN" as const,
    respondBy: "2026-07-13",
    rounds: [],
    motive: "First team starter",
  };

  state = {
    ...state,
    incomingOffers: { [offerA.id]: offerA },
  };

  console.log(`Incoming offer received: €${offerA.feeEur} from HK Guif`);

  console.log("\n=== 3. SUBMIT COUNTEROFFER (€45,000) ===");
  state = counterIncomingOffer(state, offerA.id, 45000);
  assert.equal(state.incomingOffers![offerA.id]!.status, "COUNTERED");
  console.log("Counteroffer submitted successfully. Waiting for buyer response...");

  console.log("\n=== 4. BUYER EVALUATION & PLAYER STANCE ===");
  const nextDate = addDaysIso(state.gameDate, 1);
  state = progressIncomingOffers({ ...state, gameDate: nextDate }, nextDate, noEmit);

  const offerAfterProg = state.incomingOffers![offerA.id]!;
  console.log(`Offer status after buyer processing: ${offerAfterProg.status}`);
  assert.equal(
    offerAfterProg.status,
    "AWAITING_FINAL_APPROVAL",
    "Must be in AWAITING_FINAL_APPROVAL when clubs agree and consent is required"
  );

  // Verification: Player has NOT left squad yet, money has NOT moved
  assert.equal(state.playerContracts[targetPlayer.id]!.clubId, TUMBA, "Player MUST remain contracted to IFK Tumba");
  assert.equal(state.clubEconomies[TUMBA]!.cashEur, initialCash, "Cash MUST NOT increase before confirmation");
  assert.ok(
    getCareerClubSquad(state, TUMBA).some((p) => p.id === targetPlayer.id),
    "Player MUST still be in Tumba squad"
  );
  console.log("VERIFIED: Player is NOT transferred prematurely. Cash balance intact.");

  // -------------------------------------------------------------
  // TEST SCENARIO B: Save/Reload during AWAITING_FINAL_APPROVAL
  // -------------------------------------------------------------
  console.log("\n=== 5. SAVE / RELOAD MID-APPROVAL ===");
  const jsonSave = JSON.stringify(state);
  const reloadedState: CareerState = JSON.parse(jsonSave);
  const reloadedOffer = reloadedState.incomingOffers![offerA.id]!;
  assert.equal(reloadedOffer.status, "AWAITING_FINAL_APPROVAL");
  assert.equal(reloadedOffer.feeEur, 45000);
  assert.equal(reloadedState.playerContracts[targetPlayer.id]!.clubId, TUMBA);
  console.log("VERIFIED: AWAITING_FINAL_APPROVAL state perfectly preserved across save/reload.");

  state = reloadedState;

  // -------------------------------------------------------------
  // TEST SCENARIO C: Manager REJECTS final sale
  // -------------------------------------------------------------
  console.log("\n=== 6. MANAGER REJECTS FINAL SALE ===");
  state = rejectIncomingSale(state, offerA.id);
  assert.equal(state.incomingOffers![offerA.id]!.status, "REJECTED");
  assert.equal(state.playerContracts[targetPlayer.id]!.clubId, TUMBA, "Player stays in squad upon rejection");
  assert.equal(state.clubEconomies[TUMBA]!.cashEur, initialCash, "No money booked upon rejection");
  assert.ok(
    getCareerClubSquad(state, TUMBA).some((p) => p.id === targetPlayer.id),
    "Player remains on IFK Tumba roster"
  );
  console.log("VERIFIED: Rejection preserves player, contracts, and finances.");

  // -------------------------------------------------------------
  // TEST SCENARIO D: Repeat and APPROVE final sale
  // -------------------------------------------------------------
  console.log("\n=== 7. SECOND OFFER & MANAGER CONFIRMS SALE ===");
  const targetPlayer2 = squad[1]!;
  console.log(`Second target player: ${targetPlayer2.name} (${targetPlayer2.id})`);

  const offerB = {
    id: "in:offer-b",
    playerId: targetPlayer2.id,
    fromClubId: "swe2-guif",
    foreign: false,
    openedOn: state.gameDate,
    feeEur: 50000,
    maxFeeEur: 70000,
    wageEurPerMonth: 3000,
    contractYears: 2,
    status: "AWAITING_FINAL_APPROVAL" as const,
    respondBy: "2026-07-20",
    rounds: [{ date: state.gameDate, by: "BUYER" as const, feeEur: 50000, note: "Agree" }],
    motive: "Key transfer",
  };

  state = {
    ...state,
    incomingOffers: { ...state.incomingOffers, [offerB.id]: offerB },
  };

  state = confirmIncomingSale(state, offerB.id);
  const offerBCompleted = state.incomingOffers![offerB.id]!;
  console.log(`Confirmed sale status: ${offerBCompleted.status}`);
  assert.equal(offerBCompleted.status, "COMPLETED", "Sale must be COMPLETED when window is open");

  // Verify transfer completion exactly once
  assert.equal(state.playerContracts[targetPlayer2.id]!.clubId, "swe2-guif", "Player transferred to HK Guif");
  assert.ok(
    !getCareerClubSquad(state, TUMBA).some((p) => p.id === targetPlayer2.id),
    "Player must be removed from IFK Tumba squad"
  );
  assert.equal(
    state.clubEconomies[TUMBA]!.cashEur,
    initialCash + 50000,
    "Transfer fee of €50,000 correctly booked into Tumba cash ledger"
  );

  console.log(`Updated IFK Tumba cash balance: €${state.clubEconomies[TUMBA]!.cashEur}`);
  console.log("VERIFIED: Transfer executed exactly once with accurate financial and roster updates.");

  console.log("\n>>> ALL TRANSFER CONSENT ACCEPTANCE CHECKS PASSED 100% <<<");
}

runTransferConsentAudit();

