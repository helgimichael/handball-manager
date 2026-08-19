import type { CanonicalCourtView, CanonicalGoalSide } from "./court";
import type { MatchPlayerRenderState } from "./player";
import type { MatchBallRenderState } from "./ball";

/**
 * Court metadata a renderer needs to interpret a snapshot's coordinates
 * correctly -- nothing more. Deliberately excludes FIELD's CourtLine/
 * CourtFill geometry-drawing types (a renderer already knows how to draw
 * a court from CANONICAL_COURT_WIDTH_METERS/CANONICAL_COURT_LENGTH_METERS,
 * it does not need the producer to hand it SVG path data) and excludes
 * SIM's DefenseState/DefensivePolicyResult (tactical internals, not
 * render data).
 */
export type MatchCourtRenderState = {
  readonly view: CanonicalCourtView;
  readonly widthMeters: number;
  readonly lengthMeters: number;
  /** Which goal the ATTACK side is currently driving toward. */
  readonly attackingGoalSide: CanonicalGoalSide;
};

/**
 * One immutable snapshot of match state, in the canonical coordinate
 * convention (court.ts), containing only what a renderer needs to draw
 * one frame. This is the ONLY type the future MatchStateAdapter (SIM
 * side) and the future FIELD-side translation layer are both allowed to
 * depend on -- see HM-0.2D report Section 9. Neither side may import
 * the other's internal types through this contract; if a field feels
 * like it wants to leak a SIM or FIELD internal shape, that is a signal
 * the field does not belong here.
 */
export type MatchRenderSnapshot = {
  /** Seconds, from SIM's HandballState.simulationTime or equivalent. */
  readonly simulationTime: number;
  readonly court: MatchCourtRenderState;
  readonly players: readonly MatchPlayerRenderState[];
  readonly ball: MatchBallRenderState;
};
