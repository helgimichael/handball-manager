// HM-ECONOMY-1.0: Swedish UI labels only -- domain types stay English,
// same split as lib/economy/labels.ts.
import type { EconomicBand, FinancialPressureLevel, LiquidityHealth, StructuralHealth } from "./clubEconomyTypes";

export const FINANCIAL_PRESSURE_LABEL: Record<FinancialPressureLevel, string> = {
  NONE: "Ingen press",
  WATCH: "Bevakas",
  PRESSURED: "Pressad",
  SERIOUS: "Allvarlig",
  CRITICAL: "Kritisk",
};

export const FINANCIAL_PRESSURE_TONE: Record<FinancialPressureLevel, "positive" | "warning" | "negative" | "neutral"> = {
  NONE: "positive",
  WATCH: "warning",
  PRESSURED: "warning",
  SERIOUS: "negative",
  CRITICAL: "negative",
};

export const LIQUIDITY_HEALTH_LABEL: Record<LiquidityHealth, string> = {
  STRONG: "Stark likviditet",
  STABLE: "Stabil likviditet",
  WEAK: "Svag likviditet",
  CRITICAL: "Kritisk likviditet",
};

export const STRUCTURAL_HEALTH_LABEL: Record<StructuralHealth, string> = {
  POSITIVE: "Strukturellt positivt",
  BALANCED: "Strukturellt balanserat",
  NEGATIVE: "Strukturellt negativt",
  SEVERE: "Strukturellt allvarligt",
};

export const ECONOMIC_BAND_LABEL: Record<EconomicBand, string> = {
  E1: "E1 · Global storklubb",
  E2: "E2 · Europeisk storklubb",
  E3: "E3 · Stark professionell",
  E4: "E4 · Professionell",
  E5: "E5 · Mindre professionell",
  E6: "E6 · Halvprofessionell",
  E7: "E7 · Mindre halvprofessionell",
};
