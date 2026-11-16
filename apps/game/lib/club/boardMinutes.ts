// Arena Nights -- Board Minutes (CLB-05 C), the verdict moment (CLB-05a B) and the meeting moment's options
// (CLB-05b B). A read-only view over the board the game already keeps: meetings, confidence history, factors,
// recovery plans, the contract offer and the manager's reputation. No board rule is evaluated here beyond the
// existing evaluateObjectives / boardPressureStage; consequence lines restate the rules the board applies.
import type { CareerState } from "../career/types";
import type { BoardMeeting, BoardObjective, BoardPressureStage, BoardRecoveryPlan, BoardState, ConfidenceFactor } from "../board/types";
import { boardOf, boardPressureStage, BOARD_PRESSURE_LABEL, DISMISSAL_LINE, ensureBoard, evaluateObjectives, FINAL_WARNING_LINE, WARNING_LINE } from "../board/board";
import { managerCareerOf } from "../manager/managerCareer";
import { getLiveStandings, getPlayerClubPosition } from "../career/standings";

export type MinuteTone = "good" | "warn" | "bad" | "neutral";
export const MEETING_KIND_LABEL: Record<BoardMeeting["kind"], string> = { SEASON_START: "Säsongsstart", MID_SEASON: "Halvtidsmöte", WARNING: "Varning", FINAL_WARNING: "Sista varning", SEASON_REVIEW: "Säsongsgenomgång", DISMISSAL: "Avsked", CONTRACT: "Avtal" };
export const VERDICT_LABEL: Record<BoardMeeting["verdict"], string> = { PLEASED: "Nöjd", SATISFIED: "Godkänt", CONCERNED: "Oroad", WARNING: "Varning", DISMISSED: "Avsked" };
export const OBJECTIVE_STATUS_LABEL: Record<BoardObjective["status"], string> = { ON_TRACK: "I fas", AT_RISK: "I fara", MET: "Uppfyllt", PARTLY_MET: "Delvis", FAILED: "Missat" };
const verdictTone: Record<BoardMeeting["verdict"], MinuteTone> = { PLEASED: "good", SATISFIED: "neutral", CONCERNED: "warn", WARNING: "bad", DISMISSED: "bad" };
const stageTone: Record<BoardPressureStage, MinuteTone> = { STABLE: "good", CONCERN: "warn", WARNING: "bad", CRITICAL: "bad", DISMISSAL: "bad" };

/** What the board demanded at a meeting, in its terms. */
function demandOf(m: BoardMeeting): string {
  switch (m.kind) {
    case "SEASON_START": return m.summary ? `Säsongens mål: ${m.summary}` : "Säsongens mål sattes.";
    case "MID_SEASON": return "Avstämning av målen vid halvtid.";
    case "WARNING": return "En handlingsplan och en tydlig förbättring före nästa granskning.";
    case "FINAL_WARNING": return "Sista chansen: en handlingsplan och en förbättring, annars avsked.";
    case "SEASON_REVIEW": return "Bedömning av hela säsongen mot målen.";
    case "CONTRACT": return "Avtalet med klubben.";
    case "DISMISSAL": return "Samarbetet avslutades.";
  }
}

export interface ObjectiveMeter { id: string; label: string; status: BoardObjective["status"]; statusLabel: string; progress: string; why: string; tone: MinuteTone;
  /** LEAGUE only, once the table has games: 0 = last, 1 = first; the board's target and minimum on the same scale. */
  meter: { value: number; target: number; minimum: number | null; position: number; teams: number } | null }

export interface MinuteEntry {
  id: string; date: string; kind: BoardMeeting["kind"]; kindLabel: string; verdict: BoardMeeting["verdict"]; verdictLabel: string; tone: MinuteTone;
  title: string; summary: string; demanded: string;
  /** What you did about it -- a recovery plan, a signed contract -- or that it is still waiting for you. */
  response: string | null;
  /** How it ended: the plan's review, when there was one. */
  outcome: { label: string; tone: MinuteTone } | null;
  plan: BoardRecoveryPlan | null;
  confidenceAt: number | null;
  confidenceDelta: number | null;
  open: boolean;
}

