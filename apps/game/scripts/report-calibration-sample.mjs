/** Compare stored v2/v21 canonical samples. Never runs or changes a match. */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { goalAreaClearance } from '../../../packages/handball-engine/src/domain/geometry/goalArea.ts';
import { lossClassOf } from '../../../packages/handball-engine/src/v2/core/ledger.ts';
const args = process.argv.slice(2);
const option = (key, fallback) => { const at = args.indexOf(key); return at < 0 ? fallback : args[at + 1]; };
const beforeDir = resolve(option('--before', '../../docs/match-realism-v2/after'));
const afterDir = resolve(option('--after', '../../docs/match-realism-v21/after'));
const out = resolve(option('--out', '../../docs/match-realism-v21'));
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const records = dir => readdirSync(dir).filter(name => name.startsWith('match-') && name.endsWith('.json')).map(name => read(join(dir, name))).sort((a, b) => a.index - b.index);
const before = records(beforeDir), after = records(afterDir);
if (!before.length || !after.length || [...before, ...after].some(match => match.complete !== true)) throw new Error('A comparison requires nonempty complete samples. Incomplete cases must be reported separately.');
const beforeAggregate = read(join(beforeDir, 'aggregate.json')), afterAggregate = read(join(afterDir, 'aggregate.json'));
if (beforeAggregate.inputsHash !== afterAggregate.inputsHash) throw new Error('Recorded input snapshots differ; this is not a paired calibration comparison.');
if (!beforeAggregate.sourceFingerprintsStableDuringBatch || !afterAggregate.sourceFingerprintsStableDuringBatch) throw new Error('A sample changed source bytes while it ran.');
mkdirSync(out, { recursive: true });
function distribution(values) {
  const xs = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  const q = fraction => { if (!xs.length) return null; const at = (xs.length - 1) * fraction, lo = Math.floor(at), hi = Math.ceil(at); return xs[lo] + (xs[hi] - xs[lo]) * (at - lo); };
  return { n: xs.length, mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, median: q(.5), p10: q(.1), p90: q(.9), min: xs[0] ?? null, max: xs.at(-1) ?? null };
}
const ratio = (a, b) => b ? a / b : null;
const freq = names => names.reduce((sum, key) => { sum[key] = (sum[key] ?? 0) + 1; return sum; }, {});
function shotsOf(match) {
  if (match.diagnostics) return match.diagnostics.shots;
  return match.shots.map(shot => ({ ...shot, kind: shot.category, role: shot.tacticalRole ?? shot.role,
    period: shot.officialMs < 1800000 ? 1 : 2, pressure: Number(shot.details?.pressure ?? 0), quality: shot.details?.decisionQuality ?? null, opportunityQuality: shot.details?.opportunityQuality ?? null,
    areaClearance: goalAreaClearance({ x: shot.localX, y: shot.localY }, 'TOP'), saved: shot.saved && !shot.goal, missed: !shot.goal && !shot.saved && !shot.blocked }));
}
function pooled(shots) {
  const goals = shots.filter(s => s.goal).length, saves = shots.filter(s => s.saved && !s.goal).length, misses = shots.filter(s => s.missed).length;
  const selected = shots.filter(s => s.decision?.context);
  const committed = shots.filter(s => s.committedAim), reads = shots.flatMap(s => s.keeperFacts?.filter(event => event.type === 'KEEPER_FLIGHT_READ') ?? []);
  return { attempts: shots.length, goals, saves, misses, blocks: shots.filter(s => s.blocked).length, conversion: ratio(goals, shots.length), savePctOnTarget: ratio(saves, saves + goals), saveShareAllAttempts: ratio(saves, shots.length), missShare: ratio(misses, shots.length),
    distance: distribution(shots.map(s => s.distance)), pressure: distribution(shots.map(s => s.pressure)), personalEstimate: distribution(shots.map(s => s.quality)), opportunityQuality: distribution(shots.map(s => s.opportunityQuality)),
    placement: distribution(shots.map(s => s.execution?.executionPlacement)), spread: distribution(shots.map(s => s.execution?.executionSpread)), pace: distribution(shots.map(s => s.execution?.releasePace)), aimError: distribution(shots.map(s => s.execution?.aimErrorMetres)), energy: distribution(shots.map(s => s.energy ?? s.details?.executionEnergy)), goalHeight: distribution(shots.map(s => s.goalHeight ?? s.details?.goalHeight)),
    keeperActionAgeMs: distribution(shots.map(s => s.keeper?.action?.ageMs)), keeperAnticipationAgeMs: distribution(shots.map(s => s.keeper?.action?.anticipationAgeMs)),
    commitmentRead: { measuredCommittedAttempts: committed.length, committedToReleaseMs: distribution(committed.map(s => (s.tick - s.committedAim.tick) * 50)), intendedAimChangedAfterCommitMetres: distribution(committed.map(s => Math.abs(s.execution?.intendedAimX - s.committedAim.details.aimX))), anticipatedShots: shots.filter(s => s.keeperFacts?.some(event => event.type === 'KEEPER_ANTICIPATED')).length, releasedFlightReadShots: shots.filter(s => s.keeperFacts?.some(event => event.type === 'KEEPER_FLIGHT_READ')).length, flightReadEvents: reads.length, observedFlightSeconds: distribution(reads.map(event => event.details.observedSeconds)), suppliedReactionSeconds: distribution(reads.map(event => event.details.reactionSeconds)), readsBeforeActualReaction: reads.filter(event => event.details.observedSeconds + 1e-9 < event.details.reactionSeconds).length, repeatedReadsOfSameShot: shots.filter(s => s.keeperFacts?.filter(event => event.type === 'KEEPER_FLIGHT_READ').length > 1).length },
    selectedContext: { measuredAttempts: selected.length, pressure: distribution(selected.map(s => s.decision.context.pressure)), personalEstimate: distribution(selected.map(s => s.decision.context.quality)), opportunityQuality: distribution(selected.map(s => s.decision.context.opportunityQuality)), pressureChangeAtRelease: distribution(selected.map(s => s.pressure - s.decision.context.pressure)), personalEstimateChangeAtRelease: distribution(selected.map(s => s.quality - s.decision.context.quality)), preparationMs: distribution(selected.map(s => (s.tick - s.decision.tick) * 50)) } };
}
function value(match, key) {
  const n = match.numerical;
  if (key === 'possessionSeconds') return n.possessionRateEquivalentSeconds !== undefined ? n.meanPossessionSeconds : n.meanPossessionOfficialSeconds ?? null;
  if (key === 'possessionRateEquivalentSeconds') return n.possessionRateEquivalentSeconds ?? 3600 / n.possessions;
  if (key === 'scorerConcentration') return n.scorerConcentration ?? n.topScorerShare;
  if (key === 'careerTurnovers') return n.careerTurnovers ?? n.turnoverEndings;
  if (key === 'rawFoulEvents') return n.rawFoulEvents ?? match.eventCounts?.FOUL ?? n.fouls ?? null;
  if (key === 'physicalContacts') return n.physicalContacts ?? match.eventCounts?.CONTACT_EXECUTED ?? null;
  if (key === 'advantagePending') return n.advantagePending ?? match.eventCounts?.ADVANTAGE_PENDING ?? null;
  if (key === 'advantageRealized') return n.advantageRealized ?? match.eventCounts?.ADVANTAGE_REALIZED ?? null;
  if (key === 'advantageRecalled') return n.advantageRecalled ?? match.eventCounts?.ADVANTAGE_RECALLED ?? null;
  if (key === 'passes') return n.passes ?? n.passesCompleted ?? null;
  if (key === 'shotConcentration') {
    const shares = [match.result.homePlayerContributions, match.result.awayPlayerContributions].map(players => Math.max(0, ...players.map(p => p.shots)) / Math.max(1, players.reduce((n, p) => n + p.shots, 0)));
    return n.shotConcentration ?? (shares[0] + shares[1]) / 2;
  }
  if (key === 'goalsPerShot') return ratio(n.goals, n.shots);
  if (key === 'backcourtShare') return n.backcourtShare ?? ratio(shotsOf(match).filter(shot => ['BACKCOURT_JUMP', 'STANDING'].includes(shot.kind)).length, n.shots);
  if (key === 'wingShare') return n.wingShare ?? ratio(shotsOf(match).filter(shot => shot.kind === 'WING').length, n.shots);
  if (key === 'closeShare') return n.closeShare ?? ratio(shotsOf(match).filter(shot => !['BACKCOURT_JUMP', 'STANDING', 'WING'].includes(shot.kind)).length, n.shots);
  if (key === 'transitionShare') return n.transitionShare ?? ratio(n.transitionShots, n.shots);
  if (key === 'meanShotDistance') return n.meanShotDistance ?? distribution(shotsOf(match).map(shot => shot.distance)).mean;
  if (key === 'shotOriginErrors') return n.shotOriginErrors ?? n.shotOriginControlErrors ?? null;
  if (key === 'misses') return shotsOf(match).filter(shot => shot.missed).length;
  return n[key] ?? null;
}
const metricNames = ['goals', 'homeGoals', 'awayGoals', 'margin', 'possessions', 'homePossessions', 'awayPossessions', 'possessionSeconds', 'possessionRateEquivalentSeconds', 'passes', 'passesPerPossession', 'shots', 'goalsPerShot', 'meanShotDistance', 'misses', 'blocks', 'backcourtShare', 'wingShare', 'closeShare', 'nonShotLoss', 'careerTurnovers', 'saves', 'savePctOnTarget', 'saveShareAllAttempts', 'scorerConcentration', 'shotConcentration', 'transitionStarts', 'transitionShots', 'transitionGoals', 'transitionShare', 'transitionAbortToSettled', 'physicalContacts', 'contactEpisodes', 'assessedFouls', 'rawFoulEvents', 'advantagePending', 'advantageRealized', 'advantageRecalled', 'contactWhistles', 'freeThrowAwards', 'sevenMetres', 'sevenMetreGoals', 'suspensions', 'shotOriginErrors', 'controlErrors', 'controlledPostTicks', 'runtimeMs'];
function summarize(sample) {
  const shots = sample.flatMap(shotsOf), groups = { ALL: shots };
  const add = (name, shot) => (groups[name] ??= []).push(shot);
  for (const shot of shots) {
    add(`CATEGORY:${shot.kind}`, shot); add(`ROLE:${shot.role}`, shot); add(`HALF:${shot.period}`, shot); add(`TEAM:${shot.team}`, shot);
    add(`PRESSURE:${shot.pressure < .2 ? 'LOW_UNDER_0.2' : 'PRESENT_AT_LEAST_0.2'}`, shot);
    if (shot.quality !== null) add(`PERSONAL_ESTIMATE:${shot.quality >= .65 ? 'HIGH_AT_LEAST_0.65' : 'LOWER_UNDER_0.65'}`, shot);
    if (shot.opportunityQuality !== null) add(`OPPORTUNITY_QUALITY:${shot.opportunityQuality >= .65 ? 'HIGH_AT_LEAST_0.65' : 'LOWER_UNDER_0.65'}`, shot);
    add(`RANGE:${shot.distance <= 8 ? 'UP_TO_8M' : shot.distance <= 10.5 ? '8_TO_10.5M' : 'BEYOND_10.5M'}`, shot);
    if (shot.areaClearance <= 1.5 && shot.kind !== 'SEVEN_METRE') add('CONTEXT:NEAR_SIX_METRE_AREA', shot);
    if (shot.phase === 'TRANSITION') add('CONTEXT:TRANSITION', shot);
  }
  const terminals = sample.flatMap(m => m.diagnostics?.terminals ?? m.possessions.map(t => ({ ...t, period: t.lastOfficialMs < 1800000 ? 1 : 2, lossClass: lossClassOf(t.ending) })));
  const categories = Object.fromEntries(Object.entries(groups).filter(([name]) => name.startsWith('CATEGORY:')).map(([name, entries]) => [name, entries.length / Math.max(1, shots.length)]));
  const transitionShots = sample.flatMap(m => shotsOf(m).filter(s => s.phase === 'TRANSITION'));
  const last = (key, descending = true) => sample.filter(m => value(m, key) !== null).sort((a, b) => (descending ? -1 : 1) * (value(a, key) - value(b, key))).slice(0, 5).map(m => ({ index: m.index, seed: m.canonicalSeed, score: `${m.result.homeGoals}-${m.result.awayGoals}`, value: value(m, key) }));
  const episodes = sample.flatMap(m => m.diagnostics?.transition.episodes ?? []);
  const decisions = shots.filter(shot => shot.decision?.context);
  const restarts = sample.flatMap(m => m.diagnostics?.deadSpots.restartTimings ?? []);
  const sourceGroups = Object.fromEntries([...new Set(episodes.map(e => e.source))].map(source => {
    const rows = episodes.filter(e => e.source === source);
    return [source, { starts: rows.length, releasedShots: rows.reduce((n, row) => n + row.shots.length, 0), goals: rows.reduce((n, row) => n + row.goals, 0), endings: freq(rows.map(row => row.ending)), officialDurationMs: distribution(rows.map(row => row.endOfficialMs - row.startOfficialMs)), heldMs: distribution(rows.map(row => row.heldMs)), firstActionKinds: freq(rows.filter(row => row.firstActions?.length).map(row => row.firstActions[0].kind)) }];
  }));
  return { n: sample.length, distributions: Object.fromEntries(metricNames.map(name => [name, distribution(sample.map(m => value(m, name)))])),
    groups: Object.fromEntries(Object.entries(groups).map(([name, entries]) => [name, pooled(entries)])), categoryShares: categories, terminalCounts: freq(terminals.map(t => t.ending)),
    halves: [1, 2].map(period => ({ period, ...pooled(shots.filter(s => s.period === period)), homeGoals: shots.filter(s => s.period === period && s.team === 'HOME' && s.goal).length, awayGoals: shots.filter(s => s.period === period && s.team === 'AWAY' && s.goal).length, turnovers: terminals.filter(t => t.period === period && t.lossClass).length, periodEvidence: sample.every(m => m.diagnostics) ? 'Post-tick observed period' : 'Official-clock inference for legacy records; protected boundary throws approximate' })),
    decisionToExecution: { measuredAttempts: decisions.length, selectionKinds: freq(decisions.map(shot => shot.decision.kind)), selectionReasons: freq(decisions.map(shot => shot.decision.reason)), selectionQuality: distribution(decisions.map(shot => shot.decision.context.quality)), releaseQuality: distribution(decisions.map(shot => shot.quality)), qualityChange: distribution(decisions.map(shot => shot.quality - shot.decision.context.quality)), selectionPressure: distribution(decisions.map(shot => shot.decision.context.pressure)), releasePressure: distribution(decisions.map(shot => shot.pressure)), preparationMs: distribution(decisions.map(shot => (shot.tick - shot.decision.tick) * 50)) },
    transitionSources: sourceGroups, transitionEndings: freq(episodes.map(e => e.ending)),
    transitionSpatialEvidence: { releasedShots: transitionShots.length, gainToShotMs: distribution(transitionShots.map(s => s.transition?.gainToShotMs)), livePhaseToShotMs: distribution(transitionShots.map(s => s.transition?.phaseToShotMs)), liveAdvanceMetres: distribution(transitionShots.map(s => s.transition?.advancedMetresInLiveTransition)), goalSideDefenders: distribution(transitionShots.map(s => s.geometry?.defendersGoalSide)), pressure: distribution(transitionShots.map(s => s.pressure)) },
    restartTiming: { measuredEpisodes: restarts.length, simulationMs: distribution(restarts.map(row => row.simulationMs)), officialMs: distribution(restarts.map(row => row.officialMs)), byKind: Object.fromEntries([...new Set(restarts.map(row => row.kind))].map(kind => [kind, { episodes: restarts.filter(row => row.kind === kind).length, simulationMs: distribution(restarts.filter(row => row.kind === kind).map(row => row.simulationMs)), officialMs: distribution(restarts.filter(row => row.kind === kind).map(row => row.officialMs)) }])) },
    outliers: { highScoring: last('goals'), lowScoring: last('goals', false), mostPossessions: last('possessions'), highestSaveRate: last('savePctOnTarget'), mostWhistles: last('contactWhistles'), closest: last('margin', false) } };
}
const pairedBefore = before.filter(b => after.some(a => a.index === b.index)), pairedAfter = after.filter(a => before.some(b => b.index === a.index));
for (const old of pairedBefore) {
  const current = pairedAfter.find(m => m.index === old.index);
  if (old.saveSeed !== current.saveSeed || old.managerClubId !== current.managerClubId || old.canonicalSeed !== current.canonicalSeed || JSON.stringify(old.fixture) !== JSON.stringify(current.fixture)) throw new Error(`Pair input recipe mismatch at ${old.index}`);
}
const pairs = pairedBefore.map(old => {
  const current = pairedAfter.find(m => m.index === old.index);
  return { index: old.index, canonicalSeed: old.canonicalSeed, fixture: old.fixture, beforeScore: [old.result.homeGoals, old.result.awayGoals], afterScore: [current.result.homeGoals, current.result.awayGoals], truthHashesEqual: Object.fromEntries(['initialSessionHash', 'finalCoreHash', 'resultHash', 'truthHash'].map(key => [key, old[key] === current[key]])), deltas: Object.fromEntries(metricNames.map(key => [key, value(old, key) === null || value(current, key) === null ? null : value(current, key) - value(old, key)])) };
});
const summary = { beforeDirectory: beforeDir, afterDirectory: afterDir, pairs, before: summarize(before), after: summarize(after), pairedBefore: summarize(pairedBefore), pairedAfter: summarize(pairedAfter),
  definitions: { sample: 'Same recorded canonical recipes paired by index/seed/fixture. Full100 and paired50 are distinct populations.', context: 'Category partitions; other context rows overlap. Scores are option estimates, not calibrated goal probabilities. Pressure0.2 and score0.65 are descriptive bins.', saves: 'Goals have priority over physical keeper touch. Conventional saves/(saves+goals) and all-attempt save share are separate.', unavailableBaseline: 'v2 original records lack exact observer transition starts, continuous contact pairs, explicit whistles and independent opportunityQuality. Their half assignment uses official-clock inference at protected boundaries.', duration: 'Final v21 observed canonical first-to-last event span. Earlier v21 pilot numerical meanPossessionSeconds used3600/attacks and is a rate-equivalent estimate, not independently observed span.', performance: 'Wall times include observer/frame capture and concurrent load; not isolated speedup evidence.' } };
