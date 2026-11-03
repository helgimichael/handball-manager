// HM-UX-RATINGS-0.1 + HM-RICH-EXPERIENCE-02: Player Dossier 2.0
// Visual attribute radar/pentagon, color-coded 1-20 attribute bars, and
// position suitability mini-court. Canonical CA/PA remain internal (1-5 stars only).
import type { CSSProperties } from "react";
import {
  GOALKEEPER_ATTRIBUTE_FAMILIES,
  OUTCOURT_ATTRIBUTE_FAMILIES,
  type GoalkeeperAttribute,
  type GoalkeeperAttributeFamily,
  type OutcourtAttribute,
  type OutcourtAttributeFamily,
} from "@/lib/rating/types";
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
  branch:
    | { branch: "OUTCOURT"; attributes: Record<string, GameplayAttributeEntry> }
    | { branch: "GOALKEEPER"; attributes: Record<string, GameplayAttributeEntry> };
  attackRoleProficiencies: { role: string }[];
  defenceRoleProficiencies: { role: string }[];
  locked: boolean;
}

const MINI_COURT_SPOTS: readonly { code: string; x: number; y: number }[] = [
  { code: "MV", x: 50, y: 15 },
  { code: "V6", x: 16, y: 26 },
  { code: "M6", x: 50, y: 36 },
  { code: "H6", x: 84, y: 26 },
  { code: "V9", x: 24, y: 68 },
  { code: "M9", x: 50, y: 78 },
  { code: "H9", x: 76, y: 68 },
];

/** Club assessment, handball roles, and visual position mini-court. */
export function GameplayAbilityPanel({ row }: { row: GameplayRatingRow }) {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Förmåga & Positionskarta</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <AbilityBlock label="Nuvarande nivå" stars={abilityStarsFromCA(row.ca)} title="Tränarstabens bedömning av nuvarande nivå" />
        <AbilityBlock label="Potential" stars={potentialStarsFromPA(row.pa)} title="Scoutingens uppskattning — osäker" />

        {/* Visual Position Suitability Mini-Court */}
        <div
          aria-label={`Positionskarta: primär position ${row.position}`}
          style={{
            position: "relative",
            height: 118,
            borderRadius: 5,
            background: "linear-gradient(180deg, #102a49 0%, #0b1d34 100%)",
            border: "1px solid #233f63",
            overflow: "hidden",
          }}
        >
          <svg viewBox="0 0 200 110" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.45 }}>
            <path d="M 35 4 C 35 52 165 52 165 4" fill="#1b4d82" stroke="#7ab3ef" strokeWidth="1.5" />
            <path d="M 14 4 C 14 88 186 88 186 4" fill="none" stroke="#7ab3ef" strokeWidth="1.2" strokeDasharray="4 3" />
            <rect x="86" y="2" width="28" height="5" fill="none" stroke="#f87171" strokeWidth="1.5" />
          </svg>
          {MINI_COURT_SPOTS.map((spot) => {
            const active = spot.code === row.position || (row.position === "GK" && spot.code === "MV");
            return (
              <span
                key={spot.code}
                style={{
                  position: "absolute",
                  left: `${spot.x}%`,
                  top: `${spot.y}%`,
                  transform: "translate(-50%, -50%)",
                  padding: active ? "3px 8px" : "2px 6px",
                  borderRadius: 999,
                  fontSize: active ? 10.5 : 9,
                  fontWeight: 800,
                  background: active ? "#22c55e" : "rgba(15, 27, 45, 0.78)",
                  color: active ? "#052e16" : "#94a3b8",
                  border: active ? "1.5px solid #bbf7d0" : "1px solid rgba(255,255,255,0.16)",
                  boxShadow: active ? "0 0 12px rgba(34, 197, 94, 0.55)" : "none",
                }}
              >
                {spot.code}
              </span>
            );
          })}
        </div>

        <div className="hm-divider" />
        <RoleRow label="Anfallsroller" roles={row.attackRoleProficiencies} />
        <RoleRow label="Försvarsroller" roles={row.defenceRoleProficiencies} />
      </div>
    </div>
  );
}

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
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 700, textAlign: "right" }}>
        {roles.length ? roles.map((r) => presentTacticalRole(r.role)).join(", ") : "—"}
      </span>
    </div>
  );
}

function tierColor(val: number): string {
  if (val >= 15) return "#15803d";
  if (val >= 12) return "#0369a1";
  if (val >= 9) return "#475569";
  return "#b45309";
}

