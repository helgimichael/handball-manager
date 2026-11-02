// HM-GAME-0.1 mock game-data layer types. Everything here is a UI/game
// concept, independent of the SIM/FIELD engine's own Player/HandballState
// types (packages/handball-engine, packages/match-contract) — the engine
// remains untouched and unaware this layer exists. Real-world data
// (nations, competition names, club names) is cited in nations.ts /
// competitions.ts / clubs.ts; everything else here is fictional/mock,
// clearly marked at each module.
import type { PlayerTag } from "./playerTags";

/**
 * HM-WORLD-PLAYER-POOL-1.0: AUT/FRO/ITA/NED/POL/POR/QAT/CHE added for
 * the 100-player international pool's new clubs/competitions. Never
 * added to nations.ts's own NATIONS display array (the New Game
 * country picker's data source) -- these nations exist in the world
 * registry only, never selectable/playable, per that milestone's own
 * "Foreign leagues/clubs ska INTE bli selectable/playable i New Game".
 */
/**
 * The game's own (3-letter) nation vocabulary. Deliberately BROADER than
 * `NATIONS` in nations.ts -- that list is the New-Game-selectable set and
 * keeps its own narrower meaning; this union is every nation a player
 * record can legitimately carry.
 *
 * HM-BIO-NATIONALITY-1.0: extended to cover every ISO nationality actually
 * observed in the real-world player database (see
 * gameWorldAdapter.ts's ISO_TO_NATION_CODE, which must stay exhaustive over
 * the observed set -- lib/gameWorld/nationality.test.ts enforces this).
 * "UNK" is the explicit unknown-nationality representation: a player whose
 * source data carries no verified nationality resolves to UNK, never to a
 * silently-assumed SWE.
 */
export type NationCode =
  | "SWE" | "DEN" | "NOR" | "GER" | "ESP" | "HUN" | "SVN" | "ISL"
  | "AUT" | "FRO" | "ITA" | "NED" | "POL" | "POR" | "QAT" | "CHE"
  | "FRA" | "SRB" | "HRV" | "BIH" | "FIN" | "ARG" | "LTU" | "ROU" | "DZA" | "EST" | "KOS"
  | "GBR" | "CHL" | "USA"
  // HM-DIV1-NATIONALITY-1.0: Ireland, first observed in the Division 1 player set.
  | "IRL"
  | "UNK";

export type Nation = {
  code: NationCode;
  name: string;
};

export type CompetitionTier = 1 | 2;

export type Competition = {
  id: string;
  nation: NationCode;
  tier: CompetitionTier;
  /** The name a handball fan would recognise (may be the sponsor name). */
  name: string;
  /** Official federation name, if it differs from `name`. */
  officialName?: string;
  /** Free-text note on source confidence -- see World Data verification. */
  sourceNote: string;
};

export type Club = {
  id: string;
  competitionId: string;
  name: string;
  shortName: string;
  /** True for IFK Tumba and every real-world-imported Handbollsligan club (HM-DATA-0.2). */
  playable: boolean;
  /** HM-DATA-0.2: set for clubs whose squad is imported from data/real-world/ rather than authored as fiction. Undefined means mock (equivalent to "MOCK") -- a dev-only distinction, not shown prominently in the normal UI. */
  dataSource?: "REAL_WORLD" | "MOCK";
  founded?: number;
  venue?: string;
  /** HM-PLAYTEST-01 5.4: published arena capacity, from the verified venue registry. */
  venueCapacity?: number;
  /** HM-PLAYTEST-01 5.4: the town the arena is in, when it differs from the club's home area (e.g. Partille Arena for a Göteborg club). */
  venueCity?: string;
  city?: string;
  /**
   * HM-YOUTH-INTAKE-1.1B: the club's standing ability to produce young talent,
   * 0-100 (neutral 50, the same shape as ClubStrength.overall). Part of a real
   * club's identity, so it is deliberately NOT derived from the current squad,
   * the current league, or the save seed -- a promoted club does not acquire a
   * youth system overnight. Optional: unset clubs resolve through the stable
   * club-identity fallback in career/academyQuality.ts, which is where the one
   * canonical reader lives. Populating this for real clubs is a research data
   * pass, not something to invent.
   */
  academyQuality?: number;
  /** Hex accent used for crest placeholder + club chrome. */
  primaryColor: string;
  secondaryColor: string;
};

