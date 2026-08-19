/**
 * Neutral player render state. Deliberately does not import from
 * @handball-manager/handball-engine's Player type (which carries
 * MovementProfile, velocity, PlayerIntent -- simulation internals no
 * renderer needs) or from @handball-manager/match-renderer's BoardObject
 * type (a FIELD-specific scene-graph shape with anchorPoint/label/
 * coneColor/formationLayer fields that make no sense outside FIELD's own
 * editor). This type exists so neither package needs to know the other
 * exists.
 */

/**
 * Which team a player belongs to. Named after SIM's own vocabulary
 * (domain/handball/player.ts's TeamId) since SIM is the eventual source
 * of truth for match state, but redeclared locally rather than imported
 * -- the contract must survive SIM renaming or restructuring its own
 * internal TeamId without a ripple effect here.
 */
export type MatchSide = "ATTACK" | "DEFENSE";

/**
 * Coarse rendering category. NOT the same thing as SIM's fine-grained
 * PlayerRole (LEFT_WING, L1, etc.) -- a renderer generally only needs to
 * know "is this the goalkeeper or a field player" to pick a shape/size,
 * the same distinction FIELD's own BoardObjectType draws (GOALKEEPER
 * gets a square, everyone else gets their side's shape). Finer role
 * detail, if a renderer wants it, can travel as an opaque label instead
 * of a typed enum here (see MatchPlayerRenderState.roleLabel) so this
 * contract doesn't have to be kept in lockstep with SIM's specific role
 * taxonomy.
 */
export type MatchPlayerKind = "FIELD_PLAYER" | "GOALKEEPER";

export type MatchPlayerRenderState = {
  readonly id: string;
  readonly side: MatchSide;
  readonly kind: MatchPlayerKind;
  /** Meters, canonical convention (see court.ts). */
  readonly x: number;
  readonly y: number;
  /**
   * Facing direction in degrees, canonical convention: 0 = facing the
   * TOP goal (toward -y), increasing clockwise -- matching FIELD's own
   * BoardObject.rotation convention (see HM-0.2D report Section 3), so a
   * future FIELD-side adapter can pass this straight through without
   * reinterpretation. null when the render state carries no meaningful
   * facing (e.g. a source system that has no orientation data at all).
   */
  readonly orientationDegrees: number | null;
  /**
   * Optional opaque label for finer role detail (e.g. "LEFT_WING",
   * "L1") that a renderer MAY use for a tooltip/legend but must not be
   * required to interpret -- kind is the only field a minimal renderer
   * needs to draw a correct shape.
   */
  readonly roleLabel?: string;
};
