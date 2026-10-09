import { seedFromString, type FastMatchResult, type MatchEvent, type PlayerMatchContribution, type TeamMatchStats } from '@handball-manager/game-simulation';
import { createMatch } from '@handball-manager/handball-engine/src/v2/core/match';
import { advanceCoreMutable } from '@handball-manager/handball-engine/src/v2/core/engine';
import { buildProfile, type AttributeSheet } from '@handball-manager/handball-engine/src/v2/core/profile';
import { setTactics, type TeamTactics } from '@handball-manager/handball-engine/src/v2/core/coaching';
import { requestExchange } from '@handball-manager/handball-engine/src/v2/core/population';
import { requestTeamTimeout } from '@handball-manager/handball-engine/src/v2/core/referee';
import type { CoreEvent, CorePlayer, CoreState, Role, TeamId } from '@handball-manager/handball-engine/src/v2/core/state';
import { ledger, lossClassOf } from '@handball-manager/handball-engine/src/v2/core/ledger';
import { resolveCareerLineup } from './spatialMatch/careerLineup';
import { buildSpatialMatchInput } from './spatialMatch/spatialCareerMatch';
import { applyMatchResultBookkeeping } from './matchResultApplication';
import { checkSeasonComplete, getPlayerFixtureOn } from './calendar';
import { buildMatchCompletedEvent, buildPlayerInjuredEvent } from './careerEvents';
import { careerEventToInboxMessage } from './inboxBridge';
import { applyMatchDevelopmentStimulus } from '../development/developmentIntegration';
import { applyMatchInjuryResolution } from '../medical/injuryIntegration';
import type { CareerFixture, CareerState } from './types';
import { getClub } from '../game-data';
import { encodeFrames, decodeFrames, type MatchFrame } from './matchFrames';
export type { MatchFrame } from './matchFrames';

export type MatchPerson = { id: string; name: string; number: number; team: TeamId; role: Role; started: boolean; startEnergy: number };
// Quantised observed frames, never regenerated from current career data.
// [tick, officialMs, period, home, away, ballXcm, ballYcm, personIndex, xcm, ycm, ...]
export type PlayedMatchArchive = { format: 1 | 2; fixture: CareerFixture; version: string; behaviorRevision?:string; seed: number; people: MatchPerson[]; frames?: MatchFrame[]; frameData?: string; events: CoreEvent[]; result: FastMatchResult; load: Record<string, { minutes: number; energy: number; distance: number }> };
export function archiveFrames(archive: PlayedMatchArchive): MatchFrame[] { return archive.frameData ? decodeFrames(archive.frameData) : archive.frames ?? []; }
export type ProductionMatchSession = { format: 1; behaviorRevision?:string; fixture: CareerFixture; core: CoreState; people: MatchPerson[]; frames: MatchFrame[]; pausedAtHalf: boolean; error: string | null };
export const MATCH_BEHAVIOR_REVISION = 'career-realism-v2.1';
export type MatchCommand = { kind: 'TACTICS'; team: TeamId; patch: Partial<Pick<TeamTactics, 'defence' | 'tempo' | 'attackIdentity' | 'rotation'>> } | { kind: 'SUBSTITUTION'; team: TeamId; outId: string; inId: string } | { kind: 'TIMEOUT'; team: TeamId } | { kind: 'SECOND_HALF' };

const roleByPosition: Record<string, Role> = { V6: 'LW', V9: 'LB', M9: 'CB', H9: 'RB', H6: 'RW', M6: 'P', MV: 'GK' };
const engineRoles: Record<string, Role> = { LEFT_WING: 'LW', LEFT_BACK: 'LB', CENTER_BACK: 'CB', RIGHT_BACK: 'RB', RIGHT_WING: 'RW', PIVOT: 'P' };

export function observedFrame(s: ProductionMatchSession): MatchFrame {
  const c = s.core;
  const row = [c.tick, c.officialClock.timeMs, c.period, c.score.HOME, c.score.AWAY, Math.round(c.ball.position.x * 100), Math.round(c.ball.position.y * 100)];
  for (const p of c.players) if (p.population === 'COURT') row.push(s.people.findIndex(x => x.id === p.id), Math.round(p.position.x * 100), Math.round(p.position.y * 100));
  return row;
}

