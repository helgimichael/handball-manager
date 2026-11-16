'use client';
// Arena Nights -- CMP-04 A "Leaderboards by position": competition switcher -> position leader grid -> full
// ranking (shared with the competition centre's Statistik tab, CMP-01d) -> team attack & defence table.
import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { getClub, COMPETITIONS } from '@/lib/game-data';
import { competitionTable, hasLeagueCalendar } from '@/lib/competition/tables';
import { ClubLink } from '@/components/entityLinks';
import { EmptyState, PageHeading, Panel } from '@/components/manager/Workspace';
import CompetitionStats from '@/components/manager/CompetitionStats';
import { RankIndicator } from '@/components/game/Identity';
import ClubCrest from '@/components/ClubCrest';

export default function StatisticsPage() {
  return <Suspense fallback={<EmptyState>Läser statistiken…</EmptyState>}><Statistics /></Suspense>;
}

function Statistics() {
  const { career } = useCareer();
  const router = useRouter();
  const requested = useSearchParams().get('competition');
  const simulated = COMPETITIONS.filter(c => hasLeagueCalendar(career, c.id));
  const competitionId = requested && simulated.some(c => c.id === requested) ? requested : career.competitionId;
  const competition = COMPETITIONS.find(c => c.id === competitionId);
  const table = useMemo(() => competitionTable(career, competitionId), [career, competitionId]);
  return <div className="hm-statistics-screen cc-page">
    <PageHeading eyebrow={`${career.seasonId} / ligornas prestationer`} title="Statistik" description="Ledare per position och hela spelarrankingen. Varje procenttal har ett underlag." actions={<Link className="hm-btn" href="/career/history">Tidigare säsonger →</Link>} />
    <div className="cc-head-tools cc-stat-switch">
      <label className="cc-switch">Tävling<select className="hm-select" value={competitionId} onChange={e => router.replace(`/career/statistics?competition=${encodeURIComponent(e.target.value)}`, { scroll: false })}>{simulated.map(c => <option key={c.id} value={c.id}>{c.name}{c.id === career.competitionId ? ' · din liga' : ''}</option>)}</select></label>
      <Link href={`/career/competitions/${encodeURIComponent(competitionId)}?tab=table`}>{competition?.name ?? 'Tävlingen'}: tabellen →</Link>
    </div>
    <CompetitionStats competitionId={competitionId} />
    <Panel title="Lag · anfall & försvar"><div className="hm-scroll-x"><table className="hm-table cc-table"><thead><tr><th>Rank · mål</th><th>Klubb</th><th className="cc-num">Matcher</th><th className="cc-num">Gjorda mål</th><th className="cc-num">Insläppta</th><th className="cc-num">Gjorda / match</th><th className="cc-num">Insläppta / match</th><th className="cc-num">Poäng</th></tr></thead><tbody>{[...table].sort((a, b) => b.goalsFor - a.goalsFor).map((r, i) => <tr key={r.clubId} data-highlight={r.clubId === career.playerClubId || undefined}><td><RankIndicator position={i + 1} /></td><td><div className="hm-stat-club"><ClubCrest shortName={getClub(r.clubId)?.shortName ?? r.clubId} primaryColor="var(--hm-text-primary)" clubId={r.clubId} size={25} /><ClubLink clubId={r.clubId} showCrest={false}>{getClub(r.clubId)?.name ?? r.clubId}</ClubLink></div></td><td className="cc-num">{r.played}</td><td className="cc-num hm-stat-emphasis">{r.goalsFor}</td><td className="cc-num">{r.goalsAgainst}</td><td className="cc-num">{r.played ? (r.goalsFor / r.played).toFixed(1) : '—'}</td><td className="cc-num">{r.played ? (r.goalsAgainst / r.played).toFixed(1) : '—'}</td><td className="cc-num">{r.points}</td></tr>)}</tbody></table></div>{!table.length && <EmptyState>Tävlingen har ingen tabell ännu.</EmptyState>}</Panel>
  </div>;
}
