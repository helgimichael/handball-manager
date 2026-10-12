'use client';
import { useMemo, useState, type ReactNode } from 'react';
import type { MatchFrame, MatchPerson, ProductionMatchSession, PlayedMatchArchive } from '@/lib/career/productionMatch';
import type { CoreEvent, TeamId } from '@handball-manager/handball-engine/src/v2/core/state';
import { archivedMatchModel, createLiveMatchReader, snapshotsFor, keeperCategories, clockText, SHOT_LABEL, ROLE_LABEL, type MatchCenterModel, type MatchPresentationEvent } from '@/lib/matchCenter/model';
import { getClub, COMPETITIONS } from '@/lib/game-data';
import ClubCrest from '@/components/ClubCrest';
import { TacticalCourt, StructureCourt, ShotMap } from './TacticalCourt';
import { zonePost } from '@handball-manager/handball-engine/src/v2/core/defence';
const stateLabels = { PREMATCH: 'INFÖR AVKAST', LIVE: 'LIVE', PAUSED: 'PAUSAD', TIMEOUT: 'TIMEOUT', HALFTIME: 'HALVTID', FULLTIME: 'SLUTRESULTAT' };
function ClubIdentity({ id, side }: {
    id: string;
    side: string;
}) { const club = getClub(id); return <div className="mc-club"><ClubCrest shortName={club?.shortName ?? '?'} primaryColor={club?.primaryColor ?? ''} size={66}/><div><small>{side}</small><strong>{club?.shortName ?? (side === 'HEMMA' ? 'Hemmalaget' : 'Bortalaget')}</strong><span>{club?.name}</span></div></div>; }
function ScoreFlow({ events }: {
    events: MatchPresentationEvent[];
}) {
    const goals = events.filter(e => e.type === 'GOAL');
    if (!goals.length)
        return <figure className="mc-score-flow"><figcaption><strong>Matchens utveckling</strong></figcaption><p className="mc-footnote">Ingen tidsatt målsekvens att visa.</p></figure>;
    const max = Math.max(3, ...goals.map(e => Math.abs(e.score[0] - e.score[1]))),points:number[][]=[[0,50]];
    for(const e of goals){const x=e.timestamp/3600000*500,y=50-(e.score[0]-e.score[1])/max*40;points.push([x,points.at(-1)![1]],[x,y]);}
    return <figure className="mc-score-flow"><figcaption><strong>Matchens utveckling</strong><span>Målskillnad · hemma över linjen</span></figcaption><svg viewBox="0 0 500 110" role="img" aria-label={`Målskillnad över matchen. Senaste resultat ${goals.at(-1)?.score.join('–') ?? '0–0'}.`}><path d="M0 50H500 M250 5V100" className="mc-flow-guide"/><polyline points={points.map(p => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2"/><text x="0" y="109">0′</text><text x="240" y="109">30′</text><text x="480" y="109">60′</text></svg></figure>;
}
export function KeyMoment({ moment, events, frames, people }: {
    moment: MatchPresentationEvent | null;
    events: readonly CoreEvent[];
    frames: readonly MatchFrame[];
    people: MatchPerson[];
}) {
    const snapshots = useMemo(() => moment ? snapshotsFor(moment.canonicalEventId, events, frames, people) : [], [moment, events, frames, people]);
    const [fullCourt, setFullCourt] = useState(false);
    const [step, setStep] = useState(0), snapshot = snapshots[Math.min(step, snapshots.length - 1)];
    return <section className="mc-key-moment" aria-label="Taktiskt nyckelögonblick"><header><div><span className="game-overline">Nyckelögonblick</span><h2>{moment?.headline ?? 'Matchen tar form'}</h2></div>{moment && <time>{clockText(moment.timestamp)}</time>}</header>{moment && <p>{moment.tacticalContext ?? moment.detail}</p>}{snapshot ? <><div className="mc-step-controls" aria-label="Steg i nyckelögonblicket">{snapshots.map((s, i) => <button key={s.tick} type="button" aria-pressed={i === Math.min(step, snapshots.length - 1)} onClick={() => setStep(i)}>{i + 1}. {s.label}<small>{clockText(s.timestamp)}</small></button>)}</div><button type="button" className="mc-camera-control" aria-pressed={fullCourt} onClick={() => setFullCourt(!fullCourt)}>{fullCourt ? 'Visa närbild' : 'Visa helplan'}</button><TacticalCourt snapshot={snapshot} fullCourt={fullCourt} focusY={snapshots.at(-1)?.ball.y}/><p className="mc-footnote">Positionerna är sparade vid {clockText(snapshot.timestamp)}. Pilar visar berörda spelare och bollens registrerade läge, inte en animerad bana.</p></> : <p className="mc-empty">{moment ? 'Den här händelsen saknar sparade positionsbilder. Kommentaren och matchstatistiken finns kvar.' : 'Välj en viktig händelse i flödet för att se den steg för steg.'}</p>}</section>;
}
function Performance({ model, team, onPlayer }: {
    model: MatchCenterModel;
    team: TeamId;
    onPlayer?: (id: string) => void;
}) {
    return <section className="mc-performance"><header><h2>Spelarna</h2><span>{team === 'HOME' ? 'Hemmalaget' : 'Bortalaget'} · klicka på en spelare för byte</span></header><div className="mc-table-scroll"><table><thead><tr><th>Spelare</th><th>Min</th><th>M/S</th><th>%</th><th>Energi</th><th>Fel</th><th>2m</th><th>Betyg</th></tr></thead><tbody>{model.players.filter(p => p.team === team).map(p => <tr key={p.id} data-court={p.population === 'COURT'}><th scope="row">{onPlayer && p.population === 'COURT' ? <button type="button" onClick={() => onPlayer(p.id)} aria-label={`Byt ut ${p.name}`}>{p.position} · {p.name}</button> : <span>{p.position} · {p.name}</span>}<small>{p.population === 'COURT' ? 'På plan' : p.population === 'SUSPENDED' ? `2 MIN · ${clockText(p.remainingSuspension)} kvar` : p.population === 'DISQUALIFIED' ? 'Rött kort' : p.population === 'ARCHIVE' ? 'Spelad match' : 'Bänk'}</small></th><td>{p.minutes.toFixed(1)}</td><td>{p.goals}/{p.shots}</td><td>{p.shots ? Math.round(p.goals / p.shots * 100) : '—'}</td><td>{p.energy == null ? '—' : <><meter min="0" max="100" value={p.energy} aria-label={`${p.name}: energi`}/>{Math.round(p.energy)}%</>}</td><td>{p.technicalViolations}</td><td>{p.suspensions}</td><td><strong>{p.rating?.toFixed(1) ?? '—'}</strong></td></tr>)}</tbody></table></div><p className="mc-footnote">M/S: mål/skott. Fel: registrerade tekniska regelbrott och anfallsfel. Betyget använder matchens befintliga prestationsmodell.</p></section>;
}
function Keepers({ model }: {
    model: MatchCenterModel;
}) { return <section className="mc-keepers"><header><h2>Målvakterna</h2><span>Räddningar / räddningar + insläppta mål</span></header>{model.players.filter(p => p.role === 'GK' && (p.minutes > 0 || p.shotsFaced > 0 || p.population === 'COURT')).map(p => <article key={p.id}><div><strong>{p.name}</strong><small>{p.team === 'HOME' ? 'Hemma' : 'Borta'} · {p.saves}/{p.shotsFaced} räddningar · {p.shotsFaced - p.saves} insläppta</small></div><b>{p.shotsFaced ? Math.round(p.saves / p.shotsFaced * 100) + '%' : '—'}</b><ul>{keeperCategories(p.id, model.shots, model.events).map(r => <li key={r.kind}>{SHOT_LABEL[r.kind] ?? 'Övriga avslut'} <strong>{r.saves}/{r.faced}</strong></li>)}</ul></article>)}</section>; }
function TeamStats({ model }: {
    model: MatchCenterModel;
}) {
    const home = model.result.homeStats, away = model.result.awayStats;
    const rows = [['Mål', home.goals, away.goals], ['Skott', home.shots, away.shots], ['Mål / skott', `${home.shootingPct}%`, `${away.shootingPct}%`], ['Räddningar', `${home.saves}/${home.shotsFaced}`, `${away.saves}/${away.shotsFaced}`], ['Räddningsprocent', home.shotsFaced ? `${Math.round(home.saves / home.shotsFaced * 100)}%` : '—', away.shotsFaced ? `${Math.round(away.saves / away.shotsFaced * 100)}%` : '—'], ['Bollförluster', home.turnovers, away.turnovers], ['7m mål / försök', `${home.sevenMetreGoals}/${home.sevenMetreAttempts}`, `${away.sevenMetreGoals}/${away.sevenMetreAttempts}`], ['2 min', home.twoMinuteSuspensions, away.twoMinuteSuspensions], ['Omställningsmål', model.shots.filter(s => s.team === 'HOME' && s.phase === 'TRANSITION' && s.outcome === 'GOAL').length, model.shots.filter(s => s.team === 'AWAY' && s.phase === 'TRANSITION' && s.outcome === 'GOAL').length]];
    return <section className="mc-team-stats"><h2>Matchstatistik</h2><table><thead><tr><th>Hemma</th><th>Statistik</th><th>Borta</th></tr></thead><tbody>{rows.map(([label, h, a]) => <tr key={label}><td>{h}</td><th scope="row">{label}</th><td>{a}</td></tr>)}</tbody></table><p className="mc-footnote">Bollförluster omfattar tekniska fel, brutna passningar, tappade bollar och misslyckade mottagningar. Block och skott utanför räknas inte som målvaktsräddningar.</p><h3>Mål efter registrerad position</h3><div className="mc-position-goals">{['V6', 'V9', 'M9', 'M6', 'H9', 'H6', 'MV'].map(pos => <span key={pos}><small>{pos}</small><strong>{model.players.filter(p => p.team === 'HOME' && ROLE_LABEL[p.role] === pos).reduce((n, p) => n + p.goals, 0)} – {model.players.filter(p => p.team === 'AWAY' && ROLE_LABEL[p.role] === pos).reduce((n, p) => n + p.goals, 0)}</strong></span>)}</div></section>;
}
function Shots({ model, team }: {
    model: MatchCenterModel;
    team: TeamId;
}) {
    const [selectedTeam, setTeam] = useState<TeamId>(team), [player, setPlayer] = useState(''), [outcome, setOutcome] = useState('ALL');
    const shots = model.shots.filter(s => s.team === selectedTeam && (!player || s.playerId === player) && (outcome === 'ALL' || s.outcome === outcome));
    return <section className="mc-shots"><header><h2>Avsluten</h2><span>Registrerad avslutsposition</span></header><div className="mc-shot-filters"><label>Lag<select value={selectedTeam} onChange={e => { setTeam(e.target.value as TeamId); setPlayer(''); }}><option value="HOME">Hemma</option><option value="AWAY">Borta</option></select></label><label>Spelare<select value={player} onChange={e => setPlayer(e.target.value)}><option value="">Alla spelare</option>{model.players.filter(p => p.team === selectedTeam).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Utfall<select value={outcome} onChange={e => setOutcome(e.target.value)}>{[['ALL', 'Alla'], ['GOAL', 'Mål'], ['SAVE', 'Räddningar'], ['MISS', 'Utan mål'], ['BLOCK', 'Block']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label></div><ShotMap shots={shots}/><p className="mc-footnote">G mål · R räddning · X utan mål · B block. {shots.filter(s => s.origin).length} positioner, {shots.filter(s => !s.origin).length} avslut saknar koordinater.</p><div className="mc-shot-categories">{[...new Set(shots.map(s => s.kind))].map(kind => <span key={kind}>{SHOT_LABEL[kind] ?? 'Övrigt'} <strong>{shots.filter(s => s.kind === kind && s.outcome === 'GOAL').length}/{shots.filter(s => s.kind === kind).length}</strong></span>)}</div></section>;
}
export function MatchCenterSurface({ model, fixture, frames, people, events, team, controls, coach, onPlayer, experimental, importantOnly = false }: {
    model: MatchCenterModel;
    fixture: ProductionMatchSession['fixture'];
    frames: readonly MatchFrame[];
    people: MatchPerson[];
    events: readonly CoreEvent[];
    team: TeamId;
    controls?: ReactNode;
    coach?: ReactNode;
    onPlayer?: (id: string) => void;
    experimental?: ReactNode;
    importantOnly?: boolean;
}) {
    const [selected, setSelected] = useState<string | null>(null), [statTeam, setStatTeam] = useState<TeamId>(team), [keyOnly, setKeyOnly] = useState(false), [showExperimental, setShowExperimental] = useState(false);
    const moment = model.keyMoments.find(e => e.canonicalEventId === selected) ?? model.keyMoments.at(-1) ?? null;
    const momentIndex = moment ? model.keyMoments.indexOf(moment) : -1;
    const best = model.players.filter(p => p.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0], topScorer = model.players.slice().sort((a, b) => b.goals - a.goals)[0];
    const latest = importantOnly ? model.events.findLast(e => e.importance === 'KEY') : model.events.at(-1), stream = model.events.filter(e => !(keyOnly || importantOnly) || e.importance === 'KEY').slice(-60).reverse();
    const competition = COMPETITIONS.find(c => c.id === fixture.competitionId), home = getClub(fixture.homeClubId);
    return <div className="mc-match" data-phase={model.status.toLowerCase()} data-match-mode="MATCH_CENTER"><a href="#mc-controls" className="mc-skip">Till matchbeslut</a><header className="mc-header"><div className="mc-header-meta"><span>{competition?.name ?? 'Match'} · {fixture.date}</span><span>{home?.city ? `${home.city} · ` : ''}Hemma / borta</span></div><div className="mc-scoreline"><ClubIdentity id={fixture.homeClubId} side="HEMMA"/><div className="mc-score"><strong>{model.result.homeGoals}<span>–</span>{model.result.awayGoals}</strong><small>{stateLabels[model.status]}</small></div><ClubIdentity id={fixture.awayClubId} side="BORTA"/></div><div className="mc-match-state"><time>{clockText(model.clock)}</time><span>{model.period === 1 ? 'Första halvlek' : model.period === 2 ? 'Andra halvlek' : 'Spelad match'}<small>{model.status === 'FULLTIME' ? 'Matchen är avslutad' : `${clockText(model.remaining)} kvar av halvleken`}</small></span>{model.manpower && <strong>{model.manpower.HOME} mot {model.manpower.AWAY}<small>Utespelare på plan</small></strong>}{model.timeouts && <span>Timeouts {model.timeouts.HOME} – {model.timeouts.AWAY}<small>Kvar denna halvlek</small></span>}</div></header><div id="mc-controls" className="mc-controls">{controls}</div>
  {['HALFTIME', 'TIMEOUT', 'FULLTIME'].includes(model.status) && <section className="mc-interval" role="status"><span className="game-overline">{stateLabels[model.status]}</span><h2>{model.status === 'HALFTIME' ? 'Trettio minuter kvar. Din nästa instruktion.' : model.status === 'TIMEOUT' ? 'Samla laget. Ändra det som behövs.' : 'Matchen är avgjord.'}</h2><p>{model.status === 'FULLTIME' ? 'Granska prestationerna och återvänd till de avgörande händelserna.' : 'Granska energi, målvakt och matchutveckling. Byten och instruktioner finns vid sidlinjen.'}</p><div className="mc-interval-performers">{best && <span><small>Högsta betyg just nu</small><strong>{best.name} · {best.rating?.toFixed(1)}</strong></span>}{topScorer && <span><small>Flest mål</small><strong>{topScorer.name} · {topScorer.goals}</strong></span>}</div></section>}
  <div className="mc-live-layout"><section className="mc-match-story" aria-label="Matchens händelser"><section className="mc-latest" key={latest?.canonicalEventId ?? 'kickoff'} data-event={latest?.type}><span className="game-overline">{latest ? `${clockText(latest.timestamp)} · ${latest.team === 'HOME' ? 'Hemma' : latest.team === 'AWAY' ? 'Borta' : 'Matchen'}` : 'Inför avkast'}</span><h1>{latest?.headline ?? 'Din match. Dina beslut.'}</h1><p>{latest?.tacticalContext ?? latest?.detail ?? 'Starta matchen och följ händelserna från sidlinjen.'}</p></section><div className="mc-story-grid"><section className="mc-commentary" aria-label="Matchkommentarer"><header><h2>Från planen</h2><button type="button" aria-pressed={keyOnly || importantOnly} disabled={importantOnly} onClick={() => setKeyOnly(!keyOnly)}>{keyOnly || importantOnly ? 'Visa alla händelser' : 'Viktiga händelser'}</button></header><ol>{stream.map(e => <li key={e.canonicalEventId} data-team={e.team ?? 'NEUTRAL'} data-importance={e.importance}><time>{clockText(e.timestamp)}</time><div><span>{e.team === 'HOME' ? 'H' : e.team === 'AWAY' ? 'B' : '·'} · {e.score.join('–')}</span>{e.replayReference ? <button type="button" aria-label={`Visa nyckelögonblick ${clockText(e.timestamp)} ${e.headline}`} onClick={() => setSelected(e.canonicalEventId)}>{e.headline}</button> : <strong>{e.headline}</strong>}<p>{e.detail}</p></div></li>)}</ol>{!stream.length && <p className="mc-empty">Flödet börjar vid avkast.</p>}<small className="mc-footnote">De senaste 60 händelserna visas. Alla nyckelögonblick kan väljas till höger.</small></section><div className="mc-tactical-column"><nav className="mc-moment-navigation" aria-label="Välj nyckelögonblick"><button type="button" disabled={momentIndex <= 0} onClick={() => setSelected(model.keyMoments[momentIndex - 1].canonicalEventId)}>← Föregående</button><select aria-label="Nyckelögonblick" value={moment?.canonicalEventId ?? ''} onChange={e => setSelected(e.target.value)}><option value="" disabled>Välj händelse</option>{model.keyMoments.map(e => <option key={e.canonicalEventId} value={e.canonicalEventId}>{clockText(e.timestamp)} · {e.headline}</option>)}</select><button type="button" disabled={momentIndex < 0 || momentIndex >= model.keyMoments.length - 1} onClick={() => setSelected(model.keyMoments[momentIndex + 1].canonicalEventId)}>Nästa →</button><button type="button" onClick={() => setSelected(null)}>Senaste</button></nav><KeyMoment key={moment?.canonicalEventId ?? 'none'} moment={moment} events={events} frames={frames} people={people}/><ScoreFlow events={model.events}/><section className="mc-trends"><h2>Det vi ser</h2>{model.trends.length ? model.trends.map(t => <p key={t}>{t}</p>) : <p>Matchens mönster blir tydligare när avsluten kommer.</p>}{model.alerts.map(a => <p className="mc-alert" key={a}><strong>Observera</strong> {a}</p>)}</section></div></div></section>{coach && <aside className="mc-coach">{coach}</aside>}</div>
  <div className="mc-information"><div><div className="mc-team-switch" aria-label="Lagets spelarstatistik">{(['HOME', 'AWAY'] as const).map(t => <button type="button" key={t} aria-pressed={statTeam === t} onClick={() => setStatTeam(t)}>{getClub(t === 'HOME' ? fixture.homeClubId : fixture.awayClubId)?.shortName ?? (t === 'HOME' ? 'Hemma' : 'Borta')}</button>)}</div><Performance model={model} team={statTeam} onPlayer={statTeam === team ? onPlayer : undefined}/><Keepers model={model}/></div><div><TeamStats model={model}/><Shots model={model} team={team}/></div></div>
  {experimental && <details className="mc-experimental" onToggle={e => setShowExperimental(e.currentTarget.open)}><summary>Experimental 2D</summary><p>Valfri kontinuerlig visning. Matchcentralen använder samma match och samma resultat.</p>{showExperimental && experimental}</details>}
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
    return <MatchCenterSurface {...props} coach={coach ? <><StructureCourt players={model.players.filter(p => p.team === props.team)} defence={session.core.coaching[props.team].defence} defensivePosts={defensivePosts}/>{coach}</> : undefined} model={model} fixture={session.fixture} frames={session.frames} people={session.people} events={session.core.events}/>;
}
export function ArchivedMatchCenter({ archive, frames, team = 'HOME', ...props }: {
    archive: PlayedMatchArchive;
    frames: MatchFrame[];
    team?: TeamId;
} & Omit<Parameters<typeof MatchCenterSurface>[0], 'model' | 'fixture' | 'frames' | 'people' | 'events' | 'team'>) { const model = useMemo(() => archivedMatchModel(archive, frames), [archive, frames]); return <MatchCenterSurface {...props} model={model} fixture={archive.fixture} frames={frames} people={archive.people} events={archive.events} team={team}/>; }
