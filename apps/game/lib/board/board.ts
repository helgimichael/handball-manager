// HM-ALPHA3-M07: the board. Season objectives come from the club's real
// level (predicted position from squad strength), its finances and its
// investment profile; confidence moves monthly toward a target built from
// explained factors (at most 8 points a month, no random swings); the
// mid-season and season-end meetings, warnings, dismissal and contract
// extensions follow from it.
import { buildClubEvent, type CareerEvent } from "../career/careerEvents";
import { clubCompetitionId } from "../career/competitionMembership";
import { ownLevelScore } from "../career/cpuCandidateEvaluation";
import type { CareerState } from "../career/types";
import { getClubBudgets, getClubEconomyBaseline } from "../economy/clubEconomyIntegration";
import { competitionClubIds, competitionTable } from "../competition/tables";
import { ALLSVENSKAN, HANDBOLLSLIGAN, SVENSKA_CUPEN } from "../competition/rules";
import { getClub } from "../game-data";
import { managerMatchesPlayed } from "../players/dynamicsState";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getCareerClubSquad } from "../career/careerWorld";
import type { BoardMeeting, BoardObjective, BoardState, ConfidenceFactor, ObjectiveStatus, BoardPressureStage } from "./types";
import { addDaysIso } from "../players/dynamicsState";
import { svOrdinal } from "../format/ordinal";

type Emit = (event: CareerEvent) => void;
const MONTHLY_STEP = 8;
export const WARNING_LINE = 35;
export const FINAL_WARNING_LINE = 25;
export const DISMISSAL_LINE = 15;

/** The board's (and the press's) expected league position: rank by squad strength within the competition. */
export function predictedPositionOf(state: CareerState, clubId: string, competitionId: string): number {
  const ids = competitionClubIds(state, competitionId);
  const ranked = ids.map((id) => ({ id, level: ownLevelScore(state, id) })).sort((a, b) => b.level - a.level || a.id.localeCompare(b.id));
  return Math.max(1, ranked.findIndex((r) => r.id === clubId) + 1);
}

/** Investment in youth relative to the league: a development club's board asks for youth minutes. */
function isDevelopmentClub(state: CareerState, clubId: string, competitionId: string): boolean {
  const share = (id: string) => { const b = getClubEconomyBaseline(state, id); if (!b) return 0; const rev = b.revenue.commercialRevenueEur + b.revenue.mediaRevenueEur + b.revenue.matchdayRevenueEur + b.revenue.sportingRevenueEur + b.revenue.otherRevenueEur; return rev > 0 ? b.academyBudgetBaselineEur / rev : 0; };
  const all = competitionClubIds(state, competitionId).map(share).sort((a, b) => a - b);
  return all.length > 0 && share(clubId) >= all[Math.floor(all.length * 0.7)]!;
}

