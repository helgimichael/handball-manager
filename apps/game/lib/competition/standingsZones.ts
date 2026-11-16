// Arena Nights Phase 3 -- CMP-01a A annotated standings. Zones come only from the verified rules in rules.ts
// (THB §2:1-2:3, §3:3); movement compares the live table with the same table before the latest played round.
// Read-only: the competition engine, tie-breakers and transitions are untouched.
import type { CareerState } from "../career/types";
import type { StandingRow } from "@handball-manager/game-simulation";
import { ALLSVENSKAN, ALLSVENSKAN_RULES, HANDBOLLSLIGAN, KVAL_HBL_RULES, SM_SLUTSPEL_RULES } from "./rules";
import { competitionTable } from "./tables";

export type ZoneId = "TITLE_PLAYOFF" | "PROMOTION" | "PROMOTION_KVAL" | "RELEGATION_KVAL" | "RELEGATION";
export interface Zone { id: ZoneId; label: string; tone: "pos" | "info" | "warn" | "neg" }
const Z: Record<ZoneId, Zone> = {
  TITLE_PLAYOFF: { id: "TITLE_PLAYOFF", label: "SM-slutspel", tone: "pos" },
  PROMOTION: { id: "PROMOTION", label: "Uppflyttning", tone: "pos" },
  PROMOTION_KVAL: { id: "PROMOTION_KVAL", label: "Kval till Handbollsligan", tone: "info" },
  RELEGATION_KVAL: { id: "RELEGATION_KVAL", label: "Kval för att stanna", tone: "warn" },
  RELEGATION: { id: "RELEGATION", label: "Nedflyttning", tone: "neg" },
};

/** The zone a final position leads to, or null where the rules give it no meaning (or the competition has none). */
export function zoneFor(competitionId: string, position: number): Zone | null {
  if (competitionId === HANDBOLLSLIGAN) {
    if (position <= SM_SLUTSPEL_RULES.qualifiers) return Z.TITLE_PLAYOFF;
    if (KVAL_HBL_RULES.pairs.some(([hbl]) => hbl === position)) return Z.RELEGATION_KVAL;
    if ((KVAL_HBL_RULES.directRelegation as readonly number[]).includes(position)) return Z.RELEGATION;
    return null;
  }
  if (competitionId === ALLSVENSKAN) {
    if (ALLSVENSKAN_RULES.directPromotion.includes(position)) return Z.PROMOTION;
    if (ALLSVENSKAN_RULES.toHblKval.includes(position)) return Z.PROMOTION_KVAL;
    if (ALLSVENSKAN_RULES.relegationKval.includes(position)) return Z.RELEGATION_KVAL;
    if (ALLSVENSKAN_RULES.directRelegation.includes(position)) return Z.RELEGATION;
    return null;
  }
  return null;
}

export interface AnnotatedRow { row: StandingRow; position: number; zone: Zone | null; zoneStart: boolean; movement: number | null; gapToAbove: number | null }
/** The live table with zones (and where each zone starts), places moved since the previous round, and the points gap to the club above. */
export function annotatedStandings(state: CareerState, competitionId: string, table: readonly StandingRow[] = competitionTable(state, competitionId)): AnnotatedRow[] {
  const league = state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === competitionId && state.results[f.id]);
  const lastRound = league.reduce((m, f) => Math.max(m, f.round ?? 0), 0);
  let previous: Map<string, number> | null = null;
  if (lastRound > 1) {
    const results = { ...state.results };
    for (const f of league) if ((f.round ?? 0) === lastRound) delete results[f.id];
    previous = new Map(competitionTable({ ...state, results }, competitionId).map((r, i) => [r.clubId, i + 1]));
  }
  return table.map((row, i) => {
    const position = i + 1;
    const zone = zoneFor(competitionId, position);
    const above = i > 0 ? zoneFor(competitionId, i) : null;
    const was = previous?.get(row.clubId);
    return { row, position, zone, zoneStart: !!zone && zone.id !== above?.id, movement: was ? was - position : null, gapToAbove: i > 0 ? table[i - 1]!.points - row.points : null };
  });
}
