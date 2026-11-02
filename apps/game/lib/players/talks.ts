// HM-ALPHA3-M05: "Spelarsamtal" -- a player raises the thing that bothers
// him most (playing time, his contract, his ambitions, a broken promise)
// and the manager answers with one of up to three choices, each with its
// consequence shown first. Long unhappiness or repeated broken promises
// turn into a transfer request. Nothing here is random: concerns follow
// from the morale factors.
import { getCareerClubSquad } from "../career/careerWorld";
import { SQUAD_STATUS_TIER_LABEL_SV } from "../career/squadStatus";
import type { CareerState } from "../career/types";
import { getPlayerMarketValueEur } from "../economy/contractIntegration";
import { UNHAPPY_MORALE, addMoraleShock, moraleOf } from "./morale";
import { makePromise } from "./promises";
import { openRenewalTalks } from "./renewals";
import { EXPECTED_START_SHARE, addDaysIso, dynamicsEvent, dynamicsOf, managerSquadIds, personalityOf, playerName, tierOf, type Emit } from "./dynamicsState";
import type { ConcernKind, PlayerConcern, TalkOption, TransferRequest } from "./types";

const CONCERN_COOLDOWN_DAYS = 28;
const CONCERN_LAPSE_DAYS = 10;

function concernFor(state: CareerState, playerId: string): { kind: ConcernKind; message: string; options: TalkOption[] } | null {
  const m = dynamicsOf(state).morale[playerId];
  if (!m || m.moralePct >= 52) return null;
  const worst = [...m.factors].sort((a, b) => a.points - b.points)[0];
  if (!worst || worst.points > -4) return null;
  const tier = tierOf(state, playerId);
  switch (worst.key) {
    case "PLAYING_TIME":
      return {
        kind: "PLAYING_TIME",
        message: `Jag är ${SQUAD_STATUS_TIER_LABEL_SV[tier].toLowerCase()} men får knappt starta. Jag behöver spela.`,
        options: [
          { id: "PROMISE_TIME", label: "Lova mer speltid", consequence: `Löfte: starta minst ${Math.round(EXPECTED_START_SHARE[tier] * 100)} % av matcherna de närmaste sex veckorna. Moralen stiger nu, men ett brutet löfte svider mer.` },
          { id: "EARN_IT", label: "Han får slå sig in", consequence: "Professionella spelare tar det som en utmaning; andra blir mer missnöjda." },
          { id: "LISTEN_OFFERS", label: "Lyssna på bud", consequence: "Spelaren sätts på transferlistan. Han blir lättad, men du kan förlora honom." },
        ],
      };
    case "CONTRACT":
      return {
        kind: "CONTRACT",
        message: "Mitt avtal går ut och ingen har sagt något. Jag vill veta var jag står.",
        options: [
          { id: "OPEN_TALKS", label: "Inled kontraktssamtal", consequence: "Förhandlingen öppnas direkt med spelarens krav." },
          { id: "LATER", label: "Vi tar det senare", consequence: "Lojala spelare väntar; andra börjar lyssna på andra klubbar." },
        ],
      };
    case "PROMISES":
      return {
        kind: "BROKEN_PROMISE",
        message: "Du lovade mig något och höll det inte. Hur ska jag kunna lita på dig?",
        options: [
          { id: "APOLOGISE", label: "Be om ursäkt och lova igen", consequence: "Ett nytt löfte om speltid i sex veckor. Bryts det igen begär han att få gå." },
          { id: "LISTEN_OFFERS", label: "Lyssna på bud", consequence: "Spelaren sätts på transferlistan." },
        ],
      };
    case "CLUB_STATUS":
    case "TRANSFER":
      return {
        kind: "AMBITION",
        message: "Jag vill spela på en högre nivå. Vad är planen för klubben?",
        options: [
          { id: "PROMISE_SIGNING", label: "Lova en förstärkning", consequence: "Löfte: klubben värvar en spelare på den svagaste positionen innan nästa fönster stänger." },
          { id: "PATIENCE", label: "Be honom ha tålamod", consequence: "Lojala spelare accepterar; ambitiösa blir mer missnöjda." },
          { id: "LISTEN_OFFERS", label: "Lyssna på bud", consequence: "Spelaren sätts på transferlistan." },
        ],
      };
    default:
      return null;
  }
}

