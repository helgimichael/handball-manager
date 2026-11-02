// HM-PLAYTEST-01 WS2: the manager's saved match plan, translated into the
// engine's TeamMatchPlan (packages/handball-engine/src/v2/core/matchPlanDirectives.ts).
// Every id is checked against the registered matchday squad here, so the
// engine can never be asked to use somebody who was not selected.
import type { TeamMatchPlan, UnitEntry } from "@handball-manager/handball-engine/src/v2/core/matchPlanDirectives";
import type { Role } from "@handball-manager/handball-engine/src/v2/core/state";
import { normalizeBaseFormation } from "./defenceFormation";
import type { DefenceSystemKey, MatchPlan } from "./types";
import type { TeamRoles } from "../career/teamRoles";

export const ENGINE_ROLE_BY_CODE: Readonly<Record<string, Role>> = { V6: "LW", V9: "LB", M9: "CB", H9: "RB", H6: "RW", M6: "P" };
/** The engine's own default space per attacking role (defence.ts ZONE_BY_ROLE). */
export const DEFAULT_SPACE_BY_CODE: Readonly<Record<string, number>> = { H6: 0, H9: 1, M9: 2, M6: 3, V9: 4, V6: 5 };

export function defenceSystemKey(plan: Pick<MatchPlan, "defencePlan">): DefenceSystemKey {
  return normalizeBaseFormation(plan.defencePlan.baseFormation) === "5-1" ? "5-1" : "6-0";
}

/** Who defends where in the plan's current system, defaults filled in from the attacking positions. */
export function effectiveDefenceSpaces(plan: MatchPlan): Record<string, number> {
  const out: Record<string, number> = {};
  const saved = plan.defenceAssignments?.[defenceSystemKey(plan)] ?? {};
  const six = plan.attackStartingUnit.slots.filter((s) => s.position !== "GK" && s.playerId);
  for (const slot of six) out[slot.playerId] = DEFAULT_SPACE_BY_CODE[slot.position] ?? 3;
  // A saved assignment is a permutation of the six; apply it only when complete and valid.
  const ids = six.map((s) => s.playerId);
  const values = ids.map((id) => saved[id]);
  if (values.every((v) => typeof v === "number" && v >= 0 && v <= 5) && new Set(values).size === ids.length) for (const id of ids) out[id] = saved[id]!;
  return out;
}

export function engineTeamMatchPlan(plan: MatchPlan | null | undefined, roles: TeamRoles | undefined): TeamMatchPlan | undefined {
  if (!plan) return undefined;
  const squad = new Set(plan.squad.players.map((p) => p.playerId));
  const starters = new Set(plan.attackStartingUnit.slots.map((s) => s.playerId));
  const spaces = effectiveDefenceSpaces(plan);
  const pairs = plan.substitutionPairs.filter((p) => squad.has(p.attackPlayerId) && squad.has(p.defencePlayerId) && starters.has(p.attackPlayerId) && !starters.has(p.defencePlayerId) && p.attackPlayerId !== p.defencePlayerId)
    .map((p) => ({ attackId: p.attackPlayerId, defenceId: p.defencePlayerId }));
  // A defensive specialist takes his partner's space.
  const defenceZones: Record<string, number> = { ...spaces };
  for (const p of pairs) if (spaces[p.attackId] !== undefined) defenceZones[p.defenceId] = spaces[p.attackId];
  const attack6v5: UnitEntry[] = (plan.situationUnits?.ATTACK_6V5 ?? []).filter((e) => squad.has(e.playerId)).map((e) => ({ playerId: e.playerId, role: ENGINE_ROLE_BY_CODE[e.position] }));
  const defence5v6: UnitEntry[] = (plan.situationUnits?.DEFENCE_5V6 ?? []).filter((e) => squad.has(e.playerId) && e.zone >= 0 && e.zone <= 5).map((e) => ({ playerId: e.playerId, zone: e.zone }));
  const penaltyTakers = (roles?.penaltyTakers ?? []).filter((id) => squad.has(id));
  const seventh = plan.sevenVSixPlayerId && squad.has(plan.sevenVSixPlayerId) && !starters.has(plan.sevenVSixPlayerId) ? plan.sevenVSixPlayerId : undefined;
  const hasCustomSpaces = !!plan.defenceAssignments?.[defenceSystemKey(plan)] || pairs.length > 0;
  return {
    ...(pairs.length ? { pairs } : {}),
    ...(attack6v5.length === 6 || defence5v6.length === 5 ? { units: { ...(attack6v5.length === 6 ? { ATTACK_6V5: attack6v5 } : {}), ...(defence5v6.length === 5 ? { DEFENCE_5V6: defence5v6 } : {}) } } : {}),
    ...(hasCustomSpaces ? { defenceZones } : {}),
    ...(penaltyTakers.length ? { penaltyTakers } : {}),
    ...(seventh ? { sevenVSixPlayerId: seventh } : {}),
  };
}
