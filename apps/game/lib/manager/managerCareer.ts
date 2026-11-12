// HM-ALPHA3-M07: the manager's own career. Reputation grows and shrinks
// with results and honours; the contract runs out or is extended by the
// board; CPU clubs that badly underperform sack their head coach and open
// a vacancy (held open a few weeks before the CPU staff market fills it);
// the manager can apply, is interviewed (three questions whose "right"
// answer follows from the club's own situation), and receives an offer or
// an explained rejection. Strong managers are approached. A sacked manager
// is never stranded: clubs within reach make offers.
//
// HM-M7D (original roadmap 7D, "manager reputation, history & opportunities"):
//   * the job market covers every simulated Swedish league -- Handbollsligan,
//     Allsvenskan and both Division 1 groups -- using current memberships, a
//     real league calendar and a playable squad (Division 2 stays a pool);
//   * every reputation change carries its reason and is logged, and a season
//     is judged against the club's objectives, the squad's expected place,
//     the division and the honours won;
//   * each stint keeps its league, reputation at start/end and a match record
//     per season (also for the part-season when he leaves mid-way);
//   * clubs judge a candidate on reputation, interview fit and relevant
//     experience (level coached, promotions, titles, recent dismissals);
//   * the manager can resign; an unemployed manager keeps the calendar
//     running (his old club is run by an interim) while clubs look at him.
import { buildClubEvent, type CareerEvent } from "../career/careerEvents";
import { clubCompetitionId } from "../career/competitionMembership";
import { getCareerClubSquad } from "../career/careerWorld";
import type { CareerState } from "../career/types";
import { getClubEconomyBaseline } from "../economy/clubEconomyIntegration";
import { ALLSVENSKAN, DIVISION_1, HANDBOLLSLIGAN } from "../competition/rules";
import { competitionClubIds, competitionTable, hasLeagueCalendar } from "../competition/tables";
import { getClub, getCompetition } from "../game-data";
import { releaseStaff } from "../staff/staffNegotiation";
import { addDaysIso, hash, managerMatchesPlayed } from "../players/dynamicsState";
import { boardSeasonEnd, objectivesScore, predictedPositionOf } from "../board/board";
import { matchWinnerClubId } from "@handball-manager/game-simulation";
import { closeOpenBusiness } from "./departure";
import { withEvents } from "./events";
import type { InterviewQuestion, JobApplication, JobOffer, ManagerCareerState, ManagerMilestone, ManagerRecord, ManagerStint, ManagerStintSeason, ReputationChange, Vacancy } from "../board/types";

type Emit = (event: CareerEvent) => void;

const nameOf = (clubId: string) => getClub(clubId)?.name ?? clubId;
const shortOf = (clubId: string) => getClub(clubId)?.shortName ?? clubId;

// ---------------------------------------------------------------------------
// The playable pyramid
// ---------------------------------------------------------------------------

/** HM-M7D: the leagues whose clubs can employ the manager -- every simulated Swedish league (M1.2). Division 2 is a pool, not a league with a calendar. */
export const MANAGEABLE_LEAGUES: readonly string[] = [HANDBOLLSLIGAN, ALLSVENSKAN, ...DIVISION_1];

/** 1 = Handbollsligan, 2 = Allsvenskan, 3 = Division 1, 4 = anything below. */
export function leagueLevel(competitionId: string | undefined): number {
  if (competitionId === HANDBOLLSLIGAN) return 1;
  if (competitionId === ALLSVENSKAN) return 2;
  if (competitionId && (DIVISION_1 as readonly string[]).includes(competitionId)) return 3;
  return 4;
}

export function leagueName(competitionId: string | undefined): string {
  return (competitionId && getCompetition(competitionId)?.name) || (competitionId?.startsWith("se_division2_") ? "Division 2" : competitionId ?? "okänd serie");
}

const LEVEL_BASE: Record<number, number> = { 1: 52, 2: 28, 3: 14, 4: 8 };

/** How big a job is (0-100): league tier plus the club's economic band. Also the reputation a club wants in its head coach. */
export function clubStature(state: CareerState, clubId: string): number {
  const comp = clubCompetitionId(state, clubId) ?? getClub(clubId)?.competitionId;
  const band = Number(getClubEconomyBaseline(state, clubId)?.band.slice(1) ?? 7);
  const base = LEVEL_BASE[leagueLevel(comp)]!;
  return Math.max(8, Math.min(92, base + (6 - band) * 4));
}

/** What a club pays its head coach a month (EUR), from its stature. */
export function managerWageFor(state: CareerState, clubId: string): number {
  return Math.round((900 + clubStature(state, clubId) * 60) / 50) * 50;
}

function seasonEndAfter(seasonId: string, seasons: number): string {
  return `${Number(seasonId.slice(0, 4)) + seasons}-05-31`;
}

/** Created lazily -- older saves get a career that starts at their current club. */
export function ensureManagerCareer(state: CareerState): CareerState {
  if (state.managerCareer) return state;
  const clubId = state.playerClubId;
  const from = state.seasonStartDate ?? state.gameDate;
  const reputation = Math.max(15, clubStature(state, clubId) - 6);
  const career: ManagerCareerState = {
    reputation,
    contract: { clubId, wageEurPerMonth: managerWageFor(state, clubId), startDate: from, endDate: seasonEndAfter(state.seasonId, 2) },
    stints: [{ clubId, from, seasons: [], competitionId: clubCompetitionId(state, clubId) ?? state.competitionId, reputationAtStart: reputation }],
    vacancies: [],
    applications: {},
    offers: {},
    milestones: [{ date: from, kind: "APPOINTED", text: `Tog över som huvudtränare i ${nameOf(clubId)}.`, clubId }],
    reputationLog: [],
  };
  return { ...state, managerCareer: career };
}

export function managerCareerOf(state: CareerState): ManagerCareerState {
  return ensureManagerCareer(state).managerCareer!;
}

function withCareer(state: CareerState, fn: (c: ManagerCareerState) => ManagerCareerState): CareerState {
  const s = ensureManagerCareer(state);
  return { ...s, managerCareer: fn(s.managerCareer!) };
}

function milestone(c: ManagerCareerState, m: ManagerMilestone): ManagerCareerState {
  return c.milestones.some((x) => x.kind === m.kind && x.date === m.date && x.clubId === m.clubId) ? c : { ...c, milestones: [...c.milestones, m].slice(-60) };
}

export const REPUTATION_MIN = 5;
export const REPUTATION_MAX = 95;
const REPUTATION_LOG_LIMIT = 80;

/** HM-M7D: the only way reputation moves -- clamped, and logged with its reason. */
export function adjustReputation(c: ManagerCareerState, date: string, delta: number, reason: string, clubId?: string): ManagerCareerState {
  const after = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, c.reputation + Math.round(delta)));
  const applied = after - c.reputation;
  if (applied === 0) return c;
  const entry: ReputationChange = { date, delta: applied, after, reason, ...(clubId ? { clubId } : {}) };
  return { ...c, reputation: after, reputationLog: [...(c.reputationLog ?? []), entry].slice(-REPUTATION_LOG_LIMIT) };
}

