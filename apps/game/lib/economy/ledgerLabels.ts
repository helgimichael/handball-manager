// HM-ALPHA3-M02: Swedish labels and chart colours for ledger categories.
import type { FinancialStatus, LedgerCategory } from "./ledgerTypes";

export const LEDGER_CATEGORY_LABEL: Record<LedgerCategory, string> = {
  SPONSORSHIP: "Sponsorer och partners",
  MEDIA: "Media och TV",
  MATCHDAY: "Matchintäkter",
  SPORTING: "Sportsliga intäkter",
  OTHER_INCOME: "Övriga intäkter",
  ASSOCIATION_SUPPORT: "Föreningsstöd och bidrag",
  PLAYER_WAGES: "Spelarlöner",
  STAFF_WAGES: "Personallöner",
  OPERATIONS: "Kansli och administration",
  CLUB_OPERATIONS: "Föreningsdrift och resor",
  TRANSFER_FEES: "Övergångssummor",
  TRAINING_COMPENSATION: "Utbildningsersättning",
  SIGNING_COSTS: "Agentarvoden och bonusar",
  PARTNERSHIPS: "Samarbetsavtal",
  PRIZE_MONEY: "Prispengar",
  OWNER_INJECTION: "Ägartillskott och krisstöd",
  STAFF_COMPENSATION: "Avgångsvederlag",
  PLAYER_RELEASE: "Avslutade spelaravtal",
  OTHER_ONE_OFF: "Övriga engångsposter",
};

/** Chart colours: income in greens/navy, costs in signal/ochre, one-offs neutral. */
export const LEDGER_CATEGORY_COLOR: Record<LedgerCategory, string> = {
  SPONSORSHIP: "#142538",
  MEDIA: "#3c5878",
  MATCHDAY: "#3f7a52",
  SPORTING: "#7aa37f",
  OTHER_INCOME: "#9fb6c9",
  ASSOCIATION_SUPPORT: "#b9c7a5",
  PLAYER_WAGES: "#c74624",
  STAFF_WAGES: "#e07a52",
  OPERATIONS: "#c08a2c",
  CLUB_OPERATIONS: "#e0b23c",
  TRANSFER_FEES: "#5e5a54",
  TRAINING_COMPENSATION: "#8a857e",
  SIGNING_COSTS: "#a86a14",
  PARTNERSHIPS: "#6e7e89",
  PRIZE_MONEY: "#2f6343",
  OWNER_INJECTION: "#1b3a6b",
  STAFF_COMPENSATION: "#9b5144",
  PLAYER_RELEASE: "#7d3a2c",
  OTHER_ONE_OFF: "#b9c0bd",
};

export const FINANCIAL_STATUS_LABEL: Record<FinancialStatus, string> = {
  HEALTHY: "I balans",
  OVERDRAFT: "Övertrasserad",
  CRISIS: "Ekonomisk kris",
};

export const FINANCIAL_STATUS_TONE: Record<FinancialStatus, "success" | "gold" | "loss"> = {
  HEALTHY: "success",
  OVERDRAFT: "gold",
  CRISIS: "loss",
};
