"use client";
import Link from 'next/link';
import { MatchHero, PlayerCell } from '@/components/game/Identity';
import { ArchiveReplay } from '@/components/ProductionMatchView';
import { useMatchArchive } from '@/lib/save/useMatchArchive';
import { careerArchiveSummaries } from '@/lib/career/matchArchiveSummary';
import { PageHeading } from '@/components/manager/Workspace';
import MatchTimeline from '@/components/manager/MatchTimeline';
import MatchContext from "@/components/manager/MatchContext";
import { MatchAftermathPanel } from "@/components/matchday/Matchday";
import { PostMatchPressBanner } from "@/components/media/PostMatchPressBanner";
import ClubCrest from "@/components/ClubCrest";

import { useParams, useRouter } from "next/navigation";
import { COMPETITIONS, getClub } from "@/lib/game-data";

type ClubData = NonNullable<ReturnType<typeof getClub>>;
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { getLastPlayedPlayerFixture } from "@/lib/career/calendar";
import { getLiveStandings } from "@/lib/career/standings";
import { workloadWindow } from "@/lib/training/workloadLedger";
import type { CareerState } from "@/lib/career/types";
import type { PlayerMatchContribution, TeamMatchStats } from "@handball-manager/game-simulation";
import { PlayerLink } from "@/components/entityLinks";
import { svOrdinal } from "@/lib/format/ordinal";

