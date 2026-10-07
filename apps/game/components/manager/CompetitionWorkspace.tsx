'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { COMPETITIONS, getClubsByCompetition, getClub } from '@/lib/game-data';
import { getLiveStandings } from '@/lib/career/standings';
import { ClubLink } from '@/components/entityLinks';
import FormDots from '@/components/FormDots';
import { PageHeading, Panel, EmptyState, FixtureTable } from './Workspace';
import StatisticsTable from './StatisticsTable';
export default function CompetitionWorkspace() { return <Suspense fallback={<EmptyState>Läser tävlingen…</EmptyState>}><Competition /></Suspense>; }
function Competition() {
  const { career } = useCareer();
  const router = useRouter();
  const params = useParams<{ competitionId?: string }>();
  const query = useSearchParams();
  const id = params.competitionId ?? career.competitionId;
  const competition = COMPETITIONS.find(c => c.id === id);
  if (!competition) return <EmptyState>Tävlingen hittades inte. <Link href="/career/competitions">Öppna tävlingar →</Link></EmptyState>;
  const live = id === career.competitionId;
  const tab = query.get('tab') ?? 'table';
  const table = live ? getLiveStandings(career) : [];
  const clubs = getClubsByCompetition(id);
  const fixtures = career.fixtures.filter(f => f.competitionId === id);
  const href = `/career/competitions/${encodeURIComponent(id)}`;
  return <><PageHeading eyebrow={`${competition.nation} / ${career.seasonId}`} title={competition.name} description={live ? 'Liga, resultat, form och spelarnas prestationer i din karriär.' : 'Klubbar och spelare i rekryteringsvärlden. Matcher i denna liga simuleras inte.'} />
    <div className="hm-filter-bar"><label>Tävling<select className="hm-select" value={id} onChange={e => { router.push(`/career/competitions/${encodeURIComponent(e.target.value)}`); }}>{COMPETITIONS.map(c => <option value={c.id} key={c.id}>{c.name} · {c.nation}</option>)}</select></label></div>
    <nav className="hm-tabs" aria-label="Tävlingsvyer">{[['table','Tabell & form'],['fixtures','Matcher'],['results','Resultat'],['statistics','Spelarstatistik'],['clubs','Klubbar'],['history','Historik']].map(([t,label]) => <Link key={t} aria-current={tab === t ? 'page' : undefined} href={`${href}?tab=${t}`}>{label}</Link>)}</nav>
    {tab === 'table' && <Panel title="Tabell & form">{live ? <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>#</th><th>Klubb</th><th>SM</th><th>V</th><th>O</th><th>F</th><th>GM</th><th>IM</th><th>MSK</th><th>P</th><th>Form · fem senaste</th></tr></thead><tbody>{table.map((r,i) => <tr key={r.clubId} data-highlight={r.clubId === career.playerClubId}><td>{i+1}</td><td><ClubLink clubId={r.clubId}>{getClub(r.clubId)?.name ?? r.clubId}</ClubLink></td><td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td><td>{r.goalsFor}</td><td>{r.goalsAgainst}</td><td>{r.goalDifference}</td><td><strong>{r.points}</strong></td><td><FormDots results={(career.clubForm[r.clubId] ?? []).slice(-5)} /></td></tr>)}</tbody></table></div> : <EmptyState>Denna tävling har ingen simulerad tabell. <Link href={`${href}?tab=clubs`}>Inspektera klubbarna →</Link></EmptyState>}</Panel>}
    {(tab === 'fixtures' || tab === 'results') && <Panel title={tab === 'results' ? 'Spelade matcher' : 'Kommande matcher'}><FixtureTable career={career} fixtures={fixtures.filter(f => tab === 'results' ? !!career.results[f.id] : !career.results[f.id]).sort((a,b) => tab === 'results' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))} /></Panel>}
    {tab === 'statistics' && <Panel title="Spelarstatistik"><StatisticsTable competitionId={id} /></Panel>}
    {tab === 'clubs' && <Panel title={`${clubs.length} klubbar`}><table className="hm-table"><thead><tr><th>Klubb</th><th>Stad</th><th>Spelare i karriären</th></tr></thead><tbody>{clubs.map(c => <tr key={c.id}><td><ClubLink clubId={c.id}>{c.name}</ClubLink></td><td>{c.city ?? '—'}</td><td>{career.worldSquads[c.id]?.length ?? 'Ingen truppdata'}</td></tr>)}</tbody></table></Panel>}
    {tab === 'history' && <Panel title="Avslutade säsonger">{career.seasonHistory?.filter(s => s.competitionId === id).length ? career.seasonHistory.filter(s => s.competitionId === id).map(s => <div className="hm-detail-row" key={s.seasonId}><Link href={`/career/history?season=${encodeURIComponent(s.seasonId)}`}>{s.seasonId} · sluttabell & spelarstatistik →</Link></div>) : <EmptyState>Ingen avslutad säsong registrerad för denna tävling.</EmptyState>}</Panel>}
  </>;
}
