'use client';
// CMP-04 / CMP-01d: the one player ranking table -- metric, minimum sample and position filter -- shared by
// /career/statistics, the competition centre's Statistik tab and the season archive.
import { useMemo, useState } from 'react';
import { useCareer } from '@/lib/career/CareerContext';
import { averageRating, type PlayerSeasonStats } from '@/lib/career/types';
import { PlayerLink, ClubLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';
import { playerIndex, rankPlayers, STAT_METRICS, STAT_POSITIONS, POSITION_LABEL, type StatMetric } from '@/lib/competition/leaderboards';
import { EmptyState } from './Workspace';

export default function StatisticsTable({ competitionId, statistics }: { competitionId: string; statistics?: Record<string, PlayerSeasonStats> }) {
  const { career } = useCareer();
  const [metric, setMetric] = useState<StatMetric>('goals');
  const [minimum, setMinimum] = useState(10);
  const [position, setPosition] = useState('ALL');
  const index = useMemo(() => playerIndex(career), [career]);
  const rows = useMemo(() => rankPlayers(career, competitionId, { metric, minimum, position }, statistics, index), [career, competitionId, metric, minimum, position, statistics, index]);
  return <><div className="hm-filter-bar">
      <label>Ranking<select className="hm-select" value={metric} onChange={e => setMetric(e.target.value as StatMetric)}>{STAT_METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      <label>Position<select className="hm-select" value={position} onChange={e => setPosition(e.target.value)}><option value="ALL">Alla positioner</option>{STAT_POSITIONS.map(p => <option key={p} value={p}>{POSITION_LABEL[p]} · {p}</option>)}</select></label>
      {(metric === 'shooting' || metric === 'saving') && <label>Minst antal skott<input type="number" className="hm-input hm-input-small" min="1" value={minimum} onChange={e => setMinimum(Number(e.target.value))} /></label>}
      <span>Statistik från registrerade matcher · högst 100 spelare</span>
    </div>
    <div className="hm-scroll-x"><table className="hm-table cc-stats-table"><thead><tr><th>#</th><th>Spelare</th><th>Nuvarande klubb</th><th>Pos</th><th className="hm-table-num">Matcher</th><th className="hm-table-num">Starter</th><th className="hm-table-num">Mål</th><th className="hm-table-num">Skott</th><th className="hm-table-num">Skott %</th><th className="hm-table-num">Räddningar / mötta</th><th className="hm-table-num">Räddning %</th><th className="hm-table-num">Betyg</th></tr></thead><tbody>{rows.map(({ player: p, stats: s }, i) => <tr key={p.id} data-highlight={p.clubId === career.playerClubId || undefined}><td>{i + 1}</td><td><PlayerLink playerId={p.id}>{p.firstName} {p.lastName}</PlayerLink></td><td>{p.clubId ? <ClubLink clubId={p.clubId}>{getClub(p.clubId)?.shortName ?? p.clubId}</ClubLink> : 'Fri agent'}</td><td>{p.position}</td><td className="hm-table-num">{s.appearances}</td><td className="hm-table-num">{s.starts}</td><td className="hm-table-num">{s.goals}</td><td className="hm-table-num">{s.shots}</td><td className="hm-table-num">{s.shots ? `${Math.round(s.goals / s.shots * 100)}%` : '—'}</td><td className="hm-table-num">{s.shotsFaced ? `${s.saves}/${s.shotsFaced}` : '—'}</td><td className="hm-table-num">{s.shotsFaced ? `${Math.round(s.saves / s.shotsFaced * 100)}%` : '—'}</td><td className="hm-table-num">{averageRating(s).toFixed(1)}</td></tr>)}</tbody></table></div>{!rows.length && <EmptyState>Ingen statistik med tillräckligt underlag i denna vy. Sänk minimiunderlaget eller välj en annan position.</EmptyState>}</>;
}