export function buildObjectives(state: CareerState, clubId: string): { objectives: BoardObjective[]; predicted: number } {
  const competitionId = clubCompetitionId(state, clubId) ?? state.competitionId;
  const squadRank = predictedPositionOf(state, clubId, competitionId);
  const ids = competitionClubIds(state, competitionId);
  const resources = ids.map(id => ({ id, wages: getClubBudgets(state, id)?.wageBudgetEur ?? 0 }))
    .sort((a,b) => b.wages-a.wages || a.id.localeCompare(b.id));
  const hasWageBudgets = resources.some(r => r.wages > 0);
  const wageRank = hasWageBudgets ? resources.findIndex(r => r.id === clubId)+1 : squadRank;
  let p = Math.round((2*squadRank+wageRank)/3);
  const previous = state.seasonHistory?.at(-1);
  const priorTable = previous?.tables?.[competitionId] ?? (previous?.competitionId === competitionId ? previous.table : undefined);
  const priorIndex = priorTable?.findIndex(row => row.clubId === clubId) ?? -1;
  if (priorIndex >= 0 && Math.abs(priorIndex+1-p) > 2) p += Math.sign(priorIndex+1-p);
  const changedLevel = previous?.outcome?.promoted?.includes(clubId) || previous?.outcome?.relegated?.includes(clubId);
  if (changedLevel) p += 1;
  const financialStatus = state.clubFinances?.[clubId]?.status ?? 'HEALTHY';
  if (financialStatus !== 'HEALTHY') p += financialStatus === 'CRISIS' ? 2 : 1;
  p = Math.max(1,Math.min(Math.max(1,ids.length),p));
  const basis = ` Truppstyrka: ${squadRank}.` + (hasWageBudgets ? ` Lönebudget i serien: ${wageRank}.` : ' Lönebudget saknas; bedömningen utgår från truppen.') +
    (priorIndex >= 0 ? ` Förra säsongen: ${priorIndex+1}.` : '') +
    (changedLevel ? ' Ny serienivå: styrelsen ger laget utrymme att ställa om.' : '') +
    (financialStatus !== 'HEALTHY' ? ' Ekonomin kräver en försiktigare målbild.' : '');
  const out: BoardObjective[] = [];
  const league = (label: string, why: string, target: number, minimum: number) => out.push({ id: "league", kind: "LEAGUE", label, why: why + basis, target, minimum, weight: 3, status: "ON_TRACK", progress: "Serien har inte börjat." });
  if (competitionId === HANDBOLLSLIGAN) {
    if (p <= 2) league("Utmana om seriesegern", `Truppen är en av ligans två starkaste (förhandstips: ${svOrdinal(p)}).`, 2, 4);
    else if (p <= 4) league("Topp fyra i Handbollsligan", `Truppen räknas till toppskiktet (förhandstips: ${svOrdinal(p)}).`, 4, 6);
    else if (p <= 8) league("Ta laget till SM-slutspel", `Truppen räcker till slutspel (förhandstips: ${svOrdinal(p)}).`, 8, 10);
    else if (p <= 11) league("Säkra kontraktet utan kval", `Truppen är bland de svagare (förhandstips: ${svOrdinal(p)}). Plats 11-13 betyder kval.`, 10, 13);
    else league("Undvik direkt nedflyttning", `Truppen är en av ligans svagaste (förhandstips: ${svOrdinal(p)}).`, 13, 13);
  } else if (competitionId === ALLSVENSKAN) {
    if (p <= 2) league("Nå uppflyttning eller kval", `Truppen är seriens starkaste (förhandstips: ${svOrdinal(p)}). Etta går upp, 2-4 spelar kval.`, 2, 4);
    else if (p <= 5) league("Nå kvalplats uppåt", `Truppen räcker för toppen (förhandstips: ${svOrdinal(p)}).`, 4, 6);
    else if (p <= 10) league("En stabil mittenplacering", `Förhandstips: ${svOrdinal(p)}.`, 8, 10);
    else league("Undvik nedflyttning", `Truppen är en av seriens svagaste (förhandstips: ${svOrdinal(p)}).`, 12, 12);
  } else {
    league("Bästa möjliga placering", "Serien följs inte i detalj.", p, p + 2);
  }
  out.push({ id: "finance", kind: "FINANCE", label: "Håll ekonomin i balans", why: "Klubben får inte hamna under krediten.", target: 1, weight: 2, status: "ON_TRACK", progress: "" });
  out.push({ id: "wages", kind: "WAGES", label: "Lönerna inom budget", why: "Styrelsen har satt en lönebudget för säsongen.", target: 1, weight: 1, status: "ON_TRACK", progress: "" });
  // A manager who takes over mid-season is judged from where the team stood that day, not from the summer's expectations.
  const row = competitionTable(state, competitionId).findIndex((r) => r.clubId === clubId);
  const played = row >= 0 ? competitionTable(state, competitionId)[row]!.played : 0;
  const lg = out.find((o) => o.kind === "LEAGUE");
  if (lg && played >= 6 && row + 1 > lg.target) {
    const now = row + 1;
    Object.assign(lg, { label: `Lyft laget från ${svOrdinal(now)} plats`, why: `Du tar över mitt i säsongen när laget ligger ${svOrdinal(now)} (förhandstipset var ${svOrdinal(p)}). Styrelsen vill se laget klättra.`, target: Math.max(1, now - 2), minimum: now });
  }
  if (isDevelopmentClub(state, clubId, competitionId)) out.push({ id: "youth", kind: "YOUTH", label: "Ge unga spelare speltid", why: "Klubben satsar mer än de flesta på sin akademi och vill se det i A-laget.", target: 0.15, weight: 1, status: "ON_TRACK", progress: "" });
  const outOfCup = Object.values(state.competitionTies ?? {}).some((t) => t.competitionId === SVENSKA_CUPEN && t.loserClubId === clubId);
  if (competitionId === HANDBOLLSLIGAN && p <= 3 && !outOfCup) out.push({ id: "cup", kind: "CUP", label: "Nå Final4 i Svenska cupen", why: "Med en topptrupp förväntas klubben gå långt i cupen.", target: 1, weight: 1, status: "ON_TRACK", progress: "" });
  return { objectives: out, predicted: p };
}

