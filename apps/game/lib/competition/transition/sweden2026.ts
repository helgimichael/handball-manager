// M1.2A verified ordinary sporting rules only. Live rollover preserves every readiness limitation.
import type { CompetitionRules, EntryRule, Evidence, QualificationStage, StageEntrant } from "./types";
import { swedishRuleEvidence } from './swedenDataCompletion';
import { qualificationScheduling2026 } from "./sweden2026Calendar";

export const SWEDISH_LEAGUES = {
  hbl: "se_handbollsligan_herr", allsvenskan: "swe-2",
  norra: "se_division1_norra", sodra: "se_division1_sodra",
} as const;
export const SWEDISH_FAMILIES = { hbl: "se-men-tier-1", allsvenskan: "se-men-tier-2", division1: "se-men-tier-3", division2: "se-men-tier-4-boundary" } as const;
const L = SWEDISH_LEAGUES, F = SWEDISH_FAMILIES;
const thb3 = "https://www.svenskhandboll.se/download/18.360a4fd619fada88abaa4917/1788947681512/THB%202026-2027%20kap%2003%20sid%2008-25%20F%C3%B6rbund%20o%20reg.pdf";
const tb2 = "https://www.svenskhandboll.se/download/18.60debfeb19fc104b5f2202b3/1785760168832/TB%202026-2027%20kap%2002%20nationella%20matcher%20sid%208-14.pdf";
const slots: Evidence = swedishRuleEvidence("Body sections 3:1, 3:3-4, printed pp.9,13 (contents numbering differs)");
const paths: Evidence = swedishRuleEvidence("Body section 3:2, printed pp.10-11");
const entries: EntryRule[] = [];
function ranks(competitionId: string, list: number[], purpose: EntryRule["purpose"], targetFamilyId: string, eligibility = false, replacement: EntryRule["replacement"] = "NONE") {
  for (const rank of list) entries.push({ id: `${competitionId}:rank:${rank}`, selector: { kind: "RANK", competitionId, rank }, purpose, targetFamilyId, eligibility, replacement, source: slots });
}
ranks(L.hbl, [1,2,3,4,5,6,7,8,9,10], "RETAIN", F.hbl);
ranks(L.hbl, [11,12,13], "QUALIFY", F.hbl, true);
ranks(L.hbl, [14], "DIRECT", F.allsvenskan);
ranks(L.allsvenskan, [1], "DIRECT", F.hbl, true, "UPPER_HALF");
ranks(L.allsvenskan, [2,3,4], "QUALIFY", F.hbl, true, "UPPER_HALF");
ranks(L.allsvenskan, [5,6,7,8,9,10], "RETAIN", F.allsvenskan);
ranks(L.allsvenskan, [11,12], "QUALIFY", F.allsvenskan);
ranks(L.allsvenskan, [13,14], "DIRECT", F.division1);
for (const id of [L.norra, L.sodra]) {
  ranks(id, [1], "DIRECT", F.allsvenskan, true, "UPPER_HALF");
  ranks(id, [2,3], "QUALIFY", F.allsvenskan, true, "UPPER_HALF");
  ranks(id, [4,5,6,7,8], "RETAIN", F.division1);
  ranks(id, [9,10], "QUALIFY", F.division1);
  ranks(id, [11,12], "DIRECT", F.division2);
}
// These are unresolved district entry PORTS, not invented competitions or clubs.
for (const district of ["n", "o", "m", "v", "s"]) {
  for (const rank of [1,2,...(["v", "s"].includes(district) ? [3] : [])]) {
    const slotId = `division2-${district}-${rank}`;
    entries.push({ id: slotId, selector: { kind: "EXTERNAL", slotId, familyId: F.division2 }, purpose: rank === 1 ? "DIRECT" : "QUALIFY", targetFamilyId: F.division1, eligibility: true, replacement: "NONE", source: slots });
  }
}
const entry = (competitionId: string, rank: number): StageEntrant => ({ kind: "ENTRY", entryId: `${competitionId}:rank:${rank}` });
const external = (district: string, rank: number): StageEntrant => ({ kind: "ENTRY", entryId: `division2-${district}-${rank}` });
const winner = (stageId: string): StageEntrant => ({ kind: "WINNER", stageId });
function stage(id: string, a: StageEntrant, b: StageEntrant, format: QualificationStage["format"], homeOrder: QualificationStage["homeOrder"], winnerFamilyId?: string, loserFamilyId?: string, homeReference?: QualificationStage["homeReference"]): QualificationStage {
  return { id, entrants: [a,b], format, homeOrder, homeReference, winnerFamilyId, loserFamilyId, source: paths, ...qualificationScheduling2026(id) };
}
export const SWEDISH_2026_RULES: CompetitionRules = {
  provenance: "OFFICIAL",
  id: "swedish-men-2026-27-v2", seasonId: "2026/27", nextSeasonId: "2027/28", verifiedOn: "2026-11-10",
  families: Object.entries(F).map(([key,id], index) => ({ id, nation: "SWE", category: "MEN", tier: index + 1, boundary: key === "division2" })),
  leagues: [
    { id: L.hbl, familyId: F.hbl, size: 14, legs: 2 },
    { id: L.allsvenskan, familyId: F.allsvenskan, size: 14, legs: 2 },
    { id: L.norra, familyId: F.division1, size: 12, legs: 2 },
    { id: L.sodra, familyId: F.division1, size: 12, legs: 2 },
  ],
  entries,
  stages: [
    ...[11,12,13].map((rank) => stage(`hbl-${rank}`, entry(L.hbl, rank), entry(L.allsvenskan, 15-rank), "BEST_OF_5", [1,0,0,1,0], F.hbl, F.allsvenskan)),
    stage("ha-semi-n", entry(L.norra,2), entry(L.sodra,3), "BEST_OF_3", [1,0,0], undefined, F.division1, "BETTER_SOURCE_RANK"),
    stage("ha-semi-s", entry(L.sodra,2), entry(L.norra,3), "BEST_OF_3", [1,0,0], undefined, F.division1, "BETTER_SOURCE_RANK"),
    stage("ha-final-11", entry(L.allsvenskan,11), winner("ha-semi-n"), "BEST_OF_3", [1,0,0], F.allsvenskan, F.division1),
    stage("ha-final-12", entry(L.allsvenskan,12), winner("ha-semi-s"), "BEST_OF_3", [1,0,0], F.allsvenskan, F.division1),
    stage("d1-n-pre", external("n",2), external("m",2), "TWO_LEG", [0,1], undefined, F.division2),
    stage("d1-n-semi-9", entry(L.norra,9), winner("d1-n-pre"), "BEST_OF_3", [1,0,0], undefined, F.division2),
    stage("d1-n-semi-10", entry(L.norra,10), external("o",2), "BEST_OF_3", null, undefined, F.division2),
    stage("d1-n-final", winner("d1-n-semi-9"), winner("d1-n-semi-10"), "BEST_OF_3", [1,0,0], F.division1, F.division2),
    stage("d1-s-semi-v", external("v",2), external("s",3), "BEST_OF_3", [1,0,0], undefined, F.division2),
    stage("d1-s-semi-s", external("s",2), external("v",3), "BEST_OF_3", [1,0,0], undefined, F.division2),
    stage("d1-s-final-9", entry(L.sodra,9), winner("d1-s-semi-v"), "BEST_OF_3", [1,0,0], F.division1, F.division2),
    stage("d1-s-final-10", entry(L.sodra,10), winner("d1-s-semi-s"), "BEST_OF_3", [1,0,0], F.division1, F.division2),
  ],
  points: { win: 2, draw: 1, loss: 0 }, ranking: "POINTS_GD_GF_MUTUAL_NEUTRAL",
  rankingSource: { url: tb2, section: "§2:7, printed pp.10-11" },
  limitations: [
    { code: "ADMINISTRATIVE_REVIEW_REQUIRED", message: "Ordinary sporting proposal only: withdrawals, vacancies, licensing appeals, cancellation and dated cooperation changes require organizer decisions (THB3 §3:5; TB §§2:3-5,9:4-7).", source: { url: thb3, section: "§§3:2,3:5, printed pp.11-12,14-17" } },
    { code: "NEXT_SEASON_RULES_UNVERIFIED", message: "Qualification destinations concern 2027/28; its competition/calendar profile is not verified. This proposal cannot regenerate a live season.", source: slots },
  ],
};