// HM-DATA-ALLSVENSKAN-1.1B Part 10: "PV" (Pivot) was audited and removed
// -- it was only ever a legacy alias for the pivot position, never a
// genuinely distinct canonical position: M6 ("Mittsexa") is, and always
// was, the real canonical pivot position (the real-world import pipeline
// -- gameWorld/realWorldLoader.ts's own CANONICAL_POSITIONS, the rating
// domain's Position type -- has never produced/accepted "PV"; every real
// pivot player is already coded M6). Keeping an 8th vocabulary value
// around that no real data or downstream system actually used just
// confused the normal-mode position filters. See careerSquadBridge.ts's
// former PV->M6 mapping, now removed as dead code for the same reason.
export type HandballPosition = "MV" | "V9" | "V6" | "M9" | "M6" | "H9" | "H6";

export type SquadStatus = "Förstaval" | "Rotation" | "Ungdom" | "Skadad" | "Avstängd";

/**
 * HM-PLAYER-DATA-EDITOR-1.0: a CALIBRATION input, not a live career
 * value -- mirrors lib/career/squadStatus.ts's own `SquadStatusTier`
 * literal-for-literal (duplicated here, not imported, to avoid a
 * game-data -> career -> game-data import cycle; that module remains
 * the one canonical definition of what the 5 tiers MEAN). When present,
 * `deriveDefaultSquadStatusTier` (squadStatus.ts) uses this as the
 * career's starting default instead of its own coarse Förstaval/
 * Rotation/Ungdom-based guess -- letting an editor-calibrated default
 * (e.g. "this real player is genuinely a KEY_PLAYER") actually reach a
 * fresh career, which no pre-existing field could express.
 */
export type CalibratedSquadStatusTier = "KEY_PLAYER" | "FIRST_CHOICE" | "ROTATION" | "SQUAD_PLAYER" | "TALENT";

export type PlayerMock = {
  id: string;
  clubId: string;
  firstName: string;
  lastName: string;
  /** null means unknown -- real-world import only, never faked for a mock player. */
  shirtNumber: number | null;
  position: HandballPosition;
  /** First secondary position, kept for existing single-value display call sites. */
  secondaryPosition?: HandballPosition;
  /** HM-DATA-0.2: full secondary-position list as imported. May hold more than `secondaryPosition` alone can represent. */
  secondaryPositions?: HandballPosition[];
  nationality: NationCode;
  /** HM-DATA-0.2: raw ISO-3166 codes as stored in the real-world database, preserved faithfully (display mapping is a separate concern -- see nationCodeLabel). Absent for mock players. */
  nationalities?: string[] | null;
  /** null means unknown (real-world import only). ISO date otherwise. */
  dateOfBirth: string | null;
  /** Used only when dateOfBirth is unknown but the birth year is. Never used to fabricate a full date. */
  birthYear?: number | null;
  heightCm: number | null;
  weightKg: number | null;
  foot: "Vänsterhänt" | "Högerhänt" | null;
  squadStatus: SquadStatus;
  /** HM-PLAYER-DATA-EDITOR-1.0: editor-calibrated permanent squad-role default, from roster-*.json's `defaultSquadStatus` -- see CalibratedSquadStatusTier's own doc. Undefined for a player nobody has calibrated yet (the pre-existing squadStatus-based guess still applies). */
  calibratedSquadStatusTier?: CalibratedSquadStatusTier;
  /** HM-PLAYER-DATA-EDITOR-1.0: editor-calibrated special tags (playerTags.ts). HM-PLAYER-CALIBRATION-1.0 Part C: ATTACK_SPECIALIST/SEVEN_METER_TAKER now feed a small scoring-weight nudge in lib/career/tumbaRoster.ts's scoringWeightFor -- every other tag remains informational only. Undefined/empty for an uncalibrated player. */
  specialTags?: PlayerTag[];
  /** HM-DATA-0.2: "REAL_WORLD" for imported Handbollsligan players, undefined/"MOCK" for authored fiction (e.g. TUMBA_SQUAD). Dev-facing distinction only. */
  dataSource?: "REAL_WORLD" | "MOCK";
  /** 1-200 hidden development scale -- see CA/PA note in players.ts. */
  currentAbility: number;
  potentialAbility: number;
  form: number; // 1-10 display scale
  fitnessPct: number; // 0-100
  moralePct: number; // 0-100
  appearances: number;
  goals: number;
  contractEndSeason: string; // e.g. "2027/28"
  wageSekPerMonth: number;
  attributes: PlayerMockAttributes;
};

