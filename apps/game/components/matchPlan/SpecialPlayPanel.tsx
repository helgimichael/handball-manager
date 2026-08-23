"use client";

// HM-MATCH-1.2 Part H: SPECIALSPEL as a first-class tactical area inside
// persistent Tactics -- 7v6 (existing, reused verbatim), plus the new
// small 6v5/5v6/defensive-special-situation plans (Parts J/K/L). Part M:
// none of the new plans reach Fast Match yet (see specialPlay.ts's own
// doc) -- the "Sparas för framtida matchsimulering" caption makes that
// honestly visible, never a fake effect.
import SegmentedControl from "@/components/SegmentedControl";
import {
  DEFENSIVE_SPECIAL_CENTRAL_FOCUS_OPTIONS,
  DEFENSIVE_SPECIAL_EMPTY_GOAL_OPTIONS,
  DEFENSIVE_SPECIAL_PRESS_OPTIONS,
  DEFENSIVE_SPECIAL_RISK_OPTIONS,
  FIVE_V_SIX_GOALKEEPER_CHOICE_OPTIONS,
  FIVE_V_SIX_INTENT_OPTIONS,
  SIX_V_FIVE_PRIORITY_OPTIONS,
  SIX_V_FIVE_RISK_OPTIONS,
  SIX_V_FIVE_TEMPO_OPTIONS,
  type DefensiveSpecialSituationPlan,
  type SpecialPlayPlan,
} from "@/lib/matchPlan/specialPlay";
import {
  DEFENSIVE_SPECIAL_CENTRAL_FOCUS_LABELS_SV,
  DEFENSIVE_SPECIAL_EMPTY_GOAL_LABELS_SV,
  DEFENSIVE_SPECIAL_PRESS_LABELS_SV,
  DEFENSIVE_SPECIAL_RISK_LABELS_SV,
  FIVE_V_SIX_GOALKEEPER_CHOICE_LABELS_SV,
  FIVE_V_SIX_INTENT_LABELS_SV,
  SIX_V_FIVE_PRIORITY_LABELS_SV,
  SIX_V_FIVE_RISK_LABELS_SV,
  SIX_V_FIVE_TEMPO_LABELS_SV,
} from "@/lib/matchPlan/specialPlayLabels";
import type { MatchPlan } from "@/lib/matchPlan/types";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";
import type { OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import SevenVSixPolicyControl from "./SevenVSixPolicyControl";

function DefensiveSituationForm({ title, value, onChange }: { title: string; value: DefensiveSpecialSituationPlan; onChange: (next: DefensiveSpecialSituationPlan) => void }) {
  return (
    <details>
      <summary className="hm-eyebrow" style={{ cursor: "pointer" }}>
        {title}
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        <SegmentedControl label="Press" value={value.press} options={DEFENSIVE_SPECIAL_PRESS_OPTIONS} renderLabel={(v) => DEFENSIVE_SPECIAL_PRESS_LABELS_SV[v]} onChange={(press) => onChange({ ...value, press })} />
        <SegmentedControl
          label="Centralt fokus"
          value={value.centralFocus}
          options={DEFENSIVE_SPECIAL_CENTRAL_FOCUS_OPTIONS}
          renderLabel={(v) => DEFENSIVE_SPECIAL_CENTRAL_FOCUS_LABELS_SV[v]}
          onChange={(centralFocus) => onChange({ ...value, centralFocus })}
        />
        <SegmentedControl label="Risk" value={value.risk} options={DEFENSIVE_SPECIAL_RISK_OPTIONS} renderLabel={(v) => DEFENSIVE_SPECIAL_RISK_LABELS_SV[v]} onChange={(risk) => onChange({ ...value, risk })} />
        <SegmentedControl
          label="Tomt mål"
          value={value.emptyGoalApproach}
          options={DEFENSIVE_SPECIAL_EMPTY_GOAL_OPTIONS}
          renderLabel={(v) => DEFENSIVE_SPECIAL_EMPTY_GOAL_LABELS_SV[v]}
          onChange={(emptyGoalApproach) => onChange({ ...value, emptyGoalApproach })}
        />
      </div>
    </details>
  );
}

export default function SpecialPlayPanel({
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
  return (
    <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
          7 mot 6 (anfall)
        </div>
        <SevenVSixPolicyControl plan={plan} selectablePlayers={selectablePlayers} onChange={onChange} onOpenPlayerPanel={onOpenPlayerPanel} />
      </div>

      <div>
        <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
          6 mot 5 (anfall, numerärt överläge)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SegmentedControl
            label="Tempo"
            value={specialPlay.sixVFive.tempo}
            options={SIX_V_FIVE_TEMPO_OPTIONS}
            renderLabel={(v) => SIX_V_FIVE_TEMPO_LABELS_SV[v]}
            onChange={(tempo) => onSpecialPlayChange({ ...specialPlay, sixVFive: { ...specialPlay.sixVFive, tempo } })}
          />
          <SegmentedControl
            label="Risknivå"
            value={specialPlay.sixVFive.risk}
            options={SIX_V_FIVE_RISK_OPTIONS}
            renderLabel={(v) => SIX_V_FIVE_RISK_LABELS_SV[v]}
            onChange={(risk) => onSpecialPlayChange({ ...specialPlay, sixVFive: { ...specialPlay.sixVFive, risk } })}
          />
          <SegmentedControl
            label="Prioritering"
            value={specialPlay.sixVFive.priority}
            options={SIX_V_FIVE_PRIORITY_OPTIONS}
            renderLabel={(v) => SIX_V_FIVE_PRIORITY_LABELS_SV[v]}
            onChange={(priority) => onSpecialPlayChange({ ...specialPlay, sixVFive: { ...specialPlay.sixVFive, priority } })}
          />
        </div>
      </div>

      <div>
        <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
          5 mot 6 (anfall, numerärt underläge)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SegmentedControl
            label="Målvakt"
            value={specialPlay.fiveVSix.goalkeeperChoice}
            options={FIVE_V_SIX_GOALKEEPER_CHOICE_OPTIONS}
            renderLabel={(v) => FIVE_V_SIX_GOALKEEPER_CHOICE_LABELS_SV[v]}
            onChange={(goalkeeperChoice) => onSpecialPlayChange({ ...specialPlay, fiveVSix: { ...specialPlay.fiveVSix, goalkeeperChoice } })}
          />
          <SegmentedControl
            label="Intention"
            value={specialPlay.fiveVSix.intent}
            options={FIVE_V_SIX_INTENT_OPTIONS}
            renderLabel={(v) => FIVE_V_SIX_INTENT_LABELS_SV[v]}
            onChange={(intent) => onSpecialPlayChange({ ...specialPlay, fiveVSix: { ...specialPlay.fiveVSix, intent } })}
          />
        </div>
      </div>

      <div>
        <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
          Försvar mot specialsituationer
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <DefensiveSituationForm title="Mot 7 mot 6" value={specialPlay.against7v6} onChange={(against7v6) => onSpecialPlayChange({ ...specialPlay, against7v6 })} />
          <DefensiveSituationForm title="Mot 6 mot 5" value={specialPlay.against6v5} onChange={(against6v5) => onSpecialPlayChange({ ...specialPlay, against6v5 })} />
          <DefensiveSituationForm title="Mot 5 mot 6" value={specialPlay.against5v6} onChange={(against5v6) => onSpecialPlayChange({ ...specialPlay, against5v6 })} />
        </div>
      </div>

      <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
        6 mot 5, 5 mot 6 och försvar mot specialsituationer sparas som taktisk inriktning men påverkar inte matchsimuleringen ännu. 7 mot 6 (ovan) påverkar redan matchen, både i planering och live.
      </p>
    </div>
  );
}