export function boardOf(state: CareerState): BoardState | undefined {
  return state.board && state.board.clubId === state.playerClubId ? state.board : undefined;
}

/** A new board relationship (career start, a new club) or a new season's objectives. */
export function ensureBoard(state: CareerState, date: string, emit?: Emit): CareerState {
  const b = state.board;
  if (b && b.clubId === state.playerClubId && b.seasonId === state.seasonId) return state;
  const { objectives, predicted } = buildObjectives(state, state.playerClubId);
  const carried = b && b.clubId === state.playerClubId ? b : undefined;
  const confidence = carried ? carried.confidence : 65;
  const meeting: BoardMeeting = { id: `meeting:${state.seasonId}:start`, date, kind: "SEASON_START", title: `Styrelsens mål för ${state.seasonId}`, summary: objectives.map((o) => o.label).join(" · "), verdict: "SATISFIED" };
  // A new relationship mid-season: what happened before today belongs to the previous coach.
  const startsBaseline = carried ? undefined : Object.fromEntries(getCareerClubSquad(state, state.playerClubId).map((p) => [p.id, state.playerSeasonStats[p.id]?.starts ?? 0]).filter(([, n]) => (n as number) > 0));
  const next: BoardState = { clubId: state.playerClubId, seasonId: state.seasonId, since: date, startsBaseline, predictedPosition: predicted, objectives, confidence, targetConfidence: confidence, factors: [], history: [...(carried?.history ?? []), { date, confidence }].slice(-40), meetings: [...(carried?.meetings ?? []), meeting].slice(-20), warnings: carried?.warnings ?? 0, pressureStage: carried ? boardPressureStage(carried) : 'STABLE', poorReviews: 0, financialReviews: carried?.financialReviews ?? 0, recoveryPlans: carried?.recoveryPlans ?? [], contractOffer: carried?.contractOffer };
  emit?.(buildClubEvent("BOARD_UPDATE", meeting.id + ":" + state.playerClubId, date, "IMPORTANT", meeting.title, `${meeting.summary}. Samlad förhandsbedömning: ${svOrdinal(predicted)}.`, [{ route: "BOARDROOM" }]));
  return { ...state, board: next };
}

function currentPosition(state: CareerState): number | null {
  const table = competitionTable(state, state.competitionId);
  const i = table.findIndex((r) => r.clubId === state.playerClubId);
  return i >= 0 && (table[i]?.played ?? 0) > 0 ? i + 1 : null;
}

function youthShare(state: CareerState, baseline: Record<string, number> = {}): { share: number; starts: number } {
  const squad = getCareerClubSquad(state, state.playerClubId);
  let young = 0, total = 0;
  for (const p of squad) {
    const starts = Math.max(0, (state.playerSeasonStats[p.id]?.starts ?? 0) - (baseline[p.id] ?? 0));
    total += starts;
    // Age at the start of the season, so a youngster who turns 22 in March still counts.
    const age = playerAgeAtDate(p.dateOfBirth, p.birthYear, `${state.seasonId.slice(0, 4)}-07-01`);
    if (age !== null && age <= 21) young += starts;
  }
  return { share: total > 0 ? young / total : 0, starts: total };
}

function cupReachedFinal4(state: CareerState): boolean {
  return Object.values(state.competitionTies ?? {}).some((t) => t.competitionId === SVENSKA_CUPEN && (t.stage === "CUP_SF" || t.stage === "CUP_F") && (t.highClubId === state.playerClubId || t.lowClubId === state.playerClubId));
}

