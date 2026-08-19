/**
 * Deterministic seeded PRNG (mulberry32) -- technical infrastructure for
 * the HM-TACTICS-0.5 calibration layer, NOT tactical domain truth (Bible
 * S8/S85: "The random mechanism is technical infrastructure, not
 * tactical domain truth"). Given the same numeric seed, `nextFloat()`
 * calls in the same order always produce the same sequence, so tests
 * never depend on uncontrolled randomness.
 */
export type Rng = {
  /** Uniform float in [0, 1). */
  nextFloat: () => number;
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

  return { nextFloat };
}

/** Deterministically derives a 32-bit numeric seed from a string, e.g. `${seed}:${runIndex}`. */
export function seedFromString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