const percentKeys = new Set(['goalsPerShot', 'backcourtShare', 'wingShare', 'closeShare', 'transitionShare', 'savePctOnTarget', 'saveShareAllAttempts', 'scorerConcentration', 'shotConcentration']);
const format = (n, percentage = false) => n === null || n === undefined ? 'unavailable' : `${(n * (percentage ? 100 : 1)).toFixed(2)}${percentage ? '%' : ''}`;
const cells = (d, key) => `${format(d.mean, percentKeys.has(key))} / ${format(d.median, percentKeys.has(key))} | ${format(d.p10, percentKeys.has(key))}–${format(d.p90, percentKeys.has(key))} | ${format(d.min, percentKeys.has(key))}–${format(d.max, percentKeys.has(key))}`;
const rows = metricNames.map(key => `| ${key} | ${cells(summary.pairedBefore.distributions[key], key)} | ${cells(summary.pairedAfter.distributions[key], key)} |`);
const contextNames = ['CONTEXT:NEAR_SIX_METRE_AREA', 'CATEGORY:PIVOT', 'CATEGORY:BREAKTHROUGH', 'CATEGORY:WING', 'CONTEXT:TRANSITION', 'CATEGORY:BACKCOURT_JUMP', 'CATEGORY:STANDING', 'CATEGORY:SEVEN_METRE', 'PRESSURE:LOW_UNDER_0.2', 'PRESSURE:PRESENT_AT_LEAST_0.2', 'PERSONAL_ESTIMATE:HIGH_AT_LEAST_0.65', 'PERSONAL_ESTIMATE:LOWER_UNDER_0.65', 'OPPORTUNITY_QUALITY:HIGH_AT_LEAST_0.65', 'OPPORTUNITY_QUALITY:LOWER_UNDER_0.65', 'RANGE:UP_TO_8M', 'RANGE:8_TO_10.5M', 'RANGE:BEYOND_10.5M'];
const contextRows = contextNames.map(name => { const b = summary.pairedBefore.groups[name], a = summary.pairedAfter.groups[name]; return `| ${name} | ${b?.attempts ?? 0} | ${format(b?.conversion, true)} | ${format(b?.savePctOnTarget, true)} | ${a?.attempts ?? 0} | ${format(a?.conversion, true)} | ${format(a?.savePctOnTarget, true)} |`; });
const fullRows = metricNames.map(key => `| ${key} | ${cells(summary.after.distributions[key], key)} |`);
const fullPopulation = after.length > pairedAfter.length ? `\n\n## Full AFTER population, ${after.length} matches\n\nThis larger population is distinct from the paired ${pairedAfter.length} comparison above.\n\n| Metric | Mean / median | p10-p90 | Range |\n|---|---:|---:|---:|\n${fullRows.join('\n')}` : '';
const halfRows = [['PAIRED BEFORE', summary.pairedBefore], ['PAIRED AFTER', summary.pairedAfter], ...(after.length > pairedAfter.length ? [['FULL AFTER', summary.after]] : [])].flatMap(([name, population]) => population.halves.map(half => `| ${name} | ${half.period} | ${half.attempts} | ${half.goals} | ${format(half.conversion, true)} | ${half.saves} | ${format(half.savePctOnTarget, true)} | ${half.turnovers} |`));
const representativeDistance = match => ['goals', 'possessions', 'nonShotLoss', 'scorerConcentration'].reduce((sum, key) => {
  const d = summary.pairedAfter.distributions[key];
  return sum + Math.abs(value(match, key) - d.median) / Math.max(.001, d.p90 - d.p10);
}, 0);
const representative = [...pairedAfter].sort((a, b) => representativeDistance(a) - representativeDistance(b) || a.index - b.index)[0];
const closest = pairedAfter.filter(m => m.index !== representative?.index).sort((a, b) => a.numerical.margin - b.numerical.margin || a.index - b.index)[0];
const high = pairedAfter.filter(m => ![representative?.index, closest?.index].includes(m.index)).sort((a, b) => b.numerical.goals - a.numerical.goals || a.index - b.index)[0];
const qaSelections = [['REPRESENTATIVE', representative], ['NATURALLY_CLOSEST', closest], ['HIGH_SCORING_OR_UNUSUAL', high]].filter(([, match]) => match).map(([purpose, match]) => {
  const old = pairedBefore.find(m => m.index === match.index);
  return { purpose, index: match.index, saveSeed: match.saveSeed, canonicalSeed: match.canonicalSeed, managerClubId: match.managerClubId, fixture: match.fixture, homeName: match.homeName ?? old.homeName ?? match.fixture.homeClubId, awayName: match.awayName ?? old.awayName ?? match.fixture.awayClubId, numerical: match.numerical,
    selection: purpose === 'REPRESENTATIVE' ? 'Nearest joint paired-sample median of goals, possessions, non-shot losses and mean team top-scorer share, normalized by p10-p90 spread.' : purpose === 'NATURALLY_CLOSEST' ? 'Smallest natural goal margin among remaining paired cases; ties by index.' : 'Highest total goals among remaining paired cases; undesirable extremes are retained.',
    inspect: 'Verify live versus settled transition progress and bodies, actual close/pivot/wing releases, keeper commitment/reach, shot miss/save/block denominator, contact/advantage/actual whistle, second-half opportunity and career report/replay truth.' };
});
writeFileSync(join(out, 'calibration-comparison.json'), JSON.stringify(summary, null, 2) + '\n');
writeFileSync(join(out, 'human-qa-matches.json'), JSON.stringify(qaSelections, null, 2) + '\n');
writeFileSync(join(out, 'METRICS.md'), `# Canonical calibration metrics\n\nPaired population: ${pairedAfter.length} complete fixture/seed recipes. Full AFTER population: ${after.length}. No outliers excluded. Raw per-match source fingerprints and truth hashes remain in the sample directories.\n\n| Metric | BEFORE mean / median | BEFORE p10–p90 | BEFORE range | AFTER mean / median | AFTER p10–p90 | AFTER range |\n|---|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\n| Shot context | BEFORE attempts | BEFORE conversion | BEFORE saves/(goals+saves) | AFTER attempts | AFTER conversion | AFTER saves/(goals+saves) |\n|---|---:|---:|---:|---:|---:|---:|\n${contextRows.join('\n')}${fullPopulation}\n\n## Half outcomes\n\n| Population | Half | Attempts | Goals | Conversion | Saved attempts | Saves/(goals+saves) | Turnover endings |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${halfRows.join('\n')}\n\nOlder BEFORE half assignment uses official-clock inference for protected boundary throws; current AFTER uses observed periods. Contexts overlap and are not a partition. Quality scores are option estimates, not calibrated goal probabilities. Exact source/halves/contact/transition methodology and baseline unavailable fields are recorded in METHODS.md and calibration-comparison.json. The JSON includes the full ${after.length}-match summaries, all contextual distance/pressure/quality/execution distributions, raw terminals, half outcomes, spatial transition evidence and undesirable outliers. Do not substitute raw assessments for whistles or concurrent timing for an isolated speedup.\n`);
console.log(JSON.stringify({ paired: pairedAfter.length, fullAfter: after.length, out }));
