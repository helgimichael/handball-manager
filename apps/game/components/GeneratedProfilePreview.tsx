// HM-RATINGS-0.4 Part G: Editor Rating Review PREVIEW ONLY of the
// deterministic generation engine's complete attribute profile.
// Deliberately NOT wired into the normal gameplay Player Profile and
// NOT persisted anywhere -- this is a calibration/review aid so a
// reviewer can see what a complete playable profile would look like
// without the game silently switching to generated values.
//
// Every value is visually and textually distinguished by provenance --
// evidence-backed, derived, or a generated estimate -- and NEVER
// rendered as a raw enum key (lib/rating/attributeVocabulary.ts is the
// single source of player-facing labels, same as RatingProfilePanels.tsx).
import { GOALKEEPER_ATTRIBUTE_FAMILIES, OUTCOURT_ATTRIBUTE_FAMILIES, type GoalkeeperAttribute, type GoalkeeperAttributeFamily, type OutcourtAttribute, type OutcourtAttributeFamily } from "@/lib/rating/types";
import { getAttributeFamilyLabel, getAttributeLabel } from "@/lib/rating/attributeVocabulary";
import type { AttributeOrigin, GenerationResult } from "@/lib/rating/generation/types";

const ORIGIN_BADGE: Record<AttributeOrigin, { label: string; className: string }> = {
  EVIDENCE_BACKED: { label: "BELAGT", className: "hm-badge-positive" },
  DERIVED: { label: "HÄRLETT", className: "hm-badge-warning" },
  GENERATED_PRIOR: { label: "GENERERAT", className: "hm-badge-neutral" },
};

export function GeneratedProfilePreviewPanel({ result }: { result: GenerationResult }) {
  if (result.status !== "OK") {
    return (
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">SPELBAR PROFIL (FÖRHANDSVISNING)</span>
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          Kan inte generera en fullständig profil: CA är inte fastställt för denna spelare (CANNOT_GENERATE_COMPLETE_PROFILE_WITHOUT_CA). Detta är ett underlagsproblem, inte något generatorn får gissa sig förbi.
        </div>
      </div>
    );
  }

  const { profile } = result;
  const isGoalkeeper = profile.branch.branch === "GOALKEEPER";

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">SPELBAR PROFIL (FÖRHANDSVISNING) -- {isGoalkeeper ? "MÅLVAKT" : "UTESPELARE"}</span>
        <span className="hm-badge hm-badge-neutral">MODELL {profile.modelVersion}</span>
      </div>
      <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", display: "flex", gap: 14, flexWrap: "wrap" }}>
        <span>
          <span className="hm-badge hm-badge-positive" style={{ marginRight: 4 }}>
            BELAGT
          </span>
          {profile.originCounts.EVIDENCE_BACKED}
        </span>
        <span>
          <span className="hm-badge hm-badge-warning" style={{ marginRight: 4 }}>
            HÄRLETT
          </span>
          {profile.originCounts.DERIVED}
        </span>
        <span>
          <span className="hm-badge hm-badge-neutral" style={{ marginRight: 4 }}>
            GENERERAT
          </span>
          {profile.originCounts.GENERATED_PRIOR}
        </span>
        <span style={{ marginLeft: "auto" }}>Detta är en beräknad speluppskattning, inte forskad verklighet.</span>
      </div>

      {isGoalkeeper
        ? (() => {
            const attributes = profile.branch.attributes as Record<GoalkeeperAttribute, { value: number; origin: AttributeOrigin }>;
            return (Object.keys(GOALKEEPER_ATTRIBUTE_FAMILIES) as GoalkeeperAttributeFamily[]).map((family) => (
              <FamilySection
                key={family}
                familyLabel={getAttributeFamilyLabel(family)}
                rows={GOALKEEPER_ATTRIBUTE_FAMILIES[family].map((attribute) => {
                  const entry = attributes[attribute as GoalkeeperAttribute];
                  return { attribute, label: getAttributeLabel(attribute as GoalkeeperAttribute), value: entry.value, origin: entry.origin };
                })}
              />
            ));
          })()
        : (() => {
            const attributes = profile.branch.attributes as Record<OutcourtAttribute, { value: number; origin: AttributeOrigin }>;
            return (Object.keys(OUTCOURT_ATTRIBUTE_FAMILIES) as OutcourtAttributeFamily[]).map((family) => (
              <FamilySection
                key={family}
                familyLabel={getAttributeFamilyLabel(family)}
                rows={OUTCOURT_ATTRIBUTE_FAMILIES[family].map((attribute) => {
                  const entry = attributes[attribute as OutcourtAttribute];
                  return { attribute, label: getAttributeLabel(attribute as OutcourtAttribute), value: entry.value, origin: entry.origin };
                })}
              />
            ));
          })()}
    </div>
  );
}

function FamilySection({ familyLabel, rows }: { familyLabel: string; rows: { attribute: string; label: string; value: number; origin: AttributeOrigin }[] }) {
  return (
    <div style={{ borderTop: "1px solid var(--hm-border)" }}>
      <div className="hm-eyebrow" style={{ padding: "10px 16px 0" }}>
        {familyLabel}
      </div>
      <table className="hm-table">
        <tbody>
          {rows.map((row) => {
            const badge = ORIGIN_BADGE[row.origin];
            return (
              <tr key={row.attribute}>
                <td className="hm-td-strong">{row.label}</td>
                <td className="hm-table-num" style={{ width: 40 }}>
                  {row.value}
                </td>
                <td style={{ width: 110 }}>
                  <span className={`hm-badge ${badge.className}`}>{badge.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
