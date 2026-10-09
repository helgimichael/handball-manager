/** Developer diagnostics: runs the canonical career path, never a second engine.
 * Run from apps/game: node --import tsx scripts/match-realism-benchmark.ts --count 50 --out ../../docs/match-realism-v2/baseline
 * Reuse --inputs ../../docs/match-realism-v2/baseline/inputs.json for an identical paired sample.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createNewCareerState } from '../lib/career/newCareer';
import { snapshotGameplayRatings, snapshotWorldSquads } from '../lib/gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from '../lib/career/careerEvents';
import { startProductionMatch, advanceProductionMatch, resultFromSession } from '../lib/career/productionMatch';
import { getClubsByCompetition, getClub } from '../lib/game-data';
import { ledger, lossClassOf } from '@handball-manager/handball-engine/src/v2/core/ledger';
import { measure, EHF_ELITE } from '@handball-manager/handball-engine/src/v2/core/realism';
import { local } from '@handball-manager/handball-engine/src/v2/core/space';
import type { CoreEvent, CoreState, TeamId } from '@handball-manager/handball-engine/src/v2/core/state';
import type { PlayerMock } from '../lib/game-data';
import type { GameplayPlayerRating } from '../lib/gameWorld/gameplayRatingSnapshot';

const args = process.argv.slice(2);
const option = (key: string, fallback?: string) => { const i = args.indexOf(key); return i < 0 ? fallback : args[i + 1]; };
const count = Number(option('--count', '50'));
const offset = Number(option('--offset', '0'));
const out = resolve(option('--out', '../../docs/match-realism-v2/baseline')!);
const competitionId = option('--competition', 'swe-2')!;
const prefix = option('--seed-prefix', 'match-realism-v2-canonical-2026')!;
if (!Number.isInteger(count) || count < 1 || !Number.isInteger(offset) || offset < 0) throw new Error('count and offset must be positive integers');
mkdirSync(out, { recursive: true });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const write = (name: string, value: unknown) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n');
const repositoryRoot = resolve(dirname(process.argv[1]), '../../..');
const coreDirectory = 'packages/handball-engine/src/v2/core';
const sourcePaths = [...readdirSync(join(repositoryRoot, coreDirectory)).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts')).map(name => `${coreDirectory}/${name}`), 'apps/game/lib/career/productionMatch.ts', 'apps/game/scripts/match-realism-benchmark.ts'];
const fingerprints = () => sourcePaths.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(join(repositoryRoot, path))).digest('hex') }));
const sourceFingerprints = fingerprints();
write('source-fingerprints.json', sourceFingerprints);
type Inputs = { competitionId: string; clubs: string[]; worldSquads: Record<string, PlayerMock[]>; gameplayRatings: Record<string, GameplayPlayerRating[]> };
const inputsPath = option('--inputs');
const inputs: Inputs = inputsPath ? JSON.parse(readFileSync(resolve(inputsPath), 'utf8')) : {
  competitionId,
  clubs: getClubsByCompetition(competitionId).filter(club => club.dataSource === 'REAL_WORLD').map(club => club.id).sort(),
  worldSquads: snapshotWorldSquads(competitionId), gameplayRatings: snapshotGameplayRatings(competitionId),
};
if (!inputs.clubs.length) throw new Error('No actual career clubs in snapshot');
write('inputs.json', inputs);
const seeds = Array.from({ length: count }, (_, n) => ({ index: n + offset, saveSeed: `${prefix}:${n + offset}`, managerClubId: inputs.clubs[(n + offset) % inputs.clubs.length] }));
write('seed-set.json', seeds);

export function distribution(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const quantile = (q: number) => {
    if (!sorted.length) return null;
    const index = (sorted.length - 1) * q, lo = Math.floor(index), hi = Math.ceil(index);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
  };
  return { n: sorted.length, mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null, median: quantile(.5), p10: quantile(.1), p90: quantile(.9), min: sorted[0] ?? null, max: sorted.at(-1) ?? null };
}
const freq = (values: (string | undefined)[]) => values.reduce<Record<string, number>>((total, value) => { const key = value ?? 'UNKNOWN'; total[key] = (total[key] ?? 0) + 1; return total; }, {});
const ratio = (a: number, b: number) => b ? a / b : 0;
const startedAt = new Date().toISOString();
let head = 'UNKNOWN';
try { head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* explicit metadata absence */ }
const matches: ReturnType<typeof runOne>[] = [];
const start = performance.now();

