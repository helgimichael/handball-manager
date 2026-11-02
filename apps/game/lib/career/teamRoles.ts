// HM-PLAYTEST-01 2.4/2.5: standing team responsibilities -- captain,
// vice-captain and the 7-metre order. They outlive any single match plan:
// they carry from fixture to fixture and across seasons until the manager
// changes them or the player leaves the club.
//
// Consequences are deliberately modest and explainable:
//   - the 7-metre order is read by the match engine at every 7-metre award;
//   - being named captain (or vice) is a small morale lift for that player;
//   - taking the armband away is a small, fading morale knock;
//   - a captain with real leadership softens the squad-wide morale hit of a
//     losing run (players/morale.ts) -- never a match-performance modifier.
import { addMoraleShock } from "../players/morale";
import { getCareerSquad } from "./careerWorld";
import type { CareerState } from "./types";

export type TeamRoles = {
  readonly captainId?: string;
  readonly viceCaptainId?: string;
  /** Primary first, then backups in order. */
  readonly penaltyTakers?: readonly string[];
};

export const MAX_PENALTY_TAKERS = 3;
/** On the game's 1-20 attribute scale; at or above this a captain steadies the group. */
export const STEADYING_LEADERSHIP = 13;

/** Roles referring to players no longer at the club are simply not shown or used. */
export function currentTeamRoles(state: CareerState): Required<Pick<TeamRoles, "penaltyTakers">> & TeamRoles {
  const ids = new Set(getCareerSquad(state).map((p) => p.id));
  const r = state.teamRoles ?? {};
  return {
    captainId: r.captainId && ids.has(r.captainId) ? r.captainId : undefined,
    viceCaptainId: r.viceCaptainId && ids.has(r.viceCaptainId) ? r.viceCaptainId : undefined,
    penaltyTakers: (r.penaltyTakers ?? []).filter((id) => ids.has(id)).slice(0, MAX_PENALTY_TAKERS),
  };
}

export function setCaptaincy(state: CareerState, role: "CAPTAIN" | "VICE", playerId: string | null): CareerState {
  const current = currentTeamRoles(state);
  const key = role === "CAPTAIN" ? "captainId" : "viceCaptainId";
  const other = role === "CAPTAIN" ? "viceCaptainId" : "captainId";
  const previous = current[key];
  if (previous === (playerId ?? undefined)) return state;
  const next: TeamRoles = {
    ...current,
    [key]: playerId ?? undefined,
    // One person cannot hold both armbands.
    ...(playerId && current[other] === playerId ? { [other]: undefined } : {}),
  };
  let out: CareerState = { ...state, teamRoles: next };
  if (previous) out = addMoraleShock(out, previous, role === "CAPTAIN" ? -6 : -3, role === "CAPTAIN" ? "Fråntogs kaptensbindeln" : "Är inte längre vice kapten", 42);
  if (playerId) out = addMoraleShock(out, playerId, role === "CAPTAIN" ? 6 : 3, role === "CAPTAIN" ? "Utsedd till lagkapten" : "Utsedd till vice kapten", 42);
  return out;
}

export function setPenaltyTakers(state: CareerState, order: readonly string[]): CareerState {
  const unique = [...new Set(order.filter(Boolean))].slice(0, MAX_PENALTY_TAKERS);
  return { ...state, teamRoles: { ...currentTeamRoles(state), penaltyTakers: unique } };
}

/** The captain's leadership on the 1-20 scale, when the rating model records it. */
export function leadershipOf(state: CareerState, playerId: string): number | null {
  for (const ratings of Object.values(state.gameplayRatings ?? {})) {
    const r = ratings.find((x) => x.playerId === playerId);
    const value = (r?.branch.attributes as Record<string, { value?: number | null } | undefined> | undefined)?.LEADERSHIP?.value;
    if (r) return typeof value === "number" ? value : null;
  }
  return null;
}
