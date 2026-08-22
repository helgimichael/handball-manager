"use client";

// HM-EDITOR-0.2: Rating Review player detail. Shows the full
// HM-RATINGS-0.3 proposal (recomputed fresh every load, never edited
// here) plus the reviewer's own status/note (the only thing this page
// can write). No control anywhere on this page can set a ca/pa/
// attribute value -- review is the goal, not finalization.
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

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

interface RatingRow {
  profile: RatingProfile;
  matchedCalibration: boolean;
  defaultStatus: string;
  status: string;
  note: string | null;
  reviewedAt: string | null;
}

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
      }
      setSaveState("idle");
      setSaveErrors([]);
    });
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
        {row.matchedCalibration ? (
          <div className="hm-panel-body" style={{ paddingTop: 0 }}>
            <span className="hm-badge hm-badge-positive">HM-RATINGS-0.2 KALIBRERINGSTRÄFF</span>
          </div>
        ) : (
          <div className="hm-panel-body hm-text-muted" style={{ paddingTop: 0, fontSize: "var(--hm-text-2xs)" }}>
            Ingen kalibreringsträff -- inga expertankare eller verifierade karriärsignaler bortom truppmedlemskap.
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <AbilityCard label="FÖRESLAGET CA (1-200)" rating={profile.ca} />
        <AbilityCard label="FÖRESLAGET PA (1-200)" rating={profile.pa} />
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
                    <td className="hm-td-strong">{name}</td>
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
          Standard från pipelinen: {row.defaultStatus}. Endast status och anteckning sparas här -- CA/PA/attribut går inte att ändra på denna sida.
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
