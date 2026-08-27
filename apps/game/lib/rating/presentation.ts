// HM-DATA-ALLSVENSKAN-1.1B Part 2: PRESENTATION LAYER for the rating
// domain's tactical-role vocabulary (AttackRole/DefenceRole/
// GoalkeeperArchetype -- lib/rating/types.ts / gamePrior/types.ts).
// Canonical enums stay exactly as generated/stored; normal game UI must
// render a player's role(s) through `presentAttackRole`/
// `presentDefenceRole`/`presentGoalkeeperArchetype` (or the umbrella
// `presentTacticalRole`), never the raw SCREAMING_SNAKE_CASE token
// (e.g. "SCREENING_PIVOT", "COMPLETE_BACK"). Editor Mode/debug views may
// still read the raw value directly (see components/RatingProfilePanels.tsx).
import type { AttackRole, DefenceRole } from "./types";
import type { GoalkeeperArchetype } from "./gamePrior/types";

const ATTACK_ROLE_LABEL_SV: Record<AttackRole, string> = {
  PRIMARY_PLAYMAKER: "Primär speluppbyggare",
  BREAKTHROUGH_CREATOR: "Genombrottsskapare",
  SCORING_CENTRE_BACK: "Målfarlig mittnia",
  TEMPO_CONTROLLER: "Tempokontrollant",
  SHOOTING_BACK: "Skjutande nia",
  BREAKTHROUGH_BACK: "Genombrottsnia",
  CREATIVE_BACK: "Kreativ nia",
  COMPLETE_BACK: "Komplett nia",
  PHYSICAL_PIVOT: "Fysisk mittsexa",
  MOBILE_PIVOT: "Rörlig mittsexa",
  SCREENING_PIVOT: "Skärmande mittsexa",
  OFFENSIVE_PIVOT: "Offensiv mittsexa",
  TWO_WAY_M6: "Tvåvägsmittsexa",
  ELITE_FINISHER: "Elitavslutare",
  TRANSITION_WING: "Omställningskant",
  CREATIVE_WING: "Kreativ kant",
  TWO_WAY_WING: "Tvåvägskant",
};

const DEFENCE_ROLE_LABEL_SV: Record<DefenceRole, string> = {
  CENTRAL_ANCHOR: "Central ankare",
  AGGRESSIVE_SECOND: "Aggressiv tvåa",
  MOBILE_DEFENDER: "Rörlig försvarare",
  DEFENSIVE_SPECIALIST: "Försvarsspecialist",
  MULTI_POSITION_DEFENDER: "Mångsidig försvarare",
};

const GOALKEEPER_ARCHETYPE_LABEL_SV: Record<GoalkeeperArchetype, string> = {
  SHOT_STOPPER: "Skottstoppare",
  POSITIONING_READER: "Positioneringsläsare",
  DISTRIBUTOR: "Utkastspecialist",
  BALANCED_GOALKEEPER: "Balanserad målvakt",
};

function humanizeEnumFallback(raw: string): string {
  return raw.toLowerCase().replace(/_/g, " ");
}

export function presentAttackRole(role: string): string {
  return ATTACK_ROLE_LABEL_SV[role as AttackRole] ?? humanizeEnumFallback(role);
}

export function presentDefenceRole(role: string): string {
  return DEFENCE_ROLE_LABEL_SV[role as DefenceRole] ?? humanizeEnumFallback(role);
}

export function presentGoalkeeperArchetype(archetype: string): string {
  return GOALKEEPER_ARCHETYPE_LABEL_SV[archetype as GoalkeeperArchetype] ?? humanizeEnumFallback(archetype);
}

/** Umbrella presenter for a role string whose specific vocabulary (attack/defence/goalkeeper) isn't known at the call site -- tries all three tables, falls back to a humanized (never raw) string. */
export function presentTacticalRole(role: string): string {
  if (role in ATTACK_ROLE_LABEL_SV) return ATTACK_ROLE_LABEL_SV[role as AttackRole];
  if (role in DEFENCE_ROLE_LABEL_SV) return DEFENCE_ROLE_LABEL_SV[role as DefenceRole];
  if (role in GOALKEEPER_ARCHETYPE_LABEL_SV) return GOALKEEPER_ARCHETYPE_LABEL_SV[role as GoalkeeperArchetype];
  return humanizeEnumFallback(role);
}
