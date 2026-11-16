/**
 * Arena Nights -- Floodlight Sequence (MDY-02 C) presentation helpers for the live Match Center.
 * Pure and read-only: every value is derived from the existing match-center model / core state that the
 * screen already receives. Nothing here writes match or career state or touches the engine.
 */
import type { TeamId } from '@handball-manager/handball-engine/src/v2/core/state';
import { MATCH_SPEED_OPTIONS, type MatchCenterModel, type MatchPresentationEvent, type PlayerRow, type ShotFact } from '@/lib/matchCenter/model';
import { momentMatches, type MomentFilter } from '@/lib/matchCenter/workspace';

/** The match as phases: walk-out -> live -> timeout huddle -> half-time briefing -> final whistle. */
export type MatchPhase = 'WALKOUT' | 'LIVE' | 'HUDDLE' | 'HALFTIME' | 'FINAL';
export const PHASE_LABEL: Record<MatchPhase, string> = { WALKOUT: 'Inmarsch', LIVE: 'Live', HUDDLE: 'Timeout', HALFTIME: 'Halvtid', FINAL: 'Slutsignal' };
export function matchPhase(status: MatchCenterModel['status']): MatchPhase {
    if (status === 'PREMATCH') return 'WALKOUT';
    if (status === 'TIMEOUT') return 'HUDDLE';
    if (status === 'HALFTIME') return 'HALFTIME';
    if (status === 'FULLTIME') return 'FINAL';
    return 'LIVE';
}

const MATCH_MS = 3600000;
const other = (team: TeamId): TeamId => team === 'HOME' ? 'AWAY' : 'HOME';

/** Goal difference over time from `team`'s point of view (step function, starts 0 at 0:00). Goals only -- the
 *  same registered events the score uses; no invented "pressure" metric. */
export type MomentumPoint = { at: number; diff: number };
export function momentumSeries(events: readonly MatchPresentationEvent[], team: TeamId): MomentumPoint[] {
    const points: MomentumPoint[] = [{ at: 0, diff: 0 }];
    for (const e of events) {
        if (e.type !== 'GOAL') continue;
        const diff = team === 'HOME' ? e.score[0] - e.score[1] : e.score[1] - e.score[0];
        points.push({ at: Math.max(0, Math.min(1, e.timestamp / MATCH_MS)), diff });
    }
    return points;
}
/** SVG step path for a momentum series in a `width` x `height` box; the zero line is the vertical centre and the
 *  line is extended to `until` (0..1, normally the current clock). */
export function momentumPath(points: readonly MomentumPoint[], until: number, width = 600, height = 40): string {
    if (!points.length) return '';
    const max = Math.max(3, ...points.map(p => Math.abs(p.diff)));
    const y = (diff: number) => +(height / 2 - diff / max * (height / 2 - 2)).toFixed(2);
    const x = (at: number) => +(at * width).toFixed(2);
    let d = `M0 ${y(points[0].diff)}`, last = points[0];
    for (const p of points.slice(1)) { d += ` H${x(p.at)} V${y(p.diff)}`; last = p; }
    return `${d} H${x(Math.max(last.at, Math.min(1, until)))}`;
}

/** The five numbers the live overview and the half-time briefing show, own side first. `better` says whether the
 *  own figure compares favourably (fewer turnovers / suspensions is better). */