function diagnosticSnapshot(core: CoreState) {
  return structuredClone({ tick: core.tick, officialMs: core.officialClock.timeMs, phase: core.match?.phase, possession: core.possession, ball: core.ball, restart: core.restart,
    players: core.players.filter(p => p.population === 'COURT').map(p => ({ id: p.id, role: p.role, kind: p.kind, team: p.team, position: p.position, velocity: p.velocity, duty: p.duty, action: p.action && { kind: p.action.kind, phase: p.action.phase, startedTick: p.action.startedTick, target: p.action.target, targetId: p.action.targetId, reason: p.action.reason } })),
  });
}

function runOne(config: typeof seeds[number]) {
  let career = createNewCareerState(config.saveSeed, config.managerClubId, structuredClone(inputs.worldSquads), undefined, structuredClone(inputs.gameplayRatings));
  const fixture = career.fixtures.find(f => f.type === 'LEAGUE' && (f.homeClubId === config.managerClubId || f.awayClubId === config.managerClubId));
  if (!fixture) throw new Error(`No fixture for ${config.managerClubId}`);
  career = { ...career, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] };
  career = startProductionMatch(career, fixture.id);
  if (!career.productionMatch) throw new Error('Canonical start refused');
  const initial = career.productionMatch;
  const matchStart = performance.now();
  let calls = 0;
  const diagnosticSnapshots: ReturnType<typeof diagnosticSnapshot>[] = [diagnosticSnapshot(initial.core)];
  const controlSamples: { tick: number; controllerId: string; population: string; separation: number; concurrentFlight: boolean }[] = [];
  while (career.productionMatch!.core.status === 'RUNNING' && calls++ < 40) {
    career = advanceProductionMatch(career, 10000, false);
    const observed = career.productionMatch!.core;
    diagnosticSnapshots.push(diagnosticSnapshot(observed));
    if (observed.ball.controllerId) {
      const controller = observed.players.find(p => p.id === observed.ball.controllerId)!;
      controlSamples.push({ tick: observed.tick, controllerId: controller.id, population: controller.population, separation: Math.hypot(controller.position.x - observed.ball.position.x, controller.position.y - observed.ball.position.y), concurrentFlight: Boolean(observed.ball.flight) });
    }
  }
  const elapsedMs = performance.now() - matchStart;
  const session = career.productionMatch!, core = session.core;
  if (core.match?.phase !== 'FULLTIME') throw new Error(`Incomplete match ${config.index}: ${core.status} ${core.reason}`);
  const measured = measure(core, core.seed, 'TOP'), book = ledger(core), result = resultFromSession(session);
  const people = new Map(session.people.map(person => [person.id, person]));
  const byPossession = new Map<string, CoreEvent[]>();
  for (const event of core.events) { const held = byPossession.get(event.possessionId) ?? []; held.push(event); byPossession.set(event.possessionId, held); }
  const records = book.records.map(record => {
    const events = byPossession.get(record.possessionId)!;
    const first = events[0], last = events.at(-1)!;
    const release = events.find(e => e.type === 'PASS_RELEASED' || e.type === 'SHOT_RELEASED');
    return { ...record, officialSeconds: (last.officialMs - first.officialMs) / 1000, simulationSeconds: (last.timeMs - first.timeMs) / 1000,
      firstOfficialMs: first.officialMs, lastOfficialMs: last.officialMs,
      transition: events.some(e => e.details.phase === 'TRANSITION'), firstReleaseSeconds: release ? (release.officialMs - first.officialMs) / 1000 : null };
  });
  const goalsByAction = new Set(core.events.filter(e => e.type === 'GOAL').map(e => e.actionId));
  const saveByAction = new Set(core.events.filter(e => e.type.startsWith('SAVE_')).map(e => e.actionId));
  const blockByAction = new Set(core.events.filter(e => e.type === 'SHOT_BLOCKED').map(e => e.actionId));
  let period = 1;
  const tacticalRoles = new Map(session.people.map(person => [person.id, person.role as string]));
  const shots: { playerId: string | null; role: string; tacticalRole: string; team: TeamId | 'UNKNOWN'; category: string; phase: string; distance: number; localX: number; localY: number; x: number; y: number; goal: boolean; saved: boolean; blocked: boolean; officialMs: number; tick: number; actionId: string | null; details: CoreEvent['details'] }[] = [];
  for (const event of core.events) {
    if (event.type === 'PERIOD_STARTED') period = Number(event.details.period);
    if (event.type === 'EXCHANGE_COMPLETED' && event.actorId && typeof event.details.role === 'string') tacticalRoles.set(event.actorId, event.details.role);
    if (event.type !== 'SHOT_RELEASED') continue;
    const person = people.get(event.actorId ?? '');
    const x = Number(event.details.x), y = Number(event.details.y);
    const direction = person?.team === 'HOME' ? (period === 1 ? 'TOP' : 'BOTTOM') : (period === 1 ? 'BOTTOM' : 'TOP');
    const point = local({ x, y }, direction);
    shots.push({ playerId: event.actorId, role: person?.role ?? 'UNKNOWN', tacticalRole: tacticalRoles.get(event.actorId ?? '') ?? 'UNKNOWN', team: person?.team ?? 'UNKNOWN', category: String(event.details.shotKind),
      phase: String(event.details.phase ?? 'UNKNOWN'), distance: Math.hypot(point.x - 10, point.y), localX: point.x, localY: point.y, x, y,
      goal: goalsByAction.has(event.actionId), saved: saveByAction.has(event.actionId), blocked: blockByAction.has(event.actionId), officialMs: event.officialMs, tick: event.tick, actionId: event.actionId, details: event.details });
  }
  const passesAttempted = core.events.filter(e => e.type === 'PASS_RELEASED').length;
  const passesCompleted = core.events.filter(e => e.type === 'PASS_RECEIVED').length;
  const saves = core.events.filter(e => e.type.startsWith('SAVE_')).length;
  const scoring = (team: TeamId) => {
    const goals = result[team === 'HOME' ? 'homePlayerContributions' : 'awayPlayerContributions'].map(p => p.goals);
    const total = goals.reduce((a, b) => a + b, 0);
    return { topScorerShare: ratio(Math.max(0, ...goals), total), hhi: goals.reduce((n, g) => n + ratio(g, total) ** 2, 0), scorers: goals.filter(g => g > 0).length };
  };
  const homeConcentration = scoring('HOME'), awayConcentration = scoring('AWAY');
  const transitionShots = shots.filter(shot => shot.phase === 'TRANSITION');
  const observedFramesByTick = new Map(session.frames.map(frame => [frame[0], frame]));
  const shotOriginControl = shots.map(shot => {
    const frame = observedFramesByTick.get(shot.tick), personIndex = session.people.findIndex(person => person.id === shot.playerId);
    if (frame) for (let i = 7; i < frame.length; i += 3) if (frame[i] === personIndex) {
      const separation = Math.hypot(shot.x - frame[i + 1] / 100, shot.y - frame[i + 2] / 100);
      return { actionId: shot.actionId, tick: shot.tick, playerId: shot.playerId, separation, error: separation > .9 };
    }
    return { actionId: shot.actionId, tick: shot.tick, playerId: shot.playerId, separation: null, error: null };
  });
  const anchors = [
    ['GAP_ATTACK', core.events.find(e => e.type === 'ACTION_STARTED' && e.details.kind === 'DRIVE' && /gap|interval|shoulder/i.test(String(e.details.reason)))],
    ['DEFENSIVE_REACTION_AND_CONTINUATION', core.events.find(e => e.type === 'ADVANTAGE_CONTINUED') ?? core.events.find(e => e.type === 'ADVANTAGE_OPENED')],
    ['PIVOT_PASS_INTENT', core.events.find(e => e.type === 'ACTION_STARTED' && e.details.kind === 'PASS' && /line player|pivot/i.test(String(e.details.reason)))],
    ['WING_PASS_INTENT', core.events.find(e => e.type === 'ACTION_STARTED' && e.details.kind === 'PASS' && /wing|width/i.test(String(e.details.reason)))],
    ['PASS_LOSS', core.events.find(e => ['INTERCEPTION', 'RECEPTION_FAILED', 'PASS_EXECUTION_FAILED'].includes(e.type))],
    ['SAVE_AND_NEW_PHASE', core.events.find(e => e.type.startsWith('SAVE_'))],
    ['TRANSITION_SETTLED', core.events.find(e => e.type === 'ATTACK_SETTLED')],
    ['CONTACT_AND_RULES', core.events.find(e => e.type === 'FOUL')],
  ] as const;
  const usefulEvent = (e: CoreEvent) => {
    if (['ACTION_PHASE', 'ACTION_RESOLVED', 'ACTION_INTERRUPTED', 'HANDLING_STEP', 'DRIBBLE_BOUNCE'].includes(e.type)) return false;
    if (e.type === 'ACTION_STARTED') return ['DRIVE', 'FEINT', 'PASS', 'SHOOT', 'JUMP', 'HELP', 'PRESS', 'RECOVER', 'HANDOVER', 'CONTACT', 'DRIBBLE'].includes(String(e.details.kind));
    if (e.type === 'RESPONSIBILITY_ASSIGNED') return ['CARRIER', 'PIVOT', 'WING_OFFER', 'HELP', 'PRESSURE', 'RETREAT', 'RECOVER'].includes(String(e.details.kind));
    return true;
  };
  const causalityEpisodes = anchors.map(([label, anchor]) => ({ label, present: Boolean(anchor), anchor: anchor ?? null,
    events: anchor ? core.events.filter(e => e.tick >= anchor.tick - 120 && e.tick <= anchor.tick + 200 && usefulEvent(e)).slice(0, 120) : [],
    frames: anchor ? session.frames.filter(frame => frame[0] >= anchor.tick - 120 && frame[0] <= anchor.tick + 200 && frame[0] % 10 === 0) : [],
    note: 'Actual chronological event window, not a staged scenario. A pass intent does not prove it succeeded. Anchor uses recorded action reason/event semantics; inspect its production frames in normal replay.',
  }));
  const terminalFacts = new Set(['BALL_CONTROLLED', 'BALL_LOOSE', 'RECEPTION_FAILED', 'PASS_DEFLECTED', 'INTERCEPTION', 'PASS_RECEIVED', 'PASS_RELEASED', 'SHOT_RELEASED', 'GOAL', 'SAVE_CAUGHT', 'SAVE_PARRY', 'SHOT_BLOCKED', 'FOUL', 'RESTART_AWARDED', 'POSSESSION_AWARDED', 'POSSESSION_CHANGED', 'PERIOD_ENDED']);
  const longestAttackTraces = [...records].sort((a, b) => b.officialSeconds - a.officialSeconds).slice(0, 3).map(record => {
    const facts = byPossession.get(record.possessionId)!.filter(e => terminalFacts.has(e.type));
    const physicalFacts = facts.filter(e => e.type !== 'PERIOD_ENDED');
    const lastPhysical = physicalFacts.at(-1);
    return { record, lastPhysicalFact: lastPhysical ?? null, officialSecondsAfterLastPhysicalFact: lastPhysical ? (record.lastOfficialMs - lastPhysical.officialMs) / 1000 : null,
      facts: facts.slice(-120), snapshots: diagnosticSnapshots.filter(snapshot => snapshot.tick >= record.firstTick && snapshot.tick <= record.lastTick) };
  });
  const numerical = {
    homeGoals: result.homeGoals, awayGoals: result.awayGoals, goals: measured.goals, margin: Math.abs(result.homeGoals - result.awayGoals), possessions: book.attacks,
    homePossessions: records.filter(r => r.team === 'HOME').length, awayPossessions: records.filter(r => r.team === 'AWAY').length,
    goalsPerPossession: ratio(measured.goals, book.attacks), meanPossessionOfficialSeconds: distribution(records.map(r => r.officialSeconds)).mean!, meanPossessionSimulationSeconds: distribution(records.map(r => r.simulationSeconds)).mean!,
    passesAttempted, passesCompleted, passesPerPossession: ratio(passesCompleted, book.attacks), shots: shots.length, goalsPerShot: ratio(measured.goals, shots.length),
    missesOrBlocks: shots.filter(shot => !shot.goal && !shot.saved).length, saves, savePctOnTarget: ratio(saves, saves + measured.goals), saveShareAllAttempts: ratio(saves, shots.length),
    nonShotLoss: book.nonShotLoss, turnoverEndings: records.filter(r => lossClassOf(r.ending)).length,
    sevenMetres: measured.sevenMetres, sevenMetreGoals: shots.filter(shot => shot.category === 'SEVEN_METRE' && shot.goal).length, suspensions: measured.suspensions,
    fouls: measured.fouls, blocks: measured.blocks, backcourtShare: measured.shotMix.BACKCOURT, wingShare: measured.shotMix.WING, closeShare: measured.shotMix.CLOSE,
    standingShots: measured.shotKinds.STANDING ?? 0, pivotShots: measured.shotKinds.PIVOT ?? 0, wingShots: measured.shotKinds.WING ?? 0,
    transitionShots: transitionShots.length, transitionGoals: transitionShots.filter(s => s.goal).length, transitionShare: measured.transitionShare,
    transitionPossessionsObserved: records.filter(record => record.transition).length, meanShotDistance: distribution(shots.map(s => s.distance)).mean!,
    topScorerShare: (homeConcentration.topScorerShare + awayConcentration.topScorerShare) / 2, scorerHHI: (homeConcentration.hhi + awayConcentration.hhi) / 2,
    shotOriginControlErrors: shotOriginControl.filter(s => s.error).length, shotOriginControlUnavailable: shotOriginControl.filter(s => s.error === null).length,
    sampledControlErrors: controlSamples.filter(s => s.separation > .86 || s.population !== 'COURT' || s.concurrentFlight).length,
    runtimeMs: elapsedMs, ticks: core.tick, frames: session.frames.length, rngDraws: core.rng.draws,
  };
  return { ...config, canonicalSeed: core.seed, fixture, homeName: getClub(fixture.homeClubId)?.name, awayName: getClub(fixture.awayClubId)?.name,
    engineVersion: core.version, behaviorRevision: session.behaviorRevision ?? null, complete: true, initialPeople: initial.people, initialProfiles: initial.core.players.map(p => ({ id: p.id, role: p.role, team: p.team, profile: p.profile, energy: p.condition.energy })),
    numerical, measured, result, possessions: records, possessionDurationDistribution: distribution(records.map(r => r.officialSeconds)), shotDistanceDistribution: distribution(shots.map(s => s.distance)),
    shotCategories: freq(shots.map(s => s.category)), shooterPositions: freq(shots.map(s => s.role)), shooterTacticalPositions: freq(shots.map(s => s.tacticalRole)), shots, playerShotDistribution: freq(shots.map(s => s.playerId ?? 'UNKNOWN')), concentration: { HOME: homeConcentration, AWAY: awayConcentration },
    eventCounts: freq(core.events.map(e => e.type)), causalityEpisodes, longestAttackTraces, diagnosticSnapshots, shotOriginControl, controlSamples, finalLoad: core.players.map(p => ({ id: p.id, energy: p.condition.energy, courtMs: p.condition.courtMs, distance: p.condition.distanceMetres })),
    truthHash: hash(JSON.stringify({ score: core.score, events: core.events, rng: core.rng, frames: session.frames })),
  };
}

