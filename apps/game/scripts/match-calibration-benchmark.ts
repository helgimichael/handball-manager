/** v2.1 developer benchmark. Actual canonical career start/advance; read-only observer. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createNewCareerState } from '../lib/career/newCareer';
import { buildMatchdayReadyEvent } from '../lib/career/careerEvents';
import { startProductionMatch, advanceProductionMatch, resultFromSession, commandProductionMatch } from '../lib/career/productionMatch';
import { ledger } from '@handball-manager/handball-engine/src/v2/core/ledger';
import type { CareerState } from '../lib/career/types';
import type { PlayerMock } from '../lib/game-data';
import type { GameplayPlayerRating } from '../lib/gameWorld/gameplayRatingSnapshot';
import { CalibrationDiagnostics, distribution } from './lib/calibrationDiagnostics';

const args = process.argv.slice(2);
const option = (key: string, fallback?: string) => { const at = args.indexOf(key); return at < 0 ? fallback : args[at + 1]; };
const out = resolve(option('--out', '../../docs/match-realism-v21/after')!);
const inputPath = resolve(option('--inputs', '../../docs/match-realism-v2/baseline/inputs.json')!);
const count = Number(option('--count', '100')), offset = Number(option('--offset', '0'));
const indices = option('--indices')?.split(',').map(Number) ?? Array.from({ length: count }, (_, n) => n + offset);
const prefix = option('--seed-prefix', 'match-realism-v2-canonical-2026')!;
const variant = option('--variant', 'BASELINE')!;
if (!['BASELINE', 'QUICK', 'WIDTH', 'COMBINATION', 'DIRECT', 'FIVE_ONE', 'SHOOTER_STRONG', 'SHOOTER_WEAK', 'KEEPER_STRONG', 'KEEPER_WEAK', 'PASSER_STRONG', 'PASSER_WEAK', 'RUNNER_FAST', 'RUNNER_SLOW'].includes(variant)) throw new Error(`Unknown controlled variant ${variant}`);
if (!indices.length || indices.some(index => !Number.isInteger(index) || index < 0)) throw new Error('Invalid fixed indices');
type Inputs = { competitionId: string; clubs: string[]; worldSquads: Record<string, PlayerMock[]>; gameplayRatings: Record<string, GameplayPlayerRating[]> };
const inputs: Inputs = JSON.parse(readFileSync(inputPath, 'utf8'));
if (existsSync(join(out, 'aggregate.json'))) throw new Error('This output already contains a completed sample. Use a new directory to preserve stage evidence.');
mkdirSync(out, { recursive: true });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const write = (name: string, value: unknown) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n');
const repositoryRoot = resolve(dirname(process.argv[1]), '../../..');
const coreDir = 'packages/handball-engine/src/v2/core';
const paths = [...readdirSync(join(repositoryRoot, coreDir)).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'testProfile.ts').map(name => `${coreDir}/${name}`), 'packages/handball-engine/src/v2/primitives.ts', 'apps/game/lib/career/productionMatch.ts', 'apps/game/scripts/match-calibration-benchmark.ts', 'apps/game/scripts/lib/calibrationDiagnostics.ts'];
const fingerprint = () => paths.map(path => ({ path, sha256: hash(readFileSync(join(repositoryRoot, path), 'utf8')) }));
const sourceFingerprints = fingerprint();
write('source-fingerprints.json', sourceFingerprints);
let sourceHead = 'UNKNOWN';
try { sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* explicit unavailable metadata */ }
write('inputs.json', inputs);
const recipes = indices.map(index => ({ index, saveSeed: `${prefix}:${index}`, managerClubId: inputs.clubs[index % inputs.clubs.length], variant }));
write('seed-set.json', recipes);
const started = performance.now(), startedAt = new Date().toISOString();

