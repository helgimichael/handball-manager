'use client';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { playerMatchHistory, squadEnergy } from '@/lib/career/management';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { averageRating } from '@/lib/career/types';
import { ClubLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';
import { Panel, EmptyState } from './Workspace';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
export default function PlayerPerformance({ playerId }: { playerId: string }) {
  const { career } = useCareer();
  const player = getCareerPlayer(career, playerId);
  if (!player) return null;
  const matches = playerMatchHistory(career, playerId).slice(0, 12);
  const seasons = (career.seasonHistory ?? []).filter(s => s.stats[playerId]?.appearances);
  const stats = career.playerSeasonStats[playerId];
  const own = player.clubId === career.playerClubId;
  return <div className="hm-stack">
    <Panel title="Säsongsprestation"><div className="hm-summary-strip"><div><small>Matcher / starter</small><strong>{stats?.appearances ?? 0} <span>/ {stats?.starts ?? 0}</span></strong></div><div><small>Mål / skott</small><strong>{stats?.goals ?? 0} <span>/ {stats?.shots ?? 0}</span></strong></div><div><small>{player.position === 'MV' ? 'Räddningar' : 'Skotteffektivitet'}</small><strong>{player.position === 'MV' ? stats?.shotsFaced ? `${Math.round(stats.saves / stats.shotsFaced * 100)}%` : '—' : stats?.shots ? `${Math.round(stats.goals / stats.shots * 100)}%` : '—'}</strong></div><div><small>Snittbetyg</small><strong>{stats?.appearances ? averageRating(stats).toFixed(1) : '—'}</strong></div>{own && <div><small>Energi nu</small><strong>{Math.round(squadEnergy(career, player))}%</strong></div>}</div></Panel>
    <Panel title="Senaste matcherna"><div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Datum</th><th>Match</th><th>Resultat</th><th>Start</th><th>Min</th><th>Mål / skott</th><th>Räddningar</th><th>Betyg</th></tr></thead><tbody>{matches.map(m => <tr key={m.fixture.id}><td>{m.fixture.date}</td><td><ClubLink clubId={m.fixture.homeClubId}>{getClub(m.fixture.homeClubId)?.shortName ?? '—'}</ClubLink> – <ClubLink clubId={m.fixture.awayClubId}>{getClub(m.fixture.awayClubId)?.shortName ?? '—'}</ClubLink></td><td><Link className="hm-result-link" href={matchReportHref(m.fixture.id)}>{m.result.homeGoals}–{m.result.awayGoals}</Link></td><td>{m.performance.started ? 'Ja' : 'Nej'}</td><td>{m.load?.minutes.toFixed(1) ?? '—'}</td><td>{m.performance.goals} / {m.performance.shots}</td><td>{m.performance.shotsFaced ? `${m.performance.saves ?? 0}/${m.performance.shotsFaced}` : '—'}</td><td>{m.performance.rating.toFixed(1)}</td></tr>)}</tbody></table></div>{!matches.length && <EmptyState>Ingen registrerad matchprestation ännu. Speltid visas när matcharkivet innehåller den.</EmptyState>}</Panel>
    <Panel title="Säsongshistorik">{seasons.length ? <table className="hm-table"><thead><tr><th>Säsong</th><th>Matcher</th><th>Starter</th><th>Mål / skott</th><th>Räddningar / mötta</th><th>Snittbetyg</th></tr></thead><tbody>{[...seasons].reverse().map(s => { const st = s.stats[playerId]; return <tr key={s.seasonId}><td><Link href={`/career/history?season=${encodeURIComponent(s.seasonId)}`}>{s.seasonId}</Link></td><td>{st.appearances}</td><td>{st.starts}</td><td>{st.goals}/{st.shots}</td><td>{st.saves}/{st.shotsFaced}</td><td>{averageRating(st).toFixed(1)}</td></tr>; })}</tbody></table> : <EmptyState>Tidigare säsonger blir tillgängliga efter ett säsongsavslut. Ingen historisk matchstatistik har skapats i förväg.</EmptyState>}</Panel>
  </div>;
}
