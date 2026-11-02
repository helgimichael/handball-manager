'use client';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getClub } from '@/lib/game-data';
import type { CareerFixture } from '@/lib/career/types';
import { getLiveStandings } from '@/lib/career/standings';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { getCareerSquad } from '@/lib/career/careerWorld';
import { isSelectableForMatch } from '@/lib/career/playerStatus';
import { isManualLineupCareer, resolveManualMatchPlan } from '@/lib/career/manualLineup';
import { ClubLink } from '@/components/entityLinks';
import FormDots from '@/components/FormDots';
import { Panel, FixtureTable } from './Workspace';
export default function MatchContext({ fixture, postMatch = false }: { fixture: CareerFixture; postMatch?: boolean }) {
  const { career } = useCareer();
  const table = getLiveStandings(career);
  const next = getNextPlayerFixture(career);
  // HM-ALPHA3-M10: the plan that will actually be used, the carried preferred lineup included.
  const available = getCareerSquad(career).filter(p => isSelectableForMatch(career.playerStatuses, p.id));
  const plan = isManualLineupCareer(career) ? resolveManualMatchPlan(career, fixture.id, available) : career.matchPlans[fixture.id];
  return <Panel title={postMatch ? 'Efter matchen · manageruppföljning' : 'Matchunderlag'} actions={<Link href={`/career/competitions/${fixture.competitionId}`}>Tabell & liga →</Link>}>
    <div className="hm-comparison-select hm-panel-body">{[fixture.homeClubId,fixture.awayClubId].map(id => { const r = table.find(row => row.clubId === id); return <div key={id}><strong><ClubLink clubId={id}>{getClub(id)?.name ?? id}</ClubLink></strong><p className="hm-text-muted">{r ? `Nuvarande tabell: ${table.indexOf(r)+1} · ${r.points} poäng · ${r.played} matcher · ${r.goalsFor}–${r.goalsAgainst} mål` : 'Ingen aktuell ligatabell'}</p><FormDots results={(career.clubForm[id] ?? []).slice(-5)} /></div>; })}</div>
    {!postMatch && <div className="hm-filter-bar"><span>Uttagen matchtrupp: {plan?.squad.players.length ?? 'Inte fastställd'}</span><Link className="hm-btn hm-btn-sm" href="/career/tactics">Startsju & matchtrupp →</Link><Link className="hm-btn hm-btn-sm" href="/career/training">Belastning & återhämtning →</Link></div>}
    {postMatch && <div className="hm-filter-bar"><Link href="/career/squad">Granska spelarnas form →</Link><Link href="/career/training">Planera återhämtning →</Link>{next && <Link href="/career/match-preview">Nästa match: {next.date} →</Link>}</div>}
    <FixtureTable career={career} fixtures={career.fixtures.filter(f => career.results[f.id] && (f.homeClubId === fixture.awayClubId || f.awayClubId === fixture.awayClubId)).sort((a,b) => b.date.localeCompare(a.date)).slice(0,3)} />
  </Panel>;
}
