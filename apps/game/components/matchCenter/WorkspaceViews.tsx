'use client';
import { useState } from 'react';
import type { TeamId, CoreEvent } from '@handball-manager/handball-engine/src/v2/core/state';
import { keeperCategories, clockText, SHOT_LABEL, ROLE_LABEL, type MatchCenterModel, type MatchPresentationEvent, type PlayerRow } from '@/lib/matchCenter/model';
import { sortedPlayers, playerMoments, filterShots, matchDevelopment, type PlayerSort } from '@/lib/matchCenter/workspace';
import { ShotMap } from './TacticalCourt';
import { EnergyBar } from './EnergyBar';
import { byEnergy, filterShotKind, type ShotKindFilter } from './liveFlow';
/** MDY-02e (A) energy-forward table: energy bar and on-court status first; while live it sorts by energy (tiredest
 *  first) and an own on-court row offers "Byt", which opens the Bench Dock's substitution with that player chosen. */
function populationChip(p: PlayerRow) {
    if (p.population === 'COURT') return { tone: 'court', text: 'Plan' };
    if (p.population === 'SUSPENDED') return { tone: 'suspended', text: `Utvisad ${clockText(p.remainingSuspension)}` };
    if (p.population === 'DISQUALIFIED') return { tone: 'red', text: 'Rött kort' };
    if (p.population === 'ARCHIVE') return { tone: 'archive', text: 'Spelad match' };
    return { tone: 'bench', text: 'Bänk' };
}
export function PlayersView({ model, team, events, onMoment, onPlayer, initialPlayer, live = false }: {
    model: MatchCenterModel; team: TeamId; events: readonly CoreEvent[];
    onMoment: (id: string) => void; onPlayer?: (id: string) => void; initialPlayer?: string | null; live?: boolean;
}) {
    const [side, setSide] = useState<TeamId>(model.players.find(p => p.id === initialPlayer)?.team ?? team), [sort, setSort] = useState<PlayerSort>(live ? 'ENERGY' : 'POSITION'), [selected, setSelected] = useState<string | null>(initialPlayer ?? null);
    const rows = sort === 'ENERGY' ? byEnergy(model.players.filter(p => p.team === side), p => p.energy) : sortedPlayers(model.players, side, sort), player = rows.find(p => p.id === selected) ?? null;
    const canSwap = (p: PlayerRow) => !!onPlayer && p.team === team && p.population === 'COURT';
    return <div className="mc-player-workspace"><section className="mc-performance"><header><h2>Matchprestationer</h2><label>Sortera<select aria-label="Sortera" value={sort} onChange={e => setSort(e.target.value as PlayerSort)}>{([['ENERGY', 'Energi (lägst först)'], ['POSITION', 'Position'], ['RATING', 'Betyg'], ['GOALS', 'Mål'], ['SHOTS', 'Skott'], ['MINUTES', 'Minuter']] as const).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label></header><div className="mc-team-switch" aria-label="Lagets spelarstatistik">{(['HOME', 'AWAY'] as const).map(t => <button key={t} type="button" aria-pressed={side === t} onClick={() => { setSide(t); setSelected(null); }}>{t === 'HOME' ? 'Hemma' : 'Borta'}</button>)}</div><div className="mc-table-scroll"><table className="mc-energy-table"><thead><tr><th>Pos · Spelare</th><th>Energi</th><th>Betyg</th><th>M/S</th><th>%</th><th>Min</th><th>Fel</th><th>2 min</th>{onPlayer && side === team && <th><span className="mc-sr">Byte</span></th>}</tr></thead><tbody>{rows.map(p => { const chip = populationChip(p); return <tr key={p.id} data-selected={p.id === selected} data-court={p.population === 'COURT'}><th scope="row"><button type="button" aria-pressed={p.id === selected} onClick={() => setSelected(p.id)}>{p.position} · {p.name}</button><small className="mc-pop-chip" data-tone={chip.tone}>{chip.text}</small></th><td data-label="Energi"><EnergyBar energy={p.energy}/></td><td data-label="Betyg"><strong>{p.rating?.toFixed(1) ?? '—'}</strong></td><td data-label="M/S">{p.goals}/{p.shots}</td><td data-label="%">{p.shots ? Math.round(p.goals / p.shots * 100) : '—'}</td><td data-label="Min">{p.minutes.toFixed(1)}</td><td data-label="Fel">{p.technicalViolations}</td><td data-label="2 min">{p.suspensions}</td>{onPlayer && side === team && <td className="mc-row-action">{canSwap(p) && <button type="button" className="hm-btn hm-btn-sm" aria-label={`Förbered byte: ${p.name}`} onClick={() => onPlayer!(p.id)}>Byt</button>}</td>}</tr>; })}</tbody></table></div><p className="mc-footnote">M/S: mål/skott. Fel: tekniska regelbrott och anfallsfel. {live ? 'Sorterat på energi medan matchen pågår. ' : ''}Välj spelare för matchdetaljer.</p></section><aside className="mc-dossier" aria-label="Spelarens matchdetaljer">{player ? <><span className="game-overline">{player.position} · #{player.number}</span><h2>{player.name}</h2><p>{player.minutes.toFixed(1)} min · {player.goals}/{player.shots} mål/skott · betyg {player.rating?.toFixed(1) ?? '—'}</p><p>{player.suspensions} utvisningar · {player.technicalViolations} fel · energi {player.energy === null ? '—' : `${Math.round(player.energy)}%`}</p>{player.role === 'GK' ? <><h3>Målvaktens match</h3><strong className="mc-dossier-number">{player.saves}/{player.shotsFaced} <small>räddningar / avslut på mål</small></strong><p>{player.shotsFaced ? Math.round(player.saves / player.shotsFaced * 100) : '—'}% · {player.shotsFaced - player.saves} insläppta</p><ul>{keeperCategories(player.id, model.shots, model.events).map(r => <li key={r.kind}>{SHOT_LABEL[r.kind] ?? 'Övriga avslut'} <strong>{r.saves}/{r.faced}</strong></li>)}</ul></> : <><h3>Avslut</h3><ul>{[...new Set(model.shots.filter(s => s.playerId === player.id).map(s => s.kind))].map(kind => <li key={kind}>{SHOT_LABEL[kind] ?? 'Övriga avslut'} <strong>{model.shots.filter(s => s.playerId === player.id && s.kind === kind && s.outcome === 'GOAL').length}/{model.shots.filter(s => s.playerId === player.id && s.kind === kind).length}</strong></li>)}</ul></>}{canSwap(player) && <button type="button" className="hm-btn" onClick={() => onPlayer!(player.id)}>Förbered byte</button>}<h3>Spelarens nyckelögonblick</h3><ul className="mc-player-moments">{playerMoments(player.id, model.keyMoments, events).map(m => <li key={m.canonicalEventId}><button type="button" onClick={() => onMoment(m.canonicalEventId)}>{clockText(m.timestamp)} · {m.headline}</button></li>)}</ul>{!playerMoments(player.id, model.keyMoments, events).length && <p>Inga registrerade nyckelögonblick.</p>}</> : <><h2>Välj en spelare</h2><p>Matchens prestation, avslut och nyckelögonblick visas här. Målvakter har en egen kategoriöversikt.</p></>}</aside></div>;
}
export function StatisticsView({ model, team, onMoment }: { model: MatchCenterModel; team: TeamId; onMoment?: (id: string) => void }) {
    const [section, setSection] = useState('MATCH');
    return <><nav className="mc-analysis-nav" aria-label="Statistikområden">{[['MATCH', 'Match & positioner'], ['SHOTS', 'Avslut'], ['KEEPERS', 'Målvakter'], ['FLOW', 'Matchutveckling']].map(([v, l]) => <button type="button" key={v} aria-pressed={section === v} onClick={() => setSection(v)}>{l}</button>)}</nav><div className="mc-stat-workspace" data-section={section.toLowerCase()}>{section === 'MATCH' && <><TeamStats model={model}/><div><ScoreFlow events={model.events}/><section className="mc-trends"><h2>Disciplin & matchbild</h2><p>2 min: {model.result.homeStats.twoMinuteSuspensions}–{model.result.awayStats.twoMinuteSuspensions}</p>{model.trends.map(t => <p key={t}>{t}</p>)}</section></div></>}{section === 'SHOTS' && <Shots model={model} team={team} onMoment={onMoment}/>} {section === 'KEEPERS' && <Keepers model={model}/>} {section === 'FLOW' && <ScoreFlow events={model.events}/>}</div></>;
}
export function ScoreFlow({ events }: {
    events: MatchPresentationEvent[];
}) {
    const goals = events.filter(e => e.type === 'GOAL');
    const development = matchDevelopment(events);
    if (!goals.length)
        return <figure className="mc-score-flow"><figcaption><strong>Matchens utveckling</strong></figcaption><p className="mc-footnote">Ingen tidsatt målsekvens att visa.</p></figure>;
    const max = Math.max(3, ...goals.map(e => Math.abs(e.score[0] - e.score[1]))),points:number[][]=[[0,50]];
    for(const e of goals){const x=e.timestamp/3600000*500,y=50-(e.score[0]-e.score[1])/max*40;points.push([x,points.at(-1)![1]],[x,y]);}
    return <figure className="mc-score-flow"><figcaption><strong>Matchens utveckling</strong><span>Målskillnad · hemma över linjen</span></figcaption><svg viewBox="0 0 500 110" role="img" aria-label={`Målskillnad över matchen. Senaste resultat ${goals.at(-1)?.score.join('–') ?? '0–0'}.`}><path d="M0 50H500 M250 5V100" className="mc-flow-guide"/><polyline points={points.map(p => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2"/><text x="0" y="109">0′</text><text x="240" y="109">30′</text><text x="480" y="109">60′</text></svg><p className="mc-footnote">{development.half && <>Första halvlek: {development.half.join('–')}. </>}{development.largest && <>Största ledning: {Math.abs(development.largest.score[0] - development.largest.score[1])} mål ({development.largest.score.join('–')}, {clockText(development.largest.timestamp)}). </>}{development.run.length >= 3 && <>Längsta målsvit: {development.run.length} mål i följd · {development.run[0].team === 'HOME' ? 'hemma' : 'borta'}.</>}</p></figure>;
}
export function Keepers({ model }: {
    model: MatchCenterModel;
}) { return <section className="mc-keepers"><header><h2>Målvakterna</h2><span>Räddningar / räddningar + insläppta mål</span></header>{model.players.filter(p => p.role === 'GK' && (p.minutes > 0 || p.shotsFaced > 0 || p.population === 'COURT')).map(p => <article key={p.id}><div><strong>{p.name}</strong><small>{p.team === 'HOME' ? 'Hemma' : 'Borta'} · {p.saves}/{p.shotsFaced} räddningar · {p.shotsFaced - p.saves} insläppta</small></div><b>{p.shotsFaced ? Math.round(p.saves / p.shotsFaced * 100) + '%' : '—'}</b><ul>{keeperCategories(p.id, model.shots, model.events).map(r => <li key={r.kind}>{SHOT_LABEL[r.kind] ?? 'Övriga avslut'} <strong>{r.saves}/{r.faced}</strong></li>)}</ul></article>)}</section>; }
const STAT_TOOLTIPS: Record<string, string> = {
  'Mål': 'Godkända mål under ordinarie matchtid.',
  'Skott': 'Samtliga avslut mot mål oavsett utfall (mål, målvaktsräddning, täckt skott eller utanför).',
  'Mål / skott': 'Träffsäkerhet: andel avslut som resulterat i mål.',
  'Räddningar': 'Antal skott på mål som målvakten avvärjt.',
  'Räddningsprocent': 'Andel räddningar av totalt antal skott mot eget mål.',
  'Bollförluster': 'Förlorat bollinnehav utan avslut mot mål (inklusive brutna passningar, tappade bollar och tekniska fel).',
  'Tekniska fel (delmängd)': 'Otillåtna regelbrott i anfallet (stegfel, dubbelfattning, anfallsfoul eller övertramp).',
  'Frikast': 'Avblåsta försvarsförseelser där anfallet startar om från frikastlinjen.',
  '7m mål / försök': 'Mål på straffkast i förhållande till utdömda 7-meterskast.',
  '2 min': 'Antal 2-minutersutvisningar utdömda av domaren.',
  'Omställningsmål': 'Mål gjorda i kontrings- eller andrafas före uppställt försvar.',
};

export function TeamStats({ model }: {
    model: MatchCenterModel;
}) {
    const home = model.result.homeStats, away = model.result.awayStats;
    const homeTechFouls = model.events.filter(e => e.team === 'HOME' && (e.type === 'TECHNICAL_VIOLATION' || e.type === 'OFFENSIVE_FOUL')).length;
    const awayTechFouls = model.events.filter(e => e.team === 'AWAY' && (e.type === 'TECHNICAL_VIOLATION' || e.type === 'OFFENSIVE_FOUL')).length;

    const rows: [string, string | number, string | number][] = [
        ['Mål', home.goals, away.goals],
        ['Skott', home.shots, away.shots],
        ['Mål / skott', `${home.shootingPct}%`, `${away.shootingPct}%`],
        ['Räddningar', `${home.saves}/${home.shotsFaced}`, `${away.saves}/${away.shotsFaced}`],
        ['Räddningsprocent', home.shotsFaced ? `${Math.round(home.saves / home.shotsFaced * 100)}%` : '—', away.shotsFaced ? `${Math.round(away.saves / away.shotsFaced * 100)}%` : '—'],
        ['Bollförluster', home.turnovers, away.turnovers],
        ...(homeTechFouls > 0 || awayTechFouls > 0 ? [['Tekniska fel (delmängd)', homeTechFouls, awayTechFouls] as [string, number, number]] : []),
        ['7m mål / försök', `${home.sevenMetreGoals}/${home.sevenMetreAttempts}`, `${away.sevenMetreGoals}/${away.sevenMetreAttempts}`],
        ['2 min', home.twoMinuteSuspensions, away.twoMinuteSuspensions],
        ['Omställningsmål', model.shots.filter(s => s.team === 'HOME' && s.phase === 'TRANSITION' && s.outcome === 'GOAL').length, model.shots.filter(s => s.team === 'AWAY' && s.phase === 'TRANSITION' && s.outcome === 'GOAL').length]
    ];
    if (model.freeThrows?.counts) rows.splice(6, 0, ['Frikast', model.freeThrows.counts.HOME, model.freeThrows.counts.AWAY]);
    return (
        <section className="mc-team-stats">
            <h2>Matchstatistik</h2>
            <table>
                <thead><tr><th>Hemma</th><th>Statistik</th><th>Borta</th></tr></thead>
                <tbody>
                    {rows.map(([label, h, a]) => (
                        <tr key={label} title={STAT_TOOLTIPS[label] ?? label}>
                            <td>{h}</td>
                            <th scope="row">{label}</th>
                            <td>{a}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="mc-footnote">
                Bollförluster omfattar brutna passningar, förlorade lösa bollar, passnings- och mottagningsförluster samt tekniska regelbrott och passivt spel. Det är ett bredare mått än registrerade tekniska fel.
                {model.freeThrows?.counts && <> Frikast avser avblåsta försvarsförseelser; 7m och administrativa spelavbrott ingår inte.</>} Block och skott utanför räknas inte som målvaktsräddningar.
            </p>

            <details className="mc-glossary-panel">
                <summary>
                    📖 Handbollstermer & Statistikguide (Svensk ordlista)
                </summary>
                <div className="mc-glossary-grid">
                    <div>
                        <strong>Skott (Avslut)</strong>
                        <p className="hm-text-muted">Alla försök att göra mål — omfattar godkända mål, räddningar, täckta skott och skott utanför målramen.</p>
                    </div>
                    <div>
                        <strong>Bollförluster (Turnovers)</strong>
                        <p className="hm-text-muted">Alla anfall som avbrutits utan skottförsök på grund av tappad boll, bruten passning, tekniskt fel eller passivt spel.</p>
                    </div>
                    <div>
                        <strong>Tekniska fel</strong>
                        <p className="hm-text-muted">Otillåten bollbehandling eller anfallsförseelse (stegfel, dubbelfattning, anfallsfoul eller övertramp).</p>
                    </div>
                    <div>
                        <strong>Målvaktsräddningar</strong>
                        <p className="hm-text-muted">Skott på mål som motas av målvakten. Täckta skott av försvarsmuren eller bollar utanför räknas ej.</p>
                    </div>
                    <div>
                        <strong>7-meterskast</strong>
                        <p className="hm-text-muted">Straffkast tilldömt vid förhindrande av klar målchans.</p>
                    </div>
                    <div>
                        <strong>2 minuter (Utvisning)</strong>
                        <p className="hm-text-muted">Tidsstraff där laget spelar med en spelare mindre under två minuter.</p>
                    </div>
                </div>
            </details>

            <h3>Mål efter registrerad position</h3>
            <div className="mc-position-goals">
                {['V6', 'V9', 'M9', 'M6', 'H9', 'H6', 'MV'].map(pos => (
                    <span key={pos}>
                        <small>{pos}</small>
                        <strong>
                            {model.players.filter(p => p.team === 'HOME' && ROLE_LABEL[p.role] === pos).reduce((n, p) => n + p.goals, 0)} – {model.players.filter(p => p.team === 'AWAY' && ROLE_LABEL[p.role] === pos).reduce((n, p) => n + p.goals, 0)}
                        </strong>
                    </span>
                ))}
            </div>
        </section>
    );
}
const OUTCOME_LABEL: Record<string, string> = { GOAL: 'Mål', SAVE: 'Räddning', BLOCK: 'Block', MISS: 'Utan mål', PENDING: 'Pågående' };
/** MDY-02f (A) shot map + goal-mouth: the court map of registered shot origins coloured by outcome, filters by team,
 *  player, outcome and kind (incl. transition phase), the chosen shot's moment, and the keepers' saves by kind. */
export function Shots({ model, team, onMoment }: {
    model: MatchCenterModel;
    team: TeamId;
    onMoment?: (id: string) => void;
}) {
    const [selectedTeam, setTeam] = useState<TeamId>(team), [player, setPlayer] = useState(''), [outcome, setOutcome] = useState('ALL'), [kind, setKind] = useState<ShotKindFilter>('ALL'), [focus, setFocus] = useState<string | null>(null);
    const shots = filterShotKind(filterShots(model.shots, selectedTeam, player, outcome), kind);
    const kinds = [...new Set(model.shots.filter(s => s.team === selectedTeam).map(s => s.kind))];
    const focused = shots.find(s => s.eventId === focus) ?? null;
    const focusMoment = focused?.actionId ? model.keyMoments.find(m => m.actionId === focused.actionId) ?? null : null;
    const keepers = model.players.filter(p => p.role === 'GK' && p.team !== selectedTeam && (p.minutes > 0 || p.shotsFaced > 0 || p.population === 'COURT'));
    const name = (id: string) => model.players.find(p => p.id === id)?.name ?? 'Spelare';
    return <section className="mc-shots mc-shot-board"><header><h2>Avsluten</h2><span>Registrerad avslutsposition · {shots.length} i urvalet</span></header>
        <div className="mc-shot-court"><ShotMap shots={shots} selected={focus} onShot={s => setFocus(s.eventId)}/><p className="mc-footnote">G mål · R räddning · X utan mål · B block. {shots.filter(s => s.origin).length} positioner, {shots.filter(s => !s.origin).length} avslut saknar koordinater.</p></div>
        <div className="mc-shot-side">
            <div className="mc-shot-filters"><label>Lag<select aria-label="Lag" value={selectedTeam} onChange={e => { setTeam(e.target.value as TeamId); setPlayer(''); setKind('ALL'); setFocus(null); }}><option value="HOME">Hemma</option><option value="AWAY">Borta</option></select></label><label>Spelare<select aria-label="Spelare" value={player} onChange={e => { setPlayer(e.target.value); setFocus(null); }}><option value="">Alla spelare</option>{model.players.filter(p => p.team === selectedTeam).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Utfall<select aria-label="Utfall" value={outcome} onChange={e => { setOutcome(e.target.value); setFocus(null); }}>{[['ALL', 'Alla'], ['GOAL', 'Mål'], ['SAVE', 'Räddningar'], ['MISS', 'Utan mål'], ['BLOCK', 'Block']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>Typ<select aria-label="Avslutstyp" value={kind} onChange={e => { setKind(e.target.value); setFocus(null); }}><option value="ALL">Alla typer</option><option value="TRANSITION">Omställning</option>{kinds.map(k => <option key={k} value={k}>{SHOT_LABEL[k] ?? 'Övrigt'}</option>)}</select></label></div>
            <div className="mc-shot-focus" aria-live="polite">{focused ? <><strong>{clockText(focused.timestamp)} · {name(focused.playerId)}</strong><span>{SHOT_LABEL[focused.kind] ?? 'Övrigt avslut'} · {OUTCOME_LABEL[focused.outcome]}{focused.phase === 'TRANSITION' ? ' · omställning' : ''}</span>{focusMoment && onMoment ? <button type="button" className="hm-btn hm-btn-sm" onClick={() => onMoment(focusMoment.canonicalEventId)}>Öppna nyckelögonblicket →</button> : <small>{focusMoment ? 'Nyckelögonblicket finns under Nyckelögonblick.' : 'Avslutet har inget sparat nyckelögonblick.'}</small>}</> : <p>Peka på ett avslut i kartan för att se vem, hur och vad som hände.</p>}</div>
            <div className="mc-shot-categories"><h3>I urvalet</h3><p>Mål / avslut efter filter</p>{[...new Set(shots.map(s => s.kind))].map(k => <span key={k}>{SHOT_LABEL[k] ?? 'Övrigt'} <strong>{shots.filter(s => s.kind === k && s.outcome === 'GOAL').length}/{shots.filter(s => s.kind === k).length}</strong></span>)}{!shots.length && <p className="mc-empty">Inga avslut i urvalet.</p>}</div>
            <div className="mc-shot-keepers"><h3>Målvakter mot {selectedTeam === 'HOME' ? 'hemmalaget' : 'bortalaget'}</h3>{keepers.map(k => <article key={k.id}><strong>{k.name}</strong><small>{k.saves}/{k.shotsFaced} räddningar</small><ul>{keeperCategories(k.id, model.shots, model.events).map(r => <li key={r.kind}>{SHOT_LABEL[r.kind] ?? 'Övriga avslut'} <b>{r.saves}/{r.faced}</b></li>)}</ul></article>)}{!keepers.length && <p className="mc-empty">Ingen målvakt har mött avslut ännu.</p>}</div>
        </div>
    </section>;
}
