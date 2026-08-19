"use client";

import { useState } from "react";
import MasterCourt, {
  type InteractionMode,
  type ToolId,
} from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/MasterCourt.tsx";
import { createInitialScene, type TacticsBoardScene } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/TacticsBoardScene.ts";
import { FORMATIONS, createFormationObjects } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/library/FormationLibrary.ts";
import {
  APPROVED_DEFENSIVE_ZONE_CALIBRATION,
  APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION,
} from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/geometry/HandballCourtGeometry.ts";
import { DEFAULT_CAMERA } from "@handball-manager/match-renderer/src/ui/camera/Camera2D.ts";
import { designSystemTheme } from "@handball-manager/match-renderer/src/ui/design-system/index.ts";

// Verification harness only (HM-0.2C) -- proves the migrated FIELD court
// engine renders with visual parity to its source. Every MasterCourt
// interaction callback below is a no-op: this page renders a fixed
// scene (a placed 6:0 defence + attack-6 formation, matching the object
// count Smiðja's own parity pass used as its live smoke test: 6
// defenders + 1 GK + 6 attackers + 1 ball = 14) to confirm geometry,
// clipping, player/ball rendering, and theme application -- it is not
// an interactive board and is not the Handball Manager desktop app.
function buildSmokeTestScene(): TacticsBoardScene {
  const defence = FORMATIONS.find((formation) => formation.id === "defence-6-0");
  const attack = FORMATIONS.find((formation) => formation.id === "attack-6");
  if (!defence || !attack) {
    throw new Error("Expected defence-6-0 and attack-6 formations to exist in FORMATIONS");
  }
  return createInitialScene({
    objects: [
      ...createFormationObjects(defence, "defence"),
      ...createFormationObjects(attack, "attack"),
    ],
  });
}

const noop = () => {};

export default function FieldSmokeTestPage() {
  const [scene] = useState<TacticsBoardScene>(buildSmokeTestScene);
  const activeTool: ToolId = "SELECT";
  const interactionMode: InteractionMode = "IDLE";

  return (
    <div style={{ ...designSystemTheme, width: "100vw", height: "100vh", background: "#0a1414" }}>
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
    </div>
  );
}
