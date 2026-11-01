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
import { currencySymbol, formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import MoneyInput from "@/components/MoneyInput";
import { canRequestPartnershipSearch, isPartnershipExposureEligible, type ClubPartnership, type PartnershipStatus, type PartnershipType } from "@/lib/career/clubPartnerships";
import { getCareerSquad } from "@/lib/career/careerWorld";
import { getActivePlacementsAtClub, type PlayerPlacement } from "@/lib/career/playerPlacements";

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
  const { career, requestPartnershipSearch, startDevelopmentPartnership, terminatePartnership, renewPartnership, startPlacement, recallPlayerFromPlacement } = useCareer();

  const [formError, setFormError] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [monthlyCostEur, setMonthlyCostEur] = useState(1000);
  useMoney(); // re-render every figure when the display currency changes
  const [durationMonths, setDurationMonths] = useState(12);

  const clubId = career.playerClubId;
  const partnerships = Object.values(career.clubPartnerships).filter((p) => p.clubAId === clubId || p.clubBId === clubId);
  const permanentBTeam = partnerships.filter((p) => p.type === "AFFILIATED_B_TEAM");
  const otherPartnerships = partnerships.filter((p) => p.type !== "AFFILIATED_B_TEAM").sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  const activeDevelopment = otherPartnerships.find((p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE");
  const internationalLoanPartnerships = otherPartnerships.filter((p) => p.type === "INTERNATIONAL_LOAN_PARTNERSHIP" && p.status === "ACTIVE" && p.clubAId === clubId);

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
                  Kostnad / månad ({currencySymbol()})
                  <MoneyInput style={inputStyle} minEur={0} stepEur={100} valueEur={monthlyCostEur} onChangeEur={setMonthlyCostEur} />
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

      {[...permanentBTeam, ...(activeDevelopment ? [activeDevelopment] : [])].map((relation) => (
        <PlacementPanel
          key={relation.id}
          partnerClubId={relation.clubBId}
          startPlacement={startPlacement}
          recallPlayerFromPlacement={recallPlayerFromPlacement}
        />
      ))}

      {internationalLoanPartnerships.map((p) => (
        <InternationalLoanPanel key={p.id} partnership={p} />
      ))}

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

/**
 * HM-CLUB-PARTNERSHIPS-1.1: one partner club's own development-exposure
 * roster -- every eligible-but-not-yet-placed squad player (with a
 * one-click "Placera" action) and every currently placed player (with a
 * one-click "Återkalla" recall). Reuses isPartnershipExposureEligible/
 * canStartPlacement unchanged -- never a second eligibility check.
 */
function PlacementPanel({
  partnerClubId,
  startPlacement,
  recallPlayerFromPlacement,
}: {
  partnerClubId: string;
  startPlacement: (playerId: string, partnerClubId: string) => { ok: boolean; errors: string[] };
  recallPlayerFromPlacement: (playerId: string) => void;
}) {
  const { career } = useCareer();
  const [error, setError] = useState<string | null>(null);
  const squad = getCareerSquad(career);
  const active = getActivePlacementsAtClub(career, partnerClubId);
  const activeIds = new Set(active.map((p) => p.playerId));
  const eligible = squad.filter((p) => !activeIds.has(p.id) && isPartnershipExposureEligible(career, p.id, partnerClubId).eligible);

  function place(playerId: string) {
    setError(null);
    const result = startPlacement(playerId, partnerClubId);
    if (!result.ok) setError(result.errors.join(" "));
  }

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Spelmöjlighet hos {clubName(partnerClubId)}</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {active.length === 0 ? (
          <div className="hm-text-xs hm-text-muted">Ingen spelare placerad hos {clubName(partnerClubId)} just nu.</div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th>Spelare</th>
                <th>Placerad sedan</th>
                <th>Dagar hos partnerklubb</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {active.map((placement) => (
                <PlacementActiveRow key={placement.id} placement={placement} onRecall={() => recallPlayerFromPlacement(placement.playerId)} />
              ))}
            </tbody>
          </table>
        )}
        {eligible.length === 0 ? (
          <div className="hm-text-xs hm-text-muted">Inga kvalificerade spelare (19 år eller yngre) tillgängliga att placera just nu.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="hm-text-xs hm-text-muted">Kvalificerade spelare (19 år eller yngre):</div>
            {eligible.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span className="hm-text-xs">{p.firstName} {p.lastName}</span>
                <button type="button" className="hm-btn hm-btn-sm" onClick={() => place(p.id)}>
                  Placera
                </button>
              </div>
            ))}
          </div>
        )}
        {error ? <div className="hm-text-xs" style={{ color: "var(--hm-negative)" }}>{error}</div> : null}
      </div>
    </div>
  );
}