/** The manager's employer, or undefined while he is out of work (the old club is then run by an interim). */
export function managedClubId(state: Pick<CareerState, "playerClubId" | "managerCareer">): string | undefined {
  return state.managerCareer?.seekingJob ? undefined : state.playerClubId;
}

/** Clubs a manager can coach: clubs in a simulated Swedish league (current membership) with a league calendar and a playable squad this season. */
export function eligibleClubs(state: CareerState): string[] {
  return MANAGEABLE_LEAGUES.filter((c) => hasLeagueCalendar(state, c)).flatMap((c) => competitionClubIds(state, c)).filter((id) => getCareerClubSquad(state, id).length >= 12);
}

/** Clubs that will not take the manager (back) right now: any club that sacked him, and a club he walked out on within the last year. */
function closedDoors(state: CareerState, date: string): Set<string> {
  const stints = state.managerCareer?.stints ?? [];
  return new Set(stints.filter((s) => s.leftReason === "DISMISSED" || (s.leftReason === "RESIGNED" && s.to && addDaysIso(s.to, 365) > date)).map((s) => s.clubId));
}

/** Open head-coach jobs -- not the manager's own club, not a club that has sacked him or that he just walked out on, and only clubs he can actually coach this season. */
export function openVacancies(state: CareerState, date = state.gameDate): Vacancy[] {
  const closed = closedDoors(state, date);
  const eligible = new Set(eligibleClubs(state));
  const own = managedClubId(state);
  return (state.managerCareer?.vacancies ?? []).filter((v) => v.closesOn >= date && v.clubId !== own && !closed.has(v.clubId) && eligible.has(v.clubId));
}

export function hasOpenVacancy(state: CareerState, clubId: string, date: string): boolean {
  return (state.managerCareer?.vacancies ?? []).some((v) => v.clubId === clubId && v.closesOn >= date);
}

// ---------------------------------------------------------------------------
// History and statistics
// ---------------------------------------------------------------------------

export const EMPTY_RECORD: ManagerRecord = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };

export function addRecords(a: ManagerRecord, b: ManagerRecord): ManagerRecord {
  return { played: a.played + b.played, won: a.won + b.won, drawn: a.drawn + b.drawn, lost: a.lost + b.lost, goalsFor: a.goalsFor + b.goalsFor, goalsAgainst: a.goalsAgainst + b.goalsAgainst };
}

/** The club's competitive results (friendlies excluded) in this season's calendar, from `from` up to and including `to`. */
export function clubRecordBetween(state: CareerState, clubId: string, from: string, to?: string): ManagerRecord {
  let r = EMPTY_RECORD;
  for (const f of state.fixtures) {
    if (f.type === "FRIENDLY" || (f.homeClubId !== clubId && f.awayClubId !== clubId) || f.date < from || (to && f.date > to)) continue;
    const res = state.results[f.id];
    if (!res) continue;
    const home = f.homeClubId === clubId;
    const winner = matchWinnerClubId(res);
    r = addRecords(r, { played: 1, won: winner === clubId ? 1 : 0, drawn: winner === null ? 1 : 0, lost: winner !== null && winner !== clubId ? 1 : 0, goalsFor: home ? res.homeGoals : res.awayGoals, goalsAgainst: home ? res.awayGoals : res.homeGoals });
  }
  return r;
}

export interface ManagerCareerSummary {
  clubs: number;
  seasons: number;
  record: ManagerRecord;
  titles: number;
  cups: number;
  promotions: number;
  relegations: number;
  dismissals: number;
  resignations: number;
  /** Best league level coached (1 = Handbollsligan), null before a first stint season. */
  highestLevel: number | null;
  daysUnemployed: number;
}

const daysBetweenIso = (a: string, b: string) => Math.max(0, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000));

/** HM-M7D: career totals from the persisted stints (closed seasons) plus the open stint's current season. */
export function managerCareerSummary(state: CareerState): ManagerCareerSummary {
  const c = managerCareerOf(state);
  let record = EMPTY_RECORD;
  let seasons = 0;
  const honours = { titles: 0, cups: 0, promotions: 0, relegations: 0 };
  let highest: number | null = null;
  for (const st of c.stints) {
    for (const s of st.seasons) {
      if (s.record) record = addRecords(record, s.record);
      if (!s.partial) seasons++;
      if (s.honours.includes("Svenska mästare")) honours.titles++;
      if (s.honours.includes("Cupvinnare")) honours.cups++;
      if (s.honours.includes("Uppflyttning")) honours.promotions++;
      if (s.honours.includes("Nedflyttning")) honours.relegations++;
      const lvl = leagueLevel(s.competitionId);
      highest = highest === null ? lvl : Math.min(highest, lvl);
    }
  }
  const open = c.stints.at(-1);
  if (open && !open.to && !open.seasons.some((s) => s.seasonId === state.seasonId)) {
    const current = clubRecordBetween(state, open.clubId, open.from);
    record = addRecords(record, current);
    if (current.played > 0) {
      const lvl = leagueLevel(clubCompetitionId(state, open.clubId));
      highest = highest === null ? lvl : Math.min(highest, lvl);
    }
  }
  let days = 0;
  for (let i = 0; i < c.stints.length; i++) {
    const st = c.stints[i]!;
    if (!st.to) continue;
    const nextStart = c.stints[i + 1]?.from ?? (c.seekingJob ? state.gameDate : st.to);
    days += daysBetweenIso(st.to, nextStart);
  }
  return {
    clubs: new Set(c.stints.map((s) => s.clubId)).size,
    seasons,
    record,
    ...honours,
    dismissals: c.stints.filter((s) => s.leftReason === "DISMISSED").length,
    resignations: c.stints.filter((s) => s.leftReason === "RESIGNED").length,
    highestLevel: highest,
    daysUnemployed: days,
  };
}

/** The honours a club's season earned (recorded in the manager's history). */
function seasonHonours(state: CareerState, clubId: string): string[] {
  const o = state.seasonOutcome;
  if (!o || o.seasonId !== state.seasonId) return [];
  return [o.champion === clubId && "Svenska mästare", o.cupWinner === clubId && "Cupvinnare", o.promoted.includes(clubId) && "Uppflyttning", o.relegated.includes(clubId) && "Nedflyttning"].filter((h): h is string => Boolean(h));
}

