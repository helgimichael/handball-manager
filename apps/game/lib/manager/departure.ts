// HM-M7D: what happens to the manager's open business the day he leaves a club --
// shared by a move to a new job, a voluntary resignation and a dismissal, so
// every departure closes negotiations, talks, scouting trips, delegation and
// plans for unplayed matches exactly once and in the same way.
import { cancelScoutingAssignment } from "../career/scouting";
import type { CareerState } from "../career/types";
import { withdrawStaffNegotiation } from "../staff/staffNegotiation";
import { isNegotiationOpen, withdrawTransferNegotiation } from "../transfers/negotiationIntegration";
import { addDaysIso } from "../players/dynamicsState";

/** Closes the manager's own open business at the club he is leaving. */
export function closeOpenBusiness(state: CareerState, date: string): CareerState {
  let next = state;
  for (const n of Object.values(next.transferNegotiations ?? {})) {
    if (!isNegotiationOpen(n)) continue;
    const r = withdrawTransferNegotiation(next, n.id);
    if (r.ok) next = r.state;
  }
  for (const n of Object.values(next.staffNegotiations ?? {})) if (n.stage === "CLUB" || n.stage === "TERMS") next = withdrawStaffNegotiation(next, n.id);
  for (const a of Object.values(next.scoutingAssignments ?? {})) if (a.status === "IN_PROGRESS") next = cancelScoutingAssignment(next, a.id);
  const renewalTalks = Object.fromEntries(Object.entries(next.renewalTalks ?? {}).map(([k, t]) => [k, t.status === "OPEN" ? { ...t, status: "WITHDRAWN" as const, closedOn: date, answerOn: undefined } : t]));
  const incomingOffers = Object.fromEntries(Object.entries(next.incomingOffers ?? {}).map(([k, o]) => [k, ["OPEN", "COUNTERED", "ACCEPTED", "AWAITING_WINDOW"].includes(o.status) ? { ...o, status: "WITHDRAWN" as const } : o]));
  // Plans for matches not yet played were made for the old squad.
  const unplayed = (id: string) => !next.results[id];
  const matchPlans = Object.fromEntries(Object.entries(next.matchPlans).filter(([id]) => !unplayed(id)));
  const liveMatchPlans = Object.fromEntries(Object.entries(next.liveMatchPlans).filter(([id]) => !unplayed(id)));
  const trainingWeeks = Object.fromEntries(Object.entries(next.trainingWeeks).filter(([, w]) => addDaysIso(w.weekStart, 6) < date));
  // Anything waiting on the manager at the old club is no longer his to answer.
  const careerEvents = next.careerEvents.map((e) => (e.requiresAction && !e.resolved ? { ...e, resolved: true } : e));
  const inbox = next.inbox.map((m) => (m.actionRequired ? { ...m, actionRequired: false, resolved: true } : m));
  // HM-ALPHA3-M08: open press conferences were about the old club; relationships, stories and discipline follow the manager.
  const media = next.media ? { ...next.media, press: Object.fromEntries(Object.entries(next.media.press).map(([k, p]) => [k, p.status === "OPEN" ? { ...p, status: "EXPIRED" as const } : p])), pressure: {}, supporters: 0, boardMood: 0 } : undefined;
  // HM-ALPHA3-M10: the old club's preferred lineup does not follow the manager -- the first seven at the new club is picked by hand.
  return { ...next, renewalTalks, incomingOffers, matchPlans, liveMatchPlans, trainingWeeks, careerEvents, inbox, playerDynamics: undefined, delegation: undefined, preferredLineup: undefined, ...(media ? { media } : {}) };
}

