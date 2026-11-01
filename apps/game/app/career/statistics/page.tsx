'use client';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getLiveStandings } from '@/lib/career/standings';
import { getClub } from '@/lib/game-data';
import { ClubLink } from '@/components/entityLinks';
import { PageHeading, Panel } from '@/components/manager/Workspace';
import StatisticsTable from '@/components/manager/StatisticsTable';
import { averageRating } from '@/lib/career/types';
import { managementPlayers } from '@/lib/career/management';
import { PlayerCell, RankIndicator } from '@/components/game/Identity';
import ClubCrest from '@/components/ClubCrest';
export default function StatisticsPage() {
  const { career } = useCareer();
  const table = getLiveStandings(career);
  const index = new Map(managementPlayers(career).map(player => [player.id, player]));
  const recorded = Object.values(career.playerSeasonStats).filter(stats => stats.appearances > 0 && getClub(index.get(stats.playerId)?.clubId ?? '')?.competitionId === career.competitionId);
  const leaders = [
    { label: 'Flest mål', unit: 'mål', stats: [...recorded].sort((a, b) => b.goals - a.goals || b.appearances - a.appearances)[0], value: (stats: typeof recorded[number]) => stats.goals },
    { label: 'Flest räddningar', unit: 'räddningar', stats: [...recorded].filter(stats => index.get(stats.playerId)?.position === 'MV').sort((a, b) => b.saves - a.saves || b.shotsFaced - a.shotsFaced)[0], value: (stats: typeof recorded[number]) => stats.saves },
    { label: 'Högst snittbetyg', unit: 'snittbetyg', stats: [...recorded].sort((a, b) => averageRating(b) - averageRating(a) || b.appearances - a.appearances)[0], value: (stats: typeof recorded[number]) => averageRating(stats).toFixed(1) },
  ];
  return <div className="hm-statistics-screen"><PageHeading eyebrow={`${career.seasonId} / ligans prestationer`} title="Statistik" description="Målskyttar, matchvinnare och målvakter. Varje procenttal har ett underlag." actions={<Link className="hm-btn" href="/career/history">Tidigare säsonger →</Link>} />
    <div className="hm-leader-strip" aria-label="Säsongens statistikledare">{leaders.map(leader => <article key={leader.label}><div className="hm-eyebrow">{leader.label}</div>{leader.stats && index.get(leader.stats.playerId) ? <><div className="hm-leader-number"><strong>{leader.value(leader.stats)}</strong><span>{leader.unit}</span></div><PlayerCell player={index.get(leader.stats.playerId)!} /><p>{leader.stats.appearances} registrerade matcher{leader.unit === 'mål' ? ` · ${leader.stats.shots} skottförsök` : leader.unit === 'räddningar' ? ` · ${leader.stats.shotsFaced} mötta skott` : ''}</p></> : <><strong className="hm-leader-awaiting">Säsongen väntar</strong><p>Ledaren visas när matcher har registrerats.</p></>}</article>)}</div>
    <div className="hm-stack"><Panel title="Spelarranking"><StatisticsTable competitionId={career.competitionId} /></Panel><Panel title="Lag · anfall & försvar"><div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Rank · mål</th><th>Klubb</th><th>Matcher</th><th>Gjorda mål</th><th>Insläppta</th><th>Gjorda / match</th><th>Insläppta / match</th><th>Poäng</th></tr></thead><tbody>{[...table].sort((a,b) => b.goalsFor-a.goalsFor).map((r, i) => <tr key={r.clubId} data-highlight={r.clubId === career.playerClubId}><td><RankIndicator position={i + 1} /></td><td><div className="hm-stat-club"><ClubCrest shortName={getClub(r.clubId)?.shortName ?? r.clubId} primaryColor="var(--hm-text-primary)" clubId={r.clubId} size={25} /><ClubLink clubId={r.clubId}>{getClub(r.clubId)?.name ?? r.clubId}</ClubLink></div></td><td>{r.played}</td><td className="hm-stat-emphasis">{r.goalsFor}</td><td>{r.goalsAgainst}</td><td>{r.played ? (r.goalsFor/r.played).toFixed(1) : '—'}</td><td>{r.played ? (r.goalsAgainst/r.played).toFixed(1) : '—'}</td><td>{r.points}</td></tr>)}</tbody></table></div></Panel></div></div>;
}
