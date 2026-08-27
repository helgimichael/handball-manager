import type { HandballPosition, PlayerMock, PlayerMockAttributes } from "./types";
import { TUMBA_CLUB_ID } from "./clubs";

/**
 * IFK Tumba's fictional mock squad. Every name below is invented for
 * this game -- none reference real handball players. CA/PA follow a
 * conventional 1-200 hidden development scale (documented in
 * types.ts); PA is intentionally never surfaced directly in the UI --
 * see potentialStars() in this file, used by the Squad/Player Profile
 * screens instead of the raw number.
 */

type ArchetypeBias = Partial<{
  skott: number;
  passning: number;
  spelforstaelse: number;
  genombrott: number;
  mottagning: number;
  fint: number;
  spelUtanBoll: number;
  beslutsfattande: number;
  kyla: number;
  arbetskapacitet: number;
  kampvilja: number;
  positionering: number;
  lagarbete: number;
  ledarskap: number;
  snabbhet: number;
  acceleration: number;
  styrka: number;
  explosivitet: number;
  uthallighet: number;
  rorlighet: number;
}>;

function clamp1to20(value: number): number {
  return Math.max(1, Math.min(20, Math.round(value)));
}

function buildAttributes(overall: number, bias: ArchetypeBias, seed: number): PlayerMockAttributes {
  // Deterministic small variation from `seed` so each player differs
  // without genuinely random noise between runs.
  const wobble = (offset: number) => ((seed * 7 + offset * 13) % 5) - 2;
  const base = overall; // `overall` is already passed in on a 1-20 feel (see call site)
  const v = (key: keyof ArchetypeBias, offset: number) => clamp1to20(base + (bias[key] ?? 0) + wobble(offset));

  return {
    technical: {
      skott: v("skott", 1),
      passning: v("passning", 2),
      spelforstaelse: v("spelforstaelse", 3),
      genombrott: v("genombrott", 4),
      mottagning: v("mottagning", 5),
      fint: v("fint", 6),
      spelUtanBoll: v("spelUtanBoll", 7),
    },
    mental: {
      beslutsfattande: v("beslutsfattande", 8),
      kyla: v("kyla", 9),
      arbetskapacitet: v("arbetskapacitet", 10),
      kampvilja: v("kampvilja", 11),
      positionering: v("positionering", 12),
      lagarbete: v("lagarbete", 13),
      ledarskap: v("ledarskap", 14),
    },
    physical: {
      snabbhet: v("snabbhet", 15),
      acceleration: v("acceleration", 16),
      styrka: v("styrka", 17),
      explosivitet: v("explosivitet", 18),
      uthallighet: v("uthallighet", 19),
      rorlighet: v("rorlighet", 20),
    },
  };
}

const WING_BIAS: ArchetypeBias = { snabbhet: 3, acceleration: 3, fint: 2, genombrott: 1 };
const BACK_BIAS: ArchetypeBias = { skott: 2, styrka: 2, explosivitet: 1 };
const PLAYMAKER_BIAS: ArchetypeBias = { spelforstaelse: 3, passning: 3, beslutsfattande: 2, ledarskap: 1 };
const PIVOT_BIAS: ArchetypeBias = { styrka: 4, kampvilja: 2, positionering: 2 };
const GK_BIAS: ArchetypeBias = { positionering: 4, kyla: 3, rorlighet: 2 };

type SeedInput = {
  id: string;
  firstName: string;
  lastName: string;
  shirtNumber: number;
  position: HandballPosition;
  secondaryPosition?: HandballPosition;
  dob: string;
  heightCm: number;
  weightKg: number;
  foot: PlayerMock["foot"];
  squadStatus: PlayerMock["squadStatus"];
  currentAbility: number;
  potentialAbility: number;
  form: number;
  fitnessPct: number;
  moralePct: number;
  appearances: number;
  goals: number;
  contractEndSeason: string;
  wageSekPerMonth: number;
  bias: ArchetypeBias;
  seed: number;
};

function player(input: SeedInput): PlayerMock {
  return {
    id: input.id,
    clubId: TUMBA_CLUB_ID,
    firstName: input.firstName,
    lastName: input.lastName,
    shirtNumber: input.shirtNumber,
    position: input.position,
    secondaryPosition: input.secondaryPosition,
    nationality: "SWE",
    dateOfBirth: input.dob,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    foot: input.foot,
    squadStatus: input.squadStatus,
    currentAbility: input.currentAbility,
    potentialAbility: input.potentialAbility,
    form: input.form,
    fitnessPct: input.fitnessPct,
    moralePct: input.moralePct,
    appearances: input.appearances,
    goals: input.goals,
    contractEndSeason: input.contractEndSeason,
    wageSekPerMonth: input.wageSekPerMonth,
    attributes: buildAttributes((input.currentAbility / 200) * 20, input.bias, input.seed),
  };
}

