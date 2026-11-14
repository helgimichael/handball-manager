// Arena Nights Phase 2 -- TRN-02 (A) "Tactics Board" readiness header and TRN-02b/02c (A) phase × manpower
// matrix. Pure, read-only over the saved MatchPlan and team roles: it reports what is set, never changes a
// plan, a tactical value or a calculation. Cells exist only for court modes the tactical domain supports;
// manpower states the domain has no lineup for are reported as "standard" (not interactive).
import type { MatchPlan } from "./types";

export type BoardCourtMode = "ATTACK_6V6" | "DEFENCE_6V6" | "EXCHANGES" | "ATTACK_6V5" | "DEFENCE_5V6" | "ATTACK_7V6";
export type ReadyState = "ok" | "missing" | "standard";
export interface ReadinessChip { id: string; label: string; state: ReadyState; detail: string; mode?: BoardCourtMode; anchor?: string }
export interface MatrixCell { phase: "ATTACK" | "DEFENCE"; manpower: "6v6" | "6v5" | "5v6" | "7v6"; mode?: BoardCourtMode; state: ReadyState; title: string; note: string }

export function boardReadiness(plan: MatchPlan, roles: { captainId?: string | null; penaltyTakers: readonly string[] }, availableIds: ReadonlySet<string>): ReadinessChip[] {
  const squad = plan.squad.players;
  const hasGk = squad.some((p) => p.position === "GK");
  const attack = plan.attackStartingUnit.slots;
  const attackOk = attack.length === 7 && attack.every((s) => s.playerId && availableIds.has(s.playerId));
  const defenceOk = plan.defenceStartingUnit.courtSlots.length === 6 && plan.defenceStartingUnit.courtSlots.every((s) => s.playerId) && !!plan.defenceStartingUnit.goalkeeperId;
  return [
    { id: "squad", label: `Trupp ${squad.length}/16`, state: squad.length >= 14 ? "ok" : squad.length >= 9 ? "standard" : "missing", detail: squad.length >= 14 ? "Matchtruppen är uttagen" : "Fyll matchtruppen", anchor: "plan-squad" },
    { id: "gk", label: "MV", state: hasGk ? "ok" : "missing", detail: hasGk ? "Målvakt uttagen" : "Ingen målvakt i matchtruppen", anchor: "plan-squad" },
    { id: "attack", label: "Startsju", state: attackOk ? "ok" : "missing", detail: attackOk ? "Anfallets startsju är komplett och tillgänglig" : "Startsjun är ofullständig eller har otillgängliga spelare", mode: "ATTACK_6V6" },
    { id: "defence", label: "Försvar", state: defenceOk ? "ok" : "missing", detail: defenceOk ? `${plan.defencePlan.baseFormation} med sex försvarare` : "Försvarets sex platser är inte fyllda", mode: "DEFENCE_6V6" },
    { id: "penalty", label: "7 m", state: roles.penaltyTakers.length ? "ok" : "missing", detail: roles.penaltyTakers.length ? `${roles.penaltyTakers.length} skyttar i ordning` : "Ingen 7-metersskytt vald", anchor: "plan-setpieces" },
    { id: "captain", label: "Kapten", state: roles.captainId ? "ok" : "missing", detail: roles.captainId ? "Lagkapten utsedd" : "Ingen lagkapten utsedd", anchor: "plan-setpieces" },
    { id: "6v5", label: "6v5", state: plan.situationUnits?.ATTACK_6V5?.length ? "ok" : "standard", detail: plan.situationUnits?.ATTACK_6V5?.length ? "Egen uppställning sparad" : "Standard: härleds från 6 mot 6", mode: "ATTACK_6V5" },
    { id: "5v6", label: "5v6", state: plan.situationUnits?.DEFENCE_5V6?.length ? "ok" : "standard", detail: plan.situationUnits?.DEFENCE_5V6?.length ? "Egen uppställning sparad" : "Standard: härleds från 6 mot 6", mode: "DEFENCE_5V6" },
    { id: "7v6", label: "7v6", state: plan.sevenVSixPlayerId ? "ok" : "standard", detail: plan.sevenVSixPlayerId ? "Sjunde utespelare vald" : "Standard: tränarens val i matchen", mode: "ATTACK_7V6" },
  ];
}

export function phaseMatrix(chips: readonly ReadinessChip[]): MatrixCell[] {
  const c = (id: string) => chips.find((x) => x.id === id)!;
  return [
    { phase: "ATTACK", manpower: "6v6", mode: "ATTACK_6V6", state: c("attack").state, title: "Anfall 6 mot 6", note: "Startsjua & anfallsroller" },
    { phase: "ATTACK", manpower: "6v5", mode: "ATTACK_6V5", state: c("6v5").state, title: "Anfall 6 mot 5", note: "Numerärt överläge" },
    { phase: "ATTACK", manpower: "5v6", state: "standard", title: "Anfall 5 mot 6", note: "Ingen egen uppställning i matchplanen – följer 6 mot 6" },
    { phase: "ATTACK", manpower: "7v6", mode: "ATTACK_7V6", state: c("7v6").state, title: "Anfall 7 mot 6", note: "Tomt mål & extra utespelare" },
    { phase: "DEFENCE", manpower: "6v6", mode: "DEFENCE_6V6", state: c("defence").state, title: "Försvar 6 mot 6", note: "Försvarssystem & byten" },
    { phase: "DEFENCE", manpower: "6v5", state: "standard", title: "Försvar 6 mot 5", note: "Ingen egen uppställning i matchplanen – följer 6 mot 6" },
    { phase: "DEFENCE", manpower: "5v6", mode: "DEFENCE_5V6", state: c("5v6").state, title: "Försvar 5 mot 6", note: "Numerärt underläge" },
    { phase: "DEFENCE", manpower: "7v6", state: "standard", title: "Försvar mot 7 mot 6", note: "Ingen egen uppställning i matchplanen – följer 6 mot 6" },
  ];
}