function applyTestVariant(state: CareerState): CareerState {
  if (!['SHOOTER_STRONG', 'SHOOTER_WEAK', 'KEEPER_STRONG', 'KEEPER_WEAK', 'PASSER_STRONG', 'PASSER_WEAK', 'RUNNER_FAST', 'RUNNER_SLOW'].includes(variant)) return state;
  const ratings = structuredClone(state.gameplayRatings), strong = ['SHOOTER_STRONG', 'KEEPER_STRONG', 'PASSER_STRONG', 'RUNNER_FAST'].includes(variant), value = strong ? 18 : 5;
  const keys = variant.startsWith('SHOOTER') ? ['SHOOTING_POWER', 'SHOOTING_PLACEMENT', 'FINISHING', 'WING_FINISHING', 'PIVOT_PLAY', 'COMPOSURE']
    : variant.startsWith('KEEPER') ? ['GK_POSITIONING', 'SET_POSITION', 'REACTION', 'GK_EXPLOSIVENESS', 'LOW_SAVES', 'HIGH_SAVES', 'CLOSE_RANGE_SAVES', 'LONG_RANGE_SAVES', 'WING_SAVES', 'SEVEN_M_SAVES', 'SHOOTER_READING', 'SHOT_ANTICIPATION']
      : variant.startsWith('PASSER') ? ['PASSING', 'BALL_HANDLING', 'DECISION_MAKING', 'GAME_READING', 'COMPOSURE'] : ['TOP_SPEED', 'ACCELERATION', 'AGILITY', 'EXPLOSIVENESS', 'ENDURANCE'];
  for (const rating of ratings[state.playerClubId] ?? []) {
    const isKeeper = state.worldSquads[state.playerClubId]?.find(player => player.id === rating.playerId)?.position === 'MV';
    if (variant.startsWith('KEEPER') !== isKeeper) continue;
    const attributes = rating.branch.attributes as unknown as Record<string, { value: number } | undefined>;
    for (const key of keys) if (attributes[key]) attributes[key] = { ...attributes[key]!, value };
  }
  return { ...state, gameplayRatings: ratings };
}

