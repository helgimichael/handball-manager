/**
 * Neutral ball render state. Deliberately does not import SIM's Ball
 * type (which carries BallFlight -- passerId/receiverId/elapsedSeconds/
 * durationSeconds/speedMetersPerSecond, physics-simulation internals no
 * renderer needs to draw a dot) or FIELD's BoardObject (which has no
 * possession/flight concept at all -- FIELD's ball is a plain positioned
 * scene object with an optional anchor-snap visual offset, a FIELD-only
 * rendering concern; see HM-0.2D report Section 3).
 */

/**
 * Coarse ball status for rendering purposes only (e.g. to decide whether
 * to draw a possession indicator or a flight trail) -- redeclared here
 * rather than importing SIM's BallStatus so this contract does not
 * change shape if SIM's internal status enum changes. Optional: a
 * producer that has no concept of ball status (a static formation
 * diagram, for instance) may omit it entirely.
 */
export type MatchBallStatus = "POSSESSED" | "LOOSE" | "IN_FLIGHT";

export type MatchBallRenderState = {
  /** Meters, canonical convention (see court.ts). */
  readonly x: number;
  readonly y: number;
  readonly status?: MatchBallStatus;
  /** id of the MatchPlayerRenderState currently holding the ball, if any. */
  readonly possessorPlayerId?: string | null;
};
