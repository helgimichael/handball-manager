'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { ClubLink, PlayerLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';
import { PageHeading, Panel, EmptyState, FixtureTable } from '@/components/manager/Workspace';
import StatisticsTable from '@/components/manager/StatisticsTable';
import { formatEur } from '@/lib/economy/currency';
export default function HistoryPage() { return <Suspense fallback={<EmptyState>Läser historik…</EmptyState>}><History /></Suspense>; }
function History() {
  const { career } = useCareer();
  const params = useSearchParams();
  const seasons = [...career.seasonHistory ?? []].reverse();
  const season = seasons.find(s => s.seasonId === params.get('season')) ?? seasons[0];
  const archives = Object.values(career.matchArchives ?? {}).sort((a,b) => b.fixture.date.localeCompare(a.fixture.date));
  const offers = Object.values(career.transferOffers).filter(o => o.status === 'COMPLETED').reverse();
  return <><PageHeading eyebrow="Managerkarriär" title="Historik" description={`${seasons.length} avslutade säsonger · ${archives.length} bevarade spelade matcher · ${offers.length} genomförda övergångar i karriärvärlden.`} />
    <nav className="hm-tabs" aria-label="Historiska säsonger">{seasons.map(s => <Link key={s.seasonId} aria-current={season?.seasonId === s.seasonId ? 'page' : undefined} href={`/career/history?season=${encodeURIComponent(s.seasonId)}`}>{s.seasonId}</Link>)}</nav>
    <div className="hm-stack">{season ? <><Panel title={`${season.seasonId} · Sluttabell`}><table className="hm-table"><thead><tr><th>#</th><th>Klubb</th><th>Matcher</th><th>V / O / F</th><th>GM / IM</th><th>MSK</th><th>Poäng</th></tr></thead><tbody>{season.table.map((r,i) => <tr key={r.clubId} data-highlight={r.clubId === career.playerClubId}><td>{i+1}</td><td><ClubLink clubId={r.clubId}>{getClub(r.clubId)?.name ?? r.clubId}</ClubLink></td><td>{r.played}</td><td>{r.won} / {r.drawn} / {r.lost}</td><td>{r.goalsFor} / {r.goalsAgainst}</td><td>{r.goalDifference}</td><td>{r.points}</td></tr>)}</tbody></table></Panel><Panel title={`${season.seasonId} · Spelarstatistik`}><StatisticsTable key={season.seasonId} competitionId={season.competitionId} statistics={season.stats} /></Panel></> : <Panel title="Säsongsarkiv"><EmptyState>Din första säsong pågår. Sluttabell och spelarstatistik bevaras när du börjar nästa säsong.</EmptyState></Panel>}
    <Panel title="Spelade matcharkiv"><FixtureTable career={career} fixtures={archives.map(a => a.fixture)} /></Panel>
    <Panel title="Genomförda övergångar"><div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Datum</th><th>Spelare</th><th>Från</th><th>Till</th><th>Summa</th><th>Typ</th></tr></thead><tbody>{offers.map(o => <tr key={o.id}><td>{o.offeredDate}</td><td><PlayerLink playerId={o.playerId}>{Object.values(career.worldSquads).flat().find(p => p.id === o.playerId)?.lastName ?? o.playerId}</PlayerLink></td><td>{o.fromClubId ? <ClubLink clubId={o.fromClubId}>{getClub(o.fromClubId)?.name ?? o.fromClubId}</ClubLink> : 'Fri agent'}</td><td><ClubLink clubId={o.toClubId}>{getClub(o.toClubId)?.name ?? o.toClubId}</ClubLink></td><td>{formatEur(o.transferFeeEur)}</td><td>{o.dealType === 'LOAN' ? 'Lån' : 'Permanent'}</td></tr>)}</tbody></table></div>{!offers.length && <EmptyState>Inga genomförda övergångar ännu.</EmptyState>}</Panel></div>
  </>;
}
