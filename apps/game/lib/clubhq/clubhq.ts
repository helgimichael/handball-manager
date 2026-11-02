// HM-ALPHA3-M09 (9D): "Klubbhuset" -- the club's home and identity in one
// place. The building follows the club's economic band (a modest hall, a
// professional hall with an office wing, an arena); each room leads to the
// screen that already runs that part of the club. Everything shown is read
// from the career: identity, the stands' mood, rivals, honours and the
// national team's calendar.
import type { CareerState } from "../career/types";
import { getCareerClub, getCareerSquad } from "../career/careerWorld";
import { clubCompetitionId } from "../career/competitionMembership";
import { getClubEconomyBaseline } from "../economy/clubEconomyIntegration";
import { venueCapacity } from "../economy/ledger";
import type { EconomicBand } from "../economy/clubEconomyTypes";
import { competitionClubIds } from "../competition/tables";
import { clubMedia } from "../media/registry";
import { mediaOf, rivalryBetween } from "../media/people";
import { activeSuspension } from "../media/discipline";
import { nationalTeamOf, ownCallUps, upcomingWindows, type NationalWindow, type NationalWindowState } from "../nationalTeam/nationalTeam";

export type HqTier = "local" | "pro" | "elite";
export const TIER_LABEL: Record<HqTier, string> = { local: "Föreningens hall", pro: "Professionell anläggning", elite: "Arena i toppklass" };

export function hqTier(band: EconomicBand | undefined): HqTier {
  return band === "E1" || band === "E2" ? "elite" : band === "E3" || band === "E4" ? "pro" : "local";
}

/** The stands' mood in words (supporters −50..50). */
export function supporterLabel(score: number): string {
  return score >= 20 ? "Euforisk" : score >= 8 ? "Positiv" : score > -8 ? "Avvaktande" : score > -20 ? "Missnöjd" : "Upprörd";
}

export interface HqRoom { id: string; name: string; purpose: string; href: string; status?: string }

export interface ClubHq {
  clubId: string;
  name: string;
  town: string;
  venue?: string;
  capacity: number | null;
  founded?: number;
  colors: { primary?: string; secondary?: string };
  band?: EconomicBand;
  tier: HqTier;
  supporters: { score: number; label: string };
  rivals: { clubId: string; score: number; reasons: string[] }[];
  honours: { seasonId: string; text: string }[];
  rooms: HqRoom[];
  national: { upcoming: { window: NationalWindow; state?: NationalWindowState; own: string[] }[]; last?: { window: NationalWindow; state: NationalWindowState; own: string[] } };
}

export function clubHq(state: CareerState): ClubHq {
  const club = getCareerClub(state);
  const me = club.id;
  const baseline = getClubEconomyBaseline(state, me);
  const media = mediaOf(state);
  const comp = clubCompetitionId(state, me);
  const others = (comp ? competitionClubIds(state, comp) : []).filter((id) => id !== me);
  const rivals = others.map((id) => ({ clubId: id, ...rivalryBetween(state, me, id) })).filter((r) => r.score >= 20).sort((a, b) => b.score - a.score).slice(0, 3).map((r) => ({ clubId: r.clubId, score: r.score, reasons: r.reasons }));
  const honours: ClubHq["honours"] = [];
  for (const h of state.seasonHistory ?? []) {
    const o = h.outcome;
    if (!o) continue;
    if (o.champion === me) honours.push({ seasonId: h.seasonId, text: "Svenska mästare" });
    if (o.cupWinner === me) honours.push({ seasonId: h.seasonId, text: "Svenska cupen" });
    if (o.promoted.includes(me)) honours.push({ seasonId: h.seasonId, text: "Uppflyttning" });
  }
  const squad = getCareerSquad(state);
  const injured = squad.filter((p) => state.playerInjuries[p.id]?.activeInjury).length;
  const openPress = Object.values(media.press).filter((p) => p.status === "OPEN").length;
  const suspended = activeSuspension(state);
  const rooms: HqRoom[] = [
    { id: "office", name: "Kansliet", purpose: "Budget, intäkter och kassa", href: "/career/finance" },
    { id: "board", name: "Styrelserummet", purpose: "Mål, förtroende och möten", href: "/career/board" },
    { id: "dressing", name: "Omklädningsrummet", purpose: "Truppen, roller och stämning", href: "/career/squad", status: `${squad.length} spelare` },
    { id: "hall", name: "Träningshallen", purpose: "Veckans träning och belastning", href: "/career/training" },
    { id: "tactics", name: "Taktikrummet", purpose: "Matchplan och analys", href: "/career/tactics" },
    { id: "medical", name: "Medicinska rummet", purpose: "Skador och rehab", href: "/career/medical", status: injured ? `${injured} skadade` : "Inga skador" },
    { id: "scouting", name: "Scoutkontoret", purpose: "Scouting och rekrytering", href: "/career/scouting" },
    { id: "press", name: "Pressrummet", purpose: "Nyheter, presskonferenser och rivaler", href: "/career/media", status: suspended ? "Avstängd" : openPress ? `${openPress} väntar` : undefined },
    { id: "staff", name: "Ledarrummet", purpose: "Personal och ansvarsfördelning", href: "/career/staff" },
    { id: "trophies", name: "Prisskåpet", purpose: "Säsonger och historik", href: "/career/history", status: honours.length ? `${honours.length} meriter` : undefined },
  ];
  const nt = nationalTeamOf(state);
  const upcoming = upcomingWindows(state, 2).map((w) => ({ window: w, state: nt.windows[w.id], own: ownCallUps(state, w.id) }));
  const doneIds = Object.entries(nt.windows).filter(([, s]) => s.status !== "CALLED").map(([id]) => id);
  const lastId = doneIds.at(-1);
  const lastWindow = upcomingWindows({ ...state, gameDate: "0000-00-00" }, 99).find((w) => w.id === lastId);
  return {
    clubId: me,
    name: club.name,
    town: clubMedia(me)?.town ?? club.city ?? "",
    venue: club.venue,
    capacity: baseline ? venueCapacity(state, me, baseline) : null,
    founded: club.founded,
    colors: { primary: club.primaryColor, secondary: club.secondaryColor },
    band: baseline?.band,
    tier: hqTier(baseline?.band),
    supporters: { score: media.supporters, label: supporterLabel(media.supporters) },
    rivals,
    honours,
    rooms,
    national: { upcoming, last: lastWindow && lastId ? { window: lastWindow, state: nt.windows[lastId]!, own: ownCallUps(state, lastId) } : undefined },
  };
}
