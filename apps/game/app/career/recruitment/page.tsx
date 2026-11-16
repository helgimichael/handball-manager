"use client";

// HM-RECRUITMENT-1.1: the central Recruitment Centre -- Discovery ->
// Knowledge -> Scout Report -> Shortlist -> Recruitment Decision ->
// Transfer, all in ONE workspace. Purely a presentation layer over
// lib/career/recruitment.ts's already-composed RecruitmentCandidate
// view (itself composed entirely from canonical resolvers -- this page
// never re-derives knowledge/visibility/report/transfer rules itself).
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { positionLabel, type HandballPosition } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { KNOWLEDGE_TIER_LABEL_SV, KNOWLEDGE_TIERS, type KnowledgeTier } from "@/lib/knowledge/types";
import { NATION_LABEL_SV } from "@/lib/career/scoutDiscovery";
import { formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import {
  getRecruitmentCandidates,
  RECRUITMENT_STATUSES,
  RECRUITMENT_STATUS_LABEL_SV,
  type RecruitmentCandidate,
  type RecruitmentStatus,
} from "@/lib/career/recruitment";

import Link from 'next/link';
import { PlayerLink, ClubLink } from '@/components/entityLinks';
import { PageHeading } from '@/components/manager/Workspace';
import { PlayerCell } from '@/components/game/Identity';
import { KnowledgeMeter, RecruitmentTag } from '@/components/game/RecruitmentPresentation';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { PipelineBoard } from '@/components/recruitment/PipelineBoard';
import { RecruitPeek } from '@/components/scouting/RecruitPeek';
import { buildPipeline } from '@/lib/recruitment/pipeline';
import { positionDepth } from '@/lib/club/clubJournal';
import { getClubEconomySnapshot } from '@/lib/economy/clubEconomyIntegration';

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
  useMoney(); // re-render every figure when the display currency changes
  const params = useSearchParams();
  const { career } = useCareer();

  const allCandidates = useMemo(() => getRecruitmentCandidates(career), [career]);

  const [section, setSection] = useState<SectionId>(params.get("view") === "SHORTLIST" ? "SHORTLIST" : "ALL");
  const [query, setQuery] = useState("");
  const initialPosition = (["MV", "V9", "V6", "M9", "M6", "H9", "H6"] as const).find((p) => p === params.get("position"));
  const [positionFilter, setPositionFilter] = useState<HandballPosition | "ALL">(initialPosition ?? "ALL");
  const [nationFilter, setNationFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<RecruitmentStatus | "ALL">("ALL");
  const [knowledgeFilter, setKnowledgeFilter] = useState<KnowledgeTier | "ALL">("ALL");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  // Arena Nights Phase 3 (REC-02 C): the pipeline board is the default view; the filterable list stays one tap away.
  const [mode, setMode] = useState<'PIPELINE' | 'LIST'>(params.get("view") || initialPosition ? 'LIST' : 'PIPELINE');
  const lanes = useMemo(() => buildPipeline(allCandidates, positionDepth(career)), [allCandidates, career]);
  const economy = getClubEconomySnapshot(career, career.playerClubId);
  const budget = economy ? { transfer: formatMoney(economy.budgets.transferBudgetEur), wageRoom: formatMoney(economy.budgets.wageBudgetEur - economy.playerWageCostsEurAnnual), wageRoomNegative: economy.budgets.wageBudgetEur < economy.playerWageCostsEurAnnual } : null;

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

  // Arena Nights 231 (REC-02a A): a row opens the Recruitment Peek drawer -- the decision-relevant summary
  // with priority, note and the actions; everything else is one link away on the full profile.
  const peekCandidate = selectedPlayerId ? allCandidates.find((c) => c.playerId === selectedPlayerId) ?? null : null;

  return (
    <div className="game-discovery-page"><PageHeading eyebrow="Rekrytering / klubbens nästa kapitel" title="Rekryteringscentrum" description="Bygg ett lag för nästa match och nästa säsong. Dina upptäckter, rapporter och värvningsmål samlade." actions={<Link className="hm-btn" href="/career/players">Spelarsök →</Link>} />
      {mode === 'LIST' && <nav className="game-recruitment-stage" aria-label="Rekryteringsprocess">{SECTIONS.map((s, i) => <button key={s.id} type="button" aria-pressed={section === s.id} data-active={section === s.id} onClick={() => setSection(s.id)}><span className="game-stage-index">{String(i + 1).padStart(2, '0')}</span><span>{s.label}</span><strong>{allCandidates.filter(s.match).length}</strong></button>)}</nav>}
      <div className="rp-mode" role="group" aria-label="Visning">
        <button type="button" aria-pressed={mode === 'PIPELINE'} onClick={() => setMode('PIPELINE')}>Kedjan</button>
        <button type="button" aria-pressed={mode === 'LIST'} onClick={() => setMode('LIST')}>Lista & filter</button>
      </div>
      {mode === 'PIPELINE' && <PipelineBoard lanes={lanes} selectedId={peekCandidate?.playerId ?? null} onSelect={setSelectedPlayerId} budget={budget} />}
      <div className="game-recruitment-layout" data-mode={mode}>
      {mode === 'LIST' && (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Filters + candidate list */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Kandidater ({filtered.length})</span>
            <input aria-label="Sök kandidater" style={{ ...inputStyle, maxWidth: 180 }} placeholder="Sök namn..." value={query} onChange={(e) => setQuery(e.target.value)} />
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
          <div className="hm-scroll-x game-market-table" style={{ maxHeight: 650, overflowY: "auto" }}>
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
                    data-selected={peekCandidate?.playerId === c.playerId}
                    onClick={() => setSelectedPlayerId(c.playerId)}
                    style={{ background: selectedPlayerId === c.playerId ? "var(--hm-surface-2)" : undefined }}
                  >
                    <td className="hm-td-strong">
                      {getCareerPlayer(career, c.playerId) ? <PlayerCell player={getCareerPlayer(career, c.playerId)!} /> : <PlayerLink playerId={c.playerId} stopPropagation>{c.firstName} {c.lastName}</PlayerLink>}
                    </td>
                    <td className="hm-text-muted">{c.clubId ? <ClubLink clubId={c.clubId} stopPropagation>{c.clubName}</ClubLink> : c.clubName}</td>
                    <td title={positionLabel(c.position)}>{c.position}</td>
                    <td>{c.ageYears ?? "–"}</td>
                    <td><KnowledgeMeter pct={c.knowledgePct} /></td>
                    <td>{starRangeLabel(c.visibility?.abilityRange ?? null)}</td>
                    <td>{starRangeLabel(c.visibility?.potentialRange ?? null)}</td>
                    <td className="hm-table-num">
                      {c.scoutReportView?.marketValueRange
                        ? c.scoutReportView.marketValueRange.min === c.scoutReportView.marketValueRange.max
                          ? formatMoney(c.scoutReportView.marketValueRange.min)
                          : `${formatMoney(c.scoutReportView.marketValueRange.min)}–${formatMoney(c.scoutReportView.marketValueRange.max)}`
                        : "—"}
                    </td>
                    <td>
                      <RecruitmentTag status={c.recruitmentStatus} />
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
      )}

    </div>
      {peekCandidate && <RecruitPeek key={peekCandidate.playerId} candidate={peekCandidate} onClose={() => setSelectedPlayerId(null)} />}
    </div>
  );
}

const inputStyle = {
  background: "var(--hm-surface-2)",
  border: "1px solid var(--hm-border)",
  borderRadius: "var(--hm-radius-sm)",
  color: "var(--hm-text-primary)",
  padding: "7px 10px",
  fontSize: "var(--hm-text-xs)",
} as const;
