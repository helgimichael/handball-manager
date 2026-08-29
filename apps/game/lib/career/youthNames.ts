// HM-YOUTH-INTAKE-1.0 Part 8: a small, deterministic, FICTIONAL Swedish
// name pool for generated youth intake players -- audited first (Part 8:
// "Auditera om det redan finns name-generation utilities"): the only
// existing name sources in this codebase are REAL, NAMED individuals
// (SCOUT_POOL_SOURCE's own real-person biographical identities, staff.ts's
// own doc on why those must never be reused as a template for a fictional
// person) or real-world-imported player rosters (game-data/players.ts) --
// neither is appropriate to draw from for a newly-created fictional
// player identity. This pool is deliberately small (not exhaustive) --
// 48 first names x 56 surnames = 2,688 combinations, comfortably more
// than this milestone's own modest intake volume (a handful of players
// per club per year) ever needs to avoid obvious repetition within one
// career; duplicate FULL names may still occur (Part 8 explicitly permits
// this), only playerId is required to stay unique.
import { seededOffset } from "../rating/generation/deterministicVariation";

const YOUTH_FIRST_NAMES: readonly string[] = [
  "Adam", "Alexander", "Anton", "Arvid", "August", "Axel", "Benjamin", "Casper",
  "Christoffer", "Daniel", "David", "Elias", "Emil", "Erik", "Filip", "Gustav",
  "Hampus", "Hugo", "Isak", "Jacob", "Jesper", "Johan", "John", "Jonathan",
  "Kevin", "Linus", "Ludvig", "Lukas", "Marcus", "Mattias", "Max", "Melvin",
  "Nils", "Noah", "Oliver", "Olle", "Oscar", "Pontus", "Rasmus", "Robin",
  "Samuel", "Sebastian", "Simon", "Theodor", "Tobias", "Tom", "Viktor", "William",
];

const YOUTH_SURNAMES: readonly string[] = [
  "Andersson", "Axelsson", "Berg", "Bergström", "Björk", "Blom", "Dahl", "Edberg",
  "Ekberg", "Eklund", "Engström", "Fransson", "Gustafsson", "Hallberg", "Hedberg", "Hedin",
  "Hellström", "Hermansson", "Holm", "Holmberg", "Isaksson", "Jansson", "Johansson", "Karlsson",
  "Lindberg", "Lindgren", "Lindqvist", "Lindström", "Ljung", "Lundberg", "Lundqvist", "Lundström",
  "Löfgren", "Magnusson", "Nilsson", "Nordin", "Norén", "Olofsson", "Persson", "Petersson",
  "Pettersson", "Sandberg", "Sjöberg", "Ström", "Strömberg", "Sundberg", "Svensson", "Söderberg",
  "Söderqvist", "Thorén", "Wahlberg", "Wallin", "Wennberg", "Wikström", "Åberg", "Öberg",
];

/** 0..n-1, deterministic from `seedKey`. */
function seededIndex(seedKey: string, n: number): number {
  return Math.abs(seededOffset(seedKey, n)) % n;
}

export interface GeneratedYouthName {
  firstName: string;
  lastName: string;
}

/** Deterministic full name for a given seed key (typically the generated player's own playerId). */
export function generateYouthName(seedKey: string): GeneratedYouthName {
  return {
    firstName: YOUTH_FIRST_NAMES[seededIndex(`${seedKey}:youth-first-name`, YOUTH_FIRST_NAMES.length)],
    lastName: YOUTH_SURNAMES[seededIndex(`${seedKey}:youth-last-name`, YOUTH_SURNAMES.length)],
  };
}
