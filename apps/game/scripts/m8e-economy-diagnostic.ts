// HM-TRANSFER-REALISM M8E: where does Swedish clubs' money go?
//
// OBSERVATION ONLY. Runs N seasons of the full world and, at every season end,
// sums each Swedish CPU club's last 12 monthly statements by ledger category
// (recurring lines + one-off transactions), averaged per club per league, plus
// squad size and the number of players on each club's payroll. Runs unchanged
// on older commits (it only reads the ledger), so the same numbers can be
// produced for the baseline.
//
// Usage: npx tsx scripts/m8e-economy-diagnostic.ts --seasons 6 --seed tr-final-a --out <file.json>
import * as fs from "node:fs";
import { processDay } from "../lib/career/dailyTick";
import { addDays } from "../lib/career/dateUtils";
import { clubCompetitionId } from "../lib/career/competitionMembership";
import { careerWorldClubIds } from "../lib/career/worldCompetitions";
import { getClubFinancialHealth } from "../lib/economy/clubEconomyIntegration";
import { createNewCareerState } from "../lib/career/newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../lib/gameWorld/serverSnapshot";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../lib/career/worldCompetitions";
import { WORLD_POOL_COMPETITION_IDS } from "../lib/career/careerWorld";
import type { CareerState } from "../lib/career/types";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const seasons = Number(arg("seasons", "6"));
const seed = arg("seed", "tr-final-a");
const out = arg("out", "");

const worldSquads: Record<string, never[]> = {};
const gameplayRatings: Record<string, never[]> = {};
for (const id of [...SWEDISH_WORLD_COMPETITION_IDS, ...WORLD_POOL_COMPETITION_IDS]) {
  Object.assign(worldSquads, snapshotWorldSquads(id));
  Object.assign(gameplayRatings, snapshotGameplayRatings(id));
}
let state: CareerState = createNewCareerState(seed, "se_club_hammarby_if_hf", worldSquads as never, {}, gameplayRatings as never);
let date = state.gameDate;
const group = (id: string) => {
  const c = clubCompetitionId(state, id) ?? "";
  return c === "se_handbollsligan_herr" ? "HBL" : c === "swe-2" ? "ALLSV" : c.startsWith("se_division1") ? "DIV1" : "OTHER";
};
const rows: unknown[] = [];
for (let s = 1; s <= seasons; s++) {
  for (let d = 0; d < 365; d++) { date = addDays(date, 1); state = processDay(state, date).state; }
  const byGroup: Record<string, { clubs: number; squad: number; cash: number; pressured: number; lines: Record<string, number> }> = {};
  for (const clubId of careerWorldClubIds(state)) {
    if (clubId === state.playerClubId) continue;
    const g = group(clubId);
    const e = (byGroup[g] ??= { clubs: 0, squad: 0, cash: 0, pressured: 0, lines: {} });
    e.clubs++;
    e.squad += (state.worldSquads[clubId] ?? []).length;
    e.cash += state.clubEconomies[clubId]?.cashEur ?? 0;
    const p = getClubFinancialHealth(state, clubId)?.pressure;
    if (p === "PRESSURED" || p === "SERIOUS" || p === "CRITICAL") e.pressured++;
    for (const st of (state.clubFinances?.[clubId]?.statements ?? []).slice(-12)) {
      for (const l of st.lines) e.lines[l.category] = (e.lines[l.category] ?? 0) + l.amountEur;
      for (const t of st.transactions) e.lines[t.category] = (e.lines[t.category] ?? 0) + t.amountEur;
    }
  }
  const summary: Record<string, unknown> = {};
  for (const [g, e] of Object.entries(byGroup)) {
    const per = (x: number) => Math.round(x / e.clubs);
    summary[g] = { clubs: e.clubs, squadMean: Math.round((10 * e.squad) / e.clubs) / 10, cashMean: per(e.cash), pressured: e.pressured, perClubAnnual: Object.fromEntries(Object.entries(e.lines).map(([k, v]) => [k, per(v)])) };
  }
  rows.push({ season: s, date, summary });
  console.log(`S${s} ${date}`);
  for (const [g, v] of Object.entries(summary)) console.log("  ", g, JSON.stringify(v));
  if (out) fs.writeFileSync(out, JSON.stringify({ seed, rows }, null, 2));
}
