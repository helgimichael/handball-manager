"use client";

// Arena Nights 231 -- REC-01 C "Shortlist & Reports" (Scout Desk). The scouting loop turns fog into a decision:
// a thin pipeline strip with the scouts' capacity (REC-01b), need-driven recommendations (REC-01a), the new
// reports as articles beside the ranked Kortlista, one "Ge ett uppdrag" field, the single pipeline list
// (REC-01e), the coverage map (REC-01d) and the ranked discoveries table (REC-01f). Reports open a report
// view (the Peek drawer) instead of dead-ending on the profile; assignments start from the "Scouta" sheet
// (REC-01c). ?target=<playerId> opens the sheet, ?report=<playerId> opens the report.
// HM-SCOUTING-1.0 loop unchanged: ASSIGN SCOUT -> TIME PASSES -> KNOWLEDGE INCREASES -> REPORT.
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/manager/Workspace";
import ClubCrest from "@/components/ClubCrest";
import { clubColorVars } from "@/components/game/Identity";
import { ScoutingCentre } from "@/components/scouting/ScoutingCentre";
import { AssignBox, CoverageMap, DiscoveriesTable, PipelineList, ReportFeed, ScoutStrip, ShortlistColumn, type DiscoveryRow } from "@/components/scouting/ScoutDesk";
import { RecruitPeek } from "@/components/scouting/RecruitPeek";
import { ScoutaSheet } from "@/components/scouting/ScoutaSheet";
import { DelegationToggle } from "@/components/staff/DelegationToggle";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { getRecruitmentCandidates } from "@/lib/career/recruitment";
import { getAllScoutDiscoveries } from "@/lib/career/scoutDiscovery";
import type { NeedLevel } from "@/lib/career/cpuSquadNeeds";
import { getClub } from "@/lib/game-data";
import { assignmentGroups, coverageTiles, pipelineCounts, rankedShortlist, reportFeed, scoutCapacity } from "@/lib/scouting/scoutDesk";
import { findStaffMember } from "@/lib/staff/staffCareerIntegration";
import { getManagerRecruitmentNeeds } from "@/lib/transfers/transferCentre";

export default function ScoutingPage() { return <Suspense><ScoutDeskPage /></Suspense>; }

function ScoutDeskPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { career } = useCareer();
  const playerClub = getClub(career.playerClubId);
  const candidates = useMemo(() => getRecruitmentCandidates(career), [career]);
  const byId = useMemo(() => new Map(candidates.map((c) => [c.playerId, c])), [candidates]);
  const scouts = useMemo(() => scoutCapacity(career), [career]);
  const needs = useMemo(() => new Map(getManagerRecruitmentNeeds(career).map((n) => [n.position as string, n.level as NeedLevel])), [career]);
  const needOf = (position: string) => needs.get(position) ?? "NONE";
  const counts = pipelineCounts(candidates);
  const feed = useMemo(() => reportFeed(career, candidates), [career, candidates]);
  const shortlist = rankedShortlist(candidates);
  const groups = assignmentGroups(career);
  const tiles = useMemo(() => coverageTiles(career), [career]);
  const discoveries = useMemo<DiscoveryRow[]>(() => {
    const seen = new Set<string>();
    const rows: DiscoveryRow[] = [];
    for (const d of [...getAllScoutDiscoveries(career)].sort((a, b) => b.discoveredDate.localeCompare(a.discoveredDate))) {
      if (seen.has(d.playerId) || d.assignmentType === "PLAYER") continue;
      seen.add(d.playerId);
      const c = byId.get(d.playerId);
      const p = getCareerPlayer(career, d.playerId);
      if (!c || !p) continue;
      rows.push({ id: d.id, playerId: d.playerId, clubId: c.clubId, name: `${p.firstName} ${p.lastName}`, position: p.position, scoutId: d.scoutStaffId, scoutName: findStaffMember(career, d.scoutStaffId)?.displayName ?? "Okänd scout", source: d.assignmentType, discoveredDate: d.discoveredDate, knowledgePct: c.knowledgePct, abilityRange: c.visibility?.abilityRange ?? null, potentialRange: c.visibility?.potentialRange ?? null, needLevel: needs.get(p.position) ?? "NONE", shortlisted: c.shortlisted, active: c.activeAssignment });
    }
    return rows;
  }, [career, byId, needs]);

  const [peek, setPeek] = useState<{ id: string; kicker?: string } | null>(() => (params.get("report") ? { id: params.get("report")! } : null));
  const [sheet, setSheet] = useState<{ playerId: string; clubId: string } | null>(() => {
    const target = params.get("target");
    const p = target ? getCareerPlayer(career, target) : undefined;
    return p && p.clubId !== career.playerClubId ? { playerId: p.id, clubId: p.clubId } : null;
  });
  const [tab, setTab] = useState<"REPORTS" | "SHORTLIST">("REPORTS");
  const [assignOpen, setAssignOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const peekCandidate = peek ? byId.get(peek.id) : undefined;

  const open = (playerId: string, kicker?: string) => { if (byId.has(playerId)) setPeek({ id: playerId, kicker }); else router.push(`/career/squad/${encodeURIComponent(playerId)}`); };
  const scout = (playerId: string, clubId: string) => setSheet({ playerId, clubId });

  return (
    <div className="game-scouting-page sd-page" style={clubColorVars(playerClub)}>
      <PageHeading
        eyebrow={`${playerClub?.name ?? career.playerClubId} · Rekrytering / upptäck & bedöm`}
        title="Scouting"
        description="Lär känna spelarna innan du bygger nästa lag. Det du inte vet visas som ett spann -- varje rapport gör det smalare."
        actions={
          <div className="hm-actions">
            {playerClub && <ClubCrest clubId={playerClub.id} shortName={playerClub.shortName} primaryColor={playerClub.primaryColor} size={40} />}
            <Link className="hm-btn" href="/career/analysis/opponent">Motståndaranalys →</Link>
            <Link className="hm-btn hm-btn-primary" href="/career/recruitment">Rekryteringscentrum →</Link>
          </div>
        }
      />

      <ScoutStrip counts={counts} scouts={scouts} />
      <DelegationToggle area="SCOUTING_ASSIGNMENTS" compact />
      {status && <p className="sd-status" role="status">{status}</p>}

      <ScoutingCentre onOpen={(id) => open(id)} onScout={scout} canScout={scouts.length > 0} />

      <div className="sd-tabs" role="tablist" aria-label="Scoutingdesken">
        <button type="button" role="tab" aria-selected={tab === "REPORTS"} onClick={() => setTab("REPORTS")}>Rapporter <b>{feed.length}</b></button>
        <button type="button" role="tab" aria-selected={tab === "SHORTLIST"} onClick={() => setTab("SHORTLIST")}>Kortlista <b>{shortlist.length}</b></button>
      </div>

      <div className="sd-grid" data-tab={tab}>
        <section className="sd-col-main" aria-labelledby="sd-reports">
          <header className="sd-sec-head"><div><span className="xp-eyebrow">Scouternas senaste</span><h2 id="sd-reports">Nya rapporter</h2></div></header>
          <ReportFeed cards={feed} onOpen={open} />
        </section>
        <aside className="sd-col-side">
          <section className="sd-panel" aria-labelledby="sd-shortlist">
            <header className="sd-sec-head"><div><span className="xp-eyebrow">Klar att buda på</span><h2 id="sd-shortlist">Kortlista</h2></div><Link className="sd-more" href="/career/recruitment?view=SHORTLIST">Alla →</Link></header>
            <ShortlistColumn list={shortlist} needOf={needOf} onOpen={(id) => open(id)} />
          </section>
          <section className="sd-panel sd-assign-panel" aria-labelledby="sd-assign-title">
            <header className="sd-sec-head"><div><span className="xp-eyebrow">Nytt uppdrag</span><h2 id="sd-assign-title">Ge ett uppdrag</h2></div></header>
            <AssignBox scouts={scouts} onScoutPlayer={scout} onDone={setStatus} />
          </section>
          <section className="sd-panel" aria-labelledby="sd-pl-title">
            <header className="sd-sec-head"><div><span className="xp-eyebrow">Ett flöde</span><h2 id="sd-pl-title">Uppdragen</h2></div></header>
            <PipelineList groups={groups} onOpenReport={(id) => open(id)} onRescout={scout} />
          </section>
        </aside>
      </div>

      <section className="sd-panel sd-wide" aria-labelledby="sd-cov-title">
        <header className="sd-sec-head"><div><span className="xp-eyebrow">Var scouterna är</span><h2 id="sd-cov-title">Täckning</h2></div></header>
        <CoverageMap tiles={tiles} scouts={scouts} onDone={setStatus} />
      </section>

      <section className="sd-panel sd-wide" aria-labelledby="sd-discoveries">
        <header className="sd-sec-head"><div><span className="xp-eyebrow">Från svepen</span><h2 id="sd-discoveries">Upptäckta spelare <b className="sd-num">{discoveries.length}</b></h2></div></header>
        <DiscoveriesTable rows={discoveries} scouts={scouts} onOpen={(id) => open(id)} onScout={scout} />
      </section>

      <button type="button" className="hm-btn hm-btn-primary sd-fab" onClick={() => setAssignOpen(true)}>Nytt uppdrag</button>
      {assignOpen && (
        <>
          <button type="button" className="sd-scrim" aria-label="Stäng" tabIndex={-1} onClick={() => setAssignOpen(false)} />
          <section className="sd-sheet" role="dialog" aria-modal="true" aria-label="Nytt uppdrag">
            <header className="sd-sheet-head"><span /><div><h3>Nytt uppdrag</h3></div><button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => setAssignOpen(false)}>Stäng</button></header>
            <AssignBox scouts={scouts} onScoutPlayer={(p, c) => { setAssignOpen(false); scout(p, c); }} onDone={(m) => { setStatus(m); setAssignOpen(false); }} />
          </section>
        </>
      )}
      {peekCandidate && <RecruitPeek key={peekCandidate.playerId} candidate={peekCandidate} kicker={peek?.kicker} onClose={() => setPeek(null)} />}
      {sheet && <ScoutaSheet playerId={sheet.playerId} clubId={sheet.clubId} onClose={() => setSheet(null)} onStarted={setStatus} />}
    </div>
  );
}
