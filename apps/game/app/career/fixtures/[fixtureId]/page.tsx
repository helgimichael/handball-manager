'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { getClub } from '@/lib/game-data';
import { ClubLink } from '@/components/entityLinks';
import { PageHeading, Panel, EmptyState, FixtureTable, CompetitionLink } from '@/components/manager/Workspace';
import FormDots from '@/components/FormDots';
import { getLiveStandings } from '@/lib/career/standings';
export default function FixturePage() {
  const { career } = useCareer();
  const { fixtureId } = useParams<{fixtureId:string}>();
  const fixture = career.fixtures.find(f => f.id === fixtureId) ?? career.matchArchives?.[fixtureId]?.fixture;
  if (!fixture) return <EmptyState>Matchen finns inte i denna karriär. <Link href="/career/schedule">Öppna schemat →</Link></EmptyState>;
  const result = career.results[fixtureId] ?? career.matchArchives?.[fixtureId]?.result;
  const table = getLiveStandings(career);
  const isNext = getNextPlayerFixture(career)?.id === fixture.id;
  return <><PageHeading eyebrow={fixture.date} title={`${getClub(fixture.homeClubId)?.name ?? 'Hemma'} – ${getClub(fixture.awayClubId)?.name ?? 'Borta'}`} description={result ? `Resultat ${result.homeGoals}–${result.awayGoals}` : `Omgång ${fixture.round} · matchen är ännu inte spelad.`} actions={result ? <Link href={`/career/match-report/${fixtureId}`} className="hm-btn hm-btn-primary">Matchrapport →</Link> : isNext && <Link href="/career/match-preview" className="hm-btn hm-btn-primary">Förbered & spela →</Link>} /><CompetitionLink id={fixture.competitionId}>Till tävlingen →</CompetitionLink>
    <div className="hm-comparison-select">{[fixture.homeClubId, fixture.awayClubId].map(id => <Panel key={id} title={<ClubLink clubId={id}>{getClub(id)?.name ?? id}</ClubLink>}><div className="hm-panel-body"><p>Tabellplacering {table.findIndex(r => r.clubId === id) >= 0 ? table.findIndex(r => r.clubId === id)+1 : '—'} · <FormDots results={(career.clubForm[id] ?? []).slice(-5)} /></p></div><FixtureTable career={career} fixtures={career.fixtures.filter(f => career.results[f.id] && (f.homeClubId === id || f.awayClubId === id)).sort((a,b) => b.date.localeCompare(a.date)).slice(0,5)} /></Panel>)}</div>
  </>;
}
