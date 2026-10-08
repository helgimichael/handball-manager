// HM-UX-RATINGS-0.1: the normal (non-Editor) Player Profile's read
// model for HM-RATINGS-0.6's canonical, COMPLETE gameplay rating
// snapshot (GET /api/game-world/gameplay-ratings/clubs/[clubId]).
//
// Deliberately a different, simpler presentation than the Editor's own
// GeneratedProfilePreviewPanel (components/GeneratedProfilePreview.tsx)
// -- this is the GAME UI ("how good is this player?"), not the Rating
// Review audit workspace ("why does this value exist?"). A subtle dot
// marks an evidence-backed/editor-overridden value; nothing else about
// provenance is surfaced here -- the full evidence/claim trail stays in
// Editor -> Rating Review.
//
// This component never computes a rating itself -- it only renders
// whatever the canonical snapshot already resolved (Part B/F: no
// second, client-side rating resolver).
//
// HM-UX-PRESENTATION-1.0: CA/PA are INTERNAL/canonical-engine data --
// GameplayAbilityPanel shows them ONLY as a 1-5 star impression
// (abilityStarsFromCA/potentialStarsFromPA), never the raw 1-200
// number, matching the same boundary Rating Model already draws for PA
// ("can never leak into match performance/UI"). The 1-20 attribute
// VALUES below are a separate, already-approved design decision (shown
// numerically, same as every FM-style attribute grid) and are untouched
// by this rule. Raw CA/PA stay visible in Editor Mode (RatingProfilePanels.tsx).
import type { CSSProperties } from "react";
import { GOALKEEPER_ATTRIBUTE_FAMILIES, OUTCOURT_ATTRIBUTE_FAMILIES, type GoalkeeperAttribute, type GoalkeeperAttributeFamily, type OutcourtAttribute, type OutcourtAttributeFamily } from "@/lib/rating/types";
import { getAttributeFamilyLabel, getAttributeLabel } from "@/lib/rating/attributeVocabulary";
import { abilityStarsFromCA, potentialStarsFromPA } from "@/lib/development/types";
import { presentTacticalRole } from "@/lib/rating/presentation";
import StarRating from "@/components/StarRating";

export type GameplayAttributeOrigin = "EVIDENCE_BACKED" | "DERIVED" | "GENERATED_PRIOR" | "EDITOR_OVERRIDE";
export type GameplayCASource = "CALIBRATED" | "MODEL_ESTIMATE" | "GENERATED_GAME_PRIOR" | "EDITOR_OVERRIDE";

export interface GameplayAttributeEntry {
  value: number;
  origin: GameplayAttributeOrigin;
}

export interface GameplayRatingRow {
  playerId: string;
  position: string;
  ca: number;
  pa: number;
  caSource: GameplayCASource;
  branch: { branch: "OUTCOURT"; attributes: Record<string, GameplayAttributeEntry> } | { branch: "GOALKEEPER"; attributes: Record<string, GameplayAttributeEntry> };
  attackRoleProficiencies: { role: string }[];
  defenceRoleProficiencies: { role: string }[];
  locked: boolean;
}

/** Club assessment and handball roles. Calibration metadata stays in the editor. */
export function GameplayAbilityPanel({ row }: { row: GameplayRatingRow }) {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Förmåga</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <AbilityBlock label="Nuvarande nivå" stars={abilityStarsFromCA(row.ca)} title="Tränarstabens bedömning av nuvarande nivå" />
        <AbilityBlock label="Potential" stars={potentialStarsFromPA(row.pa)} title="Scoutingens uppskattning — osäker" />
        <div className="hm-divider" />
        <RoleRow label="Anfallsroller" roles={row.attackRoleProficiencies} />
        <RoleRow label="Försvarsroller" roles={row.defenceRoleProficiencies} />
      </div>
    </div>
  );
}

// HM-UX-PRESENTATION-1.0: never renders the raw CA/PA number itself --
// only the 1-5 star impression (see lib/development/types.ts's
// abilityStarsFromCA/potentialStarsFromPA). Canonical CA/PA stay fully
// intact in CareerState/the rating snapshot; Editor Mode's own
// RatingProfilePanels.tsx is where the real number is shown.
function AbilityBlock({ label, stars, title }: { label: string; stars: number; title: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)" }}>
        {label}
      </span>
      <StarRating stars={stars} title={title} />
    </div>
  );
}

function RoleRow({ label, roles }: { label: string; roles: { role: string }[] }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{roles.length ? roles.map((r) => presentTacticalRole(r.role)).join(", ") : "—"}</span>
    </div>
  );
}

/** Left-column panel: the COMPLETE gameplay attribute set (56 outcourt / 21 goalkeeper), grouped by family, Swedish labels only. */
export function GameplayAttributesPanel({ row }: { row: GameplayRatingRow }) {
  const isGoalkeeper = row.branch.branch === "GOALKEEPER";

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">{isGoalkeeper ? "Målvaktsegenskaper" : "Egenskaper"} (1–20)</span>
      </div>
      {isGoalkeeper
        ? (Object.keys(GOALKEEPER_ATTRIBUTE_FAMILIES) as GoalkeeperAttributeFamily[]).map((family) => (
            <FamilyBlock
              key={family}
              familyLabel={getAttributeFamilyLabel(family)}
              rows={GOALKEEPER_ATTRIBUTE_FAMILIES[family].map((attribute) => ({
                attribute,
                label: getAttributeLabel(attribute as GoalkeeperAttribute),
                entry: (row.branch.attributes as Record<string, GameplayAttributeEntry>)[attribute],
              }))}
            />
          ))
        : (Object.keys(OUTCOURT_ATTRIBUTE_FAMILIES) as OutcourtAttributeFamily[]).map((family) => (
            <FamilyBlock
              key={family}
              familyLabel={getAttributeFamilyLabel(family)}
              rows={OUTCOURT_ATTRIBUTE_FAMILIES[family].map((attribute) => ({
                attribute,
                label: getAttributeLabel(attribute as OutcourtAttribute),
                entry: (row.branch.attributes as Record<string, GameplayAttributeEntry>)[attribute],
              }))}
            />
          ))}
    </div>
  );
}

function FamilyBlock({ familyLabel, rows }: { familyLabel: string; rows: { attribute: string; label: string; entry: GameplayAttributeEntry }[] }) {
  return (
    <div style={{ borderTop: "1px solid var(--hm-border)" }}>
      <div className="hm-eyebrow" style={{ padding: "10px 16px 4px" }}>
        {familyLabel}
      </div>
      <div className="hm-panel-body" style={{ paddingTop: 0, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 20px" }}>
        {rows.map(({ attribute, label, entry }) => (
          <div key={attribute} className="hm-stat-row" title={entry.origin === "EVIDENCE_BACKED" ? "Belagt av källunderlag" : entry.origin === "EDITOR_OVERRIDE" ? "Manuellt satt" : undefined}>
            <span className="hm-stat-label">
              {(entry.origin === "EVIDENCE_BACKED" || entry.origin === "EDITOR_OVERRIDE") && <span style={confirmedDotStyle(entry.origin)} />}
              {label}
            </span>
            <span style={statValueStyle}>{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function confirmedDotStyle(origin: "EVIDENCE_BACKED" | "EDITOR_OVERRIDE"): CSSProperties {
  return {
    display: "inline-block",
    width: 6,
    height: 6,
    borderRadius: "50%",
    marginRight: 5,
    background: origin === "EVIDENCE_BACKED" ? "var(--hm-positive)" : "var(--hm-negative)",
  };
}

const statValueStyle: CSSProperties = { fontWeight: 700 };
