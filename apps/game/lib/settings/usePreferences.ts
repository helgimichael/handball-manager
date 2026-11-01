"use client";

// HM-ALPHA3-M01: React bindings for lib/settings/preferences.ts.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getPreferences, getServerPreferences, hydratePreferences, PREFERENCES_STORAGE_KEY, subscribePreferences, updatePreferences, type Preferences } from "./preferences";
import { currencySymbol, formatMoney, localizeMoneyText, parseMoneyInput, type FormatMoneyOptions } from "../economy/currency";

/** Current device preferences; re-renders the caller whenever one changes. */
export function usePreferences(): [Preferences, (patch: Partial<Preferences>) => boolean] {
  const preferences = useSyncExternalStore(subscribePreferences, getPreferences, getServerPreferences);
  const update = useCallback((patch: Partial<Preferences>) => updatePreferences(patch), []);
  return [preferences, update];
}

/**
 * Money formatting bound to the current display currency. Calling it
 * also subscribes the component, so every figure it renders -- including
 * ones produced by plain helpers that call `formatMoney` during the same
 * render -- switches immediately when the currency changes.
 */
export function useMoney() {
  const [{ displayCurrency: currency }] = usePreferences();
  return useMemo(
    () => ({
      currency,
      symbol: currencySymbol(currency),
      format: (amountEur: number, options: Omit<FormatMoneyOptions, "currency"> = {}) => formatMoney(amountEur, { ...options, currency }),
      text: (text: string) => localizeMoneyText(text, currency),
      parse: (displayValue: number) => parseMoneyInput(displayValue, currency),
    }),
    [currency],
  );
}

/** Mounted once in the root layout: adopts stored preferences after hydration and follows changes made in other tabs. */
export function PreferencesHydrator(): null {
  useEffect(() => {
    hydratePreferences();
    function onStorage(event: StorageEvent) {
      if (event.key !== PREFERENCES_STORAGE_KEY || event.newValue === null) return;
      try {
        const next = JSON.parse(event.newValue) as Partial<Preferences>;
        if (next.displayCurrency === "EUR" || next.displayCurrency === "SEK") updatePreferences({ displayCurrency: next.displayCurrency });
      } catch {
        // Ignore a foreign or corrupt value; this tab keeps its preference.
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
