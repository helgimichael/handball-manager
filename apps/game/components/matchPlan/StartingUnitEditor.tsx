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
import { assignAttackGoalkeeper, assignAttackZonePosition, assignDefenceCourtSlot, assignDefenceGoalkeeper, assignSevenVSixSlot, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import type { MatchPlan } from "@/lib/matchPlan/types";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";
import { buildAttackScene, buildDefenceScene, DEFENCE_FORMATION_OPTIONS } from "./courtScene";
import { ATTACK_NORMAL_LAYOUT, defenceLayout, sevenVSixAttackLayout } from "./courtLayout";
import { ATTACK_ZONE_IDS, ATTACK_ZONE_LAYOUT, ATTACK_ZONE_POSITION, projectSlotsOntoZones, type AttackZoneId } from "./attackZones";
import CourtBoard, { type CourtChip } from "./CourtBoard";

export type CourtPhase = "ATTACK" | "DEFENCE";

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

  const attackNormal = plan.attackStartingUnit.formation === "NORMAL";
  // HM-MATCH-1.3B2 Part 1/2: the snap-zone projection is the ONLY thing
  // that decides which slot occupies which zone -- recomputed fresh
  // every render from `plan.attackStartingUnit.slots` (never separate
  // UI state), so it can never drift from the canonical MatchPlan.
  const zoneProjection = attackNormal ? projectSlotsOntoZones(plan.attackStartingUnit.slots) : null;
  const chips: CourtChip[] = [];
  if (phase === "ATTACK") {
    if (attackNormal && zoneProjection) {
      const gkSlot = plan.attackStartingUnit.slots.find((s) => s.position === "GK");
      const gkLayout = ATTACK_NORMAL_LAYOUT.find((s) => s.key === "GK")!;
      if (gkSlot) {
        chips.push({ key: "GK", xPct: gkLayout.xPct, yPct: gkLayout.yPct, shortLabel: "MV", playerName: nameOf(gkSlot.playerId), playerId: gkSlot.playerId });
      }
      for (const zoneId of ATTACK_ZONE_IDS) {
        const layout = ATTACK_ZONE_LAYOUT[zoneId];
        const slotIndex = zoneProjection[zoneId];
        const slot = slotIndex !== null ? plan.attackStartingUnit.slots[slotIndex] : undefined;
        chips.push({
          key: zoneId,
          xPct: layout.xPct,
          yPct: layout.yPct,
          shortLabel: ATTACK_ZONE_POSITION[zoneId],
          playerName: slot ? nameOf(slot.playerId) : "–",
          playerId: slot?.playerId ?? "",
        });
      }
    } else if (!attackNormal) {
      const layout = sevenVSixAttackLayout(plan.attackStartingUnit.slots.map((s) => s.position));
      plan.attackStartingUnit.slots.forEach((slot, i) => {
        const layoutSlot = layout[i];
        chips.push({ key: String(i), xPct: layoutSlot.xPct, yPct: layoutSlot.yPct, shortLabel: slot.position, playerName: nameOf(slot.playerId), playerId: slot.playerId });
      });
    }
  } else {
    for (const layoutSlot of defenceLayout(plan.defencePlan.baseFormation)) {
      if (layoutSlot.key === "GK") {
        if (!plan.defenceStartingUnit.goalkeeperId) continue;
        chips.push({ key: "GK", xPct: layoutSlot.xPct, yPct: layoutSlot.yPct, shortLabel: "MV", playerName: nameOf(plan.defenceStartingUnit.goalkeeperId), playerId: plan.defenceStartingUnit.goalkeeperId });
      } else {
        const courtSlot = Number(layoutSlot.key);
        const slot = plan.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === courtSlot);
        if (!slot) continue;
        chips.push({ key: layoutSlot.key, xPct: layoutSlot.xPct, yPct: layoutSlot.yPct, shortLabel: defenceCourtSlotLabel(courtSlot), playerName: nameOf(slot.playerId), playerId: slot.playerId });
      }
    }
  }

  const selected = describeSelectedSlot({ phase, selectedKey, plan, attackNormal, zoneProjection });

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
        <CourtBoard
          scene={scene}
          chips={chips}
          selectedKey={selectedKey}
          onSelectChip={setSelectedKey}
          onDropOnSlot={(targetKey, draggedPlayerId) => {
            if (!draggedPlayerId) return;
            const isGoalkeeperSlot = phase === "ATTACK" ? attackNormal && targetKey === "GK" : targetKey === "GK";
            const draggedIsGoalkeeper = byId.get(draggedPlayerId)?.position === "GK";
            // Part F/W#8: a goalkeeper only ever goes in a goalkeeper
            // slot and vice versa -- guarded here (never allowed to
            // start), rather than allowed-then-rejected after the drop.
            if (isGoalkeeperSlot !== draggedIsGoalkeeper) return;
            if (phase === "ATTACK" && attackNormal && zoneProjection && targetKey !== "GK") {
              const zoneId = targetKey as AttackZoneId;
              onChange((prev) => assignAttackZonePosition(prev, draggedPlayerId, ATTACK_ZONE_POSITION[zoneId], zoneProjection[zoneId]));
              return;
            }
            onChange((prev) => applySlotAssignment({ prev, phase, selectedKey: targetKey, playerId: draggedPlayerId }));
          }}
        />

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
              onChange={(e) => {
                const playerId = e.target.value;
                if (phase === "ATTACK" && attackNormal && zoneProjection && selected.key !== "GK") {
                  const zoneId = selected.key as AttackZoneId;
                  onChange((prev) => assignAttackZonePosition(prev, playerId, ATTACK_ZONE_POSITION[zoneId], zoneProjection[zoneId]));
                  return;
                }
                onChange((prev) => applySlotAssignment({ prev, phase, selectedKey: selected.key, playerId }));
              }}
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
  attackNormal,
  zoneProjection,
}: {
  phase: CourtPhase;
  selectedKey: string | null;
  plan: MatchPlan;
  attackNormal: boolean;
  zoneProjection: Record<AttackZoneId, number | null> | null;
}): { key: string; label: string; playerId: string; isGoalkeeperSlot: boolean } | null {
  if (!selectedKey) return null;

  if (phase === "ATTACK") {
    if (attackNormal && selectedKey === "GK") {
      const slot = plan.attackStartingUnit.slots.find((s) => s.position === "GK");
      if (!slot) return null;
      return { key: selectedKey, label: "Målvakt", playerId: slot.playerId, isGoalkeeperSlot: true };
    }
    if (attackNormal && zoneProjection) {
      // HM-MATCH-1.3B2 Part 1/2: a selected EMPTY zone (no slot
      // projects there right now) still opens the picker -- an empty
      // string playerId means "nothing assigned here yet", letting the
      // manager move any player into this snap zone.
      const zoneId = selectedKey as AttackZoneId;
      const slotIndex = zoneProjection[zoneId];
      const slot = slotIndex !== null ? plan.attackStartingUnit.slots[slotIndex] : undefined;
      return { key: selectedKey, label: matchPlanPositionLabel(ATTACK_ZONE_POSITION[zoneId]), playerId: slot?.playerId ?? "", isGoalkeeperSlot: false };
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
}: {
  prev: MatchPlan;
  phase: CourtPhase;
  selectedKey: string;
  playerId: string;
}): MatchPlan {
  if (phase === "ATTACK") {
    // NORMAL formation's outcourt zones are handled entirely by
    // assignAttackZonePosition at the call sites above (Part 1/2) --
    // this function is only ever reached for the GK slot (fixed,
    // outside the zone model) or a SEVEN_V_SIX index-based slot.
    if (prev.attackStartingUnit.formation === "NORMAL") {
      return selectedKey === "GK" ? assignAttackGoalkeeper(prev, playerId) : prev;
    }
    const index = Number(selectedKey);
    return assignSevenVSixSlot(prev, index, playerId);
  }
  if (selectedKey === "GK") return assignDefenceGoalkeeper(prev, playerId);
  return assignDefenceCourtSlot(prev, Number(selectedKey), playerId);
}

const selectStyle = { background: "var(--hm-surface-2)", border: "1px solid var(--hm-border)", borderRadius: "var(--hm-radius-sm)", color: "var(--hm-text-primary)", padding: "7px 10px", fontSize: "var(--hm-text-xs)", flex: 1 };