export type OpenDecision =
  | { kind: "RECOVERY"; meetingId: string; title: string; summary: string; finalWarning: boolean }
  | { kind: "CONTRACT"; years: number; wageEurPerMonth: number; currentWageEurPerMonth: number; currentEndDate: string; expiresOn: string };

export interface BoardMinutes {
  board: BoardState;
  confidence: number;
  targetConfidence: number;
  trend: "up" | "down" | "flat";
  reputation: number | null;
  stage: BoardPressureStage;
  stageLabel: string;
  stageTone: MinuteTone;
  lines: { warning: number; finalWarning: number; dismissal: number };
  warnings: number;
  factors: ConfidenceFactor[];
  history: { date: string; confidence: number }[];
  objectives: ObjectiveMeter[];
  decision: OpenDecision | null;
  entries: MinuteEntry[];
  /** CLB-05a: the latest verdict (not a season-start agenda) if it falls on today, and if it is still in its 21-day band. */
  verdictToday: MinuteEntry | null;
  verdictBand: MinuteEntry | null;
}

const addDays = (iso: string, days: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
/** Board confidence on a date: the last history point on or before it. */
function confidenceOn(history: { date: string; confidence: number }[], date: string): number | null {
  let v: number | null = null;
  for (const h of history) if (h.date <= date) v = h.confidence;
  return v;
}

export function boardMinutes(career: CareerState): BoardMinutes {
  // A save from before M07 has no board until its next processed day; show the one it would get.
  const view = boardOf(career) ? career : ensureBoard(career, career.gameDate);
  const board = view.board!;
  const objectives = evaluateObjectives(view, board);
  const table = getLiveStandings(view);
  const started = table.some((r) => r.played > 0);
  const position = getPlayerClubPosition(view);
  const teams = table.length;
  const scale = (p: number) => (teams > 1 ? 1 - (p - 1) / (teams - 1) : 1);
  const objectiveMeters: ObjectiveMeter[] = objectives.map((o) => ({
    id: o.id, label: o.label, status: o.status, statusLabel: OBJECTIVE_STATUS_LABEL[o.status], progress: o.progress, why: o.why,
    tone: o.status === "ON_TRACK" || o.status === "MET" ? "good" : o.status === "FAILED" ? "bad" : "warn",
    meter: o.kind === "LEAGUE" && started && position > 0 && teams > 1 ? { value: scale(position), target: scale(o.target), minimum: o.minimum ? scale(o.minimum) : null, position, teams } : null,
  }));

  const openEventIds = new Set(career.careerEvents.filter((e) => e.requiresAction && !e.resolved).map((e) => e.id));
  const plans = board.recoveryPlans ?? [];
  const contract = managerCareerOf(career).contract;
  const entries: MinuteEntry[] = [];
  let previous: number | null = null;
  for (const m of board.meetings) {
    const at = confidenceOn(board.history, m.date);
    const plan = plans.find((p) => p.meetingId === m.id) ?? null;
    const open = (m.kind === "WARNING" || m.kind === "FINAL_WARNING") && openEventIds.has(`BOARD_UPDATE:${m.id}`) && !plan;
    const response = plan ? `Handlingsplan lämnad ${plan.agreedOn}.` : open ? "Obesvarat: styrelsen väntar på din handlingsplan." : m.kind === "CONTRACT" ? "Du skrev på." : null;
    const outcome = plan ? (plan.status === "ACTIVE" ? { label: "Inväntar granskning", tone: "neutral" as const } : plan.status === "MET" ? { label: "Uppfyllt", tone: "good" as const } : { label: "Ej uppfyllt", tone: "bad" as const }) : null;
    entries.push({ id: m.id, date: m.date, kind: m.kind, kindLabel: MEETING_KIND_LABEL[m.kind], verdict: m.verdict, verdictLabel: VERDICT_LABEL[m.verdict], tone: verdictTone[m.verdict], title: m.title, summary: m.summary, demanded: demandOf(m), response, outcome, plan, confidenceAt: at, confidenceDelta: at !== null && previous !== null ? at - previous : null, open });
    if (at !== null) previous = at;
  }
  entries.reverse();

  const pressure = [...board.meetings].reverse().find((m) => (m.kind === "WARNING" || m.kind === "FINAL_WARNING") && openEventIds.has(`BOARD_UPDATE:${m.id}`));
  const offer = board.contractOffer && board.contractOffer.expiresOn >= career.gameDate ? board.contractOffer : undefined;
  const decision: OpenDecision | null = pressure && !career.managerCareer?.seekingJob
    ? { kind: "RECOVERY", meetingId: pressure.id, title: pressure.title, summary: pressure.summary, finalWarning: pressure.kind === "FINAL_WARNING" }
    : offer ? { kind: "CONTRACT", years: offer.years, wageEurPerMonth: offer.wageEurPerMonth, currentWageEurPerMonth: contract.wageEurPerMonth, currentEndDate: contract.endDate, expiresOn: offer.expiresOn } : null;

  const verdicts = entries.filter((e) => e.kind !== "SEASON_START");
  const latest = verdicts[0] ?? null;
  const last = board.history.at(-1)?.confidence ?? board.confidence;
  const stage = boardPressureStage(board);
  return {
    board,
    confidence: board.confidence,
    targetConfidence: board.targetConfidence,
    trend: board.targetConfidence > last ? "up" : board.targetConfidence < last ? "down" : "flat",
    reputation: career.managerCareer ? career.managerCareer.reputation : null,
    stage,
    stageLabel: BOARD_PRESSURE_LABEL[stage],
    stageTone: stageTone[stage],
    lines: { warning: WARNING_LINE, finalWarning: FINAL_WARNING_LINE, dismissal: DISMISSAL_LINE },
    warnings: board.warnings,
    factors: board.factors,
    history: board.history,
    objectives: objectiveMeters,
    decision,
    entries,
    verdictToday: latest && latest.date === career.gameDate ? latest : null,
    verdictBand: latest && latest.date >= addDays(career.gameDate, -21) ? latest : null,
  };
}

export interface DecisionOption { id: "PLAN" | "LATER" | "SIGN" | "DECLINE"; label: string; consequences: string[]; primary: boolean }

/** CLB-05b: each answer with its consequence, restating the board's own rules and the offer's terms. */
export function decisionOptions(decision: OpenDecision, format: (eur: number) => string): DecisionOption[] {
  if (decision.kind === "RECOVERY") return [
    { id: "PLAN", label: "Lämna handlingsplan", primary: true, consequences: [
      "Granskas vid nästa månadsmöte, tidigast efter 28 dagar.",
      "Mål: stig två tabellplatser, förbättra formen med 0,5 poäng per match eller minska de ekonomiska problemen.",
      "Uppfyllt: +6 till styrelsens målförtroende. Annars −6.",
    ] },
    { id: "LATER", label: "Inte nu", primary: false, consequences: [
      "Mötet står kvar obesvarat och Fortsätt väntar på ditt svar.",
      decision.finalWarning ? "Det här är sista varningen: fortsatt underprestation leder till avsked." : "Fortsatt underprestation kan leda till sista varningen.",
    ] },
  ];
  const diff = decision.wageEurPerMonth - decision.currentWageEurPerMonth;
  return [
    { id: "SIGN", label: "Skriv på", primary: true, consequences: [
      `${decision.years} år till.`,
      `Lön ${format(decision.wageEurPerMonth)} i månaden (${diff === 0 ? "oförändrad" : `${diff > 0 ? "+" : "−"}${format(Math.abs(diff))}`}).`,
      "Skrivs in i protokollet och i din karriär.",
    ] },
    { id: "DECLINE", label: "Tacka nej", primary: false, consequences: [
      `Ditt avtal löper som tidigare till ${decision.currentEndDate}.`,
      "Styrelsen tar upp avtalet igen vid säsongsgenomgången när det har mindre än ett år kvar.",
    ] },
  ];
}
