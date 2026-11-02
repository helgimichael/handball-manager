// HM-ALPHA3-M08: discipline after what the manager says, modelled on the
// real Swedish framework (verified 2026-11-02 against the primary texts):
// - RF:s stadgar 14 kap 2 § p. 7: punishable to act "förolämpande eller på
//   annat sätt otillbörligt mot ... funktionär", and p. 13: conduct that
//   harms the sport's reputation. 14 kap 3 §: the penalties are
//   tillrättavisning, böter and avstängning; 14 kap 6 §: avstängning for a
//   time or a number of tävlingstillfällen; 14 kap 7 §: a ringa offence
//   gets only tillrättavisning.
// - SHF:s tävlingsbestämmelser (from 1 July 2025) § 1:14: straffavgift of
//   at most 25 000 SEK; ch. 7: bestraffningsärenden are decided by SHF:s
//   disciplinnämnd (DN); DN decisions may be appealed to
//   Riksidrottsnämnden (RIN) within three weeks; RIN needs
//   prövningstillstånd (granted only for grave procedural error or a
//   decision without support in the rules).
// Ordinary, factual criticism of refereeing is NOT reported. Questioning
// the officials' impartiality is; irony is only taken up for a repeat
// offender. Amounts and match counts are game choices within these limits.
import { buildClubEvent, type CareerEvent } from "../career/careerEvents";
import type { CareerState } from "../career/types";
import { adjustClubCash } from "../economy/clubEconomyIntegration";
import { EUR_TO_SEK_REFERENCE_RATE } from "../economy/currency";
import { addDaysIso, managerMatchesPlayed } from "../players/dynamicsState";
import { getClub } from "../game-data";
import { hash, mediaOf, withMedia } from "./people";
import { publish } from "./newsEngine";
import type { DisciplineCase } from "./types";

type Emit = (e: CareerEvent) => void;

export const PROVISION = {
  INTEGRITY: "RF:s stadgar 14 kap. 2 § p. 7 (otillbörligt uppträdande mot funktionär) och p. 13 (skada idrottens anseende)",
  SARCASM: "RF:s stadgar 14 kap. 2 § p. 7 (otillbörligt uppträdande mot funktionär)",
};
export const SHF_MAX_STRAFFAVGIFT_SEK = 25000;
const FINE_SEK = 15000;
const DECISION_DAYS = 10;
const APPEAL_DAYS = 21;
const RIN_DAYS = 14;
const APPEAL_FEE_SEK = 1000;

export const OUTCOME_LABEL: Record<NonNullable<DisciplineCase["outcome"]>, string> = { NO_ACTION: "Ingen åtgärd", TILLRATTAVISNING: "Tillrättavisning", STRAFFAVGIFT: "Straffavgift", AVSTANGNING: "Avstängning" };

function priorCases(state: CareerState, date: string): DisciplineCase[] {
  return Object.values(mediaOf(state).discipline).filter((c) => c.outcome && c.outcome !== "NO_ACTION" && c.decisionOn >= addDaysIso(date, -365));
}

/** A statement is reported to DN -- or, for first-time irony, nothing happens. */
export function openDisciplineCase(state: CareerState, input: { statement: string; pressId?: string; fixtureId?: string; kind: "INTEGRITY" | "SARCASM" }): CareerState {
  const date = state.gameDate;
  const prior = priorCases(state, date);
  if (input.kind === "SARCASM" && prior.length === 0) return state;
  const severity = Math.min(3, (input.kind === "INTEGRITY" ? 2 : 1) + (prior.length > 0 ? 1 : 0)) as 1 | 2 | 3;
  const id = `dn:${date}:${Object.keys(mediaOf(state).discipline).length}`;
  const c: DisciplineCase = { id, openedOn: date, statement: input.statement, pressId: input.pressId, fixtureId: input.fixtureId, provision: PROVISION[input.kind], severity, status: "REPORTED", decisionOn: addDaysIso(date, DECISION_DAYS) };
  return withMedia(state, (m) => ({ ...m, discipline: { ...m.discipline, [id]: c } }));
}

/** Before the decision: a public apology lowers the severity by one step. */
export function apologise(state: CareerState, caseId: string): CareerState {
  const c = mediaOf(state).discipline[caseId];
  if (!c || c.status !== "REPORTED" || c.apologised) return state;
  return withMedia(state, (m) => ({ ...m, supporters: Math.max(-50, m.supporters - 1), discipline: { ...m.discipline, [caseId]: { ...c, apologised: true } } }));
}