export const TUMBA_SQUAD: readonly PlayerMock[] = [
  // Goalkeepers
  player({ id: "p-palicka", firstName: "Simon", lastName: "Palicka", shirtNumber: 12, position: "MV", dob: "1998-03-11", heightCm: 194, weightKg: 92, foot: "Vänsterhänt", squadStatus: "Förstaval", currentAbility: 128, potentialAbility: 134, form: 7.4, fitnessPct: 91, moralePct: 82, appearances: 21, goals: 0, contractEndSeason: "2027/28", wageSekPerMonth: 38000, bias: GK_BIAS, seed: 1 }),
  player({ id: "p-myrhol", firstName: "Anton", lastName: "Myrhol", shirtNumber: 16, position: "MV", dob: "2001-07-22", heightCm: 191, weightKg: 88, foot: "Högerhänt", squadStatus: "Rotation", currentAbility: 104, potentialAbility: 121, form: 6.8, fitnessPct: 96, moralePct: 78, appearances: 9, goals: 0, contractEndSeason: "2026/27", wageSekPerMonth: 21000, bias: GK_BIAS, seed: 2 }),
  player({ id: "p-wide", firstName: "Elis", lastName: "Wide", shirtNumber: 30, position: "MV", dob: "2007-01-14", heightCm: 189, weightKg: 79, foot: "Högerhänt", squadStatus: "Ungdom", currentAbility: 68, potentialAbility: 128, form: 6.1, fitnessPct: 99, moralePct: 85, appearances: 2, goals: 0, contractEndSeason: "2027/28", wageSekPerMonth: 9500, bias: GK_BIAS, seed: 3 }),

  // Left wings
  player({ id: "p-nilsson", firstName: "Love", lastName: "Nilsson", shirtNumber: 3, position: "V9", dob: "1999-05-02", heightCm: 183, weightKg: 81, foot: "Vänsterhänt", squadStatus: "Förstaval", currentAbility: 122, potentialAbility: 129, form: 6.9, fitnessPct: 88, moralePct: 80, appearances: 24, goals: 87, contractEndSeason: "2026/27", wageSekPerMonth: 34000, bias: WING_BIAS, seed: 4 }),
  player({ id: "p-berndtsson", firstName: "Hugo", lastName: "Berndtsson", shirtNumber: 22, position: "V9", dob: "2004-09-19", heightCm: 180, weightKg: 76, foot: "Vänsterhänt", squadStatus: "Rotation", currentAbility: 96, potentialAbility: 138, form: 7.2, fitnessPct: 94, moralePct: 88, appearances: 18, goals: 44, contractEndSeason: "2028/29", wageSekPerMonth: 19000, bias: WING_BIAS, seed: 5 }),

  // Right wings
  player({ id: "p-forsell", firstName: "Olle", lastName: "Forsell Schefvert", shirtNumber: 15, position: "H9", dob: "2002-02-27", heightCm: 192, weightKg: 93, foot: "Högerhänt", squadStatus: "Förstaval", currentAbility: 138, potentialAbility: 152, form: 7.6, fitnessPct: 90, moralePct: 91, appearances: 25, goals: 96, contractEndSeason: "2027/28", wageSekPerMonth: 46000, bias: WING_BIAS, seed: 6 }),
  player({ id: "p-hallqvist", firstName: "Wilmer", lastName: "Hallqvist", shirtNumber: 21, position: "H9", dob: "2006-11-03", heightCm: 179, weightKg: 74, foot: "Högerhänt", squadStatus: "Ungdom", currentAbility: 79, potentialAbility: 133, form: 6.4, fitnessPct: 97, moralePct: 83, appearances: 6, goals: 11, contractEndSeason: "2026/27", wageSekPerMonth: 11500, bias: WING_BIAS, seed: 7 }),

  // Left backs
  player({ id: "p-darj", firstName: "Sam", lastName: "Darj", shirtNumber: 5, position: "V6", dob: "1997-12-08", heightCm: 197, weightKg: 101, foot: "Vänsterhänt", squadStatus: "Förstaval", currentAbility: 131, potentialAbility: 136, form: 7.1, fitnessPct: 85, moralePct: 79, appearances: 23, goals: 112, contractEndSeason: "2026/27", wageSekPerMonth: 41000, bias: BACK_BIAS, seed: 8 }),
  player({ id: "p-ekdahl", firstName: "Filip", lastName: "Ekdahl", shirtNumber: 17, position: "V6", dob: "2003-04-30", heightCm: 194, weightKg: 96, foot: "Vänsterhänt", squadStatus: "Rotation", currentAbility: 101, potentialAbility: 118, form: 6.6, fitnessPct: 92, moralePct: 81, appearances: 15, goals: 58, contractEndSeason: "2027/28", wageSekPerMonth: 22000, bias: BACK_BIAS, seed: 9 }),
  player({ id: "p-brorsson", firstName: "Axel", lastName: "Brorsson", shirtNumber: 27, position: "V6", dob: "2005-08-16", heightCm: 190, weightKg: 89, foot: "Vänsterhänt", squadStatus: "Ungdom", currentAbility: 84, potentialAbility: 141, form: 6.9, fitnessPct: 95, moralePct: 86, appearances: 10, goals: 29, contractEndSeason: "2028/29", wageSekPerMonth: 14000, bias: BACK_BIAS, seed: 10 }),

  // Center backs / playmakers (M6 primary, M9 as flex)
  player({ id: "p-johansson", firstName: "Eric", lastName: "Johansson", shirtNumber: 9, position: "M9", secondaryPosition: "M6", dob: "2000-06-25", heightCm: 189, weightKg: 87, foot: "Högerhänt", squadStatus: "Förstaval", currentAbility: 135, potentialAbility: 143, form: 7.3, fitnessPct: 89, moralePct: 84, appearances: 24, goals: 71, contractEndSeason: "2027/28", wageSekPerMonth: 44000, bias: PLAYMAKER_BIAS, seed: 11 }),
  player({ id: "p-zachrisson", firstName: "Jesper", lastName: "Zachrisson", shirtNumber: 4, position: "M6", secondaryPosition: "V6", dob: "1996-01-19", heightCm: 191, weightKg: 90, foot: "Högerhänt", squadStatus: "Förstaval", currentAbility: 129, potentialAbility: 130, form: 7.0, fitnessPct: 84, moralePct: 88, appearances: 26, goals: 63, contractEndSeason: "2026/27", wageSekPerMonth: 39000, bias: PLAYMAKER_BIAS, seed: 12 }),
  player({ id: "p-tumba-wonderkid", firstName: "Melvin", lastName: "Ask", shirtNumber: 33, position: "M6", secondaryPosition: "M9", dob: "2009-03-30", heightCm: 186, weightKg: 78, foot: "Högerhänt", squadStatus: "Ungdom", currentAbility: 72, potentialAbility: 167, form: 7.8, fitnessPct: 98, moralePct: 92, appearances: 4, goals: 9, contractEndSeason: "2028/29", wageSekPerMonth: 8500, bias: PLAYMAKER_BIAS, seed: 13 }),

  // Right backs
  player({ id: "p-johannisson", firstName: "Simon", lastName: "Johannisson", shirtNumber: 24, position: "H6", dob: "1998-10-05", heightCm: 196, weightKg: 99, foot: "Högerhänt", squadStatus: "Förstaval", currentAbility: 124, potentialAbility: 127, form: 7.2, fitnessPct: 87, moralePct: 83, appearances: 22, goals: 88, contractEndSeason: "2027/28", wageSekPerMonth: 36000, bias: BACK_BIAS, seed: 14 }),
  player({ id: "p-lundqvist", firstName: "Rasmus", lastName: "Lundqvist", shirtNumber: 18, position: "H6", dob: "2004-02-11", heightCm: 193, weightKg: 92, foot: "Högerhänt", squadStatus: "Rotation", currentAbility: 98, potentialAbility: 132, form: 6.5, fitnessPct: 93, moralePct: 77, appearances: 14, goals: 41, contractEndSeason: "2027/28", wageSekPerMonth: 20000, bias: BACK_BIAS, seed: 15 }),
  player({ id: "p-sahlin", firstName: "Isak", lastName: "Sahlin", shirtNumber: 29, position: "H6", dob: "2006-05-27", heightCm: 188, weightKg: 84, foot: "Högerhänt", squadStatus: "Ungdom", currentAbility: 77, potentialAbility: 122, form: 6.3, fitnessPct: 96, moralePct: 80, appearances: 5, goals: 13, contractEndSeason: "2026/27", wageSekPerMonth: 10500, bias: BACK_BIAS, seed: 16 }),

  // Pivots
  player({ id: "p-almqvist", firstName: "Viktor", lastName: "Almqvist", shirtNumber: 7, position: "M6", dob: "1995-11-14", heightCm: 199, weightKg: 108, foot: "Högerhänt", squadStatus: "Förstaval", currentAbility: 126, potentialAbility: 126, form: 6.7, fitnessPct: 82, moralePct: 76, appearances: 20, goals: 66, contractEndSeason: "2026/27", wageSekPerMonth: 37000, bias: PIVOT_BIAS, seed: 17 }),
  player({ id: "p-bredelin", firstName: "Theo", lastName: "Bredelin", shirtNumber: 8, position: "M6", dob: "2002-08-09", heightCm: 197, weightKg: 103, foot: "Vänsterhänt", squadStatus: "Rotation", currentAbility: 103, potentialAbility: 124, form: 6.8, fitnessPct: 90, moralePct: 82, appearances: 16, goals: 39, contractEndSeason: "2027/28", wageSekPerMonth: 23000, bias: PIVOT_BIAS, seed: 18 }),
  player({ id: "p-osterberg", firstName: "Noel", lastName: "Österberg", shirtNumber: 14, position: "M6", dob: "2005-12-01", heightCm: 195, weightKg: 97, foot: "Högerhänt", squadStatus: "Ungdom", currentAbility: 81, potentialAbility: 119, form: 6.5, fitnessPct: 95, moralePct: 79, appearances: 8, goals: 15, contractEndSeason: "2027/28", wageSekPerMonth: 12500, bias: PIVOT_BIAS, seed: 19 }),

  // Injured / squad depth
  player({ id: "p-holmgren", firstName: "Adam", lastName: "Holmgren", shirtNumber: 20, position: "V6", dob: "1999-09-23", heightCm: 192, weightKg: 91, foot: "Vänsterhänt", squadStatus: "Skadad", currentAbility: 108, potentialAbility: 115, form: 5.2, fitnessPct: 41, moralePct: 63, appearances: 11, goals: 34, contractEndSeason: "2026/27", wageSekPerMonth: 24000, bias: BACK_BIAS, seed: 20 }),
  player({ id: "p-carlen", firstName: "William", lastName: "Carlén", shirtNumber: 6, position: "H9", dob: "2001-04-17", heightCm: 186, weightKg: 82, foot: "Vänsterhänt", squadStatus: "Rotation", currentAbility: 94, potentialAbility: 106, form: 6.0, fitnessPct: 91, moralePct: 74, appearances: 13, goals: 37, contractEndSeason: "2026/27", wageSekPerMonth: 18000, bias: WING_BIAS, seed: 21 }),
];

