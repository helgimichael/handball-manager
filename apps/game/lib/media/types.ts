// HM-ALPHA3-M08: the living world's media state -- stories, journalists,
// press conferences, relationships, supporter mood and disciplinary cases.
// Everything is optional on CareerState and created lazily.
import type { EventDestination } from "../career/careerEvents";

export type StoryKind =
  | "MATCH_REPORT" | "UPSET" | "DERBY_PREVIEW" | "BIG_MATCH_PREVIEW" | "TRANSFER" | "TRANSFER_RUMOUR" | "SALE"
  | "COACH_CHANGE" | "MANAGER_DISMISSED" | "MANAGER_APPOINTED" | "BOARD_PRESSURE" | "PLAYER_UNHAPPY" | "CRISIS"
  | "TITLE" | "PROMOTION" | "RELEGATION" | "AWARD" | "RECORD" | "TALENT" | "INTERVIEW" | "RIVAL_COMMENT"
  | "DISCIPLINE" | "CONTROVERSY" | "FORM";

export type StoryScope = "NATIONAL" | "SPECIALIST" | "REGIONAL" | "LOCAL";

export interface NewsStory {
  id: string;
  /** The underlying game event; outlets covering the same event share it. */
  eventKey: string;
  date: string;
  kind: StoryKind;
  outletId: string;
  scope: StoryScope;
  journalistId?: string;
  headline: string;
  standfirst: string;
  body: string[];
  quote?: { who: string; text: string };
  clubIds: string[];
  playerIds?: string[];
  /** Staff ids, or "manager" for the human manager. */
  personIds?: string[];
  fixtureId?: string;
  /** 1 (minor) .. 5 (season-defining). */
  importance: number;
  breaking?: boolean;
  destinations: EventDestination[];
  /** The manager's club is in the story. */
  ownClub: boolean;
}

export interface Journalist {
  id: string;
  name: string;
  outletId: string;
  /** How they ask: blunt tabloid, analytical, local and warm. */
  style: "BLUNT" | "ANALYTICAL" | "LOCAL";
}

export type Tone = "DIPLOMATIC" | "CONFIDENT" | "PROTECTIVE" | "CRITICAL" | "PROVOCATIVE" | "HUMOROUS" | "DECLINE";

export type PressTopic = "PREVIEW" | "RIVAL_RESPONSE" | "AFTER_WIN" | "AFTER_DEFEAT" | "REFEREE" | "PLAYER_UNHAPPY" | "BOARD_PRESSURE" | "TRANSFER" | "APPOINTMENT" | "POOR_FORM" | "DISCIPLINE";

export interface PressAnswer {
  tone: Tone;
  text: string;
  /** What the manager can expect, in words (never numbers). */
  hint: string;
}

export interface PressQuestion {
  id: string;
  journalistId: string;
  topic: PressTopic;
  text: string;
  answers: PressAnswer[];
  /** The player or rival the question is about. */
  playerId?: string;
  rivalStaffId?: string;
}

export interface Consequence {
  area: "PLAYER" | "TEAM" | "BOARD" | "MEDIA" | "RIVAL" | "SUPPORTERS" | "REPUTATION" | "PRESSURE" | "DISCIPLINE";
  delta: number;
  text: string;
}

export interface PressContext {
  topic: PressTopic;
  opponentId?: string;
  rivalStaffId?: string;
  playerId?: string;
  detail?: string;
  derby?: boolean;
}

export interface PressConference {
  id: string;
  date: string;
  kind: "PRE_MATCH" | "POST_MATCH" | "INTERVIEW";
  title: string;
  context: string;
  fixtureId?: string;
  outletIds: string[];
  questions: PressQuestion[];
  /** The situation behind each question (same order). */
  contexts: PressContext[];
  status: "OPEN" | "ANSWERED" | "DELEGATED" | "EXPIRED";
  expiresOn: string;
  answers?: Record<string, Tone>;
  answeredBy?: "MANAGER" | { staffId: string; name: string };
  consequences?: Consequence[];
}

/** A relationship between two people (staff ids or "manager"), kept across clubs and seasons. */
export interface Relation {
  a: string;
  b: string;
  /** -100 (open feud) .. 100 (mutual respect). */
  score: number;
  history: { date: string; text: string; delta: number }[];
}

export type DisciplineOutcome = "NO_ACTION" | "TILLRATTAVISNING" | "STRAFFAVGIFT" | "AVSTANGNING";

export interface DisciplineCase {
  id: string;
  openedOn: string;
  /** What was said and where. */
  statement: string;
  pressId?: string;
  fixtureId?: string;
  /** The provision the report is made under, quoted by reference (RF:s stadgar / SHF:s tävlingsbestämmelser). */
  provision: string;
  severity: 1 | 2 | 3;
  status: "REPORTED" | "DECIDED" | "APPEALED" | "CLOSED";
  decisionOn: string;
  outcome?: DisciplineOutcome;
  fineSek?: number;
  matches?: number;
  servedMatches?: number;
  reasoning?: string;
  apologised?: boolean;
  appeal?: { filedOn: string; decisionOn: string; result?: "NOT_GRANTED" | "REDUCED" };
}

export interface MediaState {
  stories: Record<string, NewsStory>;
  journalists: Record<string, Journalist>;
  press: Record<string, PressConference>;
  relations: Record<string, Relation>;
  /** Per outlet: how the outlet regards the manager, -50..50. */
  outletRelations: Record<string, number>;
  /** Supporter sentiment towards the manager, -50..50. */
  supporters: number;
  /** Media handling as the board sees it, -6..6 (decays monthly). */
  boardMood: number;
  /** Pressure going into a specific fixture, from what was said before it. */
  pressure: Record<string, { level: number; reason: string }>;
  discipline: Record<string, DisciplineCase>;
  /** Event keys already turned into stories (dedupe), newest last. */
  seen: string[];
  /** Stories counted per ISO week against the editorial budget. */
  week: { key: string; count: number };
  /** The assistant answers routine interviews. */
  delegatePress?: boolean;
  /** HM-ALPHA3-M09: what followed each of the manager's matches (pressure kept or broken, derby, big stakes). */
  aftermath?: Record<string, Consequence[]>;
  lastWeekly?: string;
  lastResultsDate?: string;
}
