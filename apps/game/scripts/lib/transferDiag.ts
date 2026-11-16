// HM-TRANSFER-REALISM-1.0: short diagnostic run -- offer outcomes, renewal wage drift, financial pressure, timing.
import { createFullWorldCareer } from "./fullWorldCareer";
import { processDay } from "../../lib/career/dailyTick";
import { addDays } from "../../lib/career/dateUtils";
import { careerWorldClubIds } from "../../lib/career/worldCompetitions";
import { getClubFinancialHealth, getClubBudgets, getClubPlayerWageCostsEurAnnual } from "../../lib/economy/clubEconomyIntegration";
const days = Number(process.argv[2] ?? 60);
let s = createFullWorldCareer("diag");
const swe = () => careerWorldClubIds(s).filter((c) => c !== s.playerClubId);
const press = () => { const c: Record<string, number> = {}; for (const id of swe()) { const p = getClubFinancialHealth(s, id)?.pressure ?? "?"; c[p] = (c[p] ?? 0) + 1; } return c; };
const overBudget = () => swe().filter((id) => { const b = getClubBudgets(s, id); return b && getClubPlayerWageCostsEurAnnual(s, id) > b.wageBudgetEur; }).length;
console.log("start", s.gameDate, JSON.stringify(press()), "overBudget", overBudget());
const wages0 = new Map(Object.values(s.playerContracts).map((c) => [c.playerId, c]));
let date = s.gameDate; const t0 = Date.now(); const tick: number[] = [];
for (let d = 0; d < days; d++) { date = addDays(date, 1); const t = Date.now(); s = processDay(s, date).state; tick.push(Date.now() - t); }
const offers = Object.values(s.transferOffers);
const by: Record<string, number> = {}; for (const o of offers) by[o.status] = (by[o.status] ?? 0) + 1;
const reasons: Record<string, number> = {}; for (const o of offers) { const r = (o.playerDecisionReason ?? o.clubDecisionReason ?? "").slice(0, 70); reasons[`${o.status}: ${r}`] = (reasons[`${o.status}: ${r}`] ?? 0) + 1; }
let n = 0, ratio = 0; for (const c of Object.values(s.playerContracts)) { const w = wages0.get(c.playerId); if (w && w.clubId === c.clubId && c.contractEndDate > w.contractEndDate && w.wageEurPerMonth > 0) { n++; ratio += c.wageEurPerMonth / w.wageEurPerMonth; } }
console.log("end", date, JSON.stringify(press()), "overBudget", overBudget(), "ms/day avg", Math.round((Date.now() - t0) / days), "max", Math.max(...tick));
console.log("offers", JSON.stringify(by));
console.log(Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${v}  ${k}`).join("\n"));
console.log("renewals", n, "avg wage ratio", (ratio / Math.max(1, n)).toFixed(3));
const sweSet = new Set(swe()); const rs: number[] = [];
for (const c of Object.values(s.playerContracts)) { const w = wages0.get(c.playerId); if (w && w.clubId === c.clubId && sweSet.has(c.clubId) && c.contractEndDate > w.contractEndDate && w.wageEurPerMonth > 0) rs.push(c.wageEurPerMonth / w.wageEurPerMonth); }
rs.sort((a, b) => a - b);
console.log("swedish renewals", rs.length, "mean", (rs.reduce((a, b) => a + b, 0) / Math.max(1, rs.length)).toFixed(3), "p50", rs[Math.floor(rs.length / 2)]?.toFixed(3), "p90", rs[Math.floor(rs.length * 0.9)]?.toFixed(3));
const exp = Object.values(s.worldSquads[""] ?? []).length; console.log("free agents", exp);
const plans = Object.values(s.cpuRecruitmentPlans); const pr: Record<string, number> = {}; for (const p of plans) pr[p.reason.slice(0, 50)] = (pr[p.reason.slice(0, 50)] ?? 0) + 1;
console.log("plans", JSON.stringify(pr));
const logCount: Record<string, number> = {};
for (const e of s.cpuDecisionLog) if (e.category === "CONTRACT") { const k = `${e.summary.split(" ")[0]} ${e.reason.slice(0, 60)}`; logCount[k] = (logCount[k] ?? 0) + 1; }
console.log(Object.entries(logCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${v}  ${k}`).join(" | "));
