"use client";

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PlayerLink, ClubLink } from '@/components/entityLinks';
import { PageHeading } from '@/components/manager/Workspace';
import { getClubEconomySnapshot } from '@/lib/economy/clubEconomyIntegration';
import { getClub } from '@/lib/game-data';
import { positionLabel, type Club, type HandballPosition } from "@/lib/game-data";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClubSquad, getExternalCandidateClubs } from "@/lib/career/careerWorld";
import { getFreeAgents } from "@/lib/career/contractExpiry";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "@/lib/economy/contractIntegration";
import { getPlayerTrainingCompensation } from "@/lib/economy/trainingCompensationIntegration";
import { formatEur } from "@/lib/economy/currency";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/economy/labels";
import type { TransferDealType, TransferOffer, TransferOfferStatus } from "@/lib/transfers/types";
import { getPlayerKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { KNOWLEDGE_TIER_LABEL_SV, knowledgeTier } from "@/lib/knowledge/types";
import { resolveMarketValueRange } from "@/lib/knowledge/scoutReportVisibility";
import { resolvePlayerVisibility, type KnowledgeRatingInput } from "@/lib/knowledge/playerVisibility";
import { getCareerPlayerRating } from "@/lib/career/careerRatingNormalization";
import { KnowledgeGatedAbilityPanel } from "@/components/KnowledgeGatedProfilePanels";

const STATUS_LABEL: Record<TransferOfferStatus, string> = {
  BLOCKED_UNAFFORDABLE: "Ej råd",
  BLOCKED_PENDING_TRANSFER: "Spelaren har redan en pågående affär",
  REJECTED_BY_CLUB: "Nekat av klubben",
  REJECTED_BY_PLAYER: "Nekat av spelaren",
  AGREED_AWAITING_WINDOW: "Överenskommet — väntar på transferfönster",
  COMPLETED: "Genomfört",
  CANCELLED_STALE: "Avbrutet — spelaren bytte klubb innan affären slutfördes",
};
const STATUS_TONE: Record<TransferOfferStatus, "positive" | "warning" | "negative" | "neutral"> = {
  BLOCKED_UNAFFORDABLE: "negative",
  BLOCKED_PENDING_TRANSFER: "negative",
  REJECTED_BY_CLUB: "negative",
  REJECTED_BY_PLAYER: "negative",
  AGREED_AWAITING_WINDOW: "warning",
  COMPLETED: "positive",
  CANCELLED_STALE: "neutral",
};

export default function TransfersPage() { return <Suspense><Transfers /></Suspense>; }
function Transfers() {
  const params = useSearchParams();
  const target = params.get("target");
  const { career, submitTransferOffer } = useCareer();
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<HandballPosition | "ALL">("ALL");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(target);
  const [dealType, setDealType] = useState<TransferDealType>("PERMANENT");
  const [transferFeeEur, setTransferFeeEur] = useState(target ? Math.round((getPlayerMarketValueEur(career, target) ?? 0) * 1.2) : 0);
  const [newWageEurPerMonth, setNewWageEurPerMonth] = useState(target ? getPlayerContract(career, target)?.wageEurPerMonth ?? 500 : 0);
  const [contractYears, setContractYears] = useState(3);
  const [loanEndDate, setLoanEndDate] = useState("2027-01-15");
  const [wageShareBorrowingPct, setWageShareBorrowingPct] = useState(70);
  const [lastOffer, setLastOffer] = useState<TransferOffer | null>(null);
  const recentOffers = Object.values(career.transferOffers).filter(o => o.toClubId === career.playerClubId || o.fromClubId === career.playerClubId).reverse();
  const economy = getClubEconomySnapshot(career, career.playerClubId);

  const candidates = useMemo(() => {
    const clubs = getExternalCandidateClubs(career);
    const clubRows = clubs.flatMap((club) =>
      getCareerClubSquad(career, club.id).map((p) => ({ player: p, club: club as Club | null })),
    );
    // HM-PLAYER-CONTRACT-LIFECYCLE-1.0 Part 6: a released/expired player is
    // a genuine free agent (worldSquads[""]) -- surfaced here alongside
    // real-club candidates, `club: null` distinguishing them for display.
    const freeAgentRows = getFreeAgents(career).map((p) => ({ player: p, club: null as Club | null }));
    const rows = [...clubRows, ...freeAgentRows];
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
  const selectedKnowledgePct = selected ? getPlayerKnowledgePct(career, selected.player.id, selected.club?.id ?? "") : null;
  const selectedValueRange = selectedValue !== undefined && selectedKnowledgePct !== null ? resolveMarketValueRange(selectedValue, selectedKnowledgePct) : null;

  // HM-SCOUTING-1.0 Part 9: Transfers consumes the SAME knowledge layer
  // Player Profile does -- raw CA/PA never shown, only a knowledge-gated
  // ability/potential star range via the exact same resolvePlayerVisibility
  // resolver. Fetched only for the SELECTED player (never the whole
  // candidate list -- same fetch-on-demand pattern as
  // app/career/squad/[playerId]/page.tsx). Bidding itself is never
  // blocked by low knowledge (Part 9: "Scouting är information, inte
  // ett krav för transfer").
  const [selectedRatingRow, setSelectedRatingRow] = useState<KnowledgeRatingInput | null | undefined>(undefined);
  useEffect(() => {
    if (!selected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot "no player selected" reset, not a cascading update loop.
      setSelectedRatingRow(undefined);
      return;
    }
    if (getCareerPlayerRating(career, selected.player.id, selected.player.clubId) || selected.player.dataSource !== "REAL_WORLD") {
      const rating = getCareerPlayerRating(career, selected.player.id, selected.player.clubId);
      setSelectedRatingRow(rating ?? null);
      return;
    }
    let cancelled = false;
    fetch(`/api/game-world/gameplay-ratings/clubs/${encodeURIComponent(selected.player.clubId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const row = (data?.players ?? []).find((r: KnowledgeRatingInput & { playerId: string }) => r.playerId === selected.player.id) ?? null;
        setSelectedRatingRow(row);
      })
      .catch(() => {
        if (!cancelled) setSelectedRatingRow(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on the selected player's own id/clubId, matching Player Profile's identical fetch pattern.
  }, [selected?.player.id, selected?.player.clubId, selected?.player.dataSource]);
  const selectedKnowledgeView = selected && selectedRatingRow && selectedKnowledgePct !== null ? resolvePlayerVisibility(selectedRatingRow, selectedKnowledgePct) : null;

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

  }

  return (
    <><PageHeading eyebrow="Rekrytering / affärer" title="Transfers" description="Bud prövas av klubb och spelare. Överenskommelser genomförs när transferfönstret tillåter." actions={<Link className="hm-btn" href="/career/players">Spelarsök →</Link>} /><div className="hm-summary-strip"><div><small>Kassa</small><strong>{economy ? formatEur(economy.cashEur) : "—"}</strong></div><div><small>Transferbudget</small><strong>{economy ? formatEur(economy.budgets.transferBudgetEur) : "—"}</strong></div><div><small>Löneutrymme / månad</small><strong>{economy ? formatEur((economy.budgets.wageBudgetEur - economy.playerWageCostsEurAnnual) / 12) : "—"}</strong></div><div><small>Avtal i karriären</small><strong>{recentOffers.length}</strong></div></div><div className="hm-grid" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(280px, 1fr)" }}>
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
          {(["ALL", "MV", "V9", "V6", "M9", "M6", "H9", "H6"] as const).map((p) => (
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
                <th>Kännedom</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {candidates.slice(0, 60).map(({ player, club }) => {
                const status = getPlayerContractStatus(career, player.id);
                const value = getPlayerMarketValueEur(career, player.id);
                const knowledgePct = getPlayerKnowledgePct(career, player.id, club?.id ?? "");
                const valueRange = value !== undefined ? resolveMarketValueRange(value, knowledgePct) : null;
                return (
                  <tr key={player.id} data-clickable="true" onClick={() => selectPlayer(player.id)} style={{ background: selectedPlayerId === player.id ? "var(--hm-surface-2)" : undefined }}>
                    <td className="hm-td-strong"><PlayerLink playerId={player.id} stopPropagation>{player.firstName} {player.lastName}</PlayerLink></td>
                    <td title={positionLabel(player.position)}>{player.position}</td>
                    <td>{playerAgeAtDate(player.dateOfBirth, player.birthYear, career.gameDate) ?? "–"}</td>
                    <td className="hm-text-muted">{club ? <ClubLink clubId={club.id} stopPropagation>{club.shortName}</ClubLink> : "Fri agent"}</td>
                    <td>{status ? <span className={`hm-badge hm-badge-${CONTRACT_STATUS_TONE[status]}`}>{CONTRACT_STATUS_LABEL[status]}</span> : "—"}</td>
                    <td className="hm-table-num">{valueRange ? (valueRange.min === valueRange.max ? formatEur(valueRange.min) : `${formatEur(valueRange.min)} – ${formatEur(valueRange.max)}`) : "—"}</td>
                    <td className="hm-text-muted">{KNOWLEDGE_TIER_LABEL_SV[knowledgeTier(knowledgePct)]}</td>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "var(--hm-text-md)" }}><PlayerLink playerId={selected.player.id}>{selected.player.firstName} {selected.player.lastName}</PlayerLink></div>
                  <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>{selected.club ? selected.club.name : "Ingen klubb — fri agent"} · {positionLabel(selected.player.position)}</div>
                </div>
                {selectedKnowledgePct !== null ? <span className="hm-badge hm-badge-neutral">{KNOWLEDGE_TIER_LABEL_SV[knowledgeTier(selectedKnowledgePct)]}</span> : null}
              </div>
              <Row
                label="Marknadsvärde"
                value={selectedValueRange ? (selectedValueRange.min === selectedValueRange.max ? formatEur(selectedValueRange.min) : `${formatEur(selectedValueRange.min)} – ${formatEur(selectedValueRange.max)}`) : "—"}
              />
              <Row label="Nuvarande lön" value={selectedContract ? `${formatEur(selectedContract.wageEurPerMonth)}/mån` : "—"} />
              <Row label="Kontraktsstatus" value={selectedContractStatus ? CONTRACT_STATUS_LABEL[selectedContractStatus] : "—"} />
              {selectedTrainingComp && selectedTrainingComp.totalEur > 0 ? (
                <Row label="Utbildningsersättning" value={formatEur(selectedTrainingComp.totalEur)} />
              ) : null}

              {/* HM-SCOUTING-1.0 Part 9: knowledge-gated ability/potential -- never raw CA/PA, same resolver Player Profile uses. Bidding below is never blocked by this. */}
              {selectedKnowledgeView ? (
                <div style={{ margin: "-4px 0" }}>
                  <KnowledgeGatedAbilityPanel view={selectedKnowledgeView} />
                </div>
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
            <div className="hm-panel-body hm-text-muted">Inga bud registrerade i karriären.</div>
          ) : (
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentOffers.map((offer) => (
                <div key={offer.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--hm-text-xs)" }}>
                  <span><PlayerLink playerId={offer.playerId}>{Object.values(career.worldSquads).flat().find(p => p.id === offer.playerId)?.lastName ?? offer.playerId}</PlayerLink> · {offer.toClubId === career.playerClubId ? 'In' : 'Ut'} · {offer.offeredDate} · {offer.dealType === "LOAN" ? "Lån" : "Övergång"} · {formatEur(offer.transferFeeEur)}<br />{offer.fromClubId ? <ClubLink clubId={offer.fromClubId}>{getClub(offer.fromClubId)?.shortName ?? offer.fromClubId}</ClubLink> : 'Fri agent'} → <ClubLink clubId={offer.toClubId}>{getClub(offer.toClubId)?.shortName ?? offer.toClubId}</ClubLink></span>
                  <span className={`hm-badge hm-badge-${STATUS_TONE[offer.status]}`}>{STATUS_LABEL[offer.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div></>
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
