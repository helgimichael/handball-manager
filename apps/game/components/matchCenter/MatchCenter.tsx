'use client';
import { useMemo, useState, useId, useRef, type ReactNode } from 'react';
import type { MatchFrame, MatchPerson, ProductionMatchSession, PlayedMatchArchive } from '@/lib/career/productionMatch';
import type { CoreEvent, TeamId } from '@handball-manager/handball-engine/src/v2/core/state';
import { archivedMatchModel, createLiveMatchReader, snapshotsFor, clockText, ROLE_LABEL, type MatchCenterModel, type MatchPresentationEvent } from '@/lib/matchCenter/model';
import { getClub, COMPETITIONS } from '@/lib/game-data';
import ClubCrest from '@/components/ClubCrest';
import { ENVIRONMENTS } from '@/components/clubhq/environments';
import { TacticalCourt, StructureCourt } from './TacticalCourt';
import { ScoreFlow, PlayersView, StatisticsView } from './WorkspaceViews';
import { MATCH_VIEWS, VIEW_LABELS, overviewFacts, overviewMoments, performers, tacticalStory, momentMatches, MOMENT_FILTERS, FILTER_LABELS, type MatchView, type MomentFilter } from '@/lib/matchCenter/workspace';
import { zonePost } from '@handball-manager/handball-engine/src/v2/core/defence';
import { TimeoutOverlay, getContextualInstructions } from './TimeoutOverlay';
import type { PlayerRow } from '@/lib/matchCenter/model';
import type { MatchCommand } from '@/lib/career/productionMatch';
import type { MatchControl } from '@/lib/media/discipline';
import { PlanOptions } from './PlanCourt';
import { EnergyBar } from './EnergyBar';
import { PHASE_LABEL, energyBoard, halftimeSuggestions, matchPhase, miniStats, momentumPath, momentumSeries, ownMargin, timelineMarkers, type MatchPhase, type TimelineCategory } from './liveFlow';
const stateLabels = { PREMATCH: 'INFÖR AVKAST', LIVE: 'LIVE', PAUSED: 'PAUSAD', TIMEOUT: 'TIMEOUT', HALFTIME: 'HALVTID', FULLTIME: 'SLUTRESULTAT' };
/** MDY-02l: the continuous court is the "Plan" view, after the four review views (keyboard order unchanged). */
type SurfaceView = MatchView | 'PLAN';
const SURFACE_LABELS: Record<SurfaceView, string> = { ...VIEW_LABELS, PLAN: 'Plan' };
function nextView(views: readonly SurfaceView[], current: SurfaceView, key: string): SurfaceView | null {
    const i = views.indexOf(current);
    if (key === 'Home') return views[0];
    if (key === 'End') return views.at(-1)!;
    if (key === 'ArrowRight') return views[(i + 1) % views.length];
    if (key === 'ArrowLeft') return views[(i + views.length - 1) % views.length];
    return null;
}
const ROLE_ORDER = ['GK', 'LW', 'LB', 'CB', 'P', 'P2', 'RB', 'RW'];
function ClubIdentity({ id, side, suspensions = [], disqualifications = [] }: {
    id: string;
    side: string;
    suspensions?: PlayerRow[];
    disqualifications?: PlayerRow[];
}) {
    const club = getClub(id);
    return (
        <div className="mc-club">
            <ClubCrest shortName={club?.shortName ?? '—'} primaryColor={club?.primaryColor ?? ''} clubId={club?.id} size={66}/>
            <div>
                <small>{side}</small>
                <strong>{club?.shortName ?? (side === 'HEMMA' ? 'Hemmalaget' : 'Bortalaget')}</strong>
                <span>{club?.name}</span>
                {(suspensions.length > 0 || disqualifications.length > 0) && (
                    <div className="mc-club-sanctions" aria-label={`Utvisningar och kort för ${club?.shortName ?? side}`}>
                        {suspensions.map(s => (
                            <span key={s.id} className="mc-suspension-badge" title={`${s.name} utvisad i 2 minuter`}>
                                <i className="mc-suspension-icon" aria-hidden="true">⏱️</i>
                                <b>2 min</b> #{s.number} {s.name.split(' ').pop()} <time>{clockText(s.remainingSuspension)}</time>
                            </span>
                        ))}
                        {disqualifications.map(d => (
                            <span key={d.id} className="mc-disqualification-badge" title={`${d.name} har fått rött kort`}>
                                <b>🟥</b> #{d.number} {d.name.split(' ').pop()}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
export function KeyMoment({ moment, events, frames, people }: {
    moment: MatchPresentationEvent | null;
    events: readonly CoreEvent[];
    frames: readonly MatchFrame[];
    people: MatchPerson[];
}) {
    const snapshots = useMemo(() => moment ? snapshotsFor(moment.canonicalEventId, events, frames, people) : [], [moment, events, frames, people]);
    const [fullCourt, setFullCourt] = useState(false);
    const story = useMemo(() => moment ? tacticalStory(moment, events, people, snapshots) : null, [moment, events, people, snapshots]);
    const [step, setStep] = useState(0), snapshot = snapshots[Math.min(step, snapshots.length - 1)];
    return <section className="mc-key-moment" aria-label="Taktiskt nyckelögonblick"><header><div><span className="game-overline">Nyckelögonblick</span><h2>{moment?.headline ?? 'Matchen tar form'}</h2></div>{moment && <time>{clockText(moment.timestamp)}</time>}</header>{moment && <p>{story?.explanation ?? moment.detail}</p>}{snapshot ? <><div className="mc-step-controls" aria-label="Steg i nyckelögonblicket">{snapshots.map((s, i) => <button key={s.tick} type="button" aria-pressed={i === Math.min(step, snapshots.length - 1)} onClick={() => setStep(i)}>{i + 1}. {story?.stages[i] ?? s.label}<small>{clockText(s.timestamp)}</small></button>)}</div><button type="button" className="mc-camera-control" aria-pressed={fullCourt} onClick={() => setFullCourt(!fullCourt)}>{fullCourt ? 'Visa närbild' : 'Visa helplan'}</button><TacticalCourt snapshot={{...snapshot,label:story?.stages[Math.min(step, snapshots.length - 1)] ?? snapshot.label}} fullCourt={fullCourt} focusY={snapshots.at(-1)?.ball.y} actors={story?.actors}/><p className="mc-footnote">Positionerna är sparade vid {clockText(snapshot.timestamp)}. Pilar visar berörda spelare och bollens registrerade läge, inte en animerad bana.</p></> : <p className="mc-empty">{moment ? 'Den här händelsen saknar sparade positionsbilder. Kommentaren och matchstatistiken finns kvar.' : 'Välj en viktig händelse i flödet för att se den steg för steg.'}</p>}</section>;
}
/** Arena Nights Phase 2 (MDY-02a): the always-visible score bug's half indicator, players on court and
 *  timeouts left. Reads only the model; archives carry no manpower/timeouts, so those pips are omitted. */
function ScoreBugMeta({ model, names }: { model: MatchCenterModel; names: Record<TeamId, string> }) {
    const half = model.status === 'FULLTIME' ? 'Slut' : model.status === 'HALFTIME' ? 'Halvtid' : model.period === 2 ? '2:a halvlek' : model.period === 1 ? '1:a halvlek' : null;
    const pips = (n: number, max: number, label: string) => <i className="mc-pips" role="img" aria-label={label}>{Array.from({ length: max }, (_, k) => <b key={k} data-on={k < n ? 'true' : undefined}/>)}</i>;
    return <span className="mc-scorebug-meta">
        {half && <em className="mc-scorebug-half" data-phase={model.status.toLowerCase()}>{half}</em>}
        {model.manpower && model.status !== 'FULLTIME' && <span className="mc-scorebug-row" title="Utespelare på plan">{(['HOME', 'AWAY'] as const).map(t => <span key={t}><small>{names[t]}</small>{pips(model.manpower![t], Math.max(6, model.manpower![t]), `${names[t]}: ${model.manpower![t]} utespelare på plan`)}</span>)}</span>}
        {model.timeouts && model.status !== 'FULLTIME' && <span className="mc-scorebug-row" title="Timeouts kvar denna halvlek">TO {(['HOME', 'AWAY'] as const).map(t => <span key={t}>{pips(model.timeouts![t], 1, `${names[t]}: ${model.timeouts![t]} timeout kvar`)}</span>)}</span>}
    </span>;
}

function classifyBroadcastEvent(e: MatchPresentationEvent): { tag: string; tone: 'goal' | 'save' | 'penalty' | 'suspension' | 'timeout' | 'period' | 'play' } {
    const h = `${e.headline} ${e.detail}`.toLowerCase();
    if (h.includes('2 min') || h.includes('utvisning') || h.includes('rött kort')) return { tag: '2 MIN UTVISNING', tone: 'suspension' };
    if (h.includes('timeout')) return { tag: 'TIMEOUT', tone: 'timeout' };
    if (h.includes('7-meter') || h.includes('straff')) return { tag: '7-METERSKAST', tone: 'penalty' };
    if (h.includes('räddar') || h.includes('räddning')) return { tag: 'RÄDDNING', tone: 'save' };
    if (h.includes('halvtid') || h.includes('slutsignal') || h.includes('avkast')) return { tag: 'MATCHFAS', tone: 'period' };
    if (e.importance === 'KEY' || h.includes('mål') || h.includes('sätter') || h.includes('reducerar') || h.includes('utökar') || h.includes('kvitterar')) return { tag: 'MÅL', tone: 'goal' };
    return { tag: 'SPELSEKVEN', tone: 'play' };
}

function Commentary({ compact = false, stream, names, keyOnly, importantOnly, onOpen, onView, onToggle }: { compact?: boolean; stream: MatchPresentationEvent[]; names: Record<TeamId, string>; keyOnly: boolean; importantOnly: boolean; onOpen: (id: string) => void; onView: () => void; onToggle: () => void; }) {
    return (
        <section className="mc-commentary" aria-label="Matchkommentarer">
            <header>
                <h2>Från planen · Direktflöde</h2>
                {compact ? (
                    <button type="button" onClick={onView}>Alla händelser →</button>
                ) : (
                    <button type="button" aria-pressed={keyOnly || importantOnly} disabled={importantOnly} onClick={onToggle}>
                        {keyOnly || importantOnly ? 'Visa alla händelser' : 'Viktiga händelser'}
                    </button>
                )}
            </header>
            <ol>
                {stream.slice(0, compact ? 8 : 60).map(e => {
                    const badge = classifyBroadcastEvent(e);
                    return (
                        <li key={e.canonicalEventId} data-team={e.team ?? 'NEUTRAL'} data-importance={e.importance} data-tone={badge.tone}>
                            <time>{clockText(e.timestamp)}</time>
                            <div>
                                <span className="mc-comm-meta">
                                    <i className="mc-comm-badge" data-tone={badge.tone}>{badge.tag}</i>
                                    {e.team ? names[e.team] : 'Matchen'} · {e.score.join('–')}
                                </span>
                                {e.replayReference ? (
                                    <button type="button" onClick={() => onOpen(e.canonicalEventId)}>{e.headline}</button>
                                ) : (
                                    <strong>{e.headline}</strong>
                                )}
                                {!compact && <p>{e.detail}</p>}
                            </div>
                        </li>
                    );
                })}
            </ol>
            {!stream.length && <p className="mc-empty">Flödet börjar vid avkast.</p>}
        </section>
    );
}
/** MDY-02 C: the momentum line under the score bug -- registered goal difference over time from the own side. */
function MomentumLine({ events, team, clock, names }: { events: MatchPresentationEvent[]; team: TeamId; clock: number | null; names: Record<TeamId, string> }) {
    const points = momentumSeries(events, team), now = points.at(-1)!.diff;
    const until = clock === null ? points.at(-1)!.at : Math.min(1, clock / 3600000);
    const signed = now > 0 ? `+${now}` : String(now);
    return <figure className="mc-momentum" data-trend={now > 0 ? 'up' : now < 0 ? 'down' : 'even'} aria-label={`Målskillnad över matchen för ${names[team]}: ${signed} just nu.`}>
        <svg viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true"><path className="mc-momentum-guide" d="M0 20H600 M300 2V38" /><path className="mc-momentum-line" d={momentumPath(points, until)} /></svg>
        <figcaption>{names[team]} {signed}</figcaption>
    </figure>;
}

/** MDY-02c: the five live numbers, own side first. */
function MiniStats({ model, team, names, title = 'Matchen i siffror' }: { model: MatchCenterModel; team: TeamId; names: Record<TeamId, string>; title?: string }) {
    const opp: TeamId = team === 'HOME' ? 'AWAY' : 'HOME';
    return <section className="mc-ministats" aria-label={title}>
        <header><h2>{title}</h2><small><b>{names[team]}</b> · {names[opp]}</small></header>
        <dl>{miniStats(model.result, team).map(s => <div key={s.id} data-better={s.better === null ? undefined : String(s.better)} title={s.title}><dt>{s.label}</dt><dd><b>{s.own}</b><small>{s.opp}</small></dd></div>)}</dl>
    </section>;
}

/** MDY-02 C walk-out: the starting sevens before throw-off, from the live session's players on court. */
function WalkOut({ model, names, team, session }: { model: MatchCenterModel; names: Record<TeamId, string>; team: TeamId; session?: ProductionMatchSession }) {
    const side = (t: TeamId) => model.players.filter(p => p.team === t && p.population === 'COURT').sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
    const tactics = session?.core.coaching[team];
    return <section className="mc-walkout" aria-label="Inmarsch">
        <header><span className="game-overline">Inmarsch · avkast väntar</span><h2>Startsjuorna är på plan.</h2><p>Matchen börjar när du trycker Spela. Justera taktiken i bänken innan avkast om du vill.</p></header>
        <div className="mc-walkout-teams">{(['HOME', 'AWAY'] as const).map(t => <div key={t} data-own={t === team || undefined}>
            <h3>{names[t]} <small>{t === 'HOME' ? 'Hemma' : 'Borta'}</small></h3>
            {side(t).length ? <ol>{side(t).map(p => <li key={p.id}><b>{p.number}</b><span>{p.name}</span><small>{ROLE_LABEL[p.role]}</small></li>)}</ol> : <p className="mc-empty">Startsjuan visas när laget är registrerat.</p>}
        </div>)}</div>
        {tactics && <p className="mc-walkout-plan">Din matchplan: försvar {tactics.defence} · {tactics.rotation ? 'assistentbyten på' : 'du byter själv'}.</p>}
    </section>;
}

/** MDY-02c (A) live-first overview: the current moment on court, the feed beside it, five numbers beneath. */
function LiveNow({ model, team, names, events, frames, people, stream, keyOnly, importantOnly, onToggleKey, onAllEvents }: { model: MatchCenterModel; team: TeamId; names: Record<TeamId, string>; events: readonly CoreEvent[]; frames: readonly MatchFrame[]; people: MatchPerson[]; stream: MatchPresentationEvent[]; keyOnly: boolean; importantOnly: boolean; onToggleKey: () => void; onAllEvents: () => void }) {
    const [pinned, setPinned] = useState<string | null>(null);
    const moment = (pinned ? model.keyMoments.find(m => m.canonicalEventId === pinned) ?? model.events.find(m => m.canonicalEventId === pinned) : null) ?? model.keyMoments.at(-1) ?? null;
    return <div className="mc-live-now">
        <div className="mc-live-court">
            {pinned && <button type="button" className="mc-follow-live" onClick={() => setPinned(null)}>Följ live →</button>}
            <KeyMoment key={moment?.canonicalEventId ?? 'none'} moment={moment} events={events} frames={frames} people={people}/>
        </div>
        <Commentary compact stream={stream} names={names} keyOnly={keyOnly} importantOnly={importantOnly} onOpen={setPinned} onView={onAllEvents} onToggle={onToggleKey}/>
        <MiniStats model={model} team={team} names={names}/>
    </div>;
}

/** MDY-02i (A) half-time briefing: first-half numbers, energy (lowest first) and the assistant's suggestions. */
function HalftimeBriefing({ model, team, names, session, onCommand, onPlayer, action }: { model: MatchCenterModel; team: TeamId; names: Record<TeamId, string>; session?: ProductionMatchSession; onCommand?: (command: MatchCommand) => void; onPlayer?: (id: string) => void; action?: ReactNode }) {
    const opp: TeamId = team === 'HOME' ? 'AWAY' : 'HOME';
    const board = energyBoard(model.players, team);
    const core = session?.core;
    const directives = getContextualInstructions(ownMargin(model.result, team), core?.coaching[opp].defence ?? '6:0', 2);
    const suggestions = halftimeSuggestions(directives, model.players, team, core?.coaching[team].instruction ?? null);
    const own = team === 'HOME' ? model.result.homeGoals : model.result.awayGoals, theirs = team === 'HOME' ? model.result.awayGoals : model.result.homeGoals;
    const row = (p: PlayerRow) => <li key={p.id}><span><b>#{p.number}</b> {p.name}</span><small>{p.position}</small><EnergyBar energy={p.energy}/></li>;
    return <section className="mc-halftime" aria-label="Halvtidsgenomgång">
        <header className="mc-decision-heading" role="status"><span className="game-overline">Halvtid · {names.HOME} {model.result.homeGoals}–{model.result.awayGoals} {names.AWAY}</span><h2>Nästa halvlek börjar med ditt beslut.</h2><p>Gör ändringar i bänken. De gäller från andra halvlek.</p></header>
        <div className="mc-halftime-panels">
            <article className="mc-ht-panel" data-panel="numbers"><h3>Första halvlek i siffror</h3>
                <table><thead><tr><th scope="col">{names[team]}</th><th scope="col"><span className="mc-sr">Mått</span></th><th scope="col">{names[opp]}</th></tr></thead><tbody>
                    <tr data-better={own === theirs ? undefined : String(own > theirs)}><td>{own}</td><th scope="row">Mål</th><td>{theirs}</td></tr>
                    {miniStats(model.result, team).map(s => <tr key={s.id} data-better={s.better === null ? undefined : String(s.better)}><td>{s.own}</td><th scope="row">{s.label}</th><td>{s.opp}</td></tr>)}
                </tbody></table>
            </article>
            <article className="mc-ht-panel" data-panel="energy"><h3>Energi</h3>
                <h4>På plan · lägst först</h4>{board.court.length ? <ul className="mc-ht-energy">{board.court.map(row)}</ul> : <p className="mc-empty">Inga spelare på plan.</p>}
                <h4>Bänk</h4>{board.bench.length ? <ul className="mc-ht-energy">{board.bench.slice(0, 8).map(row)}</ul> : <p className="mc-empty">Ingen tillgänglig spelare på bänken.</p>}
            </article>
            <article className="mc-ht-panel" data-panel="suggestions"><h3>Assistentens förslag</h3>
                {suggestions.length ? <ul className="mc-ht-suggestions">{suggestions.map(s => {
                    const directive = s.id.startsWith('directive:') ? directives.find(d => `directive:${d.id}` === s.id) : null, rest = s.id.startsWith('rest:') ? s.id.slice(5) : null;
                    return <li key={s.id}><strong>{s.text}</strong><p>{s.detail}</p>
                        {directive && onCommand && <button type="button" className="hm-btn hm-btn-sm" onClick={() => onCommand({ kind: 'TACTICS', team, patch: directive.patch })}>Tillämpa direktivet</button>}
                        {rest && onPlayer && <button type="button" className="hm-btn hm-btn-sm" onClick={() => onPlayer(rest)}>Välj ersättare i bänken</button>}
                    </li>;
                })}</ul> : <p className="mc-empty">Inga förslag just nu: ingen spelare under 60 % energi och inget direktiv sticker ut för ställningen.</p>}
            </article>
        </div>
        {action && <footer className="mc-halftime-start">{action}<small>Andra halvlek börjar när du trycker. Bänken är öppen till dess.</small></footer>}
    </section>;
}

/** MDY-02d (A) timeline scrubber: every key moment on a 0-60 track, coloured by category, home above the line. */
const CATEGORY_LABEL: Record<TimelineCategory, string> = { GOAL: 'Mål', SEVEN_METRE: '7m', SAVE: 'Räddning', BREAKTHROUGH: 'Genombrott', TRANSITION: 'Omställning', DEFENCE: 'Försvar', OTHER: 'Övrigt' };
function MomentTimeline({ model, filter, selected, names, onSelect }: { model: MatchCenterModel; filter: MomentFilter; selected: string | null; names: Record<TeamId, string>; onSelect: (id: string, active: boolean) => void }) {
    const markers = timelineMarkers(model.keyMoments, model.shots, filter);
    const used = [...new Set(markers.map(m => m.category))];
    return <figure className="mc-timeline">
        <figcaption><strong>Tidslinje 0–60</strong><span>{names.HOME} ovanför linjen · {names.AWAY} under</span></figcaption>
        <div className="mc-timeline-track" aria-hidden="true">
            <i className="mc-timeline-half" />
            {markers.map(m => <button key={m.id} type="button" tabIndex={-1} className="mc-timeline-marker" style={{ left: `${(m.at * 100).toFixed(2)}%` }} data-category={m.category.toLowerCase()} data-team={m.team ?? 'NEUTRAL'} data-active={m.active || undefined} aria-current={m.id === selected ? 'true' : undefined} title={`${clockText(m.timestamp)} · ${m.headline}`} onClick={() => onSelect(m.id, m.active)} />)}
        </div>
        <div className="mc-timeline-scale" aria-hidden="true"><span>0′</span><span>15′</span><span>30′</span><span>45′</span><span>60′</span></div>
        {used.length > 0 && <ul className="mc-timeline-legend">{used.map(c => <li key={c} data-category={c.toLowerCase()}>{CATEGORY_LABEL[c]}</li>)}</ul>}
        {!markers.length && <p className="mc-empty">Nyckelögonblicken placeras på tidslinjen när matchen spelas.</p>}
    </figure>;
}

export function MatchCenterSurface({ model, fixture, frames, people, events, team, controls, coach, onPlayer, experimental, importantOnly = false, defaultShowExperimental = false, session, onCommand, onResumeTimeout, callingTeam, control, primaryAction, hideOverview = false }: {
    model: MatchCenterModel; fixture: ProductionMatchSession['fixture']; frames: readonly MatchFrame[];
    people: MatchPerson[]; events: readonly CoreEvent[]; team: TeamId; controls?: ReactNode;
    coach?: ReactNode; onPlayer?: (id: string) => void; experimental?: ReactNode; importantOnly?: boolean; defaultShowExperimental?: boolean;
    session?: ProductionMatchSession; onCommand?: (command: MatchCommand) => void; onResumeTimeout?: () => void; callingTeam?: TeamId; control?: MatchControl | null;
    /** The one primary transport action. At half-time and at the live final whistle it moves into the phase card. */
    primaryAction?: ReactNode;
    /** Embedding pages (the match report) that show their own summary can start without the 'Översikt' view. */
    hideOverview?: boolean;
}) {
    const views: readonly SurfaceView[] = ([...MATCH_VIEWS, ...(experimental ? ['PLAN' as const] : [])] as SurfaceView[]).filter(v => !(hideOverview && v === 'OVERVIEW'));
    const [view, setView] = useState<SurfaceView>(experimental && defaultShowExperimental ? 'PLAN' : views[0]);
    const [status, setStatus] = useState(model.status);
    const phase: MatchPhase = matchPhase(model.status);
    const homeSuspensions = useMemo(() => model.players.filter(p => p.team === 'HOME' && p.population === 'SUSPENDED' && p.remainingSuspension > 0), [model.players]);
    const awaySuspensions = useMemo(() => model.players.filter(p => p.team === 'AWAY' && p.population === 'SUSPENDED' && p.remainingSuspension > 0), [model.players]);
    const homeDisqualifications = useMemo(() => model.players.filter(p => p.team === 'HOME' && p.population === 'DISQUALIFIED'), [model.players]);
    const awayDisqualifications = useMemo(() => model.players.filter(p => p.team === 'AWAY' && p.population === 'DISQUALIFIED'), [model.players]);
    // Interval transitions return to the shared decision/review overview, once.
    if (status !== model.status) {
        setStatus(model.status);
        if (['HALFTIME', 'TIMEOUT', 'FULLTIME'].includes(model.status) && !hideOverview) setView('OVERVIEW');
    }
    const [playerFocus, setPlayerFocus] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null), [filter, setFilter] = useState<MomentFilter>('ALL');
    const [keyOnly, setKeyOnly] = useState(false), [trails, setTrails] = useState(false);
    const uid = useId().replaceAll(':', ''), navigation = useRef<HTMLElement>(null);
    const buttons = useRef<Partial<Record<SurfaceView, HTMLButtonElement | null>>>({});
    const reviewing = model.status === 'FULLTIME';
    const live = !!onCommand;
    const names = useMemo(() => ({ HOME: getClub(fixture.homeClubId)?.shortName ?? 'Hemmalaget', AWAY: getClub(fixture.awayClubId)?.shortName ?? 'Bortalaget' }), [fixture.homeClubId, fixture.awayClubId]);
    const moments = useMemo(() => model.keyMoments.filter(m => momentMatches(m, filter, model.shots)), [model.keyMoments, model.shots, filter]);
    const moment = moments.find(e => e.canonicalEventId === selected) ?? moments.at(-1) ?? null;
    const facts = useMemo(() => overviewFacts(model, names), [model, names]);
    const previews = useMemo(() => overviewMoments(model), [model]);
    const top = useMemo(() => performers(model), [model]);
    const stream = model.events.filter(e => !(keyOnly || importantOnly) || e.importance === 'KEY').slice(-60).reverse();
    function openMoment(id: string) { setSelected(id); setFilter('ALL'); setView('MOMENTS'); buttons.current.MOMENTS?.focus({ preventScroll: true }); navigation.current?.scrollIntoView({ block: 'nearest' }); }
    function changeView(next: SurfaceView) { setView(next); navigation.current?.scrollIntoView({ block: 'nearest' }); }
    const primaryInPhase = view === 'OVERVIEW' && !!primaryAction && (phase === 'HALFTIME' || (phase === 'FINAL' && live));

    const latestEvent = model.events.at(-1) ?? null;
    const latestBadge = latestEvent ? classifyBroadcastEvent(latestEvent) : null;
    const homeClub = getClub(fixture.homeClubId);
    const finalTop = top.filter(t => t.player).slice(0, 3).map(t => ({ label: t.label, name: t.player!.name, line: `${t.player!.role === 'GK' && t.player!.shotsFaced > 0 ? `${t.player!.saves}/${t.player!.shotsFaced} räddningar (${Math.round(100 * t.player!.saves / t.player!.shotsFaced)} %)` : `${t.player!.goals} mål`} · betyg ${t.player!.rating?.toFixed(1) ?? '—'}` }));
    const suspended = [...homeSuspensions, ...awaySuspensions];

    return <div className="mc-match mc-workspace" data-phase={model.status.toLowerCase()} data-flow-phase={phase.toLowerCase()} data-view={view} data-match-mode="MATCH_CENTER">
        <a href={`#${uid}-controls`} className="mc-skip">Till matchbeslut</a>
        {view === 'OVERVIEW' && (
            <header className="mc-header xp-photo-hero" style={ENVIRONMENTS["arena-matchday"].backdropStyle}>
                <div className="mc-header-meta">
                    <span>
                        {fixture.type === 'FRIENDLY' ? 'Träningsmatch' : fixture.type === 'CUP' ? 'Svenska Cupen' : fixture.type === 'PLAYOFF' ? 'SM-slutspel' : fixture.type === 'QUALIFIER' ? 'Kvalspel' : COMPETITIONS.find(c => c.id === fixture.competitionId)?.name ?? 'Match'} · {fixture.date}
                        {homeClub?.venue ? ` · ${homeClub.venue}` : ''}
                    </span>
                    <span className="mc-broadcast-pill" data-live={model.status === 'LIVE' ? 'true' : undefined}>
                        {model.status === 'LIVE' ? '● SÄNDNING LIVE' : stateLabels[model.status]}
                    </span>
                </div>
                <div className="mc-scoreline">
                    <ClubIdentity id={fixture.homeClubId} side="HEMMA" suspensions={homeSuspensions} disqualifications={homeDisqualifications}/>
                    <div className="mc-score">
                        {/* Arena Nights Phase 2 (MDY-02a): the figure re-mounts on every score change so the restrained score pop replays. */}
                        <strong key={`${model.result.homeGoals}-${model.result.awayGoals}`} className="mc-score-figure">{model.result.homeGoals}<span>–</span>{model.result.awayGoals}</strong>
                        <small>{clockText(model.clock)} · {stateLabels[model.status]}</small>
                    </div>
                    <ClubIdentity id={fixture.awayClubId} side="BORTA" suspensions={awaySuspensions} disqualifications={awayDisqualifications}/>
                </div>
                {!reviewing && (
                    <div className="mc-match-state">
                        <span>{model.period === 2 ? 'Andra halvlek' : 'Första halvlek'} · {clockText(model.remaining)} kvar</span>
                        {model.manpower && (() => {
                            const hasSusp = homeSuspensions.length > 0 || awaySuspensions.length > 0;
                            const is7v6 = model.manpower.HOME === 7 || model.manpower.AWAY === 7;
                            const label = is7v6 && !hasSusp
                                ? 'Utespelare på plan · 7 mot 6 (tom kasse)'
                                : is7v6 && hasSusp
                                ? 'Utespelare på plan · 7 mot 6 vid utvisning'
                                : hasSusp
                                ? `Utespelare på plan · ${model.manpower.HOME > model.manpower.AWAY ? '6v5 övertag' : model.manpower.HOME < model.manpower.AWAY ? '5v6 undertag' : 'Utvisningar kvittade'}`
                                : 'Utespelare på plan · 6v6 jämnt';
                            return (
                                <strong className="mc-manpower-badge" data-powerplay={model.manpower.HOME !== model.manpower.AWAY ? 'true' : undefined} data-seven-v-six={is7v6 ? 'true' : undefined}>
                                    {model.manpower.HOME} mot {model.manpower.AWAY}
                                    <small>{label}</small>
                                </strong>
                            );
                        })()}
                        {suspended.length > 0 && (
                            <div className="mc-active-suspensions-summary" aria-live="polite">
                                {homeSuspensions.map(s => <span key={s.id} className="mc-timer-chip home">{names.HOME} <b>#{s.number} {s.name.split(' ').pop()}</b> {clockText(s.remainingSuspension)}</span>)}
                                {awaySuspensions.map(s => <span key={s.id} className="mc-timer-chip away">{names.AWAY} <b>#{s.number} {s.name.split(' ').pop()}</b> {clockText(s.remainingSuspension)}</span>)}
                            </div>
                        )}
                        {model.timeouts && <span>Timeouts kvar: {names.HOME} {model.timeouts.HOME} · {names.AWAY} {model.timeouts.AWAY}</span>}
                    </div>
                )}
                {latestEvent && latestBadge && (
                    <div key={latestEvent.canonicalEventId} className="mc-broadcast-callout" data-tone={latestBadge.tone} aria-live="polite">
                        <span className="mc-broadcast-callout-tag" data-tone={latestBadge.tone}>{latestBadge.tag}</span>
                        <time>{clockText(latestEvent.timestamp)}</time>
                        <strong>{latestEvent.headline}</strong>
                        <span className="mc-broadcast-callout-detail">{latestEvent.detail}</span>
                    </div>
                )}
            </header>
        )}
        <nav className="mc-workspace-nav" ref={navigation} aria-label="Matchens vyer"><div className="mc-compact-identity"><strong>{names.HOME} <b key={`${model.result.homeGoals}-${model.result.awayGoals}`} className="mc-score-figure">{model.result.homeGoals}–{model.result.awayGoals}</b> {names.AWAY}</strong><small>{clockText(model.clock)} · {stateLabels[model.status]}</small><ScoreBugMeta model={model} names={names}/>{(suspended.length > 0 || model.manpower?.HOME === 7 || model.manpower?.AWAY === 7) && <span className="mc-compact-powerplay" title={model.manpower?.HOME === 7 || model.manpower?.AWAY === 7 ? '7 mot 6 spel' : 'Aktiva utvisningar'}>{model.manpower ? `${model.manpower.HOME}v${model.manpower.AWAY}` : 'Övertag'}{(model.manpower?.HOME === 7 || model.manpower?.AWAY === 7) && <b className="mc-7v6-pill">7v6</b>}{suspended.map(s => <time key={s.id}>#{s.number} {clockText(s.remainingSuspension)}</time>)}</span>}<span className="mc-phase-chip" data-phase={phase.toLowerCase()}>{PHASE_LABEL[phase]}</span><MomentumLine events={model.events} team={team} clock={model.clock} names={names}/></div><div role="tablist" aria-label="Matchvy">{views.map(v => <button type="button" key={v} id={`${uid}-${v}-tab`} role="tab" aria-selected={view === v} aria-controls={`${uid}-${v}-panel`} tabIndex={view === v ? 0 : -1} ref={element => { buttons.current[v] = element; }} onClick={() => changeView(v)} onKeyDown={e => { const next = nextView(views, v, e.key); if (next) { e.preventDefault(); changeView(next); buttons.current[next]?.focus(); } }}>{SURFACE_LABELS[v]}</button>)}</div></nav>
        <div id={`${uid}-controls`} className="mc-controls mc-transport" data-phase={phase.toLowerCase()}>{!primaryInPhase && primaryAction}{controls}</div>
        <div className={`mc-active-layout ${coach && !reviewing ? 'mc-managing' : ''}`}>
            <section id={`${uid}-${view}-panel`} role="tabpanel" aria-labelledby={`${uid}-${view}-tab`} tabIndex={0} className="mc-view-panel">
                {view === 'OVERVIEW' && <div className="mc-phase" key={phase} data-phase={phase.toLowerCase()}>
                    {phase === 'WALKOUT' && <WalkOut model={model} names={names} team={team} session={session}/>}
                    {phase === 'HUDDLE' && (session
                        ? <TimeoutOverlay session={session} model={model} team={team} names={names} callingTeam={callingTeam} onCommand={onCommand} onResumeTimeout={onResumeTimeout} control={control}/>
                        : <section className="mc-decision-heading" role="status"><span className="game-overline">{stateLabels[model.status]}</span><h2>Samla laget. Välj nästa instruktion.</h2></section>)}
                    {phase === 'HALFTIME' && <HalftimeBriefing model={model} team={team} names={names} session={session} onCommand={control?.by === 'ASSISTANT' ? undefined : onCommand} onPlayer={onPlayer} action={primaryInPhase ? primaryAction : undefined}/>}
                    {(phase === 'LIVE' || (phase === 'HUDDLE' && !session)) && <LiveNow model={model} team={team} names={names} events={events} frames={frames} people={people} stream={stream} keyOnly={keyOnly} importantOnly={importantOnly} onToggleKey={() => setKeyOnly(!keyOnly)} onAllEvents={() => changeView('MOMENTS')}/>}
                    {phase === 'FINAL' && live && <><FinalWhistle saved={false} home={fixture.homeClubId} away={fixture.awayClubId} homeGoals={model.result.homeGoals} awayGoals={model.result.awayGoals} team={team} top={finalTop} action={primaryInPhase ? primaryAction : undefined}/><MiniStats model={model} team={team} names={names}/></>}
                    {phase === 'FINAL' && !live && <>
                        <FinalWhistle saved home={fixture.homeClubId} away={fixture.awayClubId} homeGoals={model.result.homeGoals} awayGoals={model.result.awayGoals} team={team} top={finalTop}/>
                        <div className="mc-overview-grid"><div><section className="mc-summary"><header><span className="game-overline">Matchberättelsen</span><h1>{model.result.homeGoals === model.result.awayGoals ? 'Oavgjort.' : `${names[model.result.homeGoals > model.result.awayGoals ? 'HOME' : 'AWAY']} vinner.`}</h1></header>{facts.length ? <ul>{facts.map(f => <li key={f.id} data-fact={f.id}>{f.text}</li>)}</ul> : <p>Matchbilden växer fram när händelserna kommer.</p>}</section><ScoreFlow events={model.events}/></div>
                        <div><section className="mc-primary-metrics"><h2>Matchen i siffror</h2><table><thead><tr><th>{names.HOME}</th><th> </th><th>{names.AWAY}</th></tr></thead><tbody>{[
                            ['Mål', model.result.homeGoals, model.result.awayGoals], ['Skott', model.result.homeStats.shots, model.result.awayStats.shots], ['Träffsäkerhet', `${model.result.homeStats.shootingPct}%`, `${model.result.awayStats.shootingPct}%`], ['Räddningar', `${model.result.homeStats.saves}/${model.result.homeStats.shotsFaced}`, `${model.result.awayStats.saves}/${model.result.awayStats.shotsFaced}`], ['Bollförluster', model.result.homeStats.turnovers, model.result.awayStats.turnovers], ['7m mål/försök', `${model.result.homeStats.sevenMetreGoals}/${model.result.homeStats.sevenMetreAttempts}`, `${model.result.awayStats.sevenMetreGoals}/${model.result.awayStats.sevenMetreAttempts}`], ['2 min', model.result.homeStats.twoMinuteSuspensions, model.result.awayStats.twoMinuteSuspensions], ['Omställningsmål', model.shots.filter(s => s.team === 'HOME' && s.phase === 'TRANSITION' && s.outcome === 'GOAL').length, model.shots.filter(s => s.team === 'AWAY' && s.phase === 'TRANSITION' && s.outcome === 'GOAL').length]
                        ].map(([label, h, a]) => <tr key={label}><td>{h}</td><th scope="row">{label}</th><td>{a}</td></tr>)}</tbody></table></section><section className="mc-top-performers"><h2>Matchens profiler</h2>{top.map(({ player, label }) => player && <button type="button" key={player.id} onClick={() => { setView('PLAYERS'); setPlayerFocus(player.id); }}><small>{label} · {names[player.team]}</small><strong>{player.name}</strong><span>{player.goals} mål · betyg {player.rating?.toFixed(1) ?? '—'}{player.role === 'GK' ? ` · ${player.saves}/${player.shotsFaced} räddningar` : ''}</span></button>)}</section></div></div>
                        <section className="mc-preview"><header><h2>Händelser att återvända till</h2><button type="button" onClick={() => changeView('MOMENTS')}>Alla nyckelögonblick →</button></header><div>{previews.map(m => <button type="button" key={m.canonicalEventId} onClick={() => openMoment(m.canonicalEventId)}><small>{clockText(m.timestamp)} · {m.score.join('–')}</small><strong>{m.headline}</strong><span>{m.detail}</span></button>)}</div>{!previews.length && <p>Nyckelögonblick blir tillgängliga när matchen spelas.</p>}</section>
                    </>}
                </div>}
                {view === 'MOMENTS' && <><div className="mc-moment-filters" aria-label="Filtrera nyckelögonblick">{MOMENT_FILTERS.filter(f => f === 'ALL' || model.keyMoments.some(m => momentMatches(m, f, model.shots))).map(f => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{FILTER_LABELS[f]}</button>)}</div><MomentTimeline model={model} filter={filter} selected={moment?.canonicalEventId ?? null} names={names} onSelect={(id, active) => { if (!active) setFilter('ALL'); setSelected(id); }}/><div className="mc-moment-workspace"><nav className="mc-moment-list" aria-label="Nyckelögonblick"><ol>{moments.map(m => <li key={m.canonicalEventId} data-team={m.team ?? 'NEUTRAL'}><button type="button" aria-current={moment === m ? 'true' : undefined} onClick={() => setSelected(m.canonicalEventId)}><small>{clockText(m.timestamp)} · {m.score.join('–')} · {m.team ? names[m.team] : 'Matchen'}</small><strong>{m.headline}</strong></button></li>)}</ol>{!moments.length && <p>Inga nyckelögonblick i det här urvalet.</p>}</nav><KeyMoment key={moment?.canonicalEventId ?? 'none'} moment={moment} events={events} frames={frames} people={people}/></div><details className="mc-event-review"><summary>Händelseförlopp · matchkommentarer</summary><Commentary stream={stream} names={names} keyOnly={keyOnly} importantOnly={importantOnly} onOpen={openMoment} onView={() => changeView('MOMENTS')} onToggle={() => setKeyOnly(!keyOnly)}/></details></>}
                {view === 'PLAYERS' && <PlayersView key={playerFocus ?? 'players'} initialPlayer={playerFocus} model={model} team={team} events={events} onMoment={openMoment} onPlayer={onPlayer} live={live && !reviewing}/>}
                {view === 'STATS' && <StatisticsView model={model} team={team} onMoment={openMoment}/>}
                {view === 'PLAN' && experimental && <div className="mc-plan">
                    <header><div><span className="game-overline">Plan</span><h2>Matchen i 2D</h2><p>Kontinuerlig visning av samma match från de sparade positionerna.</p></div><button type="button" className="mc-plan-trails-toggle" aria-pressed={trails} onClick={() => setTrails(!trails)}>Spår {trails ? 'på' : 'av'}</button></header>
                    <div className="mc-plan-stage">
                        <PlanOptions.Provider value={{ trails }}>{experimental}</PlanOptions.Provider>
                        {model.manpower && !reviewing && <p className="mc-plan-overlay" aria-live="polite"><b>{model.manpower.HOME} mot {model.manpower.AWAY}</b>{suspended.map(s => <span key={s.id}>{names[s.team]} #{s.number} {clockText(s.remainingSuspension)}</span>)}</p>}
                    </div>
                    <p className="mc-plan-rotate">Vrid telefonen till liggande läge för en större plan.</p>
                </div>}
            </section>
            {views.filter(v => v !== view).map(v => <section key={v} id={`${uid}-${v}-panel`} role="tabpanel" aria-labelledby={`${uid}-${v}-tab`} hidden/>)}
            {coach && !reviewing && <aside className="mc-coach" aria-label="Managerbeslut">{coach}</aside>}
        </div>
    </div>;
}
export function LiveMatchCenter({ session, playing, coach, ...props }: {
    session: ProductionMatchSession;
    playing: boolean;
} & Omit<Parameters<typeof MatchCenterSurface>[0], 'model' | 'fixture' | 'frames' | 'people' | 'events' | 'session'>) {
    const [reader] = useState(createLiveMatchReader);
    const model = useMemo(() => reader(session, playing), [reader, session, playing]);
    let defensivePosts: Record<string, readonly [
        number,
        number
    ]> | undefined;
    if (session.core.possession.team !== props.team && session.core.defence.team === props.team) {
        const positions: Record<string, readonly [
            number,
            number
        ]> = {}, direction = session.core.directions[session.core.possession.team];
        for (const p of session.core.players.filter(p => p.team === props.team && p.population === 'COURT' && p.zone !== null)) {
            // Fixed formation anchors, not continuously moving defensive bodies.
            const read = { engaged:null,shift:0,compact:1,ballX:10 };
            const schema={...session.core,defence:{...session.core.defence,system:session.core.coaching[props.team].defence}};
            const post = zonePost(schema, p.zone!, read, direction, p.radius);
            positions[p.id] = [direction === 'TOP' ? post.y : 40 - post.y, post.x];
        }
        if (Object.keys(positions).length)
            defensivePosts = positions;
    }
    return <MatchCenterSurface {...props} session={session} coach={coach ? <>{coach}<details className="mc-formation"><summary>Lagets struktur</summary><StructureCourt players={model.players.filter(p => p.team === props.team)} defence={session.core.coaching[props.team].defence} defensivePosts={defensivePosts}/></details></> : undefined} model={model} fixture={session.fixture} frames={session.frames} people={session.people} events={session.core.events}/>;
}
export function ArchivedMatchCenter({ archive, frames, team = 'HOME', ...props }: {
    archive: PlayedMatchArchive;
    frames: MatchFrame[];
    team?: TeamId;
} & Omit<Parameters<typeof MatchCenterSurface>[0], 'model' | 'fixture' | 'frames' | 'people' | 'events' | 'team'>) { const model = useMemo(() => archivedMatchModel(archive, frames), [archive, frames]); return <MatchCenterSurface {...props} model={model} fixture={archive.fixture} frames={frames} people={archive.people} events={archive.events} team={team}/>; }

/** Arena Nights Phase 2 -- MDY-02j "Final-whistle card": the result for the manager's own side, both identities and the match's profiles. In a live match it carries the single
 *  "finish and open the report" action (MDY-02 C slutsignal); the story itself lives in the report. Presentation only. */
function FinalWhistle({ saved, home, away, homeGoals, awayGoals, team, top, action }: { saved: boolean; home: string; away: string; homeGoals: number; awayGoals: number; team: TeamId; top: { label: string; name: string; line: string }[]; action?: ReactNode }) {
    const ours = team === 'HOME' ? homeGoals - awayGoals : awayGoals - homeGoals;
    const verdict = ours > 0 ? 'Seger' : ours < 0 ? 'Förlust' : 'Oavgjort';
    const h = getClub(home), a = getClub(away);
    return <section className="mc-final-whistle" data-outcome={ours > 0 ? 'W' : ours < 0 ? 'L' : 'D'} aria-label="Slutsignal">
        <span className="mc-final-tag">Slutsignal · {verdict}</span>
        <div className="mc-final-score">
            <span>{h && <ClubCrest shortName={h.shortName} primaryColor={h.primaryColor} clubId={h.id} size={56} />}<b>{h?.shortName ?? home}</b></span>
            <strong>{homeGoals}<i>–</i>{awayGoals}</strong>
            <span>{a && <ClubCrest shortName={a.shortName} primaryColor={a.primaryColor} clubId={a.id} size={56} />}<b>{a?.shortName ?? away}</b></span>
        </div>
        {top.length > 0 && <ul>{top.map(t => <li key={t.label + t.name}><small>{t.label}</small><b>{t.name}</b><span>{t.line}</span></li>)}</ul>}
        <p>{saved ? 'Resultatet är sparat. Matchrapporten och presskonferensen väntar.' : 'Slutför matchen för att spara resultatet. Matchrapporten berättar hela matchen och presskonferensen väntar.'}</p>
        {action && <div className="mc-final-action">{action}</div>}
    </section>;
}
