// HM-ALPHA3-M05: player dynamics and the selling side of the market --
// morale with explained factors, promises with deadlines, player talks,
// transfer requests, incoming bids for the manager's players, renewal
// negotiations and pre-contract agreements. All optional on CareerState;
// older saves start with none of them.
import type { SquadStatusTier } from "../career/squadStatus";

/** Light, stable personality (1-20), derived from the player's identity -- never random per day. */
export interface PlayerPersonality {
  ambition: number;
  loyalty: number;
  professionalism: number;
  temperament: number;
}

/** One reason a player's morale sits where it does, as the player would describe it. */
export interface MoraleFactor {
  key: "PLAYING_TIME" | "ROLE" | "RESULTS" | "CONTRACT" | "PROMISES" | "CLUB_STATUS" | "TRANSFER" | "TALK" | "STAFF";
  label: string;
  /** Signed points this factor contributes to the target morale. */
  points: number;
}

export interface PlayerMoraleState {
  /** 0-100; 70 is a settled player. */
  moralePct: number;
  /** Where morale is heading; it moves toward this a few points per week. */
  targetPct: number;
  factors: MoraleFactor[];
  updatedOn: string;
  /** Consecutive weekly updates below the unhappy line (feeds transfer requests). */
  unhappyWeeks: number;
  /** One-off effects (talk outcomes, rejected requests) that fade out by date. */
  shocks?: { points: number; label: string; until: string }[];
  /** Consecutive evidenced weekly shortfalls; idle weeks never add another strike. */
  playingTimeUnmetWeeks?: number;
  playingTimeLastFixtureId?: string;
}

export type PromiseKind = "PLAYING_TIME" | "SQUAD_ROLE" | "NOT_SELL" | "SIGN_POSITION";
export type PromiseStatus = "ACTIVE" | "KEPT" | "BROKEN" | "RELEASED";

export interface PlayerPromise {
  id: string;
  playerId: string;
  kind: PromiseKind;
  madeOn: string;
  deadline: string;
  /** PLAYING_TIME: starts share (0-1); SQUAD_ROLE: the tier; SIGN_POSITION: the position code. */
  target: number | SquadStatusTier | string;
  /** Baselines captured when the promise was made, for a fair evaluation. */
  baseline?: { starts: number; appearances: number; squadSize?: number };
  status: PromiseStatus;
  evaluatedOn?: string;
  /** Plain-language verdict shown to the manager. */
  note?: string;
  source: "TALK" | "CONTRACT" | "TRANSFER_REQUEST";
}

export type ConcernKind = "PLAYING_TIME" | "CONTRACT" | "AMBITION" | "BROKEN_PROMISE";

export interface TalkOption {
  id: string;
  label: string;
  /** What the player will expect / what happens, shown before choosing. */
  consequence: string;
}

/** A "Spelarsamtal": a player raises something; the manager answers with one of 1-3 choices. */
export interface PlayerConcern {
  id: string;
  playerId: string;
  kind: ConcernKind;
  raisedOn: string;
  /** What the player says. */
  message: string;
  options: TalkOption[];
  status: "OPEN" | "ANSWERED" | "LAPSED";
  answeredOn?: string;
  /** Last eligible match when this playing-time issue was raised (dedup after resolution). */
  playingTimeFixtureId?: string;
  answer?: string;
  outcome?: string;
  /** Recorded at the existing manager response; old saves may omit it. */
  responseEffect?: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
}

export interface TransferRequest {
  /** Owning club when raised; absent on legacy manager-only records. */
  clubId?: string;
  playerId: string;
  submittedOn: string;
  reason: string;
  status: "OPEN" | "ACCEPTED" | "REFUSED" | "WITHDRAWN";
  decidedOn?: string;
}

/** The manager's transfer list: players the club will listen to offers for. */
export interface TransferListing {
  clubId?: string;
  playerId: string;
  listedOn: string;
  askingEur: number;
  reason: "MANAGER" | "TRANSFER_REQUEST";
}

/** A bounded match fact inside the existing player dynamics state, not a second relationship model. */
export interface PlayingTimeMatch {
  fixtureId: string;
  seasonId: string;
  clubId: string;
  date: string;
  source: 'MEASURED' | 'USAGE_TIMELINE';
  players: Record<string, {
    tier: SquadStatusTier;
    phase: import('../matchPlan/types').PlayerPhaseUsage;
    available: boolean;
    expectedMinutes: number;
    courtMinutes: number;
  }>;
}

export type PlayerIntention = "HAPPY_TO_STAY" | "OPEN_TO_RENEWAL" | "CONSIDERING_OPTIONS" | "WANTS_TO_LEAVE";

