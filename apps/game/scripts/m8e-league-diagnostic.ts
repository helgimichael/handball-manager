// HM-TRANSFER-REALISM M8E: why does Allsvenskan overtake Handbollsligan?
//
// OBSERVATION ONLY. Runs N seasons of the full world and then inspects, on the
// final state: every Handbollsligan club (squad, core level, age, finances,
// transfer budget) and the strongest Allsvenskan players (age, CA, contract,
// wage, whether each HBL club with a need at his position ranks him, his
// fee against that club's budget, and whether he would accept).
//
// Usage: npx tsx scripts/m8e-league-diagnostic.ts --seasons 6 --seed tr-final-a --out <file.json>
import * as fs from "node:fs";
import { processDay } from "../lib/career/dailyTick";
import { addDays } from "../lib/career/dateUtils";
import { getClub } from "../lib/game-data";
import { clubCompetitionId } from "../lib/career/competitionMembership";
import { careerWorldClubIds } from "../lib/career/worldCompetitions";
import { playerAgeAtDate } from "../lib/development/developmentIntegration";
import { getPlayerContract, getPlayerMarketValueEur } from "../lib/economy/contractIntegration";
import { getClubBudgets, getClubFinancialHealth } from "../lib/economy/clubEconomyIntegration";
import { assessSquadNeeds } from "../lib/career/cpuSquadNeeds";
import { ownLevelScore, rankCandidates } from "../lib/career/cpuCandidateEvaluation";
import { acceptanceEstimate, playerCareerProfile } from "../lib/transfers/careerDecision/stateAdapter";
import { getSellingClubAskingPriceEur } from "../lib/transfers/transferIntegration";
import { createFullWorldCareer } from "./lib/fullWorldCareer";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const seasons = Number(arg("seasons", "6"));
const seed = arg("seed", "tr-final-a");
const out = arg("out", "");
const r1 = (x: number) => Math.round(x * 10) / 10;

let state = createFullWorldCareer(seed);
let date = state.gameDate;
for (let s = 1; s <= seasons; s++) {
  for (let d = 0; d < 365; d++) { date = addDays(date, 1); state = processDay(state, date).state; }
  console.log(`S${s} ${date}`);
}
// Inspect at the start of the next summer window, when clubs recruit.
while (date.slice(5) !== "06-10") { date = addDays(date, 1); state = processDay(state, date).state; }

const league = (id: string) => clubCompetitionId(state, id) ?? "";
const hbl = careerWorldClubIds(state).filter((id) => league(id) === "se_handbollsligan_herr" && id !== state.playerClubId);
const allsv = careerWorldClubIds(state).filter((id) => league(id) === "swe-2");

const clubs = hbl.map((id) => {
  const ratings = (state.gameplayRatings[id] ?? []).map((r) => r.ca).sort((a, b) => b - a);
  const ages = (state.worldSquads[id] ?? []).map((p) => playerAgeAtDate(p.dateOfBirth, p.birthYear, date) ?? 0);
  const budgets = getClubBudgets(state, id);
  const needs = assessSquadNeeds(state, id, date).positions.filter((p) => p.level === "HIGH" || p.level === "MEDIUM").map((p) => p.position);
  return { clubId: id, name: getClub(id)?.name, squad: ratings.length, ownLevel: r1(ownLevelScore(state, id)), top7: ratings.slice(0, 7).map(Math.round), medianAge: ages.sort((a, b) => a - b)[Math.floor(ages.length / 2)], pressure: getClubFinancialHealth(state, id)?.pressure, transferBudget: budgets?.transferBudgetEur, wageBudget: budgets?.wageBudgetEur, cash: state.clubEconomies[id]?.cashEur, needs };
});

const best = allsv.flatMap((id) => (state.gameplayRatings[id] ?? []).map((r) => ({ id: r.playerId, ca: r.ca, clubId: id }))).sort((a, b) => b.ca - a.ca).slice(0, 25);
const players = best.map((b) => {
  const p = state.worldSquads[b.clubId].find((x) => x.id === b.id)!;
  const contract = getPlayerContract(state, b.id);
  const ranked = hbl.map((h) => {
    const need = assessSquadNeeds(state, h, date).positions.find((x) => x.position === p.position)?.level ?? "NONE";
    const list = rankCandidates(state, h, p.position, date, { exhaustive: true });
    const idx = list.findIndex((c) => c.playerId === b.id);
    const c = idx >= 0 ? list[idx] : undefined;
    return { club: h, need, rank: idx, listSize: list.length, affordable: c?.affordable ?? null, fee: c?.estimatedFeeEur ?? null, wage: c?.estimatedWageEurPerMonth ?? null, accept: r1(acceptanceEstimate(state, b.id, h, { wageEurPerMonth: c?.estimatedWageEurPerMonth ?? contract?.wageEurPerMonth ?? 0, contractYears: 3 })) };
  });
  return {
    id: b.id, name: `${p.firstName} ${p.lastName}`, position: p.position, ca: r1(b.ca), age: playerAgeAtDate(p.dateOfBirth, p.birthYear, date), club: getClub(b.clubId)?.name,
    wage: contract?.wageEurPerMonth, contractEnd: contract?.contractEndDate, ref: r1(playerCareerProfile(state, b.id)?.referenceWageEurPerMonth ?? 0),
    marketValue: getPlayerMarketValueEur(state, b.id), askingPrice: getSellingClubAskingPriceEur(state, b.id),
    hblWithNeed: ranked.filter((r) => r.need === "HIGH" || r.need === "MEDIUM").length,
    hblRankedHim: ranked.filter((r) => r.rank >= 0).length,
    hblRankedAffordable: ranked.filter((r) => r.rank >= 0 && r.affordable).length,
    hblTopThree: ranked.filter((r) => r.rank >= 0 && r.rank < 3).length,
    hblWouldAccept: ranked.filter((r) => r.accept >= 0.5).length,
    detail: ranked,
  };
});

for (const c of clubs) console.log("HBL", c.name, "squad", c.squad, "lvl", c.ownLevel, "top7", c.top7.join(","), "age", c.medianAge, c.pressure, "tb", c.transferBudget, "wb", c.wageBudget, "cash", c.cash, "needs", c.needs.join(","));
for (const p of players) console.log("ALLSV", p.name, p.position, p.ca, "age", p.age, p.club, "wage", p.wage, "ref", p.ref, "end", p.contractEnd, "MV", p.marketValue, "ask", Math.round(p.askingPrice ?? 0), "| HBL need", p.hblWithNeed, "ranked", p.hblRankedHim, "affordable", p.hblRankedAffordable, "top3", p.hblTopThree, "accept", p.hblWouldAccept);
if (out) fs.writeFileSync(out, JSON.stringify({ seed, seasons, date, clubs, players }, null, 2));
