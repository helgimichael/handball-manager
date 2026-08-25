"use client";

// HM-TACTICS-1.2 Part 2/3/4, rebuilt on the canonical grid by
// HM-COURT-GRID-0.3: the primary starting-unit editor. A tactical
// marker's board position is now DERIVED from its canonical grid cell
// (lib/court/courtGrid.ts + the manually approved calibration,
// lib/court/tacticalPositionCalibration.ts) via
// lib/matchPlan/attackBoard.ts / defenceBoard.ts -- the old fixed
// zone/percentage model (attackZones.ts/courtLayout.ts) is no longer
// consulted here. Both attack formations (NORMAL and SEVEN_V_SIX) and
// every defence formation now share ONE rendering/drag-drop path,
// keyed by cell number.
import { useState } from "react";
import Tabs from "@/components/Tabs";
import { defenceCourtSlotLabel, matchPlanPositionLabel } from "@/lib/matchPlan/matchPlanLabels";
import { assignAttackGoalkeeper, assignDefenceGoalkeeper, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import { assignAttackCellPosition, attackSlotTacticalPosition, resolveAttackSlotCells } from "@/lib/matchPlan/attackBoard";
import { assignDefenceCellPosition, defenceSlotTacticalPosition, resolveDefenceSlotCells } from "@/lib/matchPlan/defenceBoard";
import { attackCellToPct, ATTACK_GK_ANCHOR_PCT, defenceCellToPct, DEFENCE_GK_ANCHOR_PCT } from "@/lib/court/boardGeometry";
import { getAttackPositionCalibration, getDefenceFormationCalibration, type DefenceFormationId } from "@/lib/court/tacticalPositionCalibration";
import type { MatchPlan } from "@/lib/matchPlan/types";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";
import { buildAttackScene, buildDefenceScene, DEFENCE_FORMATION_OPTIONS, inferDefenceFormation } from "./courtScene";
import CourtBoard, { type CourtChip, type CourtGhostCell } from "./CourtBoard";

export type CourtPhase = "ATTACK" | "DEFENCE";

/** Part O: the board's own compact chip pill must never show a raw internal calibration id (e.g. "M6_LEFT", "LEFT_M9") -- a short coach-facing abbreviation only. Positions whose id is already short (V6/H6/V9/H9/M9, and every defence id) pass straight through via the fallback. */
const ATTACK_SHORT_LABEL: Readonly<Record<string, string>> = { M6_LEFT: "M6 V", M6_RIGHT: "M6 H", LEFT_M9: "V M9", RIGHT_M9: "H M9" };

interface SelectedSlot {
  key: string;
  label: string;
  playerId: string;
  isGoalkeeperSlot: boolean;
}

export default function StartingUnitEditor({
  plan,
  selectablePlayers,
  onChange,
  onOpenPlayerPanel,
  phase,
  onPhaseChange,
}: {
  plan: MatchPlan;
  selectablePlayers: readonly SelectablePlayer[];
  onChange: OnMatchPlanChange;
  onOpenPlayerPanel: (playerId: string) => void;
  /** HM-MATCH-1.3B2 Part 6/7: lifted to the parent page so MatchSquadPanel can derive its own PÅ PLAN/BÄNK split from the SAME currently-displayed phase, rather than each component guessing independently. */
  phase: CourtPhase;
  onPhaseChange: (phase: CourtPhase) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const byId = new Map(selectablePlayers.map((p) => [p.playerId, p]));
  const nameOf = (playerId: string) => byId.get(playerId)?.fullName ?? playerId;
  const goalkeepers = plan.squad.players.filter((p) => p.position === "GK");
  const outcourt = plan.squad.players.filter((p) => p.position !== "GK");

  const scene = phase === "ATTACK" ? buildAttackScene(plan.attackStartingUnit.formation) : buildDefenceScene(plan.defencePlan.baseFormation);
  const defenceFormation: DefenceFormationId = inferDefenceFormation(plan.defencePlan.baseFormation);

  const chips: CourtChip[] = [];
  const ghostCells: CourtGhostCell[] = [];

  if (phase === "ATTACK") {
    const resolvedCells = resolveAttackSlotCells(plan.attackStartingUnit.slots);
    const occupied = new Set<number>();
    plan.attackStartingUnit.slots.forEach((slot, i) => {
      const cell = resolvedCells[i];
      if (cell === null) {
        chips.push({ key: "GK", xPct: ATTACK_GK_ANCHOR_PCT.xPct, yPct: ATTACK_GK_ANCHOR_PCT.yPct, shortLabel: "MV", playerName: nameOf(slot.playerId), playerId: slot.playerId });
        return;
      }
      occupied.add(cell);
      const tactical = attackSlotTacticalPosition(cell);
      const pct = attackCellToPct(cell);
      const shortLabel = tactical ? (ATTACK_SHORT_LABEL[tactical.id] ?? tactical.id) : slot.position;
      chips.push({ key: String(cell), xPct: pct.xPct, yPct: pct.yPct, shortLabel, playerName: nameOf(slot.playerId), playerId: slot.playerId });
    });
    // Part H: every approved attack cell nothing currently occupies, shown as a subtle affordance.
    for (const position of getAttackPositionCalibration()) {
      for (const cell of position.acceptedCells) {
        if (occupied.has(cell)) continue;
        const pct = attackCellToPct(cell);
        ghostCells.push({ key: String(cell), xPct: pct.xPct, yPct: pct.yPct });
      }
    }
  } else {
    if (plan.defenceStartingUnit.goalkeeperId) {
      chips.push({ key: "GK", xPct: DEFENCE_GK_ANCHOR_PCT.xPct, yPct: DEFENCE_GK_ANCHOR_PCT.yPct, shortLabel: "MV", playerName: nameOf(plan.defenceStartingUnit.goalkeeperId), playerId: plan.defenceStartingUnit.goalkeeperId });
    }
    const resolvedCells = resolveDefenceSlotCells(defenceFormation, plan.defenceStartingUnit.courtSlots);
    const occupied = new Set<number>();
    plan.defenceStartingUnit.courtSlots.forEach((slot, i) => {
      const cell = resolvedCells[i];
      if (cell === null) return;
      occupied.add(cell);
      const tactical = defenceSlotTacticalPosition(defenceFormation, slot.courtSlot);
      const pct = defenceCellToPct(cell);
      chips.push({ key: String(cell), xPct: pct.xPct, yPct: pct.yPct, shortLabel: tactical?.label ?? defenceCourtSlotLabel(slot.courtSlot), playerName: nameOf(slot.playerId), playerId: slot.playerId });
    });
    for (const position of getDefenceFormationCalibration(defenceFormation).positions) {
      for (const cell of position.acceptedCells) {
        if (occupied.has(cell)) continue;
        const pct = defenceCellToPct(cell);
        ghostCells.push({ key: String(cell), xPct: pct.xPct, yPct: pct.yPct });
      }
    }
  }

  const selected = describeSelectedSlot({ phase, selectedKey, plan, defenceFormation });

  function applyDrop(targetKey: string, playerId: string) {
    const isGoalkeeperSlot = targetKey === "GK";
    const draggedIsGoalkeeper = byId.get(playerId)?.position === "GK";
    // Part F/W#8 (carried forward): a goalkeeper only ever goes in a
    // goalkeeper slot and vice versa -- guarded here, never
    // allowed-then-rejected after the drop.
    if (isGoalkeeperSlot !== draggedIsGoalkeeper) return;
    if (targetKey === "GK") {
      onChange((prev) => (phase === "ATTACK" ? assignAttackGoalkeeper(prev, playerId) : assignDefenceGoalkeeper(prev, playerId)));
      return;
    }
    const targetCell = Number(targetKey);
    onChange((prev) => (phase === "ATTACK" ? assignAttackCellPosition(prev, playerId, targetCell) : assignDefenceCellPosition(prev, playerId, targetCell)));
  }

  return (
    <div className="hm-panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="hm-panel-header">
        <span className="hm-panel-title">Startuppställning</span>
        <Tabs
          value={phase}
          options={["ATTACK", "DEFENCE"] as const}
          renderLabel={(v) => (v === "ATTACK" ? "ANFALL" : "FÖRSVAR")}
          onChange={(v) => {
            onPhaseChange(v);
            setSelectedKey(null);
          }}
        />
      </div>

      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <CourtBoard scene={scene} chips={chips} ghostCells={ghostCells} selectedKey={selectedKey} onSelectChip={setSelectedKey} onDropOnSlot={applyDrop} />

        {phase === "DEFENCE" ? (
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
        ) : null}

        {selected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--hm-surface-2)", borderRadius: "var(--hm-radius-sm)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hm-eyebrow">{selected.label}</div>
              <div style={{ fontWeight: 600, fontSize: "var(--hm-text-xs)" }}>{selected.playerId ? nameOf(selected.playerId) : "Ingen tilldelad"}</div>
            </div>
            <select
              className="hm-select"
              style={{ ...selectStyle, flex: "0 1 160px" }}
              value={selected.playerId}
              onChange={(e) => applyDrop(selected.key, e.target.value)}
            >
              {selected.playerId ? null : <option value="">Välj spelare...</option>}
              {(selected.isGoalkeeperSlot ? goalkeepers : outcourt).map((o) => (
                <option key={o.playerId} value={o.playerId}>
                  {nameOf(o.playerId)}
                </option>
              ))}
            </select>
            <button type="button" className="hm-btn hm-btn-sm" onClick={() => onOpenPlayerPanel(selected.playerId)}>
              Matchinstruktion
            </button>
          </div>
        ) : (
          <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
            Klicka på en spelare på planen för att byta spelare eller öppna matchinstruktionen.
          </p>
        )}
      </div>
    </div>
  );
}

