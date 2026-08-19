/**
 * Board Scene layer -- the scene's objects, identity, positions and
 * selection. Pure, serializable, frozen state + plain transition
 * functions, exactly like PrimaryWorkspaceState.ts -- no React, no AI
 * Core/AgentManager/WorkflowEngine/TaskEngine import, no EventBus (the
 * existing workspace architecture does not require a domain event for
 * local UI state like this).
 */

import { clampToBounds, type MeterPoint } from "../geometry/CourtTransform.ts";
import { COURT_BOUNDS_METERS } from "../geometry/HandballCourtGeometry.ts";
import {
  createBoardObject,
  type BoardObject,
  type ConeColor,
  type BoardObjectType,
} from "./BoardObject.ts";
import {
  createDrawingObject,
  setDrawingGeometryAnchorPoint,
  setDrawingGeometryPoint,
  translateDrawingGeometry,
  type DrawingGeometryInput,
  type DrawingObject,
  type DrawingSemantic,
} from "../drawing/DrawingObject.ts";
import type { AnchorPoint } from "../spatial/AnchorPoint.ts";
import {
  createAreaObject,
  setAreaGeometryPoint,
  setAreaRotation,
  translateAreaGeometry,
  type AreaGeometry,
  type AreaObject,
  type RectangleAreaGeometry,
} from "../area/AreaObject.ts";
import { createPlayerAction, setPlayerActionScreenPosition, type CreatePlayerActionInput } from "../actions/PlayerAction.ts";
import { getPlayerActionDefinition } from "../actions/PlayerActionRegistry.ts";
import type { PlayerAction } from "../actions/PlayerActionTypes.ts";
import { createPlayerState, type CreatePlayerStateInput } from "../states/PlayerState.ts";
import type { PlayerState, PlayerStateType } from "../states/PlayerStateTypes.ts";

// Spatial Engine Epic I, Del 3: the Surface Engine's first two surfaces.
// HANDBALL_COURT is the existing, only-ever surface up to this Epic --
// its behavior is completely unchanged (see createInitialScene's
// default). BLANK_CANVAS hides every handball-specific rendering layer
// (lines, goals, zones -- see MasterCourt.tsx) while reusing everything
// else unchanged: the camera, the coordinate system, the Object/Drawing/
// Area engines and their rendering order. A future surface (e.g. a
// generic gym-floor grid for styrketräning/kondition/agility) is one more
// union member plus one more MasterCourt.tsx rendering branch -- never a
// new workspace, camera, or coordinate system.
export type SurfaceType = "HANDBALL_COURT" | "BLANK_CANVAS";
export type CourtView = "HALF_COURT" | "FULL_COURT";
export type TransitionDirection = "TOP_TO_BOTTOM" | "BOTTOM_TO_TOP";
export type ZoneLayerId = "defensive" | "transition" | "transitionLabels" | "defensiveLabels";

export type VisibleZoneLayers = {
  defensive: boolean;
  transition: boolean;
  // Independent from `transition` (the zone-color layer itself) so the
  // two checkboxes ("Visa zoner" / "Visa namn") can be toggled
  // separately, per the transition-zones spec -- rendering still gates
  // on BOTH being true (see MasterCourt.tsx), so labels never float
  // without their zone colors even if toggled out of the expected order.
  transitionLabels: boolean;
  // Same independent-toggle relationship as transitionLabels, but for the
  // defensive zone name labels (H1/H2/3/V2/V1) -- gates on
  // defensive && defensiveLabels in MasterCourt.tsx.
  defensiveLabels: boolean;
};

export type TacticsBoardScene = {
  id: string;
  name: string;
  // Which Surface is active -- see SurfaceType above. Independent from
  // courtView (Halvplan/Helplan is a HANDBALL_COURT-specific viewport
  // concept; a future BLANK_CANVAS-only viewport concept, if one is ever
  // needed, would be its own field, never overload this one).
  surface: SurfaceType;
  courtView: CourtView;
  visibleZoneLayers: VisibleZoneLayers;
  transitionDirection: TransitionDirection;
  objects: readonly BoardObject[];
  selectedObjectId: string | null;
  // Drawing Engine Foundation v1 -- generic drawings (see
  // drawing/DrawingObject.ts), a separate array from `objects` (players
  // are single points with a role; drawings are geometry with a meaning
  // -- see that file's own doc comment for why they're not merged).
  drawings: readonly DrawingObject[];
  // Area Engine v1 -- generic filled/outlined regions (see
  // area/AreaObject.ts), a third separate array: an Area is neither a
  // single-point BoardObject nor a directional DrawingObject (no
  // arrowhead, no tactical intent), it's a closed region -- its own shape
  // of data, same reasoning that already kept drawings out of `objects`.
  areas: readonly AreaObject[];
  // Player Actions -- local, player-owned action markers such as SCREEN.
  // These are not DrawingObjects and never connect multiple players.
  playerActions: readonly PlayerAction[];
  // Player States -- local, player-owned state markers such as
  // DEFENSIVE_STANCE. States describe how a player is positioned, not a
  // separate action endpoint or drawing.
  playerStates: readonly PlayerState[];
};