function PlacementActiveRow({ placement, onRecall }: { placement: PlayerPlacement; onRecall: () => void }) {
  const { career } = useCareer();
  const player = getCareerSquad(career).find((p) => p.id === placement.playerId);
  return (
    <tr>
      <td className="hm-td-strong">{player ? `${player.firstName} ${player.lastName}` : placement.playerId}</td>
      <td>{placement.startDate}</td>
      <td>{placement.exposureAccrued}</td>
      <td>
        <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onRecall}>
          Återkalla
        </button>
      </td>
    </tr>
  );
}

/**
 * HM-CLUB-PARTNERSHIPS-1.1: minimal integration for INTERNATIONAL_LOAN_PARTNERSHIP --
 * a genuine loan (never player-development-placement mechanics), reusing
 * the existing loan machinery unchanged via startInternationalPartnershipLoan.
 * Only rendered when an active international partnership row actually
 * exists (never fabricated -- Part: "seeda inte fejkade internationella
 * partnerskap").
 */
function InternationalLoanPanel({ partnership }: { partnership: ClubPartnership }) {
  const { career, startInternationalPartnershipLoan } = useCareer();
  const [playerId, setPlayerId] = useState("");
  const [wageShareBorrowingPct, setWageShareBorrowingPct] = useState(100);
  const [endDate, setEndDate] = useState(partnership.endDate ?? career.gameDate);
  const [error, setError] = useState<string | null>(null);
  const squad = getCareerSquad(career).filter((p) => career.playerStatuses[p.id]?.availability !== "ON_PLACEMENT");

  function submit() {
    setError(null);
    if (!playerId) return;
    const result = startInternationalPartnershipLoan(partnership.id, playerId, wageShareBorrowingPct, endDate);
    if (!result.ok) {
      setError(result.errors.join(" "));
      return;
    }
    setPlayerId("");
  }

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Internationellt låneavtal -- {clubName(partnership.clubBId)}</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
          Spelare
          <select style={inputStyle} value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Välj spelare</option>
            {squad.map((p) => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
          Löneandel låntagande klubb (%)
          <input style={inputStyle} type="number" min={0} max={100} value={wageShareBorrowingPct} onChange={(e) => setWageShareBorrowingPct(Number(e.target.value))} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
          Lån t.o.m.
          <input style={inputStyle} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <button type="button" className="hm-btn hm-btn-sm" disabled={!playerId} onClick={submit}>
          Låna ut
        </button>
      </div>
      {error ? <div className="hm-panel-body hm-text-xs" style={{ color: "var(--hm-negative)" }}>{error}</div> : null}
    </div>
  );
}

function PartnershipRow({ partnership }: { partnership: ClubPartnership }) {
  return (
    <tr>
      <td>{TYPE_LABEL_SV[partnership.type]}</td>
      <td className="hm-td-strong">{clubName(partnership.clubBId)}</td>
      <td>
        {partnership.startDate} – {partnership.endDate ?? "tillsvidare"}
      </td>
      <td>{partnership.monthlyCostEur > 0 ? formatMoney(partnership.monthlyCostEur) : "—"}</td>
      <td>
        <span className={`hm-badge hm-badge-${STATUS_TONE[partnership.status]}`}>{STATUS_LABEL_SV[partnership.status]}</span>
      </td>
    </tr>
  );
}
