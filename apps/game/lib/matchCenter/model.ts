/** Offline presentation of one canonical match. No simulation, RNG or commands here. */
import type { CoreEvent, TeamId, Role } from '@handball-manager/handball-engine/src/v2/core/state';
import type { FastMatchResult, PlayerMatchContribution } from '@handball-manager/game-simulation';
import { resultFromSession, type ProductionMatchSession, type PlayedMatchArchive, type MatchPerson, type MatchFrame } from '../career/productionMatch';
import { isFreeThrowFact, readOrdinaryFreeThrows, type FreeThrowRead } from './freeThrows';
export const ROLE_LABEL: Record<Role, string> = { LW: 'V6', LB: 'V9', CB: 'M9', RB: 'H9', RW: 'H6', P: 'M6', P2: 'M6', GK: 'MV' };
export const SHOT_LABEL: Record<string, string> = { WING: 'Kant', PIVOT: 'Linje', BREAKTHROUGH: 'Genombrott', BACKCOURT_JUMP: 'Distans', STANDING: 'Stående', SEVEN_METRE: '7m', EMPTY_GOAL: 'Tomt mål' };
export const MATCH_SPEEDS = [1, 2, 4, 8, 16, 64] as const;
export type Importance = 'KEY' | 'NORMAL';
export type MatchPresentationEvent = {
    canonicalEventId: string;
    actionId: string | null;
    tick: number;
    timestamp: number;
    period: number;
    team: TeamId | null;
    playerId: string | null;
    type: string;
    importance: Importance;
    headline: string;
    detail: string;
    score: readonly [
        number,
        number
    ];
    tacticalContext: string | null;
    replayReference: string | null;
};
export type ShotFact = {
    eventId: string;
    actionId: string | null;
    playerId: string;
    team: TeamId;
    tick: number;
    timestamp: number;
    kind: string;
    phase: string;
    origin: {
        x: number;
        y: number;
    } | null;
    outcome: 'GOAL' | 'SAVE' | 'BLOCK' | 'MISS' | 'PENDING';
    keeperId: string | null;
};
export type PlayerRow = MatchPerson & {
    position: string;
    minutes: number;
    energy: number | null;
    population: string;
    remainingSuspension: number;
    goals: number;
    shots: number;
    saves: number;
    shotsFaced: number;
    rating: number | null;
    suspensions: number;
    technicalViolations: number;
};
export type MatchCenterModel = {
    freeThrows?: FreeThrowRead;
    events: MatchPresentationEvent[];
    shots: ShotFact[];
    players: PlayerRow[];
    result: FastMatchResult;
    clock: number | null;
    period: number | null;
    status: 'PREMATCH' | 'LIVE' | 'PAUSED' | 'TIMEOUT' | 'HALFTIME' | 'FULLTIME';
    remaining: number;
    manpower: Record<TeamId, number> | null;
    timeouts: Record<TeamId, number> | null;
    trends: string[];
    alerts: string[];
    keyMoments: MatchPresentationEvent[];
};
export type SnapshotArrow = {
    kind: 'PASS' | 'SHOT';
    fromId: string;
    toId: string | null;
    from: {
        x: number;
        y: number;
    };
    to: {
        x: number;
        y: number;
    };
};
export type TacticalSnapshot = {
    label: string;
    possessionId: string | null;
    tick: number;
    timestamp: number;
    period: number;
    score: readonly [
        number,
        number
    ];
    players: {
        person: MatchPerson;
        position: {
            x: number;
            y: number;
        };
    }[];
    ball: {
        x: number;
        y: number;
    };
    involvedIds: string[];
    arrows: SnapshotArrow[];
};
const personMap = (people: readonly MatchPerson[]) => new Map(people.map(p => [p.id, p]));
const presentationTypes = new Set(['GOAL', 'SHOT_RELEASED', 'SAVE_CAUGHT', 'SAVE_PARRY', 'SHOT_BLOCKED', 'INTERCEPTION', 'TECHNICAL_VIOLATION', 'OFFENSIVE_FOUL', 'PASSIVE_PLAY', 'TWO_MINUTE_SUSPENSION', 'DISQUALIFICATION', 'WHISTLE_RESTART', 'EXCHANGE_COMPLETED', 'TEAM_TIMEOUT_STARTED', 'TACTICS_CHANGED', 'PERIOD_STARTED', 'PERIOD_ENDED', 'MATCH_FINISHED', 'DEFENDER_BEATEN', 'ADVANTAGE_OPENED', 'PASS_RELEASED']);
const attackLabels: Record<string, string> = { BALANCED: 'balanserat', DIRECT: 'direkt', WIDTH: 'bredd', COMBINATION: 'kombinationer', QUICK: 'snabbt', SLOW: 'lugnt' };
const rotationLabels: Record<string, string> = { SHORT: 'kort', BALANCED: 'balanserad', WIDE: 'bred' };
const sevenVSixLabels: Record<string, string> = { OFF: 'av', SITUATIONAL: 'situationellt', ALWAYS: 'alltid' };
const aggressionLabels: Record<string, string> = { LOW: 'låg', BALANCED: 'balanserad', HIGH: 'hög' };
const goalLocation: Record<string, string> = { WING: 'på kanten', PIVOT: 'från linjen', BREAKTHROUGH: 'efter genombrott', BACKCOURT_JUMP: 'från distans', STANDING: 'med ett stående avslut', SEVEN_METRE: 'på sjumeterskast', EMPTY_GOAL: 'i det tomma målet' };
const saveObject: Record<string, string> = { WING: 'kantskottet', PIVOT: 'linjeavslutet', BREAKTHROUGH: 'genombrottsavslutet', BACKCOURT_JUMP: 'distansskottet', STANDING: 'det stående avslutet', SEVEN_METRE: 'sjumeterskastet', EMPTY_GOAL: 'avslutet' };
export function clockText(ms: number | null) { return ms === null ? '—' : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`; }
/** Canonical reason strings/events are evidence. No interpretation of hypothetical scores. */
export function tacticalExplanation(event: CoreEvent, events: readonly CoreEvent[], people: readonly MatchPerson[]): string | null {
    const same = events.filter(e => e.possessionId === event.possessionId && e.tick <= event.tick && event.tick - e.tick <= 160);
    const known = personMap(people), name = (id: string | null) => id ? known.get(id)?.name : null;
    const bind = same.findLast(e => e.type === 'PASS_RELEASED' && String(e.details.reason).includes('HELP_COMMITTED') && e.relatedIds.some(id => known.has(id)));
    if (bind)
        return `${name(bind.actorId) ?? 'Bollhållaren'} drar till sig hjälp och spelar ${name(bind.relatedIds[0]) ?? 'sin medspelare'}.`;
    const opened = same.findLast(e => e.type === 'ADVANTAGE_OPENED' && String(e.details.cause).includes('help') && e.relatedIds.some(id => known.has(id)));
    if (opened)
        return `${name(opened.actorId) ?? 'Försvararen'} går över för att hjälpa. ${name(opened.relatedIds[0])} blir fri.`;
    const beaten = same.findLast(e => e.type === 'DEFENDER_BEATEN' && e.actorId === event.actorId && e.relatedIds.some(id => known.has(id)));
    if (beaten)
        return `${name(beaten.actorId)} tar sig förbi ${name(beaten.relatedIds[0])}.`;
    if (event.details.phase === 'TRANSITION')
        return 'Avslutet kommer under omställningen, innan det uppställda anfallet.';
    return null;
}
export function presentationEvents(events: readonly CoreEvent[], people: readonly MatchPerson[]): MatchPresentationEvent[] {
    const known = personMap(people), goals = new Set(events.filter(e => e.type === 'GOAL').map(e => e.actionId));
    const released = new Map(events.filter(e => e.type === 'SHOT_RELEASED').map(e => [e.actionId, e]));
    let home = 0, away = 0, period = 1;
    const out: MatchPresentationEvent[] = [];
    // Context index limits tactical reads to the relevant possession, not the full match.
    const context = new Map<string, CoreEvent[]>();
    for (const event of events) {
        const rows = context.get(event.possessionId) ?? [];
        if (['PASS_RELEASED', 'ADVANTAGE_OPENED', 'DEFENDER_BEATEN'].includes(event.type)) {
            rows.push(event);
            context.set(event.possessionId, rows);
        }
        if (event.type === 'PERIOD_STARTED' && typeof event.details.period === 'number')
            period = event.details.period;
        const p = event.actorId ? known.get(event.actorId) : undefined;
        const team = p?.team ?? (['HOME', 'AWAY'].includes(String(event.details.team)) ? event.details.team as TeamId : null);
        if (event.type === 'GOAL') {
            if (team === 'HOME')
                home++;
            if (team === 'AWAY')
                away++;
        }
        if (!presentationTypes.has(event.type))
            continue;
        if (event.type.startsWith('SAVE_') && goals.has(event.actionId))
            continue; // a touch before a goal is not a credited save
        const name = p?.name ?? 'Spelaren', shot = event.type === 'SHOT_RELEASED' ? event : released.get(event.actionId), category = SHOT_LABEL[String(shot?.details.shotKind)] ?? 'avslut';
        const tacticalContext = tacticalExplanation(event, rows, people);
        let headline = '', detail = '', importance: Importance = 'NORMAL';
        switch (event.type) {
            case 'PASS_RELEASED':
                if (!String(event.details.reason).includes('HELP_COMMITTED') || !String(event.details.reason).includes('created=true') || !String(event.details.reason).includes('coverCommitted=true') || !known.has(event.relatedIds[0]))
                    continue;
                headline = `Öppning · ${known.get(event.relatedIds[0])!.name}`;
                detail = tacticalContext ?? `${name} spelar vidare efter att hjälpen gått över.`;
                importance = 'KEY';
                break;
            case 'GOAL':
                headline = shot?.details.shotKind === 'SEVEN_METRE' ? `7m-mål · ${name}` : `Mål · ${name}`;
                {
                    const location = goalLocation[String(shot?.details.shotKind)] ?? '', variants = [`${name} gör mål ${location}.`, `${name} hittar nätet ${location}.`, `${name} sätter avslutet ${location}.`];
                    detail = variants[event.tick % variants.length].replace(' .', '.');
                    const own = team === 'HOME' ? home - away : away - home;
                    if (own === 0)
                        detail += ` Kvitterat till ${home}–${away}.`;
                    else if (own === 1)
                        detail += ' Laget går upp i ledning.';
                }
                importance = 'KEY';
                break;
            case 'SAVE_CAUGHT':
            case 'SAVE_PARRY':
                headline = `Räddning · ${name}`;
                detail = `${name} ${event.type === 'SAVE_CAUGHT' ? 'håller' : 'parerar'} ${saveObject[String(shot?.details.shotKind)] ?? 'avslutet'}.`;
                importance = shot?.details.shotKind === 'SEVEN_METRE' || event.officialMs >= 55 * 60000 ? 'KEY' : 'NORMAL';
                break;
            case 'SHOT_RELEASED':
                headline = `${category} · ${name}`;
                detail = event.details.phase === 'TRANSITION' ? `${name} avslutar i omställningen.` : `${name} går till avslut.`;
                importance = event.details.shotKind === 'SEVEN_METRE' ? 'KEY' : 'NORMAL';
                break;
            case 'SHOT_BLOCKED':
                headline = `Block · ${name}`;
                detail = `${name} blockerar avslutet.`;
                break;
            case 'INTERCEPTION':
                headline = `Bruten passning · ${name}`;
                detail = `${name} bryter passningen${name && event.relatedIds[0] && known.has(event.relatedIds[0]) ? ` från ${known.get(event.relatedIds[0])!.name}` : ''}.`;
                break;
            case 'TECHNICAL_VIOLATION':
                headline = `Tekniskt fel · ${name}`;
                detail = 'Domaren avbryter anfallet för ett tekniskt regelbrott.';
                break;
            case 'PASSIVE_PLAY':
                headline = 'Passivt spel';
                detail = 'Anfallet förlorar bollen efter passivt spel.';
                break;
            case 'OFFENSIVE_FOUL':
                headline = `Anfallsfel · ${name}`;
                detail = 'Bollen går över till motståndaren.';
                break;
            case 'TWO_MINUTE_SUSPENSION':
                headline = `2 MIN · ${name}`;
                detail = `${name} utvisas i två minuter.`;
                importance = 'KEY';
                break;
            case 'DISQUALIFICATION':
                headline = `Rött kort · ${name}`;
                detail = `${name} får lämna matchen.`;
                importance = 'KEY';
                break;
            case 'WHISTLE_RESTART':
                headline = event.details.kind === 'SEVEN_METRE' ? '7m dömd' : 'Frikast';
                detail = event.details.kind === 'SEVEN_METRE' ? 'Domaren dömer sjumeterskast.' : 'Spelet stoppas för frikast.';
                importance = event.details.kind === 'SEVEN_METRE' ? 'KEY' : 'NORMAL';
                break;
            case 'TEAM_TIMEOUT_STARTED':
                headline = 'Timeout';
                detail = 'Laget samlas vid bänken för nya instruktioner.';
                importance = 'KEY';
                break;
            case 'EXCHANGE_COMPLETED':
                headline = `Byte · ${name}`;
                detail = `${known.get(event.relatedIds[0])?.name ?? 'Spelaren'} lämnar. ${name} går in som ${ROLE_LABEL[String(event.details.role) as Role] ?? ROLE_LABEL[p?.role ?? 'CB']}.`;
                importance = 'KEY';
                break;
            case 'TACTICS_CHANGED':
                headline = 'Nya instruktioner';
                detail = [event.details.attackIdentity && `Anfall: ${attackLabels[String(event.details.attackIdentity)] ?? event.details.attackIdentity}`, event.details.defence && `Försvar: ${event.details.defence}`, event.details.aggression && `Aggressivitet: ${aggressionLabels[String(event.details.aggression)] ?? event.details.aggression}`, event.details.tempo && `Tempo: ${attackLabels[String(event.details.tempo)] ?? event.details.tempo}`, event.details.rotationStrategy && `Rotation: ${rotationLabels[String(event.details.rotationStrategy)] ?? event.details.rotationStrategy}`, event.details.sevenVSix && `7 mot 6: ${sevenVSixLabels[String(event.details.sevenVSix)] ?? event.details.sevenVSix}`, typeof event.details.rotation === 'boolean' && `Assistentbyten ${event.details.rotation ? 'på' : 'av'}`].filter(Boolean).join(' · ');
                importance = 'KEY';
                break;
            case 'PERIOD_STARTED':
                headline = event.details.period === 2 ? 'Andra halvlek' : 'Avkast';
                detail = 'Matchen är igång.';
                importance = 'KEY';
                break;
            case 'PERIOD_ENDED':
                headline = event.details.period === 1 ? 'Halvtid' : 'Halvleken är slut';
                detail = `${home}–${away}`;
                importance = 'KEY';
                break;
            case 'MATCH_FINISHED':
                headline = 'Slutsignal';
                detail = `Matchen slutar ${home}–${away}.`;
                importance = 'KEY';
                break;
            case 'DEFENDER_BEATEN':
                headline = `Genombrott · ${name}`;
                detail = tacticalContext ?? `${name} passerar sin försvarare.`;
                break;
            case 'ADVANTAGE_OPENED':
                if (!tacticalContext)
                    continue;
                headline = 'Försvaret öppnar sig';
                detail = tacticalContext;
                break;
        }
        const importantPlay = ['GOAL', 'SAVE_CAUGHT', 'SAVE_PARRY', 'SHOT_BLOCKED', 'DEFENDER_BEATEN', 'PASS_RELEASED'].includes(event.type) && !!p;
        out.push({ canonicalEventId: event.id, actionId: event.actionId, tick: event.tick, timestamp: event.officialMs, period, team, playerId: event.actorId, type: event.type, importance, headline, detail, score: [home, away], tacticalContext, replayReference: importantPlay ? event.id : null });
    }
    return out;
}
export function shotFacts(events: readonly CoreEvent[], people: readonly MatchPerson[], flyingAction: string | null = null, complete = true): ShotFact[] {
    const known = personMap(people), goals = new Set(events.filter(e => e.type === 'GOAL').map(e => e.actionId)), saves = new Set(events.filter(e => e.type.startsWith('SAVE_')).map(e => e.actionId)), blocks = new Set(events.filter(e => e.type === 'SHOT_BLOCKED').map(e => e.actionId));
    return events.filter(e => e.type === 'SHOT_RELEASED' && e.actorId && known.has(e.actorId)).map(e => ({ eventId: e.id, actionId: e.actionId, playerId: e.actorId!, team: known.get(e.actorId!)!.team, tick: e.tick, timestamp: e.officialMs, kind: String(e.details.shotKind ?? 'NONE'), phase: String(e.details.phase ?? ''), origin: typeof e.details.x === 'number' && typeof e.details.y === 'number' ? { x: e.details.x, y: e.details.y } : null, outcome: goals.has(e.actionId) ? 'GOAL' : saves.has(e.actionId) ? 'SAVE' : blocks.has(e.actionId) ? 'BLOCK' : !complete && e.actionId === flyingAction ? 'PENDING' : 'MISS', keeperId: typeof e.details.goalkeeperId === 'string' && known.has(e.details.goalkeeperId) ? e.details.goalkeeperId : null }));
}
function playerRows(people: MatchPerson[], result: FastMatchResult, events: readonly CoreEvent[], session?: ProductionMatchSession, archive?: PlayedMatchArchive): PlayerRow[] {
    const contributions = new Map([...result.homePlayerContributions, ...result.awayPlayerContributions].map(p => [p.playerId, p]));
    const counts = new Map<string, {
        suspensions: number;
        technical: number;
    }>();
    for (const e of events)
        if (e.actorId && ['TWO_MINUTE_SUSPENSION', 'TECHNICAL_VIOLATION', 'OFFENSIVE_FOUL'].includes(e.type)) {
            const count = counts.get(e.actorId) ?? { suspensions: 0, technical: 0 };
            if (e.type === 'TWO_MINUTE_SUSPENSION')
                count.suspensions++;
            else
                count.technical++;
            counts.set(e.actorId, count);
        }
    return people.map(p => { const core = session?.core.players.find(c => c.id === p.id), stats = contributions.get(p.id), count = counts.get(p.id); return { ...p, position: ROLE_LABEL[core?.role ?? p.role], minutes: core ? core.condition.courtMs / 60000 : archive?.load?.[p.id]?.minutes ?? 0, energy: core ? core.condition.energy * 100 : archive?.load?.[p.id]?.energy ?? null, population: core?.population ?? 'ARCHIVE', remainingSuspension: Math.max(0, (core?.suspensionUntilMs ?? 0) - (session?.core.officialClock.timeMs ?? 0)), goals: stats?.goals ?? 0, shots: stats?.shots ?? 0, saves: stats?.saves ?? 0, shotsFaced: stats?.shotsFaced ?? 0, rating: stats?.rating ?? null, suspensions: count?.suspensions ?? 0, technicalViolations: count?.technical ?? 0 }; });
}
function descriptions(events: MatchPresentationEvent[], shots: ShotFact[], players: PlayerRow[], clock: number | null) {
    const recent = clock === null ? [] : events.filter(e => e.timestamp >= clock - 5 * 60000), recentGoals = recent.filter(e => e.type === 'GOAL');
    const trends: string[] = [];
    if (recentGoals.length)
        trends.push(`Senaste fem spelminuterna: ${recentGoals.filter(e => e.team === 'HOME').length}–${recentGoals.filter(e => e.team === 'AWAY').length} i mål.`);
    for (const team of ['HOME', 'AWAY'] as const) {
        const last = shots.filter(s => s.team === team).slice(-3);
        if (last.length === 3 && last.every(s => s.outcome !== 'GOAL' && s.outcome !== 'PENDING'))
            trends.push(`${team === 'HOME' ? 'Hemmalaget' : 'Bortalaget'} har tre avslut i följd utan mål.`);
    }
    const best = players.filter(p => p.role !== 'GK').sort((a, b) => b.goals - a.goals)[0];
    if (best?.shots)
        trends.push(`${best.name}: ${best.goals}/${best.shots} i avsluten.`);
    const change = events.findLast(e => e.type === 'TACTICS_CHANGED');
    if (change) {
        const ids = new Set(events.slice(events.indexOf(change) + 1).filter(e => e.type === 'SHOT_RELEASED').map(e => e.canonicalEventId)), since = shots.filter(s => s.team === change.team && ids.has(s.eventId));
        trends.push(`Efter instruktionen vid ${clockText(change.timestamp)}: ${change.team === 'HOME' ? 'hemma' : 'borta'} har ${since.filter(s => s.outcome === 'GOAL').length} mål på ${since.length} avslut.`);
    }
    const alerts = players.filter(p => p.population === 'COURT' && p.energy != null && p.energy < 60).slice(0, 3).map(p => `${p.name}: ${Math.round(p.energy!)}% energi.`);
    for (const p of players.filter(p => p.population === 'SUSPENDED'))
        alerts.push(`${p.name}: 2 MIN, ${clockText(p.remainingSuspension)} kvar.`);
    for (const p of players.filter(p => p.population === 'COURT' && p.suspensions >= 2))
        alerts.push(`${p.name} har redan två utvisningar i matchen.`);
    for (const p of players.filter(p => p.role === 'GK' && p.shotsFaced >= 10 && p.saves / p.shotsFaced < .15))
        alerts.push(`${p.name} har räddat ${p.saves} av ${p.shotsFaced}.`);
    return { trends, alerts };
}
type PresentationRead = {
    freeThrows: FreeThrowRead;
    result: FastMatchResult;
    events: MatchPresentationEvent[];
    shots: ShotFact[];
    facts: CoreEvent[];
};
function shotCommentary(events: MatchPresentationEvent[], shots: ShotFact[], people: MatchPerson[]) {
    const outcomes = new Map(shots.map(s => [s.eventId, s.outcome])), known = personMap(people);
    return events.map(e => e.type === 'SHOT_RELEASED' && outcomes.get(e.canonicalEventId) === 'MISS' ? { ...e, headline: `Avslut utan mål · ${known.get(e.playerId ?? '')?.name ?? 'Spelaren'}`, detail: 'Avslutet ger inget mål. Det räknas inte som en målvaktsräddning.' } : e);
}
export function liveMatchModel(session: ProductionMatchSession, playing = false, read?: PresentationRead): MatchCenterModel {
    const c = session.core, result = read?.result ?? resultFromSession(session), shots = read?.shots ?? shotFacts(c.events, session.people, c.ball.flight?.actionId ?? null, false), events = shotCommentary(read?.events ?? presentationEvents(c.events, session.people), shots, session.people), players = playerRows(session.people, result, read?.facts ?? c.events, session);
    const status = c.match?.phase === 'FULLTIME' ? 'FULLTIME' : session.pausedAtHalf || c.match?.phase === 'HALFTIME' ? 'HALFTIME' : c.referee.timeout?.reason === 'TEAM_TIMEOUT' ? 'TIMEOUT' : c.match?.phase === 'PREMATCH' ? 'PREMATCH' : playing ? 'LIVE' : 'PAUSED';
    const manpower = { HOME: c.players.filter(p => p.team === 'HOME' && p.population === 'COURT' && p.kind === 'FIELD_PLAYER').length, AWAY: c.players.filter(p => p.team === 'AWAY' && p.population === 'COURT' && p.kind === 'FIELD_PLAYER').length };
    const timeouts = { HOME: c.referee.teamTimeouts.HOME.includes(c.period) ? 0 : 1, AWAY: c.referee.teamTimeouts.AWAY.includes(c.period) ? 0 : 1 };
    return { freeThrows: read?.freeThrows ?? readOrdinaryFreeThrows(c.events, { source: 'LIVE', behaviorRevision: session.behaviorRevision, complete: c.match?.phase === 'FULLTIME' }), result, events, shots, players, clock: c.officialClock.timeMs, period: c.period, status, remaining: Math.max(0, (c.match?.periodLengthMs ?? 1800000) - (c.officialClock.timeMs - (c.match?.periodStartMs ?? 0))), manpower, timeouts, keyMoments: events.filter(e => e.replayReference && (e.importance === 'KEY' || e.type === 'SHOT_BLOCKED' || e.type === 'DEFENDER_BEATEN')), ...descriptions(events, shots, players, c.officialClock.timeMs) };
}
/** Per-view cache of immutable append-only facts. Never attached to a save or core. */
export function createLiveMatchReader() {
    let fixture = '', cursor = 0, tail: CoreEvent | undefined, facts: CoreEvent[] = [], freeThrowFacts: CoreEvent[] = [], read: PresentationRead | undefined, statKey = '', flight: string | null = null;
    return (session: ProductionMatchSession, playing = false) => {
        const c = session.core, reset = fixture !== session.fixture.id || cursor > c.events.length || cursor > 0 && c.events[cursor - 1] !== tail;
        if (reset) {
            fixture = session.fixture.id;
            cursor = 0;
            facts = [];
            freeThrowFacts = [];
            read = undefined;
            statKey = '';
        }
        const fresh = c.events.slice(cursor), meaningful = fresh.filter(e => presentationTypes.has(e.type) || e.type === 'PASS_RELEASED');
        facts.push(...meaningful);
        const newFreeThrowFacts = fresh.filter(isFreeThrowFact);
        freeThrowFacts.push(...newFreeThrowFacts);
        cursor = c.events.length;
        tail = c.events.at(-1);
        const key = `${c.score.HOME}:${c.score.AWAY}:${Math.ceil(c.officialClock.timeMs / 60000)}:${c.players.filter(p => p.condition.courtMs > 0).map(p => p.id).join(',')}`;
        const resultEvents = new Set(['PASS_RECEIVED', 'SHOT_RELEASED', 'GOAL', 'SAVE_CAUGHT', 'SAVE_PARRY', 'SHOT_BLOCKED', 'REBOUND_CONTROLLED', 'INTERCEPTION', 'PASSIVE_PLAY', 'BALL_OUT', 'FOUL', 'WHISTLE_RESTART', 'ADVANTAGE_RECALLED', 'RESTART_COMPLETED', 'RESTART_AWARDED', 'POSSESSION_AWARDED', 'POSSESSION_CHANGED', 'BALL_CONTROLLED', 'RECEPTION_FAILED', 'OFFENSIVE_FOUL', 'TECHNICAL_VIOLATION', 'TWO_MINUTE_SUSPENSION', 'DISQUALIFICATION', 'PERIOD_ENDED', 'MATCH_FINISHED', 'KEEPER_COLLECTED_OFF_TARGET', 'OFF_TARGET_KEEPER_TOUCH']);
        const statsChanged = !read || key !== statKey || fresh.some(e => resultEvents.has(e.type));
        const result = statsChanged ? resultFromSession(session) : read!.result;
        statKey = key;
        const historyChanged = !read || meaningful.length > 0;
        const flying = c.ball.flight?.actionId ?? null;
        const freeThrows = !read || newFreeThrowFacts.length || fresh.some(e => e.type === 'MATCH_FINISHED') ? readOrdinaryFreeThrows(freeThrowFacts, { source: 'LIVE', behaviorRevision: session.behaviorRevision, complete: c.match?.phase === 'FULLTIME' }) : read.freeThrows;
        read = { freeThrows, result, events: historyChanged || fresh.some(e => ['BALL_OUT', 'POSSESSION_AWARDED'].includes(e.type)) ? presentationEvents(facts, session.people) : read!.events, shots: historyChanged || flight !== flying ? shotFacts(facts, session.people, flying, false) : read!.shots, facts };
        flight = flying;
        return liveMatchModel(session, playing, read);
    };
}
export function archivedMatchModel(archive: PlayedMatchArchive, frames?: readonly MatchFrame[]): MatchCenterModel {
    const shots = shotFacts(archive.events, archive.people), events = shotCommentary(presentationEvents(archive.events, archive.people), shots, archive.people), players = playerRows(archive.people, archive.result, archive.events, undefined, archive), clock = frames?.at(-1)?.[1] ?? archive.events.at(-1)?.officialMs ?? null;
    const lastPeriod = archive.events.findLast(e => e.type === 'PERIOD_STARTED')?.details.period, period = frames?.at(-1)?.[2] ?? (typeof lastPeriod === 'number' ? lastPeriod : null);
    return { freeThrows: readOrdinaryFreeThrows(archive.events, { source: 'ARCHIVE', behaviorRevision: archive.behaviorRevision, complete: true }), result: archive.result, events, shots, players, clock, period, status: 'FULLTIME', remaining: 0, manpower: null, timeouts: null, keyMoments: events.filter(e => e.replayReference && (e.importance === 'KEY' || e.type === 'SHOT_BLOCKED' || e.type === 'DEFENDER_BEATEN')), ...descriptions(events, shots, players, clock) };
}
/** Floor search: exact observed rows only, never interpolation/extrapolation. */
export function recordedFrame(frames: readonly MatchFrame[], tick: number): MatchFrame | null {
    if (!frames.length || tick < frames[0][0])
        return null;
    let low = 0, high = frames.length - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (frames[mid][0] <= tick)
            low = mid;
        else
            high = mid - 1;
    }
    return frames[low];
}
export function snapshotsFor(eventId: string, events: readonly CoreEvent[], frames: readonly MatchFrame[], people: MatchPerson[]): TacticalSnapshot[] {
    const event = events.find(e => e.id === eventId);
    if (!event)
        return [];
    const same = events.filter(e => e.possessionId === event.possessionId && e.tick <= event.tick), shot = same.findLast(e => e.type === 'SHOT_RELEASED' && e.actionId === event.actionId), end = shot ?? event;
    const evidence = same.findLast(e => e.tick < end.tick && end.tick - e.tick <= 60 && ['DEFENDER_BEATEN', 'ADVANTAGE_OPENED', 'PASS_RELEASED'].includes(e.type));
    const requested = [{ label: 'Före', tick: Math.max(frames[0]?.[0] ?? 0, end.tick - 24) }, { label: evidence ? 'Situationen' : 'Uppbyggnad', tick: evidence?.tick ?? end.tick - 10 }, { label: shot ? 'Avslut' : 'Händelsen', tick: end.tick }];
    const known = personMap(people), involvedIds = [...new Set([event.actorId, end.actorId, ...event.relatedIds, ...end.relatedIds, ...(evidence?.relatedIds ?? []), evidence?.actorId].filter((id): id is string => !!id && known.has(id)))];
    const snapshots: TacticalSnapshot[] = [];
    for (const request of requested.sort((a, b) => a.tick - b.tick)) {
        const frame = recordedFrame(frames, request.tick);
        if (!frame || snapshots.some(s => s.tick === frame[0]))
            continue;
        const players = [];
        for (let i = 7; i < frame.length; i += 3) {
            const person = people[frame[i]];
            if (person)
                players.push({ person, position: { x: frame[i + 1] / 100, y: frame[i + 2] / 100 } });
        }
        const arrows: SnapshotArrow[] = [];
        if (request.tick === end.tick || request.tick === evidence?.tick) {
            const pass = end.type === 'PASS_RELEASED' && request.tick === end.tick ? end : evidence?.type === 'PASS_RELEASED' && request.tick === evidence.tick ? evidence : null, from = players.find(p => p.person.id === (pass?.actorId ?? shot?.actorId)), to = pass ? players.find(p => p.person.id === pass.relatedIds[0]) : null;
            if (pass && from && to)
                arrows.push({ kind: 'PASS', fromId: from.person.id, toId: to.person.id, from: from.position, to: to.position });
            if (request.tick === end.tick && shot && typeof shot.details.x === 'number' && typeof shot.details.y === 'number' && shot.actorId)
                arrows.push({ kind: 'SHOT', fromId: shot.actorId, toId: null, from: { x: shot.details.x, y: shot.details.y }, to: { x: frame[5] / 100, y: frame[6] / 100 } });
        }
        const atFrame = events.findLast(e => e.tick === frame[0]);
        snapshots.push({ label: request.label, possessionId: atFrame?.possessionId ?? null, tick: frame[0], timestamp: frame[1], period: frame[2], score: [frame[3], frame[4]], players, ball: { x: frame[5] / 100, y: frame[6] / 100 }, involvedIds, arrows });
    }
    return snapshots;
}
export function keeperCategories(playerId: string, shots: ShotFact[], events?: MatchPresentationEvent[]) {
    const rows = new Map<string, {
        kind: string;
        saves: number;
        faced: number;
    }>();
    if (events) {
        const byAction = new Map(shots.map(s => [s.actionId, s]));
        for (const event of events) {
            const shot = byAction.get(event.actionId), saved = event.type.startsWith('SAVE_') && event.playerId === playerId, conceded = event.type === 'GOAL' && shot?.keeperId === playerId;
            if (!saved && !conceded)
                continue;
            const kind = shot?.kind ?? 'UNCLASSIFIED', row = rows.get(kind) ?? { kind, saves: 0, faced: 0 };
            row.faced++;
            if (saved)
                row.saves++;
            rows.set(kind, row);
        }
        return [...rows.values()];
    }
    for (const shot of shots.filter(s => s.keeperId === playerId && ['GOAL', 'SAVE'].includes(s.outcome))) {
        const row = rows.get(shot.kind) ?? { kind: shot.kind, saves: 0, faced: 0 };
        row.faced++;
        if (shot.outcome === 'SAVE')
            row.saves++;
        rows.set(shot.kind, row);
    }
    return [...rows.values()];
}
/** Conservative stops, once per event. Reading speed never changes engine draws. */
export function shouldStopAtKey(event: MatchPresentationEvent) { return ['TWO_MINUTE_SUSPENSION', 'DISQUALIFICATION', 'TEAM_TIMEOUT_STARTED', 'PERIOD_ENDED', 'MATCH_FINISHED'].includes(event.type) || event.type === 'WHISTLE_RESTART' && event.headline === '7m dömd' || event.type === 'GOAL' && (event.timestamp >= 55 * 60000 || Math.abs(event.score[0] - event.score[1]) === 1); }
export type PerformanceContribution = PlayerMatchContribution;