/** Objective status now (final when `final`). */
export function evaluateObjectives(state: CareerState, b: BoardState, final = false): BoardObjective[] {
  const pos = currentPosition(state);
  const status = state.clubFinances?.[state.playerClubId]?.status ?? "HEALTHY";
  const overBudget = getClubBudgets(state, state.playerClubId)?.wageOverBudget ?? false;
  return b.objectives.map((o) => {
    let s: ObjectiveStatus = o.status;
    let progress = o.progress;
    switch (o.kind) {
      case "LEAGUE":
        if (pos === null) { s = "ON_TRACK"; progress = "Serien har inte börjat."; break; }
        progress = `${svOrdinal(pos)} i dag, målet är ${svOrdinal(o.target)} eller bättre.`;
        s = pos <= o.target ? (final ? "MET" : "ON_TRACK") : pos <= (o.minimum ?? o.target) ? (final ? "PARTLY_MET" : "AT_RISK") : (final ? "FAILED" : "AT_RISK");
        break;
      case "FINANCE":
        s = status === "CRISIS" ? "FAILED" : status === "OVERDRAFT" ? (final ? "PARTLY_MET" : "AT_RISK") : final ? "MET" : "ON_TRACK";
        progress = status === "HEALTHY" ? "Kassan är i balans." : status === "OVERDRAFT" ? "Kassan är negativ men inom krediten." : "Klubben ligger under krediten.";
        break;
      case "WAGES":
        s = overBudget ? (final ? "FAILED" : "AT_RISK") : final ? "MET" : "ON_TRACK";
        progress = overBudget ? "Spelarlönerna är över budget." : "Spelarlönerna ryms i budgeten.";
        break;
      case "YOUTH": {
        const { share, starts } = youthShare(state, b.startsBaseline);
        // Nothing to judge before the manager's first matches.
        if (starts === 0) { s = final ? "PARTLY_MET" : "ON_TRACK"; progress = "Inga matcher spelade ännu."; break; }
        progress = `${Math.floor(share * 100)} % av starterna går till spelare 21 år eller yngre (mål ${Math.round(o.target * 100)} %).`;
        s = share >= o.target ? (final ? "MET" : "ON_TRACK") : final ? (share >= o.target * 0.6 ? "PARTLY_MET" : "FAILED") : "AT_RISK";
        break;
      }
      case "CUP": {
        const reached = cupReachedFinal4(state);
        const eliminated = Object.values(state.competitionTies ?? {}).some((t) => t.competitionId === SVENSKA_CUPEN && t.loserClubId === state.playerClubId && t.stage !== "CUP_SF" && t.stage !== "CUP_F" && t.stage !== "CUP_3RD");
        s = reached ? "MET" : eliminated ? "FAILED" : final ? "FAILED" : "ON_TRACK";
        progress = reached ? "Laget är i Final4." : eliminated ? "Utslagna ur cupen." : "Cupen pågår.";
        break;
      }
    }
    return { ...o, status: s, progress };
  });
}

export function objectivesScore(objectives: BoardObjective[]): number {
  const w = objectives.reduce((s, o) => s + o.weight, 0);
  const got = objectives.reduce((s, o) => s + o.weight * (o.status === "MET" || o.status === "ON_TRACK" ? 1 : o.status === "PARTLY_MET" || o.status === "AT_RISK" ? 0.5 : 0), 0);
  return w > 0 ? got / w : 1;
}

/** From when this board judges the manager: his appointment, or the season's start. */
export function boardSince(b: BoardState, state: CareerState): string {
  return b.since ?? b.meetings.find((m) => m.id === `meeting:${b.seasonId}:start`)?.date ?? `${state.seasonId.slice(0, 4)}-07-01`;
}

function boardMatches(state: CareerState, b: BoardState) {
  const competitionId = clubCompetitionId(state,state.playerClubId) ?? state.competitionId;
  return managerMatchesPlayed({...state,fixtures:state.fixtures.filter(f => f.type === 'LEAGUE' && f.competitionId === competitionId)})
    .filter(m => m.date >= boardSince(b,state));
}

