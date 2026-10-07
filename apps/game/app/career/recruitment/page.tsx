"use client";

// HM-RECRUITMENT-1.1: the central Recruitment Centre -- Discovery ->
// Knowledge -> Scout Report -> Shortlist -> Recruitment Decision ->
// Transfer, all in ONE workspace. Purely a presentation layer over
// lib/career/recruitment.ts's already-composed RecruitmentCandidate
// view (itself composed entirely from canonical resolvers -- this page
// never re-derives knowledge/visibility/report/transfer rules itself).
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getClub, getCompetition, positionLabel, type HandballPosition } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getClubScouts } from "@/lib/career/scouting";
import { KNOWLEDGE_TIER_LABEL_SV, KNOWLEDGE_TIERS, type KnowledgeTier } from "@/lib/knowledge/types";
import { NATION_LABEL_SV } from "@/lib/career/scoutDiscovery";
import { formatEur } from "@/lib/economy/currency";
import { CONTRACT_STATUS_LABEL } from "@/lib/economy/labels";
import type { TransferDealType } from "@/lib/transfers/types";
import {
  getRecruitmentCandidates,
  RECRUITMENT_STATUSES,
  RECRUITMENT_STATUS_LABEL_SV,
  RECRUITMENT_PRIORITIES,
  RECRUITMENT_PRIORITY_LABEL_SV,
  type RecruitmentCandidate,
  type RecruitmentStatus,
  type RecruitmentPriority,
} from "@/lib/career/recruitment";

import Link from 'next/link';
import { PlayerLink, ClubLink } from '@/components/entityLinks';
import { PageHeading } from '@/components/manager/Workspace';

type SectionId = "ALL" | "NEW" | "SCOUTING" | "SCOUTED" | "SHORTLIST" | "PRIORITIZED" | "NEGOTIATING";

const SECTIONS: { id: SectionId; label: string; match: (c: RecruitmentCandidate) => boolean }[] = [
  { id: "ALL", label: "Alla", match: () => true },
  { id: "NEW", label: "Nya fynd", match: (c) => c.recruitmentStatus === "DISCOVERED" },
  { id: "SCOUTING", label: "Under scouting", match: (c) => c.recruitmentStatus === "SCOUTING" },
  { id: "SCOUTED", label: "Scoutade", match: (c) => c.recruitmentStatus === "SCOUTED" },
  { id: "SHORTLIST", label: "Kortlista", match: (c) => c.shortlisted },
  { id: "PRIORITIZED", label: "Prioriterade", match: (c) => c.recruitmentStatus === "PRIORITIZED" },
  { id: "NEGOTIATING", label: "Aktiva förhandlingar", match: (c) => c.recruitmentStatus === "NEGOTIATING" },
];

function starRangeLabel(range: { min: number; max: number } | null): string {
  if (!range) return "—";
  return range.min === range.max ? "★".repeat(range.min) + "☆".repeat(5 - range.min) : `${range.min}–${range.max} ★`;
}

