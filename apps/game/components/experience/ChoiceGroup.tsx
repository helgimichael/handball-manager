"use client";
// HM-ALPHA3-M01: a set of real choices shown as cards (the Negotiation
// Room's deal-type choice, generalised). Native radio inputs carry the
// semantics, so keyboard (arrow keys within the group), screen readers and
// form behaviour come from the browser; the card is purely presentation.
import { useId, type ReactNode } from "react";

export interface Choice<T extends string> { value: T; label: ReactNode; description?: ReactNode; sample?: ReactNode }

export function ChoiceGroup<T extends string>({ legend, value, options, onChange, name }: { legend: ReactNode; value: T; options: readonly Choice<T>[]; onChange: (value: T) => void; name?: string }) {
  const generated = useId();
  const group = name ?? generated;
  return (
    <fieldset className="xp-choices">
      <legend>{legend}</legend>
      <div className="xp-choices-grid">
        {options.map((option) => {
          const id = `${group}-${option.value}`;
          return (
            <label key={option.value} className="xp-choice" htmlFor={id}>
              <input id={id} type="radio" name={group} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} aria-describedby={option.description ? `${id}-desc` : undefined} />
              <span className="xp-choice-head"><strong>{option.label}</strong><span className="xp-choice-mark" aria-hidden="true" /></span>
              {option.description && <span id={`${id}-desc`} className="xp-choice-desc">{option.description}</span>}
              {option.sample && <span className="xp-choice-sample" aria-hidden="true">{option.sample}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
