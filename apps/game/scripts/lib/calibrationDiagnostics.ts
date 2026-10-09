/** Read-only developer observation of the canonical production tick. */
import type { CoreEvent, CoreState, TeamId } from '@handball-manager/handball-engine/src/v2/core/state';
import { ledger, lossClassOf } from '@handball-manager/handball-engine/src/v2/core/ledger';
import { local, laneClearance, distance, shotContext, shootingAngle, world } from '@handball-manager/handball-engine/src/v2/core/space';
import { goalAreaClearance } from '@handball-manager/handball-engine/src/domain/geometry/goalArea';

export function distribution(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const q = (fraction: number) => { if (!sorted.length) return null; const at = (sorted.length - 1) * fraction, lo = Math.floor(at), hi = Math.ceil(at); return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo); };
  return { n: sorted.length, mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null, median: q(.5), p10: q(.1), p90: q(.9), min: sorted[0] ?? null, max: sorted.at(-1) ?? null };
}
const count = (names: string[]) => names.reduce<Record<string, number>>((acc, key) => { acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
const share = (a: number, b: number) => b ? a / b : null;
type Geometry = { ballDepth: number; defendersGoalSide: number; defendersNearLine: number; recoveringDefenders: number; runnersAhead: number; forwardLaneClearance: number; localNumericalAdvantage: number };
type Episode = { id: string; possessionId: string; team: TeamId; source: string; startTick: number; startOfficialMs: number; endTick: number; endOfficialMs: number; ending: string; entry: Geometry; exit: Geometry; heldMs: number; controlledMs: number; looseMs: number; firstActions: { tick: number; officialMs: number; actorId: string; kind: string; reason: string }[]; shots: string[]; goals: number };
type ContactEpisode = { id: string; attackerId: string; defenderId: string; possessionId: string; startTick: number; lastTick: number; contacts: number; assessments: string[]; whistles: number; ending: string };
type Decision = { actorId: string; actionId: string | null; possessionId: string; tick: number; officialMs: number; kind: string | number | boolean; reason: string | number | boolean; context: ReturnType<typeof shotContext>; geometry: Geometry };
type RestartTiming = { id: string; kind: string; owner: TeamId; startTick: number; endTick: number; startOfficialMs: number; endOfficialMs: number; phaseTicks: Record<string, number>; liveClockTicks: number; ending: string };
type Shot = { actionId: string; actorId: string; team: TeamId; role: string; period: number; officialMs: number; tick: number; kind: string; phase: string; distance: number; areaClearance: number; angle: number; pressure: number; blockThreat: number; quality: number; opportunityQuality: number | null; decision: unknown; reason: string; energy: number; goalHeight: number | null; aim: { x: number; y: number } | null; keeper: unknown; capabilities: unknown; execution: CoreEvent['details']; transition: unknown; geometry: Geometry; goal: boolean; saved: boolean; keeperTouched: boolean; blocked: boolean; missed: boolean };

function geometry(core: Readonly<CoreState>, team: TeamId, point = core.ball.position): Geometry {
  const direction = core.directions[team], ballDepth = local(point, direction).y;
  const court = core.players.filter(p => p.population === 'COURT' && p.kind === 'FIELD_PLAYER');
  const defenders = court.filter(p => p.team !== team), attackers = court.filter(p => p.team === team);
  const advance = world({ x: Math.max(1, Math.min(19, point.x)), y: Math.max(0, ballDepth - 5) }, direction);
  return { ballDepth, defendersGoalSide: defenders.filter(p => local(p.position, direction).y < ballDepth - .3).length,
    defendersNearLine: defenders.filter(p => local(p.position, direction).y < 12).length,
    recoveringDefenders: defenders.filter(p => ['RETREAT', 'RECOVER'].includes(p.duty.kind)).length,
    runnersAhead: attackers.filter(p => local(p.position, direction).y < ballDepth - 1).length,
    forwardLaneClearance: laneClearance(core as CoreState, point, advance, team),
    localNumericalAdvantage: attackers.filter(p => distance(p.position, point) < 8).length - defenders.filter(p => distance(p.position, point) < 8).length };
}

export class CalibrationDiagnostics {
  readonly shots: Shot[] = [];
  readonly transitions: Episode[] = [];
  readonly contactEpisodes: ContactEpisode[] = [];
  readonly physicalContactFacts: { id: string; tick: number; period: number; possessionId: string; attackerId: string; defenderId: string; episodeId: string; details: CoreEvent['details'] }[] = [];
  readonly counters: Record<string, number> = {};
  readonly restarts: { tick: number; period: number; kind: string; owner: string; reason: string; possessionId: string }[] = [];
  readonly assessments: { foulId: string; tick: number; period: number; severity: string; decision: string; episodeId: string | null }[] = [];
  readonly whistles: { foulId: string; tick: number; period: number; kind: string; reason: string; episodeId: string | null }[] = [];
  private readonly decisions = new Map<string, Decision>();
  private readonly restartTimings = new Map<string, RestartTiming>();
  private activeRestart: RestartTiming | null = null;
  private readonly phaseTimings: Record<string, { ticks: number; liveClockTicks: number }> = {};
  private readonly gain = new Map<string, { officialMs: number; tick: number; source: string; geometry: Geometry }>();
  private readonly periods = new Map<number, number>();
  private readonly contactByPair = new Map<string, ContactEpisode>();
  private readonly contactByContest = new Map<string, ContactEpisode>();
  private readonly foulById = new Map<string, ContactEpisode>();
  private activeTransition: Episode | null = null;
  private previous: { possessionId: string; phase: string; period: number } | null = null;
  private pendingSource = 'OPENING_HALF_THROW_OFF';
  private sourceSinceTick = 0;
  private lastRestartCompleted: { tick: number; owner: string; source: string } | null = null;
  private longestLoose = { ticks: 0, startTick: 0, endTick: 0 };
  private looseSince: number | null = null;
  private readonly assessedIds = new Set<string>();
  private readonly whistleIds = new Set<string>();

  observe = (core: Readonly<CoreState>, events: readonly CoreEvent[]) => {
    const phaseKey = `${core.period}:${core.possession.phase}:${core.ball.mode}`;
    const timing = this.phaseTimings[phaseKey] ??= { ticks: 0, liveClockTicks: 0 };
    timing.ticks++; if (core.officialClock.running) timing.liveClockTicks++;
    if (core.restart && core.restart.phase !== 'COMPLETED') {
      let restart = this.restartTimings.get(core.restart.id);
      if (!restart) {
        restart = { id: core.restart.id, kind: core.restart.kind, owner: core.restart.owner, startTick: core.restart.awardedTick, endTick: core.tick, startOfficialMs: core.officialClock.timeMs, endOfficialMs: core.officialClock.timeMs, phaseTicks: {}, liveClockTicks: 0, ending: 'ACTIVE' };
        this.restartTimings.set(core.restart.id, restart);
      }
      restart.endTick = core.tick; restart.endOfficialMs = core.officialClock.timeMs;
      restart.phaseTicks[core.restart.phase] = (restart.phaseTicks[core.restart.phase] ?? 0) + 1;
      if (core.officialClock.running) restart.liveClockTicks++;
      if (this.activeRestart && this.activeRestart.id !== restart.id) {
        this.activeRestart.endTick = core.tick; this.activeRestart.endOfficialMs = core.officialClock.timeMs; this.activeRestart.ending = 'REPLACED_OR_CLEARED';
      }
      this.activeRestart = restart;
    }
    if (this.activeRestart && (core.restart?.id !== this.activeRestart.id || core.restart.phase === 'COMPLETED')) {
      this.activeRestart.endTick = core.tick; this.activeRestart.endOfficialMs = core.officialClock.timeMs;
      this.activeRestart.ending = core.restart?.id === this.activeRestart.id ? 'COMPLETED' : 'REPLACED_OR_CLEARED';
      this.activeRestart = null;
    }
    for (const event of events) {
      this.periods.set(event.tick, core.period);
      this.counters[event.type] = (this.counters[event.type] ?? 0) + 1;
      if (event.type === 'POSSESSION_CHANGED') {
        const reason = String(event.details.reason);
        this.pendingSource = reason === 'Intercepted' ? 'TURNOVER_INTERCEPTION' : reason === 'Loose-ball recovery' ? 'LOOSE_BALL_RECOVERY' : reason.startsWith('Goalkeeper') ? 'KEEPER_CONTROL' : 'OTHER_CONTROL_CHANGE';
        this.sourceSinceTick = core.tick;
      }
      if (event.type.startsWith('SAVE_')) { this.pendingSource = 'KEEPER_SAVE_CONTROL_OR_REBOUND'; this.sourceSinceTick = core.tick; }
      if (event.type === 'POSSESSION_AWARDED') { this.pendingSource = String(event.details.reason) === 'Goal crossed line' ? 'POST_GOAL_THROW_OFF' : /Keeper/.test(String(event.details.reason)) ? 'KEEPER_SAVE_CONTROL_OR_REBOUND' : 'RULE_AWARD'; this.sourceSinceTick = core.tick; }
      if (event.type === 'RESTART_AWARDED') {
        const kind = String(event.details.kind), reason = String(event.details.reason);
        this.restarts.push({ tick: event.tick, period: core.period, kind, owner: String(event.details.owner), reason, possessionId: event.possessionId });
        if (kind === 'CENTRE_THROW_OFF') this.pendingSource = reason.startsWith('Opening') ? 'OPENING_HALF_THROW_OFF' : 'POST_GOAL_THROW_OFF';
        else if (kind === 'GOALKEEPER_THROW') this.pendingSource = /Keeper controls|Keeper recovered|Goalkeeper/.test(reason) ? 'KEEPER_SAVE_CONTROL_OR_REBOUND' : 'GOALKEEPER_THROW_OTHER';
      }
      if (event.type === 'RESTART_COMPLETED' && core.restart) this.lastRestartCompleted = { tick: core.tick, owner: core.restart.owner, source: this.pendingSource };
      if (event.type === 'CONTACT_EXECUTED' && event.actorId && event.relatedIds[0]) {
        const defenderId = event.actorId, attackerId = event.relatedIds[0], pair = `${defenderId}:${attackerId}`;
        let episode = this.contactByPair.get(pair);
        if (!episode || episode.possessionId !== event.possessionId || episode.ending !== 'ACTIVE') {
          episode = { id: `diagnostic-contact-${this.contactEpisodes.length}`, attackerId, defenderId, possessionId: event.possessionId, startTick: event.tick, lastTick: event.tick, contacts: 0, assessments: [], whistles: 0, ending: 'ACTIVE' };
          this.contactEpisodes.push(episode); this.contactByPair.set(pair, episode);
        }
        episode.lastTick = event.tick; episode.contacts++;
        if (event.contestId) this.contactByContest.set(event.contestId, episode);
        this.physicalContactFacts.push({ id: String(event.details.physicalContactId ?? event.contestId ?? event.id), tick: event.tick, period: core.period, possessionId: event.possessionId, attackerId, defenderId, episodeId: episode.id, details: { ...event.details } });
      }
      if (event.type === 'FOUL_ASSESSED' || event.type === 'FOUL' && !events.some(e => e.type === 'FOUL_ASSESSED' && e.details.foulId === event.details.foulId)) {
        const foulId = String(event.details.foulId ?? event.id);
        if (!this.assessedIds.has(foulId)) {
          this.assessedIds.add(foulId);
          const episode = event.contestId ? this.contactByContest.get(event.contestId) : undefined;
          if (episode) { episode.assessments.push(foulId); this.foulById.set(foulId, episode); }
          this.assessments.push({ foulId, tick: event.tick, period: core.period, severity: String(event.details.severity ?? 'UNKNOWN'), decision: String(event.details.decision ?? (event.details.advantage ? 'ADVANTAGE_PENDING' : 'LEGACY_UNSPECIFIED')), episodeId: episode?.id ?? null });
        }
      }
      if (event.type === 'WHISTLE_RESTART') {
        const foulId = String(event.details.foulId ?? event.id);
        if (!this.whistleIds.has(foulId)) {
          this.whistleIds.add(foulId); const episode = this.foulById.get(foulId);
          if (episode) { episode.whistles++; episode.ending = 'WHISTLE'; }
          this.whistles.push({ foulId, tick: event.tick, period: core.period, kind: String(event.details.kind), reason: String(event.details.reason), episodeId: episode?.id ?? null });
        }
      }
      if (event.type === 'ACTION_STARTED' && ['JUMP', 'SHOOT'].includes(String(event.details.kind)) && event.actorId) {
        const player = core.players.find(p => p.id === event.actorId);
        const previous = player ? this.decisions.get(player.id) : undefined;
        const carriedJump = event.details.kind === 'SHOOT' && previous?.kind === 'JUMP' && previous.possessionId === event.possessionId && (player?.airborne !== null && player?.airborne !== undefined || /actual.*takeoff/.test(String(event.details.reason)));
        if (player && !carriedJump) {
          this.decisions.set(player.id, { actorId: player.id, actionId: event.actionId, possessionId: event.possessionId, tick: event.tick, officialMs: event.officialMs, kind: event.details.kind, reason: event.details.reason, context: shotContext(core as CoreState, player), geometry: geometry(core, player.team, player.position) });
        }
      }
    }
    if (!this.previous || this.previous.possessionId !== core.possession.id) {
      this.gain.set(core.possession.id, { officialMs: core.officialClock.timeMs, tick: core.tick, source: core.tick - this.sourceSinceTick < 4 ? this.pendingSource : core.restart?.kind === 'CENTRE_THROW_OFF' ? core.restart.context === 'OPENING_HALF' ? 'OPENING_HALF_THROW_OFF' : 'POST_GOAL_THROW_OFF' : this.pendingSource, geometry: geometry(core, core.possession.team) });
    }
    if (this.activeTransition && (core.possession.id !== this.activeTransition.possessionId || core.possession.phase !== 'TRANSITION')) {
      this.activeTransition.endTick = core.tick; this.activeTransition.endOfficialMs = core.officialClock.timeMs; this.activeTransition.exit = geometry(core, this.activeTransition.team);
      this.activeTransition.ending = events.some(e => e.type === 'GOAL' && e.possessionId === this.activeTransition!.possessionId) ? 'GOAL' : core.possession.id !== this.activeTransition.possessionId ? 'POSSESSION_ENDED' : core.possession.phase === 'ESTABLISHED' ? 'SETTLED' : 'RESTART_INTERRUPTION';
      this.activeTransition = null;
    }
    if (core.possession.phase === 'TRANSITION' && !this.activeTransition) {
      const atGain = this.gain.get(core.possession.id), entry = geometry(core, core.possession.team);
      const source = this.lastRestartCompleted?.tick === core.tick && this.lastRestartCompleted.owner === core.possession.team ? this.lastRestartCompleted.source : atGain?.source ?? this.pendingSource;
      this.activeTransition = { id: `diagnostic-transition-${this.transitions.length}`, possessionId: core.possession.id, team: core.possession.team, source, startTick: core.tick, startOfficialMs: core.officialClock.timeMs, endTick: core.tick, endOfficialMs: core.officialClock.timeMs, ending: 'ACTIVE', entry, exit: entry, heldMs: 0, controlledMs: 0, looseMs: 0, firstActions: [], shots: [], goals: 0 };
      this.transitions.push(this.activeTransition);
    }
    if (this.activeTransition) {
      const player = core.players.find(p => p.id === core.ball.controllerId);
      this.activeTransition.endTick = core.tick; this.activeTransition.endOfficialMs = core.officialClock.timeMs;
      if (core.officialClock.running && core.ball.controllerId) this.activeTransition.controlledMs += 50;
      if (core.officialClock.running && player?.action?.kind === 'HOLD') this.activeTransition.heldMs += 50;
      if (core.officialClock.running && core.ball.mode === 'LOOSE') this.activeTransition.looseMs += 50;
      for (const event of events) {
        if (this.activeTransition.firstActions.length >= 6) break;
        if (event.type === 'ACTION_STARTED' && event.actorId && event.possessionId === core.possession.id && ['PASS', 'DRIBBLE', 'DRIVE', 'FEINT', 'JUMP', 'SHOOT', 'HOLD'].includes(String(event.details.kind))) {
          const actor = core.players.find(p => p.id === event.actorId);
          if (actor?.team === this.activeTransition.team) this.activeTransition.firstActions.push({ tick: event.tick, officialMs: event.officialMs, actorId: actor.id, kind: String(event.details.kind), reason: String(event.details.reason) });
        }
      }
    }
    for (const event of events.filter(e => e.type === 'SHOT_RELEASED' && e.actorId && e.actionId)) {
      const player = core.players.find(p => p.id === event.actorId)!;
      const point = { x: Number(event.details.x), y: Number(event.details.y) }, direction = core.directions[player.team];
      const keeper = core.players.find(p => p.id === event.details.goalkeeperId) ?? core.players.find(p => p.team !== player.team && p.kind === 'GOALKEEPER' && p.population === 'COURT');
      const atGain = this.gain.get(event.possessionId), episode = [...this.transitions].reverse().find(e => e.possessionId === event.possessionId && event.tick >= e.startTick && event.tick <= e.endTick + 1);
      const currentGeometry = geometry(core, player.team, point);
      if (episode && event.details.phase === 'TRANSITION') episode.shots.push(event.actionId!);
      this.shots.push({ actionId: event.actionId!, actorId: player.id, team: player.team, role: player.role, period: core.period, officialMs: event.officialMs, tick: event.tick, kind: String(event.details.shotKind), phase: String(event.details.phase),
        distance: Math.hypot(local(point, direction).x - 10, local(point, direction).y), areaClearance: goalAreaClearance(point, direction), angle: shootingAngle(point, direction),
        pressure: Number(event.details.pressure ?? 0), blockThreat: Number(event.details.blockThreat ?? 0), quality: Number(event.details.decisionQuality ?? 0), opportunityQuality: typeof event.details.opportunityQuality === 'number' ? event.details.opportunityQuality : null, decision: this.decisions.get(player.id) ?? null,
        reason: String(event.details.reason), energy: Number(event.details.executionEnergy ?? player.condition.energy), goalHeight: typeof event.details.goalHeight === 'number' ? event.details.goalHeight : null,
        aim: core.ball.flight?.actionId === event.actionId && core.ball.flight.velocity.y !== 0 ? { x: core.ball.flight.origin.x + core.ball.flight.velocity.x * (((core.ball.flight.goalSide === 'TOP' ? 0 : 40) - core.ball.flight.origin.y) / core.ball.flight.velocity.y), y: core.ball.flight.goalSide === 'TOP' ? 0 : 40 } : null,
        keeper: keeper ? { id: keeper.id, position: { ...keeper.position }, velocity: { ...keeper.velocity }, energy: keeper.condition.energy, profile: keeper.profile.keeper, action: keeper.action ? { kind: keeper.action.kind, phase: keeper.action.phase, targetId: keeper.action.targetId, target: keeper.action.target ? { ...keeper.action.target } : null, ageMs: (core.tick - keeper.action.startedTick) * 50, phaseAgeMs: (core.tick - keeper.action.phaseTick) * 50, anticipationForId: keeper.action.anticipationForId ?? null, anticipationAgeMs: keeper.action.anticipationStartedTick === undefined ? null : (core.tick - keeper.action.anticipationStartedTick) * 50 } : null } : null,
        capabilities: { placement: player.profile.shotPlacement, power: player.profile.shotPower, finishing: player.profile.finishing, wing: player.profile.wingFinishing, pivot: player.profile.pivotPlay, decision: player.profile.decision, composure: player.profile.composure }, execution: { ...event.details },
        transition: atGain ? { source: episode?.source ?? atGain.source, gainToShotMs: event.officialMs - atGain.officialMs, phaseToShotMs: episode ? event.officialMs - episode.startOfficialMs : null, advancedMetresFromGain: atGain.geometry.ballDepth - currentGeometry.ballDepth, advancedMetresInLiveTransition: episode ? episode.entry.ballDepth - currentGeometry.ballDepth : null, gainGeometry: atGain.geometry } : null,
        geometry: currentGeometry, goal: false, saved: false, keeperTouched: false, blocked: false, missed: false });
    }
    for (const episode of this.contactByPair.values()) {
      if (episode.ending !== 'ACTIVE') continue;
      const a = core.players.find(p => p.id === episode.attackerId), d = core.players.find(p => p.id === episode.defenderId);
      if (core.possession.id !== episode.possessionId || !core.ball.live || core.ball.controllerId !== episode.attackerId || !a || !d || distance(a.position, d.position) > 1.6) { episode.ending = 'PAIR_SEPARATED_OR_CONTROL_ENDED'; episode.lastTick = core.tick; }
    }
    if (core.ball.mode === 'LOOSE') this.looseSince ??= core.tick;
    else if (this.looseSince !== null) { const ticks = core.tick - this.looseSince; if (ticks > this.longestLoose.ticks) this.longestLoose = { ticks, startTick: this.looseSince, endTick: core.tick }; this.looseSince = null; }
    this.previous = { possessionId: core.possession.id, phase: core.possession.phase, period: core.period };
  };

  report(core: Readonly<CoreState>) {
    const goals = new Set(core.events.filter(e => e.type === 'GOAL').map(e => e.actionId));
    const saves = new Set(core.events.filter(e => ['SAVE_CAUGHT', 'SAVE_PARRY'].includes(e.type)).map(e => e.actionId));
    const blocks = new Set(core.events.filter(e => e.type === 'SHOT_BLOCKED').map(e => e.actionId));
    for (const shot of this.shots) { shot.goal = goals.has(shot.actionId); shot.keeperTouched = saves.has(shot.actionId); shot.saved = !shot.goal && shot.keeperTouched; shot.blocked = !shot.goal && !shot.saved && blocks.has(shot.actionId); shot.missed = !shot.goal && !shot.saved && !shot.blocked; }
    for (const episode of this.transitions) episode.goals = episode.shots.filter(id => goals.has(id)).length;
    const groups: Record<string, Shot[]> = {};
    const add = (key: string, shot: Shot) => (groups[key] ??= []).push(shot);
    for (const shot of this.shots) {
      add('ALL', shot); add(`CATEGORY:${shot.kind}`, shot); add(`HALF:${shot.period}`, shot); add(`POSITION:${shot.role}`, shot); add(`TEAM:${shot.team}`, shot);
      add(`PRESSURE:${shot.pressure < .2 ? 'LOW_UNDER_0.2' : 'PRESENT_AT_LEAST_0.2'}`, shot);
      add(`QUALITY:${shot.quality >= .65 ? 'HIGH_AT_LEAST_0.65' : 'LOWER_UNDER_0.65'}`, shot);
      if (shot.opportunityQuality !== null) add(`OPPORTUNITY_QUALITY:${shot.opportunityQuality >= .65 ? 'HIGH_AT_LEAST_0.65' : 'LOWER_UNDER_0.65'}`, shot);
      add(`DISTANCE:${shot.distance <= 8 ? 'UP_TO_8M' : shot.distance <= 10.5 ? '8_TO_10.5M' : 'BEYOND_10.5M'}`, shot);
      if (shot.areaClearance <= 1.5 && shot.kind !== 'SEVEN_METRE') add('CONTEXT:NEAR_SIX_METRE_AREA', shot);
      if (shot.phase === 'TRANSITION') add('CONTEXT:TRANSITION', shot);
    }
    const summarize = (shots: Shot[]) => { const goals = shots.filter(s => s.goal).length, saves = shots.filter(s => s.saved).length; return { attempts: shots.length, goals, saves, blocks: shots.filter(s => s.blocked).length, misses: shots.filter(s => s.missed).length, conversion: share(goals, shots.length), savePctOnTarget: share(saves, saves + goals), saveShareAllAttempts: share(saves, shots.length), missShare: share(shots.filter(s => s.missed).length, shots.length), quality: distribution(shots.map(s => s.quality)), opportunityQuality: distribution(shots.map(s => s.opportunityQuality).filter((quality): quality is number => quality !== null)), pressure: distribution(shots.map(s => s.pressure)), distance: distribution(shots.map(s => s.distance)) }; };
    const book = ledger(core as CoreState);
    const bounds = new Map<string, { firstOfficialMs: number; lastOfficialMs: number; firstMs: number; lastMs: number }>();
    for (const event of core.events) { const previous = bounds.get(event.possessionId); if (previous) { previous.lastOfficialMs = event.officialMs; previous.lastMs = event.timeMs; } else bounds.set(event.possessionId, { firstOfficialMs: event.officialMs, lastOfficialMs: event.officialMs, firstMs: event.timeMs, lastMs: event.timeMs }); }
    const terminals = book.records.map(record => { const at = bounds.get(record.possessionId)!; return { ...record, period: this.periods.get(record.lastTick) ?? (at.lastOfficialMs < 1800000 ? 1 : 2), lossClass: lossClassOf(record.ending), officialSeconds: (at.lastOfficialMs - at.firstOfficialMs) / 1000, simulationSeconds: (at.lastMs - at.firstMs) / 1000 }; });
    return { shots: this.shots, shotGroups: Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, summarize(values)])),
      halves: [1, 2].map(period => ({ period, ...summarize(this.shots.filter(s => s.period === period)), homeGoals: this.shots.filter(s => s.period === period && s.team === 'HOME' && s.goal).length, awayGoals: this.shots.filter(s => s.period === period && s.team === 'AWAY' && s.goal).length, turnovers: terminals.filter(t => t.period === period && t.lossClass).length })),
      terminals, terminalCounts: count(terminals.map(t => t.ending)), lossCounts: book.losses,
      transition: { starts: this.transitions.length, distinctPossessions: new Set(this.transitions.map(t => t.possessionId)).size, shots: this.shots.filter(s => s.phase === 'TRANSITION').length, goals: this.shots.filter(s => s.phase === 'TRANSITION' && s.goal).length, conversion: share(this.shots.filter(s => s.phase === 'TRANSITION' && s.goal).length, this.shots.filter(s => s.phase === 'TRANSITION').length), abortToSettled: this.transitions.filter(t => t.ending === 'SETTLED' && !t.shots.length).length, keeperStarted: this.transitions.filter(t => t.source.startsWith('KEEPER') || t.source.startsWith('GOALKEEPER')).length, turnoverStarted: this.transitions.filter(t => t.source === 'TURNOVER_INTERCEPTION' || t.source === 'LOOSE_BALL_RECOVERY').length, sources: count(this.transitions.map(t => t.source)), durationOfficialMs: distribution(this.transitions.map(t => t.endOfficialMs - t.startOfficialMs)), heldMs: distribution(this.transitions.map(t => t.heldMs)), episodes: this.transitions },
      contact: { physicalContacts: this.counters.CONTACT_EXECUTED ?? 0, continuousPairEpisodes: this.contactEpisodes.length, assessedFouls: this.assessments.length, rawFoulEvents: this.counters.FOUL ?? 0, contactWhistles: this.whistles.length, freeThrowAwards: this.restarts.filter(r => r.kind === 'FREE_THROW').length, sevenMetreAwards: this.restarts.filter(r => r.kind === 'SEVEN_METRE').length, advantagesPending: this.counters.ADVANTAGE_PENDING ?? 0, advantagesRealized: this.counters.ADVANTAGE_REALIZED ?? 0, advantagesRecalled: this.counters.ADVANTAGE_RECALLED ?? 0, contactClasses: count(this.physicalContactFacts.map(fact => String(fact.details.contactClass ?? 'LEGACY_UNSPECIFIED'))), radialClosingSpeed: distribution(this.physicalContactFacts.map(fact => Number(fact.details.radialClosingSpeed)).filter(Number.isFinite)), lateralSpeed: distribution(this.physicalContactFacts.map(fact => Number(fact.details.lateralSpeed)).filter(Number.isFinite)), physicalFacts: this.physicalContactFacts, episodes: this.contactEpisodes, assessments: this.assessments, whistles: this.whistles, restarts: this.restarts },
      deadSpots: { longestLooseBall: { ...this.longestLoose, simulationMs: this.longestLoose.ticks * 50 }, phaseTimings: Object.fromEntries(Object.entries(this.phaseTimings).map(([key, timing]) => [key, { simulationMs: timing.ticks * 50, officialRunningMs: timing.liveClockTicks * 50 }])), restartTimings: [...this.restartTimings.values()].map(restart => ({ ...restart, simulationMs: (restart.endTick - restart.startTick) * 50, officialMs: restart.endOfficialMs - restart.startOfficialMs, officialRunningMs: restart.liveClockTicks * 50 })) }, eventCounts: this.counters,
      definitions: { observer: 'Read-only callback after each canonical production tick; no extra simulation, mutations or RNG.', shotGroups: 'Categories partition attempts. Context/range/quality/pressure rows overlap. Near-six-metre means release within1.5m of the existing curved goal-area boundary; diagnostic region, not an empirical target.', saves: 'Non-goal shots with SAVE_CAUGHT/PARRY count saved; goal-after-keeper-touch is retained as a goal and separate keeperTouched fact.', pressureQuality: '0.2 pressure and0.65 quality cuts are descriptive bins aligned with the prior offline reading, not goal-rate targets.', contactEpisodes: 'Derived continuous attacker/defender pair opened only by real CONTACT_EXECUTED, closed by actual whistle, control/possession ending or1.6m separation. Engineering grouping, not a claim of a canonical referee episode object.', whistles: 'Explicit WHISTLE_RESTART counts contact-rule stops; all FREE_THROW awards separately include technical/passive/restarts. Neither is raw FOUL count.', transition: 'Actual observed phase entries; source follows actual ownership/restart facts. Each released transition shot retains progress from gain and real defenders/lanes/numerical context so relabeling can be distinguished from opportunity.' } };
  }
}
