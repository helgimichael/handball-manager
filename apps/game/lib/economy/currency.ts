// HM-CONTRACTS-1.0A: the ONE currency display boundary. EUR is the
// canonical INTERNAL unit everywhere in lib/economy -- every persisted
// field and every pure formula (marketValue.ts, trainingCompensation.ts)
// works in EUR only. This module is the single seam where a EUR amount
// ever gets converted or formatted for display -- no other file should
// call `.toLocaleString` on an economy amount or hardcode a currency
// suffix (Part: "en liten gemensam currency-format/display-boundary så
// att vi inte senare blandar valutalogik med ekonomimotorn").
//
// Part: "Senare ska Settings kunna visa SEK/DKK/NOK/etc, men det är bara
// presentation" -- this module deliberately does NOT build a currency
// picker or live FX rates (Scope stop: "Settings currency selector").
// `EUR_TO_SEK_REFERENCE_RATE` is a fixed, documented foundation-pass
// approximation (not a live feed) purely so a future display-currency
// toggle has one obvious place to plug in -- today the UI only ever
// calls `formatEur`.

/** Fixed reference rate, foundation pass only -- NOT a live exchange rate. Update this single constant (never re-derive it ad hoc elsewhere) if a more accurate anchor is needed later. */
export const EUR_TO_SEK_REFERENCE_RATE = 11;

export function eurToSek(amountEur: number): number {
  return Math.round(amountEur * EUR_TO_SEK_REFERENCE_RATE);
}

/** The canonical EUR formatter -- e.g. "450 000 €". Every UI reader of a lib/economy amount goes through this, never a bespoke `.toLocaleString`. */
export function formatEur(amountEur: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amountEur);
}
