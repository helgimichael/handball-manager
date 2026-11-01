'use client';
import { Suspense,useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { careerArchiveSummaries } from '@/lib/career/matchArchiveSummary';
import { getCareerClub } from '@/lib/career/careerWorld';
import { ClubLink,PlayerLink } from '@/components/entityLinks';
import { getClub,COMPETITIONS } from '@/lib/game-data';
import { Panel,EmptyState,FixtureTable } from '@/components/manager/Workspace';
import { SectionScene,SceneEmpty } from '@/components/game/Secondary';
import ClubCrest from '@/components/ClubCrest';
import StatisticsTable from '@/components/manager/StatisticsTable';
import { formatMoney } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
export default function HistoryPage() { return <Suspense fallback={<EmptyState>Öppnar karriärens säsonger…</EmptyState>}><History /></Suspense>; }
function History() {
  useMoney(); // re-render every figure when the display currency changes
  const { career }=useCareer();
  const params=useSearchParams();
  const [transferScope,setTransferScope]=useState<'OWN'|'WORLD'>('OWN');
  const club=getCareerClub(career);
  const seasons=[...career.seasonHistory ?? []].reverse();
  const season=seasons.find(s => s.seasonId===params.get('season')) ?? seasons[0];
  const summaries = careerArchiveSummaries(career);
  const archives=Object.values(summaries).sort((a,b) => b.fixture.date.localeCompare(a.fixture.date));
  const unknownIds = (career.matchArchiveIds ?? []).filter(id => !summaries[id]);
  const allOffers=Object.values(career.transferOffers).filter(o => o.status==='COMPLETED').reverse();
  const ownOffers=allOffers.filter(o => o.fromClubId===career.playerClubId || o.toClubId===career.playerClubId);
  const offers=transferScope==='OWN' ? ownOffers : allOffers;
  const ownRow=season?.table.find(r => r.clubId===career.playerClubId);
  const ownRank=ownRow && season ? season.table.indexOf(ownRow)+1 : null;
  const playerIndex=new Map(Object.values(career.worldSquads).flat().map(p => [p.id,p]));
  return <div className="game-secondary-page">
    <SectionScene eyebrow={`${club.name} · managerkarriären`} title="Historik" description="Säsongerna, matcherna och spelarna som har format din karriär. Bara registrerade resultat och genomförda händelser." mark={<ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={72} />}><div><strong>{seasons.length}</strong><small>avslutade säsonger</small></div><div><strong>{archives.length + unknownIds.length}</strong><small>bevarade matcher</small></div><div><strong>{ownOffers.length}</strong><small>klubbens övergångar</small></div></SectionScene>
    {seasons.length > 0 && <nav className="hm-tabs" aria-label="Historiska säsonger">{seasons.map(s => <Link key={s.seasonId} aria-current={season?.seasonId===s.seasonId ? 'page' : undefined} href={`/career/history?season=${encodeURIComponent(s.seasonId)}`}>{s.seasonId}</Link>)}</nav>}
    <div className="game-secondary-split">
      <div className="game-secondary-main">
        {season ? <><Panel title={`${season.seasonId} · sluttabell`}><div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>#</th><th>Klubb</th><th>Matcher</th><th>V / O / F</th><th>GM / IM</th><th>MSK</th><th>Poäng</th></tr></thead><tbody>{season.table.map((r,i) => <tr key={r.clubId} data-highlight={r.clubId===career.playerClubId}><td>{i+1}</td><td><ClubLink clubId={r.clubId}>{getClub(r.clubId)?.name ?? r.clubId}</ClubLink></td><td>{r.played}</td><td>{r.won} / {r.drawn} / {r.lost}</td><td>{r.goalsFor} / {r.goalsAgainst}</td><td>{r.goalDifference}</td><td>{r.points}</td></tr>)}</tbody></table></div></Panel><Panel title={`${season.seasonId} · spelarstatistik`}><StatisticsTable key={season.seasonId} competitionId={season.competitionId} statistics={season.stats} /></Panel></> : <SceneEmpty title="Din första säsong skrivs nu" actions={<Link className="hm-btn hm-btn-sm" href="/career/competitions">Följ den aktuella ligan →</Link>}>Sluttabell och spelarstatistik bevaras när du börjar nästa säsong. Spelade matcher går att öppna i arkivet redan under säsongen.</SceneEmpty>}
        <Panel title="Spelade matcharkiv · hela karriären"><FixtureTable career={career} fixtures={archives.map(a => a.fixture)} />{unknownIds.map(id => <p key={id}><Link href={`/career/match-report/${encodeURIComponent(id)}`}>?ppna ?ldre matcharkiv ? {id}</Link></p>)}</Panel>
        <Panel title="Genomförda övergångar" actions={<div className="hm-actions"><button className="hm-btn hm-btn-sm" aria-pressed={transferScope==='OWN'} onClick={() => setTransferScope('OWN')}>Din klubb</button><button className="hm-btn hm-btn-sm" aria-pressed={transferScope==='WORLD'} onClick={() => setTransferScope('WORLD')}>Karriärvärlden</button></div>}><div className="hm-scroll-x game-staff-market-table"><table className="hm-table"><thead><tr><th>Datum</th><th>Spelare</th><th>Från</th><th>Till</th><th>Summa</th><th>Typ</th></tr></thead><tbody>{offers.map(o => <tr key={o.id}><td>{o.offeredDate}</td><td><PlayerLink playerId={o.playerId}>{playerIndex.get(o.playerId)?.lastName ?? o.playerId}</PlayerLink></td><td>{o.fromClubId ? <ClubLink clubId={o.fromClubId}>{getClub(o.fromClubId)?.name ?? o.fromClubId}</ClubLink> : 'Fri agent'}</td><td><ClubLink clubId={o.toClubId}>{getClub(o.toClubId)?.name ?? o.toClubId}</ClubLink></td><td>{formatMoney(o.transferFeeEur)}</td><td>{o.dealType==='LOAN' ? 'Lån' : 'Permanent'}</td></tr>)}</tbody></table></div>{!offers.length && <EmptyState>Inga genomförda övergångar i den här vyn ännu.</EmptyState>}</Panel>
      </div>
      <aside className="game-secondary-rail">
        {season && ownRow && ownRank ? <section className="game-history-milestone"><span className="game-overline">Säsongens slutplacering</span><h2>{season.seasonId}</h2><strong>{ownRank}</strong><p>{COMPETITIONS.find(c => c.id===season.competitionId)?.name ?? season.competitionId} · {ownRow.points} poäng på {ownRow.played} matcher.</p><p>{ownRow.won} vinster · {ownRow.drawn} oavgjorda · {ownRow.lost} förluster<br />{ownRow.goalsFor}–{ownRow.goalsAgainst} mål.</p></section> : <section className="game-history-milestone"><span className="game-overline">Säsongen pågår</span><h2>{career.seasonId}</h2><p>Resultaten byggs upp match för match. Den avslutade säsongens tabell och spelarprestationer sparas vid nästa säsongsstart.</p></section>}
        <section className="game-secondary-note"><h2>Återvänd till avkastet</h2><p>Matcharkivet öppnar de spelade matchernas rapporter och bevarade repriser. Historiska tabeller och spelarstatistik hör till den valda säsongen; match- och transferarkiv visar hela karriären.</p><div className="hm-actions"><Link className="hm-btn hm-btn-sm" href="/career/schedule">Aktuellt matchprogram →</Link><Link className="hm-btn hm-btn-sm" href="/career/club">Klubben →</Link></div></section>
      </aside>
    </div>
  </div>;
}
