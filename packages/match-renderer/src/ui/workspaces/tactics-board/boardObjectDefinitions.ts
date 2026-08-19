/**
 * Central, config-driven registry for board objects -- the ONLY place
 * that maps a BoardObjectType to its visual shape, color and behavior.
 *
 * Color exception (v0.3, deliberate): tactical objects are
 * information-bearing symbols, not general UI chrome -- product direction
 * is that they must NOT follow the rest of STARKVIS's soft/muted palette
 * tokens (--ds-color-error/info/warning are deliberately low-saturation
 * semantic colors shared app-wide for badges/alerts/etc., and reusing them
 * here was too weak against the dark floor). The NEON_* constants below
 * are therefore dedicated, locally-scoped hex values -- not new *global*
 * design tokens (nothing is added to theme/colors.ts or :root), and used
 * NOWHERE outside this one file. This is a one-time, clearly-labeled
 * exception to the "no hardcoded hex" rule that still applies everywhere
 * else in Taktiktavlan.
 *
 * Design intent: adding a new object type (a cone marker, a target zone
 * marker, etc.) should require adding ONE entry here, not new rendering
 * logic. BoardObjectRenderer.tsx contains exactly one switch, and it
 * branches on `shape` (a small, stable set of SVG primitives), never on
 * BoardObjectType -- so the type-to-appearance mapping never spreads
 * across files. If a genuinely new shape primitive is ever needed (e.g.
 * a star), that's the one place to extend; everything else stays
 * declarative.
 *
 * Not built here (deliberately, to avoid speculative abstraction): path/
 * line-based tactical entities (passningslinjer, löpvägar). Those are a
 * different data shape (a sequence of points, not a single position) and
 * belong on their own -- see BoardObject.ts's doc comment for the
 * intended extension seam.
 */

import type { BoardObjectType, ConeColor } from "./scene/BoardObject.ts";

// Dedicated high-saturation "neon" palette for tactical objects ONLY --
// see the file-level comment above for why these deliberately bypass the
// shared --ds-color-error/info/warning tokens. Chosen for maximum hue
// separation (red/blue/yellow) and high lightness against the dark
// (#0A2A2B) floor, verified readable at 100% zoom on FULL_COURT.
const NEON_RED = "#FF1A3C";
const NEON_BLUE = "#12A9FF";
const NEON_YELLOW = "#FFDA00";
const CONE_ORANGE = "#FF8A1C";
const CONE_YELLOW = "#FFD84A";

export type BoardObjectShapeKind = "triangle" | "circle" | "square" | "cone";

export type BoardObjectDefinition = {
  shape: BoardObjectShapeKind;
  stroke: string;
  fill: string;
  glowColor: string;
  // 0 = no visible stroke (e.g. the ball is a flat-filled dot) -- driven
  // by config instead of a second CSS class, so the renderer needs only
  // one shape-styling class for every object type.
  strokeWidth: number;
  physicalSizeMeters: number;
  // v0.4: every player-type object (a coach can meaningfully orient a
  // player, even a circle/square, to indicate facing/movement intent) has
  // supportsRotation: true -- only the ball (no meaningful orientation)
  // stays false. This single flag is the ONLY thing that gates the
  // rotation handle, the Q/E shortcuts, and object.rotation's visual
  // effect -- nothing in the UI hardcodes a specific BoardObjectType to
  // decide rotation eligibility (see RotationHandle usage in
  // MasterCourt.tsx and ToolPanel.tsx).
  supportsRotation: boolean;
};

export const BOARD_OBJECT_DEFINITIONS: Record<BoardObjectType, BoardObjectDefinition> = {
  ATTACKER: {
    shape: "triangle",
    stroke: NEON_RED,
    // A high-opacity core (not the old washed-out 34%) for "en skarp
    // tydlig kärna" -- a small mix toward black keeps it from reading as
    // flat/plastic and gives the "lätt mörk kontrastkant" the spec asks
    // for, without a second stroke/shape.
    fill: `color-mix(in srgb, ${NEON_RED} 80%, black 12%)`,
    glowColor: NEON_RED,
    strokeWidth: 0.08,
    physicalSizeMeters: 0.7,
    supportsRotation: true,
  },
  DEFENDER: {
    shape: "circle",
    stroke: NEON_BLUE,
    fill: `color-mix(in srgb, ${NEON_BLUE} 80%, black 12%)`,
    glowColor: NEON_BLUE,
    strokeWidth: 0.08,
    physicalSizeMeters: 0.5,
    supportsRotation: true,
  },
  GOALKEEPER: {
    shape: "square",
    stroke: NEON_YELLOW,
    fill: `color-mix(in srgb, ${NEON_YELLOW} 80%, black 12%)`,
    glowColor: NEON_YELLOW,
    strokeWidth: 0.08,
    physicalSizeMeters: 0.5,
    supportsRotation: true,
  },
  BALL: {
    shape: "circle",
    // A thin dark contour (rather than strokeWidth: 0) so the ball keeps
    // a crisp edge against light backgrounds (zone fills, the goal-area
    // tint) too, not just the dark floor -- easier to track at a glance.
    // Still uses the shared --ds-color-text/-background tokens (white on
    // near-black) -- the ball is not a "neon" object per the spec, only
    // ATTACKER/DEFENDER/GOALKEEPER are.
    stroke: "var(--ds-color-background)",
    fill: "var(--ds-color-text)",
    glowColor: "var(--ds-color-text)",
    strokeWidth: 0.025,
    physicalSizeMeters: 0.19,
    supportsRotation: false,
  },
  CONE: {
    shape: "cone",
    stroke: "color-mix(in srgb, var(--cone-fill, #FF8A1C) 78%, black 22%)",
    fill: "var(--cone-fill, #FF8A1C)",
    glowColor: "var(--cone-fill, #FF8A1C)",
    strokeWidth: 0.035,
    physicalSizeMeters: 0.4125,
    supportsRotation: false,
  },
};

export function getConeFill(color: ConeColor | undefined): string {
  return color === "YELLOW" ? CONE_YELLOW : CONE_ORANGE;
}

// Selection indicator styling -- deliberately separate from
// BOARD_OBJECT_DEFINITIONS (it applies to any selected object regardless
// of type). Kept small (a fraction of the object's own size, not a fixed
// meter value) so it never dominates the plan the way the old
// radius+0.25 fixed-offset ring did. 1.2 = 20% larger than the object's
// own radius -- within the required ~15-25% range.
export const SELECTION_RING_STROKE = "var(--ds-color-accent)";
export const SELECTION_RING_SIZE_RATIO = 1.2;

// The one shape that carries direction (a triangle apex pointing "up" at
// rotation 0) needs its own geometry helper -- kept here, next to the
// definitions it belongs to, rather than in the generic Geometry layer,
// since it is a board-object rendering concern, not a court/meter
// concern.
export function buildTrianglePoints(centerX: number, centerY: number, sizeMeters: number): string {
  const radius = sizeMeters / 2;
  const points: Array<[number, number]> = [
    [centerX, centerY - radius],
    [centerX + radius * 0.87, centerY + radius * 0.5],
    [centerX - radius * 0.87, centerY + radius * 0.5],
  ];
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}
