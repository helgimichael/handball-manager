// HM-DATA-ALLSVENSKAN-1.1B Part 12: the EXTERNAL-player counterpart to
// GameplayProfilePanels.tsx -- for a player at any club other than the
// manager's own, raw CA/PA and the full 1-20 attribute grid are NEVER
// rendered, regardless of knowledge level. This panel renders only what
// lib/knowledge/playerVisibility.ts's resolver actually resolved: a
// fuzzy ability/potential star RANGE, and (once known well enough) an
// archetype plus a short strengths/weaknesses list drawn from real
// attribute names -- never invented, never the raw 1-20 value.
import type { PlayerVisibleView, StarRange } from "@/lib/knowledge/playerVisibility";
import { KNOWLEDGE_TIER_LABEL_SV } from "@/lib/knowledge/types";
import StarRating from "@/components/StarRating";

function starRangeLabel(range: StarRange): string {
  return range.min === range.max ? "★".repeat(range.min) + "☆".repeat(5 - range.min) : `${range.min}–${range.max} ★`;
}

/** Right-column panel replacement for GameplayAbilityPanel, gated by knowledge. */
export function KnowledgeGatedAbilityPanel({ view }: { view: PlayerVisibleView }) {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Förmåga</span>
        <span className="hm-badge hm-badge-neutral">{KNOWLEDGE_TIER_LABEL_SV[view.tier]}</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)" }}>Nuvarande nivå</span>
          {view.abilityRange.min === view.abilityRange.max ? (
            <StarRating stars={view.abilityRange.min} title="Uppskattad nuvarande nivå" />
          ) : (
            <span style={{ fontWeight: 700 }}>{starRangeLabel(view.abilityRange)}</span>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)" }}>Potential</span>
          {view.potentialRange === null ? (
            <span className="hm-text-muted">Okänd</span>
          ) : view.potentialRange.min === view.potentialRange.max ? (
            <StarRating stars={view.potentialRange.min} title="Uppskattad potential" />
          ) : (
            <span style={{ fontWeight: 700 }}>{starRangeLabel(view.potentialRange)}</span>
          )}
        </div>
        <div className="hm-divider" />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
          <span className="hm-text-muted">Spelartyp</span>
          <span style={{ fontWeight: 600 }}>{view.archetype ?? "Okänd"}</span>
        </div>
        <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0, lineHeight: 1.5 }}>
          Baserat på klubbens/managerens nuvarande kännedom om spelaren -- ökar med scouting och observation.
        </p>
      </div>
    </div>
  );
}

/** Left-column panel replacement for GameplayAttributesPanel -- never the full attribute grid for an external player. */
export function KnowledgeGatedAttributesPanel({ view }: { view: PlayerVisibleView }) {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Egenskaper</span>
        <span className="hm-badge hm-badge-neutral">{KNOWLEDGE_TIER_LABEL_SV[view.tier]}</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {view.strengths === null || view.weaknesses === null ? (
          <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0, lineHeight: 1.5 }}>
            För lite kännedom om spelaren för en detaljerad bedömning. Scouta eller möt klubben för att lära känna spelaren bättre.
          </p>
        ) : (
          <>
            <StrengthWeaknessList title="Styrkor" items={view.strengths} />
            <StrengthWeaknessList title="Svagheter" items={view.weaknesses} />
          </>
        )}
      </div>
    </div>
  );
}

function StrengthWeaknessList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="hm-eyebrow" style={{ marginBottom: 4 }}>{title}</div>
      {items.length === 0 ? (
        <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>—</p>
      ) : (
        items.map((item) => (
          <div key={item} className="hm-stat-row">
            <span className="hm-stat-label">{item}</span>
          </div>
        ))
      )}
    </div>
  );
}
