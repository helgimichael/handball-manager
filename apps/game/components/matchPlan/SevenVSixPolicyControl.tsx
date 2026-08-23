"use client";

// HM-TACTICS-1.1 Part F: pre-match 7v6 POLICY (how readily the coach
// wants to use it during the match), distinct from the court's own
// NORMAL/7-MOT-6 starting-formation toggle right above it in
// StartingUnitEditor, and distinct from HM-TACTICS-0.8's live mid-match
// ON/OFF switch (untouched). Shared here so both StartingUnitEditor
// (Part F) and TacticalConfigPanel's attack tab (Part K) render the
// exact same control, never two independently-drifting copies.
import SegmentedControl from "@/components/SegmentedControl";
import { updateSevenVSixPolicy, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import { SEVEN_V_SIX_POLICY_LABELS_SV } from "@/lib/matchPlan/matchPlanLabels";
import { SEVEN_V_SIX_POLICY_LEVELS, type MatchPlan } from "@/lib/matchPlan/types";

export default function SevenVSixPolicyControl({ plan, onChange }: { plan: MatchPlan; onChange: OnMatchPlanChange }) {
  const policy = plan.attackPlan.sevenVSixPolicy;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SegmentedControl
        label="7v6-policy"
        value={policy.level}
        options={SEVEN_V_SIX_POLICY_LEVELS}
        renderLabel={(v) => SEVEN_V_SIX_POLICY_LABELS_SV[v]}
        onChange={(level) => onChange((prev) => updateSevenVSixPolicy(prev, { level }))}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--hm-text-2xs)" }}>
        <input type="checkbox" checked={policy.activeFromKickoff} onChange={(e) => { const activeFromKickoff = e.target.checked; onChange((prev) => updateSevenVSixPolicy(prev, { activeFromKickoff })); }} />
        Starta med 7 mot 6
      </label>
    </div>
  );
}
