"use client";

// HM-TACTICS-1.2 Part 2/3/4: the primary starting-unit editor. The
// players on the court are now the primary representation (Part 3) --
// clicking a chip selects that slot; a compact panel below the court
// shows/swaps the player and opens their Match Instruction. The
// NORMAL | 7 MOT 6 top-level switch that used to sit here is gone
// (Part 2: 7v6 moved into TAKTISKA INSTRUKTIONER -> ANFALL ->
// Specialspel) -- this component always shows/edits whichever attack
// starting unit is currently active (NORMAL by default), never a
// second place to toggle the formation.
import { useState } from "react";
import Tabs from "@/components/Tabs";
import { defenceCourtSlotLabel, matchPlanPositionLabel } from "@/lib/matchPlan/matchPlanLabels";
import { assignAttackGoalkeeper, assignDefenceCourtSlot, assignDefenceGoalkeeper, assignNormalAttackSlot, assignSevenVSixSlot, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import type { MatchPlan, Position } from "@/lib/matchPlan/types";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";
import { buildAttackScene, buildDefenceScene, DEFENCE_FORMATION_OPTIONS } from "./courtScene";
import { ATTACK_NORMAL_LAYOUT, defenceLayout, sevenVSixAttackLayout } from "./courtLayout";
import CourtBoard, { type CourtChip } from "./CourtBoard";

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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const byId = new Map(selectablePlayers.map((p) => [p.playerId, p]));
  const nameOf = (playerId: string) => byId.get(playerId)?.fullName ?? playerId;
  const goalkeepers = plan.squad.players.filter((p) => p.position === "GK");
  const outcourt = plan.squad.players.filter((p) => p.position !== "GK");

  const scene = phase === "ATTACK" ? buildAttackScene(plan.attackStartingUnit.formation) : buildDefenceScene(plan.defencePlan.baseFormation);

  const attackNormal = plan.attackStartingUnit.formation === "NORMAL";
  const chips: CourtChip[] = [];
  if (phase === "ATTACK") {
    if (attackNormal) {
      for (const layoutSlot of ATTACK_NORMAL_LAYOUT) {
        const slot = plan.attackStartingUnit.slots.find((s) => s.position === (layoutSlot.key as Position));
        chips.push({ key: layoutSlot.key, xPct: layoutSlot.xPct, yPct: layoutSlot.yPct, shortLabel: layoutSlot.key, playerName: slot ? nameOf(slot.playerId) : "–" });
      }
    } else {
      const layout = sevenVSixAttackLayout(plan.attackStartingUnit.slots.length);
      plan.attackStartingUnit.slots.forEach((slot, i) => {
        const layoutSlot = layout[i];
        chips.push({ key: String(i), xPct: layoutSlot.xPct, yPct: layoutSlot.yPct, shortLabel: slot.position, playerName: nameOf(slot.playerId) });
      });
    }
  } else {
    for (const layoutSlot of defenceLayout(plan.defencePlan.baseFormation)) {
      if (layoutSlot.key === "GK") {
        chips.push({ key: "GK", xPct: layoutSlot.xPct, yPct: layoutSlot.yPct, shortLabel: "MV", playerName: plan.defenceStartingUnit.goalkeeperId ? nameOf(plan.defenceStartingUnit.goalkeeperId) : "–" });
      } else {
        const courtSlot = Number(layoutSlot.key);
        const slot = plan.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === courtSlot);
        chips.push({ key: layoutSlot.key, xPct: layoutSlot.xPct, yPct: layoutSlot.yPct, shortLabel: defenceCourtSlotLabel(courtSlot), playerName: slot ? nameOf(slot.playerId) : "–" });
      }
    }
  }

  const selected = describeSelectedSlot({ phase, selectedKey, plan, attackNormal });

  return (
    <div className="hm-panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="hm-panel-header">
        <span className="hm-panel-title">Startuppställning</span>
        <Tabs
          value={phase}
          options={["ATTACK", "DEFENCE"] as const}
          renderLabel={(v) => (v === "ATTACK" ? "ANFALL" : "FÖRSVAR")}
          onChange={(v) => {
            setPhase(v);
            setSelectedKey(null);
          }}
        />
      </div>

      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <CourtBoard scene={scene} chips={chips} selectedKey={selectedKey} onSelectChip={setSelectedKey} />

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
              <div style={{ fontWeight: 600, fontSize: "var(--hm-text-xs)" }}>{nameOf(selected.playerId)}</div>
            </div>
            <select
              className="hm-select"
              style={{ ...selectStyle, flex: "0 1 160px" }}
              value={selected.playerId}
              onChange={(e) => {
                const playerId = e.target.value;
                onChange((prev) => applySlotAssignment({ prev, phase, selectedKey: selected.key, playerId, byId }));
              }}
            >
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
  attackNormal,
}: {
  phase: CourtPhase;
  selectedKey: string | null;
  plan: MatchPlan;
  attackNormal: boolean;
}): { key: string; label: string; playerId: string; isGoalkeeperSlot: boolean } | null {
  if (!selectedKey) return null;

  if (phase === "ATTACK") {
    if (attackNormal) {
      const slot = plan.attackStartingUnit.slots.find((s) => s.position === (selectedKey as Position));
      if (!slot) return null;
      return { key: selectedKey, label: matchPlanPositionLabel(slot.position), playerId: slot.playerId, isGoalkeeperSlot: slot.position === "GK" };
    }
    const index = Number(selectedKey);
    const slot = plan.attackStartingUnit.slots[index];
    if (!slot) return null;
    return { key: selectedKey, label: `Anfallare ${index + 1} (${matchPlanPositionLabel(slot.position)})`, playerId: slot.playerId, isGoalkeeperSlot: false };
  }

  if (selectedKey === "GK") {
    if (!plan.defenceStartingUnit.goalkeeperId) return null;
    return { key: "GK", label: "Målvakt", playerId: plan.defenceStartingUnit.goalkeeperId, isGoalkeeperSlot: true };
  }
  const courtSlot = Number(selectedKey);
  const slot = plan.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === courtSlot);
  if (!slot) return null;
  return { key: selectedKey, label: defenceCourtSlotLabel(courtSlot), playerId: slot.playerId, isGoalkeeperSlot: false };
}

function applySlotAssignment({
  prev,
  phase,
  selectedKey,
  playerId,
  byId,
}: {
  prev: MatchPlan;
  phase: CourtPhase;
  selectedKey: string;
  playerId: string;
  byId: Map<string, SelectablePlayer>;
}): MatchPlan {
  if (phase === "ATTACK") {
    if (prev.attackStartingUnit.formation === "NORMAL") {
      if (selectedKey === "GK") return assignAttackGoalkeeper(prev, playerId);
      return assignNormalAttackSlot(prev, selectedKey as Position, playerId);
    }
    const index = Number(selectedKey);
    const position = byId.get(playerId)?.position ?? prev.attackStartingUnit.slots[index]?.position ?? "M6";
    return assignSevenVSixSlot(prev, index, playerId, position);
  }
  if (selectedKey === "GK") return assignDefenceGoalkeeper(prev, playerId);
  return assignDefenceCourtSlot(prev, Number(selectedKey), playerId);
}

const selectStyle = { background: "var(--hm-surface-2)", border: "1px solid var(--hm-border)", borderRadius: "var(--hm-radius-sm)", color: "var(--hm-text-primary)", padding: "7px 10px", fontSize: "var(--hm-text-xs)", flex: 1 };
