// Real-world → PlayerMock adapter (HM-DATA-0.2).
//
// Converts a RealWorldPlayer (identity fact, from realWorldLoader.ts)
// into the existing PlayerMock shape every career screen and the Fast
// Match Engine roster provider already consume. Reusing PlayerMock
// (rather than a new CareerPlayer{identity,gameProfile} type) is the
// smallest change compatible with the current code -- PlayerMock's own
// fields already split cleanly into identity-ish fields (name, DOB,
// nationality, height, position) and game-simulation fields
// (currentAbility, potentialAbility, form, fitnessPct, moralePct,
// attributes). This adapter fills the former from real data and the
// latter with one fixed, documented, NEUTRAL provisional profile --
// never inferred from height/club/age/nationality/shirt number, and
// never written back into data/real-world/.
import type { HandballPosition, NationCode, PlayerMock, PlayerMockAttributes } from "../game-data/types";
import type { RealWorldPlayer } from "./realWorldLoader";

const CANONICAL_POSITIONS: readonly HandballPosition[] = ["MV", "V6", "V9", "M9", "M6", "H9", "H6"];

function toHandballPosition(raw: string): HandballPosition | null {
  return (CANONICAL_POSITIONS as readonly string[]).includes(raw) ? (raw as HandballPosition) : null;
}

// ISO-3166 alpha-2 -> the game's existing (broader, 3-letter) NationCode
// enum, for the small set of codes that enum actually covers. This is a
// DISPLAY simplification only -- the full, faithful ISO list is kept
// verbatim on PlayerMock.nationalities; `nationality` exists purely
// because many existing screens already read that one field.
const ISO_TO_NATION_CODE: Record<string, NationCode> = {
  SE: "SWE", DK: "DEN", NO: "NOR", DE: "GER", ES: "ESP", HU: "HUN", SI: "SVN", IS: "ISL",
};

function primaryNationCode(nationalities: string[] | null): NationCode {
  if (!nationalities || nationalities.length === 0) return "SWE";
  return ISO_TO_NATION_CODE[nationalities[0]] ?? "SWE";
}

function toHandedness(h: RealWorldPlayer["handedness"]): PlayerMock["foot"] {
  if (h === "LEFT") return "Vänsterhänt";
  if (h === "RIGHT") return "Högerhänt";
  return null;
}

/**
 * The one, fixed, clearly-provisional game-simulation profile applied to
 * every real-world-imported player. Deliberately flat and identical for
 * all players at all clubs -- no ability is inferred from any real-world
 * fact. Ratings follow the same 1-200 CA/PA scale documented in
 * game-data/types.ts.
 */
const PROVISIONAL_ABILITY = 100;
const PROVISIONAL_POTENTIAL = 100;

function provisionalAttributes(): PlayerMockAttributes {
  const flat = 10;
  return {
    technical: { skott: flat, passning: flat, spelforstaelse: flat, genombrott: flat, mottagning: flat, fint: flat, spelUtanBoll: flat },
    mental: { beslutsfattande: flat, kyla: flat, arbetskapacitet: flat, kampvilja: flat, positionering: flat, lagarbete: flat, ledarskap: flat },
    physical: { snabbhet: flat, acceleration: flat, styrka: flat, explosivitet: flat, uthallighet: flat, rorlighet: flat },
  };
}

/**
 * Converts one real-world player into a PlayerMock. Skips (returns null
 * for) a player whose primaryPosition isn't one of the 7 canonical HM
 * positions -- validateClubSquad (realWorldLoader.ts) is the place that
 * surfaces this as a reportable data problem; this function just refuses
 * to silently invent a position.
 */
export function toPlayerMock(p: RealWorldPlayer): PlayerMock | null {
  const position = toHandballPosition(p.primaryPosition);
  if (!position) return null;

  const secondaryPositions = p.secondaryPositions.map(toHandballPosition).filter((x): x is HandballPosition => x !== null);

  return {
    id: p.playerId,
    clubId: p.clubId,
    firstName: p.firstName,
    lastName: p.lastName,
    shirtNumber: p.shirtNumber,
    position,
    secondaryPosition: secondaryPositions[0],
    secondaryPositions,
    nationality: primaryNationCode(p.nationalities),
    nationalities: p.nationalities,
    dateOfBirth: p.dateOfBirth,
    birthYear: p.birthYear,
    heightCm: p.heightCm,
    weightKg: null,
    foot: toHandedness(p.handedness),
    squadStatus: p.rosterStatus === "CONFIRMED" || p.rosterStatus === "REGISTERED" ? "Förstaval" : "Rotation",
    dataSource: "REAL_WORLD",
    currentAbility: PROVISIONAL_ABILITY,
    potentialAbility: PROVISIONAL_POTENTIAL,
    form: 5,
    fitnessPct: 100,
    moralePct: 70,
    appearances: 0,
    goals: 0,
    contractEndSeason: p.contract.untilSeason ?? "2026/27",
    wageSekPerMonth: 0,
    attributes: provisionalAttributes(),
  };
}

export function toPlayerMocks(players: readonly RealWorldPlayer[]): PlayerMock[] {
  const out: PlayerMock[] = [];
  for (const p of players) {
    const mock = toPlayerMock(p);
    if (mock) out.push(mock);
  }
  return out;
}
