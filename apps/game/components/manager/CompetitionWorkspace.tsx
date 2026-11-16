'use client';
// Arena Nights -- CMP-01 A "League Centre". /career/competitions is an overview of every competition;
// /career/competitions/[id] is one shell for leagues and the cup (CMP-01g): header (switcher, round x/y, next
// round) -> URL tabs -> main + rail. The table carries verified zone lines, movement arrows, Total/Hemma/Borta/Form
// views and a points-gap chart; clubs open in a Peek. Tables, tie-breakers and transitions are read-only.
import { Suspense, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import type { CareerState } from '@/lib/career/types';
import { COMPETITIONS, getClub } from '@/lib/game-data';
import { clubCompetitionId } from '@/lib/career/competitionMembership';
import { competitionTable, hasLeagueCalendar } from '@/lib/competition/tables';
import { SVENSKA_CUPEN } from '@/lib/competition/rules';
import { annotatedStandings, type AnnotatedRow } from '@/lib/competition/standingsZones';
import { clubTiles, competitionOverview, decidingFixtures, fixturesByRound, ownClubCentre, rollOfHonour, roundProgress, tableView, TABLE_VIEWS, zoneLines, type CompetitionCard, type OwnClubCentre, type TableView } from '@/lib/competition/leagueCentre';
import { managementPlayers } from '@/lib/career/management';
import { ClubLink, PlayerLink } from '@/components/entityLinks';
import ClubCrest from '@/components/ClubCrest';
import FormDots from '@/components/FormDots';
import { CupWorkspace } from './CupWorkspace';
import { CompetitionShellHeader, RoundList, ShellTabs } from './CompetitionShell';
import { Panel, EmptyState } from './Workspace';
import CompetitionStats from './CompetitionStats';
import ClubPeek from './ClubPeek';
import { ScoutAssignButton } from './ScoutAssignButton';

const short = (id: string) => getClub(id)?.shortName ?? id;
export const NATION_SV: Record<string, string> = { SWE: 'Sverige', DEN: 'Danmark', NOR: 'Norge', GER: 'Tyskland', ESP: 'Spanien', HUN: 'Ungern', SVN: 'Slovenien', ISL: 'Island', AUT: 'Österrike', FRO: 'Färöarna', ITA: 'Italien', NED: 'Nederländerna', POL: 'Polen', POR: 'Portugal', QAT: 'Qatar', CHE: 'Schweiz' };

export default function CompetitionWorkspace() {
  return <Suspense fallback={<EmptyState>Läser tävlingen…</EmptyState>}><Competition /></Suspense>;
}

function Competition() {
  const params = useParams<{ competitionId?: string }>();
  if (!params.competitionId) return <CompetitionOverview />;
  return <CompetitionDetail id={decodeURIComponent(params.competitionId)} />;
}

// ---------------------------------------------------------------- overview (all competitions)
function CompetitionOverview() {
  const { career } = useCareer();
  const overview = useMemo(() => competitionOverview(career), [career]);
  return <div className="cc-page">
    <header className="cc-head"><div><span className="cc-eyebrow">Tävlingar · {career.seasonId}</span><h1>Tävlingar</h1><p className="cc-lede">Din liga och cup först, sedan resten av Sverige och ligorna i rekryteringsvärlden.</p></div></header>
    {overview.mine.length > 0 && <section aria-labelledby="cc-mine-h"><h2 id="cc-mine-h" className="cc-section-h">Dina tävlingar</h2><div className="cc-card-grid">{overview.mine.map(c => <CompetitionCardView key={c.id} card={c} />)}</div></section>}
    <section aria-labelledby="cc-swe-h"><h2 id="cc-swe-h" className="cc-section-h">Sverige</h2><div className="cc-card-grid">{overview.sweden.map(c => <CompetitionCardView key={c.id} card={c} />)}</div></section>
    <section aria-labelledby="cc-world-h"><h2 id="cc-world-h" className="cc-section-h">Ligor i rekryteringsvärlden</h2><p className="cc-muted">Ej simulerade: klubbar och spelare att upptäcka genom scouting.</p><div className="cc-card-grid" data-compact="true">{overview.world.map(c => <CompetitionCardView key={c.id} card={c} compact />)}</div></section>
  </div>;
}

function CompetitionCardView({ card, compact = false }: { card: CompetitionCard; compact?: boolean }) {
  return <Link className="cc-card" href={`/career/competitions/${encodeURIComponent(card.id)}`} data-own={card.own || undefined} data-compact={compact || undefined}>
    <span className="cc-card-top"><span className="cc-card-kind">{card.kind === 'CUP' ? 'Nationell cup' : NATION_SV[card.nation] ?? card.nation}</span><span className="hm-status" data-tone={card.simulated ? 'ok' : 'neutral'}>{card.simulated ? 'Simulerad' : 'Ej simulerad'}</span></span>
    <strong className="cc-card-name">{card.name}</strong>
    {!compact && card.ownStatus && <span className="cc-card-own">{card.own ? 'Din klubb · ' : ''}{card.ownStatus}</span>}
    {!compact && card.progress && card.progress.total > 0 && <span className="cc-card-progress"><span className="cc-bar" aria-hidden="true"><i style={{ width: `${(card.progress.completed / card.progress.total) * 100}%` }} /></span><small>Omgång {card.progress.completed}/{card.progress.total}{card.progress.nextRoundDate ? ` · nästa ${card.progress.nextRoundDate}` : ''}</small></span>}
    {!compact && card.leader && <span className="cc-card-meta">Leder: {short(card.leader.clubId)} · {card.leader.points} p</span>}
    <span className="cc-card-meta">{card.clubs} klubbar</span>
  </Link>;
}

// ---------------------------------------------------------------- shared shell (leagues and the cup)
function Switcher({ id }: { id: string }) {
  const { career } = useCareer();
  const router = useRouter();
  return <label className="cc-switch">Tävling<select className="hm-select" value={id} onChange={e => router.push(`/career/competitions/${encodeURIComponent(e.target.value)}`)}><option value={SVENSKA_CUPEN}>Svenska Cupen · SE</option>{COMPETITIONS.map(c => <option value={c.id} key={c.id}>{c.name} · {c.nation}{hasLeagueCalendar(career, c.id) ? '' : ' (ej simulerad)'}</option>)}</select></label>;
}

const LEAGUE_TABS = [['table', 'Tabell'], ['fixtures', 'Matcher'], ['results', 'Resultat'], ['statistics', 'Statistik'], ['clubs', 'Klubbar'], ['history', 'Historik']] as const;

function CompetitionDetail({ id }: { id: string }) {
  const { career } = useCareer();
  const query = useSearchParams();
  const [peek, setPeek] = useState<string | null>(null);
  if (id === SVENSKA_CUPEN) return <CupWorkspace switcher={<Switcher id={id} />} />;
  const competition = COMPETITIONS.find(c => c.id === id);
  if (!competition) return <div className="cc-page"><EmptyState>Tävlingen finns inte i spelvärlden. Länken kan vara gammal. <Link href="/career/competitions">Se alla tävlingar →</Link></EmptyState></div>;
  const live = hasLeagueCalendar(career, id);
  const rawTab = query.get('tab') ?? 'table';
  const tab = LEAGUE_TABS.some(([t]) => t === rawTab) ? rawTab : 'table';
  const href = `/career/competitions/${encodeURIComponent(id)}`;
  const progress = live ? roundProgress(career, id) : null;
  const meta = <>
    <span className="hm-status" data-tone={live ? 'ok' : 'neutral'}>{live ? 'Fullt simulerad' : 'Ej simulerad · ingen tabell'}</span>
    <span>{NATION_SV[competition.nation] ?? competition.nation} · säsong {career.seasonId}</span>
    {progress && progress.total > 0 && <span>Omgång {progress.completed}/{progress.total}</span>}
    {progress?.nextRound != null && <span>Nästa omgång {progress.nextRound} · {progress.nextRoundDate}</span>}
  </>;
  return <div className="cc-page">
    <CompetitionShellHeader eyebrow={live ? 'Liga' : 'Liga i rekryteringsvärlden'} title={competition.name} switcher={<Switcher id={id} />} meta={meta} tabs={<ShellTabs href={href} tab={tab} tabs={LEAGUE_TABS} label="Tävlingsvyer" />} />
    {!live && tab === 'table' ? <NotSimulated id={id} name={competition.name} onPeek={setPeek} /> : <LeagueTab career={career} id={id} tab={tab} href={href} live={live} onPeek={setPeek} />}
    {peek && <ClubPeek clubId={peek} onClose={() => setPeek(null)} />}
  </div>;
}

// ---------------------------------------------------------------- CMP-01h: non-simulated league
function NotSimulated({ id, name, onPeek }: { id: string; name: string; onPeek: (id: string) => void }) {
  const { career } = useCareer();
  const tiles = useMemo(() => clubTiles(career, id), [career, id]);
  return <div className="cc-stack">
    <section className="cc-notice">
      <h2>{name} spelas inte i din karriär</h2>
      <p>Ligan har ingen simulerad matchkalender, så det finns ingen tabell och inga resultat. Klubbarna och spelarna finns i världen: inspektera dem, eller låt en scout bevaka ligan och rapportera spelare som passar dig.</p>
      <ScoutAssignButton kind="COMPETITION" targetId={id} label="Starta bevakning i ligan" />
    </section>
    <Panel title={`${tiles.length} klubbar`}><ClubGrid tiles={tiles} onPeek={onPeek} /></Panel>
  </div>;
}

// ---------------------------------------------------------------- league tabs
function LeagueTab({ career, id, tab, href, live, onPeek }: { career: CareerState; id: string; tab: string; href: string; live: boolean; onPeek: (id: string) => void }) {
  const table = useMemo(() => (live ? competitionTable(career, id) : []), [career, id, live]);
  const annotated = useMemo(() => (live ? annotatedStandings(career, id, table) : []), [career, id, live, table]);
  const centre = useMemo(() => ownClubCentre(career, id, annotated), [career, id, annotated]);
  const players = useMemo(() => new Map(managementPlayers(career).map(p => [p.id, p])), [career]);
  const tiles = useMemo(() => clubTiles(career, id), [career, id]);
  const rounds = useMemo(() => (tab === 'fixtures' || tab === 'table' ? fixturesByRound(career, id, 'upcoming') : tab === 'results' ? fixturesByRound(career, id, 'played') : []), [career, id, tab]);
  const leaders = useMemo(() => Object.values(career.playerSeasonStats).filter(stat => { const p = players.get(stat.playerId); return !!p && clubCompetitionId(career, p.clubId) === id && stat.goals > 0; }).sort((a, b) => b.goals - a.goals || a.appearances - b.appearances).slice(0, 5), [career, id, players]);
  const nextRound = tab === 'table' ? rounds[0] : undefined;

  const rail = <aside className="cc-rail" data-league="true" aria-label="Ligan just nu">
    {centre && <OwnClubCard career={career} id={id} centre={centre} />}
    {live && nextRound && <Panel title={nextRound.label} actions={<Link href={`${href}?tab=fixtures`} scroll={false}>Alla →</Link>}><RoundList groups={[nextRound]} compact /></Panel>}
    <Panel title="Skytteligan" actions={<Link href={`${href}?tab=statistics`} scroll={false}>Statistik →</Link>}>
      {leaders.length ? <ol className="cc-scorers">{leaders.map((stat, i) => { const p = players.get(stat.playerId)!; return <li key={stat.playerId} data-own={p.clubId === career.playerClubId || undefined}><span className="cc-rank">{i + 1}</span><span><PlayerLink playerId={p.id}>{p.firstName} {p.lastName}</PlayerLink><small>{short(p.clubId)} · {stat.appearances} m</small></span><strong>{stat.goals}</strong></li>; })}</ol> : <EmptyState>Skytteligan börjar när matcherna spelas.</EmptyState>}
    </Panel>
  </aside>;

  if (tab === 'table') return <div className="cc-split">
    <div className="cc-main">
      <StandingsPanel career={career} id={id} annotated={annotated} onPeek={onPeek} />
      {centre && <GapChart career={career} id={id} annotated={annotated} centre={centre} />}
    </div>
    {rail}
  </div>;
  if (tab === 'fixtures' || tab === 'results') return <div className="cc-split"><div className="cc-main"><Panel title={tab === 'results' ? 'Resultat per omgång' : 'Matcher per omgång'}>{rounds.length ? <RoundList groups={rounds} /> : <EmptyState>{tab === 'results' ? 'Inga matcher är spelade ännu. Resultaten visas här efter första omgången.' : live ? 'Inga kommande matcher. Säsongens matcher är spelade.' : 'Ligan har ingen simulerad matchkalender.'} <Link href={`${href}?tab=${tab === 'results' ? 'fixtures' : 'clubs'}`} scroll={false}>{tab === 'results' ? 'Se spelschemat →' : 'Se klubbarna →'}</Link></EmptyState>}</Panel></div>{rail}</div>;
  if (tab === 'statistics') return <CompetitionStats competitionId={id} />;
  if (tab === 'clubs') return <Panel title={`${tiles.length} klubbar`}><ClubGrid tiles={tiles} onPeek={onPeek} /></Panel>;
  return <RollOfHonour career={career} id={id} />;
}

function StandingsPanel({ career, id, annotated, onPeek }: { career: CareerState; id: string; annotated: AnnotatedRow[]; onPeek: (id: string) => void }) {
  const [view, setView] = useState<TableView>('TOTAL');
  const rows = useMemo(() => (view === 'TOTAL' ? null : tableView(career, id, view)), [career, id, view]);
  const legend = [...new Map(annotated.filter(a => a.zone).map(a => [a.zone!.id, a.zone!])).values()];
  const played = annotated.reduce((s, a) => s + a.row.played, 0) / 2;
  const own = annotated.find(a => a.row.clubId === career.playerClubId);
  const gd = (n: number) => (n > 0 ? `+${n}` : String(n));
  const clubCell = (clubId: string, extra?: ReactNode) => <td className="cc-club"><button type="button" className="cc-club-btn" onClick={() => onPeek(clubId)} aria-label={`Snabbtitt: ${getClub(clubId)?.name ?? clubId}`}><ClubCrest clubId={clubId} shortName={short(clubId)} primaryColor={getClub(clubId)?.primaryColor ?? ''} size={20} /><span className="cc-club-name">{getClub(clubId)?.name ?? clubId}</span><span className="cc-club-short">{short(clubId)}</span></button>{extra}</td>;
  const cells = (r: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number }) => <><td className="cc-num">{r.played}</td><td className="cc-num cc-x">{r.won}</td><td className="cc-num cc-x">{r.drawn}</td><td className="cc-num cc-x">{r.lost}</td><td className="cc-num cc-x">{r.goalsFor}</td><td className="cc-num cc-x">{r.goalsAgainst}</td><td className="cc-num">{gd(r.goalDifference)}</td><td className="cc-num"><strong>{r.points}</strong></td></>;
  return <Panel title="Tabell" actions={<span className="cc-muted">{career.seasonId} · {played} ligamatcher spelade</span>}>
    <div className="cc-views" role="group" aria-label="Tabellvy">{TABLE_VIEWS.map(v => <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>)}</div>
    {annotated.length === 0 ? <EmptyState>Tabellen visas när ligans klubbar är kända.</EmptyState> : <div className="hm-scroll-x cc-table-wrap"><table className="hm-table cc-table">
      <thead><tr><th className="cc-num">#</th><th>Klubb</th><th className="cc-num" title="Spelade matcher">M</th><th className="cc-num cc-x" title="Vunna">V</th><th className="cc-num cc-x" title="Oavgjorda">O</th><th className="cc-num cc-x" title="Förlorade">F</th><th className="cc-num cc-x" title="Gjorda mål">GM</th><th className="cc-num cc-x" title="Insläppta mål">IM</th><th className="cc-num" title="Målskillnad">MSK</th><th className="cc-num" title="Poäng">P</th><th>Form</th></tr></thead>
      <tbody>
        {view === 'TOTAL' ? <>
          {own && <tr className="cc-pinned-row" data-highlight="true" aria-hidden="true"><td className="cc-num"><b>{own.position}</b></td><td className="cc-club"><span className="cc-pinned-label">Din klubb · {short(own.row.clubId)}</span></td>{cells(own.row)}<td><FormDots results={(career.clubForm[own.row.clubId] ?? []).slice(-5)} /></td></tr>}
          {annotated.map(({ row: r, position, zone, zoneStart, movement, gapToAbove }) => <tr key={r.clubId} data-highlight={r.clubId === career.playerClubId || undefined} data-zone={zone?.tone} data-zone-start={zoneStart || undefined}>
            <td className="cz-pos cc-num"><b>{position}</b>{movement ? <i data-dir={movement > 0 ? 'up' : 'down'} aria-label={movement > 0 ? `Upp ${movement} sedan förra omgången` : `Ned ${-movement} sedan förra omgången`}>{movement > 0 ? '▲' : '▼'}{Math.abs(movement)}</i> : null}</td>
            {clubCell(r.clubId, <>{zoneStart && zone ? <small className="cz-zone" data-tone={zone.tone}>{zone.label}</small> : null}{gapToAbove ? <small className="cz-gap" title="Poäng upp till laget ovanför">−{gapToAbove}</small> : null}</>)}
            {cells(r)}<td><FormDots results={(career.clubForm[r.clubId] ?? []).slice(-5)} /></td>
          </tr>)}
        </> : rows!.map((r, i) => <tr key={r.clubId} data-highlight={r.clubId === career.playerClubId || undefined}><td className="cc-num"><b>{i + 1}</b></td>{clubCell(r.clubId)}{cells(r)}<td><FormDots results={r.form} /></td></tr>)}
      </tbody>
    </table></div>}
    {view === 'TOTAL' && legend.length > 0 && <ul className="cz-legend" aria-label="Tabellens zoner">{legend.map(z => <li key={z.id} data-tone={z.tone}>{z.label}</li>)}</ul>}
    {view !== 'TOTAL' && <p className="cc-muted cc-view-note">{view === 'FORM' ? 'Formtabell: de fem senaste ligamatcherna per klubb.' : `${view === 'HOME' ? 'Hemma' : 'Borta'}tabell: bara klubbens ${view === 'HOME' ? 'hemma' : 'borta'}matcher.`} Zonerna och den officiella ordningen gäller totaltabellen.</p>}
  </Panel>;
}

