// HM-ALPHA3-M07: the manager's own career. Reputation grows and shrinks
// with results and honours; the contract runs out or is extended by the
// board; CPU clubs that badly underperform sack their head coach and open
// a vacancy (held open a few weeks before the CPU staff market fills it);
// the manager can apply, is interviewed (three questions whose "right"
// answer follows from the club's own situation), and receives an offer or
// an explained rejection. Strong managers are approached. A sacked manager
// is never stranded: clubs within reach make offers and Continue waits
// until one is accepted.
import { buildClubEvent, type CareerEvent } from "../career/careerEvents";
import { clubCompetitionId } from "../career/competitionMembership";
import { getCareerClubSquad } from "../career/careerWorld";
import type { CareerState } from "../career/types";
import { getClubEconomyBaseline } from "../economy/clubEconomyIntegration";
import { ALLSVENSKAN, HANDBOLLSLIGAN } from "../competition/rules";
import { competitionClubIds, competitionTable, hasLeagueCalendar } from "../competition/tables";
import { getClub } from "../game-data";
import { releaseStaff } from "../staff/staffNegotiation";
import { addDaysIso, hash, managerMatchesPlayed } from "../players/dynamicsState";
import { boardSeasonEnd, objectivesScore, predictedPositionOf } from "../board/board";
import type { InterviewQuestion, JobApplication, JobOffer, ManagerCareerState, ManagerMilestone, Vacancy } from "../board/types";

type Emit = (event: CareerEvent) => void;

const nameOf = (clubId: string) => getClub(clubId)?.name ?? clubId;
const shortOf = (clubId: string) => getClub(clubId)?.shortName ?? clubId;