function runOne(recipe: typeof recipes[number]) {
  let career = applyTestVariant(createNewCareerState(recipe.saveSeed, recipe.managerClubId, structuredClone(inputs.worldSquads), undefined, structuredClone(inputs.gameplayRatings)));
  const fixture = career.fixtures.find(f => f.type === 'LEAGUE' && (f.homeClubId === recipe.managerClubId || f.awayClubId === recipe.managerClubId))!;
  career = { ...career, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] };
  career = startProductionMatch(career, fixture.id);
  if (!career.productionMatch) throw new Error('Canonical start refused');
  const managerTeam = fixture.homeClubId === career.playerClubId ? 'HOME' : 'AWAY';
  const tacticalVariants = { QUICK: { tempo: 'QUICK' }, WIDTH: { attackIdentity: 'WIDTH' }, COMBINATION: { attackIdentity: 'COMBINATION' }, DIRECT: { attackIdentity: 'DIRECT' }, FIVE_ONE: { defence: '5:1' } } as const;
  if (variant in tacticalVariants) career = commandProductionMatch(career, { kind: 'TACTICS', team: managerTeam, patch: tacticalVariants[variant as keyof typeof tacticalVariants] });
  const initial = career.productionMatch!, initialSessionHash = hash(JSON.stringify({ fixture: initial.fixture, core: initial.core, people: initial.people }));
  const observer = new CalibrationDiagnostics(), simulationStart = performance.now();
  let calls = 0;
  while (career.productionMatch!.core.status === 'RUNNING' && calls++ < 40) career = advanceProductionMatch(career, 10000, false, observer.observe);
  const runtimeMs = performance.now() - simulationStart, session = career.productionMatch!, core = session.core;
  if (core.match?.phase !== 'FULLTIME') {
    write(`failed-${String(recipe.index).padStart(3, '0')}.json`, { recipe, status: core.status, reason: core.reason, score: core.score, tick: core.tick, phase: core.match?.phase });
    throw new Error(`Incomplete canonical match ${recipe.index}: ${core.reason}`);
  }
  const diagnostics = observer.report(core), result = resultFromSession(session), book = ledger(core);
  const topShare = (team: 'home' | 'away', kind: 'goals' | 'shots') => { const values = result[team === 'home' ? 'homePlayerContributions' : 'awayPlayerContributions'].map(p => p[kind]); return Math.max(0, ...values) / Math.max(1, values.reduce((a, b) => a + b, 0)); };
  const all = diagnostics.shotGroups.ALL;
  const numerical = { homeGoals: result.homeGoals, awayGoals: result.awayGoals, goals: result.homeGoals + result.awayGoals, margin: Math.abs(result.homeGoals - result.awayGoals), possessions: book.attacks,
    homePossessions: book.records.filter(r => r.team === 'HOME').length, awayPossessions: book.records.filter(r => r.team === 'AWAY').length,
    meanPossessionSeconds: diagnostics.terminals.reduce((seconds, record) => seconds + record.officialSeconds, 0) / Math.max(1, diagnostics.terminals.length), possessionRateEquivalentSeconds: 3600 / Math.max(1, book.attacks), passes: core.events.filter(e => e.type === 'PASS_RECEIVED').length, passesPerPossession: core.events.filter(e => e.type === 'PASS_RECEIVED').length / Math.max(1, book.attacks),
    shots: all.attempts, saves: all.saves, misses: all.misses, blocks: all.blocks, savePctOnTarget: all.savePctOnTarget ?? 0, saveShareAllAttempts: all.saveShareAllAttempts ?? 0,
    nonShotLoss: book.nonShotLoss, careerTurnovers: result.homeStats.turnovers + result.awayStats.turnovers,
    transitionStarts: diagnostics.transition.starts, transitionShots: diagnostics.transition.shots, transitionGoals: diagnostics.transition.goals, transitionAbortToSettled: diagnostics.transition.abortToSettled,
    physicalContacts: diagnostics.contact.physicalContacts, contactEpisodes: diagnostics.contact.continuousPairEpisodes, assessedFouls: diagnostics.contact.assessedFouls, rawFoulEvents: diagnostics.contact.rawFoulEvents, contactWhistles: diagnostics.contact.contactWhistles, freeThrowAwards: diagnostics.contact.freeThrowAwards,
    advantagePending: diagnostics.contact.advantagesPending, advantageRealized: diagnostics.contact.advantagesRealized, advantageRecalled: diagnostics.contact.advantagesRecalled,
    sevenMetres: result.homeStats.sevenMetreAttempts + result.awayStats.sevenMetreAttempts, sevenMetreGoals: result.homeStats.sevenMetreGoals + result.awayStats.sevenMetreGoals, suspensions: result.homeStats.twoMinuteSuspensions + result.awayStats.twoMinuteSuspensions,
    scorerConcentration: (topShare('home', 'goals') + topShare('away', 'goals')) / 2, shotConcentration: (topShare('home', 'shots') + topShare('away', 'shots')) / 2,
    backcourtShare: diagnostics.shots.filter(shot => ['BACKCOURT_JUMP', 'STANDING'].includes(shot.kind)).length / Math.max(1, all.attempts), wingShare: (diagnostics.shotGroups['CATEGORY:WING']?.attempts ?? 0) / Math.max(1, all.attempts), closeShare: diagnostics.shots.filter(shot => !['BACKCOURT_JUMP', 'STANDING', 'WING'].includes(shot.kind)).length / Math.max(1, all.attempts), transitionShare: diagnostics.transition.shots / Math.max(1, all.attempts), meanShotDistance: diagnostics.shotGroups.ALL.distance.mean,
    managerGoals: result[managerTeam === 'HOME' ? 'homeGoals' : 'awayGoals'], managerGoalsAgainst: result[managerTeam === 'HOME' ? 'awayGoals' : 'homeGoals'], controlledPostTicks: diagnostics.control.controlledPostTicks, controlErrors: diagnostics.control.errors, shotOriginErrors: diagnostics.control.shotOriginErrors, runtimeMs };
  const record = { ...recipe, fixture, canonicalSeed: core.seed, complete: true, managerTeam, behaviorRevision: session.behaviorRevision ?? null, numerical, diagnostics,
    initialPeople: initial.people, initialProfiles: initial.core.players.map(p => ({ id: p.id, team: p.team, role: p.role, profile: p.profile })), initialTactics: initial.core.coaching,
    finalLoad: core.players.map(p => ({ id: p.id, team: p.team, role: p.role, minutes: p.condition.courtMs / 60000, energy: p.condition.energy, distance: p.condition.distanceMetres })), result,
    initialSessionHash, finalCoreHash: hash(JSON.stringify(core)), resultHash: hash(JSON.stringify(result)), truthHash: hash(JSON.stringify({ score: core.score, events: core.events, rng: core.rng, frames: session.frames })) };
  write(`match-${String(recipe.index).padStart(3, '0')}.json`, record);
  console.log(JSON.stringify({ index: recipe.index, variant, score: `${result.homeGoals}-${result.awayGoals}`, shots: all.attempts, possessions: book.attacks, transitions: diagnostics.transition.shots, whistles: diagnostics.contact.contactWhistles, runtimeMs: Math.round(runtimeMs) }));
  return record;
}

