"use client";

// HM-CLUB-PARTNERSHIPS-1.0: the full Club Partnership workspace --
// permanent B-lag, an active/expired/terminated history, the board's
// own multi-day "Sök samarbetsklubb" search, and the resulting
// candidate-selection step. Swedish user-facing copy throughout; raw
// enums (PartnershipType/PartnershipStatus) are never rendered.
import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { canRequestPartnershipSearch, type ClubPartnership, type PartnershipStatus, type PartnershipType } from "@/lib/career/clubPartnerships";

const TYPE_LABEL_SV: Record<PartnershipType, string> = {
  AFFILIATED_B_TEAM: "Permanent B-lag",
  DEVELOPMENT_PARTNERSHIP: "Samarbetsklubb",
  INTERNATIONAL_LOAN_PARTNERSHIP: "Internationellt låneavtal",
};

const STATUS_LABEL_SV: Record<PartnershipStatus, string> = {
  ACTIVE: "Aktivt",
  EXPIRED: "Utgånget",
  TERMINATED: "Avslutat",
};

const STATUS_TONE: Record<PartnershipStatus, "positive" | "neutral" | "negative"> = {
  ACTIVE: "positive",
  EXPIRED: "neutral",
  TERMINATED: "negative",
};

function clubName(clubId: string): string {
  return getClub(clubId)?.name ?? clubId;
}

export default function ClubPartnershipsPage() {
  const router = useRouter();
  const { career, requestPartnershipSearch, startDevelopmentPartnership, terminatePartnership, renewPartnership } = useCareer();

  const [formError, setFormError] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [monthlyCostEur, setMonthlyCostEur] = useState(1000);
  const [durationMonths, setDurationMonths] = useState(12);

  const clubId = career.playerClubId;
  const partnerships = Object.values(career.clubPartnerships).filter((p) => p.clubAId === clubId || p.clubBId === clubId);
  const permanentBTeam = partnerships.filter((p) => p.type === "AFFILIATED_B_TEAM");
  const otherPartnerships = partnerships.filter((p) => p.type !== "AFFILIATED_B_TEAM").sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  const activeDevelopment = otherPartnerships.find((p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE");

  const search = Object.values(career.partnershipSearches)
    .filter((s) => s.clubId === clubId)
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0];
  const pendingSearch = search?.status === "IN_PROGRESS" ? search : null;
  const readyCandidates = search?.status === "COMPLETED" && !activeDevelopment ? search : null;

  const searchBlockers = canRequestPartnershipSearch(career, clubId);

  function startSearch() {
    setFormError(null);
    const result = requestPartnershipSearch();
    if (!result.ok) setFormError(result.errors.join(" "));
  }

  function confirmAgreement() {
    if (!readyCandidates || !selectedCandidateId) return;
    setFormError(null);
    const result = startDevelopmentPartnership(readyCandidates.id, selectedCandidateId, monthlyCostEur, durationMonths);
    if (!result.ok) {
      setFormError(result.errors.join(" "));
      return;
    }
    setSelectedCandidateId(null);
  }

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Klubbpartnerskap</span>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/career/club")}>
            ← Klubb
          </button>
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
          Permanenta B-lagsrelationer, samarbetsklubbar och internationella låneavtal med andra föreningar.
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Permanenta B-lag</span>
        </div>
        {permanentBTeam.length === 0 ? (
          <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>Klubben har inget permanent B-lag.</div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th>B-lag</th>
                <th>Relation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {permanentBTeam.map((p) => (
                <tr key={p.id}>
                  <td className="hm-td-strong">{clubName(p.clubBId)}</td>
                  <td>Permanent -- kan inte sägas upp</td>
                  <td>
                    <span className="hm-badge hm-badge-positive">{STATUS_LABEL_SV[p.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Sök samarbetsklubb</span>
        </div>
        {activeDevelopment ? (
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="hm-text-xs">
              Aktivt samarbete med <span className="hm-td-strong">{clubName(activeDevelopment.clubBId)}</span>, t.o.m. {activeDevelopment.endDate}.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="hm-btn hm-btn-sm" onClick={() => renewPartnership(activeDevelopment.id, 6)}>
                Förläng 6 månader
              </button>
              <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" style={{ color: "var(--hm-negative)" }} onClick={() => terminatePartnership(activeDevelopment.id)}>
                Avsluta samarbete
              </button>
            </div>
          </div>
        ) : pendingSearch ? (
          <div className="hm-panel-body hm-text-xs hm-text-muted">
            Styrelsen söker efter en lämplig samarbetsklubb. Klar {pendingSearch.endDate}.
          </div>
        ) : readyCandidates ? (
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="hm-text-xs hm-text-muted">Styrelsen föreslår följande tillgängliga klubbar:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {readyCandidates.candidateClubIds.map((id) => (
                <label key={id} className="hm-panel" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", cursor: "pointer", borderColor: selectedCandidateId === id ? "var(--hm-accent)" : undefined }}>
                  <input type="radio" name="candidate" checked={selectedCandidateId === id} onChange={() => setSelectedCandidateId(id)} />
                  <span className="hm-text-xs">{clubName(id)}</span>
                </label>
              ))}
            </div>
            {selectedCandidateId ? (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                  Kostnad / månad (€)
                  <input style={inputStyle} type="number" min={0} step={100} value={monthlyCostEur} onChange={(e) => setMonthlyCostEur(Number(e.target.value))} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                  Avtalslängd (månader)
                  <input style={inputStyle} type="number" min={1} step={1} value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} />
                </label>
                <button type="button" className="hm-btn hm-btn-sm" onClick={confirmAgreement}>
                  Ingå avtal
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="hm-text-xs hm-text-muted">
              Be styrelsen leta upp en lämplig Division 1-klubb för ett samarbete kring spelmöjlighet för unga spelare. Sökningen tar flera veckor.
            </div>
            <button type="button" className="hm-btn hm-btn-sm" disabled={searchBlockers.length > 0} onClick={startSearch}>
              Sök samarbetsklubb
            </button>
            {searchBlockers.length > 0 ? <div className="hm-text-xs hm-text-muted">{searchBlockers.join(" ")}</div> : null}
          </div>
        )}
        {formError ? <div className="hm-panel-body hm-text-xs" style={{ color: "var(--hm-negative)" }}>{formError}</div> : null}
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Historik</span>
        </div>
        {otherPartnerships.length === 0 ? (
          <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>Inga tidigare samarbeten.</div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Klubb</th>
                <th>Löptid</th>
                <th>Kostnad / mån</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {otherPartnerships.map((p) => (
                <PartnershipRow key={p.id} partnership={p} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  background: "var(--hm-surface-2)",
  border: "1px solid var(--hm-border)",
  borderRadius: "var(--hm-radius-sm)",
  color: "var(--hm-text-primary)",
  padding: "7px 10px",
  fontSize: "var(--hm-text-xs)",
};

function PartnershipRow({ partnership }: { partnership: ClubPartnership }) {
  return (
    <tr>
      <td>{TYPE_LABEL_SV[partnership.type]}</td>
      <td className="hm-td-strong">{clubName(partnership.clubBId)}</td>
      <td>
        {partnership.startDate} – {partnership.endDate ?? "tillsvidare"}
      </td>
      <td>{partnership.monthlyCostEur > 0 ? `${partnership.monthlyCostEur.toLocaleString("sv-SE")} €` : "—"}</td>
      <td>
        <span className={`hm-badge hm-badge-${STATUS_TONE[partnership.status]}`}>{STATUS_LABEL_SV[partnership.status]}</span>
      </td>
    </tr>
  );
}