/** Weekly: raise at most a few new concerns, lapse unanswered ones, and turn lasting unhappiness into transfer requests. */
export function progressTalks(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  const d0 = dynamicsOf(next);
  // Lapse unanswered talks.
  for (const c of Object.values(d0.concerns)) {
    if (c.status === "OPEN" && addDaysIso(c.raisedOn, CONCERN_LAPSE_DAYS) <= date) {
      next = setConcern(next, { ...c, status: "LAPSED", outcome: "Du svarade inte. Spelaren känner sig förbisedd." });
      next = addMoraleShock(next, c.playerId, -4, "Fick inget svar på sin fråga", 30);
    }
  }
  let raised = 0;
  for (const playerId of managerSquadIds(next)) {
    const d = dynamicsOf(next);
    const recent = Object.values(d.concerns).some((c) => c.playerId === playerId && (c.status === "OPEN" || addDaysIso(c.raisedOn, CONCERN_COOLDOWN_DAYS) > date));
    if (!recent && raised < 2 && d.requests[playerId]?.status !== "OPEN") {
      const concern = concernFor(next, playerId);
      if (concern) {
        const c: PlayerConcern = { id: `concern:${playerId}:${date}`, playerId, kind: concern.kind, raisedOn: date, message: concern.message, options: concern.options, status: "OPEN" };
        next = setConcern(next, c);
        raised++;
        emit(dynamicsEvent(`concern:${c.id}`, date, "IMPORTANT", `${playerName(next, playerId)} vill prata med dig`, concern.message, playerId));
      }
    }
    next = maybeTransferRequest(next, playerId, date, emit);
  }
  return next;
}

function maybeTransferRequest(state: CareerState, playerId: string, date: string, emit: Emit): CareerState {
  const d = dynamicsOf(state);
  const existing = d.requests[playerId];
  if (existing && (existing.status === "OPEN" || existing.status === "ACCEPTED")) return state;
  if (existing?.decidedOn && addDaysIso(existing.decidedOn, 60) > date) return state;
  const m = d.morale[playerId];
  if (!m) return state;
  const broken = Object.values(d.promises).filter((p) => p.playerId === playerId && p.status === "BROKEN" && p.evaluatedOn && addDaysIso(p.evaluatedOn, 120) >= date).length;
  const p = personalityOf(state, playerId);
  const patience = p.loyalty >= 15 ? 2 : 0;
  const unhappyLongEnough = m.unhappyWeeks >= 4 + patience && m.moralePct < UNHAPPY_MORALE;
  if (!unhappyLongEnough && broken < 2) return state;
  const reason = broken >= 2 ? "Klubben har brutit flera löften till honom." : (m.factors.slice().sort((a, b) => a.points - b.points)[0]?.label ?? "Han trivs inte längre.");
  const request: TransferRequest = { playerId, submittedOn: date, reason, status: "OPEN" };
  emit(dynamicsEvent(`request:${playerId}:${date}`, date, "IMPORTANT", `${playerName(state, playerId)} begär att få lämna`, `${reason} Han vill att klubben lyssnar på bud.`, playerId));
  return { ...state, playerDynamics: { ...d, requests: { ...d.requests, [playerId]: request } } };
}

function setConcern(state: CareerState, c: PlayerConcern): CareerState {
  const d = dynamicsOf(state);
  return { ...state, playerDynamics: { ...d, concerns: { ...d.concerns, [c.id]: c } } };
}

/** The manager answers a player talk. */
export function answerConcern(state: CareerState, concernId: string, optionId: string): CareerState {
  const c = dynamicsOf(state).concerns[concernId];
  if (!c || c.status !== "OPEN") throw new Error("Samtalet är redan avslutat.");
  const option = c.options.find((o) => o.id === optionId);
  if (!option) throw new Error("Okänt svar.");
  const p = personalityOf(state, c.playerId);
  const tier = tierOf(state, c.playerId);
  let next = state;
  let outcome = "";
  switch (optionId) {
    case "PROMISE_TIME":
    case "APOLOGISE":
      next = makePromise(next, c.playerId, "PLAYING_TIME", EXPECTED_START_SHARE[tier], 42, "TALK");
      next = addMoraleShock(next, c.playerId, optionId === "APOLOGISE" ? 6 : 10, "Fick ett löfte om speltid", 42);
      outcome = "Han tar dig på orden. Löftet utvärderas om sex veckor.";
      break;
    case "EARN_IT":
      next = addMoraleShock(next, c.playerId, p.professionalism >= 12 ? 3 : -5, p.professionalism >= 12 ? "Tog utmaningen" : "Kände sig avfärdad", 35);
      outcome = p.professionalism >= 12 ? "Han tänker visa dig på träningen." : "Han går därifrån besviken.";
      break;
    case "LISTEN_OFFERS":
      next = listPlayer(next, c.playerId, "TRANSFER_REQUEST");
      next = addMoraleShock(next, c.playerId, 5, "Klubben lyssnar på bud", 60);
      outcome = "Han är satt på transferlistan.";
      break;
    case "OPEN_TALKS":
      next = openRenewalTalks(next, c.playerId, { kind: "MANAGER" });
      next = addMoraleShock(next, c.playerId, 5, "Kontraktssamtal inlett", 45);
      outcome = "Kontraktssamtalen är öppnade.";
      break;
    case "LATER":
    case "PATIENCE":
      next = addMoraleShock(next, c.playerId, p.loyalty >= 13 ? 0 : -5, p.loyalty >= 13 ? "Accepterar att vänta" : "Känner sig inte prioriterad", 40);
      outcome = p.loyalty >= 13 ? "Han accepterar, för den här gången." : "Han är inte nöjd med svaret.";
      break;
    case "PROMISE_SIGNING": {
      const weakest = weakestPosition(next);
      next = makePromise(next, c.playerId, "SIGN_POSITION", weakest, 120, "TALK");
      next = addMoraleShock(next, c.playerId, 8, "Klubben lovar att förstärka", 90);
      outcome = `Löfte: en värvning på ${weakest} inom fyra månader.`;
      break;
    }
  }
  return setConcern(next, { ...c, status: "ANSWERED", answeredOn: state.gameDate, answer: option.label, outcome });
}

