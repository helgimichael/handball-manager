"use client";

// HM-TACTICS-1.1 Part G/H: the compact per-match "Match Instruction"
// panel -- deliberately NOT the normal Player Profile (that stays
// /career/squad/[playerId], see HM-UX-RATINGS-0.1). This is about THIS
// MATCH only: match role, playing-time intention, phase usage, and an
// explicit substitution-pair relationship.
import { PlayerLink } from "@/components/entityLinks";
import SegmentedControl from "@/components/SegmentedControl";
import { applyPlayerMatchDefault, clearSubstitutionPairFor, setPlayerMatchRole, setPlayerPhaseUsage, setPlayerPlayingTime, setSubstitutionPair, substitutionPartnerOf, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import { defenceCourtSlotLabel, MATCH_ROLE_LABELS_SV, matchPlanPositionLabel, PHASE_USAGE_LABELS_SV, PLAYING_TIME_INTENTION_LABELS_SV } from "@/lib/matchPlan/matchPlanLabels";
import { MATCH_ROLES, PLAYER_PHASE_USAGES, PLAYING_TIME_INTENTIONS, type MatchPlan } from "@/lib/matchPlan/types";
import type { PlayerMatchDefault } from "@/lib/matchPlan/persistentDefaults";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";

/**
 * HM-MATCH-1.2 Part C: is this player's CURRENT match usage identical to
 * their persistent standard? Used to show "STANDARD" vs "AVVIKELSE FÖR
 * DENNA MATCH" and to decide whether "Använd som standard"/"Återställ
 * till standard" are meaningful right now.
 */
function usageMatchesDefault(usage: { matchRole: string; playingTimeIntention: string; phaseUsage: string }, playerDefault: PlayerMatchDefault | undefined): boolean {
  if (!playerDefault) return false;
  return usage.matchRole === playerDefault.matchRole && usage.playingTimeIntention === playerDefault.playingTimeIntention && usage.phaseUsage === playerDefault.phaseUsage;
}

export default function PlayerInstructionPanel({
  plan,
  playerId,
  selectablePlayers,
  playerDefault,
  onChange,
  onSetAsDefault,
  onClose,
}: {
  plan: MatchPlan;
  playerId: string;
  selectablePlayers: readonly SelectablePlayer[];
  /** The player's persistent standard (CareerState.playerMatchDefaults[playerId]), or undefined if never set. */
  playerDefault: PlayerMatchDefault | undefined;
  onChange: OnMatchPlanChange;
  /** HM-MATCH-1.2 Part C: "Använd som standard" -- promotes the CURRENT usage into the persistent standard. */
  onSetAsDefault: (value: PlayerMatchDefault) => void;
  onClose: () => void;
}) {
  const info = selectablePlayers.find((p) => p.playerId === playerId);
  const usage = plan.playerUsage.find((u) => u.playerId === playerId);
  if (!info || !usage) return null;

  const isStandard = usageMatchesDefault(usage, playerDefault);

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
          {defenceSlot ? ` · Försvar: ${defenceCourtSlotLabel(defenceSlot.courtSlot)}` : isDefenceGk ? " · Försvar: målvakt" : ""}
        </div>
        <div className="hm-panel-body" style={{ paddingBottom: 0, paddingTop: 0 }}>
          <span className={`hm-badge ${isStandard ? "hm-badge-neutral" : "hm-badge-warning"}`} style={{ fontSize: "var(--hm-text-2xs)" }}>
            {isStandard ? "STANDARD" : playerDefault ? "AVVIKELSE FÖR DENNA MATCH" : "INGEN STANDARD SATT ÄNNU"}
          </span>
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

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="hm-btn hm-btn-sm"
              disabled={isStandard}
              onClick={() => onSetAsDefault({ matchRole: usage.matchRole, playingTimeIntention: usage.playingTimeIntention, phaseUsage: usage.phaseUsage })}
            >
              Använd som standard
            </button>
            <button
              type="button"
              className="hm-btn hm-btn-sm hm-btn-ghost"
              disabled={!playerDefault || isStandard}
              onClick={() => {
                if (playerDefault) onChange((prev) => applyPlayerMatchDefault(prev, playerId, playerDefault));
              }}
            >
              Återställ till standard
            </button>
          </div>
          <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
            &quot;Använd som standard&quot; gör dagens val till spelarens normalläge för framtida matcher. Ett läge för just denna match ändrar aldrig standarden av sig själv.
          </p>

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
