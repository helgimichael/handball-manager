// HM-ALPHA3-M05: contract renewals as real negotiations. The player states
// a wage demand with its reasons (the transfer demand model plus morale,
// loyalty and ambition), answers each offer the next day -- accept,
// counter or reject -- and key players can refuse altogether. A promised
// role lowers the demand but becomes a promise with a deadline.
import { getCareerClubSquad, getCareerPlayer } from "../career/careerWorld";
import { renewPlayerContract } from "../career/contractRenewal";
import { clubCompetitionTier } from "../career/competitionMembership";
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from "../career/squadStatus";
import type { CareerState } from "../career/types";
import { getClubFinancialHealth } from "../economy/clubEconomyIntegration";
import { findStaffMember } from "../staff/staffCareerIntegration";
import { getPlayerFairWageEurPerMonth } from "../economy/contractIntegration";
import { assessRenewalAffordability } from "../transfers/affordability";
import { computePlayerWageDemand, expectedRoleFromSquadRank } from "../transfers/negotiation";
import { addMoraleShock, moraleOf } from "./morale";
import { makePromise } from "./promises";
import { addDaysIso, ageOf, caOf, dynamicsEvent, dynamicsOf, personalityOf, playerName, tierOf, type Emit } from "./dynamicsState";
import { formatEur } from "../economy/currency";
import { intentionRenewalBlocker, intentionWageMultiplier, intentionMinimumWage, INTENTION_LABEL, playerIntentionOf } from "./intentions";
import type { RenewalTalk } from "./types";

const MAX_ROUNDS = 3;
const COOLDOWN_DAYS = 45;
const rank = (t: SquadStatusTier) => SQUAD_STATUS_TIERS.indexOf(t);

export function openTalkFor(state: CareerState, playerId: string): RenewalTalk | undefined {
  return Object.values(state.renewalTalks ?? {}).find((t) => t.playerId === playerId && t.status === "OPEN");
}

export function lastTalkFor(state: CareerState, playerId: string): RenewalTalk | undefined {
  return Object.values(state.renewalTalks ?? {}).filter((t) => t.playerId === playerId).sort((a, b) => a.openedOn.localeCompare(b.openedOn)).at(-1);
}

/** Why a player will not even talk, or null. */
export function renewalBlocker(state: CareerState, playerId: string): string | null {
  if (state.playerContracts[playerId]?.clubId !== state.playerClubId) return "Spelaren tillhör inte klubben.";
  if (state.preContracts?.[playerId]) return "Han har redan skrivit förhandsavtal med en annan klubb.";
  if (dynamicsOf(state).requests[playerId]?.status === "OPEN") return "Han har begärt att få lämna och vill inte förlänga.";
  const intentionBlocker = intentionRenewalBlocker(state, playerId);
  if (intentionBlocker) return intentionBlocker;
  const last = lastTalkFor(state, playerId);
  if (last?.cooldownUntil && last.cooldownUntil > state.gameDate) return `Han vill inte prata förlängning igen före ${last.cooldownUntil}.`;
  if (moraleOf(state, playerId) < 30) return "Han är för missnöjd för att prata förlängning just nu.";
  return null;
}

function squadRank(state: CareerState, playerId: string): number {
  const ids = getCareerClubSquad(state, state.playerClubId).map((p) => p.id);
  return ids.map((id) => ({ id, ca: caOf(state, id) })).sort((a, b) => b.ca - a.ca).findIndex((x) => x.id === playerId);
}

