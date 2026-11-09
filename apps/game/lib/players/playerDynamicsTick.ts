// HM-ALPHA3-M05: the one daily step for player dynamics and the selling
// side of the market (called once from dailyTick.ts, before the contract
// expiry sweep so a pre-contract move happens before a free release).
import type { CareerState } from "../career/types";
import { getCareerPlayer } from "../career/careerWorld";
import { addDaysIso, dynamicsEvent, dynamicsOf, managerSquadIds, playerName, type Emit } from "./dynamicsState";
import { generateIncomingOffers, progressIncomingOffers, progressPreContracts } from "./market";
import { updateMoraleWeekly } from "./morale";
import { evaluatePromises } from "./promises";
import { progressRenewalTalks } from "./renewals";
import { progressPlayerIntentions } from "./intentions";
import { progressTalks } from "./talks";

export function progressPlayerDynamics(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  next = progressRenewalTalks(next, date, emit);
  next = progressIncomingOffers(next, date, emit);
  next = progressPreContracts(next, date, emit);
  next = evaluatePromises(next, date, emit);
  // Weekly (Mondays, or the first processed day of a save): morale, talks, requests, new bids.
  const d = dynamicsOf(next);
  const monday = new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
  if (!d.lastWeeklyUpdate || (monday && d.lastWeeklyUpdate < date) || addDaysIso(d.lastWeeklyUpdate, 7) <= date) {
    next = updateMoraleWeekly(next, date);
    next = progressPlayerIntentions(next, date, emit);
    next = progressTalks(next, date, emit);
    next = generateIncomingOffers(next, date, emit);
  }
  if (date.endsWith("-01")) next = expiringContractNotices(next, date, emit);
  return next;
}

/** First of each month: one notice per player whose contract ends within six months and nobody has talked to. */
function expiringContractNotices(state: CareerState, date: string, emit: Emit): CareerState {
  const horizon = addDaysIso(date, 183);
  for (const id of managerSquadIds(state)) {
    const c = state.playerContracts[id];
    if (!c || c.contractEndDate > horizon || state.preContracts?.[id]) continue;
    if (Object.values(state.renewalTalks ?? {}).some((t) => t.playerId === id && (t.status === "OPEN" || t.status === "AGREED") && t.openedOn >= addDaysIso(c.contractEndDate, -365))) continue;
    if (!getCareerPlayer(state, id)) continue;
    emit(dynamicsEvent(`expiring:${id}:${c.contractEndDate}`, date, "IMPORTANT", `${playerName(state, id)}s avtal går ut ${c.contractEndDate}`, "Inled förlängningssamtal, eller låt honom gå. Från januari kan andra klubbar skriva förhandsavtal med honom.", id, [{ route: "CONTRACTS" }]));
  }
  return state;
}