/** The explained factors behind the board's target confidence. */
export function confidenceFactors(state: CareerState, b: BoardState): ConfidenceFactor[] {
  const out: ConfidenceFactor[] = [];
  const objectives = evaluateObjectives(state, b);
  const league = objectives.find((o) => o.kind === "LEAGUE");
  const pos = currentPosition(state);
  const played = boardMatches(state,b);
  if (league && pos !== null && played.length >= 4) {
    const gap = league.target - pos;
    const pts = Math.max(-22, Math.min(15, gap * 4));
    out.push({ label: gap >= 0 ? `${svOrdinal(pos)} i serien – i linje med målet (${svOrdinal(league.target)})` : `${svOrdinal(pos)} i serien – målet är ${svOrdinal(league.target)}`, points: pts });
  }
  const recent = played.slice(-5);
  if (recent.length >= 3) {
    const ppg = recent.reduce((s, r) => s + r.points, 0) / recent.length;
    if (ppg >= 1.5) out.push({ label: "Bra form de senaste matcherna", points: 5 });
    else if (ppg <= 0.6) out.push({ label: "Svag form de senaste matcherna", points: -6 });
  }
  // HM-ALPHA3-M08: how the manager handles the media, as the board sees it (bounded, fades monthly).
  const mood = state.media?.boardMood ?? 0;
  if (mood >= 2) out.push({ label: "Du hanterar media väl", points: Math.min(4, mood) });
  else if (mood <= -2) out.push({ label: "Klubben har hamnat i blåsväder i media", points: Math.max(-6, mood) });
  const status = state.clubFinances?.[state.playerClubId]?.status;
  if (status === "CRISIS") out.push({ label: "Klubben är i ekonomisk kris", points: -15 });
  else if (status === "OVERDRAFT") out.push({ label: "Kassan är negativ", points: -6 });
  if (getClubBudgets(state, state.playerClubId)?.wageOverBudget) out.push({ label: "Spelarlönerna är över budget", points: -4 });
  const youth = objectives.find((o) => o.kind === "YOUTH");
  if (youth && played.length >= 8) out.push({ label: youth.status === "ON_TRACK" ? "Unga spelare får chansen" : "För lite speltid åt unga spelare", points: youth.status === "ON_TRACK" ? 3 : -3 });
  const cup = objectives.find((o) => o.kind === "CUP");
  if (cup?.status === "MET") out.push({ label: "Final4 i Svenska cupen", points: 4 });
  if (cup?.status === "FAILED") out.push({ label: "Tidig cuputträning", points: -3 });
  const last = state.seasonHistory?.at(-1)?.outcome;
  const me = state.playerClubId;
  if (last && state.managerCareer?.stints.at(-1)?.seasons.some((s) => s.seasonId === state.seasonHistory!.at(-1)!.seasonId)) {
    if (last.champion === me || last.cupWinner === me || last.promoted?.includes(me)) out.push({ label: "Förra säsongens framgång", points: 8 });
  }
  if ((b.poorReviews ?? 0) > 1) out.push({label:'Upprepad sportslig underprestation',points:-Math.min(18,((b.poorReviews ?? 0)-1)*6)});
  if ((b.financialReviews ?? 0) > 1) out.push({label:'Ekonomiska problem under flera granskningar',points:-Math.min(18,((b.financialReviews ?? 0)-1)*6)});
  const plan = b.recoveryPlans?.at(-1);
  if (plan?.reviewedOn && plan.reviewedOn === b.lastMonthly) out.push({label:plan.status === 'MET' ? 'Handlingsplanen gav en tydlig förbättring' : 'Handlingsplanen gav inte den förbättring ni kom överens om',points:plan.status === 'MET' ? 6 : -6});
  if (out.length === 0 && b.confidence < 55) out.push({label:'Läget har stabiliserats; förtroendet återhämtar sig gradvis',points:0});
  return out;
}

