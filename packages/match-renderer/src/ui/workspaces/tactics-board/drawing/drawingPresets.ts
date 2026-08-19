/**
 * The ONE place a tactical meaning (DrawingIntent) maps to a default
 * appearance and a default geometry shape. This is the "semantic/preset
 * layer" referenced in DrawingObject.ts's file comment -- it runs only at
 * CREATION time (see createDrawingObject), never at render time.
 * DrawingRenderer.tsx never imports this file: by the time an object
 * reaches the renderer its `style` is already resolved, generic data.
 *
 * Adding a future tool is exactly one new entry here plus one new
 * DrawingSemantic member in DrawingObject.ts -- never a rendering change.
 */

import type { DrawingGeometry, DrawingIntent, DrawingStyle } from "./DrawingObject.ts";

// Drawing Engine UX Refactor -- locked color/dash/arrow system, one entry
// per tactical meaning (no more straight/curved pairs to keep in sync --
// see DrawingIntent's own doc comment for why that split is gone).
// Movement reuses the existing shared --ds-color-accent token (already
// "STARKVIS Cyan" everywhere else in the app -- RotationHandle,
// DrawingEndpointHandle, the selection ring). Pass/Shot need colors the
// shared design-system palette doesn't have -- these are therefore
// local, dedicated hex constants, following the exact same documented
// exception boardObjectDefinitions.ts's NEON_* constants already
// established for tactical/information-bearing symbols: not new *global*
// design tokens, used nowhere outside this one file.
const MOVEMENT_COLOR = "var(--ds-color-accent)";
// Clear yellow, never orange/green (locked spec). Distinct from
// GOALKEEPER's NEON_YELLOW (#FFDA00, a paler lemon).
const PASS_COLOR = "#FFE100";
// Orange/amber, deliberately NOT red and NOT the same hue as ATTACKER's
// NEON_RED (#FF1A3C) -- a shot line must read as its own thing at a
// glance, never confusable with a player marker.
const SHOT_COLOR = "#FF9500";

// Same stroke weight for every drawing tool -- "Samma linjetjocklek."
// One shared constant, not three copies of the same number.
const DRAWING_STROKE_WIDTH_METERS = 0.08;

// Locked dash pattern -- Rörelse is solid (""), Passning/Skott are
// dashed. The pattern length scales off DRAWING_STROKE_WIDTH_METERS so
// the dash reads proportionally at any stroke weight, expressed in the
// same meter units as strokeWidth (SVG dasharray is unitless in the
// current coordinate system, i.e. meters here).
const SOLID_DASHARRAY = "";
const DASHED_DASHARRAY = "0.24 0.16";

// Arrowhead length in meters, by family -- unchanged from before this
// refactor ("Nuvarande storlek är bra. Ändra inte."): Rörelse = normal
// fylld pil, Passning = lite lättare/mindre dominant, Skott = lite
// större/mer kraftfull.
const MOVEMENT_ARROW_SIZE_METERS = 0.4;
const PASS_ARROW_SIZE_METERS = 0.28;
const SHOT_ARROW_SIZE_METERS = 0.55;

export type DrawingPreset = {
  // Swedish tool-panel label, e.g. "Rörelse" -- the single source of
  // truth for both the ToolPanel button text and ActiveToolSummary.
  label: string;
  // Which geometry shape this tool's create-gesture produces. Read by the
  // interaction code in MasterCourt.tsx so it never hardcodes "CURVE"
  // inline for a specific tool. Always CURVE now -- see DrawingIntent's
  // doc comment: geometry (straight vs curved) is decided by anchor
  // count, not by which tool is active.
  defaultGeometryKind: DrawingGeometry["kind"];
  // Which pointer gesture creates this tool's drawing -- read by
  // MasterCourt.tsx so dispatching to the right interaction code never
  // hardcodes a tool's name. Always "CLICK_SEQUENCE" now: successive
  // left-clicks placing anchors, finished via right-click/Enter/
  // double-click. The field itself stays (rather than being deleted)
  // because the Area Engine's Rectangle tool still uses "DRAG" -- this
  // remains the one shared creation-mode vocabulary both engines read
  // (see pointerInteraction.ts), not a drawing-specific concept.
  creationMode: "DRAG" | "CLICK_SEQUENCE";
  // Seeded onto a new DrawingObject's `style` field at creation time
  // (see createDrawingObject).
  style: DrawingStyle;
};

export const DRAWING_PRESETS: Record<DrawingIntent, DrawingPreset> = {
  PLAYER_MOVEMENT: {
    label: "Rörelse",
    defaultGeometryKind: "CURVE",
    creationMode: "CLICK_SEQUENCE",
    style: {
      color: MOVEMENT_COLOR,
      strokeWidth: DRAWING_STROKE_WIDTH_METERS,
      arrowSize: MOVEMENT_ARROW_SIZE_METERS,
      strokeDasharray: SOLID_DASHARRAY,
    },
  },
  PASS: {
    label: "Passning",
    defaultGeometryKind: "CURVE",
    creationMode: "CLICK_SEQUENCE",
    style: {
      color: PASS_COLOR,
      strokeWidth: DRAWING_STROKE_WIDTH_METERS,
      arrowSize: PASS_ARROW_SIZE_METERS,
      strokeDasharray: DASHED_DASHARRAY,
    },
  },
  SHOT: {
    label: "Skott",
    defaultGeometryKind: "CURVE",
    creationMode: "CLICK_SEQUENCE",
    style: {
      color: SHOT_COLOR,
      strokeWidth: DRAWING_STROKE_WIDTH_METERS,
      arrowSize: SHOT_ARROW_SIZE_METERS,
      strokeDasharray: DASHED_DASHARRAY,
    },
  },
};
