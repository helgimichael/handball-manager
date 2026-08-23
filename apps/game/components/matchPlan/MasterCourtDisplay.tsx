"use client";

// HM-TACTICS-1.1/1.2: isolates MasterCourt's ~35 no-op interaction
// callbacks (this workspace keeps the court a display-only backdrop --
// all actual editing happens through CourtBoard's own chip overlay, see
// Part 3) so callers stay readable. Extracted to its own file in 1.2 so
// CourtBoard.tsx can reuse it without duplicating this prop wall.
import MasterCourt, { type InteractionMode, type ToolId } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/MasterCourt.tsx";
import { APPROVED_DEFENSIVE_ZONE_CALIBRATION, APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/geometry/HandballCourtGeometry.ts";
import { DEFAULT_CAMERA } from "@handball-manager/match-renderer/src/ui/camera/Camera2D.ts";
import type { TacticsBoardScene } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/TacticsBoardScene.ts";

function noop() {}

export default function MasterCourtDisplay({ scene }: { scene: TacticsBoardScene }) {
  const activeTool: ToolId = "SELECT";
  const interactionMode: InteractionMode = "IDLE";
  return (
    <MasterCourt
      scene={scene}
      activeTool={activeTool}
      interactionMode={interactionMode}
      interactionCancelVersion={0}
      isContextMenuOpen={false}
      camera={DEFAULT_CAMERA}
      onPlaceObject={noop}
      onSelectObject={noop}
      onMoveObject={noop}
      onDeleteObject={noop}
      onRotateObject={noop}
      onObjectMoveGestureStart={noop}
      onObjectMoveGestureEnd={noop}
      onObjectRotateGestureStart={noop}
      onObjectRotateGestureEnd={noop}
      onPanBy={noop}
      onZoomAt={noop}
      onEmptyCourtPointerDown={noop}
      onCancelToSelect={noop}
      onFinishContinuousDrawingToSelect={noop}
      defensiveZoneCalibration={APPROVED_DEFENSIVE_ZONE_CALIBRATION}
      calibrationMode={false}
      onDragDividerPoint={noop}
      onDividerDragStart={noop}
      onDividerDragEnd={noop}
      defensiveZoneLabelCalibration={APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION}
      defensiveZoneLabelCalibrationMode={false}
      selectedDefensiveZoneLabelKey="center"
      onSelectDefensiveZoneLabel={noop}
      onDragDefensiveZoneLabel={noop}
      onRotateDefensiveZoneLabel={noop}
      onDefensiveZoneLabelGestureStart={noop}
      onDefensiveZoneLabelGestureEnd={noop}
      drawings={[]}
      onSelectDrawing={noop}
      onMoveDrawing={noop}
      onMoveDrawingPoint={noop}
      onAnchorDrawingPoint={noop}
      onDeleteDrawing={noop}
      onDrawingGestureStart={noop}
      onDrawingGestureEnd={noop}
      pathDraftAnchors={null}
      onPathAnchorAdd={noop}
      onPathFinishDroppingLastAnchor={noop}
      onPathPreviewMove={noop}
      areas={[]}
      onCreateArea={noop}
      onSelectArea={noop}
      onMoveArea={noop}
      onMoveAreaPoint={noop}
      onResizeAreaRectangle={noop}
      onRotateArea={noop}
      onDeleteArea={noop}
      onAreaGestureStart={noop}
      onAreaGestureEnd={noop}
      onCreatePlayerAction={noop}
      onMovePlayerActionScreenAnchor={noop}
      onPlayerActionGestureStart={noop}
      onPlayerActionGestureEnd={noop}
      onOpenPlayerActionsContextMenu={noop}
      pendingPlayerAction={null}
      onPendingPlayerActionCommit={noop}
    />
  );
}
