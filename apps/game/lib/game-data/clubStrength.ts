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
    TUMBA_SQUAD.filter((p) => ["V9", "H9", "M9"].includes(p.position)).reduce((sum, p) => sum + p.currentAbility, 0) /
    TUMBA_SQUAD.filter((p) => ["V9", "H9", "M9"].includes(p.position)).length;
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
// HM-DATA-ALLSVENSKAN-1.0: rebuilt for the corrected 14-club list,
// loosely directionally informed by each club's own CLUB IDENTITY
// profile (e.g. Varberg/VästeråsIrsta's real relative strength, Tyresö's
// attack-heavy/defence-weak imbalance, Guif's financial-pressure
// rebuild) -- still hand-authored mock numbers, never derived from the
// qualitative identity claims themselves (Part: "skriv inte över
// canonical economy/strength med godtyckliga exakta siffror").
const AI_CLUB_STRENGTHS: Record<string, Omit<ClubStrength, "clubId">> = {
  "swe2-aranas": { overall: 66, attack: 68, defense: 64, goalkeeper: 65, depth: 60 },
  "swe2-drott": { overall: 60, attack: 59, defense: 61, goalkeeper: 60, depth: 54 },
  "swe2-guif": { overall: 47, attack: 48, defense: 46, goalkeeper: 47, depth: 41 },
  "swe2-h43lund": { overall: 56, attack: 54, defense: 57, goalkeeper: 56, depth: 55 },
  "swe2-huddinge": { overall: 51, attack: 50, defense: 52, goalkeeper: 51, depth: 43 },
  "swe2-kroppskultur": { overall: 59, attack: 58, defense: 62, goalkeeper: 59, depth: 42 },
  "swe2-kungalv": { overall: 52, attack: 53, defense: 51, goalkeeper: 52, depth: 46 },
  "swe2-redbergslid": { overall: 62, attack: 61, defense: 60, goalkeeper: 63, depth: 56 },
  "swe2-torslanda": { overall: 55, attack: 60, defense: 48, goalkeeper: 55, depth: 49 },
  "swe2-tyreso": { overall: 55, attack: 64, defense: 42, goalkeeper: 50, depth: 48 },
  "swe2-varberg": { overall: 65, attack: 62, defense: 66, goalkeeper: 68, depth: 58 },
  "swe2-vasterasirsta": { overall: 63, attack: 60, defense: 62, goalkeeper: 60, depth: 56 },
  "swe2-ystad2": { overall: 58, attack: 62, defense: 55, goalkeeper: 57, depth: 51 },
};

export function getAllsvenskanClubStrengths(): Readonly<Record<string, ClubStrength>> {
  const result: Record<string, ClubStrength> = {};
  for (const [clubId, rating] of Object.entries(AI_CLUB_STRENGTHS)) {
    result[clubId] = { clubId, ...rating };
  }
  result[TUMBA_CLUB_ID] = deriveTumbaStrength();
  return result;
}

// HM-DATA-0.2: every real-world Handbollsligan club (se_club_*) falls
// through to this flat neutral default deliberately -- their real-world
// data has no ability rating to derive a curated number from, and
// inventing one from height/age/nationality/shirt number is explicitly
// disallowed. This is the same "smallest deterministic neutral default"
// principle as the Provisional Game Profile applied to individual real
// players (see gameWorld/gameWorldAdapter.ts).
export function getClubStrength(clubId: string): ClubStrength {
  const strengths = getAllsvenskanClubStrengths();
  return strengths[clubId] ?? { clubId, overall: 50, attack: 50, defense: 50, goalkeeper: 50, depth: 45 };
}