/**
 * MOCK ATTRIBUTE SET — explicitly not the final Handball Manager
 * attribute dictionary (that is a separate, unapproved design task).
 * Kept isolated in this one type so it can be swapped out later without
 * touching the rest of the player model.
 */
export type PlayerMockAttributes = {
  technical: {
    skott: number;
    passning: number;
    spelforstaelse: number;
    genombrott: number;
    mottagning: number;
    fint: number;
    spelUtanBoll: number;
  };
  mental: {
    beslutsfattande: number;
    kyla: number;
    arbetskapacitet: number;
    kampvilja: number;
    positionering: number;
    lagarbete: number;
    ledarskap: number;
  };
  physical: {
    snabbhet: number;
    acceleration: number;
    styrka: number;
    explosivitet: number;
    uthallighet: number;
    rorlighet: number;
  };
};

export type StaffRole =
  | "Assisterande tränare"
  | "Målvaktstränare"
  | "Fystränare"
  | "Fysioterapeut"
  | "Huvudscout"
  | "Läkare"
  | "Lagledare";

export type StaffMock = {
  id: string;
  clubId: string;
  name: string;
  role: StaffRole;
  nationality: NationCode;
  yearsAtClub: number;
};

export type FixtureStatus = "Kommande" | "Spelad";

export type Fixture = {
  id: string;
  competitionId: string;
  round: number;
  date: string; // ISO date
  homeClubId: string;
  awayClubId: string;
  status: FixtureStatus;
  homeScore?: number;
  awayScore?: number;
};

/**
 * HM-GAME-0.4: the Inbox's category model -- exactly one primary
 * category per message, matching the manager-information domains the
 * career actually has (never dozens of categories). Swedish display
 * text is a separate presentation concern -- see career/inboxBridge.ts's
 * categoryLabel().
 */
export type InboxCategory = "MATCH" | "ANALYSIS" | "SCOUTING" | "STAFF" | "MEDICAL" | "PLAYER" | "COMPETITION" | "CLUB" | "SYSTEM";

export type InboxMessage = {
  id: string;
  category: InboxCategory;
  sender: string;
  subject: string;
  preview: string;
  body: string[];
  date: string;
  read: boolean;
  important: boolean;
  /**
   * HM-GAME-0.4: ACTIVE (default) messages show in the default Inbox;
   * ARCHIVED ones are hidden from it but remain retrievable and keep
   * their deep links/provenance -- never deleted (Spec §7).
   */
  archived: boolean;
  /**
   * HM-GAME-0.4: hard distinction from `read` (Spec §24). `read` means
   * the manager viewed the message; `resolved` means the underlying
   * required game action (if any) was actually completed. An
   * INFORMATION/IMPORTANT message with nothing to resolve is always
   * `resolved: true`; an ACTION_REQUIRED message starts `resolved: false`
   * and only flips once the real action (e.g. playing the match) happens
   * -- never merely by being opened.
   */
  resolved: boolean;
  /**
   * HM-GAME-0.3 Career Rhythm additions -- all optional so pre-existing
   * authored/mock messages (lib/game-data/inbox.ts) remain valid without
   * changes. Present exactly when this message was generated from a live
   * CareerEvent (see career/inboxBridge.ts), which visibly distinguishes
   * real career state from presentation-QA mock content.
   */
  careerEventId?: string;
  priority?: "INFORMATION" | "IMPORTANT" | "ACTION_REQUIRED";
  actionRequired?: boolean;
  destinations?: import("../career/careerEvents").EventDestination[];
};

export type TransferOfferStatus = "Öppen" | "Accepterat" | "Avvisat" | "Förhandling";

export type TransferItem = {
  id: string;
  direction: "in" | "out";
  playerName: string;
  clubName: string;
  feeSek: number | null;
  status: TransferOfferStatus;
  deadline: string;
};
