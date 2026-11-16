'use client';
// HM-PLAYTEST-01 6.1 + Arena Nights CMP-01g A "Stage path + bracket": Svenska Cupen in the same competition shell
// as the leagues -- stage stepper (Gruppspel -> ... -> Final) with your position, group tables during the group
// stage and a bracket once knockouts are drawn; rail with your next cup match, your path and previous winners.
// Everything is read from the saved ties; no draw or format is decided here.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { getClub } from '@/lib/game-data';
import { SVENSKA_CUPEN } from '@/lib/competition/rules';
import { cupGroupTable, STAGE_LABEL } from '@/lib/competition/season';
import { cupCentre, type BracketTie } from '@/lib/competition/cupCentre';
import { fixturesByRound } from '@/lib/competition/leagueCentre';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
import { ClubLink } from '@/components/entityLinks';
import ClubCrest from '@/components/ClubCrest';
import { Panel, EmptyState } from './Workspace';
import { CompetitionShellHeader, RoundList, ShellTabs } from './CompetitionShell';

const name = (id?: string) => (id ? getClub(id)?.shortName ?? id : '—');
const CUP_TABS = [['overview', 'Cupvägen'], ['fixtures', 'Matcher'], ['results', 'Resultat'], ['history', 'Historik']] as const;

