"use client";

// Small generic tab strip built on the existing (previously unwrapped)
// .hm-tabs/.hm-tab CSS primitives -- first genuine component wrapper
// for them, first needed by HM-TACTICS-1.1's Tactics workspace (two
// independent tab strips: which starting unit is being edited, and
// which tactical instruction phase is being edited).
export default function Tabs<T extends string>({
  value,
  options,
  renderLabel,
  onChange,
}: {
  value: T;
  options: readonly T[];
  renderLabel: (option: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="hm-tabs">
      {options.map((option) => (
        <div key={option} className="hm-tab" data-active={option === value} onClick={() => onChange(option)} role="tab" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onChange(option)}>
          {renderLabel(option)}
        </div>
      ))}
    </div>
  );
}
