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
import { computeAssignmentProgressPct, type CreateScoutingAssignmentResult } from '@/lib/career/scouting';
import { KNOWLEDGE_TIER_LABEL_SV, KNOWLEDGE_TIERS, type KnowledgeTier } from "@/lib/knowledge/types";
import { NATION_LABEL_SV } from "@/lib/career/scoutDiscovery";
import { formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import { CONTRACT_STATUS_LABEL } from "@/lib/economy/labels";
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
import { PlayerCell, PlayerHero } from '@/components/game/Identity';
import { KnowledgeMeter, RecruitmentTag, TransferEvent } from '@/components/game/RecruitmentPresentation';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import type { CareerState } from '@/lib/career/types';

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
  const router = useRouter();
  const { career, createScoutingAssignment, addToShortlist, removeFromShortlist, setRecruitmentPriority, setRecruitmentNote } = useCareer();

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

  const selected = selectedPlayerId ? allCandidates.find((c) => c.playerId === selectedPlayerId) ?? null : filtered[0] ?? null;

  return (
    <div className="game-discovery-page"><PageHeading eyebrow="Rekrytering / klubbens nästa kapitel" title="Rekryteringscentrum" description="Bygg ett lag för nästa match och nästa säsong. Dina upptäckter, rapporter och värvningsmål samlade." actions={<Link className="hm-btn" href="/career/players">Spelarsök →</Link>} />
      <nav className="game-recruitment-stage" aria-label="Rekryteringsprocess">{SECTIONS.map((s, i) => <button key={s.id} type="button" aria-pressed={section === s.id} data-active={section === s.id} onClick={() => setSection(s.id)}><span className="game-stage-index">{String(i + 1).padStart(2, '0')}</span><span>{s.label}</span><strong>{allCandidates.filter(s.match).length}</strong></button>)}</nav>
      <div className="game-recruitment-layout">
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
                    data-selected={selected?.playerId === c.playerId}
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

      <div className="game-candidate-column">
        {selected ? (
          <CandidateDetailPanel
            key={selected.playerId}
            career={career}
            candidate={selected}
            hasOwnScout={clubScouts.length > 0}
            scouts={clubScouts}
            onOpenProfile={() => router.push(`/career/squad/${selected.playerId}`)}
            onStartScouting={(scoutId) => createScoutingAssignment(scoutId, selected.playerId, selected.clubId)}
            onToggleShortlist={() => (selected.shortlisted ? removeFromShortlist(selected.playerId) : addToShortlist(selected.playerId))}
            onSetPriority={(p) => setRecruitmentPriority(selected.playerId, p)}
            onSetNote={(n) => setRecruitmentNote(selected.playerId, n)}
          />
        ) : (
          <div className="hm-panel">
            <div className="hm-panel-body hm-text-muted">Välj en kandidat i listan för att se detaljer och agera.</div>
          </div>
        )}
      </div>
    </div></div>
  );
}

