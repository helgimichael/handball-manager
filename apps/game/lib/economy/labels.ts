// HM-CONTRACTS-1.0/1.0A: Swedish UI labels only -- domain types stay
// English. Currency formatting lives in currency.ts (the one display
// boundary), not here -- see formatEur.
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
