// HM-PLAYTEST-01 4.4: the human manager IS the head coach of his club.
//
// When a career starts (or an older save is loaded) with the club's real
// head coach still on the roster, that appointment is resolved explicitly:
// the person leaves the position, keeps his identity, attributes and
// reputation, gets an appointment-history entry, and joins the unemployed
// staff market where CPU clubs can hire him. Somebody who also holds other
// roles at the club (e.g. head coach and analyst) keeps those and only the
// head-coach role is taken away.
import type { CareerState } from "../career/types";
import { releaseStaff } from "./staffNegotiation";
import { addFreeAgent, ensureStaffMarket } from "./staffMarket";

/** A fallback asking wage when the source data had no salaried contract on record. */
const DEFAULT_HEAD_COACH_ASKING_EUR = 2500;

export function displaceIncumbentHeadCoach(state: CareerState): CareerState {
  const roster = state.staffRoster?.[state.playerClubId] ?? [];
  const incumbents = roster.filter((m) => m.roles.includes("HEAD_COACH"));
  if (incumbents.length === 0) return state;
  let next = ensureStaffMarket(state);
  for (const member of incumbents) {
    if (member.roles.length > 1) {
      next = { ...next, staffRoster: { ...next.staffRoster, [state.playerClubId]: (next.staffRoster[state.playerClubId] ?? []).map((m) => (m.id === member.id ? { ...m, roles: m.roles.filter((r) => r !== "HEAD_COACH") } : m)) } };
      continue;
    }
    const wage = next.staffEmployment?.[member.id]?.wageEurPerMonth;
    next = releaseStaff(next, member.id, next.gameDate, "DISMISSED");
    if (!next.staffMarket?.freeAgents[member.id]) next = addFreeAgent(next, member, wage ?? DEFAULT_HEAD_COACH_ASKING_EUR);
  }
  return next;
}
