/** Stored canonical controlled contrasts. Does not execute or alter matches. */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
const args = process.argv.slice(2);
const option = (key, fallback) => { const at = args.indexOf(key); return at < 0 ? fallback : args[at + 1]; };
const baselineDir = resolve(option('--baseline', '../../docs/match-realism-v21/after'));
const experimentsDir = resolve(option('--experiments', '../../docs/match-realism-v21/controlled'));
const out = resolve(option('--out', '../../docs/match-realism-v21'));
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const sample = dir => readdirSync(dir).filter(name => /^match-\d+\.json$/.test(name)).map(name => read(join(dir, name))).sort((a, b) => a.index - b.index);
const baseline = sample(baselineDir), baselineAggregate = read(join(baselineDir, 'aggregate.json'));
const source = dir => JSON.stringify(read(join(dir, 'source-fingerprints.json')));
const baselineSource = source(baselineDir);
const ratio = (a, b) => b ? a / b : null;
function distribution(values) {
  const xs = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  const q = f => { if (!xs.length) return null; const at = (xs.length - 1) * f, lo = Math.floor(at), hi = Math.ceil(at); return xs[lo] + (xs[hi] - xs[lo]) * (at - lo); };
  return { n: xs.length, mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, median: q(.5), p10: q(.1), p90: q(.9), min: xs[0] ?? null, max: xs.at(-1) ?? null };
}
const mean = values => distribution(values).mean;
function metrics(match) {
  const own = match.diagnostics.shots.filter(shot => shot.team === match.managerTeam), opponent = match.diagnostics.shots.filter(shot => shot.team !== match.managerTeam);
  const ownGoals = own.filter(shot => shot.goal).length, opponentGoals = opponent.filter(shot => shot.goal).length, ownKeeperSaves = opponent.filter(shot => shot.saved && !shot.goal).length;
  const possessions = match.diagnostics.terminals.filter(record => record.team === match.managerTeam);
  const ownContributions = match.result[match.managerTeam === 'HOME' ? 'homePlayerContributions' : 'awayPlayerContributions'];
  const ownLoad = match.finalLoad?.filter(player => player.team === match.managerTeam && player.role !== 'GK');
  return { ownGoals, opponentGoals, ownShots: own.length, ownConversion: ratio(ownGoals, own.length), ownPossessions: possessions.length,
    ownPassesPerPossession: ratio(possessions.reduce((n, row) => n + row.passes, 0), possessions.length), ownLossEndings: possessions.filter(row => row.lossClass).length,
    ownPassingLossEndings: possessions.filter(row => ['INTERCEPTION', 'RECEPTION_FAILED', 'BAD_PASS_OUT'].includes(row.ending)).length,
    ownMeanOpportunityQuality: mean(own.map(shot => shot.opportunityQuality)), ownMeanPressure: mean(own.map(shot => shot.pressure)), ownMeanShotDistance: mean(own.map(shot => shot.distance)),
    ownBackcourtShare: ratio(own.filter(shot => ['BACKCOURT_JUMP', 'STANDING'].includes(shot.kind)).length, own.length), ownWingShare: ratio(own.filter(shot => shot.kind === 'WING').length, own.length), ownPivotShare: ratio(own.filter(shot => shot.kind === 'PIVOT').length, own.length), ownNearSixMetreShare: ratio(own.filter(shot => shot.kind !== 'SEVEN_METRE' && shot.areaClearance <= 1.5).length, own.length),
    ownTransitionShots: own.filter(shot => shot.phase === 'TRANSITION').length, ownTransitionGoals: own.filter(shot => shot.phase === 'TRANSITION' && shot.goal).length, ownTransitionLiveAdvanceMetres: mean(own.filter(shot => shot.phase === 'TRANSITION').map(shot => shot.transition?.advancedMetresInLiveTransition)),
    ownTopScorerShare: ratio(Math.max(0, ...ownContributions.map(player => player.goals)), ownGoals), opponentShots: opponent.length, opponentMeanPressure: mean(opponent.map(shot => shot.pressure)), opponentMeanOpportunityQuality: mean(opponent.map(shot => shot.opportunityQuality)), ownKeeperSavePctOnTarget: ratio(ownKeeperSaves, ownKeeperSaves + opponentGoals), ownKeeperSaveShareAllAttempts: ratio(ownKeeperSaves, opponent.length),
    ownMeanFinalFieldEnergy: ownLoad ? mean(ownLoad.filter(player => player.minutes > 0).map(player => player.energy)) : null, ownTotalFieldDistance: ownLoad ? ownLoad.reduce((n, player) => n + player.distance, 0) : null };
}
const startingLineup = match => JSON.stringify(match.initialPeople.filter(person => person.started).map(person => [person.id, person.team, person.role]).sort((a, b) => a[0].localeCompare(b[0])));
const contrasts = [];
for (const entry of readdirSync(experimentsDir, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
  const dir = join(experimentsDir, entry.name), names = readdirSync(dir);
  if (!names.includes('aggregate.json') || !names.some(name => /^match-\d+\.json$/.test(name))) continue;
  const current = sample(dir), aggregate = read(join(dir, 'aggregate.json'));
  if (!aggregate.sourceFingerprintsStableDuringBatch || source(dir) !== baselineSource) throw new Error(`Controlled source mismatch at ${entry.name}`);
  if (aggregate.inputsHash !== baselineAggregate.inputsHash) throw new Error(`Pinned input mismatch at ${entry.name}`);
  const pairs = current.map(match => {
    const old = baseline.find(record => record.index === match.index);
    if (!old || !match.complete || !old.complete || old.canonicalSeed !== match.canonicalSeed || old.saveSeed !== match.saveSeed || JSON.stringify(old.fixture) !== JSON.stringify(match.fixture) || old.managerTeam !== match.managerTeam) throw new Error(`Canonical pair mismatch at ${entry.name}:${match.index}`);
    const before = metrics(old), after = metrics(match);
    return { index: match.index, seed: match.canonicalSeed, startingLineupIdentical: startingLineup(old) === startingLineup(match), before, after, delta: Object.fromEntries(Object.keys(before).map(key => [key, before[key] === null || after[key] === null ? null : after[key] - before[key]])) };
  });
  const keys = Object.keys(pairs[0].before);
  contrasts.push({ variant: aggregate.variant, directory: dir, n: pairs.length, sourceIdentical: true, inputIdentical: true, startingLineupsIdentical: pairs.every(pair => pair.startingLineupIdentical), pairs,
    metrics: Object.fromEntries(keys.map(key => [key, { before: distribution(pairs.map(pair => pair.before[key])), after: distribution(pairs.map(pair => pair.after[key])), pairedDelta: distribution(pairs.map(pair => pair.delta[key])) }])) });
}
if (!contrasts.length) throw new Error('No completed controlled contrasts exist. Do not write a fabricated experiment report.');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'controlled-comparison.json'), JSON.stringify({ baselineDirectory: baselineDir, inputsHash: baselineAggregate.inputsHash, contrasts,
  definitions: { comparison: 'Canonical fixed recipe, source, manager side and lineup are checked; each variant is compared only with its corresponding baseline subset, not the full100 aggregate.', tactics: 'Own attack metrics describe orientation/tempo. Opponent pressure/chance and own keeper metrics describe changed own defence. Score alone cannot prove the intended tactical mechanism.', capability: 'Variants alter cloned existing capability attributes, preserving real source data and CA/PA. RUNNER is a composite speed/agility/explosiveness/endurance contrast; PASSER includes handling/read/composure. Whole-match responses include physical feedback and CPU coaching, not isolated shot probability.', lineup: 'If actual starting IDs/roles changed, startingLineupsIdentical is false and this must not be described as an isolated same-lineup attribute experiment.', statistics: 'Each row preserves mean/median/p10/p90/range plus paired change. Deterministic finite seed contrasts are not an empirical league census or evidence that every strong player wins every seed.', energy: 'Final energy includes actual minutes and substitutions; compare court-time/load alongside it. No attribution of universal second-half collapse is made from energy alone.' } }, null, 2) + '\n');
