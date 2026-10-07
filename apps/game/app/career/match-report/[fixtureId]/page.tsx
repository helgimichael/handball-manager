"use client";
import MatchTimeline from '@/components/manager/MatchTimeline';
import MatchContext from "@/components/manager/MatchContext";

import { useParams, useRouter } from "next/navigation";
import { COMPETITIONS, getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { getLastPlayedPlayerFixture } from "@/lib/career/calendar";
import { getLiveStandings } from "@/lib/career/standings";
import type { CareerState } from "@/lib/career/types";
import type { PlayerMatchContribution } from "@handball-manager/game-simulation";
import ClubCrest from "@/components/ClubCrest";
import { ClubLink, PlayerLink } from "@/components/entityLinks";

export default function MatchReportPage() {
  const router = useRouter();
  const params = useParams<{ fixtureId: string }>();
  const { career } = useCareer();

  const fixture = career.fixtures.find((f) => f.id === params.fixtureId) ?? career.matchArchives?.[params.fixtureId]?.fixture;
  const result = career.results[params.fixtureId] ?? career.matchArchives?.[params.fixtureId]?.result;

  if (!fixture || !result) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Ingen matchrapport hittades för denna fixture.</div>
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

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Matchrapport</span>
          <span className="hm-badge hm-badge-neutral">
            {fixture.type === "LEAGUE" ? `${competitionName} · Omgång ${fixture.round}` : fixture.type === "CUP" ? "Cupmatch" : "Träningsmatch"}
          </span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, padding: "20px" }}>
          <TeamColumn clubId={home.id} />
          <div style={{ fontSize: "var(--hm-text-2xl)", fontWeight: 800 }}>
            {result.homeGoals} – {result.awayGoals}
          </div>
          <TeamColumn clubId={away.id} />
        </div>
      </div>

      <MatchContext fixture={fixture} postMatch /><MatchTimeline result={result} />
      <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <StatsPanel title={home.name} stats={result.homeStats} />
        <StatsPanel title={away.name} stats={result.awayStats} />
      </div>
      {career.matchArchives?.[params.fixtureId] && <div className="hm-panel"><div className="hm-panel-header"><strong>Speltid och belastning</strong><button className="hm-btn" onClick={() => router.push(`/career/match-day/${params.fixtureId}`)}>Se matchrepris</button></div><table className="hm-table"><thead><tr><th>Spelare</th><th>Minuter</th><th>Energi efter match</th></tr></thead><tbody>{career.matchArchives[params.fixtureId].people.filter(p => career.matchArchives![params.fixtureId].load[p.id].minutes > 0).map(p => <tr key={p.id}><td><PlayerLink playerId={p.id}>{p.name}</PlayerLink></td><td>{career.matchArchives![params.fixtureId].load[p.id].minutes.toFixed(1)}</td><td>{Math.round(career.matchArchives![params.fixtureId].load[p.id].energy)}%</td></tr>)}</tbody></table></div>}

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
            <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{position}:a plats</div>
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

function TeamColumn({ clubId }: { clubId: string }) {
  const c = getClub(clubId)!;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 140 }}>
      <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} size={48} />
      <div style={{ fontSize: "var(--hm-text-sm)", fontWeight: 800, textAlign: "center" }}>
        <ClubLink clubId={c.id}>{c.name}</ClubLink>
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
        <StatRow label="Tekniska fel" value={String(stats.turnovers)} />
        <StatRow label="Utvisningar (2 min)" value={String(stats.twoMinuteSuspensions)} />
        <StatRow label="7-meter" value={`${stats.sevenMetreGoals}/${stats.sevenMetreAttempts}`} />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
