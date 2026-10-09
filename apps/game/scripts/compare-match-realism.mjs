/** Compare recorded canonical samples. No simulation and no outcome rewriting. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
const [beforeArg, afterArg, outputArg] = process.argv.slice(2);
if (!beforeArg || !afterArg) throw new Error('Usage: node scripts/compare-match-realism.mjs BEFORE_DIR AFTER_DIR [OUTPUT_DIR]');
const beforeDir = resolve(beforeArg), afterDir = resolve(afterArg), outputDir = resolve(outputArg ?? join(afterDir, '..'));
const read = (dir, name) => JSON.parse(readFileSync(join(dir, name), 'utf8').replace(/^\uFEFF/, ''));
const before = read(beforeDir, 'aggregate.json'), after = read(afterDir, 'aggregate.json');
const beforeSeeds = read(beforeDir, 'seed-set.json'), afterSeeds = read(afterDir, 'seed-set.json');
if (JSON.stringify(beforeSeeds) !== JSON.stringify(afterSeeds)) throw new Error('Seed recipes differ; this is not a paired comparison');
if (before.inputsHash !== after.inputsHash) throw new Error('Input snapshots differ; this is not a paired comparison');
const fixed = (n, percent = false) => n == null ? 'unavailable' : `${(n * (percent ? 100 : 1)).toFixed(percent ? 1 : 2)}${percent ? '%' : ''}`;
const metrics = [
  ['possessions', 'Possessions, both teams'], ['homePossessions', 'Home possessions'], ['awayPossessions', 'Away possessions'],
  ['goals', 'Goals, both teams'], ['shots', 'Shot attempts'], ['goalsPerPossession', 'Goals / possession', true],
  ['meanPossessionOfficialSeconds', 'Mean possession recorded span, seconds'], ['passesPerPossession', 'Completed passes / possession'],
  ['backcourtShare', 'Backcourt jump + standing share', true], ['wingShare', 'Wing category share', true], ['closeShare', 'Other close/category share', true],
  ['turnoverEndings', 'Turnover ending count (career result)'], ['nonShotLoss', 'Losses without shot (ledger)'], ['saves', 'Goalkeeper save events'],
  ['savePctOnTarget', 'Save %: saves / (saves + goals)', true], ['saveShareAllAttempts', 'Save events / all attempts', true],
  ['transitionShots', 'Transition shot attempts'], ['transitionGoals', 'Transition goals'], ['transitionShare', 'Transition shot share', true],
  ['topScorerShare', 'Mean per-team top scorer share', true], ['scorerHHI', 'Mean per-team scorer HHI'], ['sevenMetres', '7m attempts'], ['suspensions', 'Suspensions + disqualifications'],
  ['fouls', 'Fouls'], ['meanShotDistance', 'Mean release distance, metres'], ['runtimeMs', 'Canonical simulation time, ms'],
];
const comparisons = metrics.map(([metric, title, percent]) => ({ metric, title, percent: Boolean(percent), before: before.distributions[metric], after: after.distributions[metric] }));
const table = comparisons.map(row => {
  const a = row.before, b = row.after;
  const span = d => `${fixed(d.p10, row.percent)}–${fixed(d.p90, row.percent)}`;
  const range = d => `${fixed(d.min, row.percent)}–${fixed(d.max, row.percent)}`;
  return `| ${row.title} | ${fixed(a.mean, row.percent)} / ${fixed(a.median, row.percent)} | ${span(a)} | ${range(a)} | ${fixed(b.mean, row.percent)} / ${fixed(b.median, row.percent)} | ${span(b)} | ${range(b)} |`;
});
const matches = dir => readdirSync(dir).filter(name => /^match-\d+\.json$/.test(name)).sort().map(name => read(dir, name));
function geography(sample) {
  const shots = sample.flatMap(m => m.shots);
  const count = threshold => shots.filter(s => s.distance >= threshold).length;
  const goals = threshold => shots.filter(s => s.distance >= threshold && s.goal).length;
  return { attempts: shots.length, beyond15m: count(15), beyond15mGoals: goals(15), beyond20m: count(20), beyond20mGoals: goals(20),
    goals: shots.filter(s => s.goal).length, savedAttempts: shots.filter(s => s.saved).length,
    blockedAttempts: shots.filter(s => s.blocked).length, missesNeitherSavedNorBlocked: shots.filter(s => !s.goal && !s.saved && !s.blocked).length,
    categoryCounts: sample.reduce((sum, m) => { for (const [key, value] of Object.entries(m.shotCategories)) sum[key] = (sum[key] ?? 0) + value; return sum; }, {}),
    shooterPositionCounts: sample.reduce((sum, m) => { for (const [key, value] of Object.entries(m.shooterPositions)) sum[key] = (sum[key] ?? 0) + value; return sum; }, {}),
  };
}
const afterMatches = matches(afterDir);
const geographyComparison = { before: geography(matches(beforeDir)), after: geography(afterMatches),
  note: '15m and 20m diagnostic cutoffs identify very long range and halfway releases; these are observational engineering labels, not empirical rate targets.' };
const representativeDistance = match => ['goals', 'possessions', 'backcourtShare', 'nonShotLoss'].reduce((n, key) => {
  const d = after.distributions[key]; return n + Math.abs(match.numerical[key] - d.median) / Math.max(.001, d.p90 - d.p10);
}, 0);
const representative = [...afterMatches].sort((a, b) => representativeDistance(a) - representativeDistance(b) || a.index - b.index)[0];
const closest = [...afterMatches].filter(m => m.index !== representative.index).sort((a, b) => a.numerical.margin - b.numerical.margin || a.index - b.index)[0];
const highScoring = [...afterMatches].filter(m => m.index !== representative.index && m.index !== closest?.index).sort((a, b) => b.numerical.goals - a.numerical.goals || a.index - b.index)[0];
const humanQa = [['REPRESENTATIVE', representative], ['NATURALLY_CLOSEST', closest], ['HIGH_SCORING_OR_UNUSUAL', highScoring]].filter(([, m]) => m).map(([purpose, m]) => ({
  purpose, index: m.index, saveSeed: m.saveSeed, canonicalSeed: m.canonicalSeed, managerClubId: m.managerClubId, fixture: m.fixture, homeName: m.homeName, awayName: m.awayName, numerical: m.numerical,
  selection: purpose === 'REPRESENTATIVE' ? 'Nearest joint sample median of goals, possessions, backcourt share and non-shot loss, normalized by p10–p90 spread.' : purpose === 'NATURALLY_CLOSEST' ? 'Smallest naturally observed goal margin among remaining cases; ties by index.' : 'Highest total goals among remaining cases; retained even when undesirable.',
  inspect: 'Inspect actual gap attack, defensive pressure/help and release, pivot/wing availability, shot location, contextual loss, goalkeeper outcome, transition retreat and settled handoff; occurrence must be verified visually, not asserted from selection.',
}));
const comparison = { pairedSeeds: beforeSeeds.length, inputsHash: before.inputsHash, beforeHead: before.sourceHead, afterHead: after.sourceHead, comparisons, geographyComparison, beforeOutliers: before.outliers, afterOutliers: after.outliers, definitions: after.definitions, unavailableMetrics: after.unavailableMetrics };
writeFileSync(join(outputDir, 'comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
writeFileSync(join(outputDir, 'human-qa-matches.json'), JSON.stringify(humanQa, null, 2) + '\n');
writeFileSync(join(outputDir, 'METRICS.md'), `# Canonical career match metrics\n\n${beforeSeeds.length} paired real-career matches before and after. Input snapshot SHA-256: \`${before.inputsHash}\`. Seed recipes are identical.\n\nAll rows are distributions across complete matches, not independent possession samples. Percentile interpolation is linear between sorted observations. The stored per-match records include shot origins, identities, positions, outcomes and canonical possession endings.\n\n| Metric | BEFORE mean / median | BEFORE p10–p90 | BEFORE range | AFTER mean / median | AFTER p10–p90 | AFTER range |\n|---|---:|---:|---:|---:|---:|---:|\n${table.join('\n')}\n\nExisting EHF_ELITE intervals are engineering plausibility bands. They have no cited empirical precision and do not automatically calibrate an Allsvenskan career sample. Being inside a band proves no visual causality. See aggregate.json for every interval and every outside seed.\n\nLong-release diagnostics: BEFORE ${geographyComparison.before.beyond15m}/${geographyComparison.before.attempts} attempts beyond 15m (${geographyComparison.before.beyond15mGoals} goals), including ${geographyComparison.before.beyond20m} beyond 20m (${geographyComparison.before.beyond20mGoals} goals). AFTER ${geographyComparison.after.beyond15m}/${geographyComparison.after.attempts} beyond 15m (${geographyComparison.after.beyond15mGoals} goals), including ${geographyComparison.after.beyond20m} beyond 20m (${geographyComparison.after.beyond20mGoals} goals). These cutoffs describe observed geometry; no required quota is imposed.\n\nDefinitions and limitations are in each aggregate.json. Save percentage is explicitly saves/(saves+goals); misses and blocks are excluded from that denominator. Other attempts comprise CLOSE in the existing reference reader, including 7m and EMPTY_GOAL; it is not a pure six-metre-distance count. Possession duration is the recorded first-to-last official event span. Exact transition attempts without a phase-bearing event and a distinct catch-quality scalar are unavailable in the baseline.\n\nNo outliers were removed. Both aggregate.json files preserve top-five high/low scoring, possession-count, shot-mix and scorer-concentration matches. after/seed-set.json plus inputs.json can reproduce any match via the same canonical career path.\n`);
console.log(JSON.stringify({ pairedSeeds: beforeSeeds.length, outputDir }));
