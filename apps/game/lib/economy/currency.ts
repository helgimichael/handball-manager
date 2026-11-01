// HM-CONTRACTS-1.0A: the ONE currency display boundary. EUR is the
// canonical INTERNAL unit everywhere in lib/economy -- every persisted
// field and every pure formula (marketValue.ts, trainingCompensation.ts)
// works in EUR only. This module is the single seam where a EUR amount
// ever gets converted or formatted for display -- no other file should
// call `.toLocaleString` on an economy amount or hardcode a currency
// suffix (Part: "en liten gemensam currency-format/display-boundary så
// att vi inte senare blandar valutalogik med ekonomimotorn").
//
// HM-ALPHA3-M01: the display currency is now selectable (EUR default,
// SEK) through lib/settings/preferences.ts. It is presentation only:
// - nothing here is ever written back to a career or a save;
// - conversion happens exactly once, at formatting time, from a EUR
//   amount -- callers always pass EUR, so there is no double conversion;
// - the rate is the fixed game convention 1 EUR = 11 SEK. It is not a
//   market rate and never changes at runtime; there is no live feed.
// Inputs typed in the display currency come back through
// `parseMoneyInput`, which returns whole euros -- the storage precision
// the negotiation and contract rules already round to.
import { getPreferences, type DisplayCurrency } from "../settings/preferences";

export type { DisplayCurrency } from "../settings/preferences";

/** The fixed game convention 1 EUR = 11 SEK (HM-ROADMAP-2026 owner decision). NOT a live exchange rate -- change only this constant, never re-derive it elsewhere. */
export const EUR_TO_SEK_REFERENCE_RATE = 11;

export function eurToSek(amountEur: number): number {
  return Math.round(amountEur * EUR_TO_SEK_REFERENCE_RATE);
}

/** The currency the UI shows right now (device preference). */
export function getDisplayCurrency(): DisplayCurrency {
  return getPreferences().displayCurrency;
}

/** A EUR amount expressed in `currency`, rounded to whole units of that currency. */
export function toDisplayAmount(amountEur: number, currency: DisplayCurrency = getDisplayCurrency()): number {
  return currency === "SEK" ? eurToSek(amountEur) : Math.round(amountEur);
}

const exactFormatters: Record<DisplayCurrency, Intl.NumberFormat> = {
  EUR: new Intl.NumberFormat("sv-SE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
  SEK: new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }),
};

const twoDecimals = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 });
const oneDecimal = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

/** Unit suffix used in labels and compact figures: "€" or "kr". */
export function currencySymbol(currency: DisplayCurrency = getDisplayCurrency()): string {
  return currency === "SEK" ? "kr" : "€";
}

export interface FormatMoneyOptions {
  currency?: DisplayCurrency;
  /** Million-and-up amounts as "1,25 mn €" / "13,8 Mkr" for dense surfaces. Smaller amounts stay exact. */
  compact?: boolean;
}

/**
 * The canonical display formatter -- e.g. "450 000 €" or "4 950 000 kr".
 * Takes a EUR amount and formats it in the display currency: whole
 * units, Swedish grouping (non-breaking spaces).
 */
export function formatMoney(amountEur: number, options: FormatMoneyOptions = {}): string {
  const currency = options.currency ?? getDisplayCurrency();
  const amount = toDisplayAmount(amountEur, currency);
  if (options.compact && Math.abs(amount) >= 1_000_000) {
    const millions = amount / 1_000_000;
    const figure = (Math.abs(millions) >= 10 ? oneDecimal : twoDecimals).format(millions);
    return currency === "SEK" ? `${figure} Mkr` : `${figure} mn €`;
  }
  return exactFormatters[currency].format(amount);
}

/** The canonical EUR formatter -- e.g. "450 000 €", regardless of the display currency. Ordinary UI uses `formatMoney`; this stays for EUR-only contexts (the canonical-value hint beside SEK inputs, the data editor). */
export function formatEur(amountEur: number): string {
  return exactFormatters.EUR.format(amountEur);
}

/** A typed display-currency figure back to whole euros (the storage precision). Non-finite input yields 0. */
export function parseMoneyInput(displayValue: number, currency: DisplayCurrency = getDisplayCurrency()): number {
  if (!Number.isFinite(displayValue)) return 0;
  return currency === "SEK" ? Math.round(displayValue / EUR_TO_SEK_REFERENCE_RATE) : Math.round(displayValue);
}

// A EUR amount inside rule-generated text, e.g. "Klubben vill ha 4400 €"
// or "(1 234 567 €/år)": optional sign, a plain or space-grouped
// integer, optional decimals, then the euro sign.
const EUR_IN_TEXT = /([-−]?)(\d{1,3}(?:[   ]\d{3})+|\d+)(?:,(\d+))?[   ]?€/g;

/**
 * Re-expresses EUR amounts embedded in rule-generated Swedish text
 * (negotiation reasons, budget errors, inbox bodies) in the display
 * currency. Those strings are produced -- and some persisted -- in EUR
 * by lib/transfers and lib/staff. They are never rewritten: conversion
 * happens only here, at render time, so a save stays untouched and the
 * result can never be converted twice (SEK output has no euro sign).
 */
export function localizeMoneyText(text: string, currency: DisplayCurrency = getDisplayCurrency()): string {
  return text.replace(EUR_IN_TEXT, (match, sign: string, integer: string, decimals: string | undefined) => {
    const value = Number(integer.replace(/[   ]/g, "") + (decimals ? `.${decimals}` : ""));
    if (!Number.isFinite(value)) return match;
    return formatMoney(sign ? -value : value, { currency });
  });
}