export function CupWorkspace({ switcher }: { switcher: React.ReactNode }) {
  const { career } = useCareer();
  const raw = useSearchParams().get('tab') ?? 'overview';
  // Older links used ?tab=groups / ?tab=knockout; both now live on the stage path.
  const tab = raw === 'groups' || raw === 'knockout' ? 'overview' : CUP_TABS.some(([t]) => t === raw) ? raw : 'overview';
  const href = `/career/competitions/${encodeURIComponent(SVENSKA_CUPEN)}`;
  const cup = useMemo(() => cupCentre(career), [career]);
  const [focus, setFocus] = useState<string | null>(null);
  const rounds = useMemo(() => (tab === 'fixtures' ? fixturesByRound(career, SVENSKA_CUPEN, 'upcoming') : tab === 'results' ? fixturesByRound(career, SVENSKA_CUPEN, 'played') : []), [career, tab]);
  const lateStart = career.careerEvents.some(e => e.id.endsWith(`${career.seasonId}:cup-late-start`));
  const me = career.playerClubId;
  const history = (career.seasonHistory ?? []).filter((s) => s.outcome?.cupWinner);
  const current = cup.stages.find((s) => s.status === 'CURRENT');
  const nextFixture = cup.nextFixtureId ? career.fixtures.find((f) => f.id === cup.nextFixtureId) : undefined;
  const showGroups = cup.groups.length > 0 && (current?.stage === 'CUP_GROUP' || cup.bracket.length === 0);
  const meta = <>
    <span className="hm-status" data-tone={cup.ties.length ? 'ok' : 'neutral'}>{cup.ties.length ? 'Lottad' : 'Inte lottad'}</span>
    <span>Nationell cup · säsong {career.seasonId}</span>
    {current && <span>Pågår: {current.label}</span>}
    {nextFixture && <span>Din nästa cupmatch · {nextFixture.date}</span>}
  </>;

  const rail = <aside className="cc-rail" aria-label="Cupen just nu">
    <section className="cc-own" aria-labelledby="cc-cup-own-h">
      <h2 id="cc-cup-own-h">Din väg i cupen</h2>
      {cup.stages.some((s) => s.own) ? <ol className="cc-cup-path">{cup.stages.filter((s) => s.own).map((s) => <li key={s.stage} data-own={s.own}><span>{s.label}</span><b>{s.own === 'OUT' ? 'Utslagen' : s.own === 'THROUGH' ? 'Vidare' : 'Spelar'}</b></li>)}</ol> : <p className="cc-muted">{cup.ties.length ? 'Din klubb deltar inte i årets cup.' : 'Cupen har inte lottats ännu den här säsongen.'}</p>}
      {cup.ownOut && <p className="cc-muted">Utslagen i {STAGE_LABEL[cup.ownOut.stage].toLowerCase()} av {name(cup.ownOut.winnerClubId)}.</p>}
    </section>
    <Panel title="Nästa cupmatch">{nextFixture ? <Link className="cc-next-cup" href={`/career/fixtures/${encodeURIComponent(nextFixture.id)}`}><span>{nextFixture.date}{nextFixture.kickoffTime ? ` · ${nextFixture.kickoffTime}` : ''}</span><strong>{name(nextFixture.homeClubId)} – {name(nextFixture.awayClubId)}</strong><small>Matchsidan →</small></Link> : <EmptyState>Ingen cupmatch inplanerad för din klubb.</EmptyState>}</Panel>
    <Panel title="Tidigare vinnare" actions={<Link href={`${href}?tab=history`} scroll={false}>Alla →</Link>}>{history.length ? <ul className="cc-winners">{history.slice(-4).reverse().map((s) => <li key={s.seasonId}><span>{s.seasonId}</span><ClubLink clubId={s.outcome!.cupWinner!}>{name(s.outcome!.cupWinner!)}</ClubLink></li>)}</ul> : <EmptyState>Ingen avslutad cup i den här karriären ännu.</EmptyState>}</Panel>
  </aside>;

  return <div className="cc-page">
    <CompetitionShellHeader eyebrow="Nationell cup" title="Svenska Cupen" switcher={switcher} meta={meta} tabs={<ShellTabs href={href} tab={tab} tabs={CUP_TABS} label="Cupens vyer" />} />
    {tab === 'overview' && <>
      {cup.stages.length > 0 && <ol className="cc-stepper" aria-label="Cupens steg">{cup.stages.map((s) => <li key={s.stage} data-status={s.status} data-own={s.own ?? undefined} aria-current={s.status === 'CURRENT' ? 'step' : undefined}><span className="cc-step-dot" aria-hidden="true" /><strong>{s.label}</strong><small>{s.own === 'OUT' ? 'Utslagna här' : s.own === 'THROUGH' ? 'Vidare' : s.own === 'IN' ? 'Du spelar' : s.status === 'DONE' ? 'Avgjord' : s.status === 'CURRENT' ? 'Pågår' : 'Kommande'}</small></li>)}</ol>}
      <div className="cc-split">
        <div className="cc-main">
          {cup.ties.length === 0 && <EmptyState>{lateStart ? 'Cupen startade före karriären. Inga historiska matcher återskapas.' : 'Cupen har inte lottats ännu den här säsongen. Lottningen sker i kalendern.'} <Link href="/career/schedule">Spelschemat →</Link></EmptyState>}
          {showGroups && <div className="cc-groups">{cup.groups.map((g) => <Panel key={g.id} title={g.label}><table className="hm-table cc-table"><thead><tr><th className="cc-num">#</th><th>Lag</th><th className="cc-num">M</th><th className="cc-num">+/-</th><th className="cc-num">P</th></tr></thead><tbody>{cupGroupTable(career, g).map((r, i) => <tr key={r.clubId} data-highlight={r.clubId === me || undefined} data-zone={i < 2 ? 'pos' : undefined}><td className="cc-num">{i + 1}</td><td><ClubLink clubId={r.clubId}>{name(r.clubId)}</ClubLink></td><td className="cc-num">{r.played}</td><td className="cc-num">{r.goalsFor - r.goalsAgainst}</td><td className="cc-num"><b>{r.points}</b></td></tr>)}</tbody></table></Panel>)}</div>}
          {cup.bracket.length > 0 && <section className="cc-bracket-wrap" aria-label="Slutspelsträd">
            <div className="cc-bracket" onMouseLeave={() => setFocus(null)}>{cup.bracket.map((round) => <div className="cc-bracket-round" key={round.stage}><h3>{round.label}</h3><ul>{round.ties.map((t) => <BracketNode key={t.id} tie={t} me={me} focus={focus} onFocus={setFocus} />)}</ul></div>)}</div>
            <p className="cc-muted">Nästa omgång lottas när föregående omgång är avgjord. Din väg är markerad; peka på ett lag för att följa dess väg.</p>
          </section>}
        </div>
        {rail}
      </div>
    </>}
    {(tab === 'fixtures' || tab === 'results') && <div className="cc-split"><div className="cc-main"><Panel title={tab === 'results' ? 'Spelade cupmatcher' : 'Kommande cupmatcher'}>{rounds.length ? <RoundList groups={rounds} /> : <EmptyState>{tab === 'results' ? 'Inga cupmatcher är spelade ännu.' : 'Inga kommande cupmatcher.'} <Link href={`${href}?tab=overview`} scroll={false}>Cupvägen →</Link></EmptyState>}</Panel></div>{rail}</div>}
    {tab === 'history' && <Panel title="Tidigare cupvinnare">{history.length ? <ol className="cc-honours">{[...history].reverse().map((s) => <li key={s.seasonId}><span className="cc-honour-season">{s.seasonId}</span><span className="cc-honour-champ"><ClubCrest clubId={s.outcome!.cupWinner!} shortName={name(s.outcome!.cupWinner!)} primaryColor={getClub(s.outcome!.cupWinner!)?.primaryColor ?? ''} size={28} /><span><small>Cupvinnare</small><ClubLink clubId={s.outcome!.cupWinner!} showCrest={false}>{getClub(s.outcome!.cupWinner!)?.name ?? s.outcome!.cupWinner}</ClubLink></span></span><Link className="cc-honour-link" href={`/career/history?season=${encodeURIComponent(s.seasonId)}`}>Säsongen →</Link></li>)}</ol> : <EmptyState>Ingen avslutad cup i den här karriären ännu.</EmptyState>}</Panel>}
  </div>;
}

function BracketNode({ tie, me, focus, onFocus }: { tie: BracketTie; me: string; focus: string | null; onFocus: (id: string | null) => void }) {
  const href = tie.fixtureIds[0] ? (tie.played ? matchReportHref(tie.fixtureIds[tie.played - 1]!) : `/career/fixtures/${encodeURIComponent(tie.fixtureIds[0])}`) : undefined;
  const lit = focus !== null && (tie.highClubId === focus || tie.lowClubId === focus);
  const side = (clubId: string) => <span className="cc-bn-team" data-winner={tie.winnerClubId === clubId || undefined} data-me={clubId === me || undefined} onMouseEnter={() => onFocus(clubId)}><ClubCrest clubId={clubId} shortName={name(clubId)} primaryColor={getClub(clubId)?.primaryColor ?? ''} size={16} /><span>{name(clubId)}</span></span>;
  const body = <>{side(tie.highClubId)}{side(tie.lowClubId)}<span className="cc-bn-score">{tie.score ?? 'Ej spelad'}{tie.legs > 1 ? <small>{tie.played}/{tie.legs} möten</small> : null}</span></>;
  return <li className="cc-bn" data-own={tie.own || undefined} data-lit={lit || undefined}>{href ? <Link href={href} aria-label={`${name(tie.highClubId)} mot ${name(tie.lowClubId)}${tie.score ? `, ${tie.score}` : ''}`}>{body}</Link> : <div>{body}</div>}</li>;
}
