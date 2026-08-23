"use client";

// HM-TACTICS-1.1 Part C/D/E/F: the central interaction -- an
// independent ANFALL | FÖRSVAR "court phase" switch, each editing its
// own starting unit (HM-TACTICS-1.0's AttackStartingUnit /
// DefenceStartingUnit) via simple click/select assignment (Part D:
// "Prefer simple click/select... do not build fancy drag/drop").
// MasterCourt is reused purely as a visual backdrop, now actually
// driven by the current formation choice (components/matchPlan/
// courtScene.ts) instead of a disconnected static scene.
import { useState } from "react";
import MasterCourt, { type InteractionMode, type ToolId } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/MasterCourt.tsx";
import { APPROVED_DEFENSIVE_ZONE_CALIBRATION, APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/geometry/HandballCourtGeometry.ts";
import { DEFAULT_CAMERA } from "@handball-manager/match-renderer/src/ui/camera/Camera2D.ts";
import { designSystemTheme } from "@handball-manager/match-renderer/src/ui/design-system/index.ts";
import Tabs from "@/components/Tabs";
import { OUTCOURT_POSITIONS, type OutcourtPositionId } from "@/lib/rating/types";
import { ATTACK_FORMATION_LABELS_SV, matchPlanPositionLabel } from "@/lib/matchPlan/matchPlanLabels";
import { assignAttackGoalkeeper, assignDefenceCourtSlot, assignDefenceGoalkeeper, assignNormalAttackSlot, assignSevenVSixSlot, setAttackFormation, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import type { AttackFormation, MatchPlan } from "@/lib/matchPlan/types";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";
import { buildAttackScene, buildDefenceScene, DEFENCE_FORMATION_OPTIONS } from "./courtScene";
import SevenVSixPolicyControl from "./SevenVSixPolicyControl";

function noop() {}

const ATTACK_FORMATIONS: readonly AttackFormation[] = ["NORMAL", "SEVEN_V_SIX"];
type CourtPhase = "ATTACK" | "DEFENCE";

export default function StartingUnitEditor({
  plan,
  selectablePlayers,
  onChange,
  onOpenPlayerPanel,
}: {
  plan: MatchPlan;
  selectablePlayers: readonly SelectablePlayer[];
  onChange: OnMatchPlanChange;
  onOpenPlayerPanel: (playerId: string) => void;
}) {
  const [phase, setPhase] = useState<CourtPhase>("ATTACK");

  const byId = new Map(selectablePlayers.map((p) => [p.playerId, p]));
  const nameOf = (playerId: string) => byId.get(playerId)?.fullName ?? playerId;
  const goalkeepers = plan.squad.players.filter((p) => p.position === "GK");
  const outcourt = plan.squad.players.filter((p) => p.position !== "GK");

  const scene = phase === "ATTACK" ? buildAttackScene(plan.attackStartingUnit.formation) : buildDefenceScene(plan.defencePlan.baseFormation);

  return (
    <div className="hm-panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="hm-panel-header">
        <span className="hm-panel-title">Startuppställning</span>
        <Tabs value={phase} options={["ATTACK", "DEFENCE"] as const} renderLabel={(v) => (v === "ATTACK" ? "ANFALL" : "FÖRSVAR")} onChange={setPhase} />
      </div>

      <div style={{ height: 260, ...designSystemTheme }}>
        <MasterCourtDisplay scene={scene} />
      </div>

      {phase === "ATTACK" ? (
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Tabs value={plan.attackStartingUnit.formation} options={ATTACK_FORMATIONS} renderLabel={(v) => ATTACK_FORMATION_LABELS_SV[v]} onChange={(v) => onChange((prev) => setAttackFormation(prev, v))} />
          </div>
          <SevenVSixPolicyControl plan={plan} onChange={onChange} />

          {plan.attackStartingUnit.formation === "NORMAL" ? (
            <>
              <SlotRow
                label={matchPlanPositionLabel("GK")}
                playerId={plan.attackStartingUnit.slots.find((s) => s.position === "GK")?.playerId}
                options={goalkeepers}
                nameOf={nameOf}
                onAssign={(playerId) => onChange((prev) => assignAttackGoalkeeper(prev, playerId))}
                onInfo={onOpenPlayerPanel}
              />
              {(OUTCOURT_POSITIONS as readonly OutcourtPositionId[]).map((position) => (
                <SlotRow
                  key={position}
                  label={matchPlanPositionLabel(position)}
                  playerId={plan.attackStartingUnit.slots.find((s) => s.position === position)?.playerId}
                  options={outcourt}
                  nameOf={nameOf}
                  onAssign={(playerId) => onChange((prev) => assignNormalAttackSlot(prev, position, playerId))}
                  onInfo={onOpenPlayerPanel}
                />
              ))}
            </>
          ) : (
            plan.attackStartingUnit.slots.map((slot, i) => (
              <SlotRow
                key={i}
                label={`Anfallare ${i + 1} (${matchPlanPositionLabel(slot.position)})`}
                playerId={slot.playerId}
                options={outcourt}
                nameOf={nameOf}
                onAssign={(playerId) => onChange((prev) => assignSevenVSixSlot(prev, i, playerId, byId.get(playerId)?.position ?? prev.attackStartingUnit.slots[i]?.position ?? slot.position))}
                onInfo={onOpenPlayerPanel}
              />
            ))
          )}
        </div>
      ) : (
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            <span className="hm-eyebrow">Formation</span>
            <select className="hm-select" style={selectStyle} value={plan.defencePlan.baseFormation} onChange={(e) => { const baseFormation = e.target.value; onChange((prev) => ({ ...prev, defencePlan: { ...prev.defencePlan, baseFormation } })); }}>
              {DEFENCE_FORMATION_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <SlotRow label="Målvakt" playerId={plan.defenceStartingUnit.goalkeeperId} options={goalkeepers} nameOf={nameOf} onAssign={(playerId) => onChange((prev) => assignDefenceGoalkeeper(prev, playerId))} onInfo={onOpenPlayerPanel} />
          {plan.defenceStartingUnit.courtSlots
            .slice()
            .sort((a, b) => a.courtSlot - b.courtSlot)
            .map((slot) => (
              <SlotRow
                key={slot.courtSlot}
                label={`Försvarsruta ${slot.courtSlot}`}
                playerId={slot.playerId}
                options={outcourt}
                nameOf={nameOf}
                onAssign={(playerId) => onChange((prev) => assignDefenceCourtSlot(prev, slot.courtSlot, playerId))}
                onInfo={onOpenPlayerPanel}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function SlotRow({
  label,
  playerId,
  options,
  nameOf,
  onAssign,
  onInfo,
}: {
  label: string;
  playerId: string | undefined;
  options: readonly { playerId: string }[];
  nameOf: (playerId: string) => string;
  onAssign: (playerId: string) => void;
  onInfo: (playerId: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", width: 130, flexShrink: 0 }}>
        {label}
      </span>
      <select className="hm-select" style={selectStyle} value={playerId ?? ""} onChange={(e) => e.target.value && onAssign(e.target.value)}>
        {!playerId ? <option value="">Välj spelare...</option> : null}
        {options.map((o) => (
          <option key={o.playerId} value={o.playerId}>
            {nameOf(o.playerId)}
          </option>
        ))}
      </select>
      {playerId ? (
        <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => onInfo(playerId)}>
          i
        </button>
      ) : null}
    </div>
  );
}

const selectStyle = { background: "var(--hm-surface-2)", border: "1px solid var(--hm-border)", borderRadius: "var(--hm-radius-sm)", color: "var(--hm-text-primary)", padding: "7px 10px", fontSize: "var(--hm-text-xs)", flex: 1 };

/** Isolates MasterCourt's ~35 no-op interaction callbacks (this milestone keeps the court a display-only backdrop, per Part D/P: correct domain behavior over court-drawing interactivity) so the parent component stays readable. */
function MasterCourtDisplay({ scene }: { scene: ReturnType<typeof buildAttackScene> }) {
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