for (const seed of seeds) {
  const match = runOne(seed); matches.push(match);
  write(`match-${String(seed.index).padStart(3, '0')}.json`, match);
  console.log(JSON.stringify({ index: seed.index, seed: match.canonicalSeed, score: `${match.numerical.homeGoals}-${match.numerical.awayGoals}`, runtimeMs: Math.round(match.numerical.runtimeMs), possessions: match.numerical.possessions, shots: match.numerical.shots, backcourtShare: match.numerical.backcourtShare }));
}
const keys = Object.keys(matches[0].numerical) as (keyof typeof matches[number]['numerical'])[];
const distributions = Object.fromEntries(keys.map(key => [key, distribution(matches.map(match => match.numerical[key]))]));
const references = [
  ['goals', EHF_ELITE.goals], ['shots', EHF_ELITE.shots], ['possessions', EHF_ELITE.possessions], ['goalsPerShot', EHF_ELITE.efficiency],
  ['nonShotLoss', EHF_ELITE.nonShotLoss], ['fouls', EHF_ELITE.fouls], ['suspensions', EHF_ELITE.suspensions], ['sevenMetres', EHF_ELITE.sevenMetres],
  ['blocks', EHF_ELITE.blocks], ['backcourtShare', EHF_ELITE.shotMix.BACKCOURT], ['wingShare', EHF_ELITE.shotMix.WING], ['closeShare', EHF_ELITE.shotMix.CLOSE], ['transitionShare', EHF_ELITE.transitionShare],
] as const;
const referenceComparison = references.map(([metric, band]) => ({ metric, band, mean: distributions[metric].mean,
  outsideSeeds: matches.filter(match => match.numerical[metric] < band.min || match.numerical[metric] > band.max).map(match => ({ index: match.index, canonicalSeed: match.canonicalSeed, value: match.numerical[metric] })) }));