/** Closes the open stint the day he leaves: records the part-season (position, matches) and his reputation at the end. */
export function closeStint(state: CareerState, c: ManagerCareerState, date: string, leftReason: NonNullable<ManagerStint["leftReason"]>): ManagerCareerState {
  const stints = c.stints.map((st, i) => {
    if (i !== c.stints.length - 1 || st.to) return st;
    const already = st.seasons.some((s) => s.seasonId === state.seasonId);
    const record = clubRecordBetween(state, st.clubId, st.from, date);
    const comp = clubCompetitionId(state, st.clubId) ?? state.competitionId;
    const table = competitionTable(state, comp);
    const idx = table.findIndex((r) => r.clubId === st.clubId);
    // Left after the season was decided (e.g. dismissed at the season review): the whole season and its honours count.
    const complete = state.seasonComplete || (state.seasonOutcome?.seasonId === state.seasonId && state.seasonOutcome.phase === "COMPLETE");
    const part: ManagerStintSeason = { seasonId: state.seasonId, competitionId: comp, position: idx >= 0 && table[idx]!.played > 0 ? idx + 1 : null, objectivesScore: state.board?.clubId === st.clubId && state.board.seasonId === state.seasonId ? objectivesScore(state.board.objectives) : null, honours: complete ? seasonHonours(state, st.clubId) : [], record, ...(complete ? {} : { partial: true }) };
    const seasons = already || record.played === 0 ? st.seasons : [...st.seasons, part];
    return { ...st, to: date, leftReason, reputationAtEnd: c.reputation, seasons };
  });
  return { ...c, stints };
}

// ---------------------------------------------------------------------------
// Experience: how clubs read a candidate
// ---------------------------------------------------------------------------

export interface ManagerExperience {
  seasons: number;
  /** Seasons (part-seasons count once) coached at each league level. */
  levelSeasons: Record<number, number>;
  bestLevel: number | null;
  promotions: number;
  titles: number;
  recentDismissals: number;
}

export function managerExperience(state: CareerState, date = state.gameDate): ManagerExperience {
  const c = managerCareerOf(state);
  const levelSeasons: Record<number, number> = {};
  let seasons = 0, promotions = 0, titles = 0;
  for (const st of c.stints) for (const s of st.seasons) {
    const lvl = leagueLevel(s.competitionId);
    levelSeasons[lvl] = (levelSeasons[lvl] ?? 0) + 1;
    if (!s.partial) seasons++;
    if (s.honours.includes("Uppflyttning")) promotions++;
    if (s.honours.includes("Svenska mästare") || s.honours.includes("Cupvinnare")) titles++;
  }
  const open = c.stints.at(-1);
  if (open && !open.to && !open.seasons.some((s) => s.seasonId === state.seasonId) && managerMatchesPlayed(state).some((m) => m.date >= open.from)) {
    const lvl = leagueLevel(clubCompetitionId(state, open.clubId));
    levelSeasons[lvl] = (levelSeasons[lvl] ?? 0) + 1;
  }
  const levels = Object.keys(levelSeasons).map(Number);
  const recentDismissals = c.stints.filter((s) => s.leftReason === "DISMISSED" && s.to && addDaysIso(s.to, 365) > date).length;
  return { seasons, levelSeasons, bestLevel: levels.length ? Math.min(...levels) : null, promotions, titles, recentDismissals };
}

export interface CandidateAssessment {
  reputation: number;
  /** The reputation the club wants (its stature). */
  need: number;
  experiencePoints: number;
  parts: { label: string; points: number }[];
}

/** HM-M7D: what a club sees in the manager before any interview -- reputation against its stature, adjusted for relevant experience. Explainable part by part. */
export function assessCandidate(state: CareerState, clubId: string, date = state.gameDate): CandidateAssessment {
  const c = managerCareerOf(state);
  const exp = managerExperience(state, date);
  const level = leagueLevel(clubCompetitionId(state, clubId));
  const parts: { label: string; points: number }[] = [];
  const atOrAbove = Object.entries(exp.levelSeasons).filter(([l]) => Number(l) <= level).reduce((n, [, v]) => n + v, 0);
  if (atOrAbove > 0) parts.push({ label: `erfarenhet från ${level === 1 ? "Handbollsligan" : "den här nivån eller högre"}`, points: Math.min(5, 2 + atOrAbove) });
  else if (exp.bestLevel !== null && exp.bestLevel - level >= 2) parts.push({ label: "har aldrig tränat i närheten av den här nivån", points: -4 });
  else if (exp.bestLevel !== null) parts.push({ label: "saknar erfarenhet från den här nivån", points: -1 });
  if (exp.promotions > 0) parts.push({ label: `${exp.promotions} uppflyttning${exp.promotions > 1 ? "ar" : ""} i meritlistan`, points: Math.min(4, exp.promotions * 2) });
  if (exp.titles > 0) parts.push({ label: "titlar i meritlistan", points: Math.min(6, exp.titles * 3) });
  if (exp.recentDismissals > 0) parts.push({ label: `sparkad ${exp.recentDismissals === 1 ? "en gång" : `${exp.recentDismissals} gånger`} det senaste året`, points: -Math.min(8, exp.recentDismissals * 4) });
  return { reputation: c.reputation, need: clubStature(state, clubId), experiencePoints: parts.reduce((n, p) => n + p.points, 0), parts };
}

/** Whether a club would seriously consider the manager without an interview (approaches, offers to an unemployed manager). */
export function clubConsiders(state: CareerState, clubId: string, date = state.gameDate, slack = 4): boolean {
  const a = assessCandidate(state, clubId, date);
  return a.reputation + a.experiencePoints >= a.need - slack;
}

// ---------------------------------------------------------------------------
// Vacancies
// ---------------------------------------------------------------------------

function headCoachOf(state: CareerState, clubId: string) {
  return (state.staffRoster[clubId] ?? []).find((m) => m.roles[0] === "HEAD_COACH");
}

function openVacancy(state: CareerState, vacancy: Vacancy): CareerState {
  return withCareer(state, (c) => ({ ...c, vacancies: [...c.vacancies.filter((v) => v.clubId !== vacancy.clubId), vacancy] }));
}

/** CPU sackings: November to March, at most two a month across the pyramid, among clubs far below their expected place. */
function cpuSackings(state: CareerState, date: string, emit: Emit): CareerState {
  const month = Number(date.slice(5, 7));
  if (![11, 12, 1, 2, 3].includes(month)) return state;
  const candidates: { clubId: string; gap: number }[] = [];
  for (const comp of MANAGEABLE_LEAGUES) {
    if (!hasLeagueCalendar(state, comp)) continue;
    const table = competitionTable(state, comp);
    table.forEach((row, i) => {
      if (row.clubId === state.playerClubId || row.played < 8 || hasOpenVacancy(state, row.clubId, date)) return;
      const gap = i + 1 - predictedPositionOf(state, row.clubId, comp);
      if (gap >= 4) candidates.push({ clubId: row.clubId, gap });
    });
  }
  let next = state;
  for (const pick of candidates.sort((a, b) => b.gap - a.gap || a.clubId.localeCompare(b.clubId)).slice(0, 2)) {
    if (hash(`${state.saveSeed}:sack:${date}:${pick.clubId}`) > 0.45) continue;
    const coach = headCoachOf(next, pick.clubId);
    if (coach) next = releaseStaff(next, coach.id, date, "DISMISSED");
    const vacancy: Vacancy = { clubId: pick.clubId, openedOn: date, closesOn: addDaysIso(date, 30), reason: `${shortOf(pick.clubId)} ligger långt under förväntan och har sparkat ${coach ? coach.displayName : "sin tränare"}.` };
    next = openVacancy(next, vacancy);
    emit(buildClubEvent("MANAGER_CAREER", `vacancy:${pick.clubId}:${date}`, date, "INFORMATION", `${shortOf(pick.clubId)} söker ny huvudtränare`, `${vacancy.reason} (${leagueName(clubCompetitionId(next, pick.clubId))}.) Tjänsten är öppen för ansökningar till ${vacancy.closesOn}.`, [{ route: "JOB_MARKET" }]));
  }
  return next;
}

