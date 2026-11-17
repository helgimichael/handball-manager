// M8C probe: which underpaid elite Allsvenskan players would accept the strongest Division 1 club on a small raise?
import { createFullWorldCareer } from "./fullWorldCareer";
import { marketWageFactor, playerDecisionOnMove } from "../../lib/transfers/careerDecision/stateAdapter";
import { getPlayerFairWageEurPerMonth } from "../../lib/economy/contractIntegration";
import { careerWorldClubIds } from "../../lib/career/worldCompetitions";
import { clubCompetitionId } from "../../lib/career/competitionMembership";
import { environmentLevelOf } from "../../lib/transfers/careerDecision/sportingStrength";
const base = createFullWorldCareer("m8c-underpaid");
const div1 = careerWorldClubIds(base).filter((id) => (clubCompetitionId(base, id) ?? "").startsWith("se_division1")).sort((a, b) => environmentLevelOf(base, b) - environmentLevelOf(base, a));
console.log("strongest div1", div1[0], environmentLevelOf(base, div1[0]).toFixed(1));
let n = 0, acc = 0;
for (const id of careerWorldClubIds(base).filter((c) => clubCompetitionId(base, c) === "swe-2")) {
  for (const r of base.gameplayRatings[id] ?? []) {
    if (r.ca < 128) continue;
    const market = (getPlayerFairWageEurPerMonth(base, r.playerId) ?? 0) * marketWageFactor(base);
    const stale = Math.max(200, Math.round(market * 0.2));
    const s = { ...base, playerContracts: { ...base.playerContracts, [r.playerId]: { ...base.playerContracts[r.playerId], wageEurPerMonth: stale } } };
    const d = playerDecisionOnMove(s, r.playerId, div1[0], { wageEurPerMonth: Math.round(stale * 1.25), contractYears: 3 });
    n++; if (d.accept) { acc++; console.log("ACCEPT", r.playerId, r.ca, id, environmentLevelOf(base, id).toFixed(1)); }
  }
}
console.log("n", n, "accepted", acc);
