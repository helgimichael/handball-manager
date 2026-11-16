// HM-TRANSFER-REALISM-1.0: who are the world-class players in Division 1, and how did they get there?
import { createFullWorldCareer } from "./fullWorldCareer";
import { processDay } from "../../lib/career/dailyTick";
import { addDays } from "../../lib/career/dateUtils";
import { clubCompetitionId } from "../../lib/career/competitionMembership";
import { playerAgeAtDate } from "../../lib/development/developmentIntegration";
const seasons = Number(process.argv[2] ?? 6);
const seed = process.argv[3] ?? "tr-final-b";
let s = createFullWorldCareer(seed);
const cas = Object.entries(s.worldSquads).filter(([c]) => c !== "" && c !== "retired").flatMap(([c]) => (s.gameplayRatings[c] ?? []).map((r) => r.ca)).sort((a, b) => a - b);
const WC = cas[Math.floor(0.97 * (cas.length - 1))]!;
console.log("WC bar", WC);
let date = s.gameDate;
for (let season = 1; season <= seasons; season++) {
  for (let d = 0; d < 365; d++) { date = addDays(date, 1); s = processDay(s, date).state; }
  for (const [clubId, squad] of Object.entries(s.worldSquads)) {
    if (!(clubCompetitionId(s, clubId) ?? "").startsWith("se_division1")) continue;
    for (const p of squad) {
      const r = s.gameplayRatings[clubId]?.find((x) => x.playerId === p.id);
      if (!r || r.ca < WC) continue;
      const hist = s.playerClubHistory[p.id]?.entries.map((e) => e.clubId).join(">") ?? "";
      console.log(`S${season} ${p.id} age ${playerAgeAtDate(p.dateOfBirth, p.birthYear, date)} ca ${r.ca} pa ${r.pa} club ${clubId} contractEnd ${s.playerContracts[p.id]?.contractEndDate} wage ${s.playerContracts[p.id]?.wageEurPerMonth} history ${hist}`);
    }
  }
}
