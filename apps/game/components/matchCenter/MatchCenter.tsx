'use client';
import { useMemo, useState, useId, useRef, type ReactNode } from 'react';
import type { MatchFrame, MatchPerson, ProductionMatchSession, PlayedMatchArchive } from '@/lib/career/productionMatch';
import type { CoreEvent, TeamId } from '@handball-manager/handball-engine/src/v2/core/state';
import { archivedMatchModel, createLiveMatchReader, snapshotsFor, clockText, type MatchCenterModel, type MatchPresentationEvent } from '@/lib/matchCenter/model';
import { getClub, COMPETITIONS } from '@/lib/game-data';
import ClubCrest from '@/components/ClubCrest';
import { ENVIRONMENTS } from '@/components/clubhq/environments';
import { TacticalCourt, StructureCourt } from './TacticalCourt';
import { ScoreFlow, PlayersView, StatisticsView } from './WorkspaceViews';
import { MATCH_VIEWS, VIEW_LABELS, keyboardView, overviewFacts, overviewMoments, performers, tacticalStory, momentMatches, MOMENT_FILTERS, FILTER_LABELS, type MatchView, type MomentFilter } from '@/lib/matchCenter/workspace';
import { zonePost } from '@handball-manager/handball-engine/src/v2/core/defence';
const stateLabels = { PREMATCH: 'INFÖR AVKAST', LIVE: 'LIVE', PAUSED: 'PAUSAD', TIMEOUT: 'TIMEOUT', HALFTIME: 'HALVTID', FULLTIME: 'SLUTRESULTAT' };
function ClubIdentity({ id, side }: {
    id: string;
    side: string;
}) { const club = getClub(id); return <div className="mc-club"><ClubCrest shortName={club?.shortName ?? '—'} primaryColor={club?.primaryColor ?? ''} clubId={club?.id} size={66}/><div><small>{side}</small><strong>{club?.shortName ?? (side === 'HEMMA' ? 'Hemmalaget' : 'Bortalaget')}</strong><span>{club?.name}</span></div></div>; }
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
export function MatchCenterSurface({ model, fixture, frames, people, events, team, controls, coach, onPlayer, experimental, importantOnly = false, defaultShowExperimental = false }: {
    model: MatchCenterModel; fixture: ProductionMatchSession['fixture']; frames: readonly MatchFrame[];
    people: MatchPerson[]; events: readonly CoreEvent[]; team: TeamId; controls?: ReactNode;
    coach?: ReactNode; onPlayer?: (id: string) => void; experimental?: ReactNode; importantOnly?: boolean; defaultShowExperimental?: boolean;
}) {
    const [view, setView] = useState<MatchView>('OVERVIEW');
    const [phase, setPhase] = useState(model.status);
    // Interval transitions return to the shared decision/review overview, once.
    if (phase !== model.status) {
        setPhase(model.status);
        if (['HALFTIME', 'TIMEOUT', 'FULLTIME'].includes(model.status)) setView('OVERVIEW');
    }
    const [playerFocus, setPlayerFocus] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null), [filter, setFilter] = useState<MomentFilter>('ALL');
    const [keyOnly, setKeyOnly] = useState(false), [showExperimental, setShowExperimental] = useState(defaultShowExperimental);
    const uid = useId().replaceAll(':', ''), navigation = useRef<HTMLElement>(null);
    const buttons = useRef<Partial<Record<MatchView, HTMLButtonElement | null>>>({});
    const reviewing = model.status === 'FULLTIME';
    const names = useMemo(() => ({ HOME: getClub(fixture.homeClubId)?.shortName ?? 'Hemmalaget', AWAY: getClub(fixture.awayClubId)?.shortName ?? 'Bortalaget' }), [fixture.homeClubId, fixture.awayClubId]);
    const moments = useMemo(() => model.keyMoments.filter(m => momentMatches(m, filter, model.shots)), [model.keyMoments, model.shots, filter]);
    const moment = moments.find(e => e.canonicalEventId === selected) ?? moments.at(-1) ?? null;
    const facts = useMemo(() => overviewFacts(model, names), [model, names]);
    const previews = useMemo(() => overviewMoments(model), [model]);
    const top = useMemo(() => performers(model), [model]);
    const stream = model.events.filter(e => !(keyOnly || importantOnly) || e.importance === 'KEY').slice(-60).reverse();
    function openMoment(id: string) { setSelected(id); setFilter('ALL'); setView('MOMENTS'); buttons.current.MOMENTS?.focus({ preventScroll: true }); navigation.current?.scrollIntoView({ block: 'nearest' }); }
    function changeView(next: MatchView) { setView(next); navigation.current?.scrollIntoView({ block: 'nearest' }); }

    const latestEvent = model.events.at(-1) ?? null;
    const latestBadge = latestEvent ? classifyBroadcastEvent(latestEvent) : null;
    const homeClub = getClub(fixture.homeClubId);
    const awayClub = getClub(fixture.awayClubId);

    return <div className="mc-match mc-workspace" data-phase={model.status.toLowerCase()} data-view={view} data-match-mode="MATCH_CENTER">
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
                    <ClubIdentity id={fixture.homeClubId} side="HEMMA"/>
                    <div className="mc-score">
                        <strong>{model.result.homeGoals}<span>–</span>{model.result.awayGoals}</strong>
                        <small>{clockText(model.clock)} · {stateLabels[model.status]}</small>
                    </div>
                    <ClubIdentity id={fixture.awayClubId} side="BORTA"/>
                </div>
                {!reviewing && (
                    <div className="mc-match-state">
                        <span>{model.period === 2 ? 'Andra halvlek' : 'Första halvlek'} · {clockText(model.remaining)} kvar</span>
                        {model.manpower && (
                            <strong className="mc-manpower-badge" data-powerplay={model.manpower.HOME !== model.manpower.AWAY ? 'true' : undefined}>
                                {model.manpower.HOME} mot {model.manpower.AWAY}
                                <small>{model.manpower.HOME === model.manpower.AWAY ? '6v6 · Jämnt styrkeförhållande' : 'Utvisning aktiv · Numerärt läge'}</small>
                            </strong>
                        )}
                        {model.timeouts && <span>Timeouts kvar: {names.HOME} {model.timeouts.HOME} · {names.AWAY} {model.timeouts.AWAY}</span>}
                    </div>
                )}
                {latestEvent && latestBadge && (
                    <div className="mc-broadcast-callout" data-tone={latestBadge.tone} aria-live="polite">
                        <span className="mc-broadcast-callout-tag" data-tone={latestBadge.tone}>{latestBadge.tag}</span>
                        <time>{clockText(latestEvent.timestamp)}</time>
                        <strong>{latestEvent.headline}</strong>
                        <span className="mc-broadcast-callout-detail">{latestEvent.detail}</span>
                    </div>
                )}
            </header>
        )}
        <nav className="mc-workspace-nav" ref={navigation} aria-label="Matchens vyer"><div className="mc-compact-identity"><strong>{names.HOME} <b>{model.result.homeGoals}–{model.result.awayGoals}</b> {names.AWAY}</strong><small>{clockText(model.clock)} · {stateLabels[model.status]}</small></div><div role="tablist" aria-label="Matchvy">{MATCH_VIEWS.map(v => <button type="button" key={v} id={`${uid}-${v}-tab`} role="tab" aria-selected={view === v} aria-controls={`${uid}-${v}-panel`} tabIndex={view === v ? 0 : -1} ref={element => { buttons.current[v] = element; }} onClick={() => changeView(v)} onKeyDown={e => { const next = keyboardView(v, e.key); if (next) { e.preventDefault(); changeView(next); buttons.current[next]?.focus(); } }}>{VIEW_LABELS[v]}</button>)}</div></nav>
        <div id={`${uid}-controls`} className="mc-controls">{controls}</div>
        <div className={`mc-active-layout ${coach && !reviewing ? 'mc-managing' : ''}`}>
            <section id={`${uid}-${view}-panel`} role="tabpanel" aria-labelledby={`${uid}-${view}-tab`} tabIndex={0} className="mc-view-panel">
                {view === 'OVERVIEW' && <>
                    {['HALFTIME', 'TIMEOUT'].includes(model.status) && <section className="mc-decision-heading" role="status"><span className="game-overline">{stateLabels[model.status]}</span><h2>{model.status === 'HALFTIME' ? 'Nästa halvlek börjar med ditt beslut.' : 'Samla laget. Välj nästa instruktion.'}</h2></section>}
                    <div className="mc-overview-grid"><div><section className="mc-summary"><header><span className="game-overline">{reviewing ? 'Matchberättelsen' : 'Matchbilden'}</span><h1>{reviewing ? model.result.homeGoals === model.result.awayGoals ? 'Oavgjort.' : `${names[model.result.homeGoals > model.result.awayGoals ? 'HOME' : 'AWAY']} vinner.` : 'Från avkast till avgörande.'}</h1></header>{facts.length ? <ul>{facts.map(f => <li key={f.id} data-fact={f.id}>{f.text}</li>)}</ul> : <p>Matchbilden växer fram när händelserna kommer.</p>}</section><ScoreFlow events={model.events}/>{!reviewing && <Commentary compact stream={stream} names={names} keyOnly={keyOnly} importantOnly={importantOnly} onOpen={openMoment} onView={() => changeView('MOMENTS')} onToggle={() => setKeyOnly(!keyOnly)}/>}</div>
                    <div><section className="mc-primary-metrics"><h2>Matchen i siffror</h2><table><thead><tr><th>{names.HOME}</th><th> </th><th>{names.AWAY}</th></tr></thead><tbody>{[
                        ['Mål', model.result.homeGoals, model.result.awayGoals], ['Skott', model.result.homeStats.shots, model.result.awayStats.shots], ['Träffsäkerhet', `${model.result.homeStats.shootingPct}%`, `${model.result.awayStats.shootingPct}%`], ['Räddningar', `${model.result.homeStats.saves}/${model.result.homeStats.shotsFaced}`, `${model.result.awayStats.saves}/${model.result.awayStats.shotsFaced}`], ['Bollförluster', model.result.homeStats.turnovers, model.result.awayStats.turnovers], ['7m mål/försök', `${model.result.homeStats.sevenMetreGoals}/${model.result.homeStats.sevenMetreAttempts}`, `${model.result.awayStats.sevenMetreGoals}/${model.result.awayStats.sevenMetreAttempts}`], ['2 min', model.result.homeStats.twoMinuteSuspensions, model.result.awayStats.twoMinuteSuspensions], ['Omställningsmål', model.shots.filter(s => s.team === 'HOME' && s.phase === 'TRANSITION' && s.outcome === 'GOAL').length, model.shots.filter(s => s.team === 'AWAY' && s.phase === 'TRANSITION' && s.outcome === 'GOAL').length]
                    ].map(([label, h, a]) => <tr key={label}><td>{h}</td><th scope="row">{label}</th><td>{a}</td></tr>)}</tbody></table></section><section className="mc-top-performers"><h2>Matchens profiler</h2>{top.map(({ player, label }) => player && <button type="button" key={player.id} onClick={() => { setView('PLAYERS'); setPlayerFocus(player.id); }}><small>{label} · {names[player.team]}</small><strong>{player.name}</strong><span>{player.goals} mål · betyg {player.rating?.toFixed(1) ?? '—'}{player.role === 'GK' ? ` · ${player.saves}/${player.shotsFaced} räddningar` : ''}</span></button>)}</section>{!reviewing && <section className="mc-attention"><h2>Att hålla ögonen på</h2>{model.alerts.length ? model.alerts.slice(0, 3).map(a => <p className="mc-alert" key={a}>{a}</p>) : <p>Inga aktuella spelarvarningar.</p>}{model.trends.slice(0, 2).map(t => <p key={t}>{t}</p>)}</section>}</div></div>
                    <section className="mc-preview"><header><h2>Händelser att återvända till</h2><button type="button" onClick={() => changeView('MOMENTS')}>Alla nyckelögonblick →</button></header><div>{previews.map(m => <button type="button" key={m.canonicalEventId} onClick={() => openMoment(m.canonicalEventId)}><small>{clockText(m.timestamp)} · {m.score.join('–')}</small><strong>{m.headline}</strong><span>{m.detail}</span></button>)}</div>{!previews.length && <p>Nyckelögonblick blir tillgängliga när matchen spelas.</p>}</section>
                </>}
                {view === 'MOMENTS' && <><div className="mc-moment-filters" aria-label="Filtrera nyckelögonblick">{MOMENT_FILTERS.filter(f => f === 'ALL' || model.keyMoments.some(m => momentMatches(m, f, model.shots))).map(f => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{FILTER_LABELS[f]}</button>)}</div><div className="mc-moment-workspace"><nav className="mc-moment-list" aria-label="Nyckelögonblick"><ol>{moments.map(m => <li key={m.canonicalEventId}><button type="button" aria-current={moment === m ? 'true' : undefined} onClick={() => setSelected(m.canonicalEventId)}><small>{clockText(m.timestamp)} · {m.score.join('–')} · {m.team ? names[m.team] : 'Matchen'}</small><strong>{m.headline}</strong></button></li>)}</ol>{!moments.length && <p>Inga nyckelögonblick i det här urvalet.</p>}</nav><KeyMoment key={moment?.canonicalEventId ?? 'none'} moment={moment} events={events} frames={frames} people={people}/></div><details className="mc-event-review"><summary>Händelseförlopp · matchkommentarer</summary><Commentary stream={stream} names={names} keyOnly={keyOnly} importantOnly={importantOnly} onOpen={openMoment} onView={() => changeView('MOMENTS')} onToggle={() => setKeyOnly(!keyOnly)}/></details></>}
                {view === 'PLAYERS' && <PlayersView key={playerFocus ?? 'players'} initialPlayer={playerFocus} model={model} team={team} events={events} onMoment={openMoment} onPlayer={onPlayer}/>}
                {view === 'STATS' && <StatisticsView model={model} team={team}/>}
            </section>
            {MATCH_VIEWS.filter(v => v !== view).map(v => <section key={v} id={`${uid}-${v}-panel`} role="tabpanel" aria-labelledby={`${uid}-${v}-tab`} hidden/>)}
            {coach && !reviewing && <aside className="mc-coach" aria-label="Managerbeslut">{coach}</aside>}
        </div>
        {experimental && <details className="mc-experimental" open={showExperimental} onToggle={e => setShowExperimental(e.currentTarget.open)}><summary>Experimental 2D</summary><p>Valfri kontinuerlig visning av samma match.</p>{showExperimental && experimental}</details>}
    </div>;
}
export function LiveMatchCenter({ session, playing, coach, ...props }: {
    session: ProductionMatchSession;
    playing: boolean;
} & Omit<Parameters<typeof MatchCenterSurface>[0], 'model' | 'fixture' | 'frames' | 'people' | 'events'>) {
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
    return <MatchCenterSurface {...props} coach={coach ? <>{coach}<details className="mc-formation"><summary>Lagets struktur</summary><StructureCourt players={model.players.filter(p => p.team === props.team)} defence={session.core.coaching[props.team].defence} defensivePosts={defensivePosts}/></details></> : undefined} model={model} fixture={session.fixture} frames={session.frames} people={session.people} events={session.core.events}/>;
}
export function ArchivedMatchCenter({ archive, frames, team = 'HOME', ...props }: {
    archive: PlayedMatchArchive;
    frames: MatchFrame[];
    team?: TeamId;
} & Omit<Parameters<typeof MatchCenterSurface>[0], 'model' | 'fixture' | 'frames' | 'people' | 'events' | 'team'>) { const model = useMemo(() => archivedMatchModel(archive, frames), [archive, frames]); return <MatchCenterSurface {...props} model={model} fixture={archive.fixture} frames={frames} people={archive.people} events={archive.events} team={team}/>; }