const ranked = (metric: keyof typeof matches[number]['numerical'], ascending = false) => [...matches].sort((a, b) => (ascending ? 1 : -1) * (a.numerical[metric] - b.numerical[metric])).slice(0, 5).map(match => ({ index: match.index, canonicalSeed: match.canonicalSeed, score: `${match.numerical.homeGoals}-${match.numerical.awayGoals}`, value: match.numerical[metric] }));
const aggregate = {
  format: 1, startedAt, finishedAt: new Date().toISOString(), sampleSize: matches.length, sourceHead: head, engineVersions: [...new Set(matches.map(m => m.engineVersion))], inputsHash: hash(JSON.stringify(inputs)),
  behaviorRevisions: [...new Set(matches.map(m => m.behaviorRevision))],
  canonicalPath: 'createNewCareerState -> startProductionMatch -> advanceProductionMatch (10000 ticks, stopAtHalf=false) -> resultFromSession',
  sampleDesign: 'Fixed save seeds; manager clubs rotate through real-world competition clubs; first actual league fixture; actual career snapshot ratings/availability/lineup; CPU coach active for opponent and manual manager defaults unchanged; no live commands in distribution sample.',
  definitions: {
    possessions: 'Canonical ledger attacks (live touched possessions); procedural fragments excluded; per-team counts use ledger ownership.',
    duration: 'Recorded possession first-to-last event official span; excludes stopped clock. Simulation span also reported. A trace-span observation, not independently reconstructed wall-clock possession duration.',
    turnover: 'nonShotLoss is the canonical ledger count lost without any shot; turnoverEndings mirrors resultFromSession lossClassOf-ending count and can include a prior shot.',
    saves: 'SAVE_CAUGHT + SAVE_PARRY; savePctOnTarget = saves/(saves+goals); saveShareAllAttempts also explicit.',
    transition: 'Shot phase comes from canonical SHOT_RELEASED.details.phase; transitionPossessionsObserved requires a phase-bearing event, so possession transitions without such events are not counted.',
    shotDistance: 'Euclidean recorded release location to goal centre; local coordinates invert with actual PERIOD_STARTED event and team.',
    shooterPosition: 'role/shooterPositions is immutable initial MatchPerson position (starter slot or bench original role), consistently paired with baseline. tacticalRole/shooterTacticalPositions additionally follows actual chronological EXCHANGE_COMPLETED role assignments in post-baseline runs.',
    originControl: 'Post-baseline diagnostics compare each shot release origin with the original same-tick observed shooter frame, allowing 0.9m for the 0.86m physical catch offset plus centimetre quantization. Missing exact-tick frames are explicitly unavailable. Chunk-boundary actual controller snapshots check 0.86m exclusive on-court control; this is not a claim of every-tick invariant coverage.',
    scorerConcentration: 'Top scorer goal share and Herfindahl sum of squared scorer goal shares, computed per team then averaged.',
    references: 'Existing core/realism.ts EHF_ELITE wide engineering plausibility bands, not sourced empirical league targets. Allsvenskan sample is not automatically elite European club calibration.',
  },
  unavailableMetrics: ['A separate catch-quality rating or intended shot-quality scalar is not recorded in baseline event data; newer release details are retained when present.', 'This event-reading benchmark does not count transition attempts lacking a phase-bearing event; observed transition possessions and released transition shots are reported.', 'The baseline benchmark did not retain a separate semantic first-threat classifier; first live release latency is retained per possession and post-baseline causal action windows remain available.'],
  sourceFingerprintsStableDuringBatch: JSON.stringify(sourceFingerprints) === JSON.stringify(fingerprints()),
  distributions,
  pooled: { possessionOfficialSeconds: distribution(matches.flatMap(m => m.possessions.map(r => r.officialSeconds))), passesPerPossession: distribution(matches.flatMap(m => m.possessions.map(r => r.passes))), shotDistanceMetres: distribution(matches.flatMap(m => m.shots.map(s => s.distance))), shotCategories: freq(matches.flatMap(m => m.shots.map(s => s.category))), shooterPositions: freq(matches.flatMap(m => m.shots.map(s => s.role))), shooterTacticalPositions: freq(matches.flatMap(m => m.shots.map(s => s.tacticalRole))) },
  outliers: { highScoring: ranked('goals'), lowScoring: ranked('goals', true), highPossessions: ranked('possessions'), highBackcourtShare: ranked('backcourtShare'), highScorerConcentration: ranked('topScorerShare'), closest: ranked('margin', true) },
  referenceComparison, totalRuntimeMs: performance.now() - start,
};
write('aggregate.json', aggregate);
write('matches-summary.json', matches.map(({ index, saveSeed, managerClubId, canonicalSeed, fixture, homeName, awayName, engineVersion, numerical, truthHash }) => ({ index, saveSeed, managerClubId, canonicalSeed, fixture, homeName, awayName, engineVersion, numerical, truthHash })));
console.log(JSON.stringify({ complete: true, sampleSize: matches.length, totalRuntimeMs: Math.round(aggregate.totalRuntimeMs), out }));
