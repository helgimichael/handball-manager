"use client";
import Link from 'next/link';
import { MatchHero } from '@/components/game/Identity';
import { ArchiveReplay } from '@/components/ProductionMatchView';
import { useMatchArchive } from '@/lib/save/useMatchArchive';
import { careerArchiveSummaries } from '@/lib/career/matchArchiveSummary';
import { PageHeading } from '@/components/manager/Workspace';
import MatchTimeline from '@/components/manager/MatchTimeline';
import MatchContext from "@/components/manager/MatchContext";
import { MatchAftermathPanel } from "@/components/matchday/Matchday";

import { useParams, useRouter } from "next/navigation";
import { COMPETITIONS, getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { getLastPlayedPlayerFixture } from "@/lib/career/calendar";
import { getLiveStandings } from "@/lib/career/standings";
import { workloadWindow } from "@/lib/training/workloadLedger";
import type { CareerState } from "@/lib/career/types";
import type { PlayerMatchContribution } from "@handball-manager/game-simulation";
import { PlayerLink } from "@/components/entityLinks";
import { svOrdinal } from "@/lib/format/ordinal";

export default function MatchReportPage() {
  const router = useRouter();
  const params = useParams<{ fixtureId: string }>();
  const { career } = useCareer();
  const replay = useMatchArchive(params.fixtureId);
  const archive = replay.archive;
  const summary = careerArchiveSummaries(career)[params.fixtureId];

  const fixture = career.fixtures.find((f) => f.id === params.fixtureId) ?? summary?.fixture ?? archive?.fixture;
  const result = career.results[params.fixtureId] ?? summary?.result ?? archive?.result;

  if (replay.loading) return <p role="status">Laddar matchrapporten…</p>;
  if (replay.error && (!fixture || !result)) return <div role="alert"><p>{replay.error}</p><button className="hm-btn" onClick={replay.retry}>Försök igen</button></div>;

  if (!fixture || !result) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Den här matchen saknar en rapport.</div>
      </div>
    );
  }

  const home = getClub(fixture.homeClubId)!;
  const away = getClub(fixture.awayClubId)!;
  // HM-MATCH-0.2: "best performer" is now match-wide (both teams), not
  // only the manager's own side -- now that the opponent's contributions
  // are genuinely populated (Section A of this milestone's audit), there
  // is real data to compare against, not just an empty array that would
  // have made this trivially always the manager's own best player.
  const bestPerformer = [...result.homePlayerContributions, ...result.awayPlayerContributions].sort((a, b) => b.rating - a.rating)[0];

  const table = getLiveStandings(career);
  const position = table.findIndex((row) => row.clubId === career.playerClubId) + 1;
  const competitionName = COMPETITIONS.find((c) => c.id === career.competitionId)?.name ?? "Ligan";
  // HM-UX-0.2 (Spec §35): Analysis Hub's Last Match view always derives
  // the CURRENT latest completed match -- never an arbitrary historical
  // one. Only offer "Öppna matchanalys" when this report IS that match;
  // an older report reached via Schedule only ever gets Match Report.
  const isCurrentLastMatch = getLastPlayedPlayerFixture(career)?.fixture.id === fixture.id;
  const managerTeam = fixture.homeClubId === career.playerClubId ? 'HOME' : 'AWAY';

  if(archive)return <div className="mc-report-page"><PageHeading eyebrow={fixture.date} title="Matchrapport" description="Resultatet, prestationerna och de avgörande ögonblicken."/><ArchiveReplay archive={archive}/><MatchAftermathPanel fixtureId={fixture.id}/><div className="mc-report-actions"><button type="button" className="hm-btn" onClick={()=>router.push('/career/schedule')}>← Schema</button><button type="button" className="hm-btn" onClick={()=>router.push(`/career/match-day/${fixture.id}`)}>Se matchrepris</button>{isCurrentLastMatch&&<button type="button" className="hm-btn" onClick={()=>router.push('/career/analysis/last-match')}>Öppna matchanalys</button>}<Link className="hm-btn" href={`/career/competitions/${fixture.competitionId}`}>Tabell & liga →</Link><button type="button" className="hm-btn hm-btn-primary" onClick={()=>router.push('/career')}>Fortsätt →</button></div><details className="hm-panel" open><summary className="hm-panel-header"><strong>Speltid och belastning</strong></summary><table className="hm-table"><thead><tr><th>Spelare</th><th>Minuter</th><th>Energi efter match</th><th title="Belastningspoäng: den energi matchen krävde (samma enhet som träning).">Matchbelastning</th><th title="Match + träning de senaste 7 dagarna, när hela perioden är registrerad.">Senaste 7 dagar</th></tr></thead><tbody>{archive.people.filter(p => (archive.load[p.id]?.minutes ?? 0) > 0).map(p => { const l = archive.load[p.id]; const week = workloadWindow(career.workloadLedger, p.id, fixture.date, 7, p.team === managerTeam); return <tr key={p.id}><td><PlayerLink playerId={p.id}>{p.name}</PlayerLink></td><td>{l.minutes.toFixed(1)}</td><td>{Math.round(l.energy)}%</td><td title={l.workloadQuality === 'ESTIMATED' ? 'Uppskattad (målvakt: nettoförlust av energi, ett minimivärde)' : undefined}>{l.workload === undefined ? '—' : `${l.workloadQuality === 'ESTIMATED' ? '≈' : ''}${Math.round(l.workload)}`}</td><td>{week.complete ? Math.round(week.total) : '—'}</td></tr>; })}</tbody></table></details></div>;

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      {replay.error && <div role="alert"><p>{replay.error}</p><button className="hm-btn" onClick={replay.retry}>Försök igen</button></div>}
      <PageHeading eyebrow={fixture.date} title="Matchrapport" description="Slutsignalen har gått. Resultatet, spelarna och nästa steg i säsongen." />
      <MatchHero career={career} fixture={fixture} result={result} context="SLUTRESULTAT">
        {career.matchArchiveIds?.includes(fixture.id) && <button className="hm-btn" onClick={() => router.push(`/career/match-day/${fixture.id}`)}>Se matchrepris</button>}
        <button className="hm-btn hm-btn-primary" onClick={() => router.push(`/career/competitions/${fixture.competitionId}`)}>Tabell & liga →</button>
      </MatchHero>
      <MatchAftermathPanel fixtureId={fixture.id} />
      <MatchContext fixture={fixture} postMatch /><MatchTimeline result={result} />
      <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <StatsPanel title={home.name} stats={result.homeStats} />
        <StatsPanel title={away.name} stats={result.awayStats} />
      </div>

      <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <PlayerRatingsPanel title={home.shortName} contributions={result.homePlayerContributions} bestPerformerId={bestPerformer?.playerId} career={career} />
        <PlayerRatingsPanel title={away.shortName} contributions={result.awayPlayerContributions} bestPerformerId={bestPerformer?.playerId} career={career} />
      </div>

      <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Bästa spelare</span>
          </div>
          <div className="hm-panel-body">
            {bestPerformer ? (
              <>
                <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>
                  <PlayerLink playerId={bestPerformer.playerId}>
                    {getCareerPlayer(career, bestPerformer.playerId)?.firstName} {getCareerPlayer(career, bestPerformer.playerId)?.lastName}
                  </PlayerLink>
                </div>
                <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
                  Betyg {bestPerformer.rating.toFixed(1)} · {bestPerformer.goals} mål
                </div>
              </>
            ) : (
              <span className="hm-text-muted">—</span>
            )}
          </div>
        </div>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Tabellplacering</span>
          </div>
          <div className="hm-panel-body">
            <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{svOrdinal(position)} plats</div>
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>{competitionName} · nuvarande tabell</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
        <button type="button" className="hm-btn" onClick={() => router.push("/career/schedule")}>
          ← Schema
        </button>
        {isCurrentLastMatch ? (
          <button type="button" className="hm-btn" onClick={() => router.push("/career/analysis/last-match")}>
            Öppna matchanalys
          </button>
        ) : null}
        <button type="button" className="hm-btn hm-btn-primary" onClick={() => router.push("/career")}>
          FORTSÄTT →
        </button>
      </div>
    </div>
  );
}