export function openCases(state: CareerState): DisciplineCase[] {
  return Object.values(mediaOf(state).discipline).sort((a, b) => b.openedOn.localeCompare(a.openedOn));
}

/** The manager is serving a suspension: the assistant leads the team on matchday. */
export function activeSuspension(state: CareerState): DisciplineCase | null {
  return Object.values(mediaOf(state).discipline).find((c) => c.outcome === "AVSTANGNING" && (c.servedMatches ?? 0) < (c.matches ?? 0)) ?? null;
}

/** Who leads the team on the bench. A suspended manager may prepare the
 *  team during the week, but on matchday the assistant coach takes every
 *  decision the suspension covers: substitutions, timeouts and tactical
 *  changes during the match. Control returns once the matches are served. */
export type MatchControl =
  | { by: "MANAGER" }
  | { by: "ASSISTANT"; name: string; staffId?: string; reason: string; remaining: number; caseId: string };

export function matchControl(state: CareerState): MatchControl {
  const c = activeSuspension(state);
  if (!c) return { by: "MANAGER" };
  const staff = state.staffRoster[state.playerClubId] ?? [];
  const assistant = staff.find((m) => m.roles[0] === "ASSISTANT_COACH") ?? staff.find((m) => m.roles.includes("ASSISTANT_COACH"));
  const remaining = (c.matches ?? 0) - (c.servedMatches ?? 0);
  return {
    by: "ASSISTANT",
    name: assistant?.displayName ?? "Lagledaren",
    staffId: assistant?.id,
    reason: `Du är avstängd av Disciplinnämnden (${remaining} ${remaining === 1 ? "match" : "matcher"} kvar, 14 kap. 6 § RF:s stadgar).`,
    remaining,
    caseId: c.id,
  };
}

/** Appeal to RIN within three weeks of the decision (fee 1 000 kr). */
export function appealCase(state: CareerState, caseId: string): CareerState {
  const c = mediaOf(state).discipline[caseId];
  if (!c || c.status !== "DECIDED" || !(c.outcome === "STRAFFAVGIFT" || c.outcome === "AVSTANGNING")) throw new Error("Beslutet kan inte överklagas.");
  if (state.gameDate > addDaysIso(c.decisionOn, APPEAL_DAYS)) throw new Error("Tiden för att överklaga (tre veckor) har gått ut.");
  const next = adjustClubCash(state, state.playerClubId, -Math.round(APPEAL_FEE_SEK / EUR_TO_SEK_REFERENCE_RATE), { category: "OTHER_ONE_OFF", label: "Överklagandeavgift, Riksidrottsnämnden", date: state.gameDate });
  return withMedia(next, (m) => ({ ...m, discipline: { ...m.discipline, [caseId]: { ...c, status: "APPEALED", appeal: { filedOn: state.gameDate, decisionOn: addDaysIso(state.gameDate, RIN_DAYS) } } } }));
}

/** Daily: DN decisions, RIN rulings, and the suspension served match by match. */
export function progressDiscipline(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  for (const c of Object.values(mediaOf(next).discipline)) {
    if (c.status === "REPORTED" && c.decisionOn <= date) next = decide(next, c, date, emit);
    else if (c.status === "APPEALED" && c.appeal && c.appeal.decisionOn <= date) next = rin(next, c, date, emit);
    if (c.outcome === "AVSTANGNING" && (c.servedMatches ?? 0) < (c.matches ?? 0)) {
      // The decision is taken in the morning tick, so a match the same day is already covered.
      const served = Math.min(c.matches ?? 0, managerMatchesPlayed(next).filter((x) => x.date >= c.decisionOn).length);
      if (served !== (c.servedMatches ?? 0)) next = withMedia(next, (m) => ({ ...m, discipline: { ...m.discipline, [c.id]: { ...m.discipline[c.id]!, servedMatches: served } } }));
    }
  }
  return next;
}