/** The player's demand: the shared transfer demand model, then his own situation. */
export function renewalDemand(state: CareerState, playerId: string, promisedRole?: SquadStatusTier, negotiatorStaffId?: string): { demandEurPerMonth: number; factors: { label: string; effectPct: number }[]; expectedRole: SquadStatusTier; refusesRole: boolean } {
  const player = getCareerPlayer(state, playerId)!;
  const contract = state.playerContracts[playerId]!;
  const tier = clubCompetitionTier(state, state.playerClubId) as 1 | 2 | undefined;
  const age = ageOf(state, playerId);
  const expectedRole = expectedRoleFromSquadRank(squadRank(state, playerId), age);
  const base = computePlayerWageDemand({
    playerId, age, isFreeAgent: false,
    currentWageEurPerMonth: contract.wageEurPerMonth,
    fairWageEurPerMonth: getPlayerFairWageEurPerMonth(state, playerId) ?? contract.wageEurPerMonth,
    currentClubTier: tier, newClubTier: tier,
    currentSquadStatus: player.squadStatus,
    currentClubPressure: getClubFinancialHealth(state, state.playerClubId)?.pressure ?? "NONE",
    expectedRole, promisedRole: promisedRole ?? tierOf(state, playerId), contractYears: 2,
  });
  // A renewal is not a move: no "moving is a disruption" premium -- start from his wage and the fair wage.
  let demand = Math.max(contract.wageEurPerMonth * 1.03, Math.min(base.demandEurPerMonth, Math.max(contract.wageEurPerMonth * 1.25, (getPlayerFairWageEurPerMonth(state, playerId) ?? 0) * 1.05)));
  const factors: { label: string; effectPct: number }[] = [];
  const apply = (mult: number, label: string) => { demand *= mult; factors.push({ label, effectPct: Math.round((mult - 1) * 100) }); };
  const p = personalityOf(state, playerId);
  const morale = moraleOf(state, playerId);
  if (morale < 50) apply(1.1, "Missnöjd: vill ha mer för att stanna");
  if (morale >= 80) apply(0.96, "Trivs i klubben");
  if (p.loyalty >= 15) apply(0.95, "Lojal mot klubben");
  if (p.ambition >= 15 && (tier ?? 1) >= 2) apply(1.08, "Ambitiös och vill högre upp");
  if (expectedRole === "KEY_PLAYER") apply(1.05, "Vet att han är en nyckelspelare");
  if (promisedRole && rank(promisedRole) < rank(expectedRole)) apply(0.95, `Lovad rollen ${SQUAD_STATUS_TIER_LABEL_SV[promisedRole].toLowerCase()}`);
  // HM-ALPHA3-M06: a delegated negotiator moves the demand by up to ±4 % (NEGOTIATION 20 talks it down, 1 talks it up).
  if (negotiatorStaffId) {
    const negotiator = findStaffMember(state, negotiatorStaffId);
    const skill = negotiator?.profile.attributes.NEGOTIATION?.value ?? 10;
    apply(1.04 - ((skill - 1) / 19) * 0.08, `Förhandlas av ${negotiator?.displayName ?? "staben"}`);
  }
  const intention = playerIntentionOf(state, playerId);
  if (intention) apply(intentionWageMultiplier(state, playerId), INTENTION_LABEL[intention.kind]);
  const refusesRole = !!promisedRole && rank(promisedRole) - rank(expectedRole) >= 2;
  // Never below what he already earns.
  return { demandEurPerMonth: Math.max(intentionMinimumWage(state,playerId), Math.ceil(contract.wageEurPerMonth / 10) * 10, Math.round(demand / 10) * 10), factors, expectedRole, refusesRole };
}

export function openRenewalTalks(state: CareerState, playerId: string, by: RenewalTalk["by"]): CareerState {
  const existing = openTalkFor(state, playerId);
  if (existing) return state;
  const blocker = renewalBlocker(state, playerId);
  if (blocker) throw new Error(blocker);
  const p = personalityOf(state, playerId);
  const tier = tierOf(state, playerId);
  const morale = moraleOf(state, playerId);
  const demand = renewalDemand(state, playerId, undefined, by?.kind === "DELEGATE" ? by.staffId : undefined);
  const id = `renewal:${playerId}:${state.gameDate}`;
  // A key player who is ambitious and unhappy will not commit.
  const refuses = (tier === "KEY_PLAYER" || tier === "FIRST_CHOICE") && p.ambition >= 16 && morale < 45;
  const talk: RenewalTalk = {
    id, playerId, openedOn: state.gameDate,
    demandEurPerMonth: demand.demandEurPerMonth, demandFactors: demand.factors, expectedRole: demand.expectedRole,
    status: refuses ? "REFUSED" : "OPEN", rounds: [],
    ...(refuses ? { closedOn: state.gameDate, cooldownUntil: addDaysIso(state.gameDate, COOLDOWN_DAYS) } : {}),
    by,
  };
  return { ...state, renewalTalks: { ...state.renewalTalks, [id]: refuses ? { ...talk, rounds: [{ date: state.gameDate, offer: { wageEurPerMonth: 0, years: 0 }, response: "REJECT", reason: "Han vill pröva något nytt och tänker inte skriva på." }] } : talk } };
}