function freezeScene(scene: TacticsBoardScene): TacticsBoardScene {
  return Object.freeze({
    ...scene,
    visibleZoneLayers: Object.freeze({ ...scene.visibleZoneLayers }),
    objects: Object.freeze([...scene.objects]),
    drawings: Object.freeze([...scene.drawings]),
    areas: Object.freeze([...scene.areas]),
    playerActions: Object.freeze([...scene.playerActions]),
    playerStates: Object.freeze([...scene.playerStates]),
  });
}

let objectIdCounter = 0;
function defaultIdFactory(): string {
  objectIdCounter += 1;
  return `board-object-${objectIdCounter}`;
}

let drawingIdCounter = 0;
function defaultDrawingIdFactory(): string {
  drawingIdCounter += 1;
  return `drawing-${drawingIdCounter}`;
}

let areaIdCounter = 0;
function defaultAreaIdFactory(): string {
  areaIdCounter += 1;
  return `area-${areaIdCounter}`;
}

let playerActionIdCounter = 0;
function defaultPlayerActionIdFactory(): string {
  playerActionIdCounter += 1;
  return `player-action-${playerActionIdCounter}`;
}

let playerStateIdCounter = 0;
function defaultPlayerStateIdFactory(): string {
  playerStateIdCounter += 1;
  return `player-state-${playerStateIdCounter}`;
}

export function createInitialScene(
  overrides: Partial<TacticsBoardScene> = {},
): TacticsBoardScene {
  return freezeScene({
    id: overrides.id ?? "tactics-board-scene-1",
    name: overrides.name ?? "Ny scen",
    surface: overrides.surface ?? "HANDBALL_COURT",
    courtView: overrides.courtView ?? "HALF_COURT",
    // Clean initial state (UX polish sprint): every zone layer starts
    // OFF -- no zone visualization is active until the coach explicitly
    // turns one on via its own popover. The zone buttons still render
    // and remain fully functional; only the default has changed.
    visibleZoneLayers: overrides.visibleZoneLayers ?? {
      defensive: false,
      transition: false,
      transitionLabels: false,
      defensiveLabels: false,
    },
    transitionDirection: overrides.transitionDirection ?? "TOP_TO_BOTTOM",
    objects: overrides.objects ?? [],
    selectedObjectId: overrides.selectedObjectId ?? null,
    drawings: overrides.drawings ?? [],
    areas: overrides.areas ?? [],
    playerActions: overrides.playerActions ?? [],
    playerStates: overrides.playerStates ?? [],
  });
}

// Switching Surface never touches objects/drawings/areas/camera -- the
// coach's work-in-progress on a court survives switching to a blank
// canvas and back (rendering-only gate, see MasterCourt.tsx).
export function setSurface(scene: TacticsBoardScene, surface: SurfaceType): TacticsBoardScene {
  if (scene.surface === surface) {
    return scene;
  }
  return freezeScene({ ...scene, surface });
}

// Viewport (courtView) and information layers (visibleZoneLayers) are
// deliberately separate concerns -- see the Taktiktavla product spec's own
// "Blanda inte ihop dessa begrepp" rule.
export function setCourtView(scene: TacticsBoardScene, courtView: CourtView): TacticsBoardScene {
  if (scene.courtView === courtView) {
    return scene;
  }
  // Viewport change only -- object coordinates/sizes are never touched.
  return freezeScene({ ...scene, courtView });
}

export function setZoneLayerVisible(
  scene: TacticsBoardScene,
  layer: ZoneLayerId,
  visible: boolean,
): TacticsBoardScene {
  if (scene.visibleZoneLayers[layer] === visible) {
    return scene;
  }
  return freezeScene({
    ...scene,
    visibleZoneLayers: { ...scene.visibleZoneLayers, [layer]: visible },
  });
}

