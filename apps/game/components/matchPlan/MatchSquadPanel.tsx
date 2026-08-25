"use client";

// HM-TACTICS-1.1 Part B: MATCHTRUPP (max 16, selected for this fixture)
// vs EJ UTTAGNA (everyone else in the club squad). Selection is
// enforced through HM-TACTICS-1.0's own MATCH_SQUAD_MAX_PLAYERS
// constant and matchPlanEdits.ts's pure add/remove functions -- no
// separate limit invented here.
//
// HM-MATCH-1.3B Part L/M / HM-MATCH-1.3B2 Part 6/7: within Matchtrupp,
// PÅ PLAN and BÄNK are visually split, and every row is a valid DRAG
// SOURCE for CourtBoard's drop targets (Part E) -- a bench row dragged
// onto a court slot replaces that slot's occupant, who returns to the
// bench (matchPlanEdits.ts's existing swap/replace semantics,
// unchanged). No new component talks to CourtBoard directly; the
// browser's own dataTransfer carries the dragged playerId across the
// sibling-component boundary.
//
// HM-MATCH-1.3B2 Part 6/7 (bug fix): PÅ PLAN is now derived from
// `currentUnitPlayerIds(plan, phase)` -- the SAME phase currently shown
// on the board (lifted from StartingUnitEditor into the parent page) --
// never the old `isPlayerStarting` UNION across both attack and
// defence, which could legitimately exceed 7 whenever the two units
// don't share every player (e.g. phase-specific specialists). PÅ PLAN
// and BÄNK are therefore always a clean partition of Matchtrupp for
// whichever unit is displayed: their union is exactly Matchtrupp, their
// intersection is empty, and PÅ PLAN's size exactly matches that unit's
// own slot count (7).
import type { CSSProperties } from "react";
import { PlayerLink } from "@/components/entityLinks";
import { MATCH_SQUAD_MAX_PLAYERS, type MatchPlan } from "@/lib/matchPlan/types";
import { MATCH_ROLE_LABELS_SV, matchPlanPositionLabel, PHASE_USAGE_LABELS_SV, PLAYING_TIME_INTENTION_INDICATOR_SV } from "@/lib/matchPlan/matchPlanLabels";
import { addPlayerToSquad, currentUnitPlayerIds, isPlayerStarting, removePlayerFromSquad, substitutionPartnerOf, type OnMatchPlanChange } from "@/lib/matchPlan/matchPlanEdits";
import type { SelectablePlayer } from "@/lib/matchPlan/careerSquadBridge";
import { PLAYER_ID_MIME } from "./CourtBoard";
import type { CourtPhase } from "./StartingUnitEditor";

export default function MatchSquadPanel({
  plan,
  phase,
  selectablePlayers,
  onChange,
  onOpenPlayerPanel,
}: {
  plan: MatchPlan;
  /** HM-MATCH-1.3B2 Part 6/7: whichever unit (ANFALL/FÖRSVAR) is currently displayed on the board -- PÅ PLAN always reflects exactly this unit, never a cross-phase union. */
  phase: CourtPhase;
  selectablePlayers: readonly SelectablePlayer[];
  onChange: OnMatchPlanChange;
  onOpenPlayerPanel: (playerId: string) => void;
}) {
  const byId = new Map(selectablePlayers.map((p) => [p.playerId, p]));
  const squadIds = new Set(plan.squad.players.map((p) => p.playerId));
  const selected = plan.squad.players.map((sp) => ({ sp, info: byId.get(sp.playerId) })).filter((x) => x.info);
  const onCourtIds = currentUnitPlayerIds(plan, phase);
  const onCourt = selected.filter(({ sp }) => onCourtIds.has(sp.playerId));
  const bench = selected.filter(({ sp }) => !onCourtIds.has(sp.playerId));
  const notSelected = selectablePlayers.filter((p) => !squadIds.has(p.playerId));
  const atMax = plan.squad.players.length >= MATCH_SQUAD_MAX_PLAYERS;

  function renderRow({ sp, info }: { sp: MatchPlan["squad"]["players"][number]; info: SelectablePlayer | undefined }, onCourtNow: boolean) {
    const partner = substitutionPartnerOf(plan, sp.playerId);
    const usage = plan.playerUsage.find((u) => u.playerId === sp.playerId);
    // Removal is guarded by "starting in ANY phase" (Part B's original
    // "no random automatic substitutions" invariant) -- deliberately
    // NOT the same as `onCourtNow` above, which is scoped to only the
    // CURRENTLY DISPLAYED phase. A player benched on the ATTACK board
    // but still starting in DEFENCE must stay un-removable even while
    // viewing ATTACK.
    const startingAnyPhase = isPlayerStarting(plan, sp.playerId);
    return (
      <div
        key={sp.playerId}
        style={{ ...rowStyle, background: onCourtNow ? "var(--hm-accent-subtle, rgba(88,166,255,0.08))" : undefined }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(PLAYER_ID_MIME, sp.playerId);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => onOpenPlayerPanel(sp.playerId)}
      >
        <span className="hm-shirt-number" style={onCourtNow ? { boxShadow: "0 0 0 2px var(--hm-accent)" } : undefined}>
          {info!.shirtNumber ?? "–"}
        </span>
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
          title={startingAnyPhase ? "Ta bort spelaren från startuppställningen/försvaret innan du kan plocka bort denna spelare ur truppen" : "Ta bort ur matchtruppen"}
          disabled={startingAnyPhase}
          style={{ opacity: startingAnyPhase ? 0.35 : 1 }}
          onClick={(e) => {
            e.stopPropagation();
            if (!startingAnyPhase) onChange((prev) => removePlayerFromSquad(prev, sp.playerId));
          }}
        >
          ✕
        </button>
      </div>
    );
  }

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
          <div className="hm-eyebrow" style={{ padding: "8px 12px 2px" }}>
            På plan ({onCourt.length})
          </div>
          {onCourt.map((row) => renderRow(row, true))}
          <div className="hm-eyebrow" style={{ padding: "10px 12px 2px" }}>
            Bänk ({bench.length})
          </div>
          {bench.map((row) => renderRow(row, false))}
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

const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderBottom: "1px solid var(--hm-border-subtle)", cursor: "grab" };