/** An offer in the talks; the player answers the next day. */
export function submitRenewalOffer(state: CareerState, talkId: string, offer: { wageEurPerMonth: number; years: number; promisedRole?: SquadStatusTier }): CareerState {
  const talk = state.renewalTalks?.[talkId];
  if (!talk || talk.status !== "OPEN") throw new Error("Förhandlingen är inte öppen.");
  const blocker = renewalBlocker(state, talk.playerId);
  if (blocker) throw new Error(blocker);
  if (talk.answerOn) throw new Error("Spelaren har inte svarat på förra budet än.");
  if (![1, 2, 3, 4].includes(offer.years)) throw new Error("Välj ett till fyra år.");
  const current = state.playerContracts[talk.playerId]!;
  if (offer.wageEurPerMonth < current.wageEurPerMonth) throw new Error("Ett förlängningsbud kan inte sänka lönen.");
  const increase = offer.wageEurPerMonth - current.wageEurPerMonth;
  if (increase > 0) {
    const a = assessRenewalAffordability(state, state.playerClubId, talk.playerId, offer.wageEurPerMonth);
    if (!a.affordable) throw new Error(a.reasons.join(" "));
  }
  const round = { date: state.gameDate, offer };
  return { ...state, renewalTalks: { ...state.renewalTalks, [talkId]: { ...talk, rounds: [...talk.rounds, round], answerOn: addDaysIso(state.gameDate, 1) } } };
}

export function withdrawRenewalTalks(state: CareerState, talkId: string): CareerState {
  const talk = state.renewalTalks?.[talkId];
  if (!talk || talk.status !== "OPEN") return state;
  return { ...state, renewalTalks: { ...state.renewalTalks, [talkId]: { ...talk, status: "WITHDRAWN", closedOn: state.gameDate, answerOn: undefined } } };
}

