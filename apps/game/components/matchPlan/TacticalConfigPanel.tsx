"use client";

// HM-TACTICS-1.1 Part I/J/K/L: the TACTICAL PHASE navigation (ANFALL /
// FÖRSVAR / OMSTÄLLNING) -- deliberately a SEPARATE tab strip from
// StartingUnitEditor's own ANFALL | FÖRSVAR "court phase" switch above
// it. That one answers "which starting unit am I editing?"; this one
// answers "which team instructions am I editing?" (HM-TACTICS-1.0's
// AttackPlanConfig / DefencePlanConfig / TransitionPlanConfig -- three
// genuinely separate objects, never collapsed together).
import { useState } from "react";
import SegmentedControl from "@/components/SegmentedControl";
import Tabs from "@/components/Tabs";
import { updateAttackPlan, updateDefencePlan, updateTransitionPlan, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import {
  BALL_CIRCULATION_LABELS_SV,
  DEFENSIVE_DEPTH_LABELS_SV,
  INTENSITY_LABELS_SV,
  STRUCTURE_FREEDOM_LABELS_SV,
  SUBSTITUTION_PRIORITY_LABELS_SV,
  TEMPO_LABELS_SV,
} from "@/lib/matchPlan/matchPlanLabels";
import type { IntensityLevel, MatchPlan } from "@/lib/matchPlan/types";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";
import type { SpecialPlayPlan } from "@/lib/matchPlan/specialPlay";
import { DEFENCE_FORMATION_OPTIONS } from "./courtScene";
import SpecialPlayPanel from "./SpecialPlayPanel";

const INTENSITY_OPTIONS: readonly IntensityLevel[] = ["LOW", "MEDIUM", "HIGH"];
const TACTICAL_PHASES = ["ATTACK", "DEFENCE", "TRANSITION", "SPECIAL"] as const;
type TacticalPhase = (typeof TACTICAL_PHASES)[number];
const TACTICAL_PHASE_LABELS_SV: Record<TacticalPhase, string> = { ATTACK: "ANFALL", DEFENCE: "FÖRSVAR", TRANSITION: "OMSTÄLLNING", SPECIAL: "SPECIALSPEL" };

function IntensityControl({ label, value, onChange }: { label: string; value: IntensityLevel; onChange: (v: IntensityLevel) => void }) {
  return <SegmentedControl label={label} value={value} options={INTENSITY_OPTIONS} renderLabel={(v) => INTENSITY_LABELS_SV[v]} onChange={onChange} />;
}

export default function TacticalConfigPanel({
  plan,
  specialPlay,
  selectablePlayers,
  onChange,
  onSpecialPlayChange,
  onOpenPlayerPanel,
}: {
  plan: MatchPlan;
  specialPlay: SpecialPlayPlan;
  selectablePlayers: readonly SelectablePlayer[];
  onChange: OnMatchPlanChange;
  onSpecialPlayChange: (next: SpecialPlayPlan) => void;
  onOpenPlayerPanel?: (playerId: string) => void;
}) {
  const [phase, setPhase] = useState<TacticalPhase>("ATTACK");

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Taktiska instruktioner</span>
        <Tabs value={phase} options={TACTICAL_PHASES} renderLabel={(v) => TACTICAL_PHASE_LABELS_SV[v]} onChange={setPhase} />
      </div>

      {phase === "ATTACK" ? (
        <AttackTacticsForm plan={plan} onChange={onChange} />
      ) : phase === "DEFENCE" ? (
        <DefenceTacticsForm plan={plan} onChange={onChange} />
      ) : phase === "TRANSITION" ? (
        <TransitionTacticsForm plan={plan} onChange={onChange} />
      ) : (
        <SpecialPlayPanel plan={plan} specialPlay={specialPlay} selectablePlayers={selectablePlayers} onChange={onChange} onSpecialPlayChange={onSpecialPlayChange} onOpenPlayerPanel={onOpenPlayerPanel} />
      )}
    </div>
  );
}

