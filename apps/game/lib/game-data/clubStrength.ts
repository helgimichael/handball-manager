import type { ClubStrength } from "@handball-manager/game-simulation";
import { TUMBA_SQUAD } from "./players";
import { TUMBA_CLUB_ID } from "./clubs";

/**
 * Mock game-balancing strength profiles for every Allsvenskan (swe-2)
 * club, on the 1-100 scale game-simulation's ClubStrength expects.
 * These are NOT a claim about any real club's real-world performance --
 * purely authored numbers for a competitive-feeling mock second-tier
 * Swedish league. IFK Tumba's own rating is derived from its actual
 * mock squad (players.ts) rather than hand-picked, so squad changes
 * later can feed back into it; every other club's rating is curated by
 * hand for a believable spread across the table.
 */

function deriveTumbaStrength(): ClubStrength {
  const outfield = TUMBA_SQUAD.filter((p) => p.position !== "MV" && p.squadStatus !== "Skadad" && p.squadStatus !== "Avstängd");
  const goalkeepers = TUMBA_SQUAD.filter((p) => p.position === "MV");
  const avgOutfieldCA = outfield.reduce((sum, p) => sum + p.currentAbility, 0) / outfield.length;
  const avgGkCA = goalkeepers.reduce((sum, p) => sum + p.currentAbility, 0) / goalkeepers.length;
  const attackWeighted =
    TUMBA_SQUAD.filter((p) => ["V9", "H9", "M9", "PV"].includes(p.position)).reduce((sum, p) => sum + p.currentAbility, 0) /
    TUMBA_SQUAD.filter((p) => ["V9", "H9", "M9", "PV"].includes(p.position)).length;
  const defenseWeighted =
    TUMBA_SQUAD.filter((p) => ["V6", "H6", "M6"].includes(p.position)).reduce((sum, p) => sum + p.currentAbility, 0) /
    TUMBA_SQUAD.filter((p) => ["V6", "H6", "M6"].includes(p.position)).length;

  // currentAbility is on the hidden 1-200 scale (players.ts) -- halve
  // it onto game-simulation's 1-100 scale.
  const toScale = (ca: number) => Math.round(ca / 2);

  return {
    clubId: TUMBA_CLUB_ID,
    overall: toScale(avgOutfieldCA),
    attack: toScale(attackWeighted),
    defense: toScale(defenseWeighted),
    goalkeeper: toScale(avgGkCA),
    depth: toScale(avgOutfieldCA) - 6, // a 22-player mock squad is squad-of-one-club depth, not elite-tier depth
  };
}

// Curated mock ratings for the 13 AI Allsvenskan clubs -- a believable
// competitive spread, not a real-world claim (see clubs.ts's own
// disclaimer for the same principle applied to club identity data).
const AI_CLUB_STRENGTHS: Record<string, Omit<ClubStrength, "clubId">> = {
  "swe2-anderstorp": { overall: 50, attack: 51, defense: 49, goalkeeper: 50, depth: 44 },
  "swe2-aranas": { overall: 66, attack: 68, defense: 64, goalkeeper: 65, depth: 60 },
  "swe2-drott": { overall: 60, attack: 59, defense: 61, goalkeeper: 60, depth: 54 },
  "swe2-torslanda": { overall: 55, attack: 56, defense: 54, goalkeeper: 55, depth: 49 },
  "swe2-varberg": { overall: 58, attack: 57, defense: 59, goalkeeper: 58, depth: 52 },
  "swe2-karlskrona2": { overall: 63, attack: 62, defense: 64, goalkeeper: 63, depth: 57 },
  "swe2-ystad2": { overall: 57, attack: 58, defense: 56, goalkeeper: 57, depth: 51 },
  "swe2-lagan": { overall: 48, attack: 47, defense: 49, goalkeeper: 48, depth: 42 },
  "swe2-kungalv": { overall: 52, attack: 53, defense: 51, goalkeeper: 52, depth: 46 },
  "swe2-lugi": { overall: 64, attack: 65, defense: 63, goalkeeper: 64, depth: 59 },
  "swe2-tyreso": { overall: 54, attack: 55, defense: 53, goalkeeper: 54, depth: 48 },
  "swe2-vinslov": { overall: 46, attack: 46, defense: 46, goalkeeper: 46, depth: 40 },
  "swe2-skanela": { overall: 45, attack: 44, defense: 46, goalkeeper: 45, depth: 39 },
};

export function getAllsvenskanClubStrengths(): Readonly<Record<string, ClubStrength>> {
  const result: Record<string, ClubStrength> = {};
  for (const [clubId, rating] of Object.entries(AI_CLUB_STRENGTHS)) {
    result[clubId] = { clubId, ...rating };
  }
  result[TUMBA_CLUB_ID] = deriveTumbaStrength();
  return result;
}

export function getClubStrength(clubId: string): ClubStrength {
  const strengths = getAllsvenskanClubStrengths();
  return strengths[clubId] ?? { clubId, overall: 50, attack: 50, defense: 50, goalkeeper: 50, depth: 45 };
}