export function setTransitionDirection(
  scene: TacticsBoardScene,
  direction: TransitionDirection,
): TacticsBoardScene {
  if (scene.transitionDirection === direction) {
    return scene;
  }
  return freezeScene({ ...scene, transitionDirection: direction });
}

export function addObject(
  scene: TacticsBoardScene,
  type: BoardObjectType,
  position: MeterPoint,
  options: { coneColor?: ConeColor; anchorPoint?: AnchorPoint } = {},
  idFactory: () => string = defaultIdFactory,
): TacticsBoardScene {
  const clamped = clampToBounds(position, COURT_BOUNDS_METERS);
  const object = createBoardObject({
    id: idFactory(),
    type,
    position: clamped,
    coneColor: options.coneColor,
    anchorPoint: options.anchorPoint,
  });
  return freezeScene({
    ...scene,
    objects: [...scene.objects, object],
    selectedObjectId: object.id,
  });
}

// Positions are always clamped to the court's real 20x40 m bounds -- an
// object can never be dragged/placed outside the physical court.
export function moveObject(
  scene: TacticsBoardScene,
  objectId: string,
  position: MeterPoint,
  options: { anchorPoint?: AnchorPoint } = {},
): TacticsBoardScene {
  const clamped = clampToBounds(position, COURT_BOUNDS_METERS);
  let changed = false;
  const objects = scene.objects.map((object) => {
    if (object.id !== objectId) {
      return object;
    }
    changed = true;
    if (options.anchorPoint !== undefined) {
      return { ...object, position: clamped, anchorPoint: options.anchorPoint };
    }
    if (object.anchorPoint !== undefined) {
      return createBoardObject({
        id: object.id,
        type: object.type,
        position: clamped,
        rotation: object.rotation,
        label: object.label,
        coneColor: object.coneColor,
        formationLayer: object.formationLayer,
      });
    }
    return { ...object, position: clamped };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, objects });
}

// Rotation is normalized to 0-359 degrees, wrapping either direction, so
// repeated left/right rotation steps never drift outside a predictable
// range. Zoom/pan (camera state) never touches this -- rotation is a
// scene/object property, never a viewport concern.
export function setObjectRotation(
  scene: TacticsBoardScene,
  objectId: string,
  rotationDegrees: number,
): TacticsBoardScene {
  const normalized = ((rotationDegrees % 360) + 360) % 360;
  let changed = false;
  const objects = scene.objects.map((object) => {
    if (object.id !== objectId || object.rotation === normalized) {
      return object;
    }
    changed = true;
    return { ...object, rotation: normalized };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, objects });
}

// Also clears any drawing's OR area's `reference` if it pointed at the
// object being deleted -- a reference is a plain id pointer (see
// drawing/DrawingObject.ts, area/AreaObject.ts, scene/ObjectReference.ts),
// so deleting its target must never leave it dangling. This is the one
// piece of cross-cutting cleanup a reference-by-id design always needs,
// generalized in Del 5 to cover every reference-bearing entity, not just
// drawings.
export function removeObject(scene: TacticsBoardScene, objectId: string): TacticsBoardScene {
  const objects = scene.objects.filter((object) => object.id !== objectId);
  if (objects.length === scene.objects.length) {
    return scene;
  }
  const drawings = scene.drawings.map((drawing) =>
    drawing.reference?.objectId === objectId ? { ...drawing, reference: null } : drawing,
  );
  const areas = scene.areas.map((area) =>
    area.reference?.objectId === objectId ? { ...area, reference: null } : area,
  );
  const playerActions = scene.playerActions.filter((action) => action.playerId !== objectId);
  const playerStates = scene.playerStates.filter((state) => state.playerId !== objectId);
  return freezeScene({
    ...scene,
    objects,
    drawings,
    areas,
    playerActions,
    playerStates,
    selectedObjectId: scene.selectedObjectId === objectId ? null : scene.selectedObjectId,
  });
}