function weakestPosition(state: CareerState): string {
  const squad = getCareerClubSquad(state, state.playerClubId);
  const byPos = new Map<string, number[]>();
  for (const p of squad) byPos.set(p.position, [...(byPos.get(p.position) ?? []), p.currentAbility]);
  return [...byPos.entries()].map(([pos, cas]) => [pos, Math.max(...cas)] as const).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "M9";
}

/** The manager's decision on a transfer request. */
export function decideTransferRequest(state: CareerState, playerId: string, decision: "ACCEPT" | "REFUSE" | "PROMISE"): CareerState {
  const d = dynamicsOf(state);
  const r = d.requests[playerId];
  if (!r || r.status !== "OPEN") throw new Error("Det finns ingen öppen flyttbegäran.");
  let next: CareerState = { ...state, playerDynamics: { ...d, requests: { ...d.requests, [playerId]: { ...r, status: decision === "ACCEPT" ? "ACCEPTED" : decision === "REFUSE" ? "REFUSED" : "WITHDRAWN", decidedOn: state.gameDate } } } };
  if (decision === "ACCEPT") next = listPlayer(next, playerId, "TRANSFER_REQUEST");
  if (decision === "PROMISE") {
    const p = personalityOf(state, playerId);
    if (p.loyalty < 11) throw new Error("Han har bestämt sig. Ett löfte räcker inte.");
    next = makePromise(next, playerId, "SQUAD_ROLE", tierOf(state, playerId) === "KEY_PLAYER" ? "KEY_PLAYER" : "FIRST_CHOICE", 90, "TRANSFER_REQUEST");
    next = addMoraleShock(next, playerId, 8, "Övertalad att stanna med ett löfte", 60);
  }
  return next;
}

/** Puts a player on the transfer list at his market value (the manager may set the asking price). */
export function listPlayer(state: CareerState, playerId: string, reason: "MANAGER" | "TRANSFER_REQUEST", askingEur?: number): CareerState {
  if (state.playerContracts[playerId]?.clubId !== state.playerClubId) throw new Error("Bara klubbens egna spelare kan transferlistas.");
  const d = dynamicsOf(state);
  const value = getPlayerMarketValueEur(state, playerId) ?? 0;
  const listing = { playerId, listedOn: state.gameDate, askingEur: Math.round(askingEur ?? value), reason };
  let next: CareerState = { ...state, playerDynamics: { ...d, listings: { ...d.listings, [playerId]: listing } } };
  if (reason === "MANAGER" && d.requests[playerId]?.status !== "OPEN") next = addMoraleShock(next, playerId, moraleOf(state, playerId) < 50 ? 2 : -6, "Transferlistad", 45);
  return next;
}

export function unlistPlayer(state: CareerState, playerId: string): CareerState {
  const d = dynamicsOf(state);
  const { [playerId]: _gone, ...listings } = d.listings;
  return { ...state, playerDynamics: { ...d, listings } };
}

export function openConcerns(state: CareerState, playerId?: string): PlayerConcern[] {
  return Object.values(dynamicsOf(state).concerns).filter((c) => c.status === "OPEN" && (!playerId || c.playerId === playerId)).sort((a, b) => a.raisedOn.localeCompare(b.raisedOn));
}
