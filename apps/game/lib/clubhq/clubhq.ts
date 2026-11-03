// HM-ALPHA3-M09 (9D) + HM-RICH-EXPERIENCE-02: "Klubbhuset" -- the club's
// interactive visual headquarters and architectural world.
import type { CareerState } from "../career/types";
import { getCareerClub, getCareerSquad } from "../career/careerWorld";
import { clubCompetitionId } from "../career/competitionMembership";
import { getClubEconomyBaseline, getClubEconomySnapshot } from "../economy/clubEconomyIntegration";
import { venueCapacity } from "../economy/ledger";
import { formatMoney } from "../economy/currency";
import type { EconomicBand } from "../economy/clubEconomyTypes";
import { competitionClubIds } from "../competition/tables";
import { clubMedia } from "../media/registry";
import { mediaOf, rivalryBetween } from "../media/people";
import { activeSuspension } from "../media/discipline";
import { nationalTeamOf, ownCallUps, upcomingWindows, type NationalWindow, type NationalWindowState } from "../nationalTeam/nationalTeam";
import { getNextPlayerFixture } from "../career/calendar";
import { managementAttention, squadEnergy } from "../career/management";
import { matchFitnessOf } from "../players/matchFitness";
import { currentTeamRoles } from "../career/teamRoles";
import { boardOf, ensureBoard } from "../board/board";
import { mondayOf, resolveTrainingWeek } from "../training/trainingSchedule";
import { getClub } from "../game-data";
import type { EnvironmentId } from "@/components/clubhq/environments";

export type HqTier = "local" | "pro" | "elite";
export const TIER_LABEL: Record<HqTier, string> = {
  local: "Föreningens hall",
  pro: "Professionell anläggning",
  elite: "Arena i toppklass",
};

export function hqTier(band: EconomicBand | undefined): HqTier {
  return band === "E1" || band === "E2" ? "elite" : band === "E3" || band === "E4" ? "pro" : "local";
}

/** The stands' mood in words (supporters −50..50). */
export function supporterLabel(score: number): string {
  return score >= 20 ? "Euforisk" : score >= 8 ? "Positiv" : score > -8 ? "Avvaktande" : score > -20 ? "Missnöjd" : "Upprörd";
}

export interface HqRoomMetric {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}

export interface HqRoomZone {
  x: number;
  y: number;
  w: number;
  h: number;
  wing: string;
}

export interface HqRoom {
  id: string;
  name: string;
  purpose: string;
  href: string;
  status?: string;
  environment: EnvironmentId;
  summary: string;
  alertTone: "ok" | "warn" | "bad" | "neutral";
  metrics: HqRoomMetric[];
  zone: HqRoomZone;
  secondaryHref?: string;
  secondaryLabel?: string;
}

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
  national: {
    upcoming: { window: NationalWindow; state?: NationalWindowState; own: string[] }[];
    last?: { window: NationalWindow; state: NationalWindowState; own: string[] };
  };
}

