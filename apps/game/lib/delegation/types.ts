// HM-ALPHA3-M06: delegation -- per responsibility area the manager decides
// himself, delegates to a staff member, or lets the staff member advise.
// Delegated work uses exactly the same rules as manual work; anything that
// commits money beyond an agreed scope, or touches key players, becomes a
// proposal the manager approves. Every action is logged with who and why.
import type { ResponsibilityArea } from "../staff/organisation";
import type { SquadStatusTier } from "../career/squadStatus";
import type { StaffRole } from "../staff/types";

export type DelegationMode = "MANAGER" | "DELEGATE" | "ADVISE";

export interface DelegationSetting {
  mode: DelegationMode;
  /** The staff member responsible (absent: the best suited person at the club). */
  staffId?: string;
}

export type ProposalAction =
  | { kind: "START_SCOUTING"; scoutStaffId: string; position: string }
  | { kind: "SHORTLIST"; playerId: string }
  | { kind: "OPEN_NEGOTIATION"; playerId: string }
  | { kind: "RENEW"; playerId: string; wageEurPerMonth: number; years: number; promisedRole?: SquadStatusTier }
  | { kind: "HIRE_STAFF"; staffId: string; role: StaffRole; wageEurPerMonth: number }
  | { kind: "RENEW_STAFF"; staffId: string; role: StaffRole; wageEurPerMonth: number; years: number }
  | { kind: "SEEK_BIDS"; playerId: string };

export interface DelegationProposal {
  id: string;
  area: ResponsibilityArea;
  staffId: string;
  createdOn: string;
  expiresOn: string;
  title: string;
  /** Why the staff member suggests it, in their words. */
  reason: string;
  /** What approving does and costs, shown before approval. */
  consequence: string;
  action: ProposalAction;
  /** WITHDRAWN: the area was taken back by the manager, or the proposing staff member left the club. */
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "FAILED" | "WITHDRAWN";
  decidedOn?: string;
  outcome?: string;
}

export interface DelegationLogEntry {
  date: string;
  area: ResponsibilityArea;
  staffId: string;
  staffName: string;
  action: string;
  reason: string;
  /** "DONE" for a delegated action carried out, "PROPOSED" when it waits for approval, "SKIPPED" when a rule stopped it. */
  result: "DONE" | "PROPOSED" | "SKIPPED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
}

export interface DelegationState {
  settings: Partial<Record<ResponsibilityArea, DelegationSetting>>;
  proposals: Record<string, DelegationProposal>;
  log: DelegationLogEntry[];
  lastRun?: string;
}

/** Areas with delegated behaviour in this version (the rest are shown, not yet delegable). */
export const DELEGABLE_AREAS: ResponsibilityArea[] = ["SCOUTING_ASSIGNMENTS", "PLAYER_RECRUITMENT", "CONTRACT_RENEWALS", "STAFF_HIRING"];

export const DELEGATION_MODE_LABEL: Record<DelegationMode, string> = { MANAGER: "Du själv", DELEGATE: "Delegera", ADVISE: "Råd först" };
