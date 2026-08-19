"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { applyCameraToViewport, type Camera2D } from "../../camera/Camera2D.ts";
import { BOARD_OBJECT_DEFINITIONS } from "./boardObjectDefinitions.ts";
import { pointerPixelToMeter, rotatePointAroundCenter, viewportToViewBox, type MeterPoint } from "./geometry/CourtTransform.ts";
import {
  buildCourtLines,
  buildDefensiveZoneLabelPositions,
  buildDefensiveZonePolygonsFromCalibration,
  buildGoalAreaFills,
  buildGoalNetFills,
  buildTransitionZoneLabelPositions,
  buildTransitionZones,
  buildViewportForCourtView,
  type DefensiveZoneCalibration,
  type DefensiveZoneLabelCalibration,
  type DefensiveZoneLabelKey,
} from "./geometry/HandballCourtGeometry.ts";
import {
  computeRotationDegrees,
  computeWheelZoomFactor,
  getAreaCreationMode,
  getDrawingCreationMode,
  getToolInteractionMode,
  isAreaTool,
  isDrawingTool,
  isPlacementTool,
  resolveBackgroundPointerAction,
  type InteractionMode,
  type ToolId,
} from "./pointerInteraction.ts";
import BoardObjectRenderer from "./BoardObjectRenderer.tsx";
import CalibrationHandle from "./CalibrationHandle.tsx";
import DrawingEndpointHandle from "./DrawingEndpointHandle.tsx";
import DrawingRenderer from "./DrawingRenderer.tsx";
import AreaRenderer from "./AreaRenderer.tsx";
import { createPlayerAction } from "./actions/PlayerAction.ts";
import { getPlayerActionDefinition } from "./actions/PlayerActionRegistry.ts";
import PlayerActionRenderer from "./actions/PlayerActionRenderer.tsx";
import type { PlayerAction, PlayerActionType } from "./actions/PlayerActionTypes.ts";
import PlayerStateRenderer from "./states/PlayerStateRenderer.tsx";
import { getSmartBallRenderPosition, isSmartBall, type SmartBallPlacement } from "./smart/SmartBall.ts";
import RotationHandle from "./RotationHandle.tsx";
import SelectionLayer from "./SelectionLayer.tsx";
import DividerLineEditor from "./DividerLineEditor.tsx";
import {
  createDrawingObject,
  getDrawingGeometryPoints,
  type DrawingObject,
} from "./drawing/DrawingObject.ts";
import { anchorPointFromMeterPoint, defaultSpatialEngine, type DrawingEndpointSnapCandidate, type DrawingEndpointSnapRole, type AnchorPoint } from "./spatial";
import {
  computePolygonPointsCentroid,
  createAreaObject,
  getAreaGeometryPoints,
  getAreaRotationPivot,
  localAreaPointToWorld,
  resizeRectangleToFixedAnchor,
  worldAreaPointToLocal,
  type AreaGeometry,
  type AreaObject,
  type RectangleAreaGeometry,
} from "./area/AreaObject.ts";
import type { BoardObject, BoardObjectType } from "./scene/BoardObject.ts";
import type { TacticsBoardScene } from "./scene/TacticsBoardScene.ts";
import styles from "./MasterCourt.module.css";

const V1_V2_DIVIDER_LABEL = "Gräns V1|V2";
// Distance (meters) passed as the RotationHandle's "objectRadiusMeters" --
// there's no real physical radius for a text label, this just keeps the
// handle a sensible visual distance from the label, same offset idiom
// board objects use for the object's own radius (see RotationHandle.tsx).
const DEFENSIVE_ZONE_LABEL_ROTATION_HANDLE_DISTANCE_METERS = 0.6;
// A Rectangle Area create-drag shorter than this (meters, on EITHER axis)
// is treated as a plain click, not an area -- "drawn, not stamped".
// Drawings have no equivalent constant anymore: they're click-sequence
// only now (Drawing Engine UX Refactor), and a separate minimum (at
// least 2 anchors) is enforced in TacticsBoardWorkspace.tsx's
// finishPathWithAnchors, not here.
const AREA_MIN_SIZE_METERS = 0.3;
const PLAYER_ACTION_DRAFT_MIN_LENGTH_METERS = 0.05;

// Re-exported so existing callers (TacticsBoardWorkspace.tsx) keep working
// unchanged -- the single source-of-truth definitions now live in
// pointerInteraction.ts (a plain, JSX-free module), not here.
export { getToolInteractionMode, isPlacementTool, type InteractionMode, type ToolId };

const OBJECT_LABELS: Record<BoardObjectType, string> = {
  ATTACKER: "Anfallare",
  DEFENDER: "Försvarare",
  GOALKEEPER: "Målvakt",
  BALL: "Boll",
  CONE: "Cone",
};

type MasterCourtProps = {
  scene: TacticsBoardScene;
  activeTool: ToolId;
  presentationMode?: boolean;
  interactionMode: InteractionMode;
  interactionCancelVersion: number;
  isContextMenuOpen: boolean;
  camera: Camera2D;
  onPlaceObject: (position: MeterPoint, anchorPoint?: AnchorPoint) => void;
  onSelectObject: (objectId: string | null) => void;
  onMoveObject: (objectId: string, position: MeterPoint, anchorPoint?: AnchorPoint) => void;
  onDeleteObject: (objectId: string) => void;
  onRotateObject: (objectId: string, rotationDegrees: number) => void;
  onObjectMoveGestureStart: (objectId: string) => void;
  onObjectMoveGestureEnd: (objectId: string) => void;
  onObjectRotateGestureStart: (objectId: string) => void;
  onObjectRotateGestureEnd: (objectId: string) => void;
  onPanBy: (deltaMeters: MeterPoint) => void;
  onZoomAt: (focusPoint: MeterPoint, targetZoom: number) => void;
  onEmptyCourtPointerDown: () => void;
  onCancelToSelect: () => void;
  onFinishContinuousDrawingToSelect: () => void;
  defensiveZoneCalibration: DefensiveZoneCalibration;
  calibrationMode: boolean;
  onDragDividerPoint: (position: MeterPoint) => void;
  onDividerDragStart: () => void;
  onDividerDragEnd: () => void;
  defensiveZoneLabelCalibration: DefensiveZoneLabelCalibration;
  defensiveZoneLabelCalibrationMode: boolean;
  selectedDefensiveZoneLabelKey: DefensiveZoneLabelKey;
  onSelectDefensiveZoneLabel: (key: DefensiveZoneLabelKey) => void;
  onDragDefensiveZoneLabel: (key: DefensiveZoneLabelKey, position: MeterPoint) => void;
  onRotateDefensiveZoneLabel: (key: DefensiveZoneLabelKey, rotationDegrees: number) => void;
  onDefensiveZoneLabelGestureStart: () => void;
  onDefensiveZoneLabelGestureEnd: () => void;
  // Drawing Engine -- generic ritlager (see drawing/DrawingObject.ts).
  // MasterCourt owns the move-drag/click-sequence-anchor pointer
  // gestures; TacticsBoardWorkspace.tsx owns the actual scene reducer
  // calls (including creation -- finishPathWithAnchors calls
  // handleCreateDrawing directly, a Workspace-local function, not a
  // MasterCourt prop, since creation is entirely click-sequence now and
  // MasterCourt never commits a drawing itself) and Undo history.
  drawings: readonly DrawingObject[];
  onSelectDrawing: (drawingId: string | null) => void;
  onMoveDrawing: (drawingId: string, delta: MeterPoint) => void;
  onMoveDrawingPoint: (drawingId: string, pointIndex: number, position: MeterPoint) => void;
  onAnchorDrawingPoint: (drawingId: string, pointIndex: number, point: AnchorPoint) => void;
  onDeleteDrawing: (drawingId: string) => void;
  onDrawingGestureStart: (drawingId: string) => void;
  onDrawingGestureEnd: (drawingId: string) => void;
  // Drawing Paths v1 -- click-sequence creation for CLICK_SEQUENCE-mode
  // tools (Böjd rörelse). The committed anchor list lives in
  // TacticsBoardWorkspace.tsx (not here) because Escape/Enter/Backspace
  // need to work while drafting, and only the Workspace owns window
  // keydown listeners; MasterCourt only reports clicks/finish gestures up
  // and renders the live preview from what it's given.
  pathDraftAnchors: readonly MeterPoint[] | null;
  onPathAnchorAdd: (point: MeterPoint) => void;
  // Double-click's second click already added its own (redundant, same-
  // position) anchor via the normal click handling below -- this variant
  // drops that last anchor before finishing, used only by the dblclick
  // handler.
  onPathFinishDroppingLastAnchor: () => void;
  // Drawing Engine UX Refactor -- reports the live cursor position up to
  // the Workspace on every pointermove while a path is being drafted, so
  // a right-click/Enter/double-click finish can commit the drawing
  // ending exactly where the cursor is (not jumping back to the last
  // clicked anchor). See finishPathWithAnchors in
  // TacticsBoardWorkspace.tsx for the bug this fixes.
  onPathPreviewMove: (point: MeterPoint) => void;
  // Area Engine v1 -- generic filled/outlined regions (see
  // area/AreaObject.ts). Same split of responsibility as drawings:
  // MasterCourt owns the create-drag/click-sequence/move/resize/rotate
  // pointer gestures; TacticsBoardWorkspace.tsx owns the scene reducer
  // calls and Undo history. AREA_POLYGON's click-sequence creation reuses
  // the SAME pathDraftAnchors/onPathAnchorAdd/onPathFinish/
  // onPathFinishDroppingLastAnchor props above -- never a second anchor-
  // list mechanism.
  areas: readonly AreaObject[];
  onCreateArea: (geometry: AreaGeometry) => void;
  onSelectArea: (areaId: string | null) => void;
  onMoveArea: (areaId: string, delta: MeterPoint) => void;
  onMoveAreaPoint: (areaId: string, pointIndex: number, localPosition: MeterPoint) => void;
  // Area handle-drag interaction fix -- Rectangle corner-resize is NOT
  // routed through onMoveAreaPoint (see AreaObject.ts's
  // setAreaGeometryPoint/resizeRectangleToFixedAnchor doc comments for the
  // rotation-drift root cause): this prop receives the fully-resolved new
  // RECTANGLE geometry directly.
  onResizeAreaRectangle: (areaId: string, geometry: RectangleAreaGeometry) => void;
  onRotateArea: (areaId: string, rotationDegrees: number) => void;
  onDeleteArea: (areaId: string) => void;
  onAreaGestureStart: (areaId: string) => void;
  onAreaGestureEnd: (areaId: string) => void;
  onCreatePlayerAction: (input: { type: PlayerActionType; playerId: string; playerPosition: MeterPoint; screenPosition: MeterPoint }) => void;
  onMovePlayerActionScreenAnchor: (actionId: string, position: MeterPoint) => void;
  onPlayerActionGestureStart: (actionId: string) => void;
  onPlayerActionGestureEnd: (actionId: string) => void;
  onOpenPlayerActionsContextMenu: (input: {
    objectId: string;
    objectType: BoardObjectType;
    playerPosition: MeterPoint;
    clientPosition: { x: number; y: number };
  }) => void;
  onOpenObjectContextMenu?: (input: {
    objectId: string;
    objectType: BoardObjectType;
    playerPosition: MeterPoint;
    clientPosition: { x: number; y: number };
  }) => void;
  pendingPlayerAction: { type: PlayerActionType; playerId: string; playerPosition: MeterPoint } | null;
  onPendingPlayerActionCommit: () => void;
  onSvgElementChange?: (element: SVGSVGElement | null) => void;
  objectRenderScale?: Partial<Record<BoardObjectType, number>>;
  objectTouchTargetRadiusMeters?: Partial<Record<BoardObjectType, number>>;
  smartSnapEnabled?: boolean;
};