function CandidateDetailPanel({
  career,
  candidate,
  hasOwnScout,
  scouts,
  onOpenProfile,
  onStartScouting,
  onToggleShortlist,
  onSetPriority,
  onSetNote,
}: {
  career: CareerState;
  candidate: RecruitmentCandidate;
  hasOwnScout: boolean;
  scouts: { id: string; displayName: string }[];
  onOpenProfile: () => void;
  onStartScouting: (scoutId: string) => CreateScoutingAssignmentResult;
  onToggleShortlist: () => void;
  onSetPriority: (priority: RecruitmentPriority) => void;
  onSetNote: (note: string) => void;
}) {
  const [scoutId, setScoutId] = useState(scouts[0]?.id ?? "");
  const [noteDraft, setNoteDraft] = useState(candidate.note);
  const [scoutingFeedback, setScoutingFeedback] = useState('');
  const activeAssignment = Object.values(career.scoutingAssignments).find(a => a.targetPlayerId === candidate.playerId && a.status === 'IN_PROGRESS');

  const club = getClub(candidate.clubId);
  const competition = getCompetition(candidate.competitionId);
  const player = getCareerPlayer(career, candidate.playerId);
  const isOwnPlayer = player?.clubId === career.playerClubId;

  return (
    <div className="game-candidate-dossier">
      <div className="game-dossier-heading"><span className="hm-eyebrow">Spelardossier · {candidate.hasCompletedReport ? 'Rapport tillgänglig' : candidate.activeAssignment ? 'Scout på plats' : 'Första observation'}</span><RecruitmentTag status={candidate.recruitmentStatus} /></div>
      {player && <PlayerHero player={player} career={career} />}
      <div className="hm-actions game-dossier-links"><Link className="hm-btn" href={`/career/compare?left=${encodeURIComponent(candidate.playerId)}`}>Jämför med truppen</Link><Link className="hm-btn" href={`/career/transfers?target=${encodeURIComponent(candidate.playerId)}`}>Öppna bud & budget</Link></div>
      <div className="hm-panel game-candidate-facts">
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
          <KnowledgeMeter pct={candidate.knowledgePct} />
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
              {candidate.wageEurPerMonth !== null ? ` · ${formatMoney(candidate.wageEurPerMonth)}/mån` : ""}
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
          <span className="hm-panel-title">{candidate.hasCompletedReport ? 'Scoutens bedömning' : 'Bedömningsunderlag'}</span>
          <span className="game-report-stamp">{candidate.hasCompletedReport ? 'Rapport' : 'Observation'}</span>
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
          <div className="game-report-attributes"><div><div className="hm-eyebrow">Styrkor</div>{candidate.visibility?.strengths?.length ? <ul>{candidate.visibility.strengths.map(s => <li key={s}>{s}</li>)}</ul> : <p>Ännu inte tillräcklig kännedom.</p>}</div><div><div className="hm-eyebrow">Svagheter</div>{candidate.visibility?.weaknesses?.length ? <ul>{candidate.visibility.weaknesses.map(s => <li key={s}>{s}</li>)}</ul> : <p>Ännu inte tillräcklig kännedom.</p>}</div></div>
          <div className="hm-divider" />
          {hasOwnScout ? (
            <div style={{ display: "flex", gap: 6 }}>
              <select aria-label="Scout för kandidaten" style={inputStyle} value={scoutId} onChange={(e) => setScoutId(e.target.value)}>
                {scouts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
              <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={candidate.activeAssignment || !scoutId} onClick={() => { const result = onStartScouting(scoutId); setScoutingFeedback(result.ok ? 'Scouten följer spelaren. Rapporten kommer när uppdraget är klart.' : result.errors.join(' ')); }}>
                {candidate.activeAssignment ? "Scoutas redan" : "Starta full scouting"}
              </button>
            </div>
          ) : (
            <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
              Din klubb har ingen anställd scout.
              {' '}<Link href="/career/staff/recruitment">Rekrytera en scout →</Link>
            </p>
          )}
          {activeAssignment && <p className="hm-text-muted">{computeAssignmentProgressPct(activeAssignment, career.gameDate)}% av uppdraget · beräknad rapport {activeAssignment.endDate}. <Link href={`/career/scouting?target=${encodeURIComponent(candidate.playerId)}`}>Följ uppdraget →</Link></p>}
          {scoutingFeedback && <p role="status">{scoutingFeedback}</p>}
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
            aria-label="Anteckning om kandidaten"
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
          {candidate.latestTransferOffer && <TransferEvent offer={candidate.latestTransferOffer} career={career} />}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
            <span className="hm-text-muted">Nuvarande status</span>
            <span style={{ fontWeight: 700 }}>{candidate.transferStatusLabel}</span>
          </div>
          {isOwnPlayer ? <div className="game-offer-impact"><span className="hm-eyebrow">Spelaren tillhör din trupp</span><p>{candidate.contractEndDate ? `Nuvarande avtal gäller till ${candidate.contractEndDate}.` : 'Planera spelarens roll och nästa match med laget.'}</p><div className="hm-actions"><Link className="hm-btn" href="/career/squad">Truppens rollfördelning →</Link><Link className="hm-btn" href="/career/contracts">Kontraktsöversikt →</Link></div></div> : <>
          {/* HM-ALPHA2-05E: every deal is conducted in the Negotiation Room -- no second negotiation workflow here. */}
          <Link className="hm-btn hm-btn-primary hm-btn-sm" href={`/career/transfers/${encodeURIComponent(candidate.playerId)}`}>
            Förhandla om övergång →
          </Link>
          </>}
        </div>
      </div>
    </div>
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
