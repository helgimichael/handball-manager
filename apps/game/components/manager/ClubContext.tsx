'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getClub } from '@/lib/game-data';
import { managementPlayers } from '@/lib/career/management';
import { PlayerLink, ClubLink } from '@/components/entityLinks';
import { Panel, FixtureTable, EmptyState, CompetitionLink } from './Workspace';
import FormDots from '@/components/FormDots';
import { formatMoney } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
export default function ClubContext({ clubId }: { clubId: string }) {
  useMoney(); // re-render every figure when the display currency changes
  const { career } = useCareer();
  const [tab, setTab] = useState('results');
  const club = getClub(clubId);
  const index = new Map(managementPlayers(career).map(p => [p.id,p]));
  const matches = career.fixtures.filter(f => (f.homeClubId === clubId || f.awayClubId === clubId) && !!career.results[f.id]).sort((a,b) => b.date.localeCompare(a.date));
  const offers = Object.values(career.transferOffers).filter(o => o.status === 'COMPLETED' && (o.fromClubId === clubId || o.toClubId === clubId)).reverse();
  const seasons = career.seasonHistory?.filter(s => s.table.some(r => r.clubId === clubId)) ?? [];
  return <Panel title="Klubben i karriärvärlden" actions={club && <CompetitionLink id={club.competitionId}>Öppna tävlingen →</CompetitionLink>}>
    <nav className="hm-tabs" aria-label="Klubbkontext">{[['results','Resultat & form'],['transfers','Övergångar'],['history','Säsongshistorik']].map(([id,label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab === 'results' && <><div className="hm-filter-bar"><span>Senaste fem</span><FormDots results={(career.clubForm[clubId] ?? []).slice(-5)} /></div><FixtureTable career={career} fixtures={matches.slice(0,8)} /></>}
    {tab === 'transfers' && <><table className="hm-table"><thead><tr><th>Datum</th><th>Spelare</th><th>Från</th><th>Till</th><th>Summa</th></tr></thead><tbody>{offers.map(o => <tr key={o.id}><td>{o.offeredDate}</td><td><PlayerLink playerId={o.playerId}>{index.get(o.playerId)?.lastName ?? o.playerId}</PlayerLink></td><td>{o.fromClubId ? <ClubLink clubId={o.fromClubId}>{getClub(o.fromClubId)?.shortName ?? o.fromClubId}</ClubLink> : 'Fri agent'}</td><td><ClubLink clubId={o.toClubId}>{getClub(o.toClubId)?.shortName ?? o.toClubId}</ClubLink></td><td>{formatMoney(o.transferFeeEur)}</td></tr>)}</tbody></table>{!offers.length && <EmptyState>Inga genomförda övergångar för klubben.</EmptyState>}</>}
    {tab === 'history' && (seasons.length ? <table className="hm-table"><thead><tr><th>Säsong</th><th>Placering</th><th>Poäng</th><th>Målskillnad</th></tr></thead><tbody>{seasons.map(s => { const row = s.table.find(r => r.clubId === clubId)!; return <tr key={s.seasonId}><td><Link href={`/career/history?season=${encodeURIComponent(s.seasonId)}`}>{s.seasonId}</Link></td><td>{s.table.indexOf(row)+1}</td><td>{row.points}</td><td>{row.goalDifference}</td></tr>; })}</tbody></table> : <EmptyState>Ingen avslutad säsong registrerad för klubben.</EmptyState>)}
  </Panel>;
}
