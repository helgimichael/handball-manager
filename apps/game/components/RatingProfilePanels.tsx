// HM-UX-0.3: the HM-RATINGS-0.3 read model for the NORMAL Player
// Profile -- deliberately read-only and deliberately narrower than the
// Editor's own Rating Review detail (no evidence/claim trace, no
// review-status control; that stays the Editor's job). Both surfaces
// read the exact same proposal data via lib/gameWorld/ratingProposalSnapshot.ts,
// just through two different API routes (one editor-gated, one not) --
// see this milestone's report for why.
//
// Every value here is either a real proposed number or an explicit
// "unresolved" state -- never a converted-to-average fallback (Rating
// Model §2). No control anywhere writes a rating; this is presentation
// only.
import type { CSSProperties } from "react";
// lib/rating/types.ts is pure types/constants -- zero filesystem
// dependency -- safe to import directly into a client component,
// unlike lib/rating/pipeline/* or lib/gameWorld/* (both fs-touching,
// server-only).
import type { AbilityRating, GoalkeeperAttribute, OutcourtAttribute, PlayerRatingProfile } from "@/lib/rating/types";
import { getAttributeLabel } from "@/lib/rating/attributeVocabulary";

export interface RatingProposalRow {
  profile: PlayerRatingProfile;
  matchedCalibration: boolean;
}

const OUTCOURT_ATTRIBUTE_COUNT = 56;
const GOALKEEPER_ATTRIBUTE_COUNT = 21;

function AbilityBlock({ label, rating }: { label: string; rating: AbilityRating }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)" }}>
        {label}
      </span>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{rating.value ?? "Okänd"}</div>
        <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          {rating.confidence} · {rating.plausibleRange.min}–{rating.plausibleRange.max}
        </div>
      </div>
    </div>
  );
}

/** Right-column panel: proposed CA/PA with confidence + plausible range, plus role/position. */
export function RatingAbilityPanel({ row }: { row: RatingProposalRow }) {
  const { profile } = row;
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Förmåga (föreslagen)</span>
        {row.matchedCalibration ? <span className="hm-badge hm-badge-positive">KALIBRERAD</span> : <span className="hm-badge hm-badge-neutral">EJ BEDÖMD</span>}
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <AbilityBlock label="CA (nuvarande förmåga, 1–200)" rating={profile.ca} />
        <AbilityBlock label="PA (potential, 1–200)" rating={profile.pa} />
        <div className="hm-divider" />
        <RoleRow label="Anfallsroller" roles={profile.attackRoleProficiencies} />
        <RoleRow label="Försvarsroller" roles={profile.defenceRoleProficiencies} />
        <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0, lineHeight: 1.5 }}>
          {row.matchedCalibration
            ? "Baserat på HM-RATINGS-0.2:s expertkalibrering -- ett kalkylerat förslag, inte ett slutgiltigt betyg."
            : "Inget expertunderlag eller verifierad karriärsignal hittades bortom truppmedlemskap -- förblir okänt, ersätts aldrig av ett genomsnitt."}
        </p>
      </div>
    </div>
  );
}

function RoleRow({ label, roles }: { label: string; roles: { role: string }[] }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{roles.length ? roles.map((r) => r.role).join(", ") : "—"}</span>
    </div>
  );
}

/** Left-column panel: only the attributes with real evidence -- unresolved attributes stay explicitly unresolved, shown as a coverage note rather than 56/21 dash rows. */
export function RatingAttributesPanel({ row }: { row: RatingProposalRow }) {
  const { profile } = row;
  const isGoalkeeper = profile.position === "GK";
  const known = isGoalkeeper ? profile.goalkeeperAttributes : profile.outcourtAttributes;
  const totalPossible = isGoalkeeper ? GOALKEEPER_ATTRIBUTE_COUNT : OUTCOURT_ATTRIBUTE_COUNT;
  const knownCount = known ? Object.keys(known).length : 0;

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">{isGoalkeeper ? "Målvaktsattribut" : "Egenskaper"} (1–20)</span>
        <span className="hm-badge hm-badge-neutral">
          {knownCount} av {totalPossible} kända
        </span>
      </div>
      {knownCount === 0 ? (
        <div className="hm-panel-body hm-text-muted">Inga attribut har stöd i underlaget -- okänt förblir okänt, inte genomsnitt.</div>
      ) : (
        <div className="hm-panel-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 20px" }}>
          {Object.entries(known!).map(([name, value]) => (
            <div key={name} className="hm-stat-row">
              <span className="hm-stat-label">{getAttributeLabel(name as OutcourtAttribute | GoalkeeperAttribute)}</span>
              <span style={statValueStyle}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const statValueStyle: CSSProperties = { fontWeight: 700 };
