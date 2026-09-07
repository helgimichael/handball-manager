/**
 * MATCH-EXPERIENCE-2.0: the two clocks, and the one constant that relates them.
 *
 *   simulationTime      the spatial engine's own fixed-step seconds -- real
 *                       metres at real speeds, what a replay plays back.
 *   matchClockSeconds   the official 0..1800 clock within each half, what a
 *                       score sheet, a suspension and a UI show.
 *
 * They are not the same quantity, because the micro-simulation resolves an
 * attack faster than a real possession takes. This module exists so that both
 * the match runner (which owns the official clock) and the game-flow layer
 * (which has to know when a two-minute suspension expires) convert between them
 * through ONE definition rather than two that can drift apart.
 *
 * MATCH_PACING_FACTOR remains an explicit provisional pacing constant, not a
 * calibrated figure.
 */

/** How much official match clock one simulated second costs. */
export const MATCH_PACING_FACTOR = 5;

/** Official match seconds consumed by `simulatedSeconds` of spatial simulation. */
export function officialSecondsFor(simulatedSeconds: number): number {
  return simulatedSeconds * MATCH_PACING_FACTOR;
}
