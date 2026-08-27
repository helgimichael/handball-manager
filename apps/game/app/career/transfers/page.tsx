"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { getClubsByCompetition, playerAge, positionLabel, type HandballPosition } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClubSquad } from "@/lib/career/careerWorld";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "@/lib/economy/contractIntegration";
import { getPlayerTrainingCompensation } from "@/lib/economy/trainingCompensationIntegration";
import { formatEur } from "@/lib/economy/currency";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/economy/labels";
import type { TransferDealType, TransferOffer, TransferOfferStatus } from "@/lib/transfers/types";

const STATUS_LABEL: Record<TransferOfferStatus, string> = {
  BLOCKED_UNAFFORDABLE: "Ej råd",
  REJECTED_BY_CLUB: "Nekat av klubben",
  REJECTED_BY_PLAYER: "Nekat av spelaren",
  AGREED_AWAITING_WINDOW: "Överenskommet — väntar på transferfönster",
  COMPLETED: "Genomfört",
};
const STATUS_TONE: Record<TransferOfferStatus, "positive" | "warning" | "negative" | "neutral"> = {
  BLOCKED_UNAFFORDABLE: "negative",
  REJECTED_BY_CLUB: "negative",
  REJECTED_BY_PLAYER: "negative",
  AGREED_AWAITING_WINDOW: "warning",
  COMPLETED: "positive",
};