const keyMetrics = ['ownGoals', 'ownShots', 'ownMeanOpportunityQuality', 'ownMeanPressure', 'ownPassesPerPossession', 'ownPassingLossEndings', 'ownWingShare', 'ownPivotShare', 'ownTransitionShots', 'opponentGoals', 'opponentMeanPressure', 'ownKeeperSavePctOnTarget'];
const format = number => number === null ? 'unavailable' : number.toFixed(3);
const rows = contrasts.flatMap(contrast => keyMetrics.map(key => `| ${contrast.variant} | ${contrast.n} | ${key} | ${format(contrast.metrics[key].before.mean)} | ${format(contrast.metrics[key].after.mean)} | ${format(contrast.metrics[key].pairedDelta.mean)} | ${contrast.startingLineupsIdentical} |`));
writeFileSync(join(out, 'CONTROLLED.md'), `# Canonical controlled contrasts\n\nThese are deterministic same-recipe comparisons with the corresponding BASELINE subset. Positive and unfavorable responses are both retained. Ratios are fractions in this compact table. Full per-case and delta distributions are in controlled-comparison.json.\n\n| Variant | Pairs | Metric | Baseline mean | Variant mean | Mean paired delta | Same starting IDs/roles |\n|---|---:|---|---:|---:|---:|---|\n${rows.join('\n')}\n\nOrientation/tempo changes are assessed on own attack. Own defence changes are assessed through the opponent's pressure/chance and own saves. Capability variants are composite physical skill contrasts. No score, shot-category or save quota is inferred. A changed starting lineup must be disclosed; weak sample support and unfavorable signs must remain visible.\n`);
console.log(JSON.stringify({ contrasts: contrasts.length, pairs: contrasts.map(contrast => ({ variant: contrast.variant, n: contrast.n })), out }));
