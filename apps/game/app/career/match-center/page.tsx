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
import { createHalfCourt6v6StateWithGoalkeeper } from "@handball-manager/handball-engine/src/scenarios/halfCourt6v6.ts";
import {
  createSimulationRuntime,
  executeRuntimeCommand,
  runSimulationTick,
  type SimulationRuntimeState,
} from "@handball-manager/handball-engine/src/ui/simulationRuntime.ts";
import { evaluateSixZeroDefense } from "@handball-manager/handball-engine/src/policies/defense/sixZeroDefensePolicy.ts";
import { planFixedSteps, SIMULATION_DT_SECONDS } from "@handball-manager/handball-engine/src/simulation/fixedStep.ts";
import {
  toMatchRenderSnapshot,
  snapshotToScene,
  createMatchSequence,
  advanceMatchSequence,
  type MatchSequenceState,
} from "@handball-manager/match-integration";
import { getClub, getNextFixture, getPlayerClub } from "@/lib/game-data";
import ClubCrest from "@/components/ClubCrest";

// HM-GAME-0.1 Match Center: the existing HM-0.2E/HM-0.3/HM-0.4A live
// SIM -> FIELD engine slice (unmodified), framed in manager-game chrome.
// This is NOT a full match simulation -- it demonstrates the same
// verified PASS/ATTACK/6:0-defense/goalkeeper bridge as apps/match-demo,
// inside the actual game shell. apps/match-demo remains available
// separately as the focused engine debug host.

function noop() {}

const SEQUENCE_PASSER_ID = "attack-attack-6-3";
const SEQUENCE_RECEIVER_ID = "attack-attack-6-6";
const SEQUENCE_ATTACK_GAP_ID = "V3_H3" as const;

function createInitialRuntime(): SimulationRuntimeState {
  return createSimulationRuntime(createHalfCourt6v6StateWithGoalkeeper());
}

export default function MatchCenterPage() {
  const club = getPlayerClub();
  const fixture = getNextFixture();
  const opponent = fixture ? getClub(fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId) : null;

  const [runtime, setRuntime] = useState<SimulationRuntimeState>(createInitialRuntime);
  const [isPlaying, setIsPlaying] = useState(false);

  const runtimeRef = useRef(runtime);
  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  const [sequence, setSequence] = useState<MatchSequenceState | null>(null);
  const sequenceRef = useRef(sequence);
  useEffect(() => {
    sequenceRef.current = sequence;
  }, [sequence]);

  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);

  const advanceOneFixedStep = useCallback((current: SimulationRuntimeState): SimulationRuntimeState => {
    let next = current;
    if (sequenceRef.current) {
      const decision = advanceMatchSequence(sequenceRef.current, next.world);
      sequenceRef.current = decision.sequence;
      setSequence(decision.sequence);
      if (decision.command) {
        next = executeRuntimeCommand(next, decision.command, evaluateSixZeroDefense, 0, decision.command.type).runtime;
      }
    }
    return runSimulationTick(next, SIMULATION_DT_SECONDS, evaluateSixZeroDefense).runtime;
  }, []);

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
          current = advanceOneFixedStep(current);
        }
        runtimeRef.current = current;
        setRuntime(current);
      }

      rafRef.current = requestAnimationFrame((next) => tickRef.current(next));
    };
  });

  const handlePlay = useCallback(() => {
    if (isPlaying) return;
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
    if (isPlaying) return;
    const next = advanceOneFixedStep(runtimeRef.current);
    runtimeRef.current = next;
    setRuntime(next);
  }, [isPlaying, advanceOneFixedStep]);

  const handleReset = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameTimeRef.current = null;
    accumulatorRef.current = 0;
    setIsPlaying(false);
    sequenceRef.current = null;
    setSequence(null);
    const next = createInitialRuntime();
    runtimeRef.current = next;
    setRuntime(next);
  }, []);

  const handleRunSequence = useCallback(() => {
    const next = createMatchSequence({ passerId: SEQUENCE_PASSER_ID, receiverId: SEQUENCE_RECEIVER_ID, attackGapId: SEQUENCE_ATTACK_GAP_ID });
    sequenceRef.current = next;
    setSequence(next);
    handlePlay();
  }, [handlePlay]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const snapshot = toMatchRenderSnapshot(runtime.world);
  const scene = snapshotToScene(snapshot);
  const activeTool: ToolId = "SELECT";
  const interactionMode: InteractionMode = "IDLE";
  const canPass = runtime.world.ball.status === "POSSESSED" && runtime.world.ball.possessorId !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div className="hm-panel">
        <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, padding: "12px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={28} />
            <span style={{ fontWeight: 800, fontSize: "var(--hm-text-sm)" }}>{club.shortName}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "var(--hm-text-xl)", fontWeight: 800 }}>0 – 0</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: "var(--hm-text-sm)" }}>{opponent?.shortName ?? "Motstånd"}</span>
            {opponent ? <ClubCrest shortName={opponent.shortName} primaryColor={opponent.primaryColor} size={28} /> : null}
          </div>
          <span className="hm-badge hm-badge-neutral" style={{ marginLeft: 12 }}>
            Motorstatus: t={snapshot.simulationTime.toFixed(2)}s · boll={snapshot.ball.status}
            {sequence ? ` · sekvens=${sequence.phase}` : ""}
          </span>
        </div>
      </div>

      <div className="hm-panel" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
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
        <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--hm-border-subtle)", background: "var(--hm-surface-2)" }}>
          <button type="button" className="hm-btn hm-btn-primary" onClick={handlePlay} disabled={isPlaying}>PLAY</button>
          <button type="button" className="hm-btn" onClick={handlePause} disabled={!isPlaying}>PAUSE</button>
          <button type="button" className="hm-btn" onClick={handleStep} disabled={isPlaying}>STEP</button>
          <button type="button" className="hm-btn" onClick={handleReset}>RESET</button>
          <button
            type="button"
            className="hm-btn"
            disabled={!canPass}
            onClick={() => {
              const world = runtimeRef.current.world;
              if (world.ball.status !== "POSSESSED" || !world.ball.possessorId) return;
              const passer = world.players.find((p) => p.id === world.ball.possessorId);
              const receiver = world.players.find((p) => p.team === "ATTACK" && p.id !== world.ball.possessorId);
              if (!passer || !receiver) return;
              const result = executeRuntimeCommand(runtimeRef.current, { type: "PASS", fromPlayerId: passer.id, toPlayerId: receiver.id }, evaluateSixZeroDefense, 0, "PASS");
              runtimeRef.current = result.runtime;
              setRuntime(result.runtime);
            }}
          >
            PASS
          </button>
          <button type="button" className="hm-btn hm-btn-primary" onClick={handleRunSequence} disabled={isPlaying}>
            KÖR SEKVENS
          </button>
          <span className="hm-text-muted" style={{ marginLeft: "auto", alignSelf: "center", fontSize: "var(--hm-text-2xs)" }}>
            Nuvarande motorslice: PASS · ATTACK · 6:0-försvar · målvakt (utan matchlogik)
          </span>
        </div>
      </div>
    </div>
  );
}