export function createProductionSession(state: CareerState, fixture: CareerFixture): ProductionMatchSession {
  const input = buildSpatialMatchInput(state, fixture);
  const saved = state.matchPlans[fixture.id];
  const managerInput = fixture.homeClubId === state.playerClubId ? input.home : input.away;
  const managerFormation=(saved??managerInput.plan)?.defencePlan.baseFormation;
  if(managerFormation&&!['6-0','5-1'].includes(managerFormation))throw new Error('Välj 6–0 eller 5–1 i matchplanen innan avkast. Den sparade försvarsformationen stöds ännu inte i spelade matcher.');
  if (saved && (saved.attackStartingUnit.formation !== 'NORMAL' || saved.squad.players.some(p => !managerInput.squad.some(available => available.id === p.playerId)))) throw new Error('Matchplanen behöver uppdateras. Öppna Taktik och välj en tillgänglig matchtrupp och normal startsju.');
  const seed = seedFromString(`${state.saveSeed}:${fixture.id}:v2`);
  let core = createMatch(seed, 'TOP', 1800000, 0);
  core.checkpoint.maxTicks = 200000; // Room for actual stopped-clock time, without changing the official halves.
  core.match!.coachingPlan = []; // Scenario example changes never enter a career.
  const people: MatchPerson[] = [];
  const players: CorePlayer[] = [];
  const replacements: Record<string, string> = {};
  for (const team of ['HOME', 'AWAY'] as const) {
    const side = team === 'HOME' ? input.home : input.away;
    const lineup = resolveCareerLineup(side.clubId, side.squad, side.plan);
    if (!lineup) throw new Error(`${getClub(side.clubId)?.name ?? 'Laget'} behöver sex tillgängliga utespelare och en målvakt. Kontrollera matchtruppen.`);
    const starters: Record<string, string> = { GK: lineup.goalkeeperId };
    for (const [role, id] of Object.entries(lineup.startersByRole)) starters[engineRoles[role]] = id;
    const selected = [...Object.values(starters), ...lineup.bench.map(p => p.playerId)];
    for (const id of selected) {
      const player = side.squad.find(p => p.id === id)!;
      const startingRole = Object.keys(starters).find(r => starters[r] === id) as Role | undefined;
      const role = startingRole ?? roleByPosition[player.position] ?? 'CB';
      const template = core.players.find(p => p.team === team && p.role === role && p.population === 'COURT') ?? core.players.find(p => p.team === team && p.role === 'CB')!;
      const p = structuredClone(template);
      if (startingRole) replacements[template.id] = id;
      p.id = id; p.role = role; p.population = startingRole ? 'COURT' : 'BENCH';
      p.kind = role === 'GK' ? 'GOALKEEPER' : 'FIELD_PLAYER';
      if (!startingRole) p.position = { x: -.35, y: 24 };
      p.action = null; p.support = null; p.zone = null;
      p.duty = { kind: 'WAIT', targetId: null, sinceTick: 0, reason: 'Match selection' };
      p.intent = { id: 'initial', effect: 'WAIT', reason: 'Match selection', targetId: null };
      const rating = side.gameplayRatings.find(r => r.playerId === id);
      const sheet: AttributeSheet = {};
      if (rating) for (const [key, value] of Object.entries(rating.branch.attributes)) if (value?.value != null) (sheet as Record<string, number>)[key] = value.value;
      // The profile's explicit neutral attribute fallback retains missing-data
      // provenance. CA/PA must not become substitute gameplay capabilities.
      p.profile = buildProfile(sheet, role);
      const energy = state.playerPhysicalState[id]?.currentEnergy ?? 100;
      p.condition.energy = energy / 100;
      players.push(p);
      people.push({ id, name: `${player.firstName} ${player.lastName}`, number: player.shirtNumber ?? people.filter(x => x.team === team).length + 1, team, role, started: Boolean(startingRole), startEnergy: energy });
    }
    core.coaching[team].rotation = team !== (fixture.homeClubId === state.playerClubId ? 'HOME' : 'AWAY');
    core.coaching[team].timeouts = core.coaching[team].rotation;
    core.coaching[team].tempo = side.plan?.attackPlan.tempo === 'FAST' ? 'QUICK' : 'BALANCED';
    core.coaching[team].defence = side.plan?.defencePlan.baseFormation.replace('-', ':') === '5:1' ? '5:1' : '6:0';
    core.coaching[team].attackIdentity = side.plan?.attackPlan.ballCirculation === 'DIRECT' ? 'DIRECT' : side.plan?.attackPlan.wingUsage === 'HIGH' ? 'WIDTH' : side.plan?.attackPlan.structureFreedom === 'STRUCTURED' ? 'COMBINATION' : 'BALANCED';
  }
  // Replace all template references, including receiver/mark/throw-off identities.
  function remap(value: unknown): unknown {
    if (typeof value === 'string') return replacements[value] ?? value;
    if (Array.isArray(value)) return value.map(remap);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, val]) => [replacements[key] ?? key, remap(val)]));
    return value;
  }
  core.players = players;
  core = remap(core) as CoreState;
  core.events = [];
  const session: ProductionMatchSession = { format: 1, behaviorRevision:MATCH_BEHAVIOR_REVISION, fixture: { ...fixture }, core, people, frames: [], pausedAtHalf: false, error: null };
  session.frames.push(observedFrame(session));
  return session;
}

