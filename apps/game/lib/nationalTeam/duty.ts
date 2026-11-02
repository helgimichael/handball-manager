// HM-ALPHA3-M10: who is away with a national team right now. Kept free of
// the national-team module's media and medical imports so match selection
// can read it. A window's call-ups are away from the day it opens until it
// closes (NationalWindowState.away; older saves: status CALLED).
import type { PlayerMock } from "../game-data";
import type { CareerState } from "../career/types";

export function nationalDutyIds(state: Pick<CareerState, "nationalTeam">): Set<string> {
  const ids = new Set<string>();
  for (const ws of Object.values(state.nationalTeam?.windows ?? {})) {
    if (!(ws.away ?? ws.status === "CALLED")) continue;
    for (const s of ws.squad) ids.add(s.playerId);
    for (const s of ws.foreign ?? []) ids.add(s.playerId);
  }
  return ids;
}

/**
 * A CPU squad without its players on national duty -- the case where its
 * league keeps playing through the window. If that would leave fewer than a
 * goalkeeper and six outfield players, the full squad is kept (a club never
 * fails to field a team because of a call-up).
 */
export function withoutNationalDuty<T extends Pick<PlayerMock, "id" | "position">>(state: Pick<CareerState, "nationalTeam">, squad: readonly T[]): T[] {
  const away = nationalDutyIds(state);
  if (away.size === 0) return [...squad];
  const left = squad.filter((p) => !away.has(p.id));
  const keepers = left.filter((p) => p.position === "MV").length;
  return keepers >= 1 && left.length - keepers >= 6 ? left : [...squad];
}
