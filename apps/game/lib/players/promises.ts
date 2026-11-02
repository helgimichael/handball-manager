// HM-ALPHA3-M05: promises with deadlines. A promise is made in a player
// talk, a renewal or a transfer-request conversation, and evaluated on its
// deadline against what actually happened -- starts, the squad role, a
// signing at the position, or the player still being here.
import { getCareerClubSquad } from "../career/careerWorld";
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from "../career/squadStatus";
import type { CareerState } from "../career/types";
import { addMoraleShock } from "./morale";
import { addDaysIso, dynamicsEvent, dynamicsOf, managerMatchesPlayed, playerName, startsOf, tierOf, type Emit } from "./dynamicsState";
import type { PlayerPromise, PromiseKind } from "./types";

export const PROMISE_KIND_LABEL: Record<PromiseKind, string> = {
  PLAYING_TIME: "Mer speltid",
  SQUAD_ROLE: "Roll i truppen",
  NOT_SELL: "Säljs inte",
  SIGN_POSITION: "Värvning på positionen",
};

export function describePromise(p: PlayerPromise): string {
  switch (p.kind) {
    case "PLAYING_TIME": return `Starta minst ${Math.round(Number(p.target) * 100)} % av matcherna till ${p.deadline}`;
    case "SQUAD_ROLE": return `Vara ${SQUAD_STATUS_TIER_LABEL_SV[p.target as SquadStatusTier].toLowerCase()} till ${p.deadline}`;
    case "NOT_SELL": return `Inte säljas före ${p.deadline}`;
    case "SIGN_POSITION": return `Klubben värvar en spelare (${p.target}) före ${p.deadline}`;
  }
}

export function makePromise(state: CareerState, playerId: string, kind: PromiseKind, target: PlayerPromise["target"], days: number, source: PlayerPromise["source"]): CareerState {
  const d = dynamicsOf(state);
  const id = `promise:${playerId}:${kind}:${state.gameDate}:${Object.keys(d.promises).length}`;
  const { starts, appearances } = startsOf(state, playerId);
  const squadSize = getCareerClubSquad(state, state.playerClubId).length;
  const promise: PlayerPromise = { id, playerId, kind, madeOn: state.gameDate, deadline: addDaysIso(state.gameDate, days), target, baseline: { starts, appearances, squadSize }, status: "ACTIVE", source };
  return { ...state, playerDynamics: { ...d, promises: { ...d.promises, [id]: promise } } };
}

/** Did the promise hold? Each kind is judged on facts, with the reason in words. */
function evaluate(state: CareerState, p: PlayerPromise): { kept: boolean; note: string } {
  switch (p.kind) {
    case "PLAYING_TIME": {
      const playedSince = managerMatchesPlayed(state).filter((m) => m.date >= p.madeOn && m.date <= p.deadline).length;
      const startsSince = startsOf(state, p.playerId).starts - (p.baseline?.starts ?? 0);
      if (playedSince === 0) return { kept: true, note: "Inga matcher spelades under perioden." };
      const share = Math.max(0, startsSince) / playedSince;
      return share >= Number(p.target) ? { kept: true, note: `Startade ${startsSince} av ${playedSince} matcher.` } : { kept: false, note: `Startade bara ${Math.max(0, startsSince)} av ${playedSince} matcher.` };
    }
    case "SQUAD_ROLE": {
      const now = tierOf(state, p.playerId);
      const ok = SQUAD_STATUS_TIERS.indexOf(now) <= SQUAD_STATUS_TIERS.indexOf(p.target as SquadStatusTier);
      return ok ? { kept: true, note: `Har rollen ${SQUAD_STATUS_TIER_LABEL_SV[now].toLowerCase()}.` } : { kept: false, note: `Är ${SQUAD_STATUS_TIER_LABEL_SV[now].toLowerCase()}, inte ${SQUAD_STATUS_TIER_LABEL_SV[p.target as SquadStatusTier].toLowerCase()}.` };
    }
    case "NOT_SELL":
      return { kept: true, note: "Spelaren är kvar i klubben." };
    case "SIGN_POSITION": {
      const arrived = getCareerClubSquad(state, state.playerClubId).filter((pl) => pl.position === p.target && state.playerContracts[pl.id]?.clubId === state.playerClubId);
      const signed = Object.values(state.transferOffers ?? {}).some((o) => o.status === "COMPLETED" && o.toClubId === state.playerClubId && (o.scheduledCompletionDate ?? o.resolvedDate ?? o.offeredDate) >= p.madeOn && arrived.some((pl) => pl.id === o.playerId));
      return signed ? { kept: true, note: `Klubben värvade en spelare på ${p.target}.` } : { kept: false, note: `Ingen värvning på ${p.target} gjordes.` };
    }
  }
}

/** Daily: evaluate promises whose deadline has passed; a broken one lowers morale with the reason. */
export function evaluatePromises(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  for (const p of Object.values(dynamicsOf(state).promises)) {
    if (p.status !== "ACTIVE") continue;
    const stillHere = next.playerContracts[p.playerId]?.clubId === next.playerClubId;
    if (!stillHere) {
      next = setPromise(next, { ...p, status: "RELEASED", evaluatedOn: date, note: "Spelaren lämnade klubben." });
      continue;
    }
    if (p.deadline > date) continue;
    const { kept, note } = evaluate(next, p);
    next = setPromise(next, { ...p, status: kept ? "KEPT" : "BROKEN", evaluatedOn: date, note });
    if (kept) next = addMoraleShock(next, p.playerId, 6, `Höll löftet: ${PROMISE_KIND_LABEL[p.kind].toLowerCase()}`, 60);
    emit(dynamicsEvent(`promise:${p.id}:${kept ? "kept" : "broken"}`, date, kept ? "INFORMATION" : "IMPORTANT",
      kept ? `Löftet till ${playerName(next, p.playerId)} hölls` : `Löftet till ${playerName(next, p.playerId)} bröts`,
      `${describePromise(p)}. ${note}${kept ? "" : " Moralen sjunker och spelaren kommer ihåg det."}`, p.playerId));
  }
  return next;
}

/** Selling a player you promised not to sell breaks the promise on the spot. */
export function breakNotSellPromises(state: CareerState, playerId: string, date: string): CareerState {
  let next = state;
  for (const p of Object.values(dynamicsOf(state).promises)) if (p.playerId === playerId && p.kind === "NOT_SELL" && p.status === "ACTIVE") next = setPromise(next, { ...p, status: "BROKEN", evaluatedOn: date, note: "Spelaren såldes trots löftet." });
  return next;
}

function setPromise(state: CareerState, p: PlayerPromise): CareerState {
  const d = dynamicsOf(state);
  return { ...state, playerDynamics: { ...d, promises: { ...d.promises, [p.id]: p } } };
}

export function activePromises(state: CareerState, playerId: string): PlayerPromise[] {
  return Object.values(dynamicsOf(state).promises).filter((p) => p.playerId === playerId && p.status === "ACTIVE");
}