export default function TransfersPage() {
  const { career, submitTransferOffer } = useCareer();
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<HandballPosition | "ALL">("ALL");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [dealType, setDealType] = useState<TransferDealType>("PERMANENT");
  const [transferFeeEur, setTransferFeeEur] = useState(0);
  const [newWageEurPerMonth, setNewWageEurPerMonth] = useState(0);
  const [contractYears, setContractYears] = useState(3);
  const [loanEndDate, setLoanEndDate] = useState("2027-01-15");
  const [wageShareBorrowingPct, setWageShareBorrowingPct] = useState(70);
  const [lastOffer, setLastOffer] = useState<TransferOffer | null>(null);
  const [recentOffers, setRecentOffers] = useState<TransferOffer[]>([]);

  const candidates = useMemo(() => {
    const clubs = getClubsByCompetition(career.competitionId).filter((c) => c.id !== career.playerClubId);
    const rows = clubs.flatMap((club) =>
      getCareerClubSquad(career, club.id).map((p) => ({ player: p, club })),
    );
    return rows.filter(({ player }) => {
      if (positionFilter !== "ALL" && player.position !== positionFilter) return false;
      if (query.trim().length === 0) return true;
      const name = `${player.firstName} ${player.lastName}`.toLowerCase();
      return name.includes(query.trim().toLowerCase());
    });
  }, [career, query, positionFilter]);

  const selected = selectedPlayerId ? candidates.find((c) => c.player.id === selectedPlayerId) ?? null : null;
  const selectedContract = selectedPlayerId ? getPlayerContract(career, selectedPlayerId) : undefined;
  const selectedContractStatus = selectedPlayerId ? getPlayerContractStatus(career, selectedPlayerId) : undefined;
  const selectedValue = selectedPlayerId ? getPlayerMarketValueEur(career, selectedPlayerId) : undefined;
  const selectedTrainingComp = selectedPlayerId ? getPlayerTrainingCompensation(career, selectedPlayerId) : undefined;
  const isFreeAgent = selectedContractStatus === "FREE_AGENT";

  function selectPlayer(playerId: string) {
    setSelectedPlayerId(playerId);
    setLastOffer(null);
    const contract = getPlayerContract(career, playerId);
    setNewWageEurPerMonth(contract?.wageEurPerMonth ?? 500);
    const value = getPlayerMarketValueEur(career, playerId) ?? 0;
    setTransferFeeEur(Math.round(value * 1.2));
  }

  function submit() {
    if (!selectedPlayerId) return;
    const offer = submitTransferOffer({
      dealType,
      playerId: selectedPlayerId,
      toClubId: career.playerClubId,
      transferFeeEur: isFreeAgent ? 0 : transferFeeEur,
      newWageEurPerMonth,
      contractYears,
      loanTerms: dealType === "LOAN" ? { endDate: loanEndDate, wageShareBorrowingPct } : undefined,
    });
    setLastOffer(offer);
    setRecentOffers((prev) => [offer, ...prev].slice(0, 10));
  }

  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Hitta spelare</span>
          <input
            style={{ ...inputStyle, maxWidth: 180 }}
            placeholder="Sök namn..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 0 }}>
          {(["ALL", "MV", "V9", "V6", "M9", "M6", "H9", "H6", "PV"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className="hm-btn hm-btn-sm"
              style={{
                background: positionFilter === p ? "var(--hm-accent)" : undefined,
                borderColor: positionFilter === p ? "var(--hm-accent)" : undefined,
                color: positionFilter === p ? "#fff" : undefined,
              }}
              onClick={() => setPositionFilter(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="hm-scroll-x">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Spelare</th>
                <th>Pos</th>
                <th>Ålder</th>
                <th>Klubb</th>
                <th>Kontrakt</th>
                <th className="hm-table-num">Marknadsvärde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {candidates.slice(0, 60).map(({ player, club }) => {
                const status = getPlayerContractStatus(career, player.id);
                const value = getPlayerMarketValueEur(career, player.id);
                return (
                  <tr key={player.id} data-clickable="true" onClick={() => selectPlayer(player.id)} style={{ background: selectedPlayerId === player.id ? "var(--hm-surface-2)" : undefined }}>
                    <td className="hm-td-strong">{player.firstName} {player.lastName}</td>
                    <td title={positionLabel(player.position)}>{player.position}</td>
                    <td>{playerAge(player.dateOfBirth, player.birthYear) ?? "–"}</td>
                    <td className="hm-text-muted">{club.shortName}</td>
                    <td>{status ? <span className={`hm-badge hm-badge-${CONTRACT_STATUS_TONE[status]}`}>{CONTRACT_STATUS_LABEL[status]}</span> : "—"}</td>
                    <td className="hm-table-num">{value !== undefined ? formatEur(value) : "—"}</td>
                    <td>
                      <button type="button" className="hm-btn hm-btn-sm" onClick={(e) => { e.stopPropagation(); selectPlayer(player.id); }}>
                        Välj
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {candidates.length === 0 ? <div className="hm-panel-body hm-text-muted">Inga spelare matchar filtret.</div> : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Bud</span>
          </div>
          {!selected ? (
            <div className="hm-panel-body hm-text-muted">Välj en spelare i listan för att göra ett bud.</div>
          ) : (
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "var(--hm-text-md)" }}>{selected.player.firstName} {selected.player.lastName}</div>
                <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>{selected.club.name} · {positionLabel(selected.player.position)}</div>
              </div>
              <Row label="Marknadsvärde" value={selectedValue !== undefined ? formatEur(selectedValue) : "—"} />
              <Row label="Nuvarande lön" value={selectedContract ? `${formatEur(selectedContract.wageEurPerMonth)}/mån` : "—"} />
              <Row label="Kontraktsstatus" value={selectedContractStatus ? CONTRACT_STATUS_LABEL[selectedContractStatus] : "—"} />
              {selectedTrainingComp && selectedTrainingComp.totalEur > 0 ? (
                <Row label="Utbildningsersättning" value={formatEur(selectedTrainingComp.totalEur)} />
              ) : null}

              <div className="hm-divider" />

              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="hm-btn hm-btn-sm" style={{ background: dealType === "PERMANENT" ? "var(--hm-accent)" : undefined, color: dealType === "PERMANENT" ? "#fff" : undefined }} onClick={() => setDealType("PERMANENT")}>
                  Permanent övergång
                </button>
                <button type="button" className="hm-btn hm-btn-sm" style={{ background: dealType === "LOAN" ? "var(--hm-accent)" : undefined, color: dealType === "LOAN" ? "#fff" : undefined }} onClick={() => setDealType("LOAN")}>
                  Lån
                </button>
              </div>

              {dealType === "PERMANENT" && !isFreeAgent ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                  Övergångssumma (€)
                  <input style={inputStyle} type="number" min={0} value={transferFeeEur} onChange={(e) => setTransferFeeEur(Number(e.target.value))} />
                </label>
              ) : dealType === "PERMANENT" && isFreeAgent ? (
                <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>Kontraktslös spelare — övergångssumma 0 €.</div>
              ) : null}

              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                {dealType === "LOAN" ? "Lön under lånet (100% bas, €/mån)" : "Erbjuden lön (€/mån)"}
                <input style={inputStyle} type="number" min={0} value={newWageEurPerMonth} onChange={(e) => setNewWageEurPerMonth(Number(e.target.value))} />
              </label>

              {dealType === "PERMANENT" ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                  Kontraktslängd (år)
                  <input style={inputStyle} type="number" min={1} max={6} value={contractYears} onChange={(e) => setContractYears(Number(e.target.value))} />
                </label>
              ) : (
                <>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                    Låneperiod slutar
                    <input style={inputStyle} type="date" value={loanEndDate} onChange={(e) => setLoanEndDate(e.target.value)} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                    Löneandel vi betalar (%)
                    <input style={inputStyle} type="number" min={0} max={100} value={wageShareBorrowingPct} onChange={(e) => setWageShareBorrowingPct(Number(e.target.value))} />
                  </label>
                </>
              )}

              {dealType === "PERMANENT" && selectedTrainingComp && selectedTrainingComp.totalEur > 0 ? (
                <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                  Total övergångskostnad: {formatEur((isFreeAgent ? 0 : transferFeeEur) + selectedTrainingComp.totalEur)} (övergångssumma + utbildningsersättning, separata poster)
                </div>
              ) : null}

              <button type="button" className="hm-btn hm-btn-primary" onClick={submit}>
                Lägg bud
              </button>

              {lastOffer ? (
                <div className="hm-panel-body" style={{ padding: 0, paddingTop: 8 }}>
                  <span className={`hm-badge hm-badge-${STATUS_TONE[lastOffer.status]}`}>{STATUS_LABEL[lastOffer.status]}</span>
                  <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", marginTop: 4 }}>
                    {lastOffer.clubDecisionReason ?? lastOffer.playerDecisionReason ?? ""}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Senaste bud</span>
          </div>
          {recentOffers.length === 0 ? (
            <div className="hm-panel-body hm-text-muted">Inga bud gjorda ännu denna session.</div>
          ) : (
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentOffers.map((offer) => (
                <div key={offer.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--hm-text-xs)" }}>
                  <span>{offer.dealType === "LOAN" ? "Lån" : "Övergång"} · {formatEur(offer.transferFeeEur)}</span>
                  <span className={`hm-badge hm-badge-${STATUS_TONE[offer.status]}`}>{STATUS_LABEL[offer.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
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