export type MiniStat = { id: string; label: string; own: string; opp: string; better: boolean | null; title: string };
type TeamStats = MatchCenterModel['result']['homeStats'];
export function miniStats(result: MatchCenterModel['result'], team: TeamId): MiniStat[] {
    const own: TeamStats = team === 'HOME' ? result.homeStats : result.awayStats;
    const opp: TeamStats = team === 'HOME' ? result.awayStats : result.homeStats;
    const pct = (s: TeamStats) => s.shots ? Math.round(s.goals / s.shots * 100) : null;
    const savePct = (s: TeamStats) => s.shotsFaced ? Math.round(s.saves / s.shotsFaced * 100) : null;
    const cmp = (a: number | null, b: number | null, lowerIsBetter = false) => a === null || b === null || a === b ? null : lowerIsBetter ? a < b : a > b;
    return [
        { id: 'shooting', label: 'Mål/skott', own: `${own.goals}/${own.shots}${pct(own) === null ? '' : ` · ${pct(own)} %`}`, opp: `${opp.goals}/${opp.shots}${pct(opp) === null ? '' : ` · ${pct(opp)} %`}`, better: cmp(pct(own), pct(opp)), title: 'Mål per avslut och träffprocent.' },
        { id: 'saves', label: 'Räddningar', own: `${own.saves}/${own.shotsFaced}${savePct(own) === null ? '' : ` · ${savePct(own)} %`}`, opp: `${opp.saves}/${opp.shotsFaced}${savePct(opp) === null ? '' : ` · ${savePct(opp)} %`}`, better: cmp(savePct(own), savePct(opp)), title: 'Målvaktsräddningar per skott på mål.' },
        { id: 'turnovers', label: 'Bollförluster', own: String(own.turnovers), opp: String(opp.turnovers), better: cmp(own.turnovers, opp.turnovers, true), title: 'Förlorat bollinnehav utan avslut.' },
        { id: 'suspensions', label: '2 min', own: String(own.twoMinuteSuspensions), opp: String(opp.twoMinuteSuspensions), better: cmp(own.twoMinuteSuspensions, opp.twoMinuteSuspensions, true), title: 'Utdömda 2-minutersutvisningar.' },
        { id: 'sevenMetre', label: '7m', own: `${own.sevenMetreGoals}/${own.sevenMetreAttempts}`, opp: `${opp.sevenMetreGoals}/${opp.sevenMetreAttempts}`, better: cmp(own.sevenMetreGoals, opp.sevenMetreGoals), title: 'Mål på 7-meterskast / utdömda 7-meterskast.' },
    ];
}

/** Energy is shown as a bar everywhere in the live screen; these thresholds match the existing live alerts (<60). */
export type EnergyTone = 'ok' | 'tired' | 'low' | 'unknown';
export function energyTone(energy: number | null | undefined): EnergyTone {
    if (energy === null || energy === undefined || Number.isNaN(energy)) return 'unknown';
    return energy < 60 ? 'low' : energy < 75 ? 'tired' : 'ok';
}
export function clampEnergy(energy: number | null | undefined): number { return energy === null || energy === undefined || Number.isNaN(energy) ? 0 : Math.max(0, Math.min(100, Math.round(energy))); }
/** Stable sort, lowest energy first (who needs a rest); unknown energy last. Never mutates the input. */
export function byEnergy<T>(items: readonly T[], energy: (item: T) => number | null | undefined, direction: 'asc' | 'desc' = 'asc'): T[] {
    const value = (item: T) => { const e = energy(item); return e === null || e === undefined || Number.isNaN(e) ? null : e; };
    return items.map((item, index) => ({ item, index })).sort((a, b) => {
        const ea = value(a.item), eb = value(b.item);
        if (ea === null && eb === null) return a.index - b.index;
        if (ea === null) return 1;
        if (eb === null) return -1;
        return (direction === 'asc' ? ea - eb : eb - ea) || a.index - b.index;
    }).map(x => x.item);
}

/** Half-time "Energi" panel: own players on court and available on the bench, lowest energy first. */
export function energyBoard(players: readonly PlayerRow[], team: TeamId) {
    const own = players.filter(p => p.team === team);
    return { court: byEnergy(own.filter(p => p.population === 'COURT'), p => p.energy), bench: byEnergy(own.filter(p => p.population === 'BENCH'), p => p.energy) };
}

/** Score margin from `team`'s point of view. */
export function ownMargin(result: MatchCenterModel['result'], team: TeamId) { return team === 'HOME' ? result.homeGoals - result.awayGoals : result.awayGoals - result.homeGoals; }

/** Half-time "Assistentens förslag": only from what already exists -- the recommended contextual directives
 *  (score/opponent based, same rules as the timeout huddle) and players under the live energy alert threshold. */