// HM-TACTICS-1.2 Part 7/8: the coach's most important attack decisions
// (grundidé/tempo, bollcirkulation) are visible immediately; the more
// granular per-area emphases (M6/inspel, duell/genombrott, bredd/kant,
// skott) sit behind "FLER ANFALLSINSTRUKTIONER" so the primary view
// isn't 9 equally-weighted controls at once (Part 8: progressive
// disclosure, not a wall of a form). HM-MATCH-1.2 Part H: 7v6 moved out
// of this tab into its own SPECIALSPEL tab (SpecialPlayPanel), grouped
// with the new 6v5/5v6/defensive-special-situation plans -- Specialspel
// is now a first-class tactical area, not a sub-section here.
function AttackTacticsForm({ plan, onChange }: { plan: MatchPlan; onChange: OnMatchPlanChange }) {
  const p = plan.attackPlan;
  const update = (changes: Partial<Omit<MatchPlan["attackPlan"], "sevenVSixPolicy">>) => onChange((prev) => updateAttackPlan(prev, changes));
  return (
    <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="hm-eyebrow">Grundidé</div>
        <SegmentedControl label="Tempo" value={p.tempo} options={["SLOW", "BALANCED", "FAST"] as const} renderLabel={(v) => TEMPO_LABELS_SV[v]} onChange={(tempo) => update({ tempo })} />
        <SegmentedControl label="Struktur" value={p.structureFreedom} options={["STRUCTURED", "BALANCED", "FREE"] as const} renderLabel={(v) => STRUCTURE_FREEDOM_LABELS_SV[v]} onChange={(structureFreedom) => update({ structureFreedom })} />
        <SegmentedControl label="Bollcirkulation" value={p.ballCirculation} options={["DIRECT", "BALANCED", "PATIENT"] as const} renderLabel={(v) => BALL_CIRCULATION_LABELS_SV[v]} onChange={(ballCirculation) => update({ ballCirculation })} />
      </div>

      <details>
        <summary className="hm-eyebrow" style={{ cursor: "pointer" }}>
          Fler anfallsinstruktioner
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
          <IntensityControl label="M6-användning (pivot/inspel)" value={p.pivotUsage} onChange={(pivotUsage) => update({ pivotUsage })} />
          <IntensityControl label="2-mot-2-betoning (duell)" value={p.twoVTwoEmphasis} onChange={(twoVTwoEmphasis) => update({ twoVTwoEmphasis })} />
          <IntensityControl label="Genombrottsbetoning" value={p.breakthroughEmphasis} onChange={(breakthroughEmphasis) => update({ breakthroughEmphasis })} />
          <IntensityControl label="Kantanvändning (bredd)" value={p.wingUsage} onChange={(wingUsage) => update({ wingUsage })} />
          <IntensityControl label="Skottbetoning" value={p.shootingEmphasis} onChange={(shootingEmphasis) => update({ shootingEmphasis })} />
        </div>
      </details>
    </div>
  );
}

// HM-TACTICS-1.2 Part 7: formation first, then the primary defensive
// identity (höjd/kontakt); the remaining fields that exist on
// DefencePlanConfig (täck/block, press mot boll, risknivå) sit behind
// "FLER FÖRSVARSINSTRUKTIONER" -- only vocabulary that actually exists
// on the domain type, nothing invented for the sake of matching every
// named example group in the spec verbatim.
function DefenceTacticsForm({ plan, onChange }: { plan: MatchPlan; onChange: OnMatchPlanChange }) {
  const p = plan.defencePlan;
  const update = (changes: Partial<MatchPlan["defencePlan"]>) => onChange((prev) => updateDefencePlan(prev, changes));
  return (
    <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
          <span className="hm-eyebrow">Formation</span>
          <select className="hm-select" style={selectStyle} value={p.baseFormation} onChange={(e) => update({ baseFormation: e.target.value })}>
            {DEFENCE_FORMATION_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <SegmentedControl label="Försvarshöjd" value={p.defensiveDepth} options={["DEEP", "STANDARD", "HIGH"] as const} renderLabel={(v) => DEFENSIVE_DEPTH_LABELS_SV[v]} onChange={(defensiveDepth) => update({ defensiveDepth })} />
        <IntensityControl label="Kontakt" value={p.contactIntent} onChange={(contactIntent) => update({ contactIntent })} />
      </div>

      <details>
        <summary className="hm-eyebrow" style={{ cursor: "pointer" }}>
          Fler försvarsinstruktioner
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
          <IntensityControl label="Täckning/blockering" value={p.coverBlockingEmphasis} onChange={(coverBlockingEmphasis) => update({ coverBlockingEmphasis })} />
          <IntensityControl label="Press mot boll" value={p.ballOrientedPressure} onChange={(ballOrientedPressure) => update({ ballOrientedPressure })} />
          <IntensityControl label="Risknivå" value={p.riskLevel} onChange={(riskLevel) => update({ riskLevel })} />
        </div>
      </details>
    </div>
  );
}

function TransitionTacticsForm({ plan, onChange }: { plan: MatchPlan; onChange: OnMatchPlanChange }) {
  const p = plan.transitionPlan;
  const update = (changes: Partial<MatchPlan["transitionPlan"]>) => onChange((prev) => updateTransitionPlan(prev, changes));
  return (
    <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
          Offensiv omställning
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <IntensityControl label="Omställningsintention" value={p.offensiveTransitionIntent} onChange={(offensiveTransitionIntent) => update({ offensiveTransitionIntent })} />
          <IntensityControl label="Första-vågs-aggressivitet" value={p.firstWaveAggression} onChange={(firstWaveAggression) => update({ firstWaveAggression })} />
          <IntensityControl label="Målvaktsinitiering" value={p.goalkeeperInitiation} onChange={(goalkeeperInitiation) => update({ goalkeeperInitiation })} />
        </div>
      </div>
      <div>
        <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
          Defensiv omställning
        </div>
        <IntensityControl label="Återfallsintention" value={p.defensiveRetreatIntent} onChange={(defensiveRetreatIntent) => update({ defensiveRetreatIntent })} />
      </div>
      <div>
        <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
          Växlingsprioritet
        </div>
        <SegmentedControl
          label="Snabb omställning vs. rätt specialister på/av"
          value={p.substitutionPriority}
          options={["ATTACK_FIRST", "DEFENCE_FIRST", "BALANCED"] as const}
          renderLabel={(v) => SUBSTITUTION_PRIORITY_LABELS_SV[v]}
          onChange={(substitutionPriority) => update({ substitutionPriority })}
        />
      </div>
    </div>
  );
}

const selectStyle = { background: "var(--hm-surface-2)", border: "1px solid var(--hm-border)", borderRadius: "var(--hm-radius-sm)", color: "var(--hm-text-primary)", padding: "7px 10px", fontSize: "var(--hm-text-xs)" };