/** How big a job is (0-100): league tier plus the club's economic band. Also the reputation a club wants in its head coach. */
export function clubStature(state: CareerState, clubId: string): number {
  const comp = clubCompetitionId(state, clubId) ?? getClub(clubId)?.competitionId;
  const band = Number(getClubEconomyBaseline(state, clubId)?.band.slice(1) ?? 7);
  const base = comp === HANDBOLLSLIGAN ? 52 : comp === ALLSVENSKAN ? 28 : 20;
  return Math.max(10, Math.min(92, base + (6 - band) * 4));
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
  const career: ManagerCareerState = {
    reputation: Math.max(15, clubStature(state, clubId) - 6),
    contract: { clubId, wageEurPerMonth: managerWageFor(state, clubId), startDate: from, endDate: seasonEndAfter(state.seasonId, 2) },
    stints: [{ clubId, from, seasons: [] }],
    vacancies: [],
    applications: {},
    offers: {},
    milestones: [{ date: from, kind: "APPOINTED", text: `Tog över som huvudtränare i ${nameOf(clubId)}.`, clubId }],
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

/** Clubs a manager can coach: Swedish league clubs with a calendar and a squad this season. */
export function eligibleClubs(state: CareerState): string[] {
  return [HANDBOLLSLIGAN, ALLSVENSKAN].filter((c) => hasLeagueCalendar(state, c)).flatMap((c) => competitionClubIds(state, c)).filter((id) => getCareerClubSquad(state, id).length >= 12);
}

/** Open head-coach jobs -- not the manager's own club, and not a club that has sacked him. */
export function openVacancies(state: CareerState, date = state.gameDate): Vacancy[] {
  const sackedBy = new Set((state.managerCareer?.stints ?? []).filter((s) => s.leftReason === "DISMISSED").map((s) => s.clubId));
  return (state.managerCareer?.vacancies ?? []).filter((v) => v.closesOn >= date && v.clubId !== state.playerClubId && !sackedBy.has(v.clubId));
}

export function hasOpenVacancy(state: CareerState, clubId: string, date: string): boolean {
  return (state.managerCareer?.vacancies ?? []).some((v) => v.clubId === clubId && v.closesOn >= date);
}

// ---------------------------------------------------------------------------
// Vacancies
// ---------------------------------------------------------------------------

function headCoachOf(state: CareerState, clubId: string) {
  return (state.staffRoster[clubId] ?? []).find((m) => m.roles[0] === "HEAD_COACH");
}

/** CPU sackings: November to March, at most one a month, among clubs far below their expected place. */
function cpuSackings(state: CareerState, date: string, emit: Emit): CareerState {
  const month = Number(date.slice(5, 7));
  if (![11, 12, 1, 2, 3].includes(month)) return state;
  const candidates: { clubId: string; gap: number }[] = [];
  for (const comp of [HANDBOLLSLIGAN, ALLSVENSKAN]) {
    if (!hasLeagueCalendar(state, comp)) continue;
    const table = competitionTable(state, comp);
    table.forEach((row, i) => {
      if (row.clubId === state.playerClubId || row.played < 8 || hasOpenVacancy(state, row.clubId, date)) return;
      const gap = i + 1 - predictedPositionOf(state, row.clubId, comp);
      if (gap >= 4) candidates.push({ clubId: row.clubId, gap });
    });
  }
  const pick = candidates.sort((a, b) => b.gap - a.gap || a.clubId.localeCompare(b.clubId))[0];
  if (!pick || hash(`${state.saveSeed}:sack:${date}:${pick.clubId}`) > 0.45) return state;
  let next = state;
  const coach = headCoachOf(next, pick.clubId);
  if (coach) next = releaseStaff(next, coach.id, date, "DISMISSED");
  const vacancy: Vacancy = { clubId: pick.clubId, openedOn: date, closesOn: addDaysIso(date, 30), reason: `${shortOf(pick.clubId)} ligger långt under förväntan och har sparkat ${coach ? coach.displayName : "sin tränare"}.` };
  next = withCareer(next, (c) => ({ ...c, vacancies: [...c.vacancies.filter((v) => v.clubId !== pick.clubId), vacancy] }));
  emit(buildClubEvent("MANAGER_CAREER", `vacancy:${pick.clubId}:${date}`, date, "INFORMATION", `${shortOf(pick.clubId)} söker ny huvudtränare`, `${vacancy.reason} Tjänsten är öppen för ansökningar till ${vacancy.closesOn}.`, [{ route: "JOB_MARKET" }]));
  return next;
}

/** At season end two or three more clubs change coach (contracts ending, new ambitions). */
function seasonEndVacancies(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  const pool = eligibleClubs(state).filter((id) => id !== state.playerClubId && !hasOpenVacancy(state, id, date));
  const chosen = pool.map((id) => ({ id, r: hash(`${state.saveSeed}:${state.seasonId}:summer-vacancy:${id}`) })).sort((a, b) => a.r - b.r).slice(0, 3);
  for (const { id } of chosen) {
    const coach = headCoachOf(next, id);
    if (coach) next = releaseStaff(next, coach.id, date, "LEFT");
    const vacancy: Vacancy = { clubId: id, openedOn: date, closesOn: addDaysIso(date, 30), reason: `${coach ? coach.displayName : "Tränaren"} lämnar ${shortOf(id)} efter säsongen.` };
    next = withCareer(next, (c) => ({ ...c, vacancies: [...c.vacancies.filter((v) => v.clubId !== id), vacancy] }));
    emit(buildClubEvent("MANAGER_CAREER", `vacancy:${id}:${date}`, date, "INFORMATION", `${shortOf(id)} söker ny huvudtränare`, `${vacancy.reason} Ansök senast ${vacancy.closesOn}.`, [{ route: "JOB_MARKET" }]));
  }
  return next;
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
  if (clubId === s.playerClubId) throw new Error("Du arbetar redan i klubben.");
  if (!hasOpenVacancy(s, clubId, s.gameDate)) throw new Error("Klubben söker ingen tränare just nu.");
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

/** The club's verdict: reputation against the job's stature, adjusted by how well the answers fit. Explained either way. */
export function interviewVerdict(state: CareerState, a: JobApplication): { hired: boolean; note: string; fit: number } {
  const wish = clubWish(state, a.clubId);
  const rep = managerCareerOf(state).reputation;
  const need = clubStature(state, a.clubId);
  const matches: string[] = [], misses: string[] = [];
  const check = (id: keyof ClubWish, good: string, bad: string) => (a.answers?.[id] === wish[id] ? matches.push(good) : misses.push(bad));
  check("goal", "målbilden stämde med styrelsens", "styrelsen såg en annan målbild för laget");
  check("youth", "synen på unga spelare passade klubben", "synen på unga spelare passade inte klubben");
  check("money", "synen på ekonomin övertygade", "synen på ekonomin oroade styrelsen");
  const fit = matches.length * 4 - misses.length * 3;
  const hired = rep + fit >= need - 6;
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
// Dismissal
// ---------------------------------------------------------------------------

/** The board ends the relationship: the stint closes, reputation drops, and clubs within reach come forward. */
export function dismissManager(state: CareerState, date: string, reason: string, emit: Emit): CareerState {
  if (state.managerCareer?.seekingJob) return state;
  let next = ensureManagerCareer(state);
  const clubId = next.playerClubId;
  next = withCareer(next, (c) => milestone({ ...c, contract:{...c.contract,endDate:date}, reputation: Math.max(5, c.reputation - 6), stints: c.stints.map((s, i) => (i === c.stints.length - 1 && !s.to ? { ...s, to: date, leftReason: "DISMISSED" } : s)), seekingJob: { since: date, reason: "DISMISSED" } }, { date, kind: "DISMISSED", text: `Sparkad av ${nameOf(clubId)}. ${reason}`, clubId }));
  next = offersAfterDismissal(next, date, emit);
  emit(buildClubEvent("MANAGER_CAREER", `dismissed:${clubId}:${date}`, date, "ACTION_REQUIRED", `${shortOf(clubId)} har sparkat dig`, `${reason} Du leder inte längre laget – välj bland erbjudandena på jobbmarknaden för att fortsätta.`, [{ route: "JOB_MARKET" }]));
  return next;
}

/** A sacked manager is never stranded: the two or three clubs whose stature fits the reputation make offers. */
function offersAfterDismissal(state: CareerState, date: string, emit: Emit): CareerState {
  const c = state.managerCareer!;
  const fits = eligibleClubs(state).filter((id) => id !== state.playerClubId)
    .map((id) => ({ id, d: Math.abs(clubStature(state, id) - (c.reputation - 4)) + (hasOpenVacancy(state, id, date) ? -6 : 0) + hash(`${state.saveSeed}:after:${date}:${id}`) * 4 }))
    .sort((a, b) => a.d - b.d).slice(0, 3);
  let next = state;
  for (const { id } of fits) {
    const offer = makeOffer(state, id, "AFTER_DISMISSAL", date, hasOpenVacancy(state, id, date) ? `${shortOf(id)} söker tränare och vill ha dig.` : `${shortOf(id)} är beredda att byta tränare för att få dig.`);
    next = withCareer(next, (cc) => ({ ...cc, offers: { ...cc.offers, [offer.id]: offer } }));
    emit(buildClubEvent("MANAGER_CAREER", offer.id, date, "IMPORTANT", `Erbjudande från ${shortOf(id)}`, `${offer.pitch} ${offer.years} år, ${offer.wageEurPerMonth} € i månaden.`, [{ route: "JOB_MARKET" }]));
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

  if (next.managerCareer!.seekingJob) {
    // Never stranded: if every offer has lapsed, new ones come.
    if (openOffers({ ...next, gameDate: date }).length === 0) next = offersAfterDismissal(next, date, emit);
    return next;
  }

  if (date.endsWith("-01") && next.managerCareer!.lastMarketRun !== date) {
    next = cpuSackings(next, date, emit);
    next = approaches(next, date, emit);
    next = withCareer(next, (cc) => ({ ...cc, lastMarketRun: date }));
  }

  next = seasonRecord(next, date, emit);
  next = contractCheck(next, date, emit);
  return next;
}

/** A bigger club with a vacancy that rates the manager may make an approach. */
function approaches(state: CareerState, date: string, emit: Emit): CareerState {
  const c = state.managerCareer!;
  const own = clubStature(state, state.playerClubId);
  for (const v of openVacancies(state, date)) {
    const s = clubStature(state, v.clubId);
    if (s <= own || s > c.reputation + 4) continue;
    if (Object.values(c.offers).some((o) => o.clubId === v.clubId && o.offeredOn >= v.openedOn)) continue;
    if (hash(`${state.saveSeed}:approach:${date}:${v.clubId}`) > 0.4) continue;
    const offer = makeOffer(state, v.clubId, "APPROACH", date, `${shortOf(v.clubId)} har följt ditt arbete och vill ha dig som huvudtränare.`);
    emit(buildClubEvent("MANAGER_CAREER", offer.id, date, "IMPORTANT", `${shortOf(v.clubId)} hör av sig`, `${offer.pitch} ${offer.years} år, ${offer.wageEurPerMonth} € i månaden. Svara senast ${offer.expiresOn}.`, [{ route: "JOB_MARKET" }]));
    return withCareer(state, (cc) => ({ ...cc, offers: { ...cc.offers, [offer.id]: offer } }));
  }
  return state;
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
  let delta = score === null ? 0 : Math.round((score - 0.55) * 14);
  if (outcome?.champion === me) { honours.push("Svenska mästare"); ms.push({ date, kind: "TITLE", text: `Svenska mästare med ${nameOf(me)}.`, clubId: me }); delta += 8; }
  if (outcome?.cupWinner === me) { honours.push("Cupvinnare"); ms.push({ date, kind: "CUP", text: `Vann Svenska cupen med ${nameOf(me)}.`, clubId: me }); delta += 5; }
  if (outcome?.promoted.includes(me)) { honours.push("Uppflyttning"); ms.push({ date, kind: "PROMOTION", text: `Förde upp ${nameOf(me)} till Handbollsligan.`, clubId: me }); delta += 6; }
  if (outcome?.relegated.includes(me)) { honours.push("Nedflyttning"); ms.push({ date, kind: "RELEGATION", text: `Åkte ur med ${nameOf(me)}.`, clubId: me }); delta -= 8; }
  const seasons = [...stint.seasons, { seasonId: state.seasonId, competitionId: state.competitionId, position, objectivesScore: score, honours }];
  let next = withCareer(state, (cc) => ms.reduce(milestone, { ...cc, reputation: Math.max(5, Math.min(95, cc.reputation + delta)), stints: cc.stints.map((s, i) => (i === cc.stints.length - 1 ? { ...s, seasons } : s)) }));
  for (const m of ms) emit(buildClubEvent("MANAGER_CAREER", `milestone:${m.kind}:${state.seasonId}`, date, "IMPORTANT", m.kind === "RELEGATION" ? "Ett tungt besked" : "En milstolpe i karriären", m.text, [{ route: "MANAGER" }]));
  if (delta !== 0) emit(buildClubEvent("MANAGER_CAREER", `reputation:${state.seasonId}`, date, "INFORMATION", delta > 0 ? "Ditt rykte växer" : "Ditt rykte har fått sig en törn", `Ryktet ${delta > 0 ? "steg" : "sjönk"} med ${Math.abs(delta)} till ${next.managerCareer!.reputation} efter säsongen.`, [{ route: "MANAGER" }]));
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
  let next = withCareer(state, (cc) => ({ ...cc, stints: cc.stints.map((s, i) => (i === cc.stints.length - 1 && !s.to ? { ...s, to: date, leftReason: "CONTRACT_ENDED" } : s)), seekingJob: { since: date, reason: "CONTRACT_ENDED" } }));
  next = offersAfterDismissal(next, date, emit);
  emit(buildClubEvent("MANAGER_CAREER", `contract-ended:${date}`, date, "ACTION_REQUIRED", "Ditt avtal har gått ut", `Styrelsen valde att inte förlänga (förtroende ${confidence} av 100). Välj en ny klubb på jobbmarknaden för att fortsätta.`, [{ route: "JOB_MARKET" }]));
  return next;
}

/** The season is over: the board reviews it, then the career records it. Idempotent; called the day the season completes and again at rollover. */
export function closeManagerSeason(state: CareerState, date: string, emit: Emit): CareerState {
  let next = ensureManagerCareer(state);
  if (next.board?.clubId === next.playerClubId && next.board.seasonId === next.seasonId) next = boardSeasonEnd(next, date, emit, (s, reason) => dismissManager(s, date, reason, emit));
  return seasonRecord(next, date, emit, true);
}

/** Rollover safety net for a season that ended before the board existed: no review, no messages, no dismissal -- the season is only recorded. */
export function recordSeasonQuietly(state: CareerState): CareerState {
  let next = ensureManagerCareer(state);
  const b = next.board;
  if (b && b.clubId === next.playerClubId && b.seasonId === next.seasonId && !b.seasonReviewDone) next = { ...next, board: { ...b, seasonReviewDone: true } };
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
