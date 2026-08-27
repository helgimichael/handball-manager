// HM-STAFF-CAREER-1.0 Part 5: a staff member's CAREER-TRACKED club
// history -- deliberately date-based (not age-based like
// PlayerClubHistoryEntry, economy/types.ts), and deliberately only ever
// records REAL moves that happened DURING this career (via
// staffCareerIntegration.ts's recruitStaffMember). No pre-career
// backstory is invented -- a real person's history before the manager's
// own career began simply isn't tracked (no source data exists for it),
// matching the same "never invented precision" rule club transfer
// history already follows.
export interface StaffClubHistoryEntry {
  clubId: string;
  fromDate: string; // ISO date this career-tracked spell began.
  /** Undefined = this is the person's CURRENT club (still ongoing). */
  toDate?: string;
}

export interface StaffClubHistory {
  staffId: string;
  entries: readonly StaffClubHistoryEntry[];
}