export default function MatchReportPage() {
  const router = useRouter();
  const params = useParams<{ fixtureId: string }>();
  const { career, updateCareer } = useCareer();
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
  const bestPerformer = [...result.homePlayerContributions, ...result.awayPlayerContributions].sort((a, b) => b.rating - a.rating)[0];

  const table = getLiveStandings(career);
  const position = table.findIndex((row) => row.clubId === career.playerClubId) + 1;
  const competitionName = COMPETITIONS.find((c) => c.id === career.competitionId)?.name ?? "Ligan";
  const isCurrentLastMatch = getLastPlayedPlayerFixture(career)?.fixture.id === fixture.id;
  const managerTeam = fixture.homeClubId === career.playerClubId ? 'HOME' : 'AWAY';
  const isCup = fixture.type === 'CUP' || fixture.competitionId === 'se-svenska-cupen-herr' || fixture.competitionId.toLowerCase().includes('cup');
  const pressId = `press:post:${fixture.id}`;
  const hasOpenPress = career.media?.press?.[pressId]?.status === 'OPEN';

  if (archive) {
    return (
      <div className="mc-report-page">
        <PageHeading eyebrow={fixture.date} title="Matchrapport" description="Resultatet, prestationerna och de avgörande ögonblicken." />
        <ArchiveReplay archive={archive} />
        <HeadToHeadStatsComparison home={home} away={away} homeStats={result.homeStats} awayStats={result.awayStats} />
        <MatchAftermathPanel fixtureId={fixture.id} />
        <PostMatchPressBanner fixture={fixture} result={result} career={career} updateCareer={updateCareer} />
        <div className="mc-report-actions">
          <button type="button" className="hm-btn" onClick={() => router.push('/career/schedule')}>← Schema</button>
          <button type="button" className="hm-btn" onClick={() => router.push(`/career/match-day/${fixture.id}`)}>Se matchrepris</button>
          {isCurrentLastMatch && <button type="button" className="hm-btn" onClick={() => router.push('/career/analysis/last-match')}>Öppna matchanalys</button>}
          <Link className="hm-btn" href={`/career/competitions/${encodeURIComponent(fixture.competitionId)}`}>
            {isCup ? 'Svenska Cupen →' : 'Tabell & liga →'}
          </Link>
          {hasOpenPress && (
            <button type="button" className="hm-btn hm-btn-primary" onClick={() => router.push(`/career/media/press/${encodeURIComponent(pressId)}`)}>
              🎤 Möt pressen →
            </button>
          )}
          <button type="button" className="hm-btn hm-btn-primary" onClick={() => router.push('/career')}>Fortsätt →</button>
        </div>
        <details className="hm-panel" open>
          <summary className="hm-panel-header"><strong>Speltid och belastning</strong></summary>
          <table className="hm-table">
            <thead>
              <tr>
                <th>Spelare</th>
                <th>Minuter</th>
                <th>Energi efter match</th>
                <th title="Belastningspoäng: den energi matchen krävde (samma enhet som träning).">Matchbelastning</th>
                <th title="Match + träning de senaste 7 dagarna, när hela perioden är registrerad.">Senaste 7 dagar</th>
              </tr>
            </thead>
            <tbody>
              {archive.people.filter(p => (archive.load[p.id]?.minutes ?? 0) > 0).map(p => {
                const l = archive.load[p.id];
                const week = workloadWindow(career.workloadLedger, p.id, fixture.date, 7, p.team === managerTeam);
                const fullPlayer = getCareerPlayer(career, p.id);
                return (
                  <tr key={p.id}>
                    <td>{fullPlayer ? <PlayerCell player={fullPlayer} /> : <PlayerLink playerId={p.id}>{p.name}</PlayerLink>}</td>
                    <td>{l.minutes.toFixed(1)}</td>
                    <td>{Math.round(l.energy)}%</td>
                    <td title={l.workloadQuality === 'ESTIMATED' ? 'Uppskattad (målvakt: nettoförlust av energi, ett minimivärde)' : undefined}>
                      {l.workload === undefined ? '—' : `${l.workloadQuality === 'ESTIMATED' ? '≈' : ''}${Math.round(l.workload)}`}
                    </td>
                    <td>{week.complete ? Math.round(week.total) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      </div>
    );
  }

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      {replay.error && <div role="alert"><p>{replay.error}</p><button className="hm-btn" onClick={replay.retry}>Försök igen</button></div>}
      <PageHeading eyebrow={fixture.date} title="Matchrapport" description="Slutsignalen har gått. Resultatet, spelarna och nästa steg i säsongen." />
      <MatchHero career={career} fixture={fixture} result={result} context="SLUTRESULTAT">
        {career.matchArchiveIds?.includes(fixture.id) && <button className="hm-btn" onClick={() => router.push(`/career/match-day/${fixture.id}`)}>Se matchrepris</button>}
        <button className="hm-btn hm-btn-primary" onClick={() => router.push(`/career/competitions/${fixture.competitionId}`)}>Tabell & liga →</button>
      </MatchHero>
      <HeadToHeadStatsComparison home={home} away={away} homeStats={result.homeStats} awayStats={result.awayStats} />
      <MatchAftermathPanel fixtureId={fixture.id} />
      <PostMatchPressBanner fixture={fixture} result={result} career={career} updateCareer={updateCareer} />
      <MatchContext fixture={fixture} postMatch />
      <MatchTimeline result={result} />
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
                  {getCareerPlayer(career, bestPerformer.playerId) ? (
                    <PlayerCell player={getCareerPlayer(career, bestPerformer.playerId)!} />
                  ) : (
                    <PlayerLink playerId={bestPerformer.playerId}>{bestPerformer.playerId}</PlayerLink>
                  )}
                </div>
                <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)", marginTop: 6 }}>
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

function HeadToHeadStatsComparison({
  home,
  away,
  homeStats,
  awayStats,
}: {
  home: ClubData;
  away: ClubData;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
}) {
  const rows = [
    { label: "Mål / skott", homeVal: homeStats.goals, awayVal: awayStats.goals, homeLabel: `${homeStats.goals}/${homeStats.shots} (${homeStats.shootingPct}%)`, awayLabel: `${awayStats.goals}/${awayStats.shots} (${awayStats.shootingPct}%)` },
    { label: "Målvaktsräddningar", homeVal: homeStats.saves, awayVal: awayStats.saves, homeLabel: `${homeStats.saves}/${homeStats.shotsFaced}`, awayLabel: `${awayStats.saves}/${awayStats.shotsFaced}` },
    { label: "7-meterskast", homeVal: homeStats.sevenMetreGoals, awayVal: awayStats.sevenMetreGoals, homeLabel: `${homeStats.sevenMetreGoals}/${homeStats.sevenMetreAttempts}`, awayLabel: `${awayStats.sevenMetreGoals}/${awayStats.sevenMetreAttempts}` },
    { label: "Utvisningar (2 min)", homeVal: homeStats.twoMinuteSuspensions, awayVal: awayStats.twoMinuteSuspensions, homeLabel: String(homeStats.twoMinuteSuspensions), awayLabel: String(awayStats.twoMinuteSuspensions) },
    { label: "Bollförluster", homeVal: homeStats.turnovers, awayVal: awayStats.turnovers, homeLabel: String(homeStats.turnovers), awayLabel: String(awayStats.turnovers) },
  ];

  return (
    <section className="hm-panel hm-h2h-stats" aria-label="Lagjämförelse">
      <div className="hm-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
          <ClubCrest clubId={home.id} shortName={home.shortName} primaryColor={home.primaryColor} size={26} />
          {home.shortName}
        </span>
        <span className="hm-panel-title">Matchstatistik · Jämförelse</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
          {away.shortName}
          <ClubCrest clubId={away.id} shortName={away.shortName} primaryColor={away.primaryColor} size={26} />
        </span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => {
          const total = Math.max(1, r.homeVal + r.awayVal);
          const homePct = Math.round((r.homeVal / total) * 100);
          const awayPct = 100 - homePct;
          return (
            <div key={r.label} className="hm-h2h-row">
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)", marginBottom: 4 }}>
                <strong>{r.homeLabel}</strong>
                <span className="hm-text-muted">{r.label}</span>
                <strong>{r.awayLabel}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `${homePct}fr ${awayPct}fr`, gap: 4, height: 8, borderRadius: 999, overflow: "hidden", background: "var(--hm-surface-3)" }}>
                <span style={{ background: home.primaryColor || "var(--hm-accent)", borderRadius: "999px 0 0 999px" }} />
                <span style={{ background: away.primaryColor || "#60a5fa", borderRadius: "0 999px 999px 0" }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

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
                    {player ? <PlayerCell player={player} /> : c.playerId}
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

function StatsPanel({ title, stats }: { title: string; stats: TeamMatchStats }) {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">{title}</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <StatRow label="Skott" value={`${stats.goals}/${stats.shots} (${stats.shootingPct}%)`} />
        <StatRow label="Räddningar" value={`${stats.saves}/${stats.shotsFaced}`} />
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