/** At season end a few more clubs across the pyramid change coach (contracts ending, new ambitions). Once per season, employed or not. */
function seasonEndVacancies(state: CareerState, date: string, emit: Emit): CareerState {
  if (state.managerCareer?.summerVacanciesSeasonId === state.seasonId) return state;
  let next = state;
  const pool = eligibleClubs(state).filter((id) => id !== state.playerClubId && !hasOpenVacancy(state, id, date));
  const chosen = pool.map((id) => ({ id, r: hash(`${state.saveSeed}:${state.seasonId}:summer-vacancy:${id}`) })).sort((a, b) => a.r - b.r).slice(0, 4);
  for (const { id } of chosen) {
    const coach = headCoachOf(next, id);
    if (coach) next = releaseStaff(next, coach.id, date, "LEFT");
    const vacancy: Vacancy = { clubId: id, openedOn: date, closesOn: addDaysIso(date, 30), reason: `${coach ? coach.displayName : "Tränaren"} lämnar ${shortOf(id)} efter säsongen.` };
    next = openVacancy(next, vacancy);
    emit(buildClubEvent("MANAGER_CAREER", `vacancy:${id}:${date}`, date, "INFORMATION", `${shortOf(id)} söker ny huvudtränare`, `${vacancy.reason} (${leagueName(clubCompetitionId(next, id))}.) Ansök senast ${vacancy.closesOn}.`, [{ route: "JOB_MARKET" }]));
  }
  return withCareer(next, (c) => ({ ...c, summerVacanciesSeasonId: state.seasonId }));
}

// ---------------------------------------------------------------------------
// Applications and interviews
// ---------------------------------------------------------------------------

type ClubWish = { goal: "AMBITIOUS" | "REALISTIC" | "PATIENT"; youth: "YOUTH" | "MERIT"; money: "PRUDENT" | "INVEST" };

/** What a club is looking for, from its own situation. Not shown as such -- the questions hint at it. */
export function clubWish(state: CareerState, clubId: string): ClubWish {
  const comp = clubCompetitionId(state, clubId) ?? HANDBOLLSLIGAN;
  const p = predictedPositionOf(state, clubId, comp);
  const n = Math.max(1, competitionClubIds(state, comp).length);
  const b = getClubEconomyBaseline(state, clubId);
  const rev = b ? b.revenue.commercialRevenueEur + b.revenue.mediaRevenueEur + b.revenue.matchdayRevenueEur + b.revenue.sportingRevenueEur + b.revenue.otherRevenueEur : 0;
  const academyShare = b && rev > 0 ? b.academyBudgetBaselineEur / rev : 0;
  const status = state.clubFinances?.[clubId]?.status ?? "HEALTHY";
  const band = Number(b?.band.slice(1) ?? 7);
  return {
    goal: p <= Math.ceil(n * 0.25) ? "AMBITIOUS" : p > Math.floor(n * 0.7) ? "PATIENT" : "REALISTIC",
    youth: academyShare >= 0.06 ? "YOUTH" : "MERIT",
    money: status !== "HEALTHY" || band >= 5 ? "PRUDENT" : "INVEST",
  };
}

export function interviewQuestions(state: CareerState, clubId: string): InterviewQuestion[] {
  const short = shortOf(clubId);
  return [
    { id: "goal", question: `Vad är ditt mål med ${short} den första säsongen?`, answers: [{ id: "AMBITIOUS", label: "Att utmana om topplaceringarna direkt." }, { id: "REALISTIC", label: "Att etablera laget där det hör hemma och ta steg därifrån." }, { id: "PATIENT", label: "Att bygga långsiktigt – resultaten kommer med tiden." }] },
    { id: "youth", question: "Hur ser du på klubbens egna unga spelare?", answers: [{ id: "YOUTH", label: "De ska få chansen i A-laget, även när det kostar." }, { id: "MERIT", label: "De får förtjäna sin plats som alla andra." }] },
    { id: "money", question: "Hur vill du arbeta med truppbudgeten?", answers: [{ id: "PRUDENT", label: "Inom ramarna, även om det betyder färre värvningar." }, { id: "INVEST", label: "Satsa nu för att nå målen snabbare." }] },
  ];
}

export function applyForJob(state: CareerState, clubId: string): CareerState {
  const s = ensureManagerCareer(state);
  const c = s.managerCareer!;
  if (clubId === managedClubId(s)) throw new Error("Du arbetar redan i klubben.");
  if (!hasOpenVacancy(s, clubId, s.gameDate)) throw new Error("Klubben söker ingen tränare just nu.");
  if (!openVacancies(s).some((v) => v.clubId === clubId)) throw new Error("Klubben är inte aktuell för dig just nu.");
  if (Object.values(c.applications).some((a) => a.clubId === clubId && (a.status === "INTERVIEW" || a.status === "ANSWERED"))) throw new Error("Du har redan sökt jobbet.");
  const app: JobApplication = { id: `app:${clubId}:${s.gameDate}`, clubId, appliedOn: s.gameDate, status: "INTERVIEW", interviewOn: s.gameDate, questions: interviewQuestions(s, clubId) };
  return { ...s, managerCareer: { ...c, applications: { ...c.applications, [app.id]: app } } };
}

export function withdrawApplication(state: CareerState, appId: string): CareerState {
  return withCareer(state, (c) => {
    const a = c.applications[appId];
    if (!a || (a.status !== "INTERVIEW" && a.status !== "ANSWERED")) return c;
    return { ...c, applications: { ...c.applications, [appId]: { ...a, status: "WITHDRAWN" } } };
  });
}

/** The manager sits the interview; the club answers in two days. */
export function answerInterview(state: CareerState, appId: string, answers: Record<string, string>): CareerState {
  return withCareer(state, (c) => {
    const a = c.applications[appId];
    if (!a || a.status !== "INTERVIEW") throw new Error("Intervjun är redan genomförd.");
    if (a.questions.some((q) => !answers[q.id])) throw new Error("Svara på alla frågor.");
    return { ...c, applications: { ...c.applications, [appId]: { ...a, status: "ANSWERED", answers, decisionOn: addDaysIso(state.gameDate, 2) } } };
  });
}

