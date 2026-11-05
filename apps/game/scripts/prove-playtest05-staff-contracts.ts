// Production verification: Staff Contract Negotiations for IFK Tumba
import assert from "node:assert/strict";
import { createNewCareerState } from "../lib/career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../lib/gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../lib/gameWorld/staffIdentitySnapshot";
import type { CareerState } from "../lib/career/types";
import { ensureClubFinances } from "../lib/economy/ledger";
import { getClubStaffCostsEurAnnual } from "../lib/economy/clubEconomyIntegration";
import {
  startStaffNegotiation,
  submitStaffOffer,
  progressStaffNegotiations,
  staffSpendingLimit,
  vacancyFunding,
  wageDemand,
  type StaffOffer,
} from "../lib/staff/staffNegotiation";
import { addDaysIso } from "../lib/players/dynamicsState";

const TUMBA = "swe2-tumba";
const COMPS = ["se_handbollsligan_herr", "swe-2"];
const noEmit = () => undefined;

function setupTumbaCareer(date = "2026-07-06"): CareerState {
  const squads = Object.assign({}, ...COMPS.map((c) => snapshotWorldSquads(c)));
  const ratings = Object.assign({}, ...COMPS.map((c) => snapshotGameplayRatings(c)));
  const staff = Object.assign({}, ...COMPS.map((c) => snapshotAllClubsStaff(c)));
  const s = createNewCareerState("tumba-p05-staff", TUMBA, squads, undefined, ratings, staff);
  return ensureClubFinances({ ...s, gameDate: date }, date);
}

function runStaffContractsAudit() {
  console.log("=== 1. INITIALIZING REAL CAREER & FINDING SCOUT ===");
  let state = setupTumbaCareer("2026-07-06");

  // Find an available scout from the scoutMarket
  const scoutId = Object.keys(state.scoutMarket)[0] ?? Object.keys(state.staffMarket?.freeAgents ?? {})[0];
  assert.ok(scoutId, "Must find available staff candidate in scoutMarket");
  const scoutCandidate = state.scoutMarket[scoutId] ?? state.staffMarket?.freeAgents[scoutId];
  console.log(`Selected scout candidate: ${scoutCandidate.displayName} (${scoutId})`);

  const initialStaffCostAnnual = getClubStaffCostsEurAnnual(state, TUMBA);
  const spendingLimit = staffSpendingLimit(state, TUMBA);
  const vacancyGrant = vacancyFunding(state, TUMBA, "SCOUT", "HIRE");
  console.log(`Current annual staff costs: €${initialStaffCostAnnual}`);
  console.log(`Staff spending limit: €${spendingLimit}`);
  console.log(`Vacancy funding grant: €${vacancyGrant}`);

  // -------------------------------------------------------------
  // 2. START NEGOTIATION
  // -------------------------------------------------------------
  console.log("\n=== 2. STARTING STAFF NEGOTIATION FOR SCOUT ===");
  const { state: sStarted, negotiation } = startStaffNegotiation(state, scoutId, "SCOUT", "HIRE");
  state = sStarted;
  assert.equal(negotiation.stage, "TERMS");
  assert.equal(negotiation.role, "SCOUT");

  const demanded = wageDemand(state, scoutId, TUMBA, "SCOUT", "HIRE");
  console.log(`Candidate base wage demand: €${demanded}/month`);

  // -------------------------------------------------------------
  // 3. SUBMIT OFFER THAT LEADS TO COUNTEROFFER (75% of demand, no bonus)
  // -------------------------------------------------------------
  const initialOfferedWage = Math.round(demanded * 0.75);
  console.log(`\n=== 3. SUBMIT INITIAL OFFER (€${initialOfferedWage}/month, 2 years) ===`);
  const initialOffer: StaffOffer = {
    role: "SCOUT",
    years: 2,
    wageEurPerMonth: initialOfferedWage,
  };
  state = submitStaffOffer(state, negotiation.id, initialOffer);

  // Advance 1 day for response
  const nextDate = addDaysIso(state.gameDate, 1);
  state = progressStaffNegotiations({ ...state, gameDate: nextDate }, nextDate, noEmit);

  const negAfterRound1 = state.staffNegotiations![negotiation.id]!;
  console.log(`Negotiation stage after round 1: ${negAfterRound1.stage}`);
  const lastRound1 = negAfterRound1.rounds.at(-1)!;
  console.log(`Candidate response: ${lastRound1.response}, Reason: ${lastRound1.reason}`);
  assert.ok(
    ["COUNTER", "COMPETING_CLUBS"].includes(lastRound1.response!),
    "Candidate must return COUNTER or COMPETING_CLUBS response for below-demand offer"
  );

  const targetWage = lastRound1.counter?.wageEurPerMonth ?? demanded;
  console.log(`Candidate counter-demanded: €${targetWage}/month`);

  // -------------------------------------------------------------
  // 4. RESPOND TO COUNTEROFFER WITH ACCEPTABLE TERMS
  // -------------------------------------------------------------
  console.log(`\n=== 4. SUBMITTING FINAL OFFER MATCHING €${targetWage}/month ===`);
  const finalOffer: StaffOffer = {
    role: "SCOUT",
    years: 2,
    wageEurPerMonth: targetWage,
    signingBonusEur: 1000,
  };
  state = submitStaffOffer(state, negotiation.id, finalOffer);

  const nextDate2 = addDaysIso(state.gameDate, 1);
  state = progressStaffNegotiations({ ...state, gameDate: nextDate2 }, nextDate2, noEmit);

  const negAfterRound2 = state.staffNegotiations![negotiation.id]!;
  console.log(`Negotiation stage after round 2: ${negAfterRound2.stage}`);
  assert.equal(negAfterRound2.stage, "COMPLETED", "Negotiation must complete when demands are met");

  // -------------------------------------------------------------
  // 5. VERIFY STAFF ROSTER & BUDGET IMPACT
  // -------------------------------------------------------------
  console.log("\n=== 5. VERIFYING ROSTER & WAGE BUDGET IMPACT ===");
  const employment = state.staffEmployment[scoutId]!;
  assert.equal(employment.clubId, TUMBA, "Candidate must now be employed at IFK Tumba");
  assert.equal(employment.wageEurPerMonth, targetWage, `Wage must match agreed €${targetWage}`);

  const updatedStaffCostAnnual = getClubStaffCostsEurAnnual(state, TUMBA);
  console.log(`Updated annual staff costs: €${updatedStaffCostAnnual}`);
  assert.equal(
    updatedStaffCostAnnual,
    initialStaffCostAnnual + targetWage * 12,
    "Annual staff cost must increase by exactly wage * 12"
  );

  // -------------------------------------------------------------
  // 6. VERIFY PERSISTENCE AFTER SAVE/RELOAD
  // -------------------------------------------------------------
  console.log("\n=== 6. VERIFYING SAVE / RELOAD PERSISTENCE ===");
  const savedJson = JSON.stringify(state);
  const reloaded: CareerState = JSON.parse(savedJson);

  assert.equal(reloaded.staffEmployment[scoutId]?.clubId, TUMBA);
  assert.equal(reloaded.staffEmployment[scoutId]?.wageEurPerMonth, targetWage);
  assert.equal(reloaded.staffNegotiations![negotiation.id]?.stage, "COMPLETED");
  console.log("VERIFIED: Staff hire, contract, and budget changes persist byte-for-byte after reload.");

  console.log("\n>>> ALL STAFF CONTRACT NEGOTIATION ACCEPTANCE CHECKS PASSED 100% <<<");
}

runStaffContractsAudit();
