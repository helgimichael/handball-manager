/** Passive developer observation. No production module imports this file. */
import type { CoreEvent, CoreState } from '@handball-manager/handball-engine/src/v2/core/state';
import { decideHandball, defenderRelation } from '@handball-manager/handball-engine/src/v2/core/intelligence';
import { distance, goal, segmentPoint,shotContext } from '@handball-manager/handball-engine/src/v2/core/space';
import { distribution } from '../../lib/matchBenchmarks/statistics';
import {keeperReachForShot} from '@handball-manager/handball-engine/src/v2/core/interactions';

export class ReconciliationDiagnostics {
    readonly longAttackSamples: unknown[] = [];
    private readonly counts: Record<string, number> = {};
    private readonly episodes = new Map<string, { firstMs: number; lastMs: number; passes: number; recycles: number; beats: number; openings: number; shots: number; highShots: number; endings: string[] }>();
    private readonly previous = new Map<string, { advantage: boolean; help: boolean; tick: number; possessionId: string }>();
    private readonly resolved = new Set<string>();
    private readonly contained = new Set<string>();
    private readonly lastFlightPoint=new Map<string,{x:number;y:number}>();
    private readonly missedTorso=new Set<string>();
    readonly shots: { actionId: string; actorId: string | null; possessionId: string; tick: number; phase: string; quality: number; pressure: number; containment:number; goalSideBodies: number; nearBodies: number; staleImpairedGoalSide: number; activeHelpers: number; recoveredPrimary: boolean; keeper: { x: number; y: number; ready: boolean; speed: number } | null }[] = [];
    private count(key: string) { this.counts[key] = (this.counts[key] ?? 0) + 1; }
    observe = (core: Readonly<CoreState>, events: readonly CoreEvent[]) => {
        const s = core as CoreState;
        const flight=core.ball.flight;
        if(flight?.kind==='SHOT'){
            const from=this.lastFlightPoint.get(flight.actionId)??flight.origin;
            const shooter=core.players.find(p=>p.id===flight.fromId),keeper=core.players.find(p=>p.kind==='GOALKEEPER'&&p.population==='COURT'&&p.team!==shooter?.team);
            if(keeper&&core.tick>flight.releasedTick){
                const hit=segmentPoint(from,core.ball.position,keeper.position),separation=distance(hit.point,keeper.position),reach=keeperReachForShot(s,keeper,flight,hit.point);
                const depth=goal(flight.goalSide).y-flight.origin.y,fraction=Math.max(0,Math.min(1,(hit.point.y-flight.origin.y)/(Math.abs(depth)>.001?depth:.001))),height=flight.height+((flight.goalHeight??1.1)-flight.height)*fraction;
                if(separation<keeper.radius&&separation>reach&&height>.7&&height<1.75)this.missedTorso.add(flight.actionId);
            }
            this.lastFlightPoint.set(flight.actionId,{...core.ball.position});
        }
        let episode = this.episodes.get(core.possession.id);
        if (!episode) {
            episode = { firstMs: core.officialClock.timeMs, lastMs: core.officialClock.timeMs, passes: 0, recycles: 0, beats: 0, openings: 0, shots: 0, highShots: 0, endings: [] };
            this.episodes.set(core.possession.id, episode);
        }
        episode.lastMs = core.officialClock.timeMs;
        if(core.officialClock.timeMs-episode.firstMs>90000&&core.tick%600===0&&this.longAttackSamples.length<32){
            this.longAttackSamples.push({tick:core.tick,officialMs:core.officialClock.timeMs,ageMs:core.officialClock.timeMs-episode.firstMs,possessionId:core.possession.id,phase:core.possession.phase,ball:structuredClone(core.ball),passive:structuredClone(core.referee.passive),pressureId:core.defence.pressureId,helperId:core.defence.helperId,
                players:core.players.filter(p=>p.population==='COURT').map(p=>({id:p.id,team:p.team,role:p.role,position:{...p.position},velocity:{...p.velocity},handling:{...p.handling},action:p.action&&structuredClone(p.action),intent:p.handballIntent&&structuredClone(p.handballIntent),duty:structuredClone(p.duty),beatenUntilTick:p.beatenUntilTick})),events:events.map(e=>({type:e.type,actorId:e.actorId,details:{...e.details}}))});
        }
        for (const e of events) {
            this.count(e.type);
            const at = this.episodes.get(e.possessionId) ?? episode;
            if (e.type === 'PASS_RECEIVED') at.passes++;
            if (e.type === 'DEFENDER_BEATEN') at.beats++;
            if (e.type === 'ADVANTAGE_OPENED' || e.type === 'ADVANTAGE_CONTINUED') at.openings++;
            if (e.type === 'ACTION_STARTED' && e.details.kind === 'PASS' && /RECYCLE|rebuild|return|reset/i.test(String(e.details.reason))) at.recycles++;
            if (['TECHNICAL_VIOLATION', 'OFFENSIVE_FOUL', 'INTERCEPTION', 'PASSIVE_PLAY', 'GOAL', 'SHOT_BLOCKED', 'SAVE_CAUGHT', 'SAVE_PARRY'].includes(e.type)) at.endings.push(e.type);
            if (e.type !== 'SHOT_RELEASED') continue;
            const p = core.players.find(p => p.id === e.actorId); if (!p) continue;
            const g = goal(core.directions[p.team]), defenders = core.players.filter(d => d.team !== p.team && d.population === 'COURT' && d.kind === 'FIELD_PLAYER');
            const near = defenders.filter(d => distance(d.position, p.position) < 2.2);
            const goalSide = defenders.filter(d => { const path = segmentPoint(p.position, g, d.position); return path.t > 0 && path.t < 1 && distance(path.point, d.position) < 1.1; });
            const stale = near.filter(d => d.beatenUntilTick > core.tick && !defenderRelation(p, d, g).beaten && defenderRelation(p, d, g).forward > .15);
            const primaryId = p.carrierRead?.primaryId ?? p.handballIntent?.primaryId;
            const primary = defenders.find(d => d.id === primaryId);
            const keeper = core.players.find(k => k.team !== p.team && k.population === 'COURT' && k.kind === 'GOALKEEPER');
            const quality = Number(e.details.opportunityQuality ?? 0);
            at.shots++; if (quality >= .65) at.highShots++;
            this.shots.push({ actionId: e.actionId!, actorId: e.actorId, possessionId: e.possessionId, tick: e.tick, phase: String(e.details.phase), quality, pressure: Number(e.details.pressure ?? 0), containment:shotContext(s,p).containment, goalSideBodies: goalSide.length, nearBodies: near.length, staleImpairedGoalSide: stale.length, activeHelpers: near.filter(d => d.duty.kind === 'HELP' || d.id === core.defence.helperId).length, recoveredPrimary: !!primary && !defenderRelation(p, primary, g).beaten && defenderRelation(p, primary, g).forward > .15, keeper: keeper ? { x: keeper.position.x, y: keeper.position.y, ready: keeper.action?.kind === 'SAVE' && keeper.action.phase === 'EXECUTING', speed: Math.hypot(keeper.velocity.x, keeper.velocity.y) } : null });
        }
        if (!core.ball.live || core.tick % 10 !== 0 || !core.ball.controllerId) return;
        const p = core.players.find(p => p.id === core.ball.controllerId); if (!p || p.kind !== 'FIELD_PLAYER') return;
        const d = decideHandball(s, p), key = `${core.possession.id}:${p.id}`, old = this.previous.get(p.id);
        const hasAdvantage = d.advantage.freeCarrier || !!d.perception.primary?.beaten;
        if (old?.possessionId === core.possession.id && old.advantage && !hasAdvantage && (d.perception.help?.committed || !d.perception.space.open || d.perception.primary?.goalSide)) { this.resolved.add(key); if (d.perception.help?.committed) this.contained.add(key); }
        if (d.previous && d.situations.includes('ADVANTAGE_LOST') && d.chosen?.intent === 'RECYCLE_ATTACK') this.count('LOST_ADVANTAGE_RECYCLE_SAMPLE');
        if (hasAdvantage && d.chosen?.motor === 'SHOOT') this.count('ADVANTAGE_TO_SHOT_SAMPLE');
        if (hasAdvantage && d.chosen?.motor === 'PASS') this.count('ADVANTAGE_TO_PASS_SAMPLE');
        this.previous.set(p.id, { advantage: hasAdvantage, help: !!d.perception.help?.committed, tick: core.tick, possessionId: core.possession.id });
    };
    report() {
        const episodes = [...this.episodes.values()];
        return { counts: this.counts, advantageResolvedByDefence: this.resolved.size, helpContainmentEpisodes: this.contained.size,
            missedTorsoIntersections:this.missedTorso.size,
            possessions: episodes.length, possessionDuration: distribution(episodes.map(e => (e.lastMs - e.firstMs) / 1000)), passesPerPossession: distribution(episodes.map(e => e.passes)), recyclesPerPossession: distribution(episodes.map(e => e.recycles)), beatsPerPossession: distribution(episodes.map(e => e.beats)), openingsPerPossession: distribution(episodes.map(e => e.openings)), multipleHighQualityPossessions: episodes.filter(e => e.highShots > 1).length,
            staleImpairedGoalSideShotCount: this.shots.filter(s => s.staleImpairedGoalSide > 0).length, pressure: distribution(this.shots.map(s => s.pressure)), quality: distribution(this.shots.map(s => s.quality)),
            transitionAttempts: this.shots.filter(s => s.phase === 'TRANSITION').length, transitionGoalSideBodies: distribution(this.shots.filter(s => s.phase === 'TRANSITION').map(s => s.goalSideBodies)),
            notes: ['Episode diagnostics use canonical possession IDs; free throws/recycles are continuations and may overlap shot-ending episodes.', 'Sampled advantage transitions use a passive 500ms court read; they are not empirical targets.', 'Quality uses existing reference-capability score, not xG.', 'Long-attack snapshots flag a possible mechanism stall, not an empirical duration target.', 'No RNG, commands, canonical events or simulation fields are changed.'], shots: this.shots, longAttackSamples:this.longAttackSamples };
    }
}