/** The club's verdict: reputation and relevant experience against the job's stature, adjusted by how well the answers fit. Explained either way. */
export function interviewVerdict(state: CareerState, a: JobApplication): { hired: boolean; note: string; fit: number } {
  const wish = clubWish(state, a.clubId);
  const assessment = assessCandidate(state, a.clubId);
  const rep = assessment.reputation;
  const need = assessment.need;
  const matches: string[] = [], misses: string[] = [];
  const check = (id: keyof ClubWish, good: string, bad: string) => (a.answers?.[id] === wish[id] ? matches.push(good) : misses.push(bad));
  check("goal", "målbilden stämde med styrelsens", "styrelsen såg en annan målbild för laget");
  check("youth", "synen på unga spelare passade klubben", "synen på unga spelare passade inte klubben");
  check("money", "synen på ekonomin övertygade", "synen på ekonomin oroade styrelsen");
  const fit = matches.length * 4 - misses.length * 3;
  for (const p of assessment.parts) (p.points >= 0 ? matches : misses).push(p.label);
  const hired = rep + fit + assessment.experiencePoints >= need - 6;
  const repText = rep >= need ? "Ditt rykte räcker gott för jobbet" : rep >= need - 8 ? "Ditt rykte är nära vad de söker" : "Ditt rykte är lägre än vad de söker";
  const note = `${repText} (rykte ${rep}, jobbet kräver omkring ${need}). ${matches.length ? `Det som talade för dig: ${matches.join(", ")}.` : ""} ${misses.length ? `Det som talade emot: ${misses.join(", ")}.` : ""}`.replace(/\s+/g, " ").trim();
  return { hired, note, fit };
}

function makeOffer(state: CareerState, clubId: string, source: JobOffer["source"], date: string, pitch: string): JobOffer {
  return { id: `offer:${clubId}:${date}:${source}`, clubId, offeredOn: date, expiresOn: addDaysIso(date, source === "AFTER_DISMISSAL" ? 30 : 10), wageEurPerMonth: managerWageFor(state, clubId), years: 2, source, pitch, status: "OPEN" };
}

export function openOffers(state: CareerState): JobOffer[] {
  return Object.values(state.managerCareer?.offers ?? {}).filter((o) => o.status === "OPEN" && o.expiresOn >= state.gameDate);
}

export function declineOffer(state: CareerState, offerId: string): CareerState {
  return withCareer(state, (c) => {
    const o = c.offers[offerId];
    if (!o || o.status !== "OPEN") return c;
    return { ...c, offers: { ...c.offers, [offerId]: { ...o, status: "DECLINED" } } };
  });
}

// ---------------------------------------------------------------------------
// Leaving a club: dismissal and resignation
// ---------------------------------------------------------------------------

/**
 * Shared by dismissal and resignation: the stint and contract close once, the open
 * business at the club is closed, the club opens a vacancy (that he cannot take) and
 * the manager enters the job market. The world is untouched.
 */
function leaveClub(state: CareerState, date: string, reason: "DISMISSED" | "RESIGNED", text: string, reputationDelta: number, reputationReason: string): CareerState {
  const s = ensureManagerCareer(state);
  const clubId = s.playerClubId;
  let next = closeOpenBusiness(s, date);
  next = withCareer(next, (c) => {
    let cc = adjustReputation(c, date, reputationDelta, reputationReason, clubId);
    cc = closeStint(next, cc, date, reason);
    cc = { ...cc, contract: { ...cc.contract, endDate: date }, seekingJob: { since: date, reason, clubId }, lastUnemployedReview: date };
    return milestone(cc, { date, kind: reason, text, clubId });
  });
  const vacancy: Vacancy = { clubId, openedOn: date, closesOn: addDaysIso(date, 30), reason: reason === "DISMISSED" ? `${shortOf(clubId)} har sparkat sin tränare.` : `Tränaren har lämnat ${shortOf(clubId)} på egen begäran.` };
  return openVacancy(next, vacancy);
}

/** The board ends the relationship: the stint closes, reputation drops, and clubs within reach come forward. */
export function dismissManager(state: CareerState, date: string, reason: string, emit: Emit): CareerState {
  if (state.managerCareer?.seekingJob) return state;
  const clubId = state.playerClubId;
  let next = leaveClub(state, date, "DISMISSED", `Sparkad av ${nameOf(clubId)}. ${reason}`, -6, `Sparkad av ${nameOf(clubId)}`);
  next = offersAfterDismissal(next, date, emit);
  emit(buildClubEvent("MANAGER_CAREER", `dismissed:${clubId}:${date}`, date, "IMPORTANT", `${shortOf(clubId)} har sparkat dig`, `${reason} Du leder inte längre laget. Kalendern fortsätter medan du söker nytt jobb – erbjudandena finns på jobbmarknaden.`, [{ route: "JOB_MARKET" }]));
  return next;
}

export interface ResignationPreview {
  allowed: boolean;
  blocker: string | null;
  clubId: string;
  contractEndDate: string;
  wageEurPerMonth: number;
  /** Remaining whole months of salary he gives up. */
  forfeitedMonths: number;
  reputationDelta: number;
  consequences: string[];
}

/** Whether the club's league season is under way (a league game played) and not yet finished. */
function midSeason(state: CareerState, clubId: string): boolean {
  const comp = clubCompetitionId(state, clubId) ?? state.competitionId;
  const league = state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === comp);
  return !state.seasonComplete && league.some((f) => state.results[f.id]) && league.some((f) => !state.results[f.id]);
}

/** An own fixture whose matchday has been reached but that has not been played -- a change of employer must wait until it is. */
export function unplayedOwnFixtureDue(state: CareerState): boolean {
  const own = managedClubId(state);
  if (!own) return false;
  return state.fixtures.some((f) => f.date <= state.processedThroughDate && !state.results[f.id] && (f.homeClubId === own || f.awayClubId === own));
}

/** HM-M7D: what a resignation would mean, shown before the decision. */
export function resignationPreview(state: CareerState): ResignationPreview {
  const s = ensureManagerCareer(state);
  const c = s.managerCareer!;
  const clubId = s.playerClubId;
  const blocker = c.seekingJob ? "Du har ingen klubb att lämna." : s.productionMatch || s.activeMatchSession ? "Spela klart matchen först." : unplayedOwnFixtureDue(s) ? "Spela dagens match först." : null;
  const mid = midSeason(s, clubId);
  const reputationDelta = mid ? -2 : 0;
  const months = Math.max(0, Math.floor(daysBetweenIso(s.gameDate, c.contract.endDate) / 30.4));
  const consequences = [
    `Avtalet med ${nameOf(clubId)} upphör i dag – du avstår ${months} månadslöner à ${c.contract.wageEurPerMonth} €.`,
    mid ? "Att lämna mitt under säsongen kostar 2 i rykte." : "Säsongen är inte i gång – ryktet påverkas inte.",
    `${shortOf(clubId)} leds av en interimstränare och söker en ny huvudtränare; du kan inte söka dig tillbaka på ett år.`,
    "Pågående förhandlingar, samtal och scoutuppdrag i klubben avslutas.",
    "Kalendern fortsätter medan du är arbetslös. Sök lediga jobb eller vänta på att klubbar hör av sig.",
  ];
  return { allowed: !blocker, blocker, clubId, contractEndDate: c.contract.endDate, wageEurPerMonth: c.contract.wageEurPerMonth, forfeitedMonths: months, reputationDelta, consequences };
}

