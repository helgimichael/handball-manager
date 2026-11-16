"use client";

// HM-EDITOR-0.2/HM-RATINGS-0.5: Rating Review player detail. Shows the
// full source proposal (HM-RATINGS-0.3, recomputed fresh every load,
// never edited directly), the CA estimate (HM-RATINGS-0.5, when the
// player isn't already calibrated), and the complete generated
// attribute preview (HM-RATINGS-0.4). The reviewer's status/note,
// manual CA/PA/attribute overrides, and the LOCK action are the only
// things this page writes -- and an override always wins for display
// while the underlying source/model proposal above stays untouched and
// visible for audit (HM-RATINGS-0.5 Part J).
//
// Arena Nights SYS-02d (A) "Sectioned with sticky summary": CA/PA, status and LOCK in a
// sticky summary; sections collapse; overrides are highlighted against their base values;
// LOCK and unlock both require an explicit confirm step.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { getAttributeLabel } from "@/lib/rating/attributeVocabulary";
import { GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES, type GoalkeeperAttribute, type OutcourtAttribute } from "@/lib/rating/types";
import { GeneratedProfilePreviewPanel } from "@/components/GeneratedProfilePreview";
import type { GenerationResult } from "@/lib/rating/generation/types";
import { overrideDiffRows } from "@/lib/editor/ratingQueue";
import "../ratings.css";

const REVIEW_STATUSES = ["UNASSESSED", "PROPOSED", "REVIEWED", "LOCKED"] as const;

interface RatingClaim {
  id: string;
  domain: string;
  key: string;
  value: string | number | boolean;
  evidenceClass: string;
  confidence?: string;
  contextRef?: string;
  sourceRefs: string[];
  notes?: string;
}

interface AbilityRating {
  value: number | null;
  confidence: string;
  plausibleRange: { min: number; max: number };
}

interface RatingProfile {
  playerId: string;
  position: string;
  secondaryPositions?: string[];
  physicalProfile: { heightCm?: number; weightKg?: number; handedness?: string };
  outcourtAttributes?: Record<string, number>;
  goalkeeperAttributes?: Record<string, number>;
  attackRoleProficiencies: { role: string; value?: number }[];
  defenceRoleProficiencies: { role: string; value?: number }[];
  ca: AbilityRating;
  pa: AbilityRating;
  claims: RatingClaim[];
}

interface CAProposal {
  status: "ESTIMATED" | "UNRESOLVED";
  value: number | null;
  confidence: string;
  plausibleRange: { min: number; max: number };
  evidenceScore: number;
  rationale: string;
  modelVersion: string;
}

interface RatingOverride {
  ca?: number;
  pa?: number;
  attributeOverrides?: Record<string, number>;
  updatedAt: string;
}

interface LockedRecord {
  ca: { value: number; source: string };
  pa: { value: number; source: string } | null;
  lockedAt: string;
  lockedNote?: string;
}

type CASource = "CALIBRATED" | "MODEL_ESTIMATE" | "GENERATED_GAME_PRIOR" | "EDITOR_OVERRIDE" | "UNRESOLVED";

interface RatingRow {
  profile: RatingProfile;
  matchedCalibration: boolean;
  caProposal: CAProposal | null;
  caSource: CASource;
  override: RatingOverride | null;
  locked: LockedRecord | null;
  gamePriorArchetype: string | null;
  defaultStatus: string;
  status: string;
  note: string | null;
  reviewedAt: string | null;
  generatedPreview: GenerationResult;
}

const CA_SOURCE_LABEL: Record<CASource, { label: string }> = {
  CALIBRATED: { label: "KALIBRERAD" },
  MODEL_ESTIMATE: { label: "SKATTAD (HM-RATINGS-0.5)" },
  GENERATED_GAME_PRIOR: { label: "GENERERAD SPELDATA (HM-RATINGS-0.6)" },
  EDITOR_OVERRIDE: { label: "MANUELLT ÖVERSTYRD" },
  UNRESOLVED: { label: "EJ FASTSTÄLLD" },
};

interface IdentityRow {
  playerId: string;
  fullName: string;
  clubId: string;
  clubName: string;
  primaryPosition: string;
  dateOfBirth: string | null;
  birthYear: number | null;
  nationalities: string[] | null;
}