export function getSquad(): readonly PlayerMock[] {
  return TUMBA_SQUAD;
}

export function getPlayer(id: string): PlayerMock | undefined {
  return TUMBA_SQUAD.find((p) => p.id === id);
}

/** HM-DATA-0.2: dateOfBirth may be null for a real-world-imported player whose birth date isn't verified. Falls back to a birthYear-only estimate when given one; returns null (never a fabricated age) when neither is known. */
export function playerAge(dateOfBirth: string | null, birthYear?: number | null): number | null {
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    const today = new Date("2026-08-19");
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age;
  }
  if (birthYear) {
    return 2026 - birthYear;
  }
  return null;
}

/**
 * Deliberately does NOT return potentialAbility. Converts the hidden
 * 1-200 PA scale into a coarse, uncertainty-flavoured 1-5 star
 * impression -- the wonderkid-scouting experience this pass wants to
 * prototype without exposing (or finalising) the real number.
 */
export function potentialStars(p: PlayerMock): number {
  return Math.max(1, Math.min(5, Math.ceil(p.potentialAbility / 40)));
}

export function abilityStars(p: PlayerMock): number {
  return Math.max(1, Math.min(5, Math.ceil(p.currentAbility / 40)));
}

export function positionLabel(position: HandballPosition): string {
  const labels: Record<HandballPosition, string> = {
    MV: "Målvakt",
    V9: "Vänster nia",
    V6: "Vänster sexa",
    M9: "Mittnia",
    M6: "Mittsexa",
    H9: "Höger nia",
    H6: "Höger sexa",
  };
  return labels[position];
}