function OwnClubCard({ career, id, centre }: { career: CareerState; id: string; centre: OwnClubCentre }) {
  return <section className="cc-own" aria-labelledby="cc-own-h">
    <h2 id="cc-own-h">Din klubb</h2>
    <div className="cc-own-top"><span className="cc-own-pos">{centre.position}</span><div><strong><ClubLink clubId={career.playerClubId}>{getClub(career.playerClubId)?.name ?? 'Din klubb'}</ClubLink></strong><small>{centre.points} poäng{centre.zone ? ` · ${centre.zone.label}` : ''}</small><FormDots results={(career.clubForm[career.playerClubId] ?? []).slice(-5)} /></div></div>
    <ul className="cc-own-lines">
      {centre.above && <li data-tone={centre.above.tone}><span>Upp till {centre.above.label.toLowerCase()}</span><b>{centre.above.gap === 0 ? 'Lika' : `${centre.above.gap} p`}</b></li>}
      {centre.below && <li data-tone={centre.below.tone}><span>Marginal till {centre.below.label.toLowerCase()}</span><b>{centre.below.gap} p</b></li>}
      {!centre.above && !centre.below && <li><span>Ligan har inga verifierade zoner att mäta mot.</span></li>}
    </ul>
    <h3>Nästa tre</h3>
    {centre.next.length ? <ol className="cc-own-next">{centre.next.map(n => <li key={n.fixtureId}><Link href={`/career/fixtures/${encodeURIComponent(n.fixtureId)}`}><span className="cc-num">{n.date.slice(5)}</span><span>{n.home ? 'Hemma' : 'Borta'} · {short(n.opponentId)}</span><span className="cc-chip" title="Motståndarens tabellplacering">{n.opponentPosition ? `${n.opponentPosition}:a` : '—'}</span></Link></li>)}</ol> : <p className="cc-muted">Inga fler matcher den här säsongen.</p>}
    {id === career.competitionId && centre.next.length > 0 && <Link className="hm-btn hm-btn-sm" href="/career/match-preview">Förbered nästa match →</Link>}
  </section>;
}