export function startProductionMatch(state: CareerState, fixtureId?: string): CareerState {
  if (state.productionMatch) return state;
  const fixture = fixtureId ? state.fixtures.find(f => f.id === fixtureId) : getPlayerFixtureOn(state, state.gameDate);
  if (!fixture || state.results[fixture.id]) return state;
  if (fixture.date !== state.gameDate || !state.careerEvents.some(e => e.id === `MATCHDAY_READY:${fixture.id}` && !e.resolved)) return state;
  return { ...state, activeMatchSession: null, productionMatch: createProductionSession(state, fixture) };
}

export function advanceProductionMatch(state: CareerState, ticks: number, stopAtHalf = true): CareerState {
  if (!state.productionMatch || state.productionMatch.pausedAtHalf || state.productionMatch.core.status !== 'RUNNING') return state;
  const previous = state.productionMatch;
  const { events, contests, ...body } = previous.core;
  const session: ProductionMatchSession = { ...previous, behaviorRevision:MATCH_BEHAVIOR_REVISION, frames: previous.frames.slice(), core: { ...structuredClone(body), events: events.slice(), contests: contests.slice() } };
  for (let i = 0; i < Math.min(10000, ticks) && session.core.status === 'RUNNING'; i++) {
    const previousEventCount = session.core.events.length;
    advanceCoreMutable(session.core);
    for (const event of session.core.events.slice(previousEventCount)) if (event.type === 'SHOT_RELEASED') {
      const shooter = session.core.players.find(p => p.id === event.actorId);
      const keeper = session.core.players.find(p => p.team !== shooter?.team && p.kind === 'GOALKEEPER' && p.population === 'COURT');
      event.details.goalkeeperId = keeper?.id ?? '';
    }
    const facts = session.core.events.slice(previousEventCount);
    if (session.core.tick % 5 === 0 || session.core.ball.flight || facts.some(e => ['GOAL', 'SUBSTITUTE_ADMITTED', 'EXCHANGE_COMPLETED', 'PERIOD_ENDED', 'TWO_MINUTE_SUSPENSION'].includes(e.type)) || session.core.status !== 'RUNNING') session.frames.push(observedFrame(session));
    if (stopAtHalf && session.core.match?.phase === 'HALFTIME') { session.pausedAtHalf = true; break; }
  }
  if (session.core.status !== 'RUNNING' && session.core.match?.phase !== 'FULLTIME') session.error = 'Matchen kunde inte fortsätta. Ditt matchtillstånd är sparat. ' + session.core.reason;
  return { ...state, productionMatch: session };
}

export function commandProductionMatch(state: CareerState, command: MatchCommand): CareerState {
  if (!state.productionMatch) return state;
  const session = structuredClone(state.productionMatch);
  let accepted = false;
  if (command.kind === 'SECOND_HALF') { session.pausedAtHalf = false; accepted = true; }
  else if (command.kind === 'TACTICS') accepted = setTactics(session.core, command.team, command.patch);
  else if (command.kind === 'SUBSTITUTION') accepted = requestExchange(session.core, command.team, command.outId, command.inId);
  else accepted = requestTeamTimeout(session.core, command.team);
  if (!accepted) throw new Error('Beslutet kan inte genomföras just nu. Timeout kräver eget bollinnehav; ett byte kräver en tillgänglig ersättare.');
  return { ...state, productionMatch: session };
}

