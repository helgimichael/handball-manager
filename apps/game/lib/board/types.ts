// HM-ALPHA3-M07: the board and the manager's own career. Objectives come
// from the club's real level, budget and investment profile; confidence
// moves monthly from explained factors; reviews and warnings are meetings
// with reasons; the manager has a reputation, a contract and a history,
// and can be approached, apply, be interviewed, change club or be sacked
// -- without the world resetting.

export type ObjectiveKind = "LEAGUE" | "FINANCE" | "WAGES" | "YOUTH" | "CUP";
export type ObjectiveStatus = "ON_TRACK" | "AT_RISK" | "MET" | "PARTLY_MET" | "FAILED";

export interface BoardObjective {
  id: string;
  kind: ObjectiveKind;
  label: string;
  /** Why the board asks for this, in its words. */
  why: string;
  /** LEAGUE: the position the board expects (or better); FINANCE/WAGES: 1; YOUTH: the share of starts for players aged 21 or younger; CUP: 1 for Final4. */
  target: number;
  /** LEAGUE: the worst position the board can live with. */
  minimum?: number;
  weight: number;
  status: ObjectiveStatus;
  progress: string;
}

export interface ConfidenceFactor {
  label: string;
  points: number;
}

export interface BoardMeeting {
  id: string;
  date: string;
  kind: "SEASON_START" | "MID_SEASON" | "WARNING" | "FINAL_WARNING" | "SEASON_REVIEW" | "DISMISSAL" | "CONTRACT";
  title: string;
  summary: string;
  verdict: "PLEASED" | "SATISFIED" | "CONCERNED" | "WARNING" | "DISMISSED";
}

export interface BoardState {
  clubId: string;
  seasonId: string;
  /** The board's predicted league position at season start (from squad strength). */
  predictedPosition: number;
  objectives: BoardObjective[];
  /** 0-100. */
  confidence: number;
  targetConfidence: number;
  factors: ConfidenceFactor[];
  history: { date: string; confidence: number }[];
  meetings: BoardMeeting[];
  warnings: number;
  lastMonthly?: string;
  midSeasonDone?: boolean;
  seasonReviewDone?: boolean;
  /** A contract extension the board has offered, waiting for the manager. */
  contractOffer?: { years: number; wageEurPerMonth: number; offeredOn: string; expiresOn: string };
}

// ---------------------------------------------------------------------------
// Manager career
// ---------------------------------------------------------------------------

export interface ManagerContract {
  clubId: string;
  wageEurPerMonth: number;
  startDate: string;
  endDate: string;
}

export interface ManagerStint {
  clubId: string;
  from: string;
  to?: string;
  leftReason?: "DISMISSED" | "RESIGNED" | "NEW_JOB" | "CONTRACT_ENDED";
  seasons: { seasonId: string; competitionId: string; position: number | null; objectivesScore: number | null; honours: string[] }[];
}

export interface Vacancy {
  clubId: string;
  openedOn: string;
  closesOn: string;
  reason: string;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  answers: { id: string; label: string }[];
}

export interface JobApplication {
  id: string;
  clubId: string;
  appliedOn: string;
  status: "INTERVIEW" | "ANSWERED" | "OFFERED" | "REJECTED" | "WITHDRAWN";
  interviewOn: string;
  questions: InterviewQuestion[];
  answers?: Record<string, string>;
  decisionOn?: string;
  note?: string;
}

export interface JobOffer {
  id: string;
  clubId: string;
  offeredOn: string;
  expiresOn: string;
  wageEurPerMonth: number;
  years: number;
  /** "APPROACH": the club came to you; "APPLICATION": after an interview; "AFTER_DISMISSAL": a club willing to take you on. */
  source: "APPROACH" | "APPLICATION" | "AFTER_DISMISSAL";
  pitch: string;
  status: "OPEN" | "ACCEPTED" | "DECLINED" | "EXPIRED";
}

export interface ManagerMilestone {
  date: string;
  kind: "APPOINTED" | "DISMISSED" | "RESIGNED" | "TITLE" | "CUP" | "PROMOTION" | "RELEGATION" | "CONTRACT" | "REVIEW";
  text: string;
  clubId: string;
}

export interface ManagerCareerState {
  /** 0-100. */
  reputation: number;
  contract: ManagerContract;
  stints: ManagerStint[];
  vacancies: Vacancy[];
  applications: Record<string, JobApplication>;
  offers: Record<string, JobOffer>;
  milestones: ManagerMilestone[];
  /** Out of a job: Continue waits until the manager accepts a new club. */
  seekingJob?: { since: string; reason: "DISMISSED" | "RESIGNED" | "CONTRACT_ENDED" };
  lastMarketRun?: string;
}