function GapChart({ career, id, annotated, centre }: { career: CareerState; id: string; annotated: AnnotatedRow[]; centre: OwnClubCentre }) {
  const [open, setOpen] = useState<'above' | 'below' | null>(null);
  const max = Math.max(1, ...annotated.map(a => a.row.points));
  const lines = new Set(zoneLines(id, annotated));
  const remaining = career.fixtures.filter(f => f.type === 'LEAGUE' && f.competitionId === id && !career.results[f.id] && (f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId)).length;
  const gaps = (['above', 'below'] as const).flatMap(k => { const g = centre[k]; return g ? [{ k, g }] : []; });
  const scale = Math.max(1, remaining * 2, ...gaps.map(x => x.g.gap));
  const target = open ? centre[open] : null;
  const deciding = target ? decidingFixtures(career, id, [career.playerClubId, ...target.clubIds]) : [];
  return <Panel title="Poängläget" actions={<span className="cc-muted">{remaining} ligamatcher kvar · {remaining * 2} poäng att spela om</span>}>
    <div className="cc-strip" role="img" aria-label={`Poäng per placering. Din klubb är ${centre.position}:a med ${centre.points} poäng.`}>
      {annotated.map(a => <span key={a.row.clubId} className="cc-strip-bar" data-own={a.row.clubId === career.playerClubId || undefined} data-zone={a.zone?.tone} data-line={lines.has(a.position) || undefined} title={`${a.position}. ${short(a.row.clubId)} · ${a.row.points} p`}><i style={{ height: `${Math.max(4, (a.row.points / max) * 100)}%` }} /><small>{a.position}</small></span>)}
    </div>
    {gaps.length ? <div className="cc-gaps">{gaps.map(({ k, g }) => <button key={k} type="button" className="cc-gap" data-tone={g.tone} aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}>
      <span>{k === 'above' ? `Upp till ${g.label.toLowerCase()}` : `Marginal till ${g.label.toLowerCase()}`}</span>
      <span className="cc-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (Math.max(0, g.gap) / scale) * 100)}%` }} /></span>
      <b>{g.gap} p</b>
    </button>)}</div> : <p className="cc-muted">Ligan har inga verifierade zoner, så det finns inga linjer att mäta avståndet mot.</p>}
    {target && <div className="cc-deciding"><h3>Matcherna som avgör · {short(target.clubIds[0])} och {short(target.clubIds[1])} vid linjen</h3>{deciding.length ? <ul>{deciding.slice(0, 8).map(f => <li key={f.id} data-own={f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId || undefined}><Link href={`/career/fixtures/${encodeURIComponent(f.id)}`}><span className="cc-num">{f.date.slice(5)}</span><span>{short(f.homeClubId)} – {short(f.awayClubId)}</span><span>Omg {f.round}</span></Link></li>)}</ul> : <p className="cc-muted">Inga ligamatcher kvar för klubbarna vid linjen.</p>}</div>}
  </Panel>;
}

