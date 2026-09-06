/**
 * MATCH-EXPERIENCE-2.0 M1: deterministic randomness for the possession loop.
 *
 * mulberry32, the same algorithm and the same contract the manager game's own
 * simulation RNG already uses -- reimplemented here rather than imported
 * because this package deliberately has no dependency on the legacy
 * scoreline-generating engine. Given the same seed, the same sequence of calls
 * always produces the same numbers, which is what makes a possession trace
 * reproducible. Nothing in this package may ever call Math.random.
 */
export type PossessionRng = {
  /** Uniform float in [0, 1). */
  readonly nextFloat: () => number;
  /** Uniform integer in [min, max], inclusive. */
  readonly nextInt: (min: number, max: number) => number;
  /** True with probability `p`. */
  readonly chance: (p: number) => boolean;
};

/** Derives a numeric seed from any string, so callers can seed from a fixture/possession id. */
export function seedFromString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createPossessionRng(seed: number): PossessionRng {
  let state = seed >>> 0;

  function nextFloat(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    nextFloat,
    nextInt: (min: number, max: number) => min + Math.floor(nextFloat() * (max - min + 1)),
    chance: (p: number) => nextFloat() < p,
  };
}
