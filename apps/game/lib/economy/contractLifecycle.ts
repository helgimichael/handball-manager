// HM-CONTRACTS-1.0: pure contract-lifecycle math. No CareerState reads/
// writes here -- contractIntegration.ts is the glue layer, mirroring
// lib/medical's own pure/integration split.
import { daysBetween } from "../career/dateUtils";
import { CONTRACT_EXPIRING_DAYS, CONTRACT_EXPIRING_SOON_DAYS, type ContractStatus } from "./types";

/** Whole days remaining until `contractEndDate`, as of `asOfDate`. Negative once expired. */
export function daysUntilContractEnd(contractEndDate: string, asOfDate: string): number {
  return daysBetween(asOfDate, contractEndDate);
}

/**
 * Part: the four required lifecycle buckets, purely date-driven --
 * FREE_AGENT once the end date has passed (or is today), EXPIRING inside
 * the final ~6 months, EXPIRING_SOON inside the final year, else
 * UNDER_CONTRACT. Bounded, deterministic, no negotiation logic.
 */
export function getContractStatus(contractEndDate: string, asOfDate: string): ContractStatus {
  const daysRemaining = daysUntilContractEnd(contractEndDate, asOfDate);
  if (daysRemaining <= 0) return "FREE_AGENT";
  if (daysRemaining <= CONTRACT_EXPIRING_DAYS) return "EXPIRING";
  if (daysRemaining <= CONTRACT_EXPIRING_SOON_DAYS) return "EXPIRING_SOON";
  return "UNDER_CONTRACT";
}
