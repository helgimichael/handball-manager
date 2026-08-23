"use client";

// HM-TACTICS-1.1 Part G/H: the compact per-match "Match Instruction"
// panel -- deliberately NOT the normal Player Profile (that stays
// /career/squad/[playerId], see HM-UX-RATINGS-0.1). This is about THIS
// MATCH only: match role, playing-time intention, phase usage, and an
// explicit substitution-pair relationship.
import { PlayerLink } from "@/components/entityLinks";
import SegmentedControl from "@/components/SegmentedControl";
import { clearSubstitutionPairFor, setPlayerMatchRole, setPlayerPhaseUsage, setPlayerPlayingTime, setSubstitutionPair, substitutionPartnerOf, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import { MATCH_ROLE_LABELS_SV, matchPlanPositionLabel, PHASE_USAGE_LABELS_SV, PLAYING_TIME_INTENTION_LABELS_SV } from "@/lib/matchPlan/matchPlanLabels";
import { MATCH_ROLES, PLAYER_PHASE_USAGES, PLAYING_TIME_INTENTIONS, type MatchPlan } from "@/lib/matchPlan/types";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";

export default function PlayerInstructionPanel({
  plan,
  playerId,
  selectablePlayers,
  onChange,
  onClose,
}: {
  plan: MatchPlan;
  playerId: string;
  selectablePlayers: readonly SelectablePlayer[];
  onChange: OnMatchPlanChange;
  onClose: () => void;
}) {
  const info = selectablePlayers.find((p) => p.playerId === playerId);
  const usage = plan.playerUsage.find((u) => u.playerId === playerId);
  if (!info || !usage) return null;

  const attackSlot = plan.attackStartingUnit.slots.find((s) => s.playerId === playerId);
  const defenceSlot = plan.defenceStartingUnit.courtSlots.find((s) => s.playerId === playerId);
  const isDefenceGk = plan.defenceStartingUnit.goalkeeperId === playerId;

  const partnerId = substitutionPartnerOf(plan, playerId);
  const partnerOptions = plan.squad.players.filter((p) => p.playerId !== playerId);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div className="hm-panel" style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div className="hm-panel-header">
          <span className="hm-panel-title">
            <PlayerLink playerId={playerId}>{info.fullName}</PlayerLink>
          </span>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClose}>
            Stäng
          </button>
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", paddingBottom: 0 }}>
          POSITION: {matchPlanPositionLabel(info.position)}
          {attackSlot ? ` · Anfall: ${matchPlanPositionLabel(attackSlot.position)}` : ""}
          {defenceSlot ? ` · Försvar: rutan ${defenceSlot.courtSlot}` : isDefenceGk ? " · Försvar: målvakt" : ""}
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SegmentedControl label="Matchroll" value={usage.matchRole} options={MATCH_ROLES} renderLabel={(v) => MATCH_ROLE_LABELS_SV[v]} onChange={(v) => onChange((prev) => setPlayerMatchRole(prev, playerId, v))} />
          <SegmentedControl
            label="Speltid"
            value={usage.playingTimeIntention}
            options={PLAYING_TIME_INTENTIONS}
            renderLabel={(v) => PLAYING_TIME_INTENTION_LABELS_SV[v]}
            onChange={(v) => onChange((prev) => setPlayerPlayingTime(prev, playerId, v))}
          />
          <SegmentedControl label="Fasanvändning" value={usage.phaseUsage} options={PLAYER_PHASE_USAGES} renderLabel={(v) => PHASE_USAGE_LABELS_SV[v]} onChange={(v) => onChange((prev) => setPlayerPhaseUsage(prev, playerId, v))} />

          <div>
            <div className="hm-eyebrow" style={{ marginBottom: 4 }}>
              Byter med
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                className="hm-select"
                style={selectStyle}
                value={partnerId ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    if (partnerId) onChange((prev) => clearSubstitutionPairFor(prev, playerId));
                    return;
                  }
                  onChange((prev) => setSubstitutionPair(prev, playerId, value));
                }}
              >
                <option value="">Ingen koppling</option>
                {partnerOptions.map((p) => {
                  const partnerInfo = selectablePlayers.find((sp) => sp.playerId === p.playerId);
                  return (
                    <option key={p.playerId} value={p.playerId}>
                      {partnerInfo?.fullName ?? p.playerId}
                    </option>
                  );
                })}
              </select>
            </div>
            <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: "6px 0 0" }}>
              Anger vilka två spelare som är tänkta att byta av varandra mellan anfall och försvar. Simuleras inte ännu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 };
const panelStyle = { width: 420, maxHeight: "80vh", overflowY: "auto" as const };
const selectStyle = { background: "var(--hm-surface-2)", border: "1px solid var(--hm-border)", borderRadius: "var(--hm-radius-sm)", color: "var(--hm-text-primary)", padding: "7px 10px", fontSize: "var(--hm-text-xs)", flex: 1 };
