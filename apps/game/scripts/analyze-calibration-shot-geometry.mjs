/** Stored release rays and keeper body geometry; no simulation or RNG. */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
const args = process.argv.slice(2), option = (key, fallback) => { const at = args.indexOf(key); return at < 0 ? fallback : args[at + 1]; };
const sample = resolve(option('--sample', '../../docs/match-realism-v21/pilot-commitment-1'));
const category = option('--category', 'PIVOT');
const out = resolve(option('--out', join(sample, '..', 'stage-review', 'commitment-geometry')));
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
function distribution(values) {
  const xs = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  const q = f => { if (!xs.length) return null; const at = (xs.length - 1) * f, lo = Math.floor(at), hi = Math.ceil(at); return xs[lo] + (xs[hi] - xs[lo]) * (at - lo); };
  return { n: xs.length, mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, median: q(.5), p10: q(.1), p90: q(.9), min: xs[0] ?? null, max: xs.at(-1) ?? null };
}
const shots = readdirSync(sample).filter(name => /^match-\d+\.json$/.test(name)).flatMap(name => {
  const match = read(join(sample, name));
  if (!match.complete) throw new Error(`Incomplete recorded match ${name}`);
  return match.diagnostics.shots.filter(shot => shot.kind === category).map(shot => {
    const origin = { x: shot.execution.x, y: shot.execution.y }, keeper = shot.keeper?.position, aim = shot.aim;
    const t = keeper && aim && aim.y !== origin.y ? (keeper.y - origin.y) / (aim.y - origin.y) : null;
    const rayX = t === null ? null : origin.x + (aim.x - origin.x) * t;
    const intendedRayX = t === null || typeof shot.execution.intendedAimX !== 'number' ? null : origin.x + (shot.execution.intendedAimX - origin.x) * t;
    const readFacts = shot.keeperFacts?.filter(event => event.type === 'KEEPER_FLIGHT_READ') ?? [];
    const saveFacts = shot.keeperFacts?.filter(event => event.type.startsWith('SAVE_')) ?? [];
    return { index: match.index, seed: match.canonicalSeed, ...shot, rayAtReleaseKeeperDepth: { origin, keeper, aim, fractionOfGoalFlight: t, actualCrossingX: rayX, actualBodySeparation: rayX === null ? null : Math.abs(rayX - keeper.x), intendedCrossingX: intendedRayX, intendedBodySeparation: intendedRayX === null ? null : Math.abs(intendedRayX - keeper.x) }, readFacts, saveFacts };
  });
});
const ratio = (a, b) => b ? a / b : null;
function summarize(rows) {
  const goals = rows.filter(row => row.goal).length, saves = rows.filter(row => row.saved && !row.goal).length;
  const result = subset => ({ attempts: subset.length, actualRayBodySeparation: distribution(subset.map(row => row.rayAtReleaseKeeperDepth.actualBodySeparation)), intendedRayBodySeparation: distribution(subset.map(row => row.rayAtReleaseKeeperDepth.intendedBodySeparation)), opportunityQuality: distribution(subset.map(row => row.opportunityQuality)), pressure: distribution(subset.map(row => row.pressure)) });
  return { attempts: rows.length, goals, saves, blocks: rows.filter(row => row.blocked).length, misses: rows.filter(row => row.missed).length, conversion: ratio(goals, rows.length), savePctOnTarget: ratio(saves, saves + goals), ...result(rows), savedGeometry: result(rows.filter(row => row.saved && !row.goal)), goalGeometry: result(rows.filter(row => row.goal)) };
}
const groups = { ALL: shots, PRESSURE_AT_MOST_0_2: shots.filter(shot => shot.pressure <= .2), PRESSURE_ABOVE_0_2: shots.filter(shot => shot.pressure > .2), OPPORTUNITY_AT_LEAST_0_65: shots.filter(shot => shot.opportunityQuality !== null && shot.opportunityQuality >= .65), OPPORTUNITY_BELOW_0_65: shots.filter(shot => shot.opportunityQuality !== null && shot.opportunityQuality < .65) };
for (const lowPressure of [true, false]) for (const highOpportunity of [true, false]) groups[`PRESSURE_${lowPressure ? 'LOW' : 'PRESENT'}:OPPORTUNITY_${highOpportunity ? 'HIGH' : 'LOWER'}`] = shots.filter(shot => (shot.pressure <= .2) === lowPressure && shot.opportunityQuality !== null && (shot.opportunityQuality >= .65) === highOpportunity);
mkdirSync(out, { recursive: true });
const report = { sampleDirectory: sample, category, groups: Object.fromEntries(Object.entries(groups).map(([name, rows]) => [name, summarize(rows)])), shots,
  definitions: { geometry: 'Actual released ray is projected to the keeper body depth observed at release, and horizontal separation is measured there. Intended committed target is projected separately to remove placement spread. This is a release snapshot, not later moving-body/catch geometry and not a capture-radius acceptance quota.', context: 'Pressure at most0.2 and independent opportunityQuality0.65 are descriptive diagnostic cuts. Categories and actual execution remain unchanged. Saved and goal subgroups are retained separately.', baseline: 'Earlier pilots lack committed target/keeper fact metadata; their release execution geometry remains available where recorded. Missing fields are unavailable rather than inferred from a future result.' } };
writeFileSync(join(out, `${category.toLowerCase()}-geometry.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ category, sample, groups: Object.fromEntries(Object.entries(report.groups).map(([name, group]) => [name, { n: group.attempts, goals: group.goals, saves: group.saves, conversion: group.conversion, actualRaySeparationMean: group.actualRayBodySeparation.mean, intendedRaySeparationMean: group.intendedRayBodySeparation.mean }])) }));
