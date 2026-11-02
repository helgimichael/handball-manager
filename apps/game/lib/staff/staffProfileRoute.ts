// HM-ALPHA3 release fix: the staff dossier route. Links encode the staff id
// (encodeURIComponent), and generated market free agents have ids such as
// "fa-staff:2026:DEVELOPMENT_COACH:0", so the route segment must be decoded
// before the lookup -- the same pattern as the transfer dossier.
import type { CareerState } from "../career/types";
import { findStaffMember } from "./staffCareerIntegration";
import { isFreeAgentScoutAvailable } from "./scoutPool";

/** The staff id from a `[staffId]` route segment; a malformed escape is kept as-is rather than throwing. */
export function staffIdFromRouteParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** The person a dossier shows: club staff anywhere, a free-agent scout, or a free agent on the staff market. */
export function resolveStaffProfile(career: CareerState, staffId: string) {
  const isFreeAgent = isFreeAgentScoutAvailable(career, staffId) || !!career.staffMarket?.freeAgents[staffId];
  const member = findStaffMember(career, staffId) ?? career.scoutMarket[staffId] ?? career.staffMarket?.freeAgents[staffId];
  return { member, isFreeAgent };
}