// Selecting a board object always clears any selected drawing AND any
// selected area (mutual exclusivity with selectDrawing/selectArea below)
// -- exactly one "thing" on the plan is ever selected at a time in v1,
// regardless of which of the three engines (Object/Drawing/Area) it
// belongs to.
export function selectObject(scene: TacticsBoardScene, objectId: string | null): TacticsBoardScene {
  const hasSelectedDrawing = scene.drawings.some((drawing) => drawing.selected);
  const hasSelectedArea = scene.areas.some((area) => area.selected);
  if (scene.selectedObjectId === objectId && !hasSelectedDrawing && !hasSelectedArea) {
    return scene;
  }
  const drawings = hasSelectedDrawing
    ? scene.drawings.map((drawing) => (drawing.selected ? { ...drawing, selected: false } : drawing))
    : scene.drawings;
  const areas = hasSelectedArea
    ? scene.areas.map((area) => (area.selected ? { ...area, selected: false } : area))
    : scene.areas;
  return freezeScene({ ...scene, selectedObjectId: objectId, drawings, areas });
}

export function getSelectedObject(scene: TacticsBoardScene): BoardObject | null {
  return scene.objects.find((object) => object.id === scene.selectedObjectId) ?? null;
}

export function setObjects(
  scene: TacticsBoardScene,
  objects: readonly BoardObject[],
  selectedObjectId: string | null = scene.selectedObjectId,
): TacticsBoardScene {
  if (scene.objects === objects && scene.selectedObjectId === selectedObjectId) {
    return scene;
  }
  return freezeScene({ ...scene, objects, selectedObjectId });
}

// -- Drawing Engine Foundation v1 reducers --
// Same immutable, no-op-guard-then-freeze convention as every reducer
// above. `selected` lives on each DrawingObject itself (not a single
// scene.selectedDrawingId) so a future multi-select is a data-model
// non-event -- v1 still enforces exactly one (or zero) true at a time.

// Builds the DrawingObject internally (via idFactory) exactly like
// addObject builds its BoardObject internally -- callers pass raw
// geometry + semantic, never a pre-built object, so id assignment stays
// in one place.
export function addDrawing(
  scene: TacticsBoardScene,
  geometry: DrawingGeometryInput,
  semantic: DrawingSemantic,
  idFactory: () => string = defaultDrawingIdFactory,
): TacticsBoardScene {
  const drawing = createDrawingObject({ id: idFactory(), geometry, semantic, selected: true });
  const drawings = scene.drawings.map((existing) =>
    existing.selected ? { ...existing, selected: false } : existing,
  );
  return freezeScene({
    ...scene,
    drawings: [...drawings, drawing],
    selectedObjectId: null,
  });
}

export function moveDrawingBy(
  scene: TacticsBoardScene,
  drawingId: string,
  delta: MeterPoint,
): TacticsBoardScene {
  let changed = false;
  const drawings = scene.drawings.map((drawing) => {
    if (drawing.id !== drawingId || drawing.locked) {
      return drawing;
    }
    changed = true;
    return { ...drawing, geometry: translateDrawingGeometry(drawing.geometry, delta) };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, drawings });
}

// Endpoint editing -- moves ONE point of a drawing's geometry (by index,
// see getDrawingGeometryPoints) to an absolute position, leaving the rest
// of the geometry untouched. Same locked-guard/no-op-guard/freeze
// convention as moveDrawingBy above; the only difference is
// setDrawingGeometryPoint (absolute, one point) vs translateDrawingGeometry
// (relative delta, every point).
export function moveDrawingPoint(
  scene: TacticsBoardScene,
  drawingId: string,
  pointIndex: number,
  position: MeterPoint,
): TacticsBoardScene {
  let changed = false;
  const drawings = scene.drawings.map((drawing) => {
    if (drawing.id !== drawingId || drawing.locked) {
      return drawing;
    }
    changed = true;
    return { ...drawing, geometry: setDrawingGeometryPoint(drawing.geometry, pointIndex, position) };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, drawings });
}

export function anchorDrawingPoint(
  scene: TacticsBoardScene,
  drawingId: string,
  pointIndex: number,
  point: AnchorPoint,
): TacticsBoardScene {
  let changed = false;
  const drawings = scene.drawings.map((drawing) => {
    if (drawing.id !== drawingId || drawing.locked) {
      return drawing;
    }
    changed = true;
    return { ...drawing, geometry: setDrawingGeometryAnchorPoint(drawing.geometry, pointIndex, point) };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, drawings });
}

