"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MasterCourt, {
  type InteractionMode,
  type ToolId,
} from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/MasterCourt.tsx";
import {
  APPROVED_DEFENSIVE_ZONE_CALIBRATION,
  APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION,
} from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/geometry/HandballCourtGeometry.ts";
import { DEFAULT_CAMERA } from "@handball-manager/match-renderer/src/ui/camera/Camera2D.ts";
import { designSystemTheme } from "@handball-manager/match-renderer/src/ui/design-system/index.ts";
import { initialHalfCourt6v6State } from "@handball-manager/handball-engine/src/scenarios/halfCourt6v6.ts";
import {
  createSimulationRuntime,
  executeRuntimeCommand,
  runSimulationTick,
  type SimulationRuntimeState,
} from "@handball-manager/handball-engine/src/ui/simulationRuntime.ts";
import { evaluateSixZeroDefense } from "@handball-manager/handball-engine/src/policies/defense/sixZeroDefensePolicy.ts";
import { planFixedSteps, SIMULATION_DT_SECONDS } from "@handball-manager/handball-engine/src/simulation/fixedStep.ts";
import { toMatchRenderSnapshot, snapshotToScene } from "@handball-manager/match-integration";

// HM-0.2E first live bridge (SIM runtime -> MatchRenderSnapshot ->
// FIELD scene). This host is genuinely new code, not a copy of SIM's
// own SimulatorWorkspace.tsx (that file remains an app/ui/render
// REFERENCE ONLY per HM-0.1 -- it was never in the migration scope and
// is not imported here). It reuses the existing, unmodified
// handball-engine runtime host (createSimulationRuntime/
// runSimulationTick/executeRuntimeCommand + the fixed-step accumulator
// pattern from simulation/fixedStep.ts) rather than building a second
// simulation clock; the only thing new here is the requestAnimationFrame
// loop wiring a browser can drive, which cannot itself be "migrated"
// since it did not exist in this reusable form in either source repo.

function noop() {}

function createInitialRuntime(): SimulationRuntimeState {
  return createSimulationRuntime(initialHalfCourt6v6State);
}

export default function MatchDemoPage() {
  const [runtime, setRuntime] = useState<SimulationRuntimeState>(createInitialRuntime);
  const [isPlaying, setIsPlaying] = useState(false);

  const runtimeRef = useRef(runtime);
  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);

  // Stored in a ref (not called directly by name) so the rAF loop can
  // re-schedule itself without a self-referential useCallback, which
  // react-hooks/immutability flags as accessing the callback before its
  // own declaration is stable.
  const tickRef = useRef<(timestampMs: number) => void>(() => {});
  useEffect(() => {
    tickRef.current = (timestampMs: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestampMs;
      }
      const elapsedSeconds = Math.max(0, (timestampMs - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = timestampMs;

      const plan = planFixedSteps(elapsedSeconds, accumulatorRef.current);
      accumulatorRef.current = plan.accumulatorSeconds;

      if (plan.steps > 0) {
        let current = runtimeRef.current;
        for (let i = 0; i < plan.steps; i += 1) {
          current = runSimulationTick(current, SIMULATION_DT_SECONDS, evaluateSixZeroDefense).runtime;
        }
        runtimeRef.current = current;
        setRuntime(current);
      }

      rafRef.current = requestAnimationFrame((next) => tickRef.current(next));
    };
  });

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      return;
    }
    setIsPlaying(true);
    lastFrameTimeRef.current = null;
    rafRef.current = requestAnimationFrame((next) => tickRef.current(next));
  }, [isPlaying]);

  const handlePause = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameTimeRef.current = null;
    setIsPlaying(false);
  }, []);

  const handleStep = useCallback(() => {
    if (isPlaying) {
      return;
    }
    const next = runSimulationTick(runtimeRef.current, SIMULATION_DT_SECONDS, evaluateSixZeroDefense).runtime;
    runtimeRef.current = next;
    setRuntime(next);
  }, [isPlaying]);

  const handleReset = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameTimeRef.current = null;
    accumulatorRef.current = 0;
    setIsPlaying(false);
    const next = createInitialRuntime();
    runtimeRef.current = next;
    setRuntime(next);
  }, []);

  const handlePass = useCallback(() => {
    const world = runtimeRef.current.world;
    if (world.ball.status !== "POSSESSED" || !world.ball.possessorId) {
      return;
    }
    const passer = world.players.find((player) => player.id === world.ball.possessorId);
    const receiver = world.players.find((player) => player.team === "ATTACK" && player.id !== world.ball.possessorId);
    if (!passer || !receiver) {
      return;
    }
    const result = executeRuntimeCommand(
      runtimeRef.current,
      { type: "PASS", fromPlayerId: passer.id, toPlayerId: receiver.id },
      evaluateSixZeroDefense,
      0,
      "PASS",
    );
    runtimeRef.current = result.runtime;
    setRuntime(result.runtime);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const snapshot = toMatchRenderSnapshot(runtime.world);
  const scene = snapshotToScene(snapshot);
  const activeTool: ToolId = "SELECT";
  const interactionMode: InteractionMode = "IDLE";
  const canPass = runtime.world.ball.status === "POSSESSED" && runtime.world.ball.possessorId !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", background: "#0a1414" }}>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          padding: "0.5rem 0.75rem",
          background: "#0f1a1a",
          color: "#fff",
          fontFamily: "monospace",
          fontSize: "13px",
        }}
      >
        <button type="button" onClick={handlePlay} disabled={isPlaying}>
          PLAY
        </button>
        <button type="button" onClick={handlePause} disabled={!isPlaying}>
          PAUSE
        </button>
        <button type="button" onClick={handleStep} disabled={isPlaying}>
          STEP
        </button>
        <button type="button" onClick={handleReset}>
          RESET
        </button>
        <button type="button" onClick={handlePass} disabled={!canPass}>
          PASS
        </button>
        <span style={{ marginLeft: "1rem" }}>
          t={snapshot.simulationTime.toFixed(2)}s ball={snapshot.ball.status} possessor={snapshot.ball.possessorPlayerId ?? "-"}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, ...designSystemTheme }}>
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
    </div>
  );
}