export function resultFromSession(session: ProductionMatchSession): FastMatchResult {
  const c = session.core;
  const possessionLedger = ledger(c);
  const person = (id: string | null) => session.people.find(p => p.id === id);
  const events: MatchEvent[] = [];
  let home = 0, away = 0;
  for (const e of c.events) {
    const p = person(e.actorId); if (!p) continue;
    const side = p.team === 'HOME' ? 'home' : 'away';
    const minute = Math.max(1, Math.min(60, Math.ceil(e.officialMs / 60000)));
    if (e.type === 'SHOT_RELEASED') {
      const goal = c.events.some(g => g.type === 'GOAL' && g.actionId === e.actionId);
      const saved = c.events.some(g => g.type.startsWith('SAVE_') && g.actionId === e.actionId);
      if (e.details.shotKind === 'SEVEN_METRE') events.push({ minute, side, type: 'SEVEN_M', playerId: p.id, sevenMetreOutcome: goal ? 'GOAL' : 'MISS' });
      if (!goal && !saved) events.push({ minute, side, type: 'MISS', playerId: p.id });
    }
    if (e.type === 'GOAL') { if (p.team === 'HOME') home++; else away++; events.push({ minute, side, type: 'GOAL', playerId: p.id, homeScoreAfter: home, awayScoreAfter: away }); }
    else if (e.type.startsWith('SAVE_')) events.push({ minute, side, type: 'SAVE', playerId: p.id });
    else if (e.type === 'TWO_MINUTE_SUSPENSION' || e.type === 'DISQUALIFICATION') events.push({ minute, side, type: 'TWO_MIN', playerId: p.id });
  }
  const contributions = (team: TeamId): PlayerMatchContribution[] => session.people.filter(p => p.team === team && (p.started || c.players.find(x => x.id === p.id)!.condition.courtMs > 0 || c.events.some(e => e.actorId === p.id && ['GOAL', 'SHOT_RELEASED', 'SAVE_CAUGHT', 'SAVE_PARRY'].includes(e.type)))).map(p => {
    const goals = c.events.filter(e => e.type === 'GOAL' && e.actorId === p.id).length;
    const shots = c.events.filter(e => e.type === 'SHOT_RELEASED' && e.actorId === p.id).length;
    const saves = c.events.filter(e => e.type.startsWith('SAVE_') && e.actorId === p.id).length;
    return { playerId: p.id, goals, shots, ...(p.role === 'GK' ? { saves, shotsFaced: c.events.filter(e => e.type === 'SHOT_RELEASED' && e.details.goalkeeperId === p.id).length } : {}), rating: Math.max(1, Math.min(10, 6 + goals * .15 + saves * .07 - Math.max(0, shots - goals) * .08)), started: p.started };
  });
  for (const attack of possessionLedger.records) if (lossClassOf(attack.ending)) {
    const last = c.events.findLast(e => e.tick <= attack.lastTick && e.possessionId === attack.possessionId);
    events.push({ minute: Math.max(1, Math.min(60, Math.ceil((last?.officialMs ?? 0) / 60000))), side: attack.team === 'HOME' ? 'home' : 'away', type: 'TURNOVER' });
  }
  events.sort((a, b) => a.minute - b.minute);
  const stats = (team: TeamId): TeamMatchStats => {
    const own = c.events.filter(e => person(e.actorId)?.team === team);
    const shots = own.filter(e => e.type === 'SHOT_RELEASED');
    const goals = c.score[team];
    const seven = shots.filter(e => e.details.shotKind === 'SEVEN_METRE');
    return { goals, shots: shots.length, shootingPct: shots.length ? Math.round(goals / shots.length * 1000) / 10 : 0, saves: own.filter(e => e.type.startsWith('SAVE_')).length, shotsFaced: c.events.filter(e => e.type === 'SHOT_RELEASED' && person(e.actorId)?.team !== team).length, turnovers: possessionLedger.records.filter(r => r.team === team && lossClassOf(r.ending)).length, twoMinuteSuspensions: own.filter(e => e.type === 'TWO_MINUTE_SUSPENSION').length, sevenMetreAttempts: seven.length, sevenMetreGoals: seven.filter(e => c.events.some(g => g.type === 'GOAL' && g.actionId === e.actionId)).length };
  };
  return { fixtureId: session.fixture.id, engine: 'V2', seed: c.seed, homeClubId: session.fixture.homeClubId, awayClubId: session.fixture.awayClubId, homeGoals: c.score.HOME, awayGoals: c.score.AWAY, homeStats: stats('HOME'), awayStats: stats('AWAY'), events, homePlayerContributions: contributions('HOME'), awayPlayerContributions: contributions('AWAY') };
}