function decide(state: CareerState, c: DisciplineCase, date: string, emit: Emit): CareerState {
  const level = Math.max(1, c.severity - (c.apologised ? 1 : 0));
  const club = getClub(state.playerClubId)?.shortName ?? "";
  let next = state;
  let decided: DisciplineCase;
  if (level === 1) {
    decided = { ...c, status: "DECIDED", outcome: "TILLRATTAVISNING", reasoning: `Disciplinnämnden bedömer uttalandet som otillbörligt men ringa${c.apologised ? ", särskilt sedan tränaren bett om ursäkt" : ""}. Påföljden blir en skriftlig tillrättavisning (14 kap. 4 och 7 §§ RF:s stadgar).` };
  } else if (level === 2) {
    decided = { ...c, status: "DECIDED", outcome: "STRAFFAVGIFT", fineSek: FINE_SEK, reasoning: `Att offentligt ifrågasätta domarnas opartiskhet är otillbörligt mot funktionär. Föreningen åläggs straffavgift om ${FINE_SEK.toLocaleString("sv-SE")} kr (SHF:s tävlingsbestämmelser § 1:14, högst ${SHF_MAX_STRAFFAVGIFT_SEK.toLocaleString("sv-SE")} kr).` };
    next = adjustClubCash(next, state.playerClubId, -Math.round(FINE_SEK / EUR_TO_SEK_REFERENCE_RATE), { category: "OTHER_ONE_OFF", label: "Straffavgift, SHF:s disciplinnämnd", date });
  } else {
    decided = { ...c, status: "DECIDED", outcome: "AVSTANGNING", matches: 2, servedMatches: 0, reasoning: "Upprepade otillbörliga uttalanden mot domare. Tränaren stängs av från uppdrag i två tävlingstillfällen (14 kap. 6 § RF:s stadgar). Assisterande tränaren leder laget under avstängningen." };
    next = withMedia(next, (m) => ({ ...m, boardMood: Math.max(-6, m.boardMood - 4) }));
    if (next.managerCareer) next = { ...next, managerCareer: { ...next.managerCareer, reputation: Math.max(5, next.managerCareer.reputation - 2) } };
    emit(buildClubEvent("BOARD_UPDATE", `discipline-board:${c.id}`, date, "IMPORTANT", "Styrelsen kallar till samtal", "Styrelsen vill inte se klubben i fler disciplinärenden. Förtroendet har påverkats.", [{ route: "BOARDROOM" }]));
  }
  next = withMedia(next, (m) => ({ ...m, discipline: { ...m.discipline, [c.id]: decided } }));
  emit(buildClubEvent("MEDIA", `dn:${c.id}`, date, "IMPORTANT", `Disciplinnämnden: ${OUTCOME_LABEL[decided.outcome!].toLowerCase()}`, decided.reasoning ?? "", [{ route: "MEDIA" }]));
  return publish(next, { key: `discipline:${c.id}`, kind: "DISCIPLINE", date, importance: level === 3 ? 4 : 3, clubIds: [state.playerClubId], personIds: ["manager"], facts: { headline: level === 3 ? `${club}-tränaren avstängd i två matcher` : level === 2 ? `${club} bötfälls efter tränarens domarkritik` : `${club}-tränaren får en tillrättavisning`, detail: decided.reasoning, provision: c.provision }, destinations: [{ route: "MEDIA" }] });
}

function rin(state: CareerState, c: DisciplineCase, date: string, emit: Emit): CareerState {
  const granted = hash(`${state.saveSeed}:rin:${c.id}`) < 0.15;
  let next = state;
  let updated: DisciplineCase = { ...c, status: "CLOSED", appeal: { ...c.appeal!, result: granted ? "REDUCED" : "NOT_GRANTED" } };
  if (granted) {
    if (c.outcome === "AVSTANGNING") updated = { ...updated, matches: Math.max((c.servedMatches ?? 0), (c.matches ?? 0) - 1) };
    if (c.outcome === "STRAFFAVGIFT" && c.fineSek) { updated = { ...updated, fineSek: Math.round(c.fineSek / 2) }; next = adjustClubCash(next, state.playerClubId, Math.round(c.fineSek / 2 / EUR_TO_SEK_REFERENCE_RATE), { category: "OTHER_ONE_OFF", label: "Återbetald straffavgift efter RIN", date }); }
  }
  next = withMedia(next, (m) => ({ ...m, discipline: { ...m.discipline, [c.id]: updated } }));
  emit(buildClubEvent("MEDIA", `rin:${c.id}`, date, "IMPORTANT", granted ? "Riksidrottsnämnden mildrar straffet" : "Riksidrottsnämnden: inget prövningstillstånd", granted ? "RIN fann brister i handläggningen och mildrade påföljden." : "RIN prövar inte ärendet. Disciplinnämndens beslut står fast.", [{ route: "MEDIA" }]));
  return next;
}