/** Weekly, club-scoped memory inside the existing dynamics model. */
export interface PlayerIntentionState {
  kind: PlayerIntention;
  clubId: string;
  active: boolean;
  since: string;
  reviewedOn: string;
  adverseReviews: number;
  recoveryReviews: number;
  lastFixtureId?: string;
  reasons: string[];
  history: { date: string; kind: PlayerIntention; reasons: string[] }[];
}

export interface PlayerDynamicsState {
  morale: Record<string, PlayerMoraleState>;
  intentions?: Record<string, PlayerIntentionState>;
  promises: Record<string, PlayerPromise>;
  concerns: Record<string, PlayerConcern>;
  requests: Record<string, TransferRequest>;
  listings: Record<string, TransferListing>;
  /** Last weekly morale update (ISO date) -- idempotency for the tick. */
  lastWeeklyUpdate?: string;
  /** Recorded forward only; absent on older saves. Never reconstructed from starts or attacking actions. */
  playingTime?: Record<string, PlayingTimeMatch>;
  /** Recent departures of the manager's players (sales, releases, pre-contract exits) for Moments and the Transfers page. */
  departures: PlayerDeparture[];
}

export interface PlayerDeparture {
  playerId: string;
  playerName: string;
  toClubId: string;
  date: string;
  kind: "SALE" | "RELEASE" | "PRE_CONTRACT" | "FREE";
  feeEur: number;
  /** Paid by the club (release compensation) -- positive amount. */
  costEur?: number;
}

// ---------------------------------------------------------------------------
// Incoming bids
// ---------------------------------------------------------------------------

export type IncomingOfferStatus =
  | "OPEN"
  | "OFFER_RECEIVED"
  | "COUNTERED"
  | "COUNTEROFFER_SUBMITTED"
  | "CLUBS_AGREED"
  | "PLAYER_NEGOTIATING"
  | "AWAITING_FINAL_APPROVAL"
  | "ACCEPTED"
  | "AWAITING_WINDOW"
  | "COMPLETED"
  | "REJECTED"
  | "WITHDRAWN"
  | "PLAYER_REFUSED"
  | "EXPIRED";

export interface IncomingOfferRound {
  date: string;
  by: "BUYER" | "MANAGER";
  feeEur: number;
  note: string;
}

export interface IncomingOffer {
  id: string;
  playerId: string;
  fromClubId: string;
  /** Domestic CPU club or a club abroad (world pool). */
  foreign: boolean;
  openedOn: string;
  /** The buyer's current bid. */
  feeEur: number;
  /** The wage the buyer offers the player (for the player's decision). */
  wageEurPerMonth: number;
  contractYears: number;
  /** Highest fee the buyer will go to -- never shown. */
  maxFeeEur: number;
  status: IncomingOfferStatus;
  /** When the buyer withdraws if unanswered. */
  respondBy: string;
  /** When the buyer answers a counter. */
  answerOn?: string;
  /** Manager's asking fee in a counter. */
  askingFeeEur?: number;
  rounds: IncomingOfferRound[];
  /** Why this club is interested, in plain words. */
  motive: string;
  /** The player's stance on the move (decided when the clubs agree). */
  playerStance?: { willing: boolean; reason: string };
  completesOn?: string;
  /** Clubs and player agreed; completion/registration is recorded separately in closedOn. */
  agreedOn?: string;
  closedOn?: string;
}

// ---------------------------------------------------------------------------
// Renewal talks and pre-contracts
// ---------------------------------------------------------------------------

export interface RenewalRound {
  date: string;
  offer: { wageEurPerMonth: number; years: number; promisedRole?: SquadStatusTier };
  response?: "ACCEPT" | "COUNTER" | "REJECT";
  counterWageEurPerMonth?: number;
  reason?: string;
}

export interface RenewalTalk {
  id: string;
  playerId: string;
  openedOn: string;
  /** What the player wants, with the reasons (shown). */
  demandEurPerMonth: number;
  demandFactors: { label: string; effectPct: number }[];
  /** The role the player expects to be promised. */
  expectedRole: SquadStatusTier;
  status: "OPEN" | "AGREED" | "REFUSED" | "WITHDRAWN";
  rounds: RenewalRound[];
  /** Next-day answer to the latest offer. */
  answerOn?: string;
  /** Talks broken off: no new talks before this date. */
  cooldownUntil?: string;
  closedOn?: string;
  /** Who opened the talks (manager or a delegate -- M06). */
  by?: { kind: "MANAGER" } | { kind: "DELEGATE"; staffId: string };
}

export interface PreContract {
  playerId: string;
  toClubId: string;
  foreign: boolean;
  agreedOn: string;
  /** The day the player leaves (his contract end). */
  effectiveOn: string;
  wageEurPerMonth: number;
}
