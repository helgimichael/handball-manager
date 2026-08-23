"use client";

// HM-TACTICS-1.2 Part 2: 7v6 is a SPECIALSPEL inside the attack tactical
// instructions, not a top-level starting-unit choice -- moved out of
// StartingUnitEditor entirely (HM-TACTICS-1.1 had a NORMAL | 7 MOT 6
// switch right above the court; that top-level presentation is gone).
// This is the ONE place the coach sets the 7v6 policy AND (if not
// NEVER) expands to switch the attack formation and edit the resulting
// 7-player lineup -- a single source of truth, never duplicated.
import { useState } from "react";
import SegmentedControl from "@/components/SegmentedControl";
import Tabs from "@/components/Tabs";
import { assignSevenVSixSlot, setAttackFormation, updateSevenVSixPolicy, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import { ATTACK_FORMATION_LABELS_SV, matchPlanPositionLabel, SEVEN_V_SIX_POLICY_LABELS_SV } from "@/lib/matchPlan/matchPlanLabels";
import { SEVEN_V_SIX_POLICY_LEVELS, type AttackFormation, type MatchPlan } from "@/lib/matchPlan/types";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";

const ATTACK_FORMATIONS: readonly AttackFormation[] = ["NORMAL", "SEVEN_V_SIX"];

export default function SevenVSixPolicyControl({
  plan,
  selectablePlayers,
  onChange,
  onOpenPlayerPanel,
}: {
  plan: MatchPlan;
  selectablePlayers: readonly SelectablePlayer[];
  onChange: OnMatchPlanChange;
  onOpenPlayerPanel?: (playerId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const policy = plan.attackPlan.sevenVSixPolicy;
  const byId = new Map(selectablePlayers.map((p) => [p.playerId, p]));
  const nameOf = (playerId: string) => byId.get(playerId)?.fullName ?? playerId;
  const outcourt = plan.squad.players.filter((p) => p.position !== "GK");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="hm-eyebrow">Specialspel</div>
      <SegmentedControl
        label="7 mot 6"
        value={policy.level}
        options={SEVEN_V_SIX_POLICY_LEVELS}
        renderLabel={(v) => SEVEN_V_SIX_POLICY_LABELS_SV[v]}
        onChange={(level) => onChange((prev) => updateSevenVSixPolicy(prev, { level }))}
      />

      {policy.level !== "NEVER" ? (
        <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Dölj 7v6-uppställning" : "Redigera 7v6-uppställning"}
        </button>
      ) : null}

      {policy.level !== "NEVER" && expanded ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 12px", background: "var(--hm-surface-2)", borderRadius: "var(--hm-radius-sm)" }}>
          <Tabs value={plan.attackStartingUnit.formation} options={ATTACK_FORMATIONS} renderLabel={(v) => ATTACK_FORMATION_LABELS_SV[v]} onChange={(v) => onChange((prev) => setAttackFormation(prev, v))} />

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--hm-text-2xs)" }}>
            <input
              type="checkbox"
              checked={policy.activeFromKickoff}
              onChange={(e) => {
                const activeFromKickoff = e.target.checked;
                onChange((prev) => updateSevenVSixPolicy(prev, { activeFromKickoff }));
              }}
            />
            Starta med 7 mot 6
          </label>

          {plan.attackStartingUnit.formation === "SEVEN_V_SIX" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {plan.attackStartingUnit.slots.map((slot, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", width: 130, flexShrink: 0 }}>
                    Anfallare {i + 1} ({matchPlanPositionLabel(slot.position)})
                  </span>
                  <select
                    className="hm-select"
                    style={selectStyle}
                    value={slot.playerId}
                    onChange={(e) => {
                      const playerId = e.target.value;
                      const position = byId.get(playerId)?.position ?? slot.position;
                      onChange((prev) => assignSevenVSixSlot(prev, i, playerId, position));
                    }}
                  >
                    {outcourt.map((o) => (
                      <option key={o.playerId} value={o.playerId}>
                        {nameOf(o.playerId)}
                      </option>
                    ))}
                  </select>
                  {onOpenPlayerPanel ? (
                    <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => onOpenPlayerPanel(slot.playerId)}>
                      i
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
              Växla till &quot;7 mot 6&quot; ovan för att redigera uppställningen med extra utespelare.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

const selectStyle = { background: "var(--hm-surface-2)", border: "1px solid var(--hm-border)", borderRadius: "var(--hm-radius-sm)", color: "var(--hm-text-primary)", padding: "7px 10px", fontSize: "var(--hm-text-xs)", flex: 1 };