// ---------------------------------------------------------------- CMP-01e: crest tiles
function ClubGrid({ tiles, onPeek }: { tiles: ReturnType<typeof clubTiles>; onPeek: (id: string) => void }) {
  if (!tiles.length) return <EmptyState>Inga klubbar registrerade i tävlingen den här säsongen.</EmptyState>;
  return <ul className="cc-club-grid">{tiles.map(t => <li key={t.clubId}><button type="button" className="cc-club-tile" data-own={t.own || undefined} onClick={() => onPeek(t.clubId)} aria-label={`Snabbtitt: ${t.name}`}>
    <ClubCrest clubId={t.clubId} shortName={t.shortName} primaryColor={getClub(t.clubId)?.primaryColor ?? ''} size={48} />
    <strong>{t.name}</strong>
    <small>{t.city ?? 'Ort saknas'}</small>
    <span className="cc-tile-meta">{t.position ? <><b>{t.position}:a</b> · {t.points} p</> : t.squad != null ? `${t.squad} spelare` : 'Ingen truppdata'}</span>
  </button></li>)}</ul>;
}

// ---------------------------------------------------------------- CMP-01f: roll of honour
function RollOfHonour({ career, id }: { career: CareerState; id: string }) {
  const rows = useMemo(() => rollOfHonour(career, id), [career, id]);
  const players = useMemo(() => new Map(managementPlayers(career).map(p => [p.id, p])), [career]);
  if (!rows.length) return <Panel title="Historik"><EmptyState>Ingen avslutad säsong i den här tävlingen ännu. När en säsong är slut sparas vinnare, din placering och skyttekungen här. <Link href="/career/history">Karriärens historik →</Link></EmptyState></Panel>;
  return <Panel title="Hedersrollen"><ol className="cc-honours">{rows.map(r => { const scorer = r.topScorer ? players.get(r.topScorer.playerId) : undefined; return <li key={r.seasonId}>
    <span className="cc-honour-season">{r.seasonId}</span>
    <span className="cc-honour-champ">{r.championId ? <><ClubCrest clubId={r.championId} shortName={short(r.championId)} primaryColor={getClub(r.championId)?.primaryColor ?? ''} size={28} /><span><small>{r.championLabel}</small><ClubLink clubId={r.championId} showCrest={false}>{getClub(r.championId)?.name ?? r.championId}</ClubLink>{r.titleWinnerId && r.titleWinnerId !== r.championId && <small>SM-guld: {short(r.titleWinnerId)}</small>}</span></> : '—'}</span>
    <span className="cc-honour-own"><small>Din placering</small><b>{r.ownPosition ? `${r.ownPosition}/${r.teams}` : '—'}</b></span>
    <span className="cc-honour-scorer"><small>Skyttekung</small><span>{r.topScorer ? <>{scorer ? <PlayerLink playerId={scorer.id}>{scorer.firstName} {scorer.lastName}</PlayerLink> : 'Spelare utanför världen'} · {r.topScorer.goals} mål</> : '—'}</span></span>
    <Link className="cc-honour-link" href={`/career/history?season=${encodeURIComponent(r.seasonId)}`}>Säsongen →</Link>
  </li>; })}</ol></Panel>;
}
