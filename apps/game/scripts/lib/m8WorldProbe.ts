// HM-TRANSFER-REALISM M8: read-only probe of the world pool at career start.
import { createFullWorldCareer } from "./fullWorldCareer";
import { worldPoolClubIds, clubLevelOf, leagueLevelOf } from "../../lib/transfers/careerDecision/sportingStrength";
import { clubCompetitionId } from "../../lib/career/competitionMembership";
import { playerAgeAtDate } from "../../lib/development/developmentIntegration";
import { getClub } from "../../lib/game-data";

const s = createFullWorldCareer("m8-probe");
const byComp: Record<string, { clubs: number; players: number; cas: number[]; ages: number[]; nats: Record<string, number> }> = {};
for (const clubId of worldPoolClubIds(s)) {
  const comp = clubCompetitionId(s, clubId) ?? "?";
  const e = (byComp[comp] ??= { clubs: 0, players: 0, cas: [], ages: [], nats: {} });
  e.clubs++;
  const ratings = new Map((s.gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r]));
  for (const p of s.worldSquads[clubId] ?? []) {
    e.players++;
    const r = ratings.get(p.id);
    if (r) e.cas.push(r.ca);
    const a = playerAgeAtDate(p.dateOfBirth, p.birthYear, s.gameDate);
    if (a !== null) e.ages.push(a);
    e.nats[p.nationality] = (e.nats[p.nationality] ?? 0) + 1;
  }
}
const med = (xs: number[]) => { const t = [...xs].sort((a, b) => a - b); return t.length ? t[Math.floor(t.length / 2)] : NaN; };
for (const [comp, e] of Object.entries(byComp)) {
  console.log(comp, "clubs", e.clubs, "players", e.players, "caMed", med(e.cas), "caMax", Math.max(...e.cas), "ageMed", med(e.ages), "ageMin", Math.min(...e.ages), "ageMax", Math.max(...e.ages), "lvl", leagueLevelOf(s, comp), JSON.stringify(e.nats));
}
for (const clubId of worldPoolClubIds(s).slice(0, 8)) console.log(clubId, getClub(clubId)?.name, (s.worldSquads[clubId] ?? []).length, clubLevelOf(s, clubId));
console.log("date", s.gameDate, "total", Object.values(byComp).reduce((a, e) => a + e.players, 0));
