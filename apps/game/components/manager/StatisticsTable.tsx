'use client';
import { useMemo, useState, useCallback } from 'react';
import { useCareer } from '@/lib/career/CareerContext';
import { managementPlayers } from '@/lib/career/management';
import { averageRating, type PlayerSeasonStats } from '@/lib/career/types';
import { PlayerLink, ClubLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';
import { EmptyState } from './Workspace';
type Metric = 'goals' | 'appearances' | 'shooting' | 'saves' | 'saving' | 'rating';
export default function StatisticsTable({ competitionId, statistics }: { competitionId: string; statistics?: Record<string, PlayerSeasonStats> }) {
  const { career } = useCareer();
  const [metric, setMetric] = useState<Metric>('goals');
  const [minimum, setMinimum] = useState(10);
  const stats = statistics ?? career.playerSeasonStats;
  const index = useMemo(() => new Map(managementPlayers(career).map(p => [p.id,p])), [career]);
  const score = useCallback((s: PlayerSeasonStats) => metric === 'shooting' ? s.goals/s.shots : metric === 'saving' ? s.saves/s.shotsFaced : metric === 'rating' ? averageRating(s) : s[metric], [metric]);
  const rows = useMemo(() => Object.values(stats).filter(s => {
    const player = index.get(s.playerId);
    // Historical stats belong to this archived competition, regardless of current club.
    if (!player || (!statistics && getClub(player.clubId)?.competitionId !== competitionId) || !s.appearances) return false;
    if (metric === 'shooting') return player.position !== 'MV' && s.shots >= Math.max(1, minimum);
    if (metric === 'saving') return player.position === 'MV' && s.shotsFaced >= Math.max(1, minimum);
    if (metric === 'saves') return player.position === 'MV';
    return true;
  }).sort((a,b) => score(b) - score(a) || b.appearances - a.appearances).slice(0,100), [stats, index, statistics, competitionId, metric, minimum, score]);
  return <><div className="hm-filter-bar"><label>Ranking<select className="hm-select" value={metric} onChange={e => setMetric(e.target.value as Metric)}><option value="goals">Mål</option><option value="appearances">Matcher</option><option value="shooting">Skotteffektivitet</option><option value="saves">Räddningar</option><option value="saving">Räddningsprocent</option><option value="rating">Snittbetyg</option></select></label>{(metric === 'shooting' || metric === 'saving') && <label>Minst antal skott<input type="number" className="hm-input hm-input-small" min="1" value={minimum} onChange={e => setMinimum(Number(e.target.value))} /></label>}<span>Statistik från registrerade matcher · högst 100 spelare</span></div>
    <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>#</th><th>Spelare</th><th>Nuvarande klubb</th><th>Pos</th><th>Matcher</th><th>Starter</th><th>Mål</th><th>Skott</th><th>Skott %</th><th>Räddningar / mötta</th><th>Räddning %</th><th>Betyg</th></tr></thead><tbody>{rows.map((s,i) => { const p = index.get(s.playerId)!; return <tr key={p.id}><td>{i+1}</td><td><PlayerLink playerId={p.id}>{p.firstName} {p.lastName}</PlayerLink></td><td>{p.clubId ? <ClubLink clubId={p.clubId}>{getClub(p.clubId)?.shortName ?? p.clubId}</ClubLink> : 'Fri agent'}</td><td>{p.position}</td><td>{s.appearances}</td><td>{s.starts}</td><td>{s.goals}</td><td>{s.shots}</td><td>{s.shots ? `${Math.round(s.goals/s.shots*100)}%` : '—'}</td><td>{s.shotsFaced ? `${s.saves}/${s.shotsFaced}` : '—'}</td><td>{s.shotsFaced ? `${Math.round(s.saves/s.shotsFaced*100)}%` : '—'}</td><td>{averageRating(s).toFixed(1)}</td></tr>; })}</tbody></table></div>{!rows.length && <EmptyState>Ingen statistik med tillräckligt underlag i denna vy.</EmptyState>}</>;
}