export const BOARD_PRESSURE_LABEL: Record<BoardPressureStage,string> = {
  STABLE:'Stabilt', CONCERN:'Oro', WARNING:'Varning', CRITICAL:'Kritiskt', DISMISSAL:'Avskedad'
};
export function boardPressureStage(b: BoardState): BoardPressureStage {
  return b.pressureStage ?? (b.meetings.at(-1)?.kind === 'DISMISSAL' ? 'DISMISSAL' : b.warnings >= 2 ? 'CRITICAL' : b.warnings === 1 ? 'WARNING' : b.confidence < 45 ? 'CONCERN' : 'STABLE');
}
function recoveryEvidence(state: CareerState, b: BoardState) {
  const matches = boardMatches(state,b).slice(-5);
  return {position:currentPosition(state),form:matches.length >= 3 ? matches.reduce((n,m)=>n+m.points,0)/matches.length : null,
    finance:state.clubFinances?.[state.playerClubId]?.status === 'CRISIS' ? 2 : state.clubFinances?.[state.playerClubId]?.status === 'OVERDRAFT' ? 1 : 0,
    overBudget:getClubBudgets(state,state.playerClubId)?.wageOverBudget ?? false};
}
/** A measurable response, not a free confidence boost or a player promise. */
export function submitBoardRecoveryPlan(state: CareerState, meetingId: string): CareerState {
  const b = boardOf(state);
  if (!b || state.managerCareer?.seekingJob) throw new Error('Du leder inte klubben.');
  const meeting = b.meetings.find(m => m.id === meetingId);
  const eventId = `BOARD_UPDATE:${meetingId}`;
  const event = state.careerEvents.find(e => e.id === eventId && e.requiresAction && !e.resolved);
  if (!meeting || !['WARNING','FINAL_WARNING'].includes(meeting.kind) || !event) throw new Error('Det finns inget obesvarat styrelsemöte.');
  if (b.recoveryPlans?.some(p => p.meetingId === meetingId || p.status === 'ACTIVE')) throw new Error('Handlingsplanen är redan registrerad.');
  const plan = {meetingId,agreedOn:state.gameDate,baseline:recoveryEvidence(state,b),status:'ACTIVE' as const};
  return {...state,board:{...b,recoveryPlans:[...(b.recoveryPlans ?? []),plan].slice(-12)},
    careerEvents:state.careerEvents.map(e => e.id === eventId ? {...e,resolved:true,requiresAction:false,read:true} : e),
    inbox:state.inbox.map(m => m.careerEventId === eventId ? {...m,resolved:true,actionRequired:false,read:true} : m)};
}

