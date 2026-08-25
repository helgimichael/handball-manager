"use client";

// HM-TACTICS-1.2 Part 2/3/4, rebuilt on the canonical grid by
// HM-COURT-GRID-0.3/0.3.1, and unified by HM-TACTICS-BOARD-1.0 into ONE
// FM-style board: a single canonical full court shows BOTH the attack
// assignment (top half) and the defence assignment (bottom half) of
// every starting player SIMULTANEOUSLY -- no ANFALL/FÖRSVAR board tabs.
// A handball player normally plays both phases, often at a different
// tactical position each (Part 2: "Player A: Attack M9, Defence V3");
// showing both halves of the SAME court at once is what lets the coach
// see the whole team without switching views.
//
// `attackAssignment` (position + cellNumber, via attackBoard.ts) and
// `defenceAssignment` (courtSlot + cellNumber, via defenceBoard.ts)
// remain two separate domain concepts (Part 8) -- this component only
// unifies the VISUAL surface, never the underlying MatchPlan shape.
//
// Part 9/10 (goalkeeper/7v6): the domain shape (AttackStartingUnit.slots
// including one GK slot for NORMAL, zero for SEVEN_V_SIX) is
// UNCHANGED -- confirmed via audit that nothing outside lib/matchPlan/
// lib/career reads it, but migrating it now would still touch
// defaultMatchPlan/matchPlanEdits/attackBoard/startingUnits and every
// test literal for no functional gain this pass. Instead, the GK slot
// is rendered at its own fixed anchor (never one of the 6-7 draggable
// shape cells -- it never was, since HM-COURT-GRID-0.2's calibration
// has no GK cell), and the board exposes a direct "MV IN * 6v6" / "MV
// UT * 7v6" control that calls the EXISTING `setAttackFormation` --
// the manager toggles the team's numeric state directly; nothing asks
// them to drag the goalkeeper onto an outcourt cell, which would be
// semantically wrong (Part 10).
import { useState } from "react";
import { defenceCourtSlotLabel, matchPlanPositionLabel } from "@/lib/matchPlan/matchPlanLabels";
import { assignAttackGoalkeeper, assignDefenceGoalkeeper, setAttackFormation, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import { assignAttackCellPosition, attackSlotTacticalPosition, resolveAttackSlotCells } from "@/lib/matchPlan/attackBoard";
import { assignDefenceCellPosition, defenceSlotTacticalPosition, resolveDefenceSlotCells } from "@/lib/matchPlan/defenceBoard";
import { cellToFullCourtPct, DEFENCE_GK_ANCHOR_PCT } from "@/lib/court/boardGeometry";
import { getAttackPositionCalibration, getDefenceFormationCalibration, type DefenceFormationId } from "@/lib/court/tacticalPositionCalibration";
import type { MatchPlan } from "@/lib/matchPlan/types";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";
import { DEFENCE_FORMATION_OPTIONS, FULL_COURT_SCENE, inferDefenceFormation } from "./courtScene";
import CourtBoard, { type CourtChip, type CourtGhostCell } from "./CourtBoard";

/** Still used by MatchSquadPanel to scope its own PÅ PLAN/BÄNK split -- the unified board itself no longer takes this as a prop (Part 3: no board-level ANFALL/FÖRSVAR toggle). */
export type CourtPhase = "ATTACK" | "DEFENCE";

/** Part 6: the board's own compact marker badge must never show a raw internal calibration id (e.g. "M6_LEFT", "LEFT_M9") -- a short coach-facing abbreviation only. Positions whose id is already short (V6/H6/V9/H9/M9, and every defence id) pass straight through via the fallback. */
const ATTACK_SHORT_LABEL: Readonly<Record<string, string>> = { M6_LEFT: "M6V", M6_RIGHT: "M6H", LEFT_M9: "VM9", RIGHT_M9: "HM9" };

interface SelectedPlayer {
  playerId: string;
  playerName: string;
  naturalPositionLabel: string;
  /** Which slot key (e.g. "A-65" or "D-181") was actually clicked -- the ONE thing the reassignment dropdown edits. The OTHER phase's assignment is shown read-only alongside it (Part 14). */
  activeSlotKey: string;
  activeSlotLabel: string;
  activeIsGoalkeeper: boolean;
  attackLabel: string | null;
  defenceLabel: string | null;
}

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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const byId = new Map(selectablePlayers.map((p) => [p.playerId, p]));
  const nameOf = (playerId: string) => byId.get(playerId)?.fullName ?? playerId;
  const goalkeepers = plan.squad.players.filter((p) => p.position === "GK");
  const outcourt = plan.squad.players.filter((p) => p.position !== "GK");
  const defenceFormation: DefenceFormationId = inferDefenceFormation(plan.defencePlan.baseFormation);

  const isSevenVSix = plan.attackStartingUnit.formation === "SEVEN_V_SIX";
  const outcourtAttackCount = plan.attackStartingUnit.slots.filter((s) => s.position !== "GK").length;

  const chips: CourtChip[] = [];
  const ghostCells: CourtGhostCell[] = [];

  // -- ATTACK half (top of the full court) --
  // HM-TACTICS-BOARD-1.0A Part 1: the goalkeeper is NOT an offensive
  // tactical position -- normal 6v6 attack shows ONLY the 6 outcourt
  // assignments (7 for 7v6), never a yellow MV marker. The domain's
  // attackStartingUnit GK slot still exists internally (Part 4 -- see
  // this component's own module doc for the documented technical debt)
  // but is simply never rendered/interactive here.
  const resolvedAttackCells = resolveAttackSlotCells(plan.attackStartingUnit.slots);
  const occupiedAttack = new Set<number>();
  plan.attackStartingUnit.slots.forEach((slot, i) => {
    const cell = resolvedAttackCells[i];
    if (cell === null) return; // GK slot -- intentionally not rendered as an attack marker.
    occupiedAttack.add(cell);
    const tactical = attackSlotTacticalPosition(cell);
    const shortLabel = tactical ? (ATTACK_SHORT_LABEL[tactical.id] ?? tactical.id) : slot.position;
    chips.push({ key: `A-${cell}`, ...cellToFullCourtPct(cell), shortLabel, playerName: nameOf(slot.playerId), playerId: slot.playerId, shirtNumber: byId.get(slot.playerId)?.shirtNumber ?? null, role: "ATTACK" });
  });
  for (const position of getAttackPositionCalibration()) {
    for (const cell of position.acceptedCells) {
      if (occupiedAttack.has(cell)) continue;
      ghostCells.push({ key: `A-${cell}`, ...cellToFullCourtPct(cell) });
    }
  }

  // -- DEFENCE half (bottom of the full court) --
  if (plan.defenceStartingUnit.goalkeeperId) {
    chips.push({ key: "D-GK", xPct: DEFENCE_GK_ANCHOR_PCT.xPct, yPct: DEFENCE_GK_ANCHOR_PCT.yPct, shortLabel: "MV", playerName: nameOf(plan.defenceStartingUnit.goalkeeperId), playerId: plan.defenceStartingUnit.goalkeeperId, shirtNumber: byId.get(plan.defenceStartingUnit.goalkeeperId)?.shirtNumber ?? null, role: "DEFENCE", isCalibratedCell: false });
  }
  const resolvedDefenceCells = resolveDefenceSlotCells(defenceFormation, plan.defenceStartingUnit.courtSlots);
  const occupiedDefence = new Set<number>();
  plan.defenceStartingUnit.courtSlots.forEach((slot, i) => {
    const cell = resolvedDefenceCells[i];
    if (cell === null) return;
    occupiedDefence.add(cell);
    const tactical = defenceSlotTacticalPosition(defenceFormation, slot.courtSlot);
    chips.push({ key: `D-${cell}`, ...cellToFullCourtPct(cell), shortLabel: tactical?.label ?? defenceCourtSlotLabel(slot.courtSlot), playerName: nameOf(slot.playerId), playerId: slot.playerId, shirtNumber: byId.get(slot.playerId)?.shirtNumber ?? null, role: "DEFENCE" });
  });
  for (const position of getDefenceFormationCalibration(defenceFormation).positions) {
    for (const cell of position.acceptedCells) {
      if (occupiedDefence.has(cell)) continue;
      ghostCells.push({ key: `D-${cell}`, ...cellToFullCourtPct(cell) });
    }
  }

  const selected = describeSelectedPlayer({ selectedKey, plan, defenceFormation, nameOf });

  function applyDrop(targetKey: string, playerId: string) {
    const [prefix, rest] = [targetKey.slice(0, 1), targetKey.slice(2)];
    const isGoalkeeperSlot = rest === "GK";
    const draggedIsGoalkeeper = byId.get(playerId)?.position === "GK";
    // Part F/W#8 (carried forward): a goalkeeper only ever goes in a
    // goalkeeper slot and vice versa -- guarded here, never
    // allowed-then-rejected after the drop.
    if (isGoalkeeperSlot !== draggedIsGoalkeeper) return;
    if (isGoalkeeperSlot) {
      onChange((prev) => (prefix === "A" ? assignAttackGoalkeeper(prev, playerId) : assignDefenceGoalkeeper(prev, playerId)));
      return;
    }
    const targetCell = Number(rest);
    onChange((prev) => (prefix === "A" ? assignAttackCellPosition(prev, playerId, targetCell) : assignDefenceCellPosition(prev, playerId, targetCell)));
  }

  return (
    <div className="hm-panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="hm-panel-header">
        <span className="hm-panel-title">Taktiktavla</span>
        <button
          type="button"
          className="hm-btn hm-btn-sm"
          title="Byt mellan 6 utespelare (målvakt kvar) och 7 utespelare (målvakt ute)"
          onClick={() => onChange((prev) => setAttackFormation(prev, isSevenVSix ? "NORMAL" : "SEVEN_V_SIX"))}
        >
          {isSevenVSix ? `MV UT · 7v6 (${outcourtAttackCount} utespelare)` : `MV IN · 6v6 (${outcourtAttackCount} utespelare)`}
        </button>
      </div>

      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 12, fontSize: "var(--hm-text-2xs)", justifyContent: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid rgba(255, 196, 0, 0.9)", display: "inline-block" }} />
            Anfall
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid rgba(94, 180, 255, 0.9)", display: "inline-block" }} />
            Försvar
          </span>
        </div>

        <CourtBoard scene={FULL_COURT_SCENE} chips={chips} ghostCells={ghostCells} selectedKey={selectedKey} onSelectChip={setSelectedKey} onDropOnSlot={applyDrop} />

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
          <span className="hm-eyebrow">Försvarsformation</span>
          <select className="hm-select" style={selectStyle} value={plan.defencePlan.baseFormation} onChange={(e) => { const baseFormation = e.target.value; onChange((prev) => ({ ...prev, defencePlan: { ...prev.defencePlan, baseFormation } })); }}>
            {DEFENCE_FORMATION_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        {selected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", background: "var(--hm-surface-2)", borderRadius: "var(--hm-radius-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "var(--hm-text-xs)" }}>{selected.playerName}</div>
                <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>Naturlig position: {selected.naturalPositionLabel}</div>
              </div>
              <button type="button" className="hm-btn hm-btn-sm" onClick={() => onOpenPlayerPanel(selected.playerId)}>
                Matchinstruktion
              </button>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: "var(--hm-text-2xs)" }}>
              <span>ANFALL: {selected.attackLabel ?? "–"}</span>
              <span>FÖRSVAR: {selected.defenceLabel ?? "–"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="hm-eyebrow" style={{ margin: 0 }}>
                Byt spelare ({selected.activeSlotLabel})
              </span>
              <select
                className="hm-select"
                style={{ ...selectStyle, flex: "0 1 160px" }}
                value={selected.playerId}
                onChange={(e) => applyDrop(selected.activeSlotKey, e.target.value)}
              >
                {(selected.activeIsGoalkeeper ? goalkeepers : outcourt).map((o) => (
                  <option key={o.playerId} value={o.playerId}>
                    {nameOf(o.playerId)}
                  </option>
                ))}
              </select>
            </div>
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

/**
 * Part 14: resolves whichever slot was clicked into a full picture of
 * that PLAYER -- both their attack assignment (if any) and defence
 * assignment (if any), even though only ONE of the two is being
 * actively edited (the clicked slot, `activeSlotKey`). A player who
 * starts only one phase legitimately shows "–" for the other.
 */
function describeSelectedPlayer({
  selectedKey,
  plan,
  defenceFormation,
  nameOf,
}: {
  selectedKey: string | null;
  plan: MatchPlan;
  defenceFormation: DefenceFormationId;
  nameOf: (playerId: string) => string;
}): SelectedPlayer | null {
  if (!selectedKey) return null;
  const prefix = selectedKey.slice(0, 1);
  const rest = selectedKey.slice(2);

  let playerId: string | undefined;
  let activeSlotLabel = "Position";
  let activeIsGoalkeeper = false;

  if (rest === "GK") {
    playerId = prefix === "A" ? plan.attackStartingUnit.slots.find((s) => s.position === "GK")?.playerId : plan.defenceStartingUnit.goalkeeperId;
    activeSlotLabel = "Målvakt";
    activeIsGoalkeeper = true;
  } else {
    const cell = Number(rest);
    if (prefix === "A") {
      const cells = resolveAttackSlotCells(plan.attackStartingUnit.slots);
      const index = cells.findIndex((c) => c === cell);
      const slot = index === -1 ? undefined : plan.attackStartingUnit.slots[index];
      playerId = slot?.playerId;
      const tactical = attackSlotTacticalPosition(cell);
      activeSlotLabel = tactical ? tactical.label : slot ? matchPlanPositionLabel(slot.position) : "Position";
    } else {
      const cells = resolveDefenceSlotCells(defenceFormation, plan.defenceStartingUnit.courtSlots);
      const index = cells.findIndex((c) => c === cell);
      const slot = index === -1 ? undefined : plan.defenceStartingUnit.courtSlots[index];
      playerId = slot?.playerId;
      const tactical = defenceSlotTacticalPosition(defenceFormation, slot?.courtSlot ?? -1);
      activeSlotLabel = tactical ? tactical.label : slot ? defenceCourtSlotLabel(slot.courtSlot) : "Position";
    }
  }

  if (!playerId) return null;

  const naturalPosition = plan.squad.players.find((p) => p.playerId === playerId)?.position;
  const attackSlotIndex = plan.attackStartingUnit.slots.findIndex((s) => s.playerId === playerId);
  const attackLabel =
    attackSlotIndex === -1
      ? null
      : plan.attackStartingUnit.slots[attackSlotIndex].position === "GK"
        ? "Målvakt"
        : (attackSlotTacticalPosition(resolveAttackSlotCells(plan.attackStartingUnit.slots)[attackSlotIndex])?.label ?? matchPlanPositionLabel(plan.attackStartingUnit.slots[attackSlotIndex].position));
  const defenceIsGoalkeeper = plan.defenceStartingUnit.goalkeeperId === playerId;
  const defenceSlot = plan.defenceStartingUnit.courtSlots.find((s) => s.playerId === playerId);
  const defenceLabel = defenceIsGoalkeeper ? "Målvakt" : defenceSlot ? (defenceSlotTacticalPosition(defenceFormation, defenceSlot.courtSlot)?.label ?? defenceCourtSlotLabel(defenceSlot.courtSlot)) : null;

  return {
    playerId,
    playerName: nameOf(playerId),
    naturalPositionLabel: naturalPosition ? matchPlanPositionLabel(naturalPosition) : "–",
    activeSlotKey: selectedKey,
    activeSlotLabel,
    activeIsGoalkeeper,
    attackLabel,
    defenceLabel,
  };
}

const selectStyle = { background: "var(--hm-surface-2)", border: "1px solid var(--hm-border)", borderRadius: "var(--hm-radius-sm)", color: "var(--hm-text-primary)", padding: "7px 10px", fontSize: "var(--hm-text-xs)", flex: 1 };
