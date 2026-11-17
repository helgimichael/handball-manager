// M8E probe: do Handbollsligan home fixtures exist and get results after season 1?
import { createFullWorldCareer } from "./fullWorldCareer";
import { processDay } from "../../lib/career/dailyTick";
import { addDays } from "../../lib/career/dateUtils";
import { getClub } from "../../lib/game-data";
let s = createFullWorldCareer("tr-final-a");
let date = s.gameDate;
const report = () => {
  const byMonth: Record<string, { league: number; withResult: number }> = {};
  for (const f of s.fixtures) {
    if (f.type !== "LEAGUE") continue;
    const comp = getClub(f.homeClubId)?.competitionId;
    if (comp !== "se_handbollsligan_herr") continue;
    const m = f.date.slice(0, 7);
    const e = (byMonth[m] ??= { league: 0, withResult: 0 });
    e.league++;
    if (s.results[f.id]) e.withResult++;
  }
  console.log(date, "fixtures total", s.fixtures.length, JSON.stringify(byMonth));
};
while (date < "2028-03-01") {
  date = addDays(date, 1);
  s = processDay(s, date).state;
  if (date.endsWith("-01") && ["2027-03-01", "2027-07-01", "2027-10-01", "2028-01-01", "2028-03-01"].includes(date)) report();
}