/** HM-M7D: the manager resigns. A second request while unemployed is refused, so the stint and contract close exactly once. */
export function resignFromClub(state: CareerState): CareerState {
  const preview = resignationPreview(state);
  if (!preview.allowed) throw new Error(preview.blocker ?? "Du kan inte avgå just nu.");
  const date = state.gameDate;
  const clubId = state.playerClubId;
  const next = leaveClub(state, date, "RESIGNED", `Avgick som huvudtränare i ${nameOf(clubId)}.`, preview.reputationDelta, `Lämnade ${nameOf(clubId)} mitt under säsongen`);
  const event = buildClubEvent("MANAGER_CAREER", `resigned:${clubId}:${date}`, date, "IMPORTANT", `Du har lämnat ${shortOf(clubId)}`, "Du avgick som huvudtränare. Kalendern fortsätter medan du söker nytt jobb.", [{ route: "JOB_MARKET" }]);
  return withEvents(next, [event]);
}

/** A sacked manager is never stranded: the two or three clubs whose stature fits the reputation make offers (clubs with an open vacancy first). */
function offersAfterDismissal(state: CareerState, date: string, emit: Emit): CareerState {
  const c = state.managerCareer!;
  const closed = closedDoors(state, date);
  const fits = eligibleClubs(state).filter((id) => id !== state.playerClubId && !closed.has(id))
    .map((id) => ({ id, d: Math.abs(clubStature(state, id) - (c.reputation - 4)) + (hasOpenVacancy(state, id, date) ? -6 : 0) + hash(`${state.saveSeed}:after:${date}:${id}`) * 4 }))
    .sort((a, b) => a.d - b.d).slice(0, 3);
  let next = state;
  for (const { id } of fits) {
    const offer = makeOffer(state, id, "AFTER_DISMISSAL", date, hasOpenVacancy(state, id, date) ? `${shortOf(id)} söker tränare och vill ha dig.` : `${shortOf(id)} är beredda att byta tränare för att få dig.`);
    next = withCareer(next, (cc) => ({ ...cc, offers: { ...cc.offers, [offer.id]: offer } }));
    emit(buildClubEvent("MANAGER_CAREER", offer.id, date, "IMPORTANT", `Erbjudande från ${shortOf(id)}`, `${offer.pitch} ${leagueName(clubCompetitionId(state, id))}. ${offer.years} år, ${offer.wageEurPerMonth} € i månaden.`, [{ route: "JOB_MARKET" }]));
  }
  return next;
}

/**
 * HM-M7D: weekly, clubs with an open vacancy look at an unemployed manager. A club that
 * considers him (reputation plus experience against its stature) may approach. After a
 * resignation, if six weeks pass without any offer, the best-fitting open vacancy calls.
 */
