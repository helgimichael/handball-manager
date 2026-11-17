// M8B probe: one purchase pass on a fresh full world (read-only).
import { createFullWorldCareer } from "./fullWorldCareer";
import { progressInternationalMarket } from "../../lib/transfers/internationalMarket";
import { getClub } from "../../lib/game-data";
import { getCareerPlayer } from "../../lib/career/careerWorld";
import { environmentLevelOf } from "../../lib/transfers/careerDecision/sportingStrength";
import { playerCareerProfile } from "../../lib/transfers/careerDecision/stateAdapter";
const d = "2026-09-03";
const s = { ...createFullWorldCareer("m8b-probe"), gameDate: d };
const { log } = progressInternationalMarket(s, d);
const counts: Record<string, number> = {};
for (const e of log) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
console.log(counts);
for (const e of log.filter((x) => x.kind !== "RENEWAL_REFUSED" && x.kind !== "RENEWED").slice(0, 40)) {
  const p = getCareerPlayer(s, e.playerId);
  const prof = playerCareerProfile(s, e.playerId);
  console.log(e.kind, p?.firstName, p?.lastName, "age", prof?.age, "CA", prof?.ca, getClub(e.fromClubId ?? "")?.name, Math.round(environmentLevelOf(s, e.fromClubId ?? "")), "->", getClub(e.clubId)?.name, Math.round(environmentLevelOf(s, e.clubId)), "fee", e.feeEur, "wage", e.wageEurPerMonth);
}