/** Daily: answer offers that are due. */
export function progressRenewalTalks(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  for (const talk of Object.values(state.renewalTalks ?? {})) {
    if (talk.status !== "OPEN" || !talk.answerOn || talk.answerOn > date) continue;
    const roundIdx = talk.rounds.length - 1;
    const last = talk.rounds[roundIdx]!;
    const name = playerName(next, talk.playerId);
    if (next.playerContracts[talk.playerId]?.clubId !== next.playerClubId) {
      next = put(next, { ...talk, status: "WITHDRAWN", closedOn: date, answerOn: undefined });
      continue;
    }
    const demand = renewalDemand(next, talk.playerId, last.offer.promisedRole, talk.by?.kind === "DELEGATE" ? talk.by.staffId : undefined);
    const ratio = last.offer.wageEurPerMonth / demand.demandEurPerMonth;
    const age = ageOf(next, talk.playerId) ?? 25;
    const yearsOk = !(age >= 32 && last.offer.years >= 3) || ratio >= 1.05;
    let response: "ACCEPT" | "COUNTER" | "REJECT";
    let reason: string;
    const blocker = renewalBlocker(next, talk.playerId);
    if (blocker) { response = "REJECT"; reason = blocker; }
    else if (demand.refusesRole) { response = "REJECT"; reason = "Rollen du erbjuder är för liten för honom."; }
    else if (ratio >= 1 && yearsOk) { response = "ACCEPT"; reason = "Han accepterar villkoren."; }
    else if (ratio >= 0.88 && roundIdx + 1 < MAX_ROUNDS) { response = "COUNTER"; reason = `Han vill ha ${formatEur(demand.demandEurPerMonth)} i månaden.`; }
    else { response = "REJECT"; reason = ratio < 0.88 ? "Budet ligger för långt från hans krav." : "Han är inte beredd att gå längre ner."; }
    const rounds = talk.rounds.map((r, i) => (i === roundIdx ? { ...r, response, reason, counterWageEurPerMonth: response === "COUNTER" ? demand.demandEurPerMonth : undefined } : r));
    if (response === "ACCEPT") {
      try {
        next = renewPlayerContract(next, talk.playerId, Math.min(3, last.offer.years), last.offer.wageEurPerMonth);
      } catch (e) {
        // Budget moved since the offer: the talks stay open with the reason.
        next = put(next, { ...talk, rounds: rounds.map((r, i) => (i === roundIdx ? { ...r, response: "REJECT", reason: e instanceof Error ? e.message : "Avtalet kunde inte registreras." } : r)), answerOn: undefined });
        continue;
      }
      if (last.offer.years === 4) next = extendOneMoreYear(next, talk.playerId);
      if (last.offer.promisedRole && rank(last.offer.promisedRole) <= rank(tierOf(next, talk.playerId))) next = makePromise(next, talk.playerId, "SQUAD_ROLE", last.offer.promisedRole, 180, "CONTRACT");
      next = put(next, { ...talk, rounds, status: "AGREED", closedOn: date, answerOn: undefined });
      next = addMoraleShock(next, talk.playerId, 6, "Nytt kontrakt", 60);
      emit(dynamicsEvent(`renewal:${talk.id}:agreed`, date, "IMPORTANT", `${name} förlänger`, `Klart: ${formatEur(last.offer.wageEurPerMonth)} i månaden, ${last.offer.years} år.`, talk.playerId, [{ route: "CONTRACTS" }]));
    } else if (response === "COUNTER") {
      next = put(next, { ...talk, rounds, answerOn: undefined, demandEurPerMonth: demand.demandEurPerMonth, demandFactors: demand.factors });
      emit(dynamicsEvent(`renewal:${talk.id}:r${roundIdx}`, date, "IMPORTANT", `${name} svarar på förlängningsbudet`, reason, talk.playerId, [{ route: "CONTRACTS" }]));
    } else {
      const final = !!blocker || roundIdx + 1 >= MAX_ROUNDS || ratio < 0.8 || demand.refusesRole;
      next = put(next, { ...talk, rounds, answerOn: undefined, ...(final ? { status: "REFUSED" as const, closedOn: date, cooldownUntil: addDaysIso(date, COOLDOWN_DAYS) } : {}) });
      if (final) next = addMoraleShock(next, talk.playerId, -4, "Förhandlingen sprack", 45);
      emit(dynamicsEvent(`renewal:${talk.id}:r${roundIdx}`, date, "IMPORTANT", final ? `${name} säger nej till förlängning` : `${name} avvisar budet`, `${reason}${final ? ` Han vill inte förhandla igen före ${addDaysIso(date, COOLDOWN_DAYS)}.` : ""}`, talk.playerId, [{ route: "CONTRACTS" }]));
    }
  }
  return next;
}

/** renewPlayerContract allows up to three years; a four-year offer adds one more. */
function extendOneMoreYear(state: CareerState, playerId: string): CareerState {
  const c = state.playerContracts[playerId]!;
  const end = `${Number(c.contractEndDate.slice(0, 4)) + 1}${c.contractEndDate.slice(4)}`;
  return { ...state, playerContracts: { ...state.playerContracts, [playerId]: { ...c, contractEndDate: end } } };
}

function put(state: CareerState, talk: RenewalTalk): CareerState {
  return { ...state, renewalTalks: { ...state.renewalTalks, [talk.id]: talk } };
}