/** Monthly (1st), mid-season (2 January) and season-end board work. */
export function progressBoard(state: CareerState, date: string, emit: Emit, onDismissed: (s: CareerState, reason: string) => CareerState): CareerState {
  let next = ensureBoard(state, date, emit);
  let b = next.board!;
  if (state.managerCareer?.seekingJob) return next;
  if (date.endsWith("-01") && (!b.lastMonthly || b.lastMonthly < date)) {
    const evidence = recoveryEvidence(next,b);
    const league = b.objectives.find(o => o.kind === 'LEAGUE');
    const poor = league && evidence.position !== null && evidence.position > (league.minimum ?? league.target) && evidence.form !== null && evidence.form <= .8;
    b = {...b,poorReviews:poor ? (b.poorReviews ?? 0)+1 : 0,financialReviews:evidence.finance > 0 || evidence.overBudget ? (b.financialReviews ?? 0)+1 : 0};
    const active = b.recoveryPlans?.find(p => p.status === 'ACTIVE');
    if (active && addDaysIso(active.agreedOn,28) <= date) {
      const old = active.baseline;
      const improved = (old.position !== null && evidence.position !== null && evidence.position <= old.position-2) ||
        (old.form !== null && evidence.form !== null && evidence.form >= old.form+.5) || evidence.finance < old.finance || (old.overBudget && !evidence.overBudget);
      b = {...b,recoveryPlans:b.recoveryPlans!.map(p => p === active ? {...p,status:improved ? 'MET' : 'FAILED',reviewedOn:date} : p),lastMonthly:date};
    }
    b = {...b,lastMonthly:date};
    const factors = confidenceFactors(next, b);
    const target = factors.length === 0 ? b.confidence : Math.max(5, Math.min(98, 55 + factors.reduce((s, f) => s + f.points, 0)));
    const step = Math.max(-MONTHLY_STEP, Math.min(MONTHLY_STEP, target - b.confidence));
    const confidence = Math.round(b.confidence + step);
    const stages: BoardPressureStage[] = ['STABLE','CONCERN','WARNING','CRITICAL','DISMISSAL'];
    const before = boardPressureStage(b);
    const desired = confidence < DISMISSAL_LINE ? 4 : confidence < FINAL_WARNING_LINE ? 3 : confidence < WARNING_LINE ? 2 : confidence < 45 ? 1 : 0;
    const pendingPressure = b.meetings.some(m => next.careerEvents.some(e => e.id === `BOARD_UPDATE:${m.id}` && e.requiresAction && !e.resolved));
    const stage = (pendingPressure || (step > 0 && target > b.targetConfidence)) && desired > stages.indexOf(before) ? before : stages[Math.min(desired,stages.indexOf(before)+1)]!;
    b = { ...b, confidence, targetConfidence: Math.round(target), factors, lastMonthly: date, pressureStage:stage,
      warnings:stage === 'CRITICAL' || stage === 'DISMISSAL' ? 2 : stage === 'WARNING' ? 1 : 0,
      objectives: evaluateObjectives(next, b), history: [...b.history, { date, confidence }].slice(-40) };
    next = { ...next, board: b };
    const summary = `Förtroende ${confidence}/100. ${worstFactor(factors)} ` +
      (evidence.finance > 0 ? 'Ekonomin behöver stabiliseras. ' : '') +
      (stage === 'WARNING' || stage === 'CRITICAL' ? 'Lämna en handlingsplan i styrelserummet. Vid nästa granskning efter minst 28 dagar ska placeringen ha stigit två steg, formen med 0,5 poäng per match eller ekonomin ha förbättrats. Uppfyllt: +6 till målförtroendet; annars -6.' : '');
    if (stage === 'DISMISSAL') return onDismissed(addMeeting(next,{id:`meeting:${date}:dismissal`,date,kind:'DISMISSAL',title:'Styrelsen bryter samarbetet',summary:`Efter två varningar. ${summary}`,verdict:'DISMISSED'},emit),summary);
    // At most one unanswered pressure meeting, even through direct tick calls.
    const unresolved = b.meetings.some(m => next.careerEvents.some(e => e.id === `BOARD_UPDATE:${m.id}` && e.requiresAction && !e.resolved));
    if (stage !== before && !unresolved) next = addMeeting(next,{id:`meeting:${date}:pressure:${stage}`,date,
      kind:stage === 'CRITICAL' ? 'FINAL_WARNING' : stage === 'WARNING' ? 'WARNING' : 'MID_SEASON',
      title:`Styrelsens granskning: ${BOARD_PRESSURE_LABEL[stage]}`,summary,verdict:stage === 'STABLE' ? 'SATISFIED' : stage === 'CONCERN' ? 'CONCERNED' : 'WARNING'},emit);
    else if (Math.abs(step) >= 4 || evidence.finance > 0 || active?.status === 'ACTIVE') emit(buildClubEvent('BOARD_UPDATE',`review:${state.playerClubId}:${date}`,date,'INFORMATION','Styrelsens månadsgranskning',summary,[{route:'BOARDROOM'}]));

  }
  b = next.board!;
  if (date.slice(5) === "01-02" && !b.midSeasonDone) {
    const objectives = evaluateObjectives(next, b);
    const score = objectivesScore(objectives);
    next = addMeeting({ ...next, board: { ...b, objectives, midSeasonDone: true } }, { id: `meeting:${state.seasonId}:mid`, date, kind: "MID_SEASON", title: "Halvtidsmöte med styrelsen", summary: objectives.map((o) => `${o.label}: ${o.progress}`).join(" "), verdict: score >= 0.75 ? "PLEASED" : score >= 0.5 ? "SATISFIED" : "CONCERNED" }, emit);
  }
  b = next.board!;
  if (next.seasonOutcome?.phase === "COMPLETE" && !b.seasonReviewDone) next = seasonReview(next, date, emit, onDismissed);
  return next;
}

/** The season-end review, once per season, whatever triggers it (the day the season completes, or the rollover as a safety net). */
export function boardSeasonEnd(state: CareerState, date: string, emit: Emit, onDismissed: (s: CareerState, reason: string) => CareerState): CareerState {
  const b = state.board;
  if (!b || b.clubId !== state.playerClubId || b.seasonId !== state.seasonId || b.seasonReviewDone || state.managerCareer?.seekingJob) return state;
  // A manager appointed after the last match has nothing to be reviewed on.
  const since = boardSince(b, state);
  if (!managerMatchesPlayed(state).some((m) => m.date >= since)) return { ...state, board: { ...b, seasonReviewDone: true, midSeasonDone: true } };
  return seasonReview(state, date, emit, onDismissed);
}