function unemployedMarket(state: CareerState, date: string, emit: Emit): CareerState {
  const c = state.managerCareer!;
  const seeking = c.seekingJob!;
  if (c.lastUnemployedReview && addDaysIso(c.lastUnemployedReview, 7) > date) return state;
  let next = withCareer(state, (cc) => ({ ...cc, lastUnemployedReview: date }));
  const open = openVacancies(next, date).filter((v) => !Object.values(c.offers).some((o) => o.clubId === v.clubId && o.offeredOn >= v.openedOn));
  const ranked = open.map((v) => ({ v, s: clubStature(next, v.clubId) })).sort((a, b) => b.s - a.s || a.v.clubId.localeCompare(b.v.clubId));
  for (const { v } of ranked) {
    if (!clubConsiders(next, v.clubId, date)) continue;
    if (hash(`${state.saveSeed}:unemployed:${date}:${v.clubId}`) > 0.5) continue;
    const offer = makeOffer(next, v.clubId, "APPROACH", date, `${shortOf(v.clubId)} söker tränare och vill gärna prata med dig.`);
    next = withCareer(next, (cc) => ({ ...cc, offers: { ...cc.offers, [offer.id]: offer } }));
    emit(buildClubEvent("MANAGER_CAREER", offer.id, date, "IMPORTANT", `${shortOf(v.clubId)} hör av sig`, `${offer.pitch} ${leagueName(clubCompetitionId(next, v.clubId))}. ${offer.years} år, ${offer.wageEurPerMonth} € i månaden. Svara senast ${offer.expiresOn}.`, [{ route: "JOB_MARKET" }]));
    return next;
  }
  const anyOffer = Object.values(c.offers).some((o) => o.offeredOn >= seeking.since);
  if (seeking.reason === "RESIGNED" && !anyOffer && addDaysIso(seeking.since, 42) <= date) {
    const fallback = open.filter((v) => clubConsiders(next, v.clubId, date, 14)).map((v) => ({ v, d: Math.abs(clubStature(next, v.clubId) - c.reputation) })).sort((a, b) => a.d - b.d || a.v.clubId.localeCompare(b.v.clubId))[0];
    if (fallback) {
      const offer = makeOffer(next, fallback.v.clubId, "APPROACH", date, `${shortOf(fallback.v.clubId)} har en ledig tjänst och tror på dig.`);
      next = withCareer(next, (cc) => ({ ...cc, offers: { ...cc.offers, [offer.id]: offer } }));
      emit(buildClubEvent("MANAGER_CAREER", offer.id, date, "IMPORTANT", `${shortOf(fallback.v.clubId)} hör av sig`, `${offer.pitch} ${leagueName(clubCompetitionId(next, fallback.v.clubId))}. Svara senast ${offer.expiresOn}.`, [{ route: "JOB_MARKET" }]));
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// The daily tick
// ---------------------------------------------------------------------------

export function progressManagerCareer(state: CareerState, date: string, emit: Emit): CareerState {
  let next = ensureManagerCareer(state);
  let c = next.managerCareer!;

  // Answers from interviews.
  for (const a of Object.values(c.applications)) {
    if (a.status !== "ANSWERED" || (a.decisionOn ?? date) > date) continue;
    const v = interviewVerdict(next, a);
    if (v.hired) {
      const offer = makeOffer(next, a.clubId, "APPLICATION", date, `Efter intervjun vill ${shortOf(a.clubId)} anställa dig. ${v.note}`);
      next = withCareer(next, (cc) => ({ ...cc, applications: { ...cc.applications, [a.id]: { ...a, status: "OFFERED", note: v.note } }, offers: { ...cc.offers, [offer.id]: offer } }));
      emit(buildClubEvent("MANAGER_CAREER", `verdict:${a.id}`, date, "IMPORTANT", `${shortOf(a.clubId)} erbjuder dig jobbet`, `${v.note} Svara senast ${offer.expiresOn}.`, [{ route: "JOB_MARKET" }]));
    } else {
      next = withCareer(next, (cc) => ({ ...cc, applications: { ...cc.applications, [a.id]: { ...a, status: "REJECTED", note: v.note } } }));
      emit(buildClubEvent("MANAGER_CAREER", `verdict:${a.id}`, date, "INFORMATION", `${shortOf(a.clubId)} går vidare med en annan kandidat`, v.note, [{ route: "JOB_MARKET" }]));
    }
  }
  c = next.managerCareer!;

  // Expired offers and closed vacancies.
  const offers = Object.fromEntries(Object.entries(c.offers).map(([k, o]) => [k, o.status === "OPEN" && o.expiresOn < date ? { ...o, status: "EXPIRED" as const } : o]));
  const applications = Object.fromEntries(Object.entries(c.applications).map(([k, a]) => [k, (a.status === "INTERVIEW") && !c.vacancies.some((v) => v.clubId === a.clubId && v.closesOn >= date) ? { ...a, status: "REJECTED" as const, note: "Klubben anställde en annan tränare innan du hann göra intervjun." } : a]));
  next = { ...next, managerCareer: { ...c, offers, applications, vacancies: c.vacancies.filter((v) => v.closesOn >= addDaysIso(date, -60)) } };

  // The market runs on the first of each month, employed or not.
  if (date.endsWith("-01") && next.managerCareer!.lastMarketRun !== date) {
    next = cpuSackings(next, date, emit);
    if (!next.managerCareer!.seekingJob) next = approaches(next, date, emit);
    next = withCareer(next, (cc) => ({ ...cc, lastMarketRun: date }));
  }

  if (next.managerCareer!.seekingJob) {
    // Summer coaching changes happen whether or not he has a club.
    if (next.seasonOutcome?.seasonId === next.seasonId && next.seasonOutcome.phase === "COMPLETE") next = seasonEndVacancies(next, date, emit);
    // Never stranded after a dismissal or an expired contract: if every offer has lapsed, new ones come.
    if (next.managerCareer!.seekingJob!.reason !== "RESIGNED" && openOffers({ ...next, gameDate: date }).length === 0) next = offersAfterDismissal(next, date, emit);
    return unemployedMarket(next, date, emit);
  }

  next = seasonRecord(next, date, emit);
  next = contractCheck(next, date, emit);
  return next;
}

/** A bigger club with a vacancy that rates the manager (reputation and experience) may make an approach. */
function approaches(state: CareerState, date: string, emit: Emit): CareerState {
  const c = state.managerCareer!;
  const own = clubStature(state, state.playerClubId);
  for (const v of openVacancies(state, date)) {
    const s = clubStature(state, v.clubId);
    if (s <= own || !clubConsiders(state, v.clubId, date)) continue;
    if (Object.values(c.offers).some((o) => o.clubId === v.clubId && o.offeredOn >= v.openedOn)) continue;
    if (hash(`${state.saveSeed}:approach:${date}:${v.clubId}`) > 0.4) continue;
    const offer = makeOffer(state, v.clubId, "APPROACH", date, `${shortOf(v.clubId)} har följt ditt arbete och vill ha dig som huvudtränare.`);
    emit(buildClubEvent("MANAGER_CAREER", offer.id, date, "IMPORTANT", `${shortOf(v.clubId)} hör av sig`, `${offer.pitch} ${leagueName(clubCompetitionId(state, v.clubId))}. ${offer.years} år, ${offer.wageEurPerMonth} € i månaden. Svara senast ${offer.expiresOn}.`, [{ route: "JOB_MARKET" }]));
    return withCareer(state, (cc) => ({ ...cc, offers: { ...cc.offers, [offer.id]: offer } }));
  }
  return state;
}

/** HM-M7D: a season judged -- each part of the reputation change with its reason. */
export function seasonReputationParts(state: CareerState, position: number | null, score: number | null): { points: number; reason: string }[] {
  const me = state.playerClubId;
  const comp = state.competitionId;
  const level = leagueLevel(comp);
  const outcome = state.seasonOutcome;
  const parts: { points: number; reason: string }[] = [];
  // Ordinary performance counts for less the lower the division.
  const weight = level === 1 ? 1 : level === 2 ? 0.8 : 0.6;
  if (score !== null) {
    const p = Math.round((score - 0.55) * 14 * weight);
    if (p !== 0) parts.push({ points: p, reason: `Styrelsens mål ${Math.round(score * 100)} % uppfyllda (${leagueName(comp)})` });
  }
  if (position !== null) {
    const n = Math.max(2, competitionTable(state, comp).length);
    const predicted = predictedPositionOf(state, me, comp);
    const p = Math.max(-4, Math.min(4, Math.round(((predicted - position) / (n / 6)) * weight)));
    if (p !== 0) parts.push({ points: p, reason: `Slutade ${position}:a med en trupp som förväntades sluta ${predicted}:a` });
  }
  if (outcome?.champion === me) parts.push({ points: 8, reason: `Svenska mästare med ${nameOf(me)}` });
  if (outcome?.cupWinner === me) parts.push({ points: 5, reason: `Vann Svenska cupen med ${nameOf(me)}` });
  if (outcome?.promoted.includes(me)) parts.push({ points: level === 2 ? 6 : 4, reason: `Uppflyttning med ${nameOf(me)} från ${leagueName(comp)}` });
  if (outcome?.relegated.includes(me)) parts.push({ points: -8, reason: `Nedflyttning med ${nameOf(me)} från ${leagueName(comp)}` });
  // A manager already far better known than the club gains little from ordinary success there.
  const rep = managerCareerOf(state).reputation;
  const gain = parts.reduce((n, x) => n + Math.max(0, x.points), 0);
  if (gain > 0 && rep > clubStature(state, me) + 25) parts.push({ points: -Math.floor(gain / 2), reason: "Framgångar på den här nivån väger lätt för en tränare med ditt rykte" });
  return parts;
}

/** When the season's outcome is final: record it in the stint, move the reputation, mark honours, open summer vacancies. */
function seasonRecord(state: CareerState, date: string, emit: Emit, force = false): CareerState {
  const outcome = state.seasonOutcome;
  const c = state.managerCareer!;
  const stint = c.stints.at(-1);
  if ((outcome?.phase !== "COMPLETE" && !force) || !stint || stint.to || stint.seasons.some((s) => s.seasonId === state.seasonId)) return state;
  if (state.board?.clubId === state.playerClubId && state.board.seasonId === state.seasonId && !state.board.seasonReviewDone) return state; // the board reviews first
  if (!managerMatchesPlayed(state).some((m) => m.date >= stint.from)) return state; // no match coached at this club this season
  const me = state.playerClubId;
  const table = competitionTable(state, state.competitionId);
  const idx = table.findIndex((r) => r.clubId === me);
  const position = idx >= 0 ? idx + 1 : null;
  const score = state.board?.seasonId === state.seasonId ? objectivesScore(state.board.objectives) : null;
  const honours: string[] = [];
  const ms: ManagerMilestone[] = [];
  if (outcome?.champion === me) { honours.push("Svenska mästare"); ms.push({ date, kind: "TITLE", text: `Svenska mästare med ${nameOf(me)}.`, clubId: me }); }
  if (outcome?.cupWinner === me) { honours.push("Cupvinnare"); ms.push({ date, kind: "CUP", text: `Vann Svenska cupen med ${nameOf(me)}.`, clubId: me }); }
  if (outcome?.promoted.includes(me)) { honours.push("Uppflyttning"); ms.push({ date, kind: "PROMOTION", text: `Förde upp ${nameOf(me)} från ${leagueName(state.competitionId)}.`, clubId: me }); }
  if (outcome?.relegated.includes(me)) { honours.push("Nedflyttning"); ms.push({ date, kind: "RELEGATION", text: `Åkte ur ${leagueName(state.competitionId)} med ${nameOf(me)}.`, clubId: me }); }
  const parts = seasonReputationParts(state, position, score);
  const before = c.reputation;
  const record = clubRecordBetween(state, me, stint.from);
  const seasons = [...stint.seasons, { seasonId: state.seasonId, competitionId: state.competitionId, position, objectivesScore: score, honours, record }];
  let next = withCareer(state, (cc) => {
    let out = parts.reduce((acc, p) => adjustReputation(acc, date, p.points, p.reason, me), cc);
    out = ms.reduce(milestone, out);
    return { ...out, stints: out.stints.map((s, i) => (i === out.stints.length - 1 ? { ...s, seasons } : s)) };
  });
  const delta = next.managerCareer!.reputation - before;
  for (const m of ms) emit(buildClubEvent("MANAGER_CAREER", `milestone:${m.kind}:${state.seasonId}`, date, "IMPORTANT", m.kind === "RELEGATION" ? "Ett tungt besked" : "En milstolpe i karriären", m.text, [{ route: "MANAGER" }]));
  if (delta !== 0) emit(buildClubEvent("MANAGER_CAREER", `reputation:${state.seasonId}`, date, "INFORMATION", delta > 0 ? "Ditt rykte växer" : "Ditt rykte har fått sig en törn", `Ryktet ${delta > 0 ? "steg" : "sjönk"} med ${Math.abs(delta)} till ${next.managerCareer!.reputation} efter säsongen. ${parts.map((p) => `${p.reason} (${p.points > 0 ? "+" : ""}${p.points})`).join(". ")}.`, [{ route: "MANAGER" }]));
  next = seasonEndVacancies(next, date, emit);
  return next;
}

/** The manager's own contract: the board's offer is answered in the Boardroom; without one, the contract simply runs out. */
function contractCheck(state: CareerState, date: string, emit: Emit): CareerState {
  const c = state.managerCareer!;
  if (c.contract.endDate >= date) return state;
  const confidence = state.board?.clubId === state.playerClubId ? state.board.confidence : 60;
  if (confidence >= 45) {
    const contract = { ...c.contract, endDate: seasonEndAfter(state.seasonId, 1) };
    emit(buildClubEvent("MANAGER_CAREER", `auto-extend:${c.contract.endDate}`, date, "IMPORTANT", "Avtalet förlängt ett år", `Ditt avtal gick ut och styrelsen förlängde det till ${contract.endDate} på samma villkor.`, [{ route: "BOARDROOM" }]));
    return withCareer(state, (cc) => milestone({ ...cc, contract }, { date, kind: "CONTRACT", text: `Avtalet med ${nameOf(state.playerClubId)} förlängdes till ${contract.endDate}.`, clubId: state.playerClubId }));
  }
  const clubId = state.playerClubId;
  let next = closeOpenBusiness(state, date);
  next = withCareer(next, (cc) => ({ ...closeStint(next, cc, date, "CONTRACT_ENDED"), seekingJob: { since: date, reason: "CONTRACT_ENDED", clubId }, lastUnemployedReview: date }));
  next = openVacancy(next, { clubId, openedOn: date, closesOn: addDaysIso(date, 30), reason: `${shortOf(clubId)} förlängde inte med sin tränare.` });
  next = offersAfterDismissal(next, date, emit);
  emit(buildClubEvent("MANAGER_CAREER", `contract-ended:${date}`, date, "IMPORTANT", "Ditt avtal har gått ut", `Styrelsen valde att inte förlänga (förtroende ${confidence} av 100). Kalendern fortsätter medan du söker nytt jobb.`, [{ route: "JOB_MARKET" }]));
  return next;
}

/** The season is over: the board reviews it, then the career records it. Idempotent; called the day the season completes and again at rollover. */
export function closeManagerSeason(state: CareerState, date: string, emit: Emit): CareerState {
  let next = ensureManagerCareer(state);
  if (next.board?.clubId === next.playerClubId && next.board.seasonId === next.seasonId) next = boardSeasonEnd(next, date, emit, (s, reason) => dismissManager(s, date, reason, emit));
  if (next.managerCareer!.seekingJob) return seasonEndVacancies(next, date, emit);
  return seasonRecord(next, date, emit, true);
}

/** Rollover safety net for a season that ended before the board existed: no review, no messages, no dismissal -- the season is only recorded. */
export function recordSeasonQuietly(state: CareerState): CareerState {
  let next = ensureManagerCareer(state);
  const b = next.board;
  if (b && b.clubId === next.playerClubId && b.seasonId === next.seasonId && !b.seasonReviewDone) next = { ...next, board: { ...b, seasonReviewDone: true } };
  if (next.managerCareer!.seekingJob) return next;
  return seasonRecord(next, next.gameDate, () => undefined, true);
}

/** The manager accepts the board's extension offer. */
export function acceptBoardContract(state: CareerState): CareerState {
  const offer = state.board?.contractOffer;
  if (!offer || offer.expiresOn < state.gameDate) throw new Error("Erbjudandet gäller inte längre.");
  const s = ensureManagerCareer(state);
  const contract = { ...s.managerCareer!.contract, wageEurPerMonth: offer.wageEurPerMonth, endDate: seasonEndAfter(s.seasonId, offer.years + 1) };
  const next = withCareer(s, (c) => milestone({ ...c, contract }, { date: s.gameDate, kind: "CONTRACT", text: `Nytt avtal med ${nameOf(s.playerClubId)} till ${contract.endDate}.`, clubId: s.playerClubId }));
  return { ...next, board: { ...next.board!, contractOffer: undefined, meetings: [...next.board!.meetings, { id: `meeting:${s.gameDate}:contract`, date: s.gameDate, kind: "CONTRACT" as const, title: "Nytt avtal undertecknat", summary: `${offer.years} år till, ${offer.wageEurPerMonth} € i månaden.`, verdict: "PLEASED" as const }].slice(-20) } };
}

export function declineBoardContract(state: CareerState): CareerState {
  if (!state.board?.contractOffer) return state;
  return { ...state, board: { ...state.board, contractOffer: undefined } };
}
