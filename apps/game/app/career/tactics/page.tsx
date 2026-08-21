"use client";

import { useMemo } from "react";
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
import { createInitialScene } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/TacticsBoardScene.ts";
import { createBoardObject, type BoardObject } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/BoardObject.ts";
import { FORMATIONS } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/library/FormationLibrary.ts";
import { positionLabel } from "@/lib/game-data";
import type { HandballPosition } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerSquad } from "@/lib/career/careerWorld";
import SegmentedControl from "@/components/SegmentedControl";
import {
  ATI001_USAGE_TENDENCY_VALUES,
  H2_RESPONSE_PREFERENCE_VALUES,
  TACTICAL_FAMILIARITY_VALUES,
  capabilityLevelLabel,
  h2ResponseLabel,
} from "@/lib/career/teamTacticalProfile";

function noop() {}

// HM-GAME-0.1 Tactics screen: reuses FIELD's own MasterCourt/scene
// construction verbatim (same technique as apps/match-demo and
// apps/field-smoke-test) to display the current starting seven +
// goalkeeper, positioned using FIELD's own canonical attack-6/
// defence-6-0 formation coordinates. This is a display-only host
// composed around the untouched FIELD core -- no FIELD source file is
// modified, and no tactics selection here is wired into SIM.
const STARTING_POSITIONS: HandballPosition[] = ["V9", "V6", "M6", "H6", "H9", "PV"];

// Static: depends only on FIELD's own canonical formation constants, not
// on component state, so it's computed once at module load rather than
// memoized per-render.
const TACTICS_SCENE = (() => {
  const attack = FORMATIONS.find((f) => f.id === "attack-6")!;
  const defence = FORMATIONS.find((f) => f.id === "defence-6-0")!;
  const objects: BoardObject[] = [];
  attack.objects
    .filter((o) => o.type === "ATTACKER")
    .forEach((o, i) => {
      objects.push(createBoardObject({ id: `starter-${i}`, type: "ATTACKER", position: o.position, rotation: o.rotation }));
    });
  const gkObject = defence.objects.find((o) => o.type === "GOALKEEPER")!;
  objects.push(createBoardObject({ id: "starting-gk", type: "GOALKEEPER", position: gkObject.position, rotation: gkObject.rotation }));
  return createInitialScene({ courtView: "FULL_COURT", objects });
})();

export default function TacticsPage() {
  const { career, updateTacticalProfile } = useCareer();
  const squad = getCareerSquad(career);
  const profile = career.tacticalProfile;

  const starters = useMemo(() => {
    const picked: typeof squad[number][] = [];
    for (const pos of STARTING_POSITIONS) {
      const candidate = squad.find((p) => p.position === pos && p.squadStatus === "Förstaval" && !picked.includes(p));
      if (candidate) picked.push(candidate);
    }
    return picked;
  }, [squad]);

  const goalkeeper = squad.find((p) => p.position === "MV" && p.squadStatus === "Förstaval");
  const bench = squad.filter((p) => !starters.includes(p) && p.id !== goalkeeper?.id);

  const scene = TACTICS_SCENE;

  const activeTool: ToolId = "SELECT";
  const interactionMode: InteractionMode = "IDLE";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 12, height: "100%" }}>
      <div className="hm-panel" style={{ display: "flex", flexDirection: "column" }}>
        <div className="hm-panel-header">
          <span className="hm-panel-title">Taktik — startformation</span>
          <span className="hm-badge hm-badge-neutral">6:0 / Anfall 3-3</span>
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

      <div className="hm-grid" style={{ gap: 12 }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Startsju</span>
          </div>
          <div>
            {goalkeeper ? <RosterRow player={goalkeeper} /> : null}
            {starters.map((p) => (
              <RosterRow key={p.id} player={p} />
            ))}
          </div>
        </div>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Bänk</span>
          </div>
          <div>
            {bench.map((p) => (
              <RosterRow key={p.id} player={p} />
            ))}
          </div>
        </div>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Taktisk profil</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SegmentedControl
              label="ATI-001-benägenhet"
              value={profile.ati001UsageTendency}
              options={ATI001_USAGE_TENDENCY_VALUES}
              renderLabel={capabilityLevelLabel}
              onChange={(v) => updateTacticalProfile({ ati001UsageTendency: v })}
            />
            <SegmentedControl
              label="H2-respons (TI-001)"
              value={profile.h2ResponsePreference}
              options={H2_RESPONSE_PREFERENCE_VALUES}
              renderLabel={h2ResponseLabel}
              onChange={(v) => updateTacticalProfile({ h2ResponsePreference: v })}
            />
            <SegmentedControl
              label="Taktisk förtrogenhet"
              value={profile.tacticalFamiliarity}
              options={TACTICAL_FAMILIARITY_VALUES}
              renderLabel={capabilityLevelLabel}
              onChange={(v) => updateTacticalProfile({ tacticalFamiliarity: v })}
            />
            <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
              Påverkar ännu inte matchsimuleringen — plumbing inför framtida Fast Match-integration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RosterRow({ player }: { player: ReturnType<typeof getCareerSquad>[number] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderBottom: "1px solid var(--hm-border-subtle)" }}>
      <span className="hm-shirt-number">{player.shirtNumber}</span>
      <span style={{ fontSize: "var(--hm-text-xs)", fontWeight: 600, flex: 1 }}>
        {player.firstName} {player.lastName}
      </span>
      <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }} title={positionLabel(player.position)}>
        {player.position}
      </span>
    </div>
  );
}
