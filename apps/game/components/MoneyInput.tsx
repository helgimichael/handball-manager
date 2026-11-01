"use client";

// HM-ALPHA3-M01: a money field that is typed in the display currency but
// always reports whole euros to its owner. The text the manager types is
// kept locally, so a SEK figure is never rounded back under their cursor
// (48 405 kr stays 48 405 kr while typing, and is sent on as 4 400 €).
// The field only re-syncs when the euro value changes from outside or
// the display currency switches.
import { useState, type InputHTMLAttributes } from "react";
import { formatEur, toDisplayAmount } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "step"> & {
  valueEur: number;
  onChangeEur: (amountEur: number) => void;
  /** Minimum in EUR; converted for the browser's own min/arrow keys. */
  minEur?: number;
  /** Arrow-key increment in EUR; converted to the display currency. */
  stepEur?: number;
};

export default function MoneyInput({ valueEur, onChangeEur, minEur, stepEur = 1, ...rest }: MoneyInputProps) {
  const money = useMoney();
  const [draft, setDraft] = useState(() => ({ text: String(toDisplayAmount(valueEur, money.currency)), eur: valueEur, currency: money.currency }));
  // Resync during render (React's "adjust state when a prop changes" pattern) when the value or the currency changed from outside.
  if (draft.eur !== valueEur || draft.currency !== money.currency) {
    setDraft({ text: String(toDisplayAmount(valueEur, money.currency)), eur: valueEur, currency: money.currency });
  }
  return (
    <input
      {...rest}
      type="number"
      inputMode="numeric"
      min={minEur === undefined ? undefined : toDisplayAmount(minEur, money.currency)}
      step={toDisplayAmount(stepEur, money.currency) || 1}
      value={draft.text}
      title={money.currency === "EUR" ? rest.title : `${rest.title ? `${rest.title} · ` : ""}Lagras som ${formatEur(valueEur)}`}
      onChange={(event) => {
        const eur = money.parse(Number(event.target.value));
        setDraft({ text: event.target.value, eur, currency: money.currency });
        if (eur !== valueEur) onChangeEur(eur);
      }}
    />
  );
}