export default function RecruitmentCentrePage() { return <Suspense><RecruitmentCentre /></Suspense>; }
function RecruitmentCentre() {
  const params = useSearchParams();
  const router = useRouter();
  const { career, createScoutingAssignment, addToShortlist, removeFromShortlist, setRecruitmentPriority, setRecruitmentNote, submitTransferOffer } = useCareer();

  const allCandidates = useMemo(() => getRecruitmentCandidates(career), [career]);
  const clubScouts = getClubScouts(career);

  const [section, setSection] = useState<SectionId>(params.get("view") === "SHORTLIST" ? "SHORTLIST" : "ALL");
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<HandballPosition | "ALL">("ALL");
  const [nationFilter, setNationFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<RecruitmentStatus | "ALL">("ALL");
  const [knowledgeFilter, setKnowledgeFilter] = useState<KnowledgeTier | "ALL">("ALL");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const nations = useMemo(() => Array.from(new Set(allCandidates.map((c) => c.nationality))).sort((a, b) => (NATION_LABEL_SV[a] ?? a).localeCompare(NATION_LABEL_SV[b] ?? b)), [allCandidates]);

  const filtered = useMemo(() => {
    return allCandidates.filter((c) => {
      const activeSection = SECTIONS.find((s) => s.id === section);
      if (activeSection && !activeSection.match(c)) return false;
      if (positionFilter !== "ALL" && c.position !== positionFilter) return false;
      if (nationFilter !== "ALL" && c.nationality !== nationFilter) return false;
      if (statusFilter !== "ALL" && c.recruitmentStatus !== statusFilter) return false;
      if (knowledgeFilter !== "ALL" && c.knowledgeTier !== knowledgeFilter) return false;
      if (query.trim().length > 0) {
        const name = `${c.firstName} ${c.lastName}`.toLowerCase();
        if (!name.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [allCandidates, section, positionFilter, nationFilter, statusFilter, knowledgeFilter, query]);

  const selected = selectedPlayerId ? allCandidates.find((c) => c.playerId === selectedPlayerId) ?? null : null;

  return (
    <><PageHeading eyebrow="Rekrytering / beslutsprocess" title="Rekryteringscentrum" description="Fynd → scouting → kortlista → jämförelse → avtal. Prioriteringar och anteckningar följer din karriär." actions={<Link className="hm-btn" href="/career/players">Spelarsök →</Link>} /><div className="hm-grid" style={{ gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 1fr)", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Pipeline sections */}
        <div className="hm-panel">
          <div className="hm-panel-body" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SECTIONS.map((s) => {
              const count = allCandidates.filter(s.match).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  className="hm-btn hm-btn-sm"
                  style={{
                    background: section === s.id ? "var(--hm-accent)" : undefined,
                    borderColor: section === s.id ? "var(--hm-accent)" : undefined,
                    color: section === s.id ? "#fff" : undefined,
                  }}
                  onClick={() => setSection(s.id)}
                >
                  {s.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters + candidate list */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Kandidater ({filtered.length})</span>
            <input style={{ ...inputStyle, maxWidth: 180 }} placeholder="Sök namn..." value={query} onChange={(e) => setQuery(e.target.value)} />
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
          <div className="hm-panel-body" style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 0 }}>
            <select style={inputStyle} value={nationFilter} onChange={(e) => setNationFilter(e.target.value)}>
              <option value="ALL">Alla länder</option>
              {nations.map((n) => (
                <option key={n} value={n}>
                  {NATION_LABEL_SV[n] ?? n}
                </option>
              ))}
            </select>
            <select style={inputStyle} value={knowledgeFilter} onChange={(e) => setKnowledgeFilter(e.target.value as KnowledgeTier | "ALL")}>
              <option value="ALL">All kännedom</option>
              {KNOWLEDGE_TIERS.map((t) => (
                <option key={t} value={t}>
                  {KNOWLEDGE_TIER_LABEL_SV[t]}
                </option>
              ))}
            </select>
            <select style={inputStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RecruitmentStatus | "ALL")}>
              <option value="ALL">All status</option>
              {RECRUITMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RECRUITMENT_STATUS_LABEL_SV[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="hm-scroll-x" style={{ maxHeight: 560, overflowY: "auto" }}>
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Spelare</th>
                  <th>Klubb</th>
                  <th>Pos</th>
                  <th>Ålder</th>
                  <th>Kännedom</th>
                  <th>Förmåga</th>
                  <th>Potential</th>
                  <th className="hm-table-num">Marknadsvärde</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.playerId}
                    data-clickable="true"
                    onClick={() => setSelectedPlayerId(c.playerId)}
                    style={{ background: selectedPlayerId === c.playerId ? "var(--hm-surface-2)" : undefined }}
                  >
                    <td className="hm-td-strong">
                      {c.shortlisted ? "★ " : ""}
                      <PlayerLink playerId={c.playerId} stopPropagation>{c.firstName} {c.lastName}</PlayerLink>
                    </td>
                    <td className="hm-text-muted">{c.clubId ? <ClubLink clubId={c.clubId} stopPropagation>{c.clubName}</ClubLink> : c.clubName}</td>
                    <td title={positionLabel(c.position)}>{c.position}</td>
                    <td>{c.ageYears ?? "–"}</td>
                    <td>{KNOWLEDGE_TIER_LABEL_SV[c.knowledgeTier]}</td>
                    <td>{starRangeLabel(c.visibility?.abilityRange ?? null)}</td>
                    <td>{starRangeLabel(c.visibility?.potentialRange ?? null)}</td>
                    <td className="hm-table-num">
                      {c.scoutReportView?.marketValueRange
                        ? c.scoutReportView.marketValueRange.min === c.scoutReportView.marketValueRange.max
                          ? formatEur(c.scoutReportView.marketValueRange.min)
                          : `${formatEur(c.scoutReportView.marketValueRange.min)}–${formatEur(c.scoutReportView.marketValueRange.max)}`
                        : "—"}
                    </td>
                    <td>
                      <span className="hm-badge hm-badge-neutral">{RECRUITMENT_STATUS_LABEL_SV[c.recruitmentStatus]}</span>
                    </td>
                    <td>
                      <button type="button" className="hm-btn hm-btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedPlayerId(c.playerId); }}>
                        Öppna
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? <div className="hm-panel-body hm-text-muted">Inga kandidater matchar filtret.</div> : null}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {selected ? (
          <CandidateDetailPanel
            candidate={selected}
            hasOwnScout={clubScouts.length > 0}
            scouts={clubScouts}
            onOpenProfile={() => router.push(`/career/squad/${selected.playerId}`)}
            onStartScouting={(scoutId) => createScoutingAssignment(scoutId, selected.playerId, selected.clubId)}
            onToggleShortlist={() => (selected.shortlisted ? removeFromShortlist(selected.playerId) : addToShortlist(selected.playerId))}
            onSetPriority={(p) => setRecruitmentPriority(selected.playerId, p)}
            onSetNote={(n) => setRecruitmentNote(selected.playerId, n)}
            onSubmitOffer={(params) => submitTransferOffer({ ...params, playerId: selected.playerId, toClubId: career.playerClubId })}
          />
        ) : (
          <div className="hm-panel">
            <div className="hm-panel-body hm-text-muted">Välj en kandidat i listan för att se detaljer och agera.</div>
          </div>
        )}
      </div>
    </div></>
  );
}

function CandidateDetailPanel({
  candidate,
  hasOwnScout,
  scouts,
  onOpenProfile,
  onStartScouting,
  onToggleShortlist,
  onSetPriority,
  onSetNote,
  onSubmitOffer,
}: {
  candidate: RecruitmentCandidate;
  hasOwnScout: boolean;
  scouts: { id: string; displayName: string }[];
  onOpenProfile: () => void;
  onStartScouting: (scoutId: string) => void;
  onToggleShortlist: () => void;
  onSetPriority: (priority: RecruitmentPriority) => void;
  onSetNote: (note: string) => void;
  onSubmitOffer: (params: { dealType: TransferDealType; transferFeeEur: number; newWageEurPerMonth: number; contractYears: number }) => void;
}) {
  const [scoutId, setScoutId] = useState(scouts[0]?.id ?? "");
  const [noteDraft, setNoteDraft] = useState(candidate.note);
  const [transferFeeEur, setTransferFeeEur] = useState(candidate.scoutReportView?.marketValueRange ? Math.round(candidate.scoutReportView.marketValueRange.max * 1.2) : 0);
  const [newWageEurPerMonth, setNewWageEurPerMonth] = useState(candidate.wageEurPerMonth ?? 500);
  const [contractYears, setContractYears] = useState(3);

  const club = getClub(candidate.clubId);
  const competition = getCompetition(candidate.competitionId);

  return (
    <>
      <div className="hm-actions"><Link className="hm-btn" href={`/career/compare?left=${encodeURIComponent(candidate.playerId)}`}>Jämför med truppen</Link><Link className="hm-btn" href={`/career/transfers?target=${encodeURIComponent(candidate.playerId)}`}>Öppna bud & budget</Link></div>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">
            <PlayerLink playerId={candidate.playerId}>{candidate.firstName} {candidate.lastName}</PlayerLink>
          </span>
          <span className="hm-badge hm-badge-neutral">{RECRUITMENT_STATUS_LABEL_SV[candidate.recruitmentStatus]}</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
            {positionLabel(candidate.position)} · {candidate.ageYears ?? "–"} år · {NATION_LABEL_SV[candidate.nationality] ?? candidate.nationality}
            {club ? ` · ${club.name}` : ` · ${candidate.clubName}`}
            {competition ? ` (${competition.name})` : ""}
          </div>
          <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>Kännedom: {KNOWLEDGE_TIER_LABEL_SV[candidate.knowledgeTier]}</div>
          {candidate.scoutDisplayName ? (
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              Källa: {candidate.discoverySource ? DISCOVERY_SOURCE_LABEL_SV[candidate.discoverySource] : "Direktsökning"} · {candidate.scoutDisplayName}
            </div>
          ) : null}
          {candidate.discoveryReasons.length > 0 ? (
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{candidate.discoveryReasons.join(" ")}</div>
          ) : null}
          {candidate.contractEndDate ? (
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              Kontrakt: {candidate.contractStatus ? CONTRACT_STATUS_LABEL[candidate.contractStatus] : ""} t.o.m. {candidate.contractEndDate}
              {candidate.wageEurPerMonth !== null ? ` · ${formatEur(candidate.wageEurPerMonth)}/mån` : ""}
            </div>
          ) : null}
          <div className="hm-divider" />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="hm-btn hm-btn-sm" onClick={onOpenProfile}>
              Öppna spelarprofil
            </button>
            <button type="button" className={`hm-btn hm-btn-sm${candidate.shortlisted ? " hm-btn-primary" : ""}`} onClick={onToggleShortlist}>
              {candidate.shortlisted ? "Ta bort från kortlista" : "Lägg till i kortlista"}
            </button>
          </div>
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Förmåga</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
            <span className="hm-text-muted">Nuvarande nivå</span>
            <span style={{ fontWeight: 700 }}>{starRangeLabel(candidate.visibility?.abilityRange ?? null)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
            <span className="hm-text-muted">Potential</span>
            <span style={{ fontWeight: 700 }}>{starRangeLabel(candidate.visibility?.potentialRange ?? null)}</span>
          </div>
          {candidate.visibility?.archetype ? (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
              <span className="hm-text-muted">Spelartyp</span>
              <span style={{ fontWeight: 700 }}>{candidate.visibility.archetype}</span>
            </div>
          ) : null}
          {candidate.scoutReportView ? (
            <>
              <div className="hm-divider" />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
                <span className="hm-text-muted">Scoutingens tillförlitlighet</span>
                <span style={{ fontWeight: 700 }}>{candidate.scoutReportView.confidencePct}%</span>
              </div>
              <p style={{ fontSize: "var(--hm-text-2xs)", margin: 0, lineHeight: 1.5 }}>{candidate.scoutReportView.recommendation}</p>
            </>
          ) : null}
          <div className="hm-divider" />
          {hasOwnScout ? (
            <div style={{ display: "flex", gap: 6 }}>
              <select style={inputStyle} value={scoutId} onChange={(e) => setScoutId(e.target.value)}>
                {scouts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
              <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={candidate.activeAssignment} onClick={() => onStartScouting(scoutId)}>
                {candidate.activeAssignment ? "Scoutas redan" : "Starta full scouting"}
              </button>
            </div>
          ) : (
            <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
              Din klubb har ingen anställd scout.
            </p>
          )}
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Prioritet & anteckning</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {RECRUITMENT_PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                className="hm-btn hm-btn-sm"
                style={{
                  background: candidate.priority === p ? "var(--hm-accent)" : undefined,
                  borderColor: candidate.priority === p ? "var(--hm-accent)" : undefined,
                  color: candidate.priority === p ? "#fff" : undefined,
                }}
                onClick={() => onSetPriority(p)}
              >
                {RECRUITMENT_PRIORITY_LABEL_SV[p]}
              </button>
            ))}
          </div>
          <textarea
            style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
            placeholder="Anteckning..."
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => onSetNote(noteDraft)}
          />
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Transfer</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
            <span className="hm-text-muted">Nuvarande status</span>
            <span style={{ fontWeight: 700 }}>{candidate.transferStatusLabel}</span>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
            Övergångssumma (€)
            <input style={inputStyle} type="number" min={0} value={transferFeeEur} onChange={(e) => setTransferFeeEur(Number(e.target.value))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
            Erbjuden lön (€/mån)
            <input style={inputStyle} type="number" min={0} value={newWageEurPerMonth} onChange={(e) => setNewWageEurPerMonth(Number(e.target.value))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
            Kontraktslängd (år)
            <input style={inputStyle} type="number" min={1} max={6} value={contractYears} onChange={(e) => setContractYears(Number(e.target.value))} />
          </label>
          <button
            type="button"
            className="hm-btn hm-btn-primary hm-btn-sm"
            onClick={() => onSubmitOffer({ dealType: "PERMANENT", transferFeeEur, newWageEurPerMonth, contractYears })}
          >
            Lägg transferbud
          </button>
        </div>
      </div>
    </>
  );
}

const DISCOVERY_SOURCE_LABEL_SV: Record<string, string> = {
  CLUB: "Klubb",
  COMPETITION: "Liga",
  REGION: "Land/region",
  POSITION: "Position",
  AGE_BAND: "Ålder",
};

const inputStyle = {
  background: "var(--hm-surface-2)",
  border: "1px solid var(--hm-border)",
  borderRadius: "var(--hm-radius-sm)",
  color: "var(--hm-text-primary)",
  padding: "7px 10px",
  fontSize: "var(--hm-text-xs)",
} as const;
