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
 * MATCH_PACING_FACTOR IS NOW A MEASURED FIGURE (M13, Calibration 1.0).
 *
 * It was a provisional guess of 5, and 5 was wrong in a way only a finished
 * engine could show. What this constant actually prices is the DEAD TIME the
 * engine does not simulate: the walk back, the referee, the setting up. The
 * spatial part of a possession costs about 8.5 simulated seconds once M6-M12
 * are all running, and at 5 that came to 42 official seconds per possession --
 * so a match held only ~86 possessions and ~40 goals.
 *
 * Senior handball plays roughly 110-120 possessions in sixty minutes, which is
 * about 31-33 official seconds each. 3.7 prices the same simulated possession
 * at 31.4 seconds, and the measured result is 115 possessions and 50 goals.
 * Both were read off the calibration set rather than chosen; the earlier
 * estimate of 4.0 priced it at 34 seconds and left scoring a little short.
 *
 * It is the ONE constant that had to move for volume, because possession
 * volume sets scoring volume and the per-possession rates underneath it were
 * already credible and are untouched: 0.8 shots per possession, 56% shot
 * conversion, 33% of shots on target saved.
 *
 * This is Calibration 1.0, not final realism. It stays a single explicit
 * constant precisely so it can be re-measured rather than compensated for.
 */

/** How much official match clock one simulated second costs. */
export const MATCH_PACING_FACTOR = 3.7;

/** Official match seconds consumed by `simulatedSeconds` of spatial simulation. */
export function officialSecondsFor(simulatedSeconds: number): number {
  return simulatedSeconds * MATCH_PACING_FACTOR;
}

/**
 * Official length of one half, in match-clock seconds.
 *
 * Lives here rather than in matchRunner so the layers below the runner -- the
 * flow layer, and M12's per-half timeout allowance -- can ask which half an
 * official second belongs to without depending on the runner.
 */
export const HALF_LENGTH_SECONDS = 30 * 60;

/** Which half an absolute official second (0..3600) falls in. */
export function halfOf(matchSeconds: number): 1 | 2 {
  return matchSeconds >= HALF_LENGTH_SECONDS ? 2 : 1;
}