const matches = recipes.map(runOne);
const keys = Object.keys(matches[0].numerical) as (keyof typeof matches[number]['numerical'])[];
const distributions = Object.fromEntries(keys.map(key => [key, distribution(matches.map(m => m.numerical[key]))]));
const groupNames = [...new Set(matches.flatMap(m => Object.keys(m.diagnostics.shotGroups)))];
const shotGroups = Object.fromEntries(groupNames.map(name => {
  const groups = matches.map(m => m.diagnostics.shotGroups[name]).filter(Boolean);
  const attempts = groups.reduce((n, g) => n + g.attempts, 0), goals = groups.reduce((n, g) => n + g.goals, 0), saves = groups.reduce((n, g) => n + g.saves, 0);
  return [name, { attempts, goals, saves, misses: groups.reduce((n, g) => n + g.misses, 0), blocks: groups.reduce((n, g) => n + g.blocks, 0), conversion: attempts ? goals / attempts : null, savePctOnTarget: saves + goals ? saves / (saves + goals) : null, saveShareAllAttempts: attempts ? saves / attempts : null }];
}));
const aggregate = { format: 1, sourceHead, sampleSize: matches.length, startedAt, finishedAt: new Date().toISOString(), inputsHash: hash(JSON.stringify(inputs)), variant, sourceFingerprintsStableDuringBatch: JSON.stringify(sourceFingerprints) === JSON.stringify(fingerprint()),
  totalRuntimeMs: performance.now() - started, canonicalPath: 'Actual career constructor/start/advance with read-only post-tick observer; no competing simulation.',
  distributions, shotGroups, terminalCounts: matches.reduce<Record<string, number>>((sum, match) => { for (const [key, value] of Object.entries(match.diagnostics.terminalCounts)) sum[key] = (sum[key] ?? 0) + value; return sum; }, {}),
  transitionSources: matches.reduce<Record<string, number>>((sum, match) => { for (const [key, value] of Object.entries(match.diagnostics.transition.sources)) sum[key] = (sum[key] ?? 0) + value; return sum; }, {}),
  definitions: matches[0].diagnostics.definitions,
  experimentPolicy: 'Variants change only cloned in-memory actual gameplay attributes or canonical live manager tactics; canonical player files, IDs, CA/PA and pinned input files remain unchanged. Baseline defaults otherwise retain manual manager coaching and normal CPU coaching.',
};
write('aggregate.json', aggregate);
write('matches-summary.json', matches.map(match => ({ index: match.index, saveSeed: match.saveSeed, managerClubId: match.managerClubId, canonicalSeed: match.canonicalSeed, fixture: match.fixture, variant: match.variant, complete: match.complete, numerical: match.numerical, initialSessionHash: match.initialSessionHash, finalCoreHash: match.finalCoreHash, resultHash: match.resultHash, truthHash: match.truthHash })));
console.log(JSON.stringify({ complete: true, sampleSize: matches.length, out, totalRuntimeMs: Math.round(aggregate.totalRuntimeMs) }));
