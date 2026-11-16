"use client";
// Arena Nights TRN-01 (individual advice): the assistant's per-player
// load/focus advice as a list with each player's projected matchday
// readiness. Same draft edits and checkbox selection as before (M6C/M6D):
// nothing applies until the plan is approved, and only checked players.
import { getCareerSquad } from "@/lib/career/careerWorld";
import { editAssistantTrainingPlan } from "@/lib/training/assistantTraining";
import { PLAYER_TRAINING_LOAD_SETTINGS, type PlayerTrainingLoadSetting } from "@/lib/training/types";
import { INDIVIDUAL_DEVELOPMENT_FOCUSES, type IndividualDevelopmentFocus } from "@/lib/development/types";
import type { ReadinessProjection } from "@/lib/training/readinessProjection";
import type { AssistantTraining } from "@/components/manager/AssistantTrainingPanel";
import { PlayerLink } from "@/components/entityLinks";

const loads: Record<PlayerTrainingLoadSetting, string> = { FULL: "Full", REDUCED: "Reducerad", RECOVERY_ONLY: "Endast återhämtning", REST: "Vila" };
const focuses: Record<IndividualDevelopmentFocus, string> = { NORMAL: "Allsidig", TECHNICAL: "Teknik", ATTACKING_DECISIONS: "Anfallsspel", DEFENCE: "Försvar", PHYSICAL: "Fysik", MENTAL: "Mentalt", GOALKEEPER: "Målvakt" };

export default function AssistantAdviceList({ ctx, live, proposed }: { ctx: AssistantTraining; live: ReadinessProjection; proposed: ReadinessProjection | null }) {
  const { career, proposal, plan, run } = ctx;
  if (!proposal || !plan) return null;
  const players = new Map(getCareerSquad(career).map((p) => [p.id, p]));
  const selectedCount = plan.players.filter((p) => p.selected).length;
  return (
    <section className="hm-panel trn-advice" aria-labelledby="trn-advice-title">
      <div className="trn-planner-head">
        <h2 id="trn-advice-title" className="hm-panel-title">Individuella råd</h2>
        <span className="trn-hint">{selectedCount} av {plan.players.length} markerade</span>
      </div>
      <p className="trn-hint">Markera bara de ändringar du vill genomföra. Valen gäller tills du ändrar dem i spelarens träningsinställningar. Skadade spelare följer alltid medicinska begränsningar.</p>
      <ul className="trn-advice-list">
        {plan.players.map((player) => {
          const person = players.get(player.playerId);
          const name = person ? `${person.firstName} ${person.lastName}` : player.playerId;
          const edit = (patch: Partial<typeof player>) => run((s) => editAssistantTrainingPlan(s, proposal.id, (p) => ({ ...p, players: p.players.map((x) => (x.playerId === player.playerId ? { ...x, ...patch } : x)) })), "Individuellt förslag ändrat.");
          const before = live.byPlayer[player.playerId]?.projected;
          const after = proposed?.byPlayer[player.playerId]?.projected;
          const currentLoad = career.playerTrainingAssignments[player.playerId]?.loadSetting ?? "FULL";
          const changesLoad = currentLoad !== player.loadSetting;
          return (
            <li key={player.playerId} data-selected={player.selected || undefined}>
              <input type="checkbox" aria-label={`Godkänn individuellt ${player.playerId}`} checked={player.selected} onChange={(e) => edit({ selected: e.target.checked })} />
              <div className="trn-advice-who">
                <PlayerLink playerId={player.playerId}>{name}</PlayerLink>
                <small>{person?.position}{changesLoad ? ` · ${loads[currentLoad]} → ${loads[player.loadSetting]}` : ""}</small>
                <p>{player.reason}</p>
              </div>
              <div className="trn-advice-proj" title="Prognos för matchberedskap: ditt schema → med förslaget (markerade råd ingår)">
                <span className="trn-num">{before ?? "—"} %</span>
                <span aria-hidden="true">→</span>
                <b className="trn-num">{after ?? "—"} %</b>
              </div>
              <label className="trn-field">
                <span>Belastning</span>
                <select className="hm-select" aria-label={`Föreslagen belastning ${player.playerId}`} value={player.loadSetting} onChange={(e) => edit({ loadSetting: e.target.value as PlayerTrainingLoadSetting })}>
                  {PLAYER_TRAINING_LOAD_SETTINGS.map((t) => <option key={t} value={t}>{loads[t]}</option>)}
                </select>
              </label>
              <label className="trn-field">
                <span>Fokus</span>
                <select className="hm-select" aria-label={`Föreslaget fokus ${player.playerId}`} value={player.individualFocus} onChange={(e) => edit({ individualFocus: e.target.value as IndividualDevelopmentFocus })}>
                  {INDIVIDUAL_DEVELOPMENT_FOCUSES.map((t) => <option key={t} value={t}>{focuses[t]}</option>)}
                </select>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
