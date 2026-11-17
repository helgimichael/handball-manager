// M8C probe: how far below the market reference do contracted players earn (by CA band)?
import { createFullWorldCareer } from "./fullWorldCareer";
import { getPlayerFairWageEurPerMonth } from "../../lib/economy/contractIntegration";
import { marketWageFactor, playerCAInWorld } from "../../lib/transfers/careerDecision/stateAdapter";
import { getClub } from "../../lib/game-data";
const s = createFullWorldCareer("m8c-wage");
const f = marketWageFactor(s);
const bands: Record<string, number[]> = {};
for (const c of Object.values(s.playerContracts)) {
  if (c.wageEurPerMonth <= 0 || !getClub(c.clubId)) continue;
  const fair = getPlayerFairWageEurPerMonth(s, c.playerId);
  const ca = playerCAInWorld(s, c.playerId)?.ca;
  if (!fair || !ca) continue;
  const band = ca >= 140 ? "140+" : ca >= 125 ? "125-139" : ca >= 110 ? "110-124" : "<110";
  (bands[band] ??= []).push(c.wageEurPerMonth / (fair * f));
}
console.log("marketWageFactor", f.toFixed(3));
for (const [b, xs] of Object.entries(bands)) {
  xs.sort((a, b) => a - b);
  const q = (p: number) => xs[Math.floor(p * (xs.length - 1))].toFixed(2);
  console.log(b, "n", xs.length, "p10", q(0.1), "p25", q(0.25), "p50", q(0.5), "p75", q(0.75), "share<0.6", (xs.filter((x) => x < 0.6).length / xs.length).toFixed(2), "share<0.5", (xs.filter((x) => x < 0.5).length / xs.length).toFixed(2));
}
