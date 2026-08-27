// HM-CONTRACTS-1.0: Swedish UI labels only -- domain types stay English.
import type { ContractStatus } from "./types";

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  UNDER_CONTRACT: "Under kontrakt",
  EXPIRING_SOON: "Kontrakt löper snart ut",
  EXPIRING: "Utgående kontrakt",
  FREE_AGENT: "Kontraktslös",
};

export const CONTRACT_STATUS_TONE: Record<ContractStatus, "positive" | "warning" | "negative" | "neutral"> = {
  UNDER_CONTRACT: "positive",
  EXPIRING_SOON: "warning",
  EXPIRING: "negative",
  FREE_AGENT: "negative",
};

/** Swedish-format SEK, e.g. "1 250 000 kr" / "38 000 kr/mån". */
export function formatSek(amount: number): string {
  return `${amount.toLocaleString("sv-SE")} kr`;
}