function describeSelectedSlot({
  phase,
  selectedKey,
  plan,
  defenceFormation,
}: {
  phase: CourtPhase;
  selectedKey: string | null;
  plan: MatchPlan;
  defenceFormation: DefenceFormationId;
}): SelectedSlot | null {
  if (!selectedKey) return null;

  if (selectedKey === "GK") {
    const playerId = phase === "ATTACK" ? plan.attackStartingUnit.slots.find((s) => s.position === "GK")?.playerId : plan.defenceStartingUnit.goalkeeperId;
    if (!playerId) return null;
    return { key: "GK", label: "Målvakt", playerId, isGoalkeeperSlot: true };
  }

  const cell = Number(selectedKey);
  if (phase === "ATTACK") {
    const cells = resolveAttackSlotCells(plan.attackStartingUnit.slots);
    const index = cells.findIndex((c) => c === cell);
    const slot = index === -1 ? undefined : plan.attackStartingUnit.slots[index];
    const tactical = attackSlotTacticalPosition(cell);
    const label = tactical ? tactical.label : slot ? matchPlanPositionLabel(slot.position) : "Position";
    return { key: selectedKey, label, playerId: slot?.playerId ?? "", isGoalkeeperSlot: false };
  }

  const cells = resolveDefenceSlotCells(defenceFormation, plan.defenceStartingUnit.courtSlots);
  const index = cells.findIndex((c) => c === cell);
  const slot = index === -1 ? undefined : plan.defenceStartingUnit.courtSlots[index];
  const tactical = defenceSlotTacticalPosition(defenceFormation, slot?.courtSlot ?? -1);
  const label = tactical ? tactical.label : slot ? defenceCourtSlotLabel(slot.courtSlot) : "Position";
  return { key: selectedKey, label, playerId: slot?.playerId ?? "", isGoalkeeperSlot: false };
}

const selectStyle = { background: "var(--hm-surface-2)", border: "1px solid var(--hm-border)", borderRadius: "var(--hm-radius-sm)", color: "var(--hm-text-primary)", padding: "7px 10px", fontSize: "var(--hm-text-xs)", flex: 1 };
