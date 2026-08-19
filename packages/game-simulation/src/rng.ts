/**
 * Deterministic seeded PRNG (mulberry32) -- framework-free, no
 * dependency on Math.random anywhere in this package. Given the same
 * numeric seed, `nextFloat()` calls in the same order always produce
 * the same sequence. This is the single source of randomness the Fast
 * Match Engine uses, so a match seeded from (save seed + fixture id) is
 * fully reproducible (see matchEngine.ts and the HM-GAME-0.2A report's
 * determinism section for why that specific derivation was chosen).
 */
export type Rng = {
  /** Uniform float in [0, 1). */
  nextFloat: () => number;
  /** Uniform integer in [min, max] inclusive. */
  nextInt: (min: number, max: number) => number;
  /** True with probability `p` (0-1). */
  chance: (p: number) => boolean;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  function nextFloat(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextInt(min: number, max: number): number {
    return Math.floor(nextFloat() * (max - min + 1)) + min;
  }

  function chance(p: number): boolean {
    return nextFloat() < p;
  }

  return { nextFloat, nextInt, chance };
}

/**
 * Deterministically derives a 32-bit numeric seed from a string (e.g.
 * `${saveSeed}:${fixtureId}`) using a simple FNV-1a hash -- stable
 * across runs/platforms, no external dependency.
 */
export function seedFromString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Box-Muller normal sample using the given Rng, clamped to [min, max]. */
export function nextGaussian(rng: Rng, mean: number, stdDev: number, min: number, max: number): number {
  const u1 = Math.max(rng.nextFloat(), 1e-9);
  const u2 = rng.nextFloat();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(min, Math.min(max, mean + z * stdDev));
}
