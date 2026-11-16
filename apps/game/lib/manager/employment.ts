// Career employment states. The one place that answers "does the manager have a club right
// now, and which?" -- derived from the authoritative career record (managerCareer), never from a
// UI flag and never stored separately, so it cannot drift from the contract and stint history.
//
// EMPLOYED    managerCareer has no seekingJob marker: playerClubId is the club he runs.
// UNEMPLOYED  managerCareer.seekingJob is set (dismissal, resignation, contract ended, B-team release):
//             playerClubId still names his LAST club -- the career's anchor for history, the calendar
//             and the save cover -- but it grants nothing. The club is run by its own organisation.
// RETIRED     part of the vocabulary, but the game has no manager retirement: there is no career
//             record that ends a manager's career for good (player retirement is a separate system),
//             so the derivation never returns it. A future retirement feature must add that record
//             to managerCareer; this function is where it would be read.
//
// Pure and dependency-free (types only) so world systems, the shell and tests can all share it.
import type { CareerState } from "../career/types";

export type EmploymentState = "EMPLOYED" | "UNEMPLOYED" | "RETIRED";

type EmploymentInput = Pick<CareerState, "playerClubId" | "managerCareer">;

export function employmentState(state: EmploymentInput): EmploymentState {
  return state.managerCareer?.seekingJob ? "UNEMPLOYED" : "EMPLOYED";
}

export function isEmployed(state: EmploymentInput): boolean {
  return employmentState(state) === "EMPLOYED";
}

/** The club the manager currently runs, or undefined while he has none. */
export function activeClubId(state: EmploymentInput): string | undefined {
  return isEmployed(state) ? state.playerClubId : undefined;
}

/** The club he left, while he is out of work (history only -- it grants no access). */
export function formerClubId(state: EmploymentInput): string | undefined {
  return state.managerCareer?.seekingJob ? state.managerCareer.seekingJob.clubId ?? state.playerClubId : undefined;
}

/** Privileged, internal access to a club (squad management, tactics, staff, finances, transfers). A former employment grants none. */
export function canAccessClubInternals(state: EmploymentInput, clubId: string | undefined): boolean {
  return !!clubId && activeClubId(state) === clubId;
}

export const NO_CLUB_MESSAGE = "Du har ingen klubb just nu. Klubbens interna arbete hör till den som leder den.";

export class ClubAccessError extends Error {
  constructor(message = NO_CLUB_MESSAGE) {
    super(message);
    this.name = "ClubAccessError";
  }
}

/** Throws when the manager has no club -- the data-boundary check for club-internal actions. */
export function assertClubAccess(state: EmploymentInput): string {
  const id = activeClubId(state);
  if (!id) throw new ClubAccessError();
  return id;
}