export type Suggestion = { id: string; text: string; detail: string };
export function halftimeSuggestions(directives: readonly { id: string; title: string; intendedEffect: string; isRecommended: boolean }[], players: readonly PlayerRow[], team: TeamId, activeId?: string | null): Suggestion[] {
    const out: Suggestion[] = directives.filter(d => d.isRecommended && d.id !== activeId).map(d => ({ id: `directive:${d.id}`, text: d.title, detail: d.intendedEffect }));
    for (const p of byEnergy(players.filter(p => p.team === team && p.population === 'COURT' && energyTone(p.energy) === 'low'), p => p.energy).slice(0, 3))
        out.push({ id: `rest:${p.id}`, text: `Vila ${p.name}`, detail: `${clampEnergy(p.energy)} % energi efter första halvlek.` });
    return out;
}

/** Timeout huddle: 2-3 directive cards -- recommended first, then the active one, then the rest in their order. */
export function huddleDirectives<T extends { id: string; isRecommended: boolean }>(all: readonly T[], activeId?: string | null, limit = 3): T[] {
    const rank = (d: T) => d.isRecommended ? 0 : d.id === activeId ? 1 : 2;
    return all.map((d, i) => ({ d, i })).sort((a, b) => rank(a.d) - rank(b.d) || a.i - b.i).slice(0, limit).map(x => x.d);
}

/** Key-moment timeline (MDY-02d): each moment's place on the 0-60 track and its colour category. */
export const TIMELINE_CATEGORIES = ['GOAL', 'SEVEN_METRE', 'SAVE', 'BREAKTHROUGH', 'TRANSITION', 'DEFENCE'] as const satisfies readonly MomentFilter[];
export type TimelineCategory = typeof TIMELINE_CATEGORIES[number] | 'OTHER';
export type TimelineMarker = { id: string; at: number; category: TimelineCategory; team: TeamId | null; active: boolean; timestamp: number; headline: string };
export function timelineMarkers(moments: readonly MatchPresentationEvent[], shots: readonly ShotFact[], filter: MomentFilter): TimelineMarker[] {
    return moments.map(m => ({
        id: m.canonicalEventId,
        at: Math.max(0, Math.min(1, m.timestamp / MATCH_MS)),
        category: TIMELINE_CATEGORIES.find(c => momentMatches(m, c, shots)) ?? 'OTHER',
        team: m.team,
        active: momentMatches(m, filter, shots),
        timestamp: m.timestamp,
        headline: m.headline,
    }));
}

/** Shot map kind filter (MDY-02f): a registered shot kind, or the transition phase. */
export type ShotKindFilter = 'ALL' | 'TRANSITION' | string;
export function filterShotKind(shots: readonly ShotFact[], kind: ShotKindFilter): ShotFact[] {
    if (kind === 'ALL') return [...shots];
    if (kind === 'TRANSITION') return shots.filter(s => s.phase === 'TRANSITION');
    return shots.filter(s => s.kind === kind);
}

/** Keyboard shortcuts for the transport: digits 1-7 pick the named speeds in order. */
export function speedForKey(key: string): number | null {
    const i = Number(key) - 1;
    return Number.isInteger(i) && i >= 0 && i < MATCH_SPEED_OPTIONS.length && key.length === 1 ? MATCH_SPEED_OPTIONS[i].value : null;
}

/** Quick finish (MDY-02m): how far the official clock has come (0..1) and where the registered goals fell. */
export function simulationProgress(clockMs: number | null, goals: readonly { id: string; timestamp: number; team: TeamId | null }[]) {
    const at = clockMs === null ? 0 : Math.max(0, Math.min(1, clockMs / MATCH_MS));
    return { at, goals: goals.filter(g => g.team).map(g => ({ id: g.id, at: Math.max(0, Math.min(1, g.timestamp / MATCH_MS)), team: g.team as TeamId })) };
}

/** Initials for the assistant's monogram in the read-only dock (no portraits exist for staff). */
export function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
}

export { other as opponentOf };
