/**
 * Diagram Persistence Foundation v1 -- Spatial Engine Epic I, Del 6.
 * Architecture only: serializeScene/deserializeScene make the FULL scene
 * (surface, court view, zone visibility, transition direction, board
 * objects, drawings, areas) able to round-trip through a plain,
 * versioned, JSON-safe shape. This is the save/load architecture a
 * future "Spara diagram"/"Öppna diagram" feature will build on -- no
 * actual file I/O, PDF, export format, or animation lives here, and
 * nothing in the UI calls these functions yet (same "engine capability,
 * no UI" discipline as Del 5's Object References).
 *
 * The scene was ALREADY plain, frozen, JSON-safe data before this file
 * existed -- every TacticsBoardScene.ts reducer only ever produces
 * serializable objects (see TacticsBoardScene.test.mjs's "26: object
 * positions/state are plain serializable data" test, a precedent for
 * this exact property). serializeScene is therefore a thin, versioned
 * wrapper, not a transform. deserializeScene is the real work: it never
 * trusts its input's shape (e.g. data freshly loaded from a future save
 * file) and rebuilds every object/drawing/area through its own create*
 * constructor -- createBoardObject/createDrawingObject/createAreaObject
 * -- so a reloaded scene has exactly the same freezing, defaults, and
 * type validation as one built by the coach's own actions, never a raw
 * structural clone that could carry a corrupt or stale shape forward.
 *
 * Camera state (Camera2D) is deliberately excluded -- it is a pure
 * viewing transform (zoom/pan), never persisted scene content, exactly
 * as Camera2D.ts's own doc comment already establishes; a reloaded
 * diagram always opens at the default camera.
 */

import { createBoardObject, isBoardObjectType, type BoardObject } from "./BoardObject.ts";
import { createDrawingObject, type DrawingObject } from "../drawing/DrawingObject.ts";
import { createAreaObject, type AreaObject } from "../area/AreaObject.ts";
import {
  createInitialScene,
  type TacticsBoardScene,
  type VisibleZoneLayers,
} from "./TacticsBoardScene.ts";

// Bumped whenever the serialized shape changes in a way old data can't
// already be read as -- deserializeScene rejects any other version
// rather than silently guessing, so a future format change is a
// deliberate migration step, never silent data corruption.
export const SCENE_SCHEMA_VERSION = 1;

export type SerializedScene = {
  schemaVersion: typeof SCENE_SCHEMA_VERSION;
  scene: TacticsBoardScene;
};

export class SceneDeserializationError extends Error {}

// Pure -- see the file header for why this is a wrap, not a transform.
// Never mutates `scene`.
export function serializeScene(scene: TacticsBoardScene): SerializedScene {
  return { schemaVersion: SCENE_SCHEMA_VERSION, scene };
}

function asRecord(value: unknown, errorMessage: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new SceneDeserializationError(errorMessage);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, errorMessage: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new SceneDeserializationError(errorMessage);
  }
  return value;
}

function reconstructObjects(raw: unknown): readonly BoardObject[] {
  return asArray(raw, "Expected `scene.objects` to be an array.").map((entry, index) => {
    const e = asRecord(entry, `scene.objects[${index}] is not an object.`);
    if (typeof e.id !== "string" || !isBoardObjectType(e.type)) {
      throw new SceneDeserializationError(`scene.objects[${index}] is missing a valid id/type.`);
    }
    const position = asRecord(e.position, `scene.objects[${index}].position is not an object.`);
    if (typeof position.x !== "number" || typeof position.y !== "number") {
      throw new SceneDeserializationError(`scene.objects[${index}].position must have numeric x/y.`);
    }
    return createBoardObject({
      id: e.id,
      type: e.type,
      position: { x: position.x, y: position.y },
      rotation: typeof e.rotation === "number" ? e.rotation : undefined,
      label: typeof e.label === "string" ? e.label : undefined,
      coneColor: e.coneColor === "ORANGE" || e.coneColor === "YELLOW" ? e.coneColor : undefined,
      formationLayer:
        e.formationLayer === "DEFENCE" || e.formationLayer === "ATTACK" ? e.formationLayer : undefined,
    });
  });
}

