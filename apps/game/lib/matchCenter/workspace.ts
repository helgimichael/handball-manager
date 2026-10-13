/** Match-specific, read-only presentation. Never writes match or career state. */
import type { CoreEvent, TeamId } from '@handball-manager/handball-engine/src/v2/core/state';
import type { MatchCenterModel, MatchPresentationEvent, PlayerRow, ShotFact, TacticalSnapshot } from './model';
import { clockText, ROLE_LABEL } from './model';
import type { MatchPerson } from '../career/productionMatch';

export const MATCH_VIEWS = ['OVERVIEW', 'MOMENTS', 'PLAYERS', 'STATS'] as const;
export type MatchView = typeof MATCH_VIEWS[number];
export const VIEW_LABELS: Record<MatchView, string> = { OVERVIEW: 'Översikt', MOMENTS: 'Nyckelögonblick', PLAYERS: 'Spelare', STATS: 'Statistik' };
export function keyboardView(current: MatchView, key: string): MatchView | null {
    const i = MATCH_VIEWS.indexOf(current);
    if (key === 'Home') return MATCH_VIEWS[0];
    if (key === 'End') return MATCH_VIEWS.at(-1)!;
    if (key === 'ArrowRight') return MATCH_VIEWS[(i + 1) % MATCH_VIEWS.length];
    if (key === 'ArrowLeft') return MATCH_VIEWS[(i + MATCH_VIEWS.length - 1) % MATCH_VIEWS.length];
    return null;
}
export type PlayerSort = 'POSITION' | 'RATING' | 'GOALS' | 'SHOTS' | 'MINUTES' | 'ENERGY';
export function sortedPlayers(players: readonly PlayerRow[], team: TeamId, sort: PlayerSort) {
    const roles = ['GK', 'LW', 'LB', 'CB', 'P', 'P2', 'RB', 'RW'];
    const value = (p: PlayerRow) => ({ POSITION: -roles.indexOf(p.role), RATING: p.rating ?? -1, GOALS: p.goals, SHOTS: p.shots, MINUTES: p.minutes, ENERGY: p.energy ?? -1 })[sort];
    return players.filter(p => p.team === team).sort((a, b) => value(b) - value(a) || b.minutes - a.minutes || a.id.localeCompare(b.id));
}
export const MOMENT_FILTERS = ['ALL', 'GOAL', 'SAVE', 'BREAKTHROUGH', 'TRANSITION', 'SEVEN_METRE', 'DEFENCE'] as const;
export type MomentFilter = typeof MOMENT_FILTERS[number];
export const FILTER_LABELS: Record<MomentFilter, string> = { ALL: 'Alla', GOAL: 'Mål', SAVE: 'Räddningar', BREAKTHROUGH: 'Genombrott', TRANSITION: 'Omställning', SEVEN_METRE: '7m', DEFENCE: 'Försvar' };
export function momentMatches(moment: MatchPresentationEvent, filter: MomentFilter, shots: readonly ShotFact[]) {
    const shot = shots.find(s => s.actionId !== null && s.actionId === moment.actionId);
    if (filter === 'ALL') return true;
    if (filter === 'GOAL') return moment.type === 'GOAL';
    if (filter === 'SAVE') return moment.type.startsWith('SAVE_');
    if (filter === 'BREAKTHROUGH') return moment.type === 'DEFENDER_BEATEN' || shot?.kind === 'BREAKTHROUGH';
    if (filter === 'TRANSITION') return shot?.phase === 'TRANSITION';
    if (filter === 'SEVEN_METRE') return shot?.kind === 'SEVEN_METRE' || moment.headline === '7m dömd';
    return ['INTERCEPTION', 'SHOT_BLOCKED', 'DEFENDER_BEATEN'].includes(moment.type) || moment.type.startsWith('SAVE_');
}
export function playerMoments(id: string, moments: readonly MatchPresentationEvent[], events: readonly CoreEvent[]) {
    const related = new Set(events.filter(e => e.actorId === id || e.relatedIds.includes(id)).map(e => e.id));
    return moments.filter(m => related.has(m.canonicalEventId));
}
export function filterShots(shots: readonly ShotFact[], team: TeamId, player = '', outcome = 'ALL') {
    return shots.filter(s => s.team === team && (!player || s.playerId === player) && (outcome === 'ALL' || s.outcome === outcome));
}
export function matchDevelopment(events: readonly MatchPresentationEvent[]) {
    const goals = events.filter(e => e.type === 'GOAL');
    const half = goals.findLast(e => e.period === 1)?.score ?? null;
    const largest = goals.reduce<MatchPresentationEvent | null>((best, e) => !best || Math.abs(e.score[0] - e.score[1]) > Math.abs(best.score[0] - best.score[1]) ? e : best, null);
    let run: MatchPresentationEvent[] = [], longest: MatchPresentationEvent[] = [];
    for (const e of goals) { run = run.at(-1)?.team === e.team ? [...run, e] : [e]; if (run.length > longest.length) longest = run; }
    return { half, largest, run: longest };
}
export function overviewFacts(model: MatchCenterModel, names: Record<TeamId, string>) {
    const facts: { id: string; text: string }[] = [];
    const top = sortedPlayers(model.players, 'HOME', 'GOALS').concat(sortedPlayers(model.players, 'AWAY', 'GOALS')).sort((a, b) => b.goals - a.goals || a.id.localeCompare(b.id))[0];
    if (top?.goals) facts.push({ id: 'scorer', text: `${top.name} leder målskyttet med ${top.goals} mål på ${top.shots} avslut.` });
    const keeper = model.players.filter(p => p.role === 'GK' && p.shotsFaced >= 10).sort((a, b) => a.saves / a.shotsFaced - b.saves / b.shotsFaced || b.shotsFaced - a.shotsFaced)[0];
    if (keeper) facts.push({ id: 'keeper', text: `${keeper.name}: ${keeper.saves} räddningar på ${keeper.shotsFaced} avslut på mål (${Math.round(keeper.saves / keeper.shotsFaced * 100)}%).` });
    const development = matchDevelopment(model.events);
    if (development.run.length >= 3) facts.push({ id: 'run', text: `${names[development.run[0].team!]} gjorde ${development.run.length} mål i följd, ${clockText(development.run[0].timestamp)}–${clockText(development.run.at(-1)!.timestamp)}.` });
    if (development.half && model.period === 2) facts.push({ id: 'half', text: `Halvtid ${development.half.join('–')}. ${model.status === 'FULLTIME' ? 'Slutresultat' : 'Nu'} ${model.result.homeGoals}–${model.result.awayGoals}.` });
    for (const team of ['HOME', 'AWAY'] as const) {
        const count = model.shots.filter(s => s.team === team && s.phase === 'TRANSITION' && s.outcome === 'GOAL').length;
        if (count) facts.push({ id: `transition-${team}`, text: `${names[team]} har ${count} omställningsmål.` });
    }
    if (model.result.homeStats.twoMinuteSuspensions || model.result.awayStats.twoMinuteSuspensions) facts.push({ id: 'discipline', text: `Tvåminutersutvisningar: ${model.result.homeStats.twoMinuteSuspensions}–${model.result.awayStats.twoMinuteSuspensions}.` });
    return facts.slice(0, 4);
}
export function overviewMoments(model: MatchCenterModel) {
    const importance = (m: MatchPresentationEvent) => (m.tacticalContext ? 3 : 0) + (m.timestamp >= 55 * 60000 ? 4 : 0) + (m.type === 'GOAL' && Math.abs(m.score[0] - m.score[1]) <= 1 ? 3 : 0) + (m.type.startsWith('SAVE_') ? 1 : 0);
    return model.keyMoments.slice().sort((a, b) => importance(b) - importance(a) || b.tick - a.tick).slice(0, 4).sort((a, b) => a.tick - b.tick);
}
export function performers(model: MatchCenterModel) {
    const by = (value: (p: PlayerRow) => number, predicate: (p: PlayerRow) => boolean) => model.players.filter(predicate).sort((a, b) => value(b) - value(a) || a.id.localeCompare(b.id))[0];
    const candidates = [
        { label: 'Högsta betyg', player: by(p => p.rating ?? -1, p => p.rating !== null) },
        { label: 'Främsta målskytt', player: by(p => p.goals, p => p.goals > 0) },
        { label: 'Målvakt · räddningsprocent', player: by(p => p.saves / p.shotsFaced, p => p.role === 'GK' && p.shotsFaced > 0) },
    ];
    const seen = new Set<string>();
    return candidates.filter(c => { if (!c.player || seen.has(c.player.id)) return false; seen.add(c.player.id); return true; });
}

