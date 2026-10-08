import type { Interpretation, ObservedPattern } from "@/lib/analysis/types";
import { interpretationLabel, patternLabel } from './presentation';

/** Patterns and interpretations render visually secondary to facts (Spec §22), and are never mixed into one undifferentiated list -- OBSERVED_PATTERN and INTERPRETATION stay in their own labelled sections. */
export function ObservedPatternsList({ patterns }: { patterns: readonly ObservedPattern[] }) {
  if (patterns.length === 0) {
    return <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>Inga återkommande mönster i matchunderlaget ännu.</div>;
  }
  return (
    <ul className="game-analysis-evidence">
      {patterns.map((p) => (
        <li key={p.ruleId}>
          <small>Observerat · {p.fixtureIds.length} matcher</small>
          <span>{patternLabel(p)}</span>
        </li>
      ))}
    </ul>
  );
}

export function InterpretationsList({ interpretations }: { interpretations: readonly Interpretation[] }) {
  if (interpretations.length === 0) {
    return <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>Ingen bedömning utan ett stödjande matchmönster.</div>;
  }
  return (
    <ul className="game-analysis-evidence">
      {interpretations.map((i) => (
        <li key={i.ruleId}>
          <small>Bedömning · bygger på observerat mönster</small>
          <span className="hm-text-secondary">{interpretationLabel(i)}</span>
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
