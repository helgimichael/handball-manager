"use client";

// HM-TACTICS-1.1 Part B: MATCHTRUPP (max 16, selected for this fixture)
// vs EJ UTTAGNA (everyone else in the club squad). Selection is
// enforced through HM-TACTICS-1.0's own MATCH_SQUAD_MAX_PLAYERS
// constant and matchPlanEdits.ts's pure add/remove functions -- no
// separate limit invented here.
import type { CSSProperties } from "react";
import { PlayerLink } from "@/components/entityLinks";
import { MATCH_SQUAD_MAX_PLAYERS, type MatchPlan } from "@/lib/matchPlan/types";
import { MATCH_ROLE_LABELS_SV, matchPlanPositionLabel, PHASE_USAGE_LABELS_SV, PLAYING_TIME_INTENTION_INDICATOR_SV } from "@/lib/matchPlan/matchPlanLabels";
import { addPlayerToSquad, isPlayerStarting, removePlayerFromSquad, substitutionPartnerOf, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";

export default function MatchSquadPanel({
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
  const byId = new Map(selectablePlayers.map((p) => [p.playerId, p]));
  const squadIds = new Set(plan.squad.players.map((p) => p.playerId));
  const selected = plan.squad.players.map((sp) => ({ sp, info: byId.get(sp.playerId) })).filter((x) => x.info);
  const notSelected = selectablePlayers.filter((p) => !squadIds.has(p.playerId));
  const atMax = plan.squad.players.length >= MATCH_SQUAD_MAX_PLAYERS;

  return (
    <>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Matchtrupp</span>
          <span className={`hm-badge ${atMax ? "hm-badge-positive" : "hm-badge-neutral"}`}>
            {plan.squad.players.length} / {MATCH_SQUAD_MAX_PLAYERS}
          </span>
        </div>
        <div>
          {selected.map(({ sp, info }) => {
            const starting = isPlayerStarting(plan, sp.playerId);
            const partner = substitutionPartnerOf(plan, sp.playerId);
            const usage = plan.playerUsage.find((u) => u.playerId === sp.playerId);
            return (
              <div key={sp.playerId} style={rowStyle} onClick={() => onOpenPlayerPanel(sp.playerId)}>
                <span className="hm-shirt-number">{info!.shirtNumber ?? "–"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--hm-text-xs)", fontWeight: 600 }}>
                    <PlayerLink playerId={sp.playerId} stopPropagation>
                      {info!.fullName}
                    </PlayerLink>
                    {partner ? <span title="Byter med" style={{ color: "var(--hm-accent)" }}>⇄</span> : null}
                  </div>
                  {usage ? (
                    <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                      {matchPlanPositionLabel(sp.position)} · {MATCH_ROLE_LABELS_SV[usage.matchRole]} · {PHASE_USAGE_LABELS_SV[usage.phaseUsage]} {PLAYING_TIME_INTENTION_INDICATOR_SV[usage.playingTimeIntention]}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="hm-btn hm-btn-sm hm-btn-ghost"
                  title={starting ? "Ta bort spelaren från startuppställningen/försvaret innan du kan plocka bort denna spelare ur truppen" : "Ta bort ur matchtruppen"}
                  disabled={starting}
                  style={{ opacity: starting ? 0.35 : 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!starting) onChange((prev) => removePlayerFromSquad(prev, sp.playerId));
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
          {selected.length === 0 ? <div className="hm-panel-body hm-text-muted">Ingen spelare uttagen ännu.</div> : null}
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Ej uttagna</span>
        </div>
        <div>
          {notSelected.map((p) => (
            <div key={p.playerId} style={rowStyle}>
              <span className="hm-shirt-number">{p.shirtNumber ?? "–"}</span>
              <span style={{ fontSize: "var(--hm-text-xs)", fontWeight: 600, flex: 1 }}>
                <PlayerLink playerId={p.playerId} stopPropagation>
                  {p.fullName}
                </PlayerLink>
              </span>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                {matchPlanPositionLabel(p.position)}
              </span>
              <button type="button" className="hm-btn hm-btn-sm" disabled={atMax} style={{ opacity: atMax ? 0.35 : 1 }} onClick={() => onChange((prev) => addPlayerToSquad(prev, p.playerId, p.position))}>
                Ta ut
              </button>
            </div>
          ))}
          {notSelected.length === 0 ? <div className="hm-panel-body hm-text-muted">Alla spelare är uttagna.</div> : null}
        </div>
      </div>
    </>
  );
}

const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderBottom: "1px solid var(--hm-border-subtle)", cursor: "pointer" };
