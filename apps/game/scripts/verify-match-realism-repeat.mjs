/** Verifies independently completed canonical repeats without resimulation. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const [sampleArg, repeatArg] = process.argv.slice(2);
if (!sampleArg || !repeatArg) throw new Error('Usage: node scripts/verify-match-realism-repeat.mjs SAMPLE_DIR REPEAT_DIR');
const sampleDir = resolve(sampleArg), repeatDir = resolve(repeatArg);
const read = (dir, name) => JSON.parse(readFileSync(join(dir, name), 'utf8').replace(/^\uFEFF/, ''));
const sampleAggregate = read(sampleDir, 'aggregate.json'), repeatAggregate = read(repeatDir, 'aggregate.json');
if (sampleAggregate.inputsHash !== repeatAggregate.inputsHash) throw new Error('Input snapshot hashes differ');
if (!sampleAggregate.sourceFingerprintsStableDuringBatch || !repeatAggregate.sourceFingerprintsStableDuringBatch) throw new Error('Source changed during one of the recorded runs');
if (JSON.stringify(read(sampleDir, 'source-fingerprints.json')) !== JSON.stringify(read(repeatDir, 'source-fingerprints.json'))) throw new Error('Source byte fingerprints differ');
const sampleSeeds = read(sampleDir, 'seed-set.json'), repeatSeeds = read(repeatDir, 'seed-set.json');
const hashKeys = ['initialSessionHash', 'finalCoreHash', 'resultHash', 'truthHash'];
const proofs = repeatSeeds.map(config => {
  const sampleConfig = sampleSeeds.find(seed => seed.index === config.index);
  if (JSON.stringify(sampleConfig) !== JSON.stringify(config)) throw new Error(`Different seed recipe at index ${config.index}`);
  const name = `match-${String(config.index).padStart(3, '0')}.json`;
  const sample = read(sampleDir, name), repeat = read(repeatDir, name);
  if (!sample.complete || !repeat.complete) throw new Error(`Incomplete match at index ${config.index}`);
  if (sample.canonicalSeed !== repeat.canonicalSeed || JSON.stringify(sample.fixture) !== JSON.stringify(repeat.fixture)) throw new Error(`Fixture or canonical seed changed at index ${config.index}`);
  const hashes = Object.fromEntries(hashKeys.map(key => {
    if (!sample[key] || !repeat[key] || sample[key] !== repeat[key]) throw new Error(`${key} differs at index ${config.index}`);
    return [key, { sample: sample[key], repeat: repeat[key], identical: true }];
  }));
  if (JSON.stringify(sample.result) !== JSON.stringify(repeat.result)) throw new Error(`Result bytes differ at index ${config.index}`);
  return { index: config.index, saveSeed: config.saveSeed, canonicalSeed: sample.canonicalSeed, fixture: sample.fixture, hashes, identical: true };
});
if (proofs.length < 2) throw new Error('At least two independent complete repeats are required for this proof');
const proof = { format: 1, verifiedAt: new Date().toISOString(), sampleSize: sampleAggregate.sampleSize, repeatSize: proofs.length, inputsHash: sampleAggregate.inputsHash,
  scope: 'Same pinned career input, seed/fixture and exact source bytes: initial session, full final CoreState (including condition/profile/actions), derived result, score, complete event stream, persisted RNG and all production observed frames.',
  proofs, allIdentical: true,
  performanceNote: 'Wall-clock diagnostic durations are deliberately outside truth hashes. Runtime comparisons are observational and may reflect concurrent verification, warmup and machine load.',
};
writeFileSync(join(sampleDir, 'repeat-proof.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ repeats: proofs.length, allIdentical: true, proof: join(sampleDir, 'repeat-proof.json') }));
