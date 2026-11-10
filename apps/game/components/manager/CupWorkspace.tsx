'use client';
// HM-PLAYTEST-01 6.1: Svenska Cupen as a competition of its own -- group
// stage, fixtures, results, knockout progression and history -- reachable
// from Tävlingar and from every cup notification.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { getClub } from '@/lib/game-data';
import { SVENSKA_CUPEN } from '@/lib/competition/rules';
import { cupGroupTable, STAGE_LABEL } from '@/lib/competition/season';
import type { CompetitionTie, TieStage } from '@/lib/competition/types';
import { ClubLink } from '@/components/entityLinks';
import ClubCrest from '@/components/ClubCrest';
import { Panel, EmptyState, FixtureTable } from './Workspace';

const KNOCKOUT: readonly TieStage[] = ['CUP_R32', 'CUP_R16', 'CUP_QF', 'CUP_SF', 'CUP_3RD', 'CUP_F'];
const name = (id?: string) => (id ? getClub(id)?.shortName ?? id : '—');

export function CupWorkspace({ switcher }: { switcher: React.ReactNode }) {
  const { career } = useCareer();
  const tab = useSearchParams().get('tab') ?? 'overview';
  const href = `/career/competitions/${encodeURIComponent(SVENSKA_CUPEN)}`;
  const ties = Object.values(career.competitionTies ?? {}).filter((t) => t.competitionId === SVENSKA_CUPEN && t.seasonId === career.seasonId);
  const groups = ties.filter((t) => t.stage === 'CUP_GROUP').sort((a, b) => a.key.localeCompare(b.key));
  const fixtures = career.fixtures.filter((f) => f.competitionId === SVENSKA_CUPEN);
  const upcoming = fixtures.filter((f) => !career.results[f.id]).sort((a, b) => a.date.localeCompare(b.date));
  const played = fixtures.filter((f) => !!career.results[f.id]).sort((a, b) => b.date.localeCompare(a.date));
  const lateStart = career.careerEvents.some(e => e.id.endsWith(`${career.seasonId}:cup-late-start`));
  const me = career.playerClubId;
  const mine = ties.filter((t) => t.clubIds?.includes(me) || t.highClubId === me || t.lowClubId === me);
  const out = mine.find((t) => t.loserClubId === me && t.stage !== 'CUP_GROUP');
  const history = (career.seasonHistory ?? []).filter((s) => s.outcome?.cupWinner);
  const tabs: [string, string][] = [['overview', 'Översikt'], ['groups', 'Gruppspel'], ['knockout', 'Slutspel'], ['fixtures', 'Matcher'], ['results', 'Resultat'], ['history', 'Historik']];
  return (
    <div className="hm-league-page">
      <header className="hm-plan-section"><span className="hm-eyebrow">Nationell cup · {career.seasonId}</span><h1 style={{ margin: '4px 0' }}>Svenska Cupen</h1><p className="hm-plan-note">{groups.length ? 'Sparad cup med gruppspel och dubbelmöten fram till semifinal.' : '32 lag. Sextondels- och åttondelsfinaler i dubbelmöten, därefter enkelmatcher. Lottningen genomförs i spelet.'}</p>{switcher}</header>
      <nav className="hm-tabs" aria-label="Cupens vyer">{tabs.filter(([t]) => t !== 'groups' || groups.length > 0).map(([t, label]) => <Link key={t} aria-current={tab === t ? 'page' : undefined} href={`${href}?tab=${t}`}>{label}</Link>)}</nav>
      {ties.length === 0 && <EmptyState>{lateStart ? 'Cupen startade före karriären. Inga historiska matcher återskapas.' : 'Cupen har inte lottats ännu den här säsongen.'}</EmptyState>}
      {tab === 'overview' && ties.length > 0 && <div className="hm-plan-columns">
        <Panel title="Din väg i cupen"><div className="hm-panel-body">{mine.length === 0 ? <p>Din klubb deltar inte i årets cup.</p> : <ul className="hm-link-list">{mine.map((t) => <li key={t.id}><span>{STAGE_LABEL[t.stage]}{t.group ? ` · grupp ${t.group}` : ''}</span><span>{t.stage === 'CUP_GROUP' ? `${(cupGroupTable(career, t).findIndex((r) => r.clubId === me) + 1)}:a i gruppen` : t.winnerClubId ? (t.winnerClubId === me ? 'Vidare' : 'Utslagen') : `${name(t.highClubId)} – ${name(t.lowClubId)}`}</span></li>)}</ul>}{out && <p className="hm-plan-note">Utslagen i {STAGE_LABEL[out.stage].toLowerCase()} av {name(out.winnerClubId)}.</p>}</div></Panel>
        <Panel title="Nästa cupmatcher" actions={<Link href={`${href}?tab=fixtures`}>Alla →</Link>}><FixtureTable career={career} fixtures={upcoming.slice(0, 6)} /></Panel>
      </div>}
      {tab === 'groups' && <div className="ss-groups">{groups.map((g) => (
        <Panel key={g.id} title={g.label}><table className="hm-table"><thead><tr><th>#</th><th>Lag</th><th className="hm-table-num">M</th><th className="hm-table-num">+/-</th><th className="hm-table-num">P</th></tr></thead><tbody>{cupGroupTable(career, g).map((r, i) => <tr key={r.clubId} data-highlight={r.clubId === me} data-zone={i < 2 ? 'playoff' : undefined}><td>{i + 1}</td><td><span className="hm-with-flag"><ClubCrest shortName={name(r.clubId)} primaryColor="" clubId={r.clubId} size={18} /><ClubLink clubId={r.clubId}>{name(r.clubId)}</ClubLink></span></td><td className="hm-table-num">{r.played}</td><td className="hm-table-num">{r.goalsFor - r.goalsAgainst}</td><td className="hm-table-num"><b>{r.points}</b></td></tr>)}</tbody></table></Panel>
      ))}</div>}
      {tab === 'knockout' && (KNOCKOUT.some((s) => ties.some((t) => t.stage === s)) ? KNOCKOUT.map((stage) => { const round = ties.filter((t) => t.stage === stage).sort((a, b) => a.key.localeCompare(b.key)); return round.length ? <Panel key={stage} title={STAGE_LABEL[stage]}><ul className="hm-link-list">{round.map((t) => <KnockoutRow key={t.id} tie={t} />)}</ul></Panel> : null; }) : <EmptyState>Nästa omgång skapas när föregående omgång är avgjord.</EmptyState>)}
      {(tab === 'fixtures' || tab === 'results') && <Panel title={tab === 'results' ? 'Spelade cupmatcher' : 'Kommande cupmatcher'}><FixtureTable career={career} fixtures={tab === 'results' ? played : upcoming} /></Panel>}
      {tab === 'history' && <Panel title="Tidigare cupvinnare">{history.length ? <ul className="hm-link-list">{history.map((s) => <li key={s.seasonId}><span>{s.seasonId}</span><ClubLink clubId={s.outcome!.cupWinner!}>{getClub(s.outcome!.cupWinner!)?.name ?? s.outcome!.cupWinner}</ClubLink></li>)}</ul> : <EmptyState>Ingen avslutad cup i den här karriären ännu.</EmptyState>}</Panel>}
    </div>
  );

  function KnockoutRow({ tie }: { tie: CompetitionTie }) {
    const legs = tie.fixtureIds.map((id) => career.results[id]).filter(Boolean);
    const agg = legs.reduce((acc, r) => { acc[r!.homeClubId] = (acc[r!.homeClubId] ?? 0) + r!.homeGoals; acc[r!.awayClubId] = (acc[r!.awayClubId] ?? 0) + r!.awayGoals; return acc; }, {} as Record<string, number>);
    return <li><span><b data-winner={tie.winnerClubId === tie.highClubId || undefined}>{name(tie.highClubId)}</b> – <b data-winner={tie.winnerClubId === tie.lowClubId || undefined}>{name(tie.lowClubId)}</b></span><span>{legs.length ? `${agg[tie.highClubId] ?? 0}–${agg[tie.lowClubId] ?? 0}${tie.fixtureIds.length > 1 ? ' sammanlagt' : ''}` : 'Ej spelad'}{tie.winnerClubId ? ` · ${name(tie.winnerClubId)} vidare` : ''}</span></li>;
  }
}