// Drawings/areas carry a deep, discriminated-union geometry/style/
// semantic shape (see DrawingObject.ts/AreaObject.ts) -- validating every
// union variant at runtime here would duplicate those types' own
// definitions for no real benefit (this is architecture prep, never an
// import boundary for untrusted third-party files). Presence/type of the
// REQUIRED top-level fields is checked; the nested geometry/semantic/
// style shape is trusted to already match its TypeScript type, exactly
// like every other internal reducer call in this codebase.
function reconstructDrawings(raw: unknown): readonly DrawingObject[] {
  return asArray(raw, "Expected `scene.drawings` to be an array.").map((entry, index) => {
    const e = asRecord(entry, `scene.drawings[${index}] is not an object.`);
    if (typeof e.id !== "string" || typeof e.geometry !== "object" || typeof e.semantic !== "object") {
      throw new SceneDeserializationError(`scene.drawings[${index}] is missing id/geometry/semantic.`);
    }
    return createDrawingObject({
      id: e.id,
      geometry: e.geometry as DrawingObject["geometry"],
      semantic: e.semantic as DrawingObject["semantic"],
      style: e.style as DrawingObject["style"] | undefined,
      selected: false, // a reloaded diagram never restores mid-edit selection state
      locked: typeof e.locked === "boolean" ? e.locked : undefined,
      reference: (e.reference as DrawingObject["reference"]) ?? null,
    });
  });
}

function reconstructAreas(raw: unknown): readonly AreaObject[] {
  return asArray(raw, "Expected `scene.areas` to be an array.").map((entry, index) => {
    const e = asRecord(entry, `scene.areas[${index}] is not an object.`);
    if (typeof e.id !== "string" || typeof e.geometry !== "object") {
      throw new SceneDeserializationError(`scene.areas[${index}] is missing id/geometry.`);
    }
    return createAreaObject({
      id: e.id,
      geometry: e.geometry as AreaObject["geometry"],
      style: e.style as AreaObject["style"] | undefined,
      selected: false, // same reasoning as reconstructDrawings above
      locked: typeof e.locked === "boolean" ? e.locked : undefined,
      reference: (e.reference as AreaObject["reference"]) ?? null,
    });
  });
}

function reconstructVisibleZoneLayers(raw: unknown): VisibleZoneLayers {
  const e = asRecord(raw, "Expected `scene.visibleZoneLayers` to be an object.");
  return {
    defensive: e.defensive === true,
    transition: e.transition === true,
    transitionLabels: e.transitionLabels === true,
    defensiveLabels: e.defensiveLabels === true,
  };
}

/**
 * Reconstructs a TacticsBoardScene from ANY unknown input -- never
 * trusts the input shape. Throws SceneDeserializationError on anything
 * invalid (wrong schema version, missing required fields, wrong types)
 * rather than silently producing a corrupt or partially-broken scene.
 * `selectedObjectId` and every entity's `selected` flag are always reset
 * on load -- transient UI selection state is never part of a saved
 * diagram. Camera state is likewise never restored (see the file
 * header) -- a reloaded diagram always opens at the default camera/pan.
 */
export function deserializeScene(input: unknown): TacticsBoardScene {
  const data = asRecord(input, "Expected a serialized scene object.");
  if (data.schemaVersion !== SCENE_SCHEMA_VERSION) {
    throw new SceneDeserializationError(
      `Unsupported scene schema version: ${String(data.schemaVersion)}. Expected ${SCENE_SCHEMA_VERSION}.`,
    );
  }
  const rawScene = asRecord(data.scene, "Expected `scene` to be an object.");

  return createInitialScene({
    id: typeof rawScene.id === "string" ? rawScene.id : undefined,
    name: typeof rawScene.name === "string" ? rawScene.name : undefined,
    surface: rawScene.surface === "BLANK_CANVAS" ? "BLANK_CANVAS" : "HANDBALL_COURT",
    courtView: rawScene.courtView === "FULL_COURT" ? "FULL_COURT" : "HALF_COURT",
    visibleZoneLayers: reconstructVisibleZoneLayers(rawScene.visibleZoneLayers),
    transitionDirection: rawScene.transitionDirection === "BOTTOM_TO_TOP" ? "BOTTOM_TO_TOP" : "TOP_TO_BOTTOM",
    objects: reconstructObjects(rawScene.objects),
    selectedObjectId: null,
    drawings: reconstructDrawings(rawScene.drawings),
    areas: reconstructAreas(rawScene.areas),
  });
}
