'use client';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getLiveStandings } from '@/lib/career/standings';
import { getClub } from '@/lib/game-data';
import { ClubLink } from '@/components/entityLinks';
import { PageHeading, Panel } from '@/components/manager/Workspace';
import StatisticsTable from '@/components/manager/StatisticsTable';
export default function StatisticsPage() {
  const { career } = useCareer();
  const table = getLiveStandings(career);
  return <><PageHeading eyebrow={career.seasonId} title="Statistik" description="Mål, skott, målvakter och lagens resultat. Procenttal visas med sitt underlag." actions={<Link className="hm-btn" href="/career/history">Tidigare säsonger →</Link>} /><div className="hm-stack"><Panel title="Spelarranking"><StatisticsTable competitionId={career.competitionId} /></Panel><Panel title="Lag · anfall & försvar"><table className="hm-table"><thead><tr><th>Klubb</th><th>Matcher</th><th>Gjorda mål</th><th>Insläppta</th><th>Gjorda / match</th><th>Insläppta / match</th><th>Poäng</th></tr></thead><tbody>{[...table].sort((a,b) => b.goalsFor-a.goalsFor).map(r => <tr key={r.clubId}><td><ClubLink clubId={r.clubId}>{getClub(r.clubId)?.name ?? r.clubId}</ClubLink></td><td>{r.played}</td><td>{r.goalsFor}</td><td>{r.goalsAgainst}</td><td>{r.played ? (r.goalsFor/r.played).toFixed(1) : '—'}</td><td>{r.played ? (r.goalsAgainst/r.played).toFixed(1) : '—'}</td><td>{r.points}</td></tr>)}</tbody></table></Panel></div></>;
}