// Sets a drawing's reference to point at a BoardObject, by id -- see
// scene/ObjectReference.ts. Deliberately does NOT verify objectId exists
// in scene.objects; removeObject above is what keeps this from dangling
// if the target is later deleted. No UI calls this yet in v1 (see the
// Drawing Paths & Object References plan) -- it exists as a tested engine
// capability for a future tool to use.
export function setDrawingReference(scene: TacticsBoardScene, drawingId: string, objectId: string): TacticsBoardScene {
  let changed = false;
  const drawings = scene.drawings.map((drawing) => {
    if (drawing.id !== drawingId || drawing.locked) {
      return drawing;
    }
    changed = true;
    return { ...drawing, reference: { objectId } };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, drawings });
}

export function clearDrawingReference(scene: TacticsBoardScene, drawingId: string): TacticsBoardScene {
  let changed = false;
  const drawings = scene.drawings.map((drawing) => {
    if (drawing.id !== drawingId || drawing.locked || drawing.reference === null) {
      return drawing;
    }
    changed = true;
    return { ...drawing, reference: null };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, drawings });
}

export function removeDrawing(scene: TacticsBoardScene, drawingId: string): TacticsBoardScene {
  const target = scene.drawings.find((drawing) => drawing.id === drawingId);
  if (!target || target.locked) {
    return scene;
  }
  const drawings = scene.drawings.filter((drawing) => drawing.id !== drawingId);
  return freezeScene({ ...scene, drawings });
}

// Selecting a drawing always clears any selected board object AND any
// selected area (mutual exclusivity with selectObject/selectArea).
export function selectDrawing(scene: TacticsBoardScene, drawingId: string | null): TacticsBoardScene {
  const hasSelectedArea = scene.areas.some((area) => area.selected);
  let changed = scene.selectedObjectId !== null || hasSelectedArea;
  const drawings = scene.drawings.map((drawing) => {
    const shouldBeSelected = drawing.id === drawingId;
    if (drawing.selected === shouldBeSelected) {
      return drawing;
    }
    changed = true;
    return { ...drawing, selected: shouldBeSelected };
  });
  if (!changed) {
    return scene;
  }
  const areas = hasSelectedArea
    ? scene.areas.map((area) => (area.selected ? { ...area, selected: false } : area))
    : scene.areas;
  return freezeScene({ ...scene, drawings, areas, selectedObjectId: null });
}

export function getSelectedDrawing(scene: TacticsBoardScene): DrawingObject | null {
  return scene.drawings.find((drawing) => drawing.selected) ?? null;
}

// Bulk replace -- used by board commands to restore or rewrite the
// drawing collection while preserving the scene module's freeze boundary.
export function setDrawings(scene: TacticsBoardScene, drawings: readonly DrawingObject[]): TacticsBoardScene {
  if (scene.drawings === drawings) {
    return scene;
  }
  return freezeScene({ ...scene, drawings });
}

// -- Area Engine v1 reducers --
// Same immutable, no-op-guard-then-freeze convention as every reducer
// above -- deliberately reusing the Drawing Engine's exact reducer shapes
// (addX/moveXBy/moveXPoint/removeX/selectX/setXs) rather than inventing a
// parallel vocabulary, so a caller already familiar with the Drawing
// Engine's integration needs no new mental model for Areas.

export function addArea(
  scene: TacticsBoardScene,
  geometry: AreaGeometry,
  idFactory: () => string = defaultAreaIdFactory,
): TacticsBoardScene {
  const area = createAreaObject({ id: idFactory(), geometry, selected: true });
  const drawings = scene.drawings.some((drawing) => drawing.selected)
    ? scene.drawings.map((drawing) => (drawing.selected ? { ...drawing, selected: false } : drawing))
    : scene.drawings;
  const areas = scene.areas.map((existing) => (existing.selected ? { ...existing, selected: false } : existing));
  return freezeScene({
    ...scene,
    areas: [...areas, area],
    drawings,
    selectedObjectId: null,
  });
}

export function moveAreaBy(scene: TacticsBoardScene, areaId: string, delta: MeterPoint): TacticsBoardScene {
  let changed = false;
  const areas = scene.areas.map((area) => {
    if (area.id !== areaId || area.locked) {
      return area;
    }
    changed = true;
    return { ...area, geometry: translateAreaGeometry(area.geometry, delta) };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, areas });
}