// A pointerdown-to-pointerup movement below this many CSS pixels is
// treated as a "click" (deselect), not a drag (pan) -- Figma-style empty-
// canvas behavior: press-and-release in place deselects, press-and-drag
// pans. No explicit hand/pan tool exists anymore (v0.4).
const PAN_CLICK_THRESHOLD_PX = 3;
const DOUBLE_TAP_RESET_DELAY_MS = 280;
const DOUBLE_TAP_RESET_DISTANCE_PX = 28;

type ActiveTouchPointer = {
  clientX: number;
  clientY: number;
};

type PinchGesture = {
  distancePx: number;
  centerClient: { x: number; y: number };
};

type PlayerActionDraft = {
  type: PlayerActionType;
  playerId: string;
  playerPosition: MeterPoint;
  screenPosition: MeterPoint;
};

// Pure Geometry/Handball Court/Board Scene data in, SVG out -- this
// component itself owns no scene/geometry/camera rules, only pointer-event
// wiring and rendering. Court geometry (floor/zones/lines) is always
// anchored to the BASE court viewport (the true 20x20/20x40 m surface);
// only the <svg> viewBox and pointer math use the camera-adjusted
// viewport -- zoom/pan is a pure viewing transform (see
// src/app/ui/camera/Camera2D.ts, a generic reusable camera), it never
// resizes or moves the actual court.
export default function MasterCourt({
  scene,
  activeTool,
  presentationMode = false,
  interactionMode,
  interactionCancelVersion,
  isContextMenuOpen,
  camera,
  onPlaceObject,
  onSelectObject,
  onMoveObject,
  onDeleteObject,
  onRotateObject,
  onObjectMoveGestureStart,
  onObjectMoveGestureEnd,
  onObjectRotateGestureStart,
  onObjectRotateGestureEnd,
  onPanBy,
  onZoomAt,
  onEmptyCourtPointerDown,
  onCancelToSelect,
  onFinishContinuousDrawingToSelect,
  defensiveZoneCalibration,
  calibrationMode,
  onDragDividerPoint,
  onDividerDragStart,
  onDividerDragEnd,
  defensiveZoneLabelCalibration,
  defensiveZoneLabelCalibrationMode,
  selectedDefensiveZoneLabelKey,
  onSelectDefensiveZoneLabel,
  onDragDefensiveZoneLabel,
  onRotateDefensiveZoneLabel,
  onDefensiveZoneLabelGestureStart,
  onDefensiveZoneLabelGestureEnd,
  drawings,
  onSelectDrawing,
  onMoveDrawing,
  onMoveDrawingPoint,
  onAnchorDrawingPoint,
  onDeleteDrawing,
  onDrawingGestureStart,
  onDrawingGestureEnd,
  pathDraftAnchors,
  onPathAnchorAdd,
  onPathFinishDroppingLastAnchor,
  onPathPreviewMove,
  areas,
  onCreateArea,
  onSelectArea,
  onMoveArea,
  onMoveAreaPoint,
  onResizeAreaRectangle,
  onRotateArea,
  onDeleteArea,
  onAreaGestureStart,
  onAreaGestureEnd,
  onCreatePlayerAction,
  onMovePlayerActionScreenAnchor,
  onPlayerActionGestureStart,
  onPlayerActionGestureEnd,
  onOpenPlayerActionsContextMenu,
  onOpenObjectContextMenu,
  pendingPlayerAction,
  onPendingPlayerActionCommit,
  onSvgElementChange,
  objectRenderScale = {},
  objectTouchTargetRadiusMeters = {},
  smartSnapEnabled = true,
}: MasterCourtProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingObjectIdRef = useRef<string | null>(null);
  const isDraggingDividerRef = useRef(false);
  const draggingLabelKeyRef = useRef<DefensiveZoneLabelKey | null>(null);
  const rotatingLabelKeyRef = useRef<DefensiveZoneLabelKey | null>(null);
  const draggingDrawingIdRef = useRef<string | null>(null);
  const lastDrawingPointerMeterRef = useRef<MeterPoint | null>(null);
  // Endpoint-drag -- a separate ref pair from the whole-line drag above so
  // the two gestures can never be confused: dragging a handle sets THIS
  // ref (and the handle's pointerdown stops propagation so the line's own
  // drag handler never also fires for the same gesture).
  const draggingDrawingPointRef = useRef<{ drawingId: string; pointIndex: number } | null>(null);
  const drawingEndpointSnapCandidateRef = useRef<DrawingEndpointSnapCandidate | null>(null);
  const [snapCandidateObjectId, setSnapCandidateObjectId] = useState<string | null>(null);
  const playerActionDraftRef = useRef<PlayerActionDraft | null>(null);
  const [playerActionDraft, setPlayerActionDraft] = useState<PlayerActionDraft | null>(null);
  const draggingPlayerActionIdRef = useRef<string | null>(null);
  // Area Engine v1 -- Rectangle Area is the only remaining DRAG-mode
  // create-drag preview left in this component (Drawing tools moved to
  // click-sequence-only creation in the UX Refactor, see pathDraftAnchors
  // below); AREA_POLYGON's click-sequence creation reuses
  // pathDraftAnchors/pathPreviewPoint below unchanged.
  const [areaDraft, setAreaDraft] = useState<{ start: MeterPoint; end: MeterPoint } | null>(null);
  const draggingAreaIdRef = useRef<string | null>(null);
  const lastAreaPointerMeterRef = useRef<MeterPoint | null>(null);
  // Area handle-drag interaction fix -- everything needed to resolve a
  // world pointer position into this gesture's local geometry is captured
  // ONCE here, at pointerdown (handleAreaPointHandlePointerDown), and
  // reused unchanged for every pointermove of the SAME drag. This is the
  // fix for "hela figuren flyger": the previous code read
  // getAreaRotationPivot(area.geometry) freshly on every pointermove, i.e. from
  // geometry that the PREVIOUS pointermove had already mutated -- since
  // resizing/reshaping inherently moves a shape's own centroid, and
  // AreaRenderer.tsx always rotates around that live centroid, using it as
  // the inverse-rotation pivot turned each step into visible drift that
  // compounded over the course of one drag (see AreaObject.ts's
  // resizeRectangleToFixedAnchor doc comment for the full root-cause
  // analysis). RECTANGLE and POLYGON need genuinely different frozen data
  // (a single fixed WORLD anchor point vs. a fixed pivot+rotation pair) --
  // see below -- so this is a discriminated union, not a shared shape.
  const draggingAreaPointRef = useRef<
    | { kind: "RECTANGLE"; areaId: string; cornerIndex: number; rotation: number; fixedWorldAnchor: MeterPoint }
    | { kind: "POLYGON"; areaId: string; pointIndex: number; rotation: number; pivotCentroid: MeterPoint }
    | null
  >(null);

  useEffect(() => {
    onSvgElementChange?.(svgRef.current);
    return () => onSvgElementChange?.(null);
  }, [onSvgElementChange]);
  const rotatingAreaIdRef = useRef<string | null>(null);
  // Click-sequence path creation -- the live cursor position, used both
  // to render the "rubber band" segment from the last committed anchor
  // (pathDraftAnchors, Workspace-owned) to the pointer, AND (via
  // onPathPreviewMove below) reported up to the Workspace so a
  // right-click/Enter/double-click finish can commit the drawing ending
  // exactly where the cursor is -- see finishPathWithAnchors in
  // TacticsBoardWorkspace.tsx for the bug this fixes. Updated on every
  // pointermove over the <svg> while a path is being drafted, hover or
  // drag alike.
  const [pathPreviewPoint, setPathPreviewPoint] = useState<MeterPoint | null>(null);
  // True while a left-button pointerdown on the empty court, with a
  // CLICK_SEQUENCE tool active, is captured and waiting for its matching
  // pointerup -- deliberately NOT decided by a movement threshold (see the
  // interaction-bugfix note on handleSvgPointerUp below): every such
  // pointerdown/up pair places exactly one anchor, full stop. This is
  // intentionally its OWN, separate piece of state from the pan/deselect
  // machinery below (panPointerRef/panOriginRef/pendingDeselectRef) --
  // sharing that machinery was the root cause of path clicks competing
  // with the pan-click-cancel threshold and sometimes being silently
  // dropped by ordinary hand tremor.
  const pathClickPendingRef = useRef(false);
  // Any calibration tool being active locks the SAME set of ordinary
  // interactions (pan/zoom/select/move/rotate objects) -- the two tools
  // are mutually exclusive in the UI (only one "Kalibrera..." entry point
  // can be active at a time), but every gate below ORs both flags anyway
  // as a second line of defense.
  const anyCalibrationModeActive = calibrationMode || defensiveZoneLabelCalibrationMode;
  const panPointerRef = useRef<{ x: number; y: number } | null>(null);
  // The fixed pointerdown origin (never updated during the drag, unlike
  // panPointerRef which tracks the LAST position for delta computation)
  // -- used purely to measure total travel distance for the click-vs-pan
  // decision at pointerup.
  const panOriginRef = useRef<{ x: number; y: number } | null>(null);
  // True only while a pan-or-click gesture started on the EMPTY court in
  // Markera mode is still undecided -- cleared to false the moment real
  // movement is observed (see handleSvgPointerMove), and consulted once,
  // at pointerup, to decide whether to deselect.
  const pendingDeselectRef = useRef(false);
  const rotatingObjectIdRef = useRef<string | null>(null);
  const activeTouchPointersRef = useRef<Map<number, ActiveTouchPointer>>(new Map());
  const pinchGestureRef = useRef<PinchGesture | null>(null);
  const lastTapRef = useRef<{ time: number; clientX: number; clientY: number } | null>(null);
  const lastPrimaryPointerTypeRef = useRef<string | null>(null);

  // Spatial Engine Epic I, Del 3 -- the ONE gate every handball-specific
  // rendering layer below checks. Everything else (camera, coordinate
  // system, floor rect, Object/Drawing/Area engines and the rendering
  // order) is completely unaware of `surface` -- it is a purely additive
  // gate on top of an otherwise-unchanged render, never a second code
  // path duplicating the generic layers.
  const isHandballCourt = scene.surface === "HANDBALL_COURT";

  const baseViewport = buildViewportForCourtView(scene.courtView);
  const viewport = applyCameraToViewport(baseViewport, camera);
  const resolveDrawingForRender = (drawing: DrawingObject) => defaultSpatialEngine.resolveDrawingGeometry(drawing.geometry, { scene });
  const courtLines = isHandballCourt ? buildCourtLines() : [];
  const goalAreaFills = isHandballCourt ? buildGoalAreaFills() : [];
  const goalNetFills = isHandballCourt ? buildGoalNetFills() : [];
  const defensiveZonePolygons = isHandballCourt && scene.visibleZoneLayers.defensive
    ? buildDefensiveZonePolygonsFromCalibration(defensiveZoneCalibration)
    : [];
  const transitionZones = isHandballCourt && scene.visibleZoneLayers.transition
    ? buildTransitionZones(scene.transitionDirection)
    : [];
  // Labels have an independent toggle, but must never float without
  // the zone colors they annotate -- gated on both flags
  // regardless of which order the coach happened to toggle them in.
  const showTransitionLabels = isHandballCourt && scene.visibleZoneLayers.transition && scene.visibleZoneLayers.transitionLabels;
  // Positions come from the reusable layout function (safe margins from
  // the 9 m line / center circle, accounting for the label's real
  // visual bounding box) -- never a bare zone-geometric-center.
  const transitionZoneLabelPositions = showTransitionLabels ? buildTransitionZoneLabelPositions(transitionZones) : [];
  // Same independent-toggle relationship as the transition zone labels
  // above, but calibration mode force-shows the names regardless (see
  // handleEnterDefensiveZoneLabelCalibration in TacticsBoardWorkspace.tsx)
  // so the coach can see what they're positioning.
  const showDefensiveLabels =
    isHandballCourt &&
    ((scene.visibleZoneLayers.defensive && scene.visibleZoneLayers.defensiveLabels) ||
      defensiveZoneLabelCalibrationMode);
  const defensiveZoneLabelPositions = showDefensiveLabels
    ? buildDefensiveZoneLabelPositions(defensiveZoneLabelCalibration)
    : [];
  const editableDefensiveZoneLabelPositions = defensiveZoneLabelCalibrationMode
    ? defensiveZoneLabelPositions.filter((position) => position.calibrationKey !== null)
    : [];
  const selectedDefensiveZoneLabelPosition =
    editableDefensiveZoneLabelPositions.find(
      (position) => position.calibrationKey === selectedDefensiveZoneLabelKey,
    ) ?? null;

  function isPlayerActionContextMenuTarget(object: BoardObject): boolean {
    return object.type === "ATTACKER" || object.type === "DEFENDER" || object.type === "GOALKEEPER";
  }

  function clampActionAnchorToPlayer(type: PlayerActionType, playerPosition: MeterPoint, pointerPosition: MeterPoint): MeterPoint {
    const maxLength = getPlayerActionDefinition(type).maxLengthMeters;
    const dx = pointerPosition.x - playerPosition.x;
    const dy = pointerPosition.y - playerPosition.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= maxLength || distance === 0) {
      return pointerPosition;
    }
    const scale = maxLength / distance;
    return {
      x: playerPosition.x + dx * scale,
      y: playerPosition.y + dy * scale,
    };
  }

  function buildPlayerActionDraft(
    type: PlayerActionType,
    playerId: string,
    playerPosition: MeterPoint,
    pointerPosition: MeterPoint,
  ): PlayerActionDraft {
    return {
      type,
      playerId,
      playerPosition,
      screenPosition: clampActionAnchorToPlayer(type, playerPosition, pointerPosition),
    };
  }

  function setActivePlayerActionDraft(draft: PlayerActionDraft | null): void {
    playerActionDraftRef.current = draft;
    setPlayerActionDraft(draft);
  }

  function isPlayerAnchorTarget(object: BoardObject): boolean {
    return object.type === "ATTACKER" || object.type === "DEFENDER" || object.type === "GOALKEEPER";
  }

  function buildCenteredObjectAnchorPoint(object: BoardObject): AnchorPoint {
    return {
      fallbackPosition: Object.freeze({ x: object.position.x, y: object.position.y }),
      constraint: Object.freeze({
        kind: "ANCHORED",
        target: Object.freeze({ kind: "BOARD_OBJECT", objectId: object.id }),
        attachment: Object.freeze({ kind: "CAPABILITY", capability: "CENTER" }),
      }),
    };
  }

  function findSmartBallSnapPlacement(pointer: MeterPoint): SmartBallPlacement {
    if (!smartSnapEnabled) {
      return {
        position: pointer,
        anchorPoint: anchorPointFromMeterPoint(pointer),
      };
    }
    const snapCandidate = defaultSpatialEngine.findDrawingEndpointSnapCandidate(pointer, "START", { scene });
    if (!snapCandidate) {
      return {
        position: pointer,
        anchorPoint: anchorPointFromMeterPoint(pointer),
      };
    }
    return {
      position: snapCandidate.snappedPosition,
      anchorPoint: {
        fallbackPosition: snapCandidate.snappedPosition,
        constraint: snapCandidate.constraint,
      },
    };
  }

  function resolveObjectForRender(object: BoardObject): BoardObject {
    if (!isSmartBall(object) || !object.anchorPoint) {
      return object;
    }
    const resolved = defaultSpatialEngine.resolveAnchorPoint(object.anchorPoint, { scene }).position;
    return {
      ...object,
      position: getSmartBallRenderPosition(resolved, object.anchorPoint),
    };
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setAreaDraft(null);
      playerActionDraftRef.current = null;
      setPlayerActionDraft(null);
      setPathPreviewPoint(null);
      setSnapCandidateObjectId(null);
      pathClickPendingRef.current = false;
      drawingEndpointSnapCandidateRef.current = null;
    });
    return () => {
      cancelled = true;
    };
  }, [interactionCancelVersion]);

  function pixelToMeterInViewport(clientX: number, clientY: number): MeterPoint | null {
    const svg = svgRef.current;
    if (!svg) {
      return null;
    }
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }
    return pointerPixelToMeter(
      { x: clientX - rect.left, y: clientY - rect.top },
      { width: rect.width, height: rect.height },
      viewport,
    );
  }

  function getTouchPointerPair(): [ActiveTouchPointer, ActiveTouchPointer] | null {
    const pointers = Array.from(activeTouchPointersRef.current.values());
    if (pointers.length < 2) {
      return null;
    }
    return [pointers[0], pointers[1]];
  }

  function getPinchGeometry(pair: [ActiveTouchPointer, ActiveTouchPointer]) {
    const [first, second] = pair;
    return {
      distancePx: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
      centerClient: {
        x: (first.clientX + second.clientX) / 2,
        y: (first.clientY + second.clientY) / 2,
      },
    };
  }

  function rememberTouchPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType !== "touch") {
      return;
    }
    activeTouchPointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    const pair = getTouchPointerPair();
    if (pair) {
      pinchGestureRef.current = getPinchGeometry(pair);
      panPointerRef.current = null;
      panOriginRef.current = null;
      pendingDeselectRef.current = false;
      pathClickPendingRef.current = false;
    }
  }

  function updateTouchPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType !== "touch" || !activeTouchPointersRef.current.has(event.pointerId)) {
      return;
    }
    activeTouchPointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  function forgetTouchPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType !== "touch") {
      return;
    }
    activeTouchPointersRef.current.delete(event.pointerId);
    if (activeTouchPointersRef.current.size < 2) {
      pinchGestureRef.current = null;
    }
  }

  function handlePinchMove(): boolean {
    const previous = pinchGestureRef.current;
    const pair = getTouchPointerPair();
    if (!previous || !pair) {
      return false;
    }
    const next = getPinchGeometry(pair);
    if (previous.distancePx <= 0 || next.distancePx <= 0) {
      pinchGestureRef.current = next;
      return true;
    }

    const svg = svgRef.current;
    if (!svg) {
      return true;
    }
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return true;
    }

    const focusPoint = pixelToMeterInViewport(next.centerClient.x, next.centerClient.y);
    if (focusPoint) {
      const scale = Math.min(rect.width / viewport.width, rect.height / viewport.height);
      const deltaXPx = next.centerClient.x - previous.centerClient.x;
      const deltaYPx = next.centerClient.y - previous.centerClient.y;
      if (deltaXPx !== 0 || deltaYPx !== 0) {
        onPanBy({ x: -deltaXPx / scale, y: -deltaYPx / scale });
      }
      onZoomAt(focusPoint, camera.zoom * (next.distancePx / previous.distancePx));
    }

    pinchGestureRef.current = next;
    return true;
  }

  function maybeResetOnDoubleTap(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType !== "touch" || activeTouchPointersRef.current.size > 0) {
      return;
    }
    const now = window.performance.now();
    const lastTap = lastTapRef.current;
    if (
      lastTap &&
      now - lastTap.time <= DOUBLE_TAP_RESET_DELAY_MS &&
      Math.hypot(event.clientX - lastTap.clientX, event.clientY - lastTap.clientY) <= DOUBLE_TAP_RESET_DISTANCE_PX
    ) {
      lastTapRef.current = null;
      onZoomAt({ x: baseViewport.x + baseViewport.width / 2, y: baseViewport.y + baseViewport.height / 2 }, 1);
      return;
    }
    lastTapRef.current = { time: now, clientX: event.clientX, clientY: event.clientY };
  }

  // ROOT-CAUSE FIX for "wheel over the court scrolls the page": React's
  // synthetic onWheel is registered passively at the app root for
  // performance, so calling event.preventDefault() inside a React
  // onWheel handler is a silent no-op (the browser logs a
  // "Unable to preventDefault inside passive event listener" warning and
  // scrolls anyway) -- this is exactly why an EARLIER version of this
  // handler (a React onWheel prop) failed to stop the workspace's
  // .workspace container (TacticsBoardWorkspace.module.css, the one
  // scrollable ancestor: `overflow-y: auto`) from scrolling underneath
  // the zoom. The fix is a NATIVE, non-passive listener attached directly
  // to the <svg> DOM node -- the actual visible court viewport, not the
  // whole workspace panel -- via addEventListener(..., { passive: false
  // }), with proper cleanup on unmount/dependency change.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return undefined;
    }

    function handleWheelNative(event: WheelEvent) {
      if (anyCalibrationModeActive) {
        return;
      }
      const focusPoint = pixelToMeterInViewport(event.clientX, event.clientY);
      if (!focusPoint) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const zoomFactor = computeWheelZoomFactor(event.deltaY);
      onZoomAt(focusPoint, camera.zoom * zoomFactor);
    }

    svg.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => {
      svg.removeEventListener("wheel", handleWheelNative);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, scene.courtView, onZoomAt, anyCalibrationModeActive]);

  // Bound directly on the floor rect (the court's real hit-testing
  // surface), NOT the outer <svg> -- board objects are sibling elements,
  // not descendants of the floor rect, so this fires ONLY for genuine
  // empty-court clicks with no target-vs-currentTarget check needed.
  // Only the primary (left) button acts here -- other buttons (e.g.
  // middle-click) are left alone so they can bubble to the <svg> root's
  // own pan handling.
  //
  // v0.4 (Figma-like empty-canvas behavior): when Markera (SELECT) is the
  // active tool, an empty-court pointerdown no longer deselects
  // immediately -- it starts a PENDING pan (captured on the <svg> root,
  // reusing the exact same handleSvgPointerMove/Up pan machinery the
  // former hand-tool and middle-click pan already used). The pointerup
  // handler decides retroactively: negligible movement -> treat it as a
  // click and deselect; real movement -> it was a pan, no deselect. When
  // a placement tool (or Radera) is active, behavior is unchanged and
  // immediate -- placement/delete must never be deferred.
  function handleBackgroundPointerDown(event: ReactPointerEvent<SVGRectElement>) {
    if (anyCalibrationModeActive || event.button !== 0) {
      return;
    }
    onEmptyCourtPointerDown();
    if (isContextMenuOpen) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // A drawing- or point-drag already owns this gesture (pointer capture
    // lives on the drawing/handle element, not here) -- background pan/
    // deselect/click-to-anchor must never also start. Belt-and-suspenders
    // alongside the stopPropagation calls in the drawing/endpoint handlers
    // themselves (bug: dragging a selected drawing was also panning the
    // whole plan, traced to pointermove/up events during a captured drag
    // still bubbling up to this component's own handlers).
    if (
      draggingDrawingIdRef.current ||
      draggingDrawingPointRef.current ||
      draggingAreaIdRef.current ||
      draggingAreaPointRef.current
    ) {
      return;
    }
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    if (presentationMode) {
      svg.setPointerCapture(event.pointerId);
      panPointerRef.current = { x: event.clientX, y: event.clientY };
      panOriginRef.current = null;
      pendingDeselectRef.current = false;
      return;
    }

    if (activeTool === "SELECT") {
      svg.setPointerCapture(event.pointerId);
      panPointerRef.current = { x: event.clientX, y: event.clientY };
      panOriginRef.current = { x: event.clientX, y: event.clientY };
      pendingDeselectRef.current = true;
      return;
    }

    // Drawing tools never resolve via resolveBackgroundPointerAction
    // (that function's contract only ever returns PLACE or DESELECT) --
    // creation is entirely click-sequence now (Drawing Engine UX
    // Refactor: DRAG-mode create-drag was removed -- every drawing tool
    // is CLICK_SEQUENCE, see drawingPresets.ts). Anchor-arming does NOT
    // live here -- it lives on the shared <svg> root's own pointerdown
    // handler (handleSvgPointerDown), so it fires no matter which element
    // the click actually lands on (floor, a decorative pointer-events:
    // none overlay, or the path-draft preview itself). This handler is
    // bound to the floor rect specifically, which is exactly the
    // dependency that caused later clicks (landing on the growing
    // preview curve rendered on top of the floor) to never reach an
    // anchor-creating handler at all. Simply let the event bubble.
    if (isDrawingTool(activeTool)) {
      return;
    }

    // Area Engine v1 -- same DRAG-vs-CLICK_SEQUENCE dispatch as drawing
    // tools above (never a third dispatch mechanism): Polygon Area's
    // anchor-arming lives on the <svg> root the same way Böjd
    // rörelse/passning/skottlinje's does; Rectangle Area is a plain
    // create-drag.
    if (isAreaTool(activeTool)) {
      if (getAreaCreationMode(activeTool) === "CLICK_SEQUENCE") {
        return;
      }
      const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
      if (!meterPoint) {
        return;
      }
      svg.setPointerCapture(event.pointerId);
      setAreaDraft({ start: meterPoint, end: meterPoint });
      return;
    }

    const rect = svg.getBoundingClientRect();
    const action = resolveBackgroundPointerAction(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      { width: rect.width, height: rect.height },
      viewport,
      activeTool,
    );
    if (!action) {
      return;
    }
    if (action.kind === "PLACE") {
      onPlaceObject(action.meterPoint);
    } else {
      onSelectObject(null);
    }
  }

  // Right-click finishes a click-sequence path draft (Böjd rörelse) --
  // suppresses the native context menu only while actually drafting, so
  // the browser's normal right-click menu still works everywhere else.
  //
  // Bugfix: bound to the <svg> ROOT (see the JSX below), not just the
  // floor rect -- a right-click landing on letterboxed empty space around
  // the court, or on anything else painted above the floor rect, used to
  // fall straight through to the browser's native context menu, since
  // only the rect itself had a listener. The <svg> root covers the whole
  // interactive surface regardless of what's on top at any given point.
  function handleCourtContextMenu(event: ReactMouseEvent<SVGSVGElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (interactionMode === "CONTINUOUS_DRAWING") {
      onFinishContinuousDrawingToSelect();
      return;
    }
    onCancelToSelect();
  }

  function handleObjectContextMenu(event: ReactMouseEvent<SVGGElement>, object: BoardObject) {
    if (onOpenObjectContextMenu) {
      event.preventDefault();
      event.stopPropagation();
      onOpenObjectContextMenu({
        objectId: object.id,
        objectType: object.type,
        playerPosition: object.position,
        clientPosition: { x: event.clientX, y: event.clientY },
      });
      return;
    }
    if (!isPlayerActionContextMenuTarget(object)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onOpenPlayerActionsContextMenu({
      objectId: object.id,
      objectType: object.type,
      playerPosition: object.position,
      clientPosition: { x: event.clientX, y: event.clientY },
    });
  }

  // Double-click also finishes a path draft. Each of its two clicks
  // already ran through the normal pointerdown/up click handling above
  // (pathClickPendingRef), so by the time this native dblclick event
  // fires, the second click has already appended its own anchor at
  // (essentially) the same position -- onPathFinishDroppingLastAnchor
  // drops that redundant anchor before finishing. Bound to <svg> for the
  // same full-surface-coverage reason as the context menu handler above.
  function handleCourtDoubleClick(event: ReactMouseEvent<SVGSVGElement>) {
    if (!pathDraftAnchors || lastPrimaryPointerTypeRef.current === "touch") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onPathFinishDroppingLastAnchor();
  }

  function handleObjectPointerDown(event: ReactPointerEvent<SVGGElement>, object: BoardObject) {
    if (anyCalibrationModeActive || event.button !== 0) {
      // Let middle-click (and anything else) bubble up to the <svg>
      // root's pan handler instead of starting a selection/drag.
      return;
    }
    event.stopPropagation();
    if (activeTool === "DELETE") {
      onDeleteObject(object.id);
      return;
    }
    if (activeTool === "BALL" && isPlayerAnchorTarget(object) && !presentationMode) {
      onPlaceObject(object.position, buildCenteredObjectAnchorPoint(object));
      return;
    }
    if (
      pendingPlayerAction?.type === "GOALKEEPER_LUNGE" &&
      pendingPlayerAction.playerId === object.id &&
      object.type === "GOALKEEPER"
    ) {
      event.currentTarget.setPointerCapture(event.pointerId);
      const pointerPosition = pixelToMeterInViewport(event.clientX, event.clientY) ?? object.position;
      setActivePlayerActionDraft(
        buildPlayerActionDraft(pendingPlayerAction.type, object.id, object.position, pointerPosition),
      );
      return;
    }
    onSelectObject(object.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingObjectIdRef.current = object.id;
    onObjectMoveGestureStart(object.id);
  }

  function handleObjectPointerMove(event: ReactPointerEvent<SVGGElement>, objectId: string) {
    const actionDraft = playerActionDraftRef.current;
    if (actionDraft?.playerId === objectId) {
      event.stopPropagation();
      const object = scene.objects.find((candidate) => candidate.id === objectId);
      const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
      if (object && meterPoint) {
        setActivePlayerActionDraft(buildPlayerActionDraft(actionDraft.type, objectId, object.position, meterPoint));
      }
      return;
    }
    if (draggingObjectIdRef.current !== objectId) {
      return;
    }
    event.stopPropagation();
    const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    if (meterPoint) {
      const object = scene.objects.find((candidate) => candidate.id === objectId);
      if (object && isSmartBall(object) && smartSnapEnabled) {
        const placement = findSmartBallSnapPlacement(meterPoint);
        const constraint = placement.anchorPoint?.constraint;
        setSnapCandidateObjectId(
          constraint?.kind === "ANCHORED" && constraint.target.kind === "BOARD_OBJECT"
            ? constraint.target.objectId
            : null,
        );
        onMoveObject(objectId, placement.position, placement.anchorPoint);
        return;
      }
      setSnapCandidateObjectId(null);
      onMoveObject(objectId, meterPoint);
    }
  }

  function handlePlayerActionScreenPointerDown(event: ReactPointerEvent<SVGGElement>, action: PlayerAction) {
    if (anyCalibrationModeActive || presentationMode || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingPlayerActionIdRef.current = action.id;
    onPlayerActionGestureStart(action.id);
  }

  function handlePlayerActionScreenPointerMove(event: ReactPointerEvent<SVGGElement>, actionId: string) {
    if (draggingPlayerActionIdRef.current !== actionId) {
      return;
    }
    event.stopPropagation();
    const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    if (meterPoint) {
      onMovePlayerActionScreenAnchor(actionId, meterPoint);
    }
  }

  function handlePlayerActionScreenPointerUp(event: ReactPointerEvent<SVGGElement>) {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const actionId = draggingPlayerActionIdRef.current;
    if (actionId) {
      onPlayerActionGestureEnd(actionId);
    }
    draggingPlayerActionIdRef.current = null;
  }

  function handleObjectPointerUp(event: ReactPointerEvent<SVGGElement>) {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const actionDraft = playerActionDraftRef.current;
    if (actionDraft) {
      const length = Math.hypot(
        actionDraft.screenPosition.x - actionDraft.playerPosition.x,
        actionDraft.screenPosition.y - actionDraft.playerPosition.y,
      );
      if (length >= PLAYER_ACTION_DRAFT_MIN_LENGTH_METERS) {
        onCreatePlayerAction(actionDraft);
      }
      onPendingPlayerActionCommit();
      setActivePlayerActionDraft(null);
      return;
    }
    const objectId = draggingObjectIdRef.current;
    if (objectId) {
      onObjectMoveGestureEnd(objectId);
    }
    draggingObjectIdRef.current = null;
    setSnapCandidateObjectId(null);
  }

  // Free rotation via the on-object handle -- a SEPARATE interaction from
  // object drag (handleObjectPointerDown/Move/Up above): stopPropagation
  // here means a pointerdown on the handle never reaches the parent
  // object <g>'s drag handler, so dragging the handle can never move the
  // object, and dragging the object's own shape can never rotate it.
  // Angle math is the pure computeRotationDegrees (pointerInteraction.ts)
  // -- object.position (the rotation center) is read, never written, so
  // the object's meter coordinates are never mutated by rotation.
  function handleRotationHandlePointerDown(event: ReactPointerEvent<SVGGElement>, object: BoardObject) {
    if (anyCalibrationModeActive || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    rotatingObjectIdRef.current = object.id;
    onObjectRotateGestureStart(object.id);
  }

  function handleRotationHandlePointerMove(event: ReactPointerEvent<SVGGElement>, object: BoardObject) {
    if (rotatingObjectIdRef.current !== object.id) {
      return;
    }
    event.stopPropagation();
    const pointerMeterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    if (!pointerMeterPoint) {
      return;
    }
    const rotationDegrees = computeRotationDegrees(object.position, pointerMeterPoint);
    onRotateObject(object.id, rotationDegrees);
  }

  function handleRotationHandlePointerUp(event: ReactPointerEvent<SVGGElement>) {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const objectId = rotatingObjectIdRef.current;
    if (objectId) {
      onObjectRotateGestureEnd(objectId);
    }
    rotatingObjectIdRef.current = null;
  }

  // Select/move an EXISTING drawing -- deliberately mirrors
  // handleObjectPointerDown/Move/Up's direct-manipulation structure:
  // pointerdown on existing geometry always selects and starts dragging,
  // regardless of which creation tool is active (except DELETE). This is
  // what prevents an active drawing tool from adding a new anchor when
  // the coach actually meant to move an existing line. moveDrawingBy
  // takes a DELTA (not an absolute position, unlike moveObject), so the
  // last pointer meter position is tracked to compute incremental deltas
  // per move event.
  function handleDrawingPointerDown(event: ReactPointerEvent<SVGGElement>, drawing: DrawingObject) {
    if (anyCalibrationModeActive || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    if (activeTool === "DELETE") {
      onDeleteDrawing(drawing.id);
      return;
    }
    onSelectDrawing(drawing.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingDrawingIdRef.current = drawing.id;
    lastDrawingPointerMeterRef.current = pixelToMeterInViewport(event.clientX, event.clientY);
    onDrawingGestureStart(drawing.id);
  }

  function handleDrawingPointerMove(event: ReactPointerEvent<SVGGElement>, drawingId: string) {
    if (draggingDrawingIdRef.current !== drawingId) {
      return;
    }
    // Bugfix: a captured pointer's move/up events still bubble up through
    // the DOM ancestor chain of the CAPTURING element (this <g>, up
    // through <svg>) even though they're retargeted here -- without this,
    // they reached <svg>'s own onPointerMove and (if panPointerRef
    // happened to be set from an unrelated prior gesture) could pan the
    // whole plan while dragging a drawing. stopPropagation on pointerdown
    // alone isn't enough; every event in the gesture needs its own call.
    event.stopPropagation();
    const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    if (!meterPoint) {
      return;
    }
    const last = lastDrawingPointerMeterRef.current;
    lastDrawingPointerMeterRef.current = meterPoint;
    if (last) {
      onMoveDrawing(drawingId, { x: meterPoint.x - last.x, y: meterPoint.y - last.y });
    }
  }

  function handleDrawingPointerUp(event: ReactPointerEvent<SVGGElement>) {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (draggingDrawingIdRef.current) {
      onDrawingGestureEnd(draggingDrawingIdRef.current);
    }
    draggingDrawingIdRef.current = null;
    lastDrawingPointerMeterRef.current = null;
  }

  // Endpoint editing -- dragging a single point of a SELECTED drawing's
  // geometry (see DrawingEndpointHandle.tsx). A sibling gesture to
  // handleDrawingPointerDown/Move/Up above, not a variant of it: this one
  // moves ONE point to an absolute position (onMoveDrawingPoint) instead
  // of the whole shape by a delta (onMoveDrawing). stopPropagation on
  // pointerdown is what keeps the two gestures from ever both firing for
  // the same click -- the handle sits visually on top of the line, so
  // without it this pointerdown would also bubble to the line's own
  // handleDrawingPointerDown.
  function handleDrawingEndpointPointerDown(
    event: ReactPointerEvent<SVGGElement>,
    drawingId: string,
    pointIndex: number,
  ) {
    if (anyCalibrationModeActive || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingDrawingPointRef.current = { drawingId, pointIndex };
    drawingEndpointSnapCandidateRef.current = null;
    setSnapCandidateObjectId(null);
    onDrawingGestureStart(drawingId);
  }

  function getDrawingEndpointSnapRole(drawingId: string, pointIndex: number): DrawingEndpointSnapRole | null {
    const drawing = drawings.find((candidate) => candidate.id === drawingId);
    if (!drawing) {
      return null;
    }
    const points = getDrawingGeometryPoints(resolveDrawingForRender(drawing));
    if (points.length < 2) {
      return null;
    }
    if (pointIndex === 0) {
      return "START";
    }
    return pointIndex === points.length - 1 ? "END" : null;
  }

  function findDrawingEndpointSnapCandidateForPointer(
    dragging: { drawingId: string; pointIndex: number },
    pointer: MeterPoint,
  ): DrawingEndpointSnapCandidate | null {
    const role = getDrawingEndpointSnapRole(dragging.drawingId, dragging.pointIndex);
    if (presentationMode || !role) {
      return null;
    }
    return defaultSpatialEngine.findDrawingEndpointSnapCandidate(pointer, role, { scene });
  }

  function handleDrawingEndpointPointerMove(event: ReactPointerEvent<SVGGElement>) {
    const dragging = draggingDrawingPointRef.current;
    if (!dragging) {
      return;
    }
    // Same bugfix as handleDrawingPointerMove above -- captured move/up
    // events still bubble to <svg> unless stopped here explicitly.
    event.stopPropagation();
    const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    if (!meterPoint) {
      return;
    }
    const snapCandidate = findDrawingEndpointSnapCandidateForPointer(dragging, meterPoint);
    drawingEndpointSnapCandidateRef.current = snapCandidate;
    setSnapCandidateObjectId(
      snapCandidate?.target.ref.kind === "BOARD_OBJECT" ? snapCandidate.target.ref.objectId : null,
    );
    onMoveDrawingPoint(dragging.drawingId, dragging.pointIndex, snapCandidate?.snappedPosition ?? meterPoint);
  }

  function handleDrawingEndpointPointerUp(event: ReactPointerEvent<SVGGElement>) {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const dragging = draggingDrawingPointRef.current;
    const pointerMeterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    const snapCandidate = dragging && pointerMeterPoint
      ? findDrawingEndpointSnapCandidateForPointer(dragging, pointerMeterPoint)
      : drawingEndpointSnapCandidateRef.current;
    if (dragging && snapCandidate && !presentationMode) {
      onAnchorDrawingPoint(dragging.drawingId, dragging.pointIndex, {
        fallbackPosition: snapCandidate.snappedPosition,
        constraint: snapCandidate.constraint,
      });
    }
    if (dragging) {
      onDrawingGestureEnd(dragging.drawingId);
    }
    draggingDrawingPointRef.current = null;
    drawingEndpointSnapCandidateRef.current = null;
    setSnapCandidateObjectId(null);
  }

  // Select/move an EXISTING area -- the same direct-manipulation model
  // as drawings and board objects: any non-delete tool can grab existing
  // area geometry immediately instead of starting new geometry under it.
  function handleAreaPointerDown(event: ReactPointerEvent<SVGGElement>, area: AreaObject) {
    if (anyCalibrationModeActive || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    if (activeTool === "DELETE") {
      onDeleteArea(area.id);
      return;
    }
    onSelectArea(area.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingAreaIdRef.current = area.id;
    lastAreaPointerMeterRef.current = pixelToMeterInViewport(event.clientX, event.clientY);
    onAreaGestureStart(area.id);
  }

  function handleAreaPointerMove(event: ReactPointerEvent<SVGGElement>, areaId: string) {
    if (draggingAreaIdRef.current !== areaId) {
      return;
    }
    event.stopPropagation();
    const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    if (!meterPoint) {
      return;
    }
    const last = lastAreaPointerMeterRef.current;
    lastAreaPointerMeterRef.current = meterPoint;
    if (last) {
      onMoveArea(areaId, { x: meterPoint.x - last.x, y: meterPoint.y - last.y });
    }
  }

  function handleAreaPointerUp(event: ReactPointerEvent<SVGGElement>) {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (draggingAreaIdRef.current) {
      onAreaGestureEnd(draggingAreaIdRef.current);
    }
    draggingAreaIdRef.current = null;
    lastAreaPointerMeterRef.current = null;
  }

  // Resize (Rectangle corner) / vertex editing (Polygon point) -- a
  // sibling gesture to handleAreaPointerDown/Move/Up above, mirroring
  // handleDrawingEndpointPointerDown/Move/Up. Captures everything this
  // ENTIRE gesture will need (see draggingAreaPointRef's doc comment for
  // why this must be frozen at gesture-start, not re-read live on every
  // move): for RECTANGLE, the opposite corner's WORLD position right now
  // (it must not move for the rest of the drag); for POLYGON, the current
  // centroid+rotation pivot (used to inverse-rotate the pointer on every
  // move of this same drag).
  function handleAreaPointHandlePointerDown(
    event: ReactPointerEvent<SVGGElement>,
    areaId: string,
    pointIndex: number,
  ) {
    if (anyCalibrationModeActive || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const area = areas.find((candidate) => candidate.id === areaId);
    if (!area) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (area.geometry.kind === "RECTANGLE") {
      const oppositeIndex = (pointIndex + 2) % 4;
      const oppositeLocal = getAreaGeometryPoints(area.geometry)[oppositeIndex];
      draggingAreaPointRef.current = {
        kind: "RECTANGLE",
        areaId,
        cornerIndex: pointIndex,
        rotation: area.geometry.rotation,
        fixedWorldAnchor: localAreaPointToWorld(area.geometry, oppositeLocal),
      };
    } else {
      draggingAreaPointRef.current = {
        kind: "POLYGON",
        areaId,
        pointIndex,
        rotation: area.geometry.rotation,
        pivotCentroid: getAreaRotationPivot(area.geometry),
      };
    }
    onAreaGestureStart(areaId);
  }

  function handleAreaPointHandlePointerMove(event: ReactPointerEvent<SVGGElement>) {
    const dragging = draggingAreaPointRef.current;
    if (!dragging) {
      return;
    }
    event.stopPropagation();
    const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    if (!meterPoint) {
      return;
    }
    if (dragging.kind === "RECTANGLE") {
      const geometry = resizeRectangleToFixedAnchor(dragging.rotation, dragging.fixedWorldAnchor, meterPoint);
      onResizeAreaRectangle(dragging.areaId, geometry);
    } else {
      const localPosition = worldAreaPointToLocal(dragging.pivotCentroid, dragging.rotation, meterPoint);
      onMoveAreaPoint(dragging.areaId, dragging.pointIndex, localPosition);
    }
  }

  function handleAreaPointHandlePointerUp(event: ReactPointerEvent<SVGGElement>) {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (draggingAreaPointRef.current) {
      onAreaGestureEnd(draggingAreaPointRef.current.areaId);
    }
    draggingAreaPointRef.current = null;
  }

  // Rotate a selected area -- reuses RotationHandle/computeRotationDegrees
  // completely unchanged (see CourtTransform.ts's rotatePointAroundCenter
  // doc comment for why this is mathematically consistent with the SVG
  // rotate() transform AreaRenderer.tsx applies).
  function handleAreaRotationPointerDown(event: ReactPointerEvent<SVGGElement>, area: AreaObject) {
    if (anyCalibrationModeActive || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    rotatingAreaIdRef.current = area.id;
    onAreaGestureStart(area.id);
  }

  function handleAreaRotationPointerMove(event: ReactPointerEvent<SVGGElement>, area: AreaObject) {
    if (rotatingAreaIdRef.current !== area.id) {
      return;
    }
    const pointerMeterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    if (!pointerMeterPoint) {
      return;
    }
    const pivot = getAreaRotationPivot(area.geometry);
    const rotationDegrees = computeRotationDegrees(pivot, pointerMeterPoint);
    onRotateArea(area.id, rotationDegrees);
  }

  function handleAreaRotationPointerUp(event: ReactPointerEvent<SVGGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (rotatingAreaIdRef.current) {
      onAreaGestureEnd(rotatingAreaIdRef.current);
    }
    rotatingAreaIdRef.current = null;
  }

  // Distance (meters) from an area's own rotation pivot to its farthest
  // local point -- passed as RotationHandle's objectRadiusMeters, same
  // "pass the shape's own radius, let the handle add its own fixed
  // offset on top" convention board objects already use (see
  // RotationHandle.tsx's HANDLE_OFFSET_METERS). Measured from the PIVOT
  // (getAreaRotationPivot), not getAreaCentroid, so the handle's distance
  // stays visually consistent with where it's actually centered (see
  // getAreaRotationPivot's doc comment -- for POLYGON these two points
  // are the same only until the first vertex edit, after which they
  // deliberately diverge). Generic across both geometry kinds (reads only
  // getAreaGeometryPoints), never hardcodes RECTANGLE vs POLYGON.
  function getAreaFarthestPointDistance(area: AreaObject): number {
    const pivot = getAreaRotationPivot(area.geometry);
    const points = getAreaGeometryPoints(area.geometry);
    return points.reduce((max, point) => Math.max(max, Math.hypot(point.x - pivot.x, point.y - pivot.y)), 0);
  }

  // Panning lives on the <svg> root itself (not the floor rect) so it
  // works uniformly regardless of which tool/element is under the
  // pointer. Two ways to start a pan: a left-drag on the EMPTY court
  // while Markera is active (started from handleBackgroundPointerDown
  // above, which already captured the pointer and seeded panPointerRef/
  // panOriginRef/pendingDeselectRef before any move event exists) or a
  // middle-click drag from ANY tool -- the de-facto standard in canvas/
  // board tools (Figma, Miro, ...). There is no explicit hand/pan tool
  // (v0.4 removed it).
  function handleSvgPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    rememberTouchPointer(event);
    if (event.button === 0) {
      lastPrimaryPointerTypeRef.current = event.pointerType;
    }
    if (anyCalibrationModeActive) {
      return;
    }
    if (pinchGestureRef.current) {
      event.preventDefault();
      return;
    }
    if (pendingPlayerAction?.type === "SCREEN" && event.button === 0) {
      const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
      if (meterPoint) {
        event.preventDefault();
        onCreatePlayerAction({
          type: pendingPlayerAction.type,
          playerId: pendingPlayerAction.playerId,
          playerPosition: pendingPlayerAction.playerPosition,
          screenPosition: clampActionAnchorToPlayer(pendingPlayerAction.type, pendingPlayerAction.playerPosition, meterPoint),
        });
        onPendingPlayerActionCommit();
        setActivePlayerActionDraft(null);
      }
      return;
    }
    // Bugfix: click-sequence anchor placement is armed HERE, on the
    // shared <svg> root, not on the floor rect specifically -- a click
    // must create an anchor no matter which element it lands on (floor,
    // court lines/zone fills, which are already pointer-events:none and
    // so already bubble/fall through to here, or the path-draft preview
    // itself, made pointer-events:none below specifically so it can never
    // shadow this). A drawing- or point-drag already owns its own
    // gesture and stops propagation on its own pointerdown, so this never
    // double-fires for the same click. Deliberately its own capture/
    // state, entirely decoupled from the pan/deselect machinery below --
    // every pointerdown here unconditionally arms exactly one pending
    // anchor placement, resolved at pointerup with no movement-based
    // cancellation (see pathClickPendingRef's own comment).
    const isClickSequenceDrawing =
      !presentationMode && isDrawingTool(activeTool) && getDrawingCreationMode(activeTool) === "CLICK_SEQUENCE";
    const isClickSequenceArea =
      !presentationMode && isAreaTool(activeTool) && getAreaCreationMode(activeTool) === "CLICK_SEQUENCE";
    if (event.button === 0 && (isClickSequenceDrawing || isClickSequenceArea)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      pathClickPendingRef.current = true;
      return;
    }
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panPointerRef.current = { x: event.clientX, y: event.clientY };
    panOriginRef.current = null;
    pendingDeselectRef.current = false;
  }

  function handleSvgPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    updateTouchPointer(event);
    if (handlePinchMove()) {
      event.preventDefault();
      return;
    }

    if (areaDraft) {
      const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
      if (meterPoint) {
        setAreaDraft((current) => (current ? { ...current, end: meterPoint } : current));
      }
      return;
    }

    if (pendingPlayerAction?.type === "SCREEN") {
      const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
      if (meterPoint) {
        setActivePlayerActionDraft(
          buildPlayerActionDraft(pendingPlayerAction.type, pendingPlayerAction.playerId, pendingPlayerAction.playerPosition, meterPoint),
        );
      }
      return;
    }

    // Click-sequence path creation: track the live cursor position for the
    // "rubber band" preview segment on every move (hover included, not
    // just while a click is pending). No click-vs-pan threshold logic
    // lives here anymore -- see pathClickPendingRef's comment; anchor
    // placement is resolved entirely at pointerup now. Also reported up
    // to the Workspace (onPathPreviewMove) so a right-click/Enter/
    // double-click finish can commit the drawing ending exactly where the
    // cursor is -- see finishPathWithAnchors in TacticsBoardWorkspace.tsx.
    if (pathDraftAnchors) {
      const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
      if (meterPoint) {
        setPathPreviewPoint(meterPoint);
        onPathPreviewMove(meterPoint);
      }
    }

    // A drawing-, area-, or point-drag already owns this gesture -- never
    // also pan. See the matching guard in handleBackgroundPointerDown.
    if (
      draggingDrawingIdRef.current ||
      draggingDrawingPointRef.current ||
      draggingAreaIdRef.current ||
      draggingAreaPointRef.current ||
      draggingPlayerActionIdRef.current ||
      (pendingPlayerAction && playerActionDraftRef.current)
    ) {
      return;
    }

    const start = panPointerRef.current;
    if (!start) {
      return;
    }
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    // Any real movement past the click threshold means this gesture is
    // definitely a pan, never a click -- cancel the pending deselect as
    // soon as that's established (checked against the FIXED origin, not
    // the continuously-updated last position, so small jitter across
    // many tiny move events can't falsely accumulate into "moved"). This
    // threshold is SELECT-mode's own deselect-vs-pan decision only --
    // path-anchor clicks no longer share it (see pathClickPendingRef).
    if (pendingDeselectRef.current && panOriginRef.current) {
      const totalDx = event.clientX - panOriginRef.current.x;
      const totalDy = event.clientY - panOriginRef.current.y;
      if (Math.hypot(totalDx, totalDy) > PAN_CLICK_THRESHOLD_PX) {
        pendingDeselectRef.current = false;
      }
    }

    const scale = Math.min(rect.width / viewport.width, rect.height / viewport.height);
    const deltaXPx = event.clientX - start.x;
    const deltaYPx = event.clientY - start.y;
    panPointerRef.current = { x: event.clientX, y: event.clientY };
    onPanBy({ x: -deltaXPx / scale, y: -deltaYPx / scale });
  }

  function handleSvgPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const pendingSelectTap =
      pendingDeselectRef.current &&
      panOriginRef.current &&
      Math.hypot(event.clientX - panOriginRef.current.x, event.clientY - panOriginRef.current.y) <=
        PAN_CLICK_THRESHOLD_PX;
    const wasTouchTapCandidate =
      event.pointerType === "touch" &&
      !areaDraft &&
      (pendingSelectTap || !panPointerRef.current) &&
      !pathClickPendingRef.current &&
      !draggingObjectIdRef.current &&
      !draggingDrawingIdRef.current &&
      !draggingDrawingPointRef.current &&
      !draggingAreaIdRef.current &&
      !draggingAreaPointRef.current;

    if (areaDraft) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const dx = areaDraft.end.x - areaDraft.start.x;
      const dy = areaDraft.end.y - areaDraft.start.y;
      // Too small on either axis -- treated as a plain click, nothing
      // created, same "drawn, not stamped" rule as drawings.
      if (Math.abs(dx) >= AREA_MIN_SIZE_METERS && Math.abs(dy) >= AREA_MIN_SIZE_METERS) {
        onCreateArea({
          kind: "RECTANGLE",
          x: Math.min(areaDraft.start.x, areaDraft.end.x),
          y: Math.min(areaDraft.start.y, areaDraft.end.y),
          width: Math.abs(dx),
          height: Math.abs(dy),
          rotation: 0,
        });
      }
      setAreaDraft(null);
      forgetTouchPointer(event);
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pendingDeselectRef.current) {
      onSelectObject(null);
    }
    // Bugfix: a path-anchor click used to share the SELECT-mode
    // pan-click-cancel threshold (PAN_CLICK_THRESHOLD_PX, 3 CSS px) via
    // panPointerRef/panOriginRef -- ordinary hand tremor between
    // pointerdown and pointerup routinely exceeds 3px, silently
    // cancelling the click and requiring several attempts before one
    // "stuck". pathClickPendingRef is its own, unconditional flag: every
    // pointerdown/up pair with a CLICK_SEQUENCE tool active places
    // exactly one anchor, using the SAME pixelToMeterInViewport
    // conversion pointerdown would have used, computed here at pointerup.
    if (pathClickPendingRef.current) {
      const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
      if (meterPoint) {
        onPathAnchorAdd(meterPoint);
      }
    }
    panPointerRef.current = null;
    panOriginRef.current = null;
    pendingDeselectRef.current = false;
    pathClickPendingRef.current = false;
    forgetTouchPointer(event);
    if (wasTouchTapCandidate) {
      maybeResetOnDoubleTap(event);
    }
  }

  // Calibration-mode divider dragging -- the ONLY interaction active
  // while calibrationMode is true (every other pointerdown handler above
  // early-returns in that state). Same capture/convert/release idiom as
  // the object-drag and rotation-handle handlers above.
  function handleDividerPointerDown(event: ReactPointerEvent<SVGGElement>) {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingDividerRef.current = true;
    onDividerDragStart();
  }

  function handleDividerPointerMove(event: ReactPointerEvent<SVGGElement>) {
    if (!isDraggingDividerRef.current) {
      return;
    }
    const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    if (meterPoint) {
      onDragDividerPoint(meterPoint);
    }
  }

  function handleDividerPointerUp(event: ReactPointerEvent<SVGGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    isDraggingDividerRef.current = false;
    onDividerDragEnd();
  }

  // Defensive-zone-label calibration -- same capture/convert/release idiom
  // as the divider handlers above. Dragging a label's handle both selects
  // it (so the rotation handle and the "Textstorlek" panel target it) and
  // moves it; rotation is a separate handle rendered only for whichever
  // key is currently selected.
  function handleLabelHandlePointerDown(event: ReactPointerEvent<SVGGElement>, key: DefensiveZoneLabelKey) {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingLabelKeyRef.current = key;
    onSelectDefensiveZoneLabel(key);
    onDefensiveZoneLabelGestureStart();
  }

  function handleLabelHandlePointerMove(event: ReactPointerEvent<SVGGElement>, key: DefensiveZoneLabelKey) {
    if (draggingLabelKeyRef.current !== key) {
      return;
    }
    const meterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    if (meterPoint) {
      onDragDefensiveZoneLabel(key, meterPoint);
    }
  }

  function handleLabelHandlePointerUp(event: ReactPointerEvent<SVGGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    draggingLabelKeyRef.current = null;
    onDefensiveZoneLabelGestureEnd();
  }

  function handleLabelRotationPointerDown(event: ReactPointerEvent<SVGGElement>, key: DefensiveZoneLabelKey) {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    rotatingLabelKeyRef.current = key;
    onDefensiveZoneLabelGestureStart();
  }

  function handleLabelRotationPointerMove(
    event: ReactPointerEvent<SVGGElement>,
    key: DefensiveZoneLabelKey,
    centerMeter: MeterPoint,
  ) {
    if (rotatingLabelKeyRef.current !== key) {
      return;
    }
    const pointerMeterPoint = pixelToMeterInViewport(event.clientX, event.clientY);
    if (!pointerMeterPoint) {
      return;
    }
    const rotationDegrees = computeRotationDegrees(centerMeter, pointerMeterPoint);
    onRotateDefensiveZoneLabel(key, rotationDegrees);
  }

  function handleLabelRotationPointerUp(event: ReactPointerEvent<SVGGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    rotatingLabelKeyRef.current = null;
    onDefensiveZoneLabelGestureEnd();
  }

  // Spatial Engine Epic I, Del 4 -- the PERMANENT rendering architecture.
  // Every layer below paints in exactly this order, back to front, and no
  // future feature should ever need to renegotiate it -- a new feature
  // slots INTO one of these bands (e.g. a heatmap overlay is a new kind
  // of Area; an animation trail is a new kind of Drawing), never inserted
  // between them:
  //
  //   Background  -- the floor <rect> (the court's real hit-testing
  //                  surface).
  //   Surface     -- Surface-specific decoration (goal fills/nets, court
  //                  lines) -- gated entirely behind isHandballCourt (see
  //                  above); a future Surface (e.g. a gym-floor grid)
  //                  paints its own decoration in this same band.
  //   Zones       -- defensive/transition zone fills + the zone name
  //                  labels. Interleaved with Surface by design (court
  //                  lines paint crisp on top of the zone tint, not the
  //                  other way around) -- this fine-grained ordering
  //                  within the Background/Surface/Zones band is a
  //                  deliberate visual choice, not something a future
  //                  feature should alter.
  //   Areas       -- Area Engine v1 (Del 2): generic filled/outlined
  //                  regions, plus resize/vertex/rotate handles.
  //   Drawings    -- Drawing Engine: movement/pass/shot lines, plus
  //                  endpoint handles.
  //   BoardObjects-- players/ball. Selection (SelectionLayer) and Handles
  //                  (RotationHandle) render as siblings INSIDE each
  //                  object's own <g>, immediately after
  //                  BoardObjectRenderer -- "Selection"/"Handles" are
  //                  therefore per-object bands nested at the end of
  //                  BoardObjects, not one single global overlay group.
  //
  // Calibration-mode editors (DividerLineEditor, defensive-zone-label
  // CalibrationHandle/RotationHandle) render last, as dev-tool overlays
  // outside this permanent stack entirely -- they are never part of the
  // saved scene and never interact with Areas/Drawings/BoardObjects.
  return (
    <svg
      ref={svgRef}
      className={styles.svg}
      viewBox={viewportToViewBox(viewport)}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Handbollsplan"
      onPointerDown={handleSvgPointerDown}
      onPointerMove={handleSvgPointerMove}
      onPointerUp={handleSvgPointerUp}
      onPointerCancel={handleSvgPointerUp}
      onContextMenu={handleCourtContextMenu}
      onDoubleClick={handleCourtDoubleClick}
      data-select-mode={activeTool === "SELECT" ? "true" : "false"}
      data-placement-mode={interactionMode === "PLACEMENT" ? "true" : "false"}
      data-drawing-mode={interactionMode === "CONTINUOUS_DRAWING" ? "true" : "false"}
    >
      {/* The court's real hit-testing surface -- explicit pointerEvents so
          it never silently becomes non-interactive, and the ONLY element
          that owns the empty-court click handler. Everything painted above
          it that is purely decorative (zones, lines) is pointerEvents=
          "none" so it can never shadow this rect. */}
      <rect
        x={baseViewport.x}
        y={baseViewport.y}
        width={baseViewport.width}
        height={baseViewport.height}
        className={styles.floor}
        pointerEvents="all"
        onPointerDown={handleBackgroundPointerDown}
      />

      {/* Permanent, always-visible court feature (unlike the toggleable
          zone layers below it) -- a slightly darker floor tone so the eye
          immediately reads the goal area, never a "colored" look. */}
      {goalAreaFills.map((fill) => (
        <path key={fill.id} d={fill.d} className={styles.goalAreaFill} pointerEvents="none" />
      ))}

      {/* Stylized goal net backdrop -- behind the goal line, outside the
          court bounds, a subtle "depth" cue (see buildGoalNetFills). */}
      {goalNetFills.map((fill) => (
        <path key={fill.id} d={fill.d} className={styles.goalNetFill} pointerEvents="none" />
      ))}

      {defensiveZonePolygons.map((zone) => (
        <path
          key={zone.id}
          d={zone.d}
          className={styles.defensiveZone}
          pointerEvents="none"
          data-threat={zone.threatLevel}
        >
          <title>{zone.label}</title>
        </path>
      ))}
      {transitionZones.map((zone) => (
        <rect
          key={zone.id}
          x={zone.x}
          y={zone.y}
          width={zone.width}
          height={zone.height}
          className={styles.transitionZone}
          pointerEvents="none"
          data-tone={zone.tone}
        >
          <title>{zone.label}</title>
        </rect>
      ))}

      <g className={styles.lines} pointerEvents="none">
        {courtLines.map((line) => {
          if (line.kind === "rect") {
            return (
              <rect
                key={line.id}
                x={line.x}
                y={line.y}
                width={line.width}
                height={line.height}
                className={styles.courtLine}
              />
            );
          }
          if (line.kind === "line") {
            return (
              <line
                key={line.id}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                className={styles.courtLine}
                data-dashed={line.dashed ? "true" : "false"}
                data-thick={line.thick ? "true" : "false"}
                data-hatch={line.hatch ? "true" : "false"}
              />
            );
          }
          return (
            <path
              key={line.id}
              d={line.d}
              className={styles.courtLine}
              data-dashed={line.dashed ? "true" : "false"}
              fill="none"
            />
          );
        })}
      </g>

      {showTransitionLabels
        ? transitionZoneLabelPositions.map((position) => {
            const zone = transitionZones.find((z) => z.zoneId === position.zoneId);
            if (!zone) {
              return null;
            }
            return (
              <text
                key={`${zone.id}-label`}
                x={position.x}
                y={position.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={styles.transitionZoneLabel}
                pointerEvents="none"
              >
                {zone.label}
              </text>
            );
          })
        : null}

      {defensiveZoneLabelPositions.map((position) => (
        <text
          key={position.id}
          x={position.x}
          y={position.y}
          fontSize={position.fontSize}
          transform={`rotate(${position.rotation} ${position.x} ${position.y})`}
          textAnchor="middle"
          dominantBaseline="middle"
          className={styles.defensiveZoneLabel}
          pointerEvents="none"
        >
          {position.text}
        </text>
      ))}

      {/* Area Engine v1 -- generic filled/outlined regions. Permanent
          rendering order (Spatial Engine Epic I, Del 4): Background ->
          Surface -> Zones -> Areas -> Drawings -> Board Objects ->
          Selection -> Handles -- Areas sit ABOVE the zone/line/label
          layers above and BELOW the Drawings layer just below, never the
          reverse, so a future feature never has to renegotiate paint
          order. Same "pointer handlers on the wrapping <g>, renderer
          stays presentational" split as drawings/board objects. */}
      <g className={styles.areas}>
        {areas.map((area) => (
          <g
            key={area.id}
            onPointerDown={(event) => handleAreaPointerDown(event, area)}
            onPointerMove={(event) => handleAreaPointerMove(event, area.id)}
            onPointerUp={handleAreaPointerUp}
            onPointerCancel={handleAreaPointerUp}
          >
            <AreaRenderer area={area} />
          </g>
        ))}
        {/* Resize (Rectangle corner) / vertex editing (Polygon point)
            handles -- same DrawingEndpointHandle reused unchanged,
            positions rotated into world space (rotatePointAroundCenter)
            so they visually track the shape's own rotation transform
            (see AreaRenderer.tsx). */}
        {areas
          .filter((area) => area.selected)
          .flatMap((area) => {
            const pivot = getAreaRotationPivot(area.geometry);
            return getAreaGeometryPoints(area.geometry).map((localPoint, pointIndex) => {
              const worldPoint = rotatePointAroundCenter(localPoint, pivot, area.geometry.rotation);
              return (
                <DrawingEndpointHandle
                  key={`${area.id}-${pointIndex}`}
                  x={worldPoint.x}
                  y={worldPoint.y}
                  onPointerDown={(event) => handleAreaPointHandlePointerDown(event, area.id, pointIndex)}
                  onPointerMove={handleAreaPointHandlePointerMove}
                  onPointerUp={handleAreaPointHandlePointerUp}
                  onPointerCancel={handleAreaPointHandlePointerUp}
                />
              );
            });
          })}
        {/* Rotation handle -- RotationHandle reused completely unchanged,
            positioned at the area's own rotation pivot
            (getAreaRotationPivot). */}
        {areas
          .filter((area) => area.selected)
          .map((area) => (
            <RotationHandle
              key={`${area.id}-rotation`}
              centerX={getAreaRotationPivot(area.geometry).x}
              centerY={getAreaRotationPivot(area.geometry).y}
              rotationDegrees={area.geometry.rotation}
              objectRadiusMeters={getAreaFarthestPointDistance(area)}
              onPointerDown={(event) => handleAreaRotationPointerDown(event, area)}
              onPointerMove={(event) => handleAreaRotationPointerMove(event, area)}
              onPointerUp={handleAreaRotationPointerUp}
              onPointerCancel={handleAreaRotationPointerUp}
            />
          ))}
        {areaDraft
          ? (
              <AreaRenderer
                area={createAreaObject({
                  id: "area-draft",
                  geometry: {
                    kind: "RECTANGLE",
                    x: Math.min(areaDraft.start.x, areaDraft.end.x),
                    y: Math.min(areaDraft.start.y, areaDraft.end.y),
                    width: Math.abs(areaDraft.end.x - areaDraft.start.x),
                    height: Math.abs(areaDraft.end.y - areaDraft.start.y),
                    rotation: 0,
                  },
                })}
              />
            )
          : null}
        {/* Polygon Area click-sequence live preview -- reuses
            pathDraftAnchors/pathPreviewPoint exactly like the curved
            drawing preview below, just rendered via AreaRenderer instead
            of DrawingRenderer when an area (not a drawing) tool is
            active. pointerEvents="none" for the same reason as the
            drawing preview: it must never shadow subsequent anchor
            clicks. */}
        {pathDraftAnchors && isAreaTool(activeTool)
          ? (
              <g pointerEvents="none">
                <AreaRenderer
                  area={createAreaObject({
                    id: "area-path-draft",
                    geometry: {
                      kind: "POLYGON",
                      points: pathPreviewPoint ? [...pathDraftAnchors, pathPreviewPoint] : pathDraftAnchors,
                      rotation: 0,
                      // Rotation is always 0 for a draft (a shape can't be
                      // rotated before it's even committed), so the pivot
                      // is visually inert here -- still computed properly
                      // (not a placeholder) for consistency with every
                      // other POLYGON construction site.
                      transformOrigin: computePolygonPointsCentroid(
                        pathPreviewPoint ? [...pathDraftAnchors, pathPreviewPoint] : pathDraftAnchors,
                      ),
                    },
                  })}
                />
              </g>
            )
          : null}
      </g>

      {/* Drawing Engine Foundation v1 -- generic ritlager, above plan/
          zones/lines/labels, below board objects. Each drawing's own
          pointer handlers live HERE (not inside DrawingRenderer), exactly
          mirroring how board object <g>s below wrap BoardObjectRenderer --
          DrawingRenderer itself stays purely presentational. */}
      <g className={styles.drawings}>
        {drawings.map((drawing) => (
          <g
            key={drawing.id}
            onPointerDown={(event) => handleDrawingPointerDown(event, drawing)}
            onPointerMove={(event) => handleDrawingPointerMove(event, drawing.id)}
            onPointerUp={handleDrawingPointerUp}
            onPointerCancel={handleDrawingPointerUp}
          >
            <DrawingRenderer drawing={drawing} geometry={resolveDrawingForRender(drawing)} />
          </g>
        ))}
        {/* Endpoint editing -- discrete handles on a SELECTED drawing's
            own points (see DrawingEndpointHandle.tsx), same design
            language as RotationHandle. Rendered as siblings of the
            drawing <g>s above (not nested inside one), exactly like
            RotationHandle sits alongside BoardObjectRenderer below. */}
        {drawings
          .filter((drawing) => drawing.selected)
          .flatMap((drawing) =>
            getDrawingGeometryPoints(resolveDrawingForRender(drawing)).map((point, pointIndex) => (
              <DrawingEndpointHandle
                key={`${drawing.id}-${pointIndex}`}
                x={point.x}
                y={point.y}
                onPointerDown={(event) => handleDrawingEndpointPointerDown(event, drawing.id, pointIndex)}
                onPointerMove={handleDrawingEndpointPointerMove}
                onPointerUp={handleDrawingEndpointPointerUp}
                onPointerCancel={handleDrawingEndpointPointerUp}
              />
            )),
          )}
        {/* Click-sequence path draft live preview -- the ONLY drawing
            creation preview now (Drawing Engine UX Refactor removed
            DRAG-mode creation entirely): feed the real DrawingRenderer a
            throwaway object so the preview can never visually diverge
            from what CURVE interpolation will actually render -- 2
            anchors previews as a straight line, 3+ previews as a smooth
            curve, automatically, via the exact same geometryToPathD
            switch every real drawing renders through. The in-progress
            cursor position is appended as one more point only for
            rendering; the committed anchors (pathDraftAnchors) remain
            the only thing that gets persisted on finish.

            Bugfix: wrapped in pointerEvents="none" -- DrawingRenderer's
            own hit-stroke is normally interactive (real drawings need to
            be selectable/draggable), but this is a transient PREVIEW, not
            a real drawing, and it paints on top of the floor in the same
            <g> every anchor's own click needs to reach. Left interactive,
            every click after the first one landed on the growing preview
            curve instead of ever reaching an anchor-creating handler --
            the second and every subsequent click was silently absorbed. */}
        {pathDraftAnchors && isDrawingTool(activeTool)
          ? (
              <g pointerEvents="none">
                {(() => {
                  const draftDrawing = createDrawingObject({
                    id: "path-draft",
                    geometry: {
                      kind: "CURVE",
                      points: pathPreviewPoint ? [...pathDraftAnchors, pathPreviewPoint] : pathDraftAnchors,
                    },
                    // Whichever drawing tool is actually active (Rörelse/
                    // Passning/Skott) -- not hardcoded to one, so the live
                    // preview always matches the color/dash/arrow the
                    // committed drawing will have.
                    semantic: { type: activeTool, createdBy: "USER" },
                  });
                  return <DrawingRenderer drawing={draftDrawing} geometry={resolveDrawingForRender(draftDrawing)} />;
                })()}
              </g>
            )
          : null}
      </g>

      <g className={styles.playerActions} pointerEvents="none">
        {scene.playerActions.map((action) => (
          <g
            key={action.id}
            onPointerMove={(event) => handlePlayerActionScreenPointerMove(event, action.id)}
            onPointerUp={handlePlayerActionScreenPointerUp}
            onPointerCancel={handlePlayerActionScreenPointerUp}
          >
            <PlayerActionRenderer
              action={action}
              scene={scene}
              onScreenPointerDown={handlePlayerActionScreenPointerDown}
            />
          </g>
        ))}
        {pendingPlayerAction && playerActionDraft ? (
          <PlayerActionRenderer
            action={createPlayerAction({
              id: "player-action-draft",
              type: playerActionDraft.type,
              playerId: playerActionDraft.playerId,
              playerPosition: playerActionDraft.playerPosition,
              screenPosition: playerActionDraft.screenPosition,
              style: { opacity: 0.55 },
            })}
            scene={scene}
          />
        ) : null}
      </g>

      <g className={styles.playerStates} pointerEvents="none">
        {scene.playerStates.map((state) => (
          <PlayerStateRenderer key={state.id} state={state} scene={scene} />
        ))}
      </g>

      <g className={styles.objects}>
        {scene.objects.map((object) => {
          const renderObject = resolveObjectForRender(object);
          const isSelected = scene.selectedObjectId === object.id;
          const definition = BOARD_OBJECT_DEFINITIONS[object.type];
          const renderScale = objectRenderScale[object.type] ?? 1;
          const objectRadiusMeters = (definition.physicalSizeMeters * renderScale) / 2;
          const touchTargetRadiusMeters = Math.max(
            objectRadiusMeters,
            objectTouchTargetRadiusMeters[object.type] ?? objectRadiusMeters,
          );

          return (
            <g
              key={object.id}
              tabIndex={0}
              role="button"
              aria-label={`${OBJECT_LABELS[object.type]}${object.label ? ` ${object.label}` : ""}`}
              aria-pressed={isSelected}
              data-selected={isSelected ? "true" : "false"}
              data-snap-candidate={snapCandidateObjectId === object.id ? "true" : "false"}
              className={styles.boardObject}
              onPointerDown={(event) => handleObjectPointerDown(event, object)}
              onPointerMove={(event) => handleObjectPointerMove(event, object.id)}
              onPointerUp={handleObjectPointerUp}
              onPointerCancel={handleObjectPointerUp}
              onContextMenu={(event) => handleObjectContextMenu(event, object)}
            >
              {touchTargetRadiusMeters > objectRadiusMeters ? (
                <circle
                  cx={renderObject.position.x}
                  cy={renderObject.position.y}
                  r={touchTargetRadiusMeters}
                  fill="transparent"
                  stroke="none"
                  pointerEvents="all"
                  aria-hidden="true"
                />
              ) : null}
              <BoardObjectRenderer object={renderObject} sizeScale={renderScale} />
              {isSelected ? (
                <SelectionLayer
                  centerX={renderObject.position.x}
                  centerY={renderObject.position.y}
                  objectRadiusMeters={objectRadiusMeters}
                />
              ) : null}
              {isSelected && definition.supportsRotation ? (
                <RotationHandle
                  centerX={renderObject.position.x}
                  centerY={renderObject.position.y}
                  rotationDegrees={object.rotation}
                  objectRadiusMeters={objectRadiusMeters}
                  onPointerDown={(event) => handleRotationHandlePointerDown(event, object)}
                  onPointerMove={(event) => handleRotationHandlePointerMove(event, object)}
                  onPointerUp={handleRotationHandlePointerUp}
                  onPointerCancel={handleRotationHandlePointerUp}
                />
              ) : null}
            </g>
          );
        })}
      </g>

      {calibrationMode
        ? (
            <DividerLineEditor
              divider={defensiveZoneCalibration.v1v2}
              label={V1_V2_DIVIDER_LABEL}
              onEndPointerDown={handleDividerPointerDown}
              onEndPointerMove={handleDividerPointerMove}
              onEndPointerUp={handleDividerPointerUp}
              onEndPointerCancel={handleDividerPointerUp}
            />
          )
        : null}

      {defensiveZoneLabelCalibrationMode ? (
        <g aria-label="Kalibrering av försvarszonsetiketter">
          {editableDefensiveZoneLabelPositions.map((position) => {
            const key = position.calibrationKey as DefensiveZoneLabelKey;
            return (
              <CalibrationHandle
                key={position.id}
                x={position.x}
                y={position.y}
                label={`${position.text} -- dra för att flytta`}
                onPointerDown={(event) => handleLabelHandlePointerDown(event, key)}
                onPointerMove={(event) => handleLabelHandlePointerMove(event, key)}
                onPointerUp={handleLabelHandlePointerUp}
                onPointerCancel={handleLabelHandlePointerUp}
              />
            );
          })}
          {selectedDefensiveZoneLabelPosition ? (
            <RotationHandle
              centerX={selectedDefensiveZoneLabelPosition.x}
              centerY={selectedDefensiveZoneLabelPosition.y}
              rotationDegrees={selectedDefensiveZoneLabelPosition.rotation}
              objectRadiusMeters={DEFENSIVE_ZONE_LABEL_ROTATION_HANDLE_DISTANCE_METERS}
              onPointerDown={(event) =>
                handleLabelRotationPointerDown(event, selectedDefensiveZoneLabelKey)
              }
              onPointerMove={(event) =>
                handleLabelRotationPointerMove(event, selectedDefensiveZoneLabelKey, {
                  x: selectedDefensiveZoneLabelPosition.x,
                  y: selectedDefensiveZoneLabelPosition.y,
                })
              }
              onPointerUp={handleLabelRotationPointerUp}
              onPointerCancel={handleLabelRotationPointerUp}
            />
          ) : null}
        </g>
      ) : null}
    </svg>
  );
}
