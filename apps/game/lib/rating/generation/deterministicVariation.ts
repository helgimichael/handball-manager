// HM-RATINGS-0.4 Part D: deterministic, seeded, BOUNDED variation so
// players with otherwise-identical sparse evidence don't all become
// clones -- while the same playerId + seed inputs always reproduce the
// exact same output. Deliberately NOT Math.random(): a hash of the seed
// key is the only source of "randomness", so generation stays pure and
// reproducible across runs/machines.
function hashSeed(seedKey: string): number {
  // FNV-1a 32-bit -- small, fast, well-distributed, no dependency.
  let h = 0x811c9dc5;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic integer offset in [-magnitude, magnitude] (inclusive),
 * derived purely from `seedKey`. Callers key the seed on
 * `playerId:attribute:modelVersion` (or similar) so variation is stable
 * per player/attribute/model-version and differs between players who
 * otherwise share identical inputs.
 */
export function seededOffset(seedKey: string, magnitude: number): number {
  if (magnitude <= 0) return 0;
  const span = magnitude * 2 + 1;
  return (hashSeed(seedKey) % span) - magnitude;
}
