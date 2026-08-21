import type { Interpretation, ObservedPattern } from "@/lib/analysis/types";

/** Patterns and interpretations render visually secondary to facts (Spec §22), and are never mixed into one undifferentiated list -- OBSERVED_PATTERN and INTERPRETATION stay in their own labelled sections. */
export function ObservedPatternsList({ patterns }: { patterns: readonly ObservedPattern[] }) {
  if (patterns.length === 0) {
    return <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>No patterns observed yet.</div>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      {patterns.map((p) => (
        <li key={p.ruleId} style={{ fontSize: "var(--hm-text-2xs)", display: "flex", gap: 6, alignItems: "baseline" }}>
          <span className="hm-badge hm-badge-neutral" style={{ fontSize: "9px", flexShrink: 0 }}>
            PATTERN
          </span>
          <span>{p.statement}</span>
        </li>
      ))}
    </ul>
  );
}

export function InterpretationsList({ interpretations }: { interpretations: readonly Interpretation[] }) {
  if (interpretations.length === 0) {
    return <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>No interpretation available yet.</div>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      {interpretations.map((i) => (
        <li key={i.ruleId} style={{ fontSize: "var(--hm-text-2xs)", display: "flex", gap: 6, alignItems: "baseline" }}>
          <span className="hm-badge hm-badge-neutral" style={{ fontSize: "9px", flexShrink: 0, opacity: 0.7 }}>
            INTERPRETATION
          </span>
          <span className="hm-text-secondary">{i.statement}</span>
        </li>
      ))}
    </ul>
  );
}

export function MissingDataNote({ text }: { text: string }) {
  return (
    <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", fontStyle: "italic" }}>
      {text}
    </div>
  );
}
