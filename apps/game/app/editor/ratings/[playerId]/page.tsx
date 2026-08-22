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
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getAttributeLabel } from "@/lib/rating/attributeVocabulary";
import { GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES, type GoalkeeperAttribute, type OutcourtAttribute } from "@/lib/rating/types";
import { GeneratedProfilePreviewPanel } from "@/components/GeneratedProfilePreview";
import type { GenerationResult } from "@/lib/rating/generation/types";

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

type CASource = "CALIBRATED" | "MODEL_ESTIMATE" | "EDITOR_OVERRIDE" | "UNRESOLVED";

interface RatingRow {
  profile: RatingProfile;
  matchedCalibration: boolean;
  caProposal: CAProposal | null;
  caSource: CASource;
  override: RatingOverride | null;
  locked: LockedRecord | null;
  defaultStatus: string;
  status: string;
  note: string | null;
  reviewedAt: string | null;
  generatedPreview: GenerationResult;
}

const CA_SOURCE_LABEL: Record<CASource, { label: string; className: string }> = {
  CALIBRATED: { label: "KALIBRERAD", className: "hm-badge-positive" },
  MODEL_ESTIMATE: { label: "SKATTAD (HM-RATINGS-0.5)", className: "hm-badge-warning" },
  EDITOR_OVERRIDE: { label: "MANUELLT ÖVERSTYRD", className: "hm-badge-negative" },
  UNRESOLVED: { label: "EJ FASTSTÄLLD", className: "hm-badge-neutral" },
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

function AbilityCard({ label, rating }: { label: string; rating: AbilityRating }) {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">{label}</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
        <div style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800 }}>{rating.value ?? "OLÖST"}</div>
        <div>
          <div className="hm-eyebrow">KONFIDENS</div>
          <div>{rating.confidence}</div>
        </div>
        <div>
          <div className="hm-eyebrow">TROLIGT INTERVALL</div>
          <div>
            {rating.plausibleRange.min} – {rating.plausibleRange.max}
          </div>
        </div>
      </div>
      {rating.value === null ? (
        <div className="hm-panel-body hm-text-muted" style={{ paddingTop: 0, fontSize: "var(--hm-text-2xs)" }}>
          Inget värde föreslaget -- ingen ersätts automatiskt med ett genomsnitt.
        </div>
      ) : null}
    </div>
  );
}