export function finalizeProductionMatch(state: CareerState): CareerState {
  const session = state.productionMatch;
  if (!session || session.core.match?.phase !== 'FULLTIME') return state;
  if (state.results[session.fixture.id]) return { ...state, productionMatch: null };
  const result = resultFromSession(session);
  const clubForm = { ...state.clubForm }, playerSeasonStats = { ...state.playerSeasonStats };
  applyMatchResultBookkeeping(result, clubForm, playerSeasonStats, state.playerClubId, session.fixture.type !== 'FRIENDLY');
  const load = Object.fromEntries(session.core.players.map(p => [p.id, { minutes: p.condition.courtMs / 60000, energy: p.condition.energy * 100, distance: p.condition.distanceMetres }]));
  const archiveEventTypes = new Set(['GOAL', 'SHOT_RELEASED', 'SAVE_CAUGHT', 'SAVE_PARRY', 'SHOT_BLOCKED', 'PASS_RELEASED', 'PASS_RECEIVED', 'RECEPTION_FAILED', 'PASS_DEFLECTED', 'REBOUND_CONTROLLED', 'ATTACK_SETTLED', 'DRIVE_RELEASED', 'ADVANTAGE_OPENED', 'FOUL', 'TECHNICAL_VIOLATION', 'PASSIVE_PLAY', 'INTERCEPTION', 'OFFENSIVE_FOUL', 'TWO_MINUTE_SUSPENSION', 'DISQUALIFICATION', 'SUBSTITUTE_ADMITTED', 'EXCHANGE_REQUESTED', 'EXCHANGE_COMPLETED', 'TACTICS_CHANGED', 'TEAM_TIMEOUT_STARTED', 'PERIOD_STARTED', 'PERIOD_ENDED', 'MATCH_FINISHED']);
  const archive: PlayedMatchArchive = { format: 2, fixture: session.fixture, version: session.core.version, behaviorRevision:session.behaviorRevision??MATCH_BEHAVIOR_REVISION, seed: session.core.seed, people: session.people, frameData: encodeFrames(session.frames), events: session.core.events.filter(e => archiveEventTypes.has(e.type)), result, load };
  const readyId = `MATCHDAY_READY:${session.fixture.id}`;
  let next: CareerState = { ...state, productionMatch: null, results: { ...state.results, [session.fixture.id]: result }, matchArchives: { ...state.matchArchives, [session.fixture.id]: archive }, clubForm, playerSeasonStats, careerEvents: state.careerEvents.map(e => e.id === readyId ? { ...e, read: true, resolved: true } : e), inbox: state.inbox.map(m => m.id === `msg:${readyId}` ? { ...m, read: true, resolved: true, actionRequired: false } : m), playerPhysicalState: { ...state.playerPhysicalState } };
  const managerTeam = session.fixture.homeClubId === state.playerClubId ? 'HOME' : 'AWAY';
  const managerIds = new Set(session.people.filter(p => p.team === managerTeam).map(p => p.id));
  const exposure = new Map<string, { attackExposure: number; defenceExposure: number; goalkeeperExposure: number }>();
  for (const p of session.core.players) if (managerIds.has(p.id)) {
    next.playerPhysicalState[p.id] = { ...state.playerPhysicalState[p.id], playerId: p.id, currentEnergy: p.condition.energy * 100, lastUpdatedDate: session.fixture.date, recentLoad: (state.playerPhysicalState[p.id]?.recentLoad ?? 0) + p.condition.courtMs / 60000 };
    const fraction = Math.min(1, p.condition.courtMs / 3600000);
    exposure.set(p.id, { attackExposure: p.kind === 'FIELD_PLAYER' ? fraction : 0, defenceExposure: p.kind === 'FIELD_PLAYER' ? fraction : 0, goalkeeperExposure: p.kind === 'GOALKEEPER' ? fraction : 0 });
  }
  next = applyMatchDevelopmentStimulus(next, session.fixture.date, exposure);
  const injuries = applyMatchInjuryResolution(next, session.fixture.date, session.fixture.id, exposure);
  next = injuries.state;
  for (const playerId of injuries.newlyInjuredPlayerIds) {
    const event = buildPlayerInjuredEvent(playerId, session.fixture.date);
    if (!next.careerEvents.some(e => e.id === event.id)) next = { ...next, careerEvents: [...next.careerEvents, event], inbox: [...next.inbox, careerEventToInboxMessage(event, next)] };
  }
  const completed = buildMatchCompletedEvent(session.fixture.id, session.fixture.competitionId, state.gameDate);
  next = { ...next, careerEvents: [...next.careerEvents, completed], inbox: [...next.inbox, careerEventToInboxMessage(completed, next)] };
  return checkSeasonComplete(next);
}

export function finishProductionMatch(state: CareerState): CareerState {
  let next = state;
  for (let i = 0; i < 40 && next.productionMatch?.core.status === 'RUNNING'; i++) {
    if (next.productionMatch.pausedAtHalf) next = commandProductionMatch(next, { kind: 'SECOND_HALF' });
    next = advanceProductionMatch(next, 10000, false);
  }
  return finalizeProductionMatch(next);
}
