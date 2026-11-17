// M8E probe: which league fixtures stay unplayed and block season completion?
import { createFullWorldCareer } from "./fullWorldCareer";
import { processDay } from "../../lib/career/dailyTick";
import { addDays } from "../../lib/career/dateUtils";
import { getPlayerFixtureOn } from "../../lib/career/calendar";
import { playManagerFixtureLegacy } from "../../lib/career/legacy/matchday";
let s = createFullWorldCareer("tr-final-a");
let date = s.gameDate;
console.log("start", date, "processedThrough", s.processedThroughDate);
while (date < "2027-07-01") {
  date = addDays(date, 1);
  s = processDay(s, date).state;
  if (getPlayerFixtureOn(s, date)) s = playManagerFixtureLegacy(s).state;
}
const un = s.fixtures.filter((f) => f.type === "LEAGUE" && !s.results[f.id]);
console.log("unplayed", un.length, un.slice(0, 12).map((f) => `${f.date} ${f.homeClubId} v ${f.awayClubId} ${f.competitionId}`));
console.log("outcome", s.seasonOutcome?.phase, s.seasonOutcome?.seasonId, "seasonId", s.seasonId, "competitionId", s.competitionId);