const OUTCOURT_ATTRIBUTE_COUNT = 56;
const GOALKEEPER_ATTRIBUTE_COUNT = 21;

function AbilityBlock({ label, rating }: { label: string; rating: AbilityRating }) {
  return (
    <div>
      <div className="hm-dev-eyebrow">{label}</div>
      <div className="rd-ability">
        <div className="rd-metric-value">{rating.value ?? "OLÖST"}</div>
        <div>
          <div className="hm-dev-eyebrow">Konfidens</div>
          <div>{rating.confidence}</div>
        </div>
        <div>
          <div className="hm-dev-eyebrow">Troligt intervall</div>
          <div className="hm-dev-num">
            {rating.plausibleRange.min} – {rating.plausibleRange.max}
          </div>
        </div>
      </div>
      {rating.value === null ? <p className="hm-dev-muted">Inget värde föreslaget -- ingen ersätts automatiskt med ett genomsnitt.</p> : null}
    </div>
  );
}

function ClaimTable({ title, claims, emptyText }: { title: string; claims: RatingClaim[]; emptyText: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="hm-dev-panel-title" style={{ marginBottom: 4 }}>{title}</div>
      {claims.length === 0 ? (
        <p className="hm-dev-muted" style={{ margin: 0 }}>{emptyText}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="hm-dev-table">
            <thead>
              <tr>
                <th>Område</th>
                <th>Nyckel</th>
                <th>Värde</th>
                <th>Konfidens</th>
                <th>Källor</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id}>
                  <td className="hm-dev-muted">{c.domain}</td>
                  <td>{c.key}</td>
                  <td>{String(c.value)}</td>
                  <td className="hm-dev-muted">{c.confidence ?? "—"}</td>
                  <td className="hm-dev-muted" style={{ whiteSpace: "normal" }}>
                    {c.sourceRefs.length ? c.sourceRefs.join(", ") : "—"}
                    {c.notes ? <div>{c.notes}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RatingReviewPlayerPage() {
  const params = useParams<{ playerId: string }>();
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId") ?? "";

  const [row, setRow] = useState<RatingRow | null>(null);
  const [identity, setIdentity] = useState<IdentityRow | null>(null);
  const [statusDraft, setStatusDraft] = useState<string>("UNASSESSED");
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  const [caOverrideDraft, setCaOverrideDraft] = useState<string>("");
  const [paOverrideDraft, setPaOverrideDraft] = useState<string>("");
  const [overrideState, setOverrideState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [overrideErrors, setOverrideErrors] = useState<string[]>([]);

  const [attributeKeyDraft, setAttributeKeyDraft] = useState<string>("");
  const [attributeValueDraft, setAttributeValueDraft] = useState<string>("");
  const [attributeOverrideState, setAttributeOverrideState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [lockState, setLockState] = useState<"idle" | "saving" | "error">("idle");
  const [lockErrors, setLockErrors] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<"lock" | "unlock" | null>(null);

  function load() {
    if (!clubId) return;
    Promise.all([
      fetch(`/api/editor/ratings/clubs/${encodeURIComponent(clubId)}`).then((res) => res.json()),
      fetch(`/api/editor/clubs/${encodeURIComponent(clubId)}/players`).then((res) => res.json()),
    ]).then(([ratingData, playerData]) => {
      const found: RatingRow | undefined = (ratingData.players ?? []).find((r: RatingRow) => r.profile.playerId === params.playerId);
      const foundIdentity: IdentityRow | undefined = (playerData.players ?? []).find((p: IdentityRow) => p.playerId === params.playerId);
      setRow(found ?? null);
      setIdentity(foundIdentity ?? null);
      if (found) {
        setStatusDraft(found.status);
        setNoteDraft(found.note ?? "");
        setCaOverrideDraft(found.override?.ca !== undefined ? String(found.override.ca) : "");
        setPaOverrideDraft(found.override?.pa !== undefined ? String(found.override.pa) : "");
      }
      setSaveState("idle");
      setSaveErrors([]);
    });
  }

  async function saveCAPAOverride() {
    if (!row) return;
    setOverrideState("saving");
    setOverrideErrors([]);
    const body: Record<string, unknown> = { clubId, position: row.profile.position };
    if (caOverrideDraft.trim()) body.ca = Number(caOverrideDraft);
    if (paOverrideDraft.trim()) body.pa = Number(paOverrideDraft);
    const res = await fetch(`/api/editor/ratings/players/${encodeURIComponent(params.playerId)}/override`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setOverrideState("error");
      setOverrideErrors(data.errors ?? [data.error ?? "Okänt fel"]);
      return;
    }
    setOverrideState("saved");
    load();
  }

  async function clearCAPAOverride() {
    if (!row) return;
    await fetch(`/api/editor/ratings/players/${encodeURIComponent(params.playerId)}/override`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId }),
    });
    setCaOverrideDraft("");
    setPaOverrideDraft("");
    load();
  }

  async function saveAttributeOverride() {
    if (!row || !attributeKeyDraft || !attributeValueDraft.trim()) return;
    setAttributeOverrideState("saving");
    const res = await fetch(`/api/editor/ratings/players/${encodeURIComponent(params.playerId)}/override`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, position: row.profile.position, attributeOverrides: { [attributeKeyDraft]: Number(attributeValueDraft) } }),
    });
    if (!res.ok) {
      setAttributeOverrideState("error");
      return;
    }
    setAttributeOverrideState("saved");
    setAttributeKeyDraft("");
    setAttributeValueDraft("");
    load();
  }

  async function lockProfile() {
    if (!row) return;
    setLockState("saving");
    setLockErrors([]);
    const res = await fetch(`/api/editor/ratings/players/${encodeURIComponent(params.playerId)}/lock`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, note: noteDraft || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLockState("error");
      setLockErrors(data.errors ?? [data.error ?? "Okänt fel"]);
      return;
    }
    setLockState("idle");
    load();
  }

  async function unlockProfile() {
    if (!row) return;
    setLockState("saving");
    await fetch(`/api/editor/ratings/players/${encodeURIComponent(params.playerId)}/lock`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId }),
    });
    setLockState("idle");
    load();
  }

  useEffect(load, [params.playerId, clubId]);

  const claimsByEvidenceClass = useMemo(() => {
    const claims = row?.profile.claims ?? [];
    return {
      anchors: claims.filter((c) => c.evidenceClass === "USER_EXPERT_PLAYER_ANCHOR" && c.domain !== "CALIBRATION"),
      careerSignals: claims.filter((c) => c.evidenceClass === "VERIFIED_CAREER_SIGNAL" && c.domain !== "POSITION" && c.domain !== "CONTEXT"),
      injury: claims.filter((c) => c.evidenceClass === "INJURY_AVAILABILITY"),
      projection: claims.filter((c) => c.evidenceClass === "PROJECTION_EXPECTATION"),
      rationale: claims.filter((c) => c.domain === "CALIBRATION" || c.domain === "GAME_PRIOR"),
      structural: claims.filter((c) => c.domain === "POSITION" || c.domain === "CONTEXT"),
      all: claims,
    };
  }, [row]);

  async function save() {
    if (!clubId) return;
    setSaveState("saving");
    setSaveErrors([]);
    const res = await fetch(`/api/editor/ratings/players/${encodeURIComponent(params.playerId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, status: statusDraft, note: noteDraft || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaveState("error");
      setSaveErrors(data.errors ?? [data.error ?? "Okänt fel"]);
      return;
    }
    setSaveState("saved");
    load();
  }

  if (!clubId) {
    return (
      <div className="hm-dev-panel" style={{ maxWidth: 560, margin: "32px auto" }}>
        <div className="hm-dev-empty">
          Ingen klubb angiven för spelaren. Öppna spelaren från granskningskön.
          <div style={{ marginTop: 8 }}>
            <Link href="/editor/ratings" className="hm-dev-btn hm-dev-btn--sm">Till betygsgranskning</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!row || !identity) {
    return <div className="hm-dev-empty">Läser in spelare…</div>;
  }

  const { profile } = row;
  const isGoalkeeper = profile.position === "GK";
  const knownAttributes = isGoalkeeper ? profile.goalkeeperAttributes : profile.outcourtAttributes;
  const totalPossible = isGoalkeeper ? GOALKEEPER_ATTRIBUTE_COUNT : OUTCOURT_ATTRIBUTE_COUNT;
  const knownCount = knownAttributes ? Object.keys(knownAttributes).length : 0;
  const attributeOverrides = row.override?.attributeOverrides ?? {};
  const diffRows = overrideDiffRows({ override: row.override, caEstimate: row.caProposal?.value ?? null, knownAttributes });
  const hasCaPaOverride = row.override?.ca !== undefined || row.override?.pa !== undefined;
  const source = CA_SOURCE_LABEL[row.caSource];
  const canLock = profile.ca.value !== null;
  const backHref = `/editor/ratings?clubId=${encodeURIComponent(clubId)}`;

  return (
    <>
      <div className="rd-summary">
        <div style={{ minWidth: 0 }}>
          <Link href={backHref} className="hm-dev-muted" style={{ textDecoration: "none", fontSize: 12 }}>← Granskningskön</Link>
          <div className="rd-summary-name">{identity.fullName}</div>
          <div className="rd-summary-meta">
            {identity.clubName} · {profile.position}
            {profile.secondaryPositions && profile.secondaryPositions.length > 0 ? ` (även ${profile.secondaryPositions.join(", ")})` : ""}
            {identity.birthYear ? ` · född ${identity.birthYear}` : ""}
            {identity.nationalities?.length ? ` · ${identity.nationalities.join(", ")}` : ""}
            <span className="hm-dev-num"> · {profile.playerId}</span>
          </div>
          <div className="rd-badges">
            <span className={`rd-badge${row.caSource === "EDITOR_OVERRIDE" ? " rd-badge--override" : ""}`}>{source.label}</span>
            {row.matchedCalibration ? <span className="rd-badge">HM-RATINGS-0.2 kalibreringsträff</span> : null}
            {diffRows.length > 0 ? <span className="rd-badge rd-badge--override">{diffRows.length} överstyrning{diffRows.length === 1 ? "" : "ar"}</span> : null}
            {row.gamePriorArchetype ? <span className="rd-badge" title="Ingen forskad profil, en spelbar gameplay-representation.">Arketyp {row.gamePriorArchetype}</span> : null}
          </div>
        </div>
        <div className="rd-metric">
          <span className="hm-dev-eyebrow">CA</span>
          <span className={`rd-metric-value${row.override?.ca !== undefined ? " hm-dev-diff" : ""}`}>{profile.ca.value ?? "—"}</span>
          <span className="hm-dev-muted hm-dev-num" style={{ fontSize: 11 }}>{profile.ca.confidence} · {profile.ca.plausibleRange.min}–{profile.ca.plausibleRange.max}</span>
        </div>
        <div className="rd-metric">
          <span className="hm-dev-eyebrow">PA</span>
          <span className={`rd-metric-value${row.override?.pa !== undefined ? " hm-dev-diff" : ""}`}>{profile.pa.value ?? "—"}</span>
          <span className="hm-dev-muted hm-dev-num" style={{ fontSize: 11 }}>{profile.pa.confidence} · {profile.pa.plausibleRange.min}–{profile.pa.plausibleRange.max}</span>
        </div>
        <div className="rd-metric">
          <span className="hm-dev-eyebrow">Status</span>
          <span className="hm-dev-num" style={{ fontWeight: 700 }}>{row.status}</span>
          <span className="hm-dev-muted" style={{ fontSize: 11 }}>{row.reviewedAt ? `granskad ${row.reviewedAt.slice(0, 10)}` : `standard ${row.defaultStatus}`}</span>
        </div>
        <div className="rd-metric">
          <span className="hm-dev-eyebrow">Lås</span>
          {row.locked ? (
            <>
              <span className="rd-locked">LÅST</span>
              <button type="button" className="hm-dev-btn hm-dev-btn--sm" onClick={() => setConfirm("unlock")} disabled={lockState === "saving"}>Lås upp…</button>
            </>
          ) : (
            <>
              <span className="hm-dev-muted">Ej låst</span>
              <button type="button" className="hm-dev-btn hm-dev-btn--sm hm-dev-btn--primary" onClick={() => setConfirm("lock")} disabled={lockState === "saving" || !canLock}>
                Lås…
              </button>
            </>
          )}
        </div>
      </div>

      {confirm ? (
        <div className="rd-confirm" role="alertdialog" aria-label={confirm === "lock" ? "Bekräfta låsning" : "Bekräfta upplåsning"} style={{ marginTop: 0, marginBottom: 12 }}>
          {confirm === "lock" ? (
            <span>
              Lås <strong>{identity.fullName}</strong> som godkänt spelinnehåll? En ögonblicksbild sparas: CA <span className="hm-dev-num">{profile.ca.value}</span>, PA{" "}
              <span className="hm-dev-num">{profile.pa.value ?? "—"}</span> och hela attributprofilen{diffRows.length > 0 ? ` med ${diffRows.length} överstyrning(ar)` : ""}. Källunderlag och historik raderas aldrig.
            </span>
          ) : (
            <span>
              Lås upp <strong>{identity.fullName}</strong>? Den låsta ögonblicksbilden (CA {row.locked?.ca.value}) tas bort från den spelbara databasen.
            </span>
          )}
          <div className="rd-confirm-actions">
            <button
              type="button"
              className="hm-dev-btn hm-dev-btn--primary"
              disabled={lockState === "saving"}
              onClick={async () => {
                if (confirm === "lock") await lockProfile();
                else await unlockProfile();
                setConfirm(null);
              }}
            >
              {lockState === "saving" ? "Arbetar…" : confirm === "lock" ? "Ja, lås profilen" : "Ja, lås upp"}
            </button>
            <button type="button" className="hm-dev-btn" onClick={() => setConfirm(null)} disabled={lockState === "saving"}>Avbryt</button>
          </div>
        </div>
      ) : null}
      {!row.locked && !canLock ? <p className="hm-dev-muted" style={{ marginTop: 0 }}>Kan inte låsas -- CA är inte fastställt.</p> : null}
      {lockErrors.length > 0 ? (
        <div className="hm-dev-alert" style={{ marginBottom: 12 }}>
          {lockErrors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      ) : null}
      {row.locked ? (
        <p className="hm-dev-muted hm-dev-num" style={{ marginTop: 0 }}>
          Låst {row.locked.lockedAt} · CA {row.locked.ca.value} ({row.locked.ca.source}){row.locked.pa ? ` · PA ${row.locked.pa.value} (${row.locked.pa.source})` : ""}
        </p>
      ) : null}

      <details className="hm-dev-panel rd-section" open>
        <summary>
          <span className="hm-dev-panel-title">Överstyrningar mot genererat</span>
          <span className="hm-dev-num hm-dev-muted">{diffRows.length}</span>
        </summary>
        <div className="hm-dev-panel-body">
          <p className="hm-dev-muted" style={{ marginTop: 0 }}>
            En manuell överstyrning vinner för den spelbara databasen men skriver aldrig över källunderlaget eller modellens förslag.
          </p>
          {diffRows.length > 0 ? (
            <table className="hm-dev-table" style={{ marginBottom: 12 }}>
              <thead>
                <tr>
                  <th>Värde</th>
                  <th className="hm-dev-num">Bas</th>
                  <th>Bas från</th>
                  <th className="hm-dev-num">Överstyrt</th>
                  <th className="hm-dev-num">Δ</th>
                </tr>
              </thead>
              <tbody>
                {diffRows.map((d) => (
                  <tr key={d.key}>
                    <td>{d.key === "CA" || d.key === "PA" ? d.key : getAttributeLabel(d.key as OutcourtAttribute | GoalkeeperAttribute)}</td>
                    <td className="hm-dev-num">{d.base ?? "—"}</td>
                    <td className="hm-dev-muted">{d.baseLabel}</td>
                    <td className="hm-dev-num hm-dev-dirty"><span className="hm-dev-diff">{d.override}</span></td>
                    <td className="hm-dev-num">{d.base === null ? "—" : `${d.override - d.base > 0 ? "+" : ""}${d.override - d.base}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="hm-dev-muted">Inga överstyrningar -- allt kommer från pipelinen.</p>
          )}
          <div className="rd-form">
            <label>
              CA (1-200)
              <input type="number" min={1} max={200} value={caOverrideDraft} onChange={(e) => setCaOverrideDraft(e.target.value)} style={{ width: 90 }} placeholder="Ej satt" />
            </label>
            <label>
              PA (1-200)
              <input type="number" min={1} max={200} value={paOverrideDraft} onChange={(e) => setPaOverrideDraft(e.target.value)} style={{ width: 90 }} placeholder="Ej satt" />
            </label>
            <button type="button" className="hm-dev-btn" onClick={saveCAPAOverride} disabled={overrideState === "saving"}>
              {overrideState === "saving" ? "Sparar…" : "Spara CA/PA-överstyrning"}
            </button>
            {hasCaPaOverride ? (
              <button type="button" className="hm-dev-btn hm-dev-btn--danger" onClick={clearCAPAOverride}>
                Rensa överstyrning
              </button>
            ) : null}
            {overrideState === "saved" ? <span className="hm-dev-pos">Sparat</span> : null}
          </div>
          {overrideErrors.length > 0 ? (
            <div className="rd-errors">
              {overrideErrors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          ) : null}
          <div className="rd-form" style={{ marginTop: 12 }}>
            <label>
              Attribut
              <select value={attributeKeyDraft} onChange={(e) => setAttributeKeyDraft(e.target.value)} style={{ minWidth: 200 }}>
                <option value="">Välj attribut…</option>
                {(isGoalkeeper ? GOALKEEPER_ATTRIBUTES : OUTCOURT_ATTRIBUTES).map((attr) => (
                  <option key={attr} value={attr}>
                    {getAttributeLabel(attr)}
                    {attributeOverrides[attr] !== undefined ? ` (överstyrt ${attributeOverrides[attr]})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Värde (1-20)
              <input type="number" min={1} max={20} value={attributeValueDraft} onChange={(e) => setAttributeValueDraft(e.target.value)} style={{ width: 80 }} />
            </label>
            <button type="button" className="hm-dev-btn" onClick={saveAttributeOverride} disabled={attributeOverrideState === "saving" || !attributeKeyDraft || !attributeValueDraft}>
              {attributeOverrideState === "saving" ? "Sparar…" : "Spara attribut"}
            </button>
            {!attributeKeyDraft || !attributeValueDraft ? <span className="hm-dev-muted">Välj attribut och värde för att spara.</span> : null}
            {attributeOverrideState === "saved" ? <span className="hm-dev-pos">Sparat</span> : null}
            {attributeOverrideState === "error" ? <span className="hm-dev-neg">Kunde inte spara attributet.</span> : null}
          </div>
        </div>
      </details>

      <details className="hm-dev-panel rd-section" open>
        <summary>
          <span className="hm-dev-panel-title">Granskningsstatus</span>
          <span className="hm-dev-num hm-dev-muted">{row.status}</span>
        </summary>
        <div className="hm-dev-panel-body">
          <p className="hm-dev-muted" style={{ marginTop: 0 }}>
            Standard från pipelinen: {row.defaultStatus}. Här sparas endast status och anteckning -- CA/PA/attribut ändras via överstyrningarna.
          </p>
          <div className="rd-form">
            <label>
              Status
              <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)}>
                {REVIEW_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 260 }}>
              Anteckning (valfritt)
              <input type="text" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Granskarens kommentar…" />
            </label>
            <button type="button" className="hm-dev-btn hm-dev-btn--primary" onClick={save} disabled={saveState === "saving"}>
              {saveState === "saving" ? "Sparar…" : "Spara granskning"}
            </button>
            {saveState === "saved" ? <span className="hm-dev-pos">Sparat</span> : null}
          </div>
          {row.reviewedAt ? <p className="hm-dev-muted hm-dev-num" style={{ marginBottom: 0 }}>Senast granskad: {row.reviewedAt}</p> : null}
          {saveErrors.length > 0 ? (
            <div className="rd-errors">
              {saveErrors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          ) : null}
        </div>
      </details>

      <details className="hm-dev-panel rd-section" open={row.caProposal?.status === "ESTIMATED"}>
        <summary>
          <span className="hm-dev-panel-title">CA/PA-förslag{row.caProposal?.status === "ESTIMATED" ? " · CA-skattning (HM-RATINGS-0.5)" : ""}</span>
          {row.caProposal?.status === "ESTIMATED" ? <span className="hm-dev-num hm-dev-muted">{row.caProposal.modelVersion}</span> : null}
        </summary>
        <div className="hm-dev-panel-body">
          <div className="hm-dev-split hm-dev-split--6-6">
            <AbilityBlock label="Föreslaget CA (1-200)" rating={profile.ca} />
            <AbilityBlock label="Föreslaget PA (1-200)" rating={profile.pa} />
          </div>
          {row.caProposal?.status === "ESTIMATED" ? (
            <div style={{ marginTop: 12 }}>
              <div>
                Bevispoäng: <strong className="hm-dev-num">{row.caProposal.evidenceScore.toFixed(1)}</strong> · modellskattning{" "}
                <strong className="hm-dev-num">{row.caProposal.value ?? "—"}</strong>
              </div>
              <p className="hm-dev-muted" style={{ marginBottom: 0 }}>{row.caProposal.rationale}</p>
            </div>
          ) : null}
        </div>
      </details>

      <details className="hm-dev-panel rd-section">
        <summary>
          <span className="hm-dev-panel-title">{isGoalkeeper ? "Målvaktsattribut" : "Utespelarattribut"} (1-20) · roller</span>
          <span className="hm-dev-num hm-dev-muted">{knownCount} av {totalPossible} kända</span>
        </summary>
        <div className="hm-dev-panel-body">
          <div style={{ marginBottom: 10 }}>
            <span className="hm-dev-eyebrow">Anfallsroller</span>{" "}
            {profile.attackRoleProficiencies.length ? profile.attackRoleProficiencies.map((r) => r.role).join(", ") : <span className="hm-dev-muted">Ingen roll registrerad</span>}
            <br />
            <span className="hm-dev-eyebrow">Försvarsroller</span>{" "}
            {profile.defenceRoleProficiencies.length ? profile.defenceRoleProficiencies.map((r) => r.role).join(", ") : <span className="hm-dev-muted">Ingen roll registrerad</span>}
          </div>
          {knownCount === 0 ? (
            <p className="hm-dev-muted">Inga attribut har stöd i underlaget -- okänt förblir okänt, inte genomsnitt.</p>
          ) : (
            <>
              <table className="hm-dev-table">
                <thead>
                  <tr>
                    <th>Attribut</th>
                    <th className="hm-dev-num">Källvärde</th>
                    <th className="hm-dev-num">Överstyrt</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(knownAttributes!).map(([name, value]) => {
                    const overridden = attributeOverrides[name];
                    return (
                      <tr key={name}>
                        <td>{getAttributeLabel(name as OutcourtAttribute | GoalkeeperAttribute)}</td>
                        <td className="hm-dev-num">{value}</td>
                        <td className={`hm-dev-num${overridden !== undefined ? " hm-dev-dirty" : ""}`}>{overridden !== undefined ? <span className="hm-dev-diff">{overridden}</span> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="hm-dev-muted">Övriga {totalPossible - knownCount} attribut är okända -- de visas inte som ett gissat genomsnitt.</p>
            </>
          )}
        </div>
      </details>

      <details className="hm-dev-panel rd-section">
        <summary>
          <span className="hm-dev-panel-title">Genererad attributprofil (förhandsvisning, HM-RATINGS-0.4)</span>
          {Object.keys(attributeOverrides).length > 0 ? <span className="hm-dev-warn">inkl. {Object.keys(attributeOverrides).length} överstyrda</span> : null}
        </summary>
        <div className="hm-dev-panel-body">
          <GeneratedProfilePreviewPanel result={row.generatedPreview} />
        </div>
      </details>

      <details className="hm-dev-panel rd-section">
        <summary>
          <span className="hm-dev-panel-title">Bevis och motivering</span>
          <span className="hm-dev-num hm-dev-muted">{claimsByEvidenceClass.all.length} claims</span>
        </summary>
        <div className="hm-dev-panel-body">
          <ClaimTable title="Expertankare" claims={[...claimsByEvidenceClass.anchors, ...claimsByEvidenceClass.projection]} emptyText="Inga expertankare registrerade." />
          <ClaimTable title="Verifierade karriärsignaler" claims={claimsByEvidenceClass.careerSignals} emptyText="Inga verifierade karriärsignaler bortom truppmedlemskap." />
          <ClaimTable title="Skada / tillgänglighet" claims={claimsByEvidenceClass.injury} emptyText="Ingen skadeinformation registrerad." />
          <ClaimTable title="Motivering (varför detta resultat)" claims={claimsByEvidenceClass.rationale} emptyText="—" />
          <ClaimTable title="Fullständigt bevisspår (alla claims)" claims={claimsByEvidenceClass.all} emptyText="Inga claims." />
        </div>
      </details>
    </>
  );
}