// Polygon vertex editing -- moves ONE vertex, every other point untouched.
// `localPosition` must already be in the geometry's local (pre-rotation)
// frame -- the caller (MasterCourt.tsx) is responsible for inverse-
// rotating the pointer's meter position first (see AreaObject.ts's
// worldAreaPointToLocal). Still generic over `AreaGeometry` at the type
// level (setAreaGeometryPoint's RECTANGLE branch is a legitimate, tested,
// LOCAL-frame-only primitive), but MasterCourt.tsx only ever calls this
// for POLYGON now -- RECTANGLE corner-drag uses the dedicated
// resizeAreaRectangle reducer below instead (see setAreaGeometryPoint's
// doc comment for why: this reducer's "keep the opposite corner's local
// coordinate unchanged" is not safe for an interactive drag on a rotated
// rectangle).
export function moveAreaPoint(
  scene: TacticsBoardScene,
  areaId: string,
  pointIndex: number,
  localPosition: MeterPoint,
): TacticsBoardScene {
  let changed = false;
  const areas = scene.areas.map((area) => {
    if (area.id !== areaId || area.locked) {
      return area;
    }
    changed = true;
    return { ...area, geometry: setAreaGeometryPoint(area.geometry, pointIndex, localPosition) };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, areas });
}

// Rectangle resize (Area handle-drag interaction fix) -- deliberately a
// SEPARATE reducer from moveAreaPoint above, not a further generalization
// of it: unlike Polygon vertex-editing (move one point, nothing else
// touched), a rotation-safe rectangle resize needs BOTH corners' local
// coordinates recomputed together from a freshly solved centroid (see
// AreaObject.ts's resizeRectangleToFixedAnchor) -- `geometry` here is
// already that fully-resolved new RECTANGLE geometry; this reducer's only
// job is the standard locked-guard + no-op-guard + freeze, applied to a
// whole-geometry replacement instead of a single point.
export function resizeAreaRectangle(
  scene: TacticsBoardScene,
  areaId: string,
  geometry: RectangleAreaGeometry,
): TacticsBoardScene {
  let changed = false;
  const areas = scene.areas.map((area) => {
    if (area.id !== areaId || area.locked || area.geometry.kind !== "RECTANGLE") {
      return area;
    }
    changed = true;
    return { ...area, geometry };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, areas });
}

export function rotateArea(scene: TacticsBoardScene, areaId: string, rotationDegrees: number): TacticsBoardScene {
  let changed = false;
  const areas = scene.areas.map((area) => {
    if (area.id !== areaId || area.locked) {
      return area;
    }
    changed = true;
    return { ...area, geometry: setAreaRotation(area.geometry, rotationDegrees) };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, areas });
}

export function removeArea(scene: TacticsBoardScene, areaId: string): TacticsBoardScene {
  const target = scene.areas.find((area) => area.id === areaId);
  if (!target || target.locked) {
    return scene;
  }
  const areas = scene.areas.filter((area) => area.id !== areaId);
  return freezeScene({ ...scene, areas });
}

// Selecting an area always clears any selected board object AND any
// selected drawing (mutual exclusivity with selectObject/selectDrawing).
export function selectArea(scene: TacticsBoardScene, areaId: string | null): TacticsBoardScene {
  const hasSelectedDrawing = scene.drawings.some((drawing) => drawing.selected);
  let changed = scene.selectedObjectId !== null || hasSelectedDrawing;
  const areas = scene.areas.map((area) => {
    const shouldBeSelected = area.id === areaId;
    if (area.selected === shouldBeSelected) {
      return area;
    }
    changed = true;
    return { ...area, selected: shouldBeSelected };
  });
  if (!changed) {
    return scene;
  }
  const drawings = hasSelectedDrawing
    ? scene.drawings.map((drawing) => (drawing.selected ? { ...drawing, selected: false } : drawing))
    : scene.drawings;
  return freezeScene({ ...scene, areas, drawings, selectedObjectId: null });
}

export function getSelectedArea(scene: TacticsBoardScene): AreaObject | null {
  return scene.areas.find((area) => area.selected) ?? null;
}

// Spatial Engine Epic I, Del 5 -- Object References, extended to Areas.
// Exact same shape as setDrawingReference/clearDrawingReference: sets/
// clears an Area's reference to a BoardObject, by id. No UI calls this
// yet (per the Epic's "Bygg INTE UI" instruction) -- these are real,
// tested engine capabilities for a future tool to use, exactly like the
// Drawing Engine's own reference reducers were before any UI called them.
export function setAreaReference(scene: TacticsBoardScene, areaId: string, objectId: string): TacticsBoardScene {
  let changed = false;
  const areas = scene.areas.map((area) => {
    if (area.id !== areaId || area.locked) {
      return area;
    }
    changed = true;
    return { ...area, reference: { objectId } };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, areas });
}