function ClaimTable({ title, claims, emptyText }: { title: string; claims: RatingClaim[]; emptyText: string }) {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">{title}</span>
      </div>
      {claims.length === 0 ? (
        <div className="hm-panel-body hm-text-muted">{emptyText}</div>
      ) : (
        <table className="hm-table">
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
                <td className="hm-text-muted">{c.domain}</td>
                <td className="hm-td-strong">{c.key}</td>
                <td>{String(c.value)}</td>
                <td className="hm-text-muted">{c.confidence ?? "—"}</td>
                <td className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                  {c.sourceRefs.length ? c.sourceRefs.join(", ") : "—"}
                  {c.notes ? <div>{c.notes}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function RatingReviewPlayerPage() {
  const router = useRouter();
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
      rationale: claims.filter((c) => c.domain === "CALIBRATION"),
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

  if (!row || !identity) {
    return (
      <div style={{ maxWidth: 900, margin: "32px auto", padding: "0 20px" }}>
        <div className="hm-panel">
          <div className="hm-panel-body hm-text-muted">Läser in spelare...</div>
        </div>
      </div>
    );
  }

  const { profile } = row;
  const isGoalkeeper = profile.position === "GK";
  const knownAttributes = isGoalkeeper ? profile.goalkeeperAttributes : profile.outcourtAttributes;
  const totalPossible = isGoalkeeper ? GOALKEEPER_ATTRIBUTE_COUNT : OUTCOURT_ATTRIBUTE_COUNT;
  const knownCount = knownAttributes ? Object.keys(knownAttributes).length : 0;

  return (
    <div style={{ maxWidth: 1000, margin: "32px auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">{identity.fullName}</span>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push(`/editor/ratings?clubId=${clubId}`)}>
            ← Betygsgranskning
          </button>
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          SPELAR-ID: {profile.playerId} · KLUBB: {identity.clubName} · POSITION: {profile.position}
          {profile.secondaryPositions && profile.secondaryPositions.length > 0 ? ` (även: ${profile.secondaryPositions.join(", ")})` : ""}
          {identity.birthYear ? ` · FÖDD: ${identity.birthYear}` : ""}
          {identity.nationalities?.length ? ` · NATIONALITET: ${identity.nationalities.join(", ")}` : ""}
        </div>
        <div className="hm-panel-body" style={{ paddingTop: 0, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className={`hm-badge ${CA_SOURCE_LABEL[row.caSource].className}`}>{CA_SOURCE_LABEL[row.caSource].label}</span>
          {row.locked ? <span className="hm-badge hm-badge-positive">LÅST</span> : null}
          {row.matchedCalibration ? <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>HM-RATINGS-0.2 kalibreringsträff</span> : null}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <AbilityCard label="FÖRESLAGET CA (1-200)" rating={profile.ca} />
        <AbilityCard label="FÖRESLAGET PA (1-200)" rating={profile.pa} />
      </div>

      {row.caProposal ? (
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">CA-SKATTNING (HM-RATINGS-0.5)</span>
            <span className="hm-badge hm-badge-neutral">{row.caProposal.modelVersion}</span>
          </div>
          <div className="hm-panel-body" style={{ fontSize: "var(--hm-text-xs)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div>
              Bevispoäng: <strong>{row.caProposal.evidenceScore.toFixed(1)}</strong>
            </div>
            <p className="hm-text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
              {row.caProposal.rationale}
            </p>
          </div>
        </div>
      ) : null}

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">MANUELL ÖVERSTYRNING -- CA / PA</span>
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", paddingBottom: 0 }}>
          En manuell överstyrning vinner för den spelbara databasen men skriver aldrig över källunderlaget eller modellens förslag ovan.
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            CA (1-200)
            <input type="number" min={1} max={200} value={caOverrideDraft} onChange={(e) => setCaOverrideDraft(e.target.value)} style={{ ...selectStyle, width: 90 }} placeholder="Ej satt" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            PA (1-200)
            <input type="number" min={1} max={200} value={paOverrideDraft} onChange={(e) => setPaOverrideDraft(e.target.value)} style={{ ...selectStyle, width: 90 }} placeholder="Ej satt" />
          </label>
          <button type="button" className="hm-btn" onClick={saveCAPAOverride} disabled={overrideState === "saving"}>
            {overrideState === "saving" ? "SPARAR..." : "SPARA ÖVERSTYRNING"}
          </button>
          {row.override?.ca !== undefined || row.override?.pa !== undefined ? (
            <button type="button" className="hm-btn hm-btn-ghost" onClick={clearCAPAOverride}>
              RENSA ÖVERSTYRNING
            </button>
          ) : null}
          {overrideState === "saved" ? <span className="hm-badge hm-badge-positive">SPARAT</span> : null}
        </div>
        {overrideErrors.length > 0 ? (
          <div className="hm-panel-body" style={{ color: "var(--hm-negative)", fontSize: "var(--hm-text-xs)", paddingTop: 0 }}>
            {overrideErrors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">ROLL / POSITION</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--hm-text-xs)" }}>
          <div>
            <span className="hm-eyebrow">ANFALLSROLLER</span>{" "}
            {profile.attackRoleProficiencies.length ? profile.attackRoleProficiencies.map((r) => r.role).join(", ") : <span className="hm-text-muted">Ingen roll registrerad</span>}
          </div>
          <div>
            <span className="hm-eyebrow">FÖRSVARSROLLER</span>{" "}
            {profile.defenceRoleProficiencies.length ? profile.defenceRoleProficiencies.map((r) => r.role).join(", ") : <span className="hm-text-muted">Ingen roll registrerad</span>}
          </div>
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">{isGoalkeeper ? "MÅLVAKTSATTRIBUT" : "UTESPELARATTRIBUT"} (1-20)</span>
          <span className="hm-badge hm-badge-neutral">
            {knownCount} av {totalPossible} kända
          </span>
        </div>
        {knownCount === 0 ? (
          <div className="hm-panel-body hm-text-muted">Inga attribut har stöd i underlaget -- okänt förblir okänt, inte genomsnitt.</div>
        ) : (
          <>
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Attribut</th>
                  <th className="hm-table-num">Värde</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(knownAttributes!).map(([name, value]) => (
                  <tr key={name}>
                    <td className="hm-td-strong">{getAttributeLabel(name as OutcourtAttribute | GoalkeeperAttribute)}</td>
                    <td className="hm-table-num">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              Övriga {totalPossible - knownCount} attribut är okända -- de visas inte som ett gissat genomsnitt.
            </div>
          </>
        )}
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">MANUELL ÖVERSTYRNING -- ENSKILT ATTRIBUT</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            ATTRIBUT
            <select value={attributeKeyDraft} onChange={(e) => setAttributeKeyDraft(e.target.value)} style={{ ...selectStyle, minWidth: 200 }}>
              <option value="">Välj attribut...</option>
              {(isGoalkeeper ? GOALKEEPER_ATTRIBUTES : OUTCOURT_ATTRIBUTES).map((attr) => (
                <option key={attr} value={attr}>
                  {getAttributeLabel(attr)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            VÄRDE (1-20)
            <input type="number" min={1} max={20} value={attributeValueDraft} onChange={(e) => setAttributeValueDraft(e.target.value)} style={{ ...selectStyle, width: 80 }} />
          </label>
          <button type="button" className="hm-btn" onClick={saveAttributeOverride} disabled={attributeOverrideState === "saving" || !attributeKeyDraft || !attributeValueDraft}>
            {attributeOverrideState === "saving" ? "SPARAR..." : "SPARA"}
          </button>
          {attributeOverrideState === "saved" ? <span className="hm-badge hm-badge-positive">SPARAT</span> : null}
        </div>
        {row.override?.attributeOverrides && Object.keys(row.override.attributeOverrides).length > 0 ? (
          <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", paddingTop: 0 }}>
            Aktiva attributöverstyrningar:{" "}
            {Object.entries(row.override.attributeOverrides)
              .map(([k, v]) => `${getAttributeLabel(k as OutcourtAttribute | GoalkeeperAttribute)}=${v}`)
              .join(", ")}
          </div>
        ) : null}
      </div>

      <GeneratedProfilePreviewPanel result={row.generatedPreview} />

      <ClaimTable title="EXPERTANKARE" claims={[...claimsByEvidenceClass.anchors, ...claimsByEvidenceClass.projection]} emptyText="Inga expertankare registrerade." />
      <ClaimTable title="VERIFIERADE KARRIÄRSIGNALER" claims={claimsByEvidenceClass.careerSignals} emptyText="Inga verifierade karriärsignaler bortom truppmedlemskap." />
      <ClaimTable title="SKADA / TILLGÄNGLIGHET" claims={claimsByEvidenceClass.injury} emptyText="Ingen skadeinformation registrerad." />
      <ClaimTable title="MOTIVERING (VARFÖR DETTA RESULTAT)" claims={claimsByEvidenceClass.rationale} emptyText="—" />
      <ClaimTable title="FULLSTÄNDIGT BEVISSPÅR (alla claims)" claims={claimsByEvidenceClass.all} emptyText="Inga claims." />

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">GRANSKNINGSSTATUS</span>
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          Standard från pipelinen: {row.defaultStatus}. Denna panel sparar endast status och anteckning -- CA/PA/attributvärden ändras via överstyrningspanelerna ovan.
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            STATUS
            <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} style={selectStyle}>
              {REVIEW_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)", flex: 1, minWidth: 260 }}>
            ANTECKNING (valfritt)
            <input type="text" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} style={selectStyle} placeholder="Granskarens kommentar..." />
          </label>
          <button type="button" className="hm-btn hm-btn-primary" onClick={save} disabled={saveState === "saving"}>
            {saveState === "saving" ? "SPARAR..." : "SPARA GRANSKNING"}
          </button>
        </div>
        {row.reviewedAt ? <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", paddingTop: 0 }}>Senast granskad: {row.reviewedAt}</div> : null}
        {saveErrors.length > 0 ? (
          <div className="hm-panel-body" style={{ color: "var(--hm-negative)", fontSize: "var(--hm-text-xs)" }}>
            {saveErrors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        ) : null}
        {saveState === "saved" ? (
          <div className="hm-panel-body">
            <span className="hm-badge hm-badge-positive">SPARAT</span>
          </div>
        ) : null}
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">LÅSNING -- SPELBAR DATABAS</span>
          {row.locked ? <span className="hm-badge hm-badge-positive">LÅST</span> : null}
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          Låsning sparar en ögonblicksbild av CA, PA och den kompletta attributprofilen (med eventuella överstyrningar) som godkänt spelinnehåll. Källunderlag, modellförslag och granskningshistorik raderas aldrig -- allt förblir granskningsbart.
          {profile.ca.value === null ? " Kan inte låsas -- CA är inte fastställt." : ""}
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {row.locked ? (
            <button type="button" className="hm-btn hm-btn-ghost" onClick={unlockProfile} disabled={lockState === "saving"}>
              {lockState === "saving" ? "LÅSER UPP..." : "LÅS UPP"}
            </button>
          ) : (
            <button type="button" className="hm-btn hm-btn-primary" onClick={lockProfile} disabled={lockState === "saving" || profile.ca.value === null}>
              {lockState === "saving" ? "LÅSER..." : "LÅS PROFIL"}
            </button>
          )}
          {row.locked ? (
            <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              Låst {row.locked.lockedAt} · CA {row.locked.ca.value} ({row.locked.ca.source}) {row.locked.pa ? `· PA ${row.locked.pa.value} (${row.locked.pa.source})` : ""}
            </span>
          ) : null}
        </div>
        {lockErrors.length > 0 ? (
          <div className="hm-panel-body" style={{ color: "var(--hm-negative)", fontSize: "var(--hm-text-xs)" }}>
            {lockErrors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const selectStyle: CSSProperties = {
  background: "var(--hm-surface-2)",
  border: "1px solid var(--hm-border)",
  borderRadius: "var(--hm-radius-sm)",
  color: "var(--hm-text-primary)",
  padding: "7px 10px",
  fontSize: "var(--hm-text-xs)",
};