function seasonReview(state: CareerState, date: string, emit: Emit, onDismissed: (s: CareerState, reason: string) => CareerState): CareerState {
  const b = state.board!;
  const objectives = evaluateObjectives(state, b, true);
  const score = objectivesScore(objectives);
  const lines = objectives.map((o) => `${o.label}: ${o.status === "MET" ? "uppfyllt" : o.status === "PARTLY_MET" ? "delvis" : "inte uppfyllt"} (${o.progress})`).join(" ");
  let next: CareerState = { ...state, board: { ...b, objectives, seasonReviewDone: true } };
  const leagueFailed = objectives.some((o) => o.kind === "LEAGUE" && o.status === "FAILED");
  // Dismissal at the review: a poor season with little trust left, or a final warning that was never turned around.
  if (b.warnings >= 2 && boardPressureStage(b) === 'CRITICAL' && b.confidence < 30) {
    return onDismissed(addMeeting(next, { id: `meeting:${state.seasonId}:review`, date, kind: "DISMISSAL", title: "Säsongsgenomgången: styrelsen bryter samarbetet", summary: lines, verdict: "DISMISSED" }, emit), b.warnings >= 2 ? `Säsongens mål uppnåddes inte och förtroendet (${b.confidence}) vände aldrig efter sista varningen.` : "Säsongens mål uppnåddes inte.");
  }
  const verdict = score >= 0.75 ? "PLEASED" : score >= 0.5 && !leagueFailed ? "SATISFIED" : score >= 0.4 && b.confidence >= 45 ? "SATISFIED" : "WARNING";
  const stages: BoardPressureStage[] = ['STABLE','CONCERN','WARNING','CRITICAL'];
  const reviewStage = verdict === 'WARNING' ? stages[Math.min(3,stages.indexOf(boardPressureStage(b))+1)]! : boardPressureStage(b);
  next = addMeeting(next, { id: `meeting:${state.seasonId}:review`, date, kind: verdict === 'WARNING' && reviewStage === 'CRITICAL' ? 'FINAL_WARNING' : verdict === 'WARNING' && reviewStage === 'WARNING' ? 'WARNING' : 'SEASON_REVIEW', title: verdict === "PLEASED" ? "Säsongsgenomgången: styrelsen är nöjd" : verdict === "SATISFIED" ? "Säsongsgenomgången: godkänt" : "Säsongsgenomgången: sista chansen", summary: lines, verdict }, emit);
  if (verdict === "WARNING") next = { ...next, board: { ...next.board!, warnings:reviewStage === 'CRITICAL' ? 2 : reviewStage === 'WARNING' ? 1 : 0, pressureStage:reviewStage } };
  const contract = next.managerCareer?.contract;
  const seasonEnd = `${Number(state.seasonId.slice(0, 4)) + 1}-05-31`;
  if (contract && contract.clubId === next.playerClubId && contract.endDate <= `${Number(seasonEnd.slice(0, 4)) + 1}-05-31` && score >= 0.6) {
    const offer = { years: 2, wageEurPerMonth: Math.round(contract.wageEurPerMonth * (score >= 0.85 ? 1.15 : 1.05)), offeredOn: date, expiresOn: addDaysIso(date, 21) };
    next = { ...next, board: { ...next.board!, contractOffer: offer } };
    emit(buildClubEvent("BOARD_UPDATE", `contract-offer:${state.seasonId}`, date, "IMPORTANT", "Styrelsen erbjuder ett nytt avtal", `Två år till, ${offer.wageEurPerMonth} € i månaden. Svara senast ${offer.expiresOn}.`, [{ route: "BOARDROOM" }]));
  }
  return next;
}

function worstFactor(factors: ConfidenceFactor[]): string {
  const worst = [...factors].sort((a, b) => a.points - b.points)[0];
  return worst && worst.points < 0 ? `Främst: ${worst.label.charAt(0).toLowerCase()}${worst.label.slice(1)}.` : "";
}

function addMeeting(state: CareerState, m: BoardMeeting, emit: Emit): CareerState {
  const b = state.board!;
  emit(buildClubEvent("BOARD_UPDATE", m.id, m.date, m.kind === 'DISMISSAL' || (['WARNING','FINAL_WARNING'].includes(m.kind) && !b.recoveryPlans?.some(p => p.status === 'ACTIVE')) ? 'ACTION_REQUIRED' : 'IMPORTANT', m.title, m.summary, [{ route: "BOARDROOM" }]));
  return { ...state, board: { ...b, ...(m.kind === 'DISMISSAL' ? {pressureStage:'DISMISSAL' as const} : {}), meetings: [...b.meetings, m].slice(-20) } };
}

export function clubName(id: string): string {
  return getClub(id)?.shortName ?? id;
}