export type ActorRole = 'Bollhållare' | 'Avslutare' | 'Försvarare' | 'Hjälpförsvarare' | 'Mottagare' | 'Målvakt';
export function tacticalStory(moment: MatchPresentationEvent, events: readonly CoreEvent[], people: readonly MatchPerson[], snapshots: readonly TacticalSnapshot[]) {
    const event = events.find(e => e.id === moment.canonicalEventId);
    if (!event) return { explanation: moment.detail, stages: snapshots.map(() => 'Sparat läge'), actors: {} as Record<string, ActorRole> };
    const same = events.filter(e => e.possessionId === event.possessionId && e.tick <= event.tick && event.tick - e.tick <= 160);
    const known = new Map(people.map(p => [p.id, p]));
    const shot = same.findLast(e => e.type === 'SHOT_RELEASED' && e.actionId === event.actionId);
    const beaten = same.findLast(e => e.type === 'DEFENDER_BEATEN' && known.has(e.relatedIds[0]));
    const pass = same.findLast(e => e.type === 'PASS_RELEASED' && /HELP_COMMITTED/.test(String(e.details.reason)) && /created=true/.test(String(e.details.reason)) && /coverCommitted=true/.test(String(e.details.reason)) && known.has(e.relatedIds[0]));
    const help = same.findLast(e => e.type === 'ADVANTAGE_OPENED' && String(e.details.cause).includes('help') && known.has(e.relatedIds[0]));
    const actors: Record<string, ActorRole> = {};
    const add = (id: string | null | undefined, role: ActorRole) => { if (id && known.has(id)) actors[id] = role; };
    const sentences: string[] = [];
    if (beaten) { add(beaten.actorId, 'Bollhållare'); add(beaten.relatedIds[0], 'Försvarare'); sentences.push(`${known.get(beaten.actorId ?? '')?.name ?? 'Bollhållaren'} slår sin försvarare, ${known.get(beaten.relatedIds[0])!.name}.`); }
    if (help) { add(help.actorId, 'Hjälpförsvarare'); add(help.relatedIds[0], 'Mottagare'); sentences.push(`${known.get(help.actorId ?? '')?.name ?? 'Hjälpförsvaret'} kliver i hjälp. ${known.get(help.relatedIds[0])!.name} får en öppning.`); }
    if (pass) { add(pass.actorId, 'Bollhållare'); add(pass.relatedIds[0], 'Mottagare'); sentences.push(`${known.get(pass.actorId ?? '')?.name ?? 'Bollhållaren'} spelar vidare till ${known.get(pass.relatedIds[0])!.name} (${ROLE_LABEL[known.get(pass.relatedIds[0])!.role]}).`); }
    if (shot) add(shot.actorId, 'Avslutare');
    if (event.type.startsWith('SAVE_')) add(event.actorId, 'Målvakt');
    if (event.type === 'INTERCEPTION') add(event.actorId, 'Försvarare');
    if (!sentences.length && shot?.details.phase === 'TRANSITION') sentences.push('Avslutet kommer i omställningen.');
    sentences.push(moment.detail);
    const stages = snapshots.map((s, i) => {
        if (i === snapshots.length - 1) return shot ? 'Avslut' : event.type === 'PASS_RELEASED' ? 'Passningen' : 'Utfallet';
        // A recorded pose must be at/after the evidence tick before receiving its label.
        if (help && s.tick >= help.tick) return 'Hjälpförsvaret kliver';
        if (beaten && s.tick >= beaten.tick) return 'Försvararen passeras';
        if (pass && s.tick >= pass.tick) return 'Passningen';
        return 'Utgångsläge';
    });
    return { explanation: sentences.join(' '), stages, actors };
}