/** Left-column panel: the COMPLETE gameplay attribute set (56 outcourt / 21 goalkeeper), with visual radar & bars. */
export function GameplayAttributesPanel({ row }: { row: GameplayRatingRow }) {
  const isGoalkeeper = row.branch.branch === "GOALKEEPER";
  const familyList = isGoalkeeper
    ? (Object.keys(GOALKEEPER_ATTRIBUTE_FAMILIES) as GoalkeeperAttributeFamily[]).map((family) => {
        const attrs = GOALKEEPER_ATTRIBUTE_FAMILIES[family].map(
          (a) => (row.branch.attributes as Record<string, GameplayAttributeEntry>)[a]?.value ?? 10,
        );
        const avg = attrs.reduce((s, v) => s + v, 0) / Math.max(1, attrs.length);
        return { key: family, label: getAttributeFamilyLabel(family), avg };
      })
    : (Object.keys(OUTCOURT_ATTRIBUTE_FAMILIES) as OutcourtAttributeFamily[]).map((family) => {
        const attrs = OUTCOURT_ATTRIBUTE_FAMILIES[family].map(
          (a) => (row.branch.attributes as Record<string, GameplayAttributeEntry>)[a]?.value ?? 10,
        );
        const avg = attrs.reduce((s, v) => s + v, 0) / Math.max(1, attrs.length);
        return { key: family, label: getAttributeFamilyLabel(family), avg };
      });

  // Compute Radar Polygon points
  const cx = 80;
  const cy = 80;
  const maxR = 58;
  const n = familyList.length;
  const polygonPoints = familyList
    .map((f, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = Math.max(0.15, Math.min(1, f.avg / 20)) * maxR;
      return `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">{isGoalkeeper ? "Målvaktsegenskaper" : "Spelaregenskaper"} (skala 1–20)</span>
        <span className="hm-text-muted" style={{ fontSize: 11 }}>
          Kategoriprofil & detaljanalys
        </span>
      </div>

      {/* Visual Radar & Category Summary Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "160px minmax(0, 1fr)",
          gap: 16,
          alignItems: "center",
          padding: "14px 16px",
          background: "linear-gradient(135deg, #0f1d31 0%, #152740 100%)",
          color: "#f1f5f9",
        }}
      >
        <svg viewBox="0 0 160 160" width="150" height="150" role="img" aria-label="Spelarprofilens radardiagram">
          {[0.35, 0.65, 1].map((scale) => (
            <polygon
              key={scale}
              points={familyList
                .map((_, i) => {
                  const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
                  const r = scale * maxR;
                  return `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
                })
                .join(" ")}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1"
            />
          ))}
          <polygon points={polygonPoints} fill="rgba(200, 67, 32, 0.42)" stroke="#f59e6c" strokeWidth="2" />
        </svg>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>
          {familyList.map((f) => (
            <div
              key={f.key}
              style={{
                padding: "7px 10px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#cbd5e1" }}>
                  {f.label}
                </span>
                <strong style={{ fontFamily: "var(--game-font-display)", fontSize: 18, color: "#ffffff" }}>
                  {f.avg.toFixed(1)}
                </strong>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.14)", borderRadius: 99, marginTop: 4, overflow: "hidden" }}>
                <i style={{ display: "block", height: "100%", width: `${Math.min(100, (f.avg / 20) * 100)}%`, background: "#f59e6c" }} />
              </div>
            </div>
          ))}
        </div>
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

function FamilyBlock({
  familyLabel,
  rows,
}: {
  familyLabel: string;
  rows: { attribute: string; label: string; entry: GameplayAttributeEntry }[];
}) {
  return (
    <div style={{ borderTop: "1px solid var(--hm-border)" }}>
      <div className="hm-eyebrow" style={{ padding: "10px 16px 4px", fontWeight: 800, color: "var(--game-ink)" }}>
        {familyLabel}
      </div>
      <div
        className="hm-panel-body"
        style={{
          paddingTop: 4,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 205px), 1fr))",
          gap: "7px 18px",
        }}
      >
        {rows.map(({ attribute, label, entry }) => {
          const val = entry?.value ?? 10;
          const color = tierColor(val);
          return (
            <div
              key={attribute}
              className="hm-stat-row"
              style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 44px 26px", alignItems: "center", gap: 6 }}
              title={
                entry.origin === "EVIDENCE_BACKED"
                  ? "Belagt av källunderlag"
                  : entry.origin === "EDITOR_OVERRIDE"
                  ? "Manuellt satt"
                  : undefined
              }
            >
              <span className="hm-stat-label" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {(entry.origin === "EVIDENCE_BACKED" || entry.origin === "EDITOR_OVERRIDE") && (
                  <span style={confirmedDotStyle(entry.origin)} />
                )}
                {label}
              </span>
              <span style={{ height: 5, background: "#dcd9cf", borderRadius: 99, overflow: "hidden", display: "block" }} aria-hidden="true">
                <i style={{ display: "block", height: "100%", width: `${Math.min(100, (val / 20) * 100)}%`, background: color }} />
              </span>
              <span
                style={{
                  ...statValueStyle,
                  textAlign: "right",
                  color,
                  fontSize: 12,
                }}
              >
                {val}
              </span>
            </div>
          );
        })}
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

const statValueStyle: CSSProperties = { fontWeight: 800 };
