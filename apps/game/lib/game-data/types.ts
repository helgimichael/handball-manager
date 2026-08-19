// HM-GAME-0.1 mock game-data layer types. Everything here is a UI/game
// concept, independent of the SIM/FIELD engine's own Player/HandballState
// types (packages/handball-engine, packages/match-contract) — the engine
// remains untouched and unaware this layer exists. Real-world data
// (nations, competition names, club names) is cited in nations.ts /
// competitions.ts / clubs.ts; everything else here is fictional/mock,
// clearly marked at each module.

export type NationCode = "SWE" | "DEN" | "NOR" | "GER" | "ESP" | "HUN" | "SVN" | "ISL";

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
  /** Only true for IFK Tumba in HM-GAME-0.1. */
  playable: boolean;
  founded?: number;
  venue?: string;
  city?: string;
  /** Hex accent used for crest placeholder + club chrome. */
  primaryColor: string;
  secondaryColor: string;
};

export type HandballPosition = "MV" | "V9" | "V6" | "M9" | "M6" | "H9" | "H6" | "PV";

export type SquadStatus = "Förstaval" | "Rotation" | "Ungdom" | "Skadad" | "Avstängd";

export type PlayerMock = {
  id: string;
  clubId: string;
  firstName: string;
  lastName: string;
  shirtNumber: number;
  position: HandballPosition;
  secondaryPosition?: HandballPosition;
  nationality: NationCode;
  dateOfBirth: string; // ISO date
  heightCm: number;
  weightKg: number;
  foot: "Vänsterhänt" | "Högerhänt";
  squadStatus: SquadStatus;
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

export type InboxCategory = "Assisterande tränare" | "Match" | "Träning" | "Spelare" | "Scouting" | "Styrelse" | "Kontrakt";

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
};

export type ScoutedPlayer = {
  id: string;
  name: string;
  clubName: string;
  nationality: NationCode;
  age: number;
  position: HandballPosition;
  estimatedAbilityStars: number; // 1-5, uncertainty-based display
  potentialStars: number; // 1-5
  knowledgePct: number; // scouting completeness
  contractEndSeason: string;
  estimatedValueSek: number;
  notes: string;
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