/**
 * HM-MATCH-0.2: player ratings for ONE team -- used for both home and
 * away so Match Report shows both teams consistently, mirroring
 * Live Match's own PlayerStatsPanel. If `contributions` is empty (no
 * roster was available when this fixture was simulated), says so
 * honestly instead of an empty table.
 */
function PlayerRatingsPanel({
  title,
  contributions,
  bestPerformerId,
  career,
}: {
  title: string;
  contributions: readonly PlayerMatchContribution[];
  bestPerformerId: string | undefined;
  career: CareerState;
}) {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">{title} — spelarbetyg</span>
      </div>
      {contributions.length === 0 ? (
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          Ingen spelartrupp tillgänglig för denna match.
        </div>
      ) : (
        <table className="hm-table">
          <thead>
            <tr>
              <th>Spelare</th>
              <th className="hm-table-num">Mål</th>
              <th className="hm-table-num">Skott</th>
              <th className="hm-table-num">Betyg</th>
            </tr>
          </thead>
          <tbody>
            {contributions.map((c) => {
              const player = getCareerPlayer(career, c.playerId);
              return (
                <tr key={c.playerId} data-highlight={c.playerId === bestPerformerId}>
                  <td className="hm-td-strong">
                    {player ? <PlayerLink playerId={c.playerId}>{`${player.firstName} ${player.lastName}`}</PlayerLink> : c.playerId}
                  </td>
                  <td className="hm-table-num">{c.goals}</td>
                  <td className="hm-table-num">{c.shots}</td>
                  <td className="hm-table-num hm-td-strong">{c.rating.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatsPanel({ title, stats }: { title: string; stats: import("@handball-manager/game-simulation").TeamMatchStats }) {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">{title}</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <StatRow label="Skott" value={`${stats.goals}/${stats.shots} (${stats.shootingPct}%)`} />
        <StatRow label="Räddningar" value={`${stats.saves}/${stats.shotsFaced}`} />
        {/* HM-PLAYTEST-01 7.3: this is every attack that ended without a shot -- not only technical faults. */}
        <StatRow label="Bollförluster" value={String(stats.turnovers)} title="Anfall som slutade utan avslut: tekniska fel (steg, regelbrott), tappade bollar och felpassningar, offensiva frislag, passivt spel och brytningar." />
        <StatRow label="Utvisningar (2 min)" value={String(stats.twoMinuteSuspensions)} />
        <StatRow label="7-meter" value={`${stats.sevenMetreGoals}/${stats.sevenMetreAttempts}`} />
      </div>
    </div>
  );
}

function StatRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div title={title} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
