/** Verify the released v2 checkpoint before v2.1 behavior changes. No simulation. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const referenceDir = resolve(process.argv[2] ?? '../../docs/match-realism-v2/after');
const reproductionDir = resolve(process.argv[3] ?? '../../docs/match-realism-v21/baseline-reproduction');
const indices = (process.argv[4] ?? '0,5,16,18').split(',').map(Number);
const read = (dir, name) => JSON.parse(readFileSync(join(dir, name), 'utf8').replace(/^\uFEFF/, ''));
const referenceAggregate = read(referenceDir, 'aggregate.json');
const oldFingerprints = read(referenceDir, 'source-fingerprints.json');
const equivalence = read(resolve(referenceDir, '..'), 'release-source-equivalence.json');
const approvedCleanup = new Set(equivalence.files.filter(file => file.emittedJsIdentical).map(file => file.path));
const keys = ['initialSessionHash', 'finalCoreHash', 'resultHash', 'truthHash'];
const proofs = indices.map(index => {
  const folder = join(reproductionDir, `case-${String(index).padStart(3, '0')}`);
  const filename = `match-${String(index).padStart(3, '0')}.json`;
  const current = read(folder, filename), original = read(referenceDir, filename), aggregate = read(folder, 'aggregate.json');
  if (!original.complete || !current.complete || !aggregate.sourceFingerprintsStableDuringBatch) throw new Error(`Case ${index} was incomplete or changed source during execution`);
  if (aggregate.inputsHash !== referenceAggregate.inputsHash) throw new Error(`Input hash changed for case ${index}`);
  if (current.saveSeed !== original.saveSeed || current.canonicalSeed !== original.canonicalSeed || JSON.stringify(current.fixture) !== JSON.stringify(original.fixture)) throw new Error(`Input/seed/fixture mismatch for case ${index}`);
  const hashes = Object.fromEntries(keys.map(key => {
    if (!original[key] || current[key] !== original[key]) throw new Error(`${key} differs in case ${index}`);
    return [key, { original: original[key], current: current[key], identical: true }];
  }));
  if (JSON.stringify(current.result) !== JSON.stringify(original.result)) throw new Error(`Derived result differs in case ${index}`);
  const currentFingerprints = read(folder, 'source-fingerprints.json');
  const changed = oldFingerprints.filter(old => currentFingerprints.find(file => file.path === old.path)?.sha256 !== old.sha256).map(file => file.path);
  const added = currentFingerprints.filter(file => !oldFingerprints.some(old => old.path === file.path)).map(file => file.path);
  if (added.length || changed.some(path => !approvedCleanup.has(path))) throw new Error(`Unexplained source fingerprint change for case ${index}: ${[...changed, ...added].join(', ')}`);
  return { index, checkpoint: aggregate.sourceHead, saveSeed: current.saveSeed, canonicalSeed: current.canonicalSeed, score: `${current.result.homeGoals}-${current.result.awayGoals}`, fixture: current.fixture, hashes, documentedLintOnlySourceChanges: changed, identical: true, concurrentRuntimeMs: current.numerical.runtimeMs };
});
const report = { verifiedAt: new Date().toISOString(), allIdentical: true, cases: proofs.length, inputHash: referenceAggregate.inputsHash,
  scope: 'Current released v2 checkpoint reproduced committed AFTER cases exactly on initial session, complete final CoreState, result, score/full events/RNG/all production frames.',
  sourceEquivalence: 'Only previously documented unused-import/compatibility-lint cleanup differs in raw source fingerprints; emitted JavaScript equivalence is retained in v2/release-source-equivalence.json.',
  performance: 'Four cases were launched concurrently and experienced substantial resource contention. Their runtime is not an isolated single-process engine benchmark; later calibration batches run sequentially.', proofs };
writeFileSync(join(reproductionDir, 'reproduction-proof.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(reproductionDir, 'README.md'), `# Released v2 baseline reproduced\n\nAll ${proofs.length} current-checkpoint matches exactly reproduce the committed v2 AFTER evidence on all four truth hashes. No behavior changes preceded this reproduction.\n\n| Index | Canonical seed | Recorded score | Four hashes |\n|---|---:|---:|---|\n${proofs.map(proof => `| ${proof.index} | ${proof.canonicalSeed} | ${proof.score} | Exact equality |`).join('\n')}\n\nInput snapshot SHA-256: \`${report.inputHash}\`. See reproduction-proof.json for complete initial/final/result/event/RNG/frame hashes and source equivalence. The only raw source differences are documented lint cleanup whose emitted JavaScript is identical.\n\nThese four processes ran concurrently, causing substantial resource contention. Do not use their approximately 145–152 second per-match wall times as an isolated engine-performance claim. Future calibration samples run one sequential process. Original v2 baseline, AFTER records and human-QA files remain unchanged.\n`);
console.log(JSON.stringify({ cases: proofs.length, allFourHashesIdentical: true, proof: join(reproductionDir, 'reproduction-proof.json') }));
