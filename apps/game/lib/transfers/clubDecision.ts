// HM-TRANSFERS-1.0: simple, deterministic CPU club decision rules (Part:
// "Ingen modern AI-agent... en begriplig regelmodell"). Two separate
// pure functions -- selling a player outright vs. loaning one out --
// since the economic question each answers is different (a fee
// threshold vs. a role/depth/wage-relief judgement).
import type { ContractStatus } from "../economy/types";
import type { MatchRole } from "../matchPlan/types";
import type { FinancialPressureLevel } from "../economy/clubEconomyTypes";

export interface ClubDecisionResult {
  accept: boolean;
  reason: string;
}

const ROLE_SALE_RESISTANCE: Record<MatchRole, number> = {
  KEY_PLAYER: 1.4,
  STARTER: 1.15,
  MAJOR_ROTATION: 1.0,
  ROTATION: 0.95,
  SPECIALIST: 0.9,
  DEVELOPMENT: 0.85,
  EMERGENCY: 0.7,
};

/** Part: "en ekonomiskt pressad klubb ska kunna vara mer villig att sälja" -- pressure LOWERS the acceptance threshold (a fee-hungry club accepts less). */
const PRESSURE_SALE_DISCOUNT: Record<FinancialPressureLevel, number> = {
  NONE: 1.0,
  WATCH: 0.95,
  PRESSURED: 0.85,
  SERIOUS: 0.7,
  CRITICAL: 0.55,
};

export interface SellingClubDecisionInputs {
  marketValueEur: number;
  offerTransferFeeEur: number;
  contractStatus: ContractStatus;
  role: MatchRole;
  financialPressure: FinancialPressureLevel;
  hasAdequateReplacement: boolean;
}

/**
 * Part: "en nyckelspelare ska kunna kräva tydligt mer än baseline market
 * value" -- a KEY_PLAYER's acceptance threshold sits ABOVE market value
 * (1.4x baseline before any discount); an EMERGENCY/DEVELOPMENT player's
 * sits below it. An expiring/free-agent-adjacent contract lowers the bar
 * further (the club risks losing the player for nothing anyway).
 */
export function evaluateSellingClubDecision(inputs: SellingClubDecisionInputs): ClubDecisionResult {
  const threshold = computeSellingClubAskingPriceEur(inputs);

  if (inputs.offerTransferFeeEur >= threshold) {
    return { accept: true, reason: `Budet (${Math.round(inputs.offerTransferFeeEur)} €) uppfyller klubbens krav (${Math.round(threshold)} €).` };
  }
  return { accept: false, reason: `Budet (${Math.round(inputs.offerTransferFeeEur)} €) är för lågt -- klubben vill ha minst ${Math.round(threshold)} €.` };
}

/**
 * HM-ALPHA2-05A: the selling club's own minimum acceptable fee -- the
 * exact threshold `evaluateSellingClubDecision` has always used, exposed
 * so the two-stage negotiation (negotiation.ts) can state it as a
 * counteroffer instead of a bare yes/no.
 */
export function computeSellingClubAskingPriceEur(inputs: Omit<SellingClubDecisionInputs, "offerTransferFeeEur">): number {
  let threshold = inputs.marketValueEur * ROLE_SALE_RESISTANCE[inputs.role] * PRESSURE_SALE_DISCOUNT[inputs.financialPressure];
  if (inputs.contractStatus === "EXPIRING" || inputs.contractStatus === "EXPIRING_SOON") threshold *= 0.85;
  if (inputs.hasAdequateReplacement) threshold *= 0.9;
  return threshold;
}

export interface LoanOutDecisionInputs {
  role: MatchRole;
  financialPressure: FinancialPressureLevel;
  hasAdequateReplacement: boolean;
  wageShareBorrowingPct: number;
}

/**
 * A loan has no fee to weigh -- the parent club instead judges whether
 * the player is surplus to first-team needs (role/depth) and how
 * attractive the wage relief is under financial pressure.
 */
export function evaluateLoanOutDecision(inputs: LoanOutDecisionInputs): ClubDecisionResult {
  let willingness = 0;
  if (inputs.role === "DEVELOPMENT" || inputs.role === "EMERGENCY" || inputs.role === "SPECIALIST") willingness += 0.4;
  else if (inputs.role === "ROTATION" || inputs.role === "MAJOR_ROTATION") willingness += 0.15;
  else willingness -= 0.3; // STARTER/KEY_PLAYER -- club needs them, resists loaning out.

  if (inputs.hasAdequateReplacement) willingness += 0.25;

  const pressureBonus: Record<FinancialPressureLevel, number> = { NONE: 0, WATCH: 0.05, PRESSURED: 0.15, SERIOUS: 0.25, CRITICAL: 0.35 };
  willingness += pressureBonus[inputs.financialPressure];
  willingness += (inputs.wageShareBorrowingPct / 100) * 0.2; // a higher wage share offered makes the loan more attractive.

  if (willingness > 0) {
    return { accept: true, reason: "Klubben bedömer spelaren som umbärlig just nu och accepterar lånet." };
  }
  return { accept: false, reason: "Klubben anser spelaren för viktig för förstalaget för att låna ut just nu." };
}
