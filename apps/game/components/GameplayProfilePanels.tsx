'use client';
// HM-UX-RATINGS-0.1 + HM-RICH-EXPERIENCE-02: Player Dossier 2.0 -- OWN players only.
// Arena Nights:
//   SQD-02j (A) Heat matrix: families as columns, attributes as tiles on a tokenised tier ramp, ▲/▼ deltas
//               from the stored development history (last 30 days), role-relevant tiles outlined, compare overlay.
//   SQD-02k (A) Suitability court: all seven spots shaded (primary solid, secondary partial, spots sharing one of
//               his attack roles faint), attack/defence role chips, tap a spot for the roles that exist there.
// Canonical CA/PA remain internal (1-5 stars only). External players never reach these panels.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ATTACK_ROLES_BY_POSITION } from "@/lib/rating/types";
import { abilityStarsFromCA, potentialStarsFromPA } from "@/lib/development/types";
import { presentTacticalRole } from "@/lib/rating/presentation";
import { ATTRIBUTE_TIER_LABEL_SV, type AttributeMatrix, type AttributeTier } from "@/lib/players/attributeMatrix";
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

const COURT_SPOTS: readonly { code: string; x: number; y: number }[] = [
  { code: "MV", x: 50, y: 12 },
  { code: "V6", x: 12, y: 24 },
  { code: "M6", x: 50, y: 36 },
  { code: "H6", x: 88, y: 24 },
  { code: "V9", x: 22, y: 70 },
  { code: "M9", x: 50, y: 80 },
  { code: "H9", x: 78, y: 70 },
];

type Fit = "primary" | "secondary" | "role" | "none";
const FIT_LABEL: Record<Fit, string> = { primary: "Primär position", secondary: "Sekundär position", role: "Hans anfallsroll finns här", none: "Ingen registrerad roll här" };

/** SQD-02k: club assessment, the suitability court and the role chips. */
export function GameplayAbilityPanel({ row, secondaryPosition }: { row: GameplayRatingRow; secondaryPosition?: string | null }) {
  const primary = row.position === "GK" ? "MV" : row.position;
  const attackRoles = row.attackRoleProficiencies.map((r) => r.role);
  const rolesAt = (code: string) => code === "MV" ? [] : attackRoles.filter((r) => (ATTACK_ROLES_BY_POSITION[code as keyof typeof ATTACK_ROLES_BY_POSITION] as readonly string[] | undefined)?.includes(r));
  const fit = (code: string): Fit => code === primary ? "primary" : code === secondaryPosition ? "secondary" : rolesAt(code).length ? "role" : "none";
  const [spot, setSpot] = useState<string>(primary);
  const spotRoles = rolesAt(spot);
  return (
    <section className="hm-panel gp-ability" aria-labelledby={`gp-ability-${row.playerId}`}>
      <div className="hm-panel-header">
        <span className="hm-panel-title" id={`gp-ability-${row.playerId}`}>Förmåga & Positionskarta</span>
        <Link className="gp-link" href="/career/tactics">Taktiktavlan →</Link>
      </div>
      <div className="hm-panel-body gp-ability-body">
        <div className="gp-ability-band">
          <div><span>Nuvarande nivå</span><StarRating stars={abilityStarsFromCA(row.ca)} title="Tränarstabens bedömning av nuvarande nivå" /></div>
          <div><span>Potential</span><StarRating stars={potentialStarsFromPA(row.pa)} title="Scoutingens uppskattning — osäker" /></div>
        </div>
        <div className="gp-court" role="group" aria-label={`Positionskarta: primär ${primary}${secondaryPosition ? `, sekundär ${secondaryPosition}` : ""}`}>
          <svg viewBox="0 0 200 110" preserveAspectRatio="none" aria-hidden="true" className="gp-court-lines">
            <path d="M 35 4 C 35 52 165 52 165 4" />
            <path d="M 14 4 C 14 88 186 88 186 4" strokeDasharray="4 3" />
            <rect x="86" y="2" width="28" height="5" />
          </svg>
          {COURT_SPOTS.map((s) => (
            <button key={s.code} type="button" className="gp-spot" data-fit={fit(s.code)} aria-pressed={spot === s.code} style={{ left: `${s.x}%`, top: `${s.y}%` }}
              aria-label={`${s.code}: ${FIT_LABEL[fit(s.code)]}`} onClick={() => setSpot(s.code)}>{s.code}</button>
          ))}
        </div>
        <p className="gp-spot-note" role="status"><b>{spot}</b> · {FIT_LABEL[fit(spot)]}{spotRoles.length ? ": " : ""}{spotRoles.map((r) => <span key={r} className="gp-chip" data-kind="attack">{presentTacticalRole(r)}</span>)}</p>
        <div className="gp-legend" aria-hidden="true"><span data-fit="primary">Primär</span><span data-fit="secondary">Sekundär</span><span data-fit="role">Roll finns</span></div>
        <RoleChips label="Anfallsroller" kind="attack" roles={row.attackRoleProficiencies} />
        <RoleChips label="Försvarsroller" kind="defence" roles={row.defenceRoleProficiencies} />
      </div>
    </section>
  );
}