export function clubHq(state: CareerState): ClubHq {
  const club = getCareerClub(state);
  const me = club.id;
  const baseline = getClubEconomyBaseline(state, me);
  const economy = getClubEconomySnapshot(state, me);
  const media = mediaOf(state);
  const comp = clubCompetitionId(state, me);
  const others = (comp ? competitionClubIds(state, comp) : []).filter((id) => id !== me);
  const rivals = others
    .map((id) => ({ clubId: id, ...rivalryBetween(state, me, id) }))
    .filter((r) => r.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => ({ clubId: r.clubId, score: r.score, reasons: r.reasons }));

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
  const unreadInbox = state.inbox.filter((m) => !m.archived && !m.read).length;
  const nextFixture = getNextPlayerFixture(state);
  const nextOpponentId = nextFixture ? (nextFixture.homeClubId === me ? nextFixture.awayClubId : nextFixture.homeClubId) : undefined;
  const nextOpponentName = nextOpponentId ? (getClub(nextOpponentId)?.shortName ?? nextOpponentId) : "Ingen bokad";
  const attention = managementAttention(state);
  const avgEnergy = squad.length ? Math.round(squad.reduce((acc, p) => acc + squadEnergy(state, p), 0) / squad.length) : 100;
  const avgFitness = squad.length ? Math.round(squad.reduce((acc, p) => acc + matchFitnessOf(state, p.id), 0) / squad.length) : 100;
  const roles = currentTeamRoles(state);
  const captain = roles.captainId ? squad.find((p) => p.id === roles.captainId) : undefined;
  const activePlan = nextFixture ? state.matchPlans?.[nextFixture.id] : undefined;
  const matchSquadCount = activePlan ? activePlan.squad.players.length : Math.min(16, squad.length - attention.unavailable.length);
  const defShape = activePlan?.defencePlan.baseFormation === "5-1" ? "5–1 offensivt" : "6–0 basförsvar";
  const tempoLabel = activePlan?.attackPlan.tempo === "FAST" ? "Högt tempo" : activePlan?.attackPlan.tempo === "SLOW" ? "Kontrollerat" : "Balanserat";
  const staffList = state.staffRoster?.[me] ?? [];
  const boardState = boardOf(state) ? state : ensureBoard(state, state.gameDate);
  const boardConfidence = boardState.board?.confidence ?? 65;
  const week = resolveTrainingWeek(state, mondayOf(state.gameDate));
  const totalSessions = week.days.reduce((sum, d) => sum + d.sessions.length, 0);

  const rooms: HqRoom[] = [
    {
      id: "manager",
      name: "Managerns kontor",
      purpose: "Inkorg, nästa match och dagliga beslut",
      href: "/career/inbox",
      secondaryHref: "/career",
      secondaryLabel: "Till Hem-översikten →",
      status: unreadInbox ? `${unreadInbox} olästa` : `Nästa: ${nextOpponentName}`,
      environment: "manager-office",
      alertTone: unreadInbox > 0 ? "warn" : "ok",
      summary: `Här styr du klubbens dagliga agenda. Du har ${unreadInbox} olästa meddelanden i inkorgen och ${attention.contracts.length} utgående avtal att ta ställning till inför mötet med ${nextOpponentName}.`,
      metrics: [
        { label: "Inkorg", value: `${unreadInbox} olästa`, tone: unreadInbox > 0 ? "warn" : "ok" },
        { label: "Nästa avkast", value: nextFixture ? `${nextOpponentName} (${nextFixture.date})` : "Ingen match", tone: "neutral" },
        { label: "Utgående avtal", value: `${attention.contracts.length} st`, tone: attention.contracts.length > 0 ? "warn" : "ok" },
      ],
      zone: { x: 8, y: 12, w: 24, h: 24, wing: "Ledningsflygeln" },
    },
    {
      id: "dressing",
      name: "Omklädningsrummet",
      purpose: "Truppen, roller, lagkapten och stämning",
      href: "/career/squad",
      secondaryHref: "/career/contracts",
      secondaryLabel: "Kontrakt & löner →",
      status: `${squad.length} spelare`,
      environment: "dressing-room",
      alertTone: attention.unavailable.length > 0 ? "warn" : "ok",
      summary: `Omklädningsrummet samlar truppens ${squad.length} spelare. Snittenergin ligger på ${avgEnergy}% och matchträningen på ${avgFitness}%. ${captain ? `${captain.firstName} ${captain.lastName} bär kaptensbindeln.` : "Ingen lagkapten utsedd ännu."}`,
      metrics: [
        { label: "Tillgängliga", value: `${squad.length - attention.unavailable.length} / ${squad.length}`, tone: attention.unavailable.length === 0 ? "ok" : "warn" },
        { label: "Snittenergi", value: `${avgEnergy}%`, tone: avgEnergy >= 80 ? "ok" : "warn" },
        { label: "Lagkapten", value: captain ? captain.lastName : "Ej utsedd", tone: captain ? "ok" : "warn" },
      ],
      zone: { x: 8, y: 66, w: 24, h: 24, wing: "Spelarflygeln" },
    },
    {
      id: "tactics",
      name: "Taktikrummet",
      purpose: "Matchplan, 6–0/5–1, byten och specialuppställningar",
      href: "/career/tactics",
      secondaryHref: "/career/match-preview",
      secondaryLabel: "Matchförberedelse →",
      status: `${defShape} · ${matchSquadCount}/16`,
      environment: "tactical-room",
      alertTone: matchSquadCount === 16 ? "ok" : "warn",
      summary: `Analys- och taktikrummet med direkt vy mot hallen. Aktivt försvarssystem är ${defShape}, och matchtruppen rymmer ${matchSquadCount} av 16 uttagna spelare.`,
      metrics: [
        { label: "Försvarsform", value: defShape, tone: "neutral" },
        { label: "Matchtrupp", value: `${matchSquadCount} / 16`, tone: matchSquadCount === 16 ? "ok" : "warn" },
        { label: "Tempo / Stil", value: tempoLabel, tone: "neutral" },
      ],
      zone: { x: 8, y: 39, w: 24, h: 24, wing: "Tränarstab & Analys" },
    },
    {
      id: "hall",
      name: "Träningshallen",
      purpose: "Veckans träningsschema, fys och belastning",
      href: "/career/training",
      secondaryHref: "/career/calendar",
      secondaryLabel: "Säsongskalender →",
      status: `${totalSessions} pass i veckan`,
      environment: "training-hall",
      alertTone: attention.tired.length > 3 ? "warn" : "ok",
      summary: `Träningshallen och elitgymmet styr lagets fysiska och taktiska skärpa. Veckan innehåller ${totalSessions} planerade pass och snitt-matchträningen är ${avgFitness}%.`,
      metrics: [
        { label: "Veckans pass", value: `${totalSessions} pass`, tone: "neutral" },
        { label: "Matchträning", value: `${avgFitness}%`, tone: avgFitness >= 75 ? "ok" : "warn" },
        { label: "Slitna spelare", value: `${attention.tired.length} st`, tone: attention.tired.length === 0 ? "ok" : "warn" },
      ],
      zone: { x: 35, y: 68, w: 30, h: 22, wing: "Atletik & Hall" },
    },
    {
      id: "board",
      name: "Styrelserummet",
      purpose: "Styrelsens förtroende, säsongsmål och strategi",
      href: "/career/board",
      secondaryHref: "/career/finance",
      secondaryLabel: "Klubbekonomi →",
      status: `Förtroende ${boardConfidence}/100`,
      environment: "boardroom",
      alertTone: boardConfidence >= 55 ? "ok" : boardConfidence >= 35 ? "warn" : "bad",
      summary: `I styrelserummet följs säsongsmålen och den ekonomiska ramen upp. Styrelsens förtroende ligger på ${boardConfidence}/100 i ekonomisk klass ${baseline?.band ?? "–"}.`,
      metrics: [
        { label: "Förtroende", value: `${boardConfidence} / 100`, tone: boardConfidence >= 55 ? "ok" : boardConfidence >= 35 ? "warn" : "bad" },
        { label: "Övergångsbudget", value: economy ? formatMoney(economy.budgets.transferBudgetEur) : "–", tone: "neutral" },
        { label: "Anläggningsnivå", value: TIER_LABEL[hqTier(baseline?.band)], tone: "neutral" },
      ],
      zone: { x: 68, y: 12, w: 24, h: 24, wing: "Styrelse & VIP" },
    },
    {
      id: "press",
      name: "Pressrummet",
      purpose: "Nyheter, presskonferenser, supportrar och rivaler",
      href: "/career/media",
      status: suspended ? "Avstängd" : openPress ? `${openPress} väntar` : `Läktaren: ${supporterLabel(media.supporters)}`,
      environment: "press-room",
      alertTone: suspended ? "bad" : openPress > 0 ? "warn" : "ok",
      summary: `Presspodiet där klubbens röst möter media och supportrar. Läktarstämningen är ${supporterLabel(media.supporters).toLowerCase()} (${media.supporters >= 0 ? `+${media.supporters}` : media.supporters}) och ${openPress} presskonferenser väntar på svar.`,
      metrics: [
        { label: "Pressfrågor", value: openPress ? `${openPress} öppna` : "Inga väntande", tone: openPress > 0 ? "warn" : "ok" },
        { label: "Supportrar", value: `${supporterLabel(media.supporters)} (${media.supporters >= 0 ? `+${media.supporters}` : media.supporters})`, tone: media.supporters >= 8 ? "ok" : media.supporters <= -8 ? "bad" : "neutral" },
        { label: "Aktiva rivaler", value: `${rivals.length} klubbar`, tone: "neutral" },
      ],
      zone: { x: 68, y: 39, w: 24, h: 24, wing: "Media & Kommunikation" },
    },
    {
      id: "scouting",
      name: "Scoutkontoret",
      purpose: "Scoutingrapporter, bevakningslista och övergångar",
      href: "/career/scouting",
      secondaryHref: "/career/transfers",
      secondaryLabel: "Övergångscenter →",
      status: `${attention.reports.length} rapporter`,
      environment: "scouting-office",
      alertTone: "ok",
      summary: `Rekryterings- och analysavdelningen kartlägger såväl nästa motståndare som tänkbara nyförvärv. Just nu finns ${attention.reports.length} färdiga spelar- eller motståndarrapporter och ${attention.shortlist.length} spelare på bevakningslistan.`,
      metrics: [
        { label: "Rapporter", value: `${attention.reports.length} klara`, tone: "ok" },
        { label: "Kortlista", value: `${attention.shortlist.length} bevakade`, tone: "neutral" },
        { label: "Transferkassa", value: economy ? formatMoney(economy.budgets.transferBudgetEur) : "–", tone: "neutral" },
      ],
      zone: { x: 68, y: 66, w: 24, h: 24, wing: "Sportkontor & Scouting" },
    },
    {
      id: "medical",
      name: "Medicinska rummet",
      purpose: "Skador, rehabilitering och medicinsk beredskap",
      href: "/career/medical",
      status: injured ? `${injured} skadade` : "Inga skador",
      environment: "medical-room",
      alertTone: injured > 0 ? "warn" : "ok",
      summary: `Klubbens medicinska klinik och rehabavdelning intill huvudplanen. ${injured ? `${injured} spelare befinner sig på skadelistan under behandling.` : "Truppen är skadefri och samtliga spelare är medicinskt klara för spel."}`,
      metrics: [
        { label: "Skadelista", value: injured ? `${injured} skadade` : "0 skadade", tone: injured > 0 ? "warn" : "ok" },
        { label: "Återhämtning", value: `${attention.tired.length} slitna`, tone: attention.tired.length > 2 ? "warn" : "ok" },
        { label: "Snittfysik", value: `${avgEnergy}% energi`, tone: avgEnergy >= 80 ? "ok" : "warn" },
      ],
      zone: { x: 35, y: 12, w: 30, h: 18, wing: "Medicin & Fysio" },
    },
    {
      id: "office",
      name: "Kansliet & Ekonomi",
      purpose: "Budget, intäkter, lönetak och kassaflöde",
      href: "/career/finance",
      status: economy ? formatMoney(economy.cashEur) : undefined,
      environment: "arena-club",
      alertTone: "ok",
      summary: `Kansliet sköter föreningens kassa, biljettintäkter, sponsoravtal och lönebudget i ${club.venue ?? "hemmahallen"}.`,
      metrics: [
        { label: "Kassa", value: economy ? formatMoney(economy.cashEur) : "–", tone: "neutral" },
        { label: "Publikkapacitet", value: baseline ? `${venueCapacity(state, me, baseline).toLocaleString("sv-SE")} pl` : "–", tone: "neutral" },
        { label: "Ekonomisk nivå", value: baseline?.band ?? "–", tone: "neutral" },
      ],
      zone: { x: 35, y: 32, w: 14, h: 16, wing: "Kansli & Arena" },
    },
    {
      id: "staff",
      name: "Ledarrummet",
      purpose: "Tränarstab, scouter, fysio och rekrytering",
      href: "/career/staff",
      status: `${staffList.length} ledare`,
      environment: "tactical-room",
      alertTone: "ok",
      summary: `Ledarrummet samlar tränarstaben, målvaktstränare, fystränare, fysioterapeuter och scouter samt låter dig rekrytera ny nyckelpersonal.`,
      metrics: [
        { label: "Anställda ledare", value: `${staffList.length} st`, tone: "ok" },
        { label: "Huvudansvar", value: "Träning & Scouting", tone: "neutral" },
        { label: "Arbetsro", value: "God", tone: "ok" },
      ],
      zone: { x: 51, y: 32, w: 14, h: 16, wing: "Tränarstab & Analys" },
    },
    {
      id: "trophies",
      name: "Prisskåpet & Historik",
      purpose: "Säsonger, mästare och klubbens meriter",
      href: "/career/history",
      status: honours.length ? `${honours.length} meriter` : "Historik",
      environment: "boardroom",
      alertTone: "ok",
      summary: `Klubbens historiska arkiv och troféskåp. Följ tidigare säsonger, sluttabeller och de titlar som bärgats under din tid vid rodret.`,
      metrics: [
        { label: "Titlar i karriären", value: `${honours.length} st`, tone: honours.length > 0 ? "ok" : "neutral" },
        { label: "Grundad", value: club.founded ? String(club.founded) : "–", tone: "neutral" },
        { label: "Säsong", value: state.seasonId, tone: "neutral" },
      ],
      zone: { x: 35, y: 50, w: 30, h: 15, wing: "Tradition & Arena" },
    },
  ];

  const nt = nationalTeamOf(state);
  const upcoming = upcomingWindows(state, 2).map((w) => ({
    window: w,
    state: nt.windows[w.id],
    own: ownCallUps(state, w.id),
  }));
  const doneIds = Object.entries(nt.windows)
    .filter(([, s]) => s.status !== "CALLED")
    .map(([id]) => id);
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
    national: {
      upcoming,
      last: lastWindow && lastId ? { window: lastWindow, state: nt.windows[lastId]!, own: ownCallUps(state, lastId) } : undefined,
    },
  };
}