export function clearAreaReference(scene: TacticsBoardScene, areaId: string): TacticsBoardScene {
  let changed = false;
  const areas = scene.areas.map((area) => {
    if (area.id !== areaId || area.locked || area.reference === null) {
      return area;
    }
    changed = true;
    return { ...area, reference: null };
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, areas });
}

// Bulk replace -- used by board commands to restore or rewrite the area
// collection while preserving the scene module's freeze boundary.
export function setAreas(scene: TacticsBoardScene, areas: readonly AreaObject[]): TacticsBoardScene {
  if (scene.areas === areas) {
    return scene;
  }
  return freezeScene({ ...scene, areas });
}

export function addPlayerAction(
  scene: TacticsBoardScene,
  input: Omit<CreatePlayerActionInput, "id">,
  idFactory: () => string = defaultPlayerActionIdFactory,
): TacticsBoardScene {
  const action = createPlayerAction({ ...input, id: idFactory() });
  return freezeScene({
    ...scene,
    playerActions: [...scene.playerActions, action],
  });
}

export function removePlayerAction(scene: TacticsBoardScene, actionId: string): TacticsBoardScene {
  const playerActions = scene.playerActions.filter((action) => action.id !== actionId);
  if (playerActions.length === scene.playerActions.length) {
    return scene;
  }
  return freezeScene({ ...scene, playerActions });
}

export function movePlayerActionScreenAnchor(
  scene: TacticsBoardScene,
  actionId: string,
  position: MeterPoint,
): TacticsBoardScene {
  let changed = false;
  const playerActions = scene.playerActions.map((action) => {
    if (action.id !== actionId) {
      return action;
    }
    const player = scene.objects.find((object) => object.id === action.playerId);
    const playerPosition = player?.position ?? action.playerAnchor.fallbackPosition;
    const maxLength = getPlayerActionDefinition(action.type).maxLengthMeters;
    const dx = position.x - playerPosition.x;
    const dy = position.y - playerPosition.y;
    const distance = Math.hypot(dx, dy);
    const clampedPosition = distance > maxLength && distance > 0
      ? {
          x: playerPosition.x + (dx / distance) * maxLength,
          y: playerPosition.y + (dy / distance) * maxLength,
        }
      : position;
    changed = true;
    return setPlayerActionScreenPosition(action, clampedPosition);
  });
  if (!changed) {
    return scene;
  }
  return freezeScene({ ...scene, playerActions });
}

export function setPlayerActions(
  scene: TacticsBoardScene,
  playerActions: readonly PlayerAction[],
): TacticsBoardScene {
  if (scene.playerActions === playerActions) {
    return scene;
  }
  return freezeScene({ ...scene, playerActions });
}

export function addPlayerState(
  scene: TacticsBoardScene,
  input: Omit<CreatePlayerStateInput, "id">,
  idFactory: () => string = defaultPlayerStateIdFactory,
): TacticsBoardScene {
  if (scene.playerStates.some((state) => state.playerId === input.playerId && state.type === input.type)) {
    return scene;
  }
  const state = createPlayerState({ ...input, id: idFactory() });
  return freezeScene({
    ...scene,
    playerStates: [...scene.playerStates, state],
  });
}

export function removePlayerState(scene: TacticsBoardScene, stateId: string): TacticsBoardScene {
  const playerStates = scene.playerStates.filter((state) => state.id !== stateId);
  if (playerStates.length === scene.playerStates.length) {
    return scene;
  }
  return freezeScene({ ...scene, playerStates });
}

export function removePlayerStateByPlayerAndType(
  scene: TacticsBoardScene,
  playerId: string,
  type: PlayerStateType,
): TacticsBoardScene {
  const playerStates = scene.playerStates.filter((state) => state.playerId !== playerId || state.type !== type);
  if (playerStates.length === scene.playerStates.length) {
    return scene;
  }
  return freezeScene({ ...scene, playerStates });
}

export function setPlayerStates(
  scene: TacticsBoardScene,
  playerStates: readonly PlayerState[],
): TacticsBoardScene {
  if (scene.playerStates === playerStates) {
    return scene;
  }
  return freezeScene({ ...scene, playerStates });
}
