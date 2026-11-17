// M8E probe: a headless career that plays the manager's own fixtures and rolls seasons over,
// as the game does. Reports season transitions, fixtures and Handbollsligan matchday revenue.
import { createFullWorldCareer } from "./fullWorldCareer";
import { processDay } from "../../lib/career/dailyTick";
import { addDays } from "../../lib/career/dateUtils";
import { getPlayerFixtureOn } from "../../lib/career/calendar";
import { playManagerFixtureLegacy } from "../../lib/career/legacy/matchday";
import { rolloverSeason } from "../../lib/career/seasonRollover";
import { getClub } from "../../lib/game-data";
let s = createFullWorldCareer("tr-final-a");
let date = s.processedThroughDate;
let rollovers = 0, blocked = 0, played = 0;
const t0 = Date.now();
while (date < "2029-02-01") {
  date = addDays(date, 1);
  s = processDay(s, date).state;
  if (getPlayerFixtureOn(s, date)) { const r = playManagerFixtureLegacy(s); if (r.result) played++; s = r.state; }
  if (s.seasonComplete) {
    try { const before = s.seasonId; s = rolloverSeason(s); if (s.seasonId !== before) rollovers++; } catch (e) { blocked++; if (blocked < 3) console.log("BLOCKED", date, String(e).slice(0, 300)); }
    if (s.gameDate !== date) { console.log("gameDate moved", date, "->", s.gameDate); date = s.gameDate; }
  }
  if (date.endsWith("-01") && ["2027-03-01", "2027-07-01", "2027-10-01", "2028-03-01", "2028-10-01", "2029-01-01"].includes(date)) {
    const hblHome = s.fixtures.filter((f) => f.type === "LEAGUE" && getClub(f.homeClubId)?.competitionId === "se_handbollsligan_herr" && f.date.slice(0, 7) === date.slice(0, 7));
    const kristianstadMatchday = (s.clubFinances?.["se_club_ifk_kristianstad"]?.statements ?? []).slice(-1)[0]?.lines.find((l) => l.category === "MATCHDAY")?.amountEur;
    console.log(date, "season", s.seasonId, "complete", s.seasonComplete, "fixtures", s.fixtures.length, "HBL league fixtures this month", hblHome.length, "rollovers", rollovers, "blocked", blocked, "managerPlayed", played, "Kristianstad last MATCHDAY", kristianstadMatchday, `${Math.round((Date.now() - t0) / 1000)}s`);
  }
}
