"use client";

// Shared segmented-control button row, first built for the Tactics
// screen's TeamTacticalProfile controls (HM-TACTICS-0.6A) and reused
// verbatim by the Live Match screen's in-match tactical controls
// (HM-TACTICS-0.7) -- the same widget, not a duplicate.
export default function SegmentedControl<T extends string>({
  label,
  value,
  options,
  renderLabel,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly T[];
  renderLabel: (option: T) => string;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="hm-eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className="hm-btn hm-btn-sm"
            disabled={disabled}
            style={{
              background: option === value ? "var(--hm-accent)" : undefined,
              borderColor: option === value ? "var(--hm-accent)" : undefined,
              color: option === value ? "#fff" : undefined,
              opacity: disabled ? 0.6 : 1,
            }}
            onClick={() => onChange(option)}
          >
            {renderLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