function RoleChips({ label, kind, roles }: { label: string; kind: "attack" | "defence"; roles: { role: string }[] }) {
  return <div className="gp-roles"><span className="gp-roles-label">{label}</span><span className="gp-chips">{roles.length ? roles.map((r) => <span key={r.role} className="gp-chip" data-kind={kind}>{presentTacticalRole(r.role)}</span>) : <span className="hm-text-muted">—</span>}</span></div>;
}

const ORIGIN_LABEL: Partial<Record<string, string>> = { EVIDENCE_BACKED: "Belagt av källunderlag", EDITOR_OVERRIDE: "Manuellt satt" };
const TIERS: AttributeTier[] = ["elite", "strong", "solid", "weak"];

/** SQD-02j: the complete attribute set (56 outcourt / 21 goalkeeper) as a heat matrix. */
export function GameplayAttributesPanel({ matrix, position, compareLabel, compareControl, selected, onSelect }: {
  matrix: AttributeMatrix; position: string;
  /** Name of the overlay ("truppsnittet", a player's name) when a compare overlay is active. */
  compareLabel?: string | null;
  compareControl?: ReactNode;
  selected?: string | null;
  onSelect?: (attribute: string) => void;
}) {
  return (
    <section className="hm-panel gp-matrix" aria-labelledby="gp-matrix-h">
      <div className="hm-panel-header gp-matrix-head">
        <span className="hm-panel-title" id="gp-matrix-h">{matrix.goalkeeper ? "Målvaktsegenskaper" : "Spelaregenskaper"} (skala 1–20)</span>
        {compareControl}
      </div>
      <ol className="gp-family-avgs" aria-label="Familjesnitt">
        {matrix.families.map((f) => (
          <li key={f.key}>
            <span>{f.label}</span>
            <b>{f.avg.toFixed(1)}</b>
            {f.compareAvg != null && <small data-up={f.avg >= f.compareAvg}>{f.avg - f.compareAvg >= 0 ? "+" : ""}{(f.avg - f.compareAvg).toFixed(1)} mot {compareLabel ?? "jämförelse"}</small>}
            <i style={{ width: `${Math.min(100, (f.avg / 20) * 100)}%` }} aria-hidden="true" />
          </li>
        ))}
      </ol>
      <div className="gp-heat" data-cols={matrix.families.length}>
        {matrix.families.map((f) => {
          const changed = f.tiles.filter((t) => t.delta !== 0).length;
          return (
            <details key={f.key} className="gp-heat-family" open>
              <summary><span>{f.label}</span><b>{f.avg.toFixed(1)}</b>{changed > 0 && <small>{changed} förändrade</small>}</summary>
              <ul>
                {f.tiles.map((t) => {
                  const diff = t.compare != null ? Math.round((t.value - t.compare) * 10) / 10 : null;
                  const origin = t.origin ? ORIGIN_LABEL[t.origin] : undefined;
                  return (
                    <li key={t.key}>
                      <button type="button" className="gp-tile" data-tier={t.tier} data-relevant={t.relevant} aria-pressed={selected === t.key} onClick={() => onSelect?.(t.key)}
                        aria-label={`${t.label} ${t.value}${t.delta ? `, ${t.delta > 0 ? "upp" : "ner"} ${Math.abs(t.delta)} senaste 30 dagarna` : ""}${t.relevant ? ", rollviktig" : ""}${diff != null ? `, ${diff >= 0 ? "+" : ""}${diff} mot ${compareLabel ?? "jämförelse"}` : ""}${origin ? `, ${origin}` : ""}. Visa historik`}
                        title={origin}>
                        <span className="gp-tile-label">{origin && <i className="gp-origin" data-origin={t.origin!} aria-hidden="true" />}{t.label}</span>
                        <b className="gp-tile-value">{t.value}</b>
                        {t.delta !== 0 && <span className="gp-delta" data-up={t.delta > 0} aria-hidden="true">{t.delta > 0 ? "▲" : "▼"}{Math.abs(t.delta)}</span>}
                        {diff != null && <span className="gp-cmp" data-up={diff >= 0} aria-hidden="true">{diff >= 0 ? "+" : ""}{diff}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
      <footer className="gp-matrix-legend">
        {TIERS.map((t) => <span key={t} className="gp-tier-chip" data-tier={t}>{ATTRIBUTE_TIER_LABEL_SV[t]}</span>)}
        <span>▲▼ förändring senaste 30 dagarna ({matrix.changedCount} st)</span>
        <span className="gp-relevant-chip">Ram = rollviktig för {matrix.goalkeeper ? "MV" : position}</span>
        <span><i className="gp-origin" data-origin="EVIDENCE_BACKED" aria-hidden="true" />belagt · <i className="gp-origin" data-origin="EDITOR_OVERRIDE" aria-hidden="true" />manuellt satt</span>
      </footer>
    </section>
  );
}
