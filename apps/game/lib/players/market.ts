// HM-ALPHA3-M05: the selling side of the market. Domestic CPU clubs and
// clubs abroad bid for the manager's players when there is a reason --
// they are listed, want to leave, are running out of contract or are
// simply good enough -- within the buyer's real budget. The manager
// accepts, rejects or counters; the player has the final say on a move.
// Completed sales, releases (with compensation) and pre-contract exits go
// through the ledger and the normal ownership change.
import { getCareerClubSquad, getCareerPlayer } from "../career/careerWorld";
import { releasePlayerToFreeAgency } from "../career/contractExpiry";
import { clubCompetitionTier } from "../career/competitionMembership";
import { getCareerWorldCompetitionIds } from "../career/worldCompetitions";
import type { CareerState } from "../career/types";
import { ownLevelScore } from "../career/cpuCandidateEvaluation";
import { assessPositionNeed } from "../career/cpuSquadNeeds";
import { adjustClubCash, getClubEconomyBaseline } from "../economy/clubEconomyIntegration";
import { getPlayerFairWageEurPerMonth, getPlayerMarketValueEur } from "../economy/contractIntegration";
import { getClub, getClubsByCompetition, getCompetition, positionLabel } from "../game-data";
import { assessTransferAffordability } from "../transfers/affordability";
import { transferPlayerPermanently } from "../transfers/transferExecution";
import { isTransferWindowOpen, nextTransferWindowOpenDate } from "../transfers/transferWindow";
import { addMoraleShock, moraleOf } from "./morale";
import { breakNotSellPromises } from "./promises";
import { addDaysIso, caOf, dynamicsEvent, dynamicsOf, hash, managerSquadIds, personalityOf, playerName, type Emit } from "./dynamicsState";
import type { IncomingOffer, PlayerDeparture } from "./types";
import { formatEur } from "../economy/currency";
import { buildClubEvent } from "../career/careerEvents";

const RESPOND_DAYS = 7;
const MAX_OPEN_OFFERS = 3;
const FOREIGN_LEAGUES = ["ger-1", "den-1", "nor-1", "esp-1", "hun-1"] as const;
const round500 = (n: number) => Math.max(500, Math.round(n / 500) * 500);

function seasonEndYear(date: string): number {
  const y = Number(date.slice(0, 4));
  return date.slice(5) > "05-31" ? y + 1 : y;
}

function monthsLeft(state: CareerState, playerId: string): number {
  const end = state.playerContracts[playerId]?.contractEndDate;
  if (!end) return 0;
  return Math.max(0, (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${state.gameDate}T00:00:00Z`).getTime()) / (30.4 * 86_400_000));
}

/** The 75th-percentile ability in the manager's league -- the bar for interest from abroad. */
function foreignBar(state: CareerState): number {
  const comp = getClub(state.playerClubId)?.competitionId;
  const clubs = comp ? getClubsByCompetition(comp).map((c) => c.id) : [];
  const cas = clubs.flatMap((id) => (state.gameplayRatings[id] ?? []).map((r) => r.ca)).sort((a, b) => a - b);
  return cas.length ? cas[Math.floor(cas.length * 0.75)]! : Infinity;
}

interface Buyer { clubId: string; foreign: boolean; level: number; motive: string }

/** The most plausible buyer for a player right now, or null. */
export function findBuyer(state: CareerState, playerId: string, salt: string): Buyer | null {
  const player = getCareerPlayer(state, playerId);
  if (!player) return null;
  const ca = caOf(state, playerId);
  const value = getPlayerMarketValueEur(state, playerId) ?? 0;
  const wage = state.playerContracts[playerId]?.wageEurPerMonth ?? 0;
  const domestic = getCareerWorldCompetitionIds(state)
    .flatMap((id) => getClubsByCompetition(id))
    .filter((c) => c.id !== state.playerClubId && getClubEconomyBaseline(state, c.id) && (state.worldSquads[c.id]?.length ?? 0) > 0)
    .map((c) => ({ club: c, level: ownLevelScore(state, c.id) }))
    .filter(({ club, level }) => level <= ca + 6 && level >= ca - 25 && assessPositionNeed(state, club.id, player.position, getCareerClubSquad(state, club.id)).level !== "NONE")
    .filter(({ club }) => assessTransferAffordability(state, club.id, value * 0.8, 0, Math.max(wage * 1.1, getPlayerFairWageEurPerMonth(state, playerId) ?? wage)).affordable)
    .sort((a, b) => b.level - a.level || a.club.id.localeCompare(b.club.id));
  const foreignInterest = ca >= foreignBar(state);
  const pickForeign = foreignInterest && (domestic.length === 0 || hash(`${salt}:abroad`) < 0.45);
  if (pickForeign) {
    const pool = FOREIGN_LEAGUES.flatMap((l) => getClubsByCompetition(l));
    if (pool.length) {
      const club = pool[Math.floor(hash(`${salt}:foreign`) * pool.length)]!;
      const country = getCompetition(club.competitionId)?.name ?? "utlandet";
      return { clubId: club.id, foreign: true, level: ca + 10, motive: `${club.name} (${country}) vill ta honom till en högre nivå och erbjuder en lön svenska klubbar inte kan matcha.` };
    }
  }
  const pick = domestic[0];
  if (!pick) return null;
  const need = assessPositionNeed(state, pick.club.id, player.position, getCareerClubSquad(state, pick.club.id));
  const role = ca >= pick.level ? "en självklar startspelare" : "en viktig förstärkning";
  return { clubId: pick.club.id, foreign: false, level: pick.level, motive: `${pick.club.shortName} söker en ${positionLabel(player.position).toLowerCase()} -- de har ${need.usableCount} på positionen -- och ser honom som ${role}.` };
}

/** Weekly: at most one new bid, for the player with the strongest reason to attract one. */
export function generateIncomingOffers(state: CareerState, date: string, emit: Emit): CareerState {
  const open = Object.values(state.incomingOffers ?? {}).filter((o) => o.status === "OPEN" || o.status === "COUNTERED");
  if (open.length >= MAX_OPEN_OFFERS) return state;
  const d = dynamicsOf(state);
  const windowOpen = isTransferWindowOpen(date);
  const soon = !windowOpen && nextTransferWindowOpenDate(date) <= addDaysIso(date, 42);
  const top = managerSquadIds(state).map((id) => ({ id, ca: caOf(state, id) })).sort((a, b) => b.ca - a.ca).slice(0, 3).map((x) => x.id);
  const candidates = managerSquadIds(state)
    .filter((id) => !open.some((o) => o.playerId === id) && !state.preContracts?.[id])
    .filter((id) => !Object.values(state.incomingOffers ?? {}).some((o) => o.playerId === id && o.closedOn && addDaysIso(o.closedOn, 30) > date && !d.listings[id]))
    .map((id) => {
      let p = 0.012;
      // A listed player is on every club's radar.
      if (d.listings[id]) p *= 6;
      if (d.requests[id]?.status === "OPEN" || d.requests[id]?.status === "ACCEPTED") p *= 2;
      if (monthsLeft(state, id) <= 12) p *= 1.6;
      if (top.includes(id)) p *= 1.7;
      if (windowOpen) p *= 1.8;
      else if (soon) p *= 1.2;
      return { id, p, roll: hash(`${state.saveSeed}:offer:${id}:${date}`) };
    })
    .filter((c) => c.roll < c.p)
    .sort((a, b) => a.roll / a.p - b.roll / b.p);
  for (const c of candidates) {
    const buyer = findBuyer(state, c.id, `${state.saveSeed}:${c.id}:${date}`);
    if (!buyer) continue;
    const offer = buildOffer(state, c.id, buyer, date);
    if (!offer) continue;
    emit(buildClubEvent("TRANSFER_OFFER", `offer:${offer.id}`, date, "IMPORTANT", `Bud på ${playerName(state, c.id)} från ${getClub(buyer.clubId)?.shortName ?? buyer.clubId}`, `${formatEur(offer.feeEur)} ${buyer.foreign ? "från utlandet" : ""}. ${buyer.motive} Svara senast ${offer.respondBy}.`, [{ route: "TRANSFER_OFFER", offerId: offer.id }, { route: "PLAYER_PROFILE", playerId: c.id }], { entityType: "player", entityId: c.id }));
    return { ...state, incomingOffers: { ...state.incomingOffers, [offer.id]: offer } };
  }
  return state;
}

/** Asks the market for a bid on one player now (a delegated sporting director shopping a listed player around; QA). Same buyer search and bid rules as the weekly market. */
export function requestBidFor(state: CareerState, playerId: string, date: string, emit: Emit): CareerState {
  if (Object.values(state.incomingOffers ?? {}).some((o) => o.playerId === playerId && (o.status === "OPEN" || o.status === "COUNTERED"))) return state;
  const buyer = findBuyer(state, playerId, `${state.saveSeed}:ask:${playerId}:${date}`);
  const offer = buyer ? buildOffer(state, playerId, buyer, date) : null;
  if (!buyer || !offer) return state;
  emit(buildClubEvent("TRANSFER_OFFER", `offer:${offer.id}`, date, "IMPORTANT", `Bud på ${playerName(state, playerId)} från ${getClub(buyer.clubId)?.shortName ?? buyer.clubId}`, `${formatEur(offer.feeEur)}. ${buyer.motive} Svara senast ${offer.respondBy}.`, [{ route: "TRANSFER_OFFER", offerId: offer.id }, { route: "PLAYER_PROFILE", playerId }], { entityType: "player", entityId: playerId }));
  return { ...state, incomingOffers: { ...state.incomingOffers, [offer.id]: offer } };
}

function buildOffer(state: CareerState, playerId: string, buyer: Buyer, date: string): IncomingOffer | null {
  const value = getPlayerMarketValueEur(state, playerId) ?? 0;
  if (value <= 0) return null;
  const listing = dynamicsOf(state).listings[playerId];
  const salt = `${state.saveSeed}:${playerId}:${date}`;
  let fee = listing ? Math.max(value * 0.8, listing.askingEur * 0.82) : value * (0.82 + hash(`${salt}:fee`) * 0.18);
  if (monthsLeft(state, playerId) <= 12) fee *= 0.75;
  let maxFee = value * (1.1 + hash(`${salt}:max`) * 0.3) * (buyer.foreign ? 1.25 : 1);
  if (!buyer.foreign) {
    // A domestic buyer never goes beyond what its board allows.
    const wage = Math.max((state.playerContracts[playerId]?.wageEurPerMonth ?? 0) * 1.12, getPlayerFairWageEurPerMonth(state, playerId) ?? 0);
    while (maxFee > fee && !assessTransferAffordability(state, buyer.clubId, maxFee, 0, wage).affordable) maxFee *= 0.9;
    if (!assessTransferAffordability(state, buyer.clubId, fee, 0, wage).affordable) return null;
  }
  const current = state.playerContracts[playerId]?.wageEurPerMonth ?? 0;
  const age = ageYears(state, playerId);
  return {
    id: `in:${playerId}:${date}`,
    playerId,
    fromClubId: buyer.clubId,
    foreign: buyer.foreign,
    openedOn: date,
    feeEur: round500(fee),
    maxFeeEur: round500(Math.max(fee, maxFee)),
    wageEurPerMonth: Math.round(buyer.foreign ? current * 1.6 : Math.max(current * 1.12, getPlayerFairWageEurPerMonth(state, playerId) ?? current)),
    contractYears: age !== null && age >= 30 ? 2 : 3,
    status: "OPEN",
    respondBy: addDaysIso(date, RESPOND_DAYS),
    rounds: [{ date, by: "BUYER", feeEur: round500(fee), note: "Första bud." }],
    motive: buyer.motive,
  };
}

function ageYears(state: CareerState, playerId: string): number | null {
  const p = getCareerPlayer(state, playerId);
  if (!p) return null;
  const by = p.dateOfBirth ? Number(p.dateOfBirth.slice(0, 4)) : p.birthYear;
  return by ? Number(state.gameDate.slice(0, 4)) - by : null;
}

/** Would the player go? Decided when the clubs agree -- reasons in his words. */
export function playerStance(state: CareerState, offer: IncomingOffer): { willing: boolean; reason: string } {
  const d = dynamicsOf(state);
  const request = d.requests[offer.playerId];
  if (request?.status === "OPEN" || request?.status === "ACCEPTED" || d.listings[offer.playerId]?.reason === "TRANSFER_REQUEST") return { willing: true, reason: "Han vill lämna och tackar ja direkt." };
  const p = personalityOf(state, offer.playerId);
  const morale = moraleOf(state, offer.playerId);
  if (offer.foreign) {
    if (p.loyalty >= 17 && morale >= 75) return { willing: false, reason: "Han trivs och vill inte flytta utomlands nu." };
    return { willing: true, reason: "Ett steg utomlands lockar -- både sportsligt och ekonomiskt." };
  }
  const myTier = clubCompetitionTier(state, state.playerClubId) ?? 1;
  const theirTier = clubCompetitionTier(state, offer.fromClubId) ?? 1;
  const raise = offer.wageEurPerMonth / Math.max(1, state.playerContracts[offer.playerId]?.wageEurPerMonth ?? 1);
  if (theirTier < myTier) return { willing: true, reason: "En chans att spela i en högre serie." };
  if (theirTier > myTier && morale >= 40) return { willing: false, reason: "Han vill inte gå ner en serie." };
  if (morale < 55) return { willing: true, reason: "Han är inte nöjd här och ser en nystart." };
  if (ownLevelScore(state, offer.fromClubId) > ownLevelScore(state, state.playerClubId) + 3) return { willing: true, reason: "Den nya klubben har ett starkare lag." };
  if (raise >= 1.15 && p.ambition >= 12) return { willing: true, reason: "Lönehöjningen och rollen lockar." };
  if (p.loyalty >= 13) return { willing: false, reason: "Han trivs och vill stanna." };
  return { willing: true, reason: "Han ser flytten som ett steg framåt." };
}

export function acceptIncomingOffer(state: CareerState, offerId: string): CareerState {
  const offer = state.incomingOffers?.[offerId];
  if (!offer || offer.status !== "OPEN") throw new Error("Budet är inte längre öppet.");
  return agree(state, offer, offer.feeEur, state.gameDate, () => undefined);
}

export function rejectIncomingOffer(state: CareerState, offerId: string): CareerState {
  const offer = state.incomingOffers?.[offerId];
  if (!offer || (offer.status !== "OPEN" && offer.status !== "COUNTERED")) throw new Error("Budet är inte längre öppet.");
  let next = put(state, { ...offer, status: "REJECTED", closedOn: state.gameDate, rounds: [...offer.rounds, { date: state.gameDate, by: "MANAGER", feeEur: offer.feeEur, note: "Avvisat." }] });
  const request = dynamicsOf(state).requests[offer.playerId];
  const value = getPlayerMarketValueEur(state, offer.playerId) ?? 0;
  if ((request?.status === "OPEN" || request?.status === "ACCEPTED") && offer.feeEur >= value * 0.9) next = addMoraleShock(next, offer.playerId, -6, "Klubben stoppade en flytt han ville göra", 60);
  return next;
}

export function counterIncomingOffer(state: CareerState, offerId: string, askingFeeEur: number): CareerState {
  const offer = state.incomingOffers?.[offerId];
  if (!offer || offer.status !== "OPEN") throw new Error("Budet är inte längre öppet.");
  if (!(askingFeeEur > offer.feeEur)) throw new Error("Motbudet måste vara högre än budet.");
  return put(state, { ...offer, status: "COUNTERED", askingFeeEur: round500(askingFeeEur), answerOn: addDaysIso(state.gameDate, 1), rounds: [...offer.rounds, { date: state.gameDate, by: "MANAGER", feeEur: round500(askingFeeEur), note: "Ditt motbud." }] });
}

/** Clubs agree on a fee: the player decides, then the sale completes now or when the window opens. */
function agree(state: CareerState, offer: IncomingOffer, fee: number, date: string, emit: Emit): CareerState {
  const stance = playerStance(state, offer);
  if (!stance.willing) {
    emit(buildClubEvent("TRANSFER_OFFER", `offer:${offer.id}:refused`, date, "IMPORTANT", `${playerName(state, offer.playerId)} säger nej till flytten`, stance.reason, [{ route: "TRANSFER_OFFER", offerId: offer.id }], { entityType: "player", entityId: offer.playerId }));
    return put(state, { ...offer, feeEur: fee, status: "PLAYER_REFUSED", playerStance: stance, closedOn: date, answerOn: undefined });
  }
  if (isTransferWindowOpen(date)) return completeSale(put(state, { ...offer, feeEur: fee, status: "ACCEPTED", playerStance: stance, answerOn: undefined }), offer.id, date, emit);
  const completesOn = nextTransferWindowOpenDate(date);
  emit(buildClubEvent("TRANSFER_OFFER", `offer:${offer.id}:agreed`, date, "IMPORTANT", `${playerName(state, offer.playerId)} klar för ${getClub(offer.fromClubId)?.shortName ?? ""}`, `Klubbarna är överens om ${formatEur(fee)}. Övergången går igenom när fönstret öppnar ${completesOn}.`, [{ route: "TRANSFER_OFFER", offerId: offer.id }], { entityType: "player", entityId: offer.playerId }));
  return put(state, { ...offer, feeEur: fee, status: "AWAITING_WINDOW", playerStance: stance, completesOn, answerOn: undefined });
}

/** The sale itself: fee into the ledger, ownership to the buyer, the player's dynamics closed. */
export function completeSale(state: CareerState, offerId: string, date: string, emit: Emit): CareerState {
  const offer = state.incomingOffers![offerId]!;
  const me = state.playerClubId;
  if (state.playerContracts[offer.playerId]?.clubId !== me) return put(state, { ...offer, status: "WITHDRAWN", closedOn: date });
  const name = playerName(state, offer.playerId);
  const buyerName = getClub(offer.fromClubId)?.shortName ?? offer.fromClubId;
  let next = adjustClubCash(state, me, offer.feeEur, { category: "TRANSFER_FEES", label: `Försäljning: ${name} till ${buyerName}`, date });
  if (getClubEconomyBaseline(next, offer.fromClubId)) next = adjustClubCash(next, offer.fromClubId, -offer.feeEur, { category: "TRANSFER_FEES", label: `Köp: ${name}`, date });
  next = breakNotSellPromises(next, offer.playerId, date);
  next = transferPlayerPermanently(next, offer.playerId, me, offer.fromClubId, offer.wageEurPerMonth, `${seasonEndYear(date) + offer.contractYears}-05-31`);
  next = closePlayerDynamics(next, offer.playerId);
  next = recordDeparture(next, { playerId: offer.playerId, playerName: name, toClubId: offer.fromClubId, date, kind: "SALE", feeEur: offer.feeEur });
  emit(buildClubEvent("TRANSFER_OFFER", `offer:${offer.id}:completed`, date, "IMPORTANT", `${name} är såld till ${buyerName}`, `${formatEur(offer.feeEur)} är bokfört i Ekonomi. ${offer.foreign ? "Han lämnar för utlandet." : ""}`, [{ route: "TRANSFER_OFFER", offerId: offer.id }, { route: "FINANCE", tab: "ledger" }]));
  return put(next, { ...next.incomingOffers![offerId]!, status: "COMPLETED", closedOn: date });
}

/** Daily: buyer answers to counters, expiries and completions at the window. */
export function progressIncomingOffers(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  for (const offer of Object.values(state.incomingOffers ?? {})) {
    const o = next.incomingOffers![offer.id]!;
    if (next.playerContracts[o.playerId]?.clubId !== next.playerClubId && (o.status === "OPEN" || o.status === "COUNTERED" || o.status === "AWAITING_WINDOW")) {
      next = put(next, { ...o, status: "WITHDRAWN", closedOn: date });
      continue;
    }
    if (o.status === "OPEN" && o.respondBy < date) {
      next = put(next, { ...o, status: "EXPIRED", closedOn: date });
      emit(buildClubEvent("TRANSFER_OFFER", `offer:${o.id}:expired`, date, "INFORMATION", `Budet på ${playerName(next, o.playerId)} gick ut`, `${getClub(o.fromClubId)?.shortName ?? ""} fick inget svar och drog tillbaka budet.`, [{ route: "TRANSFER_OFFER", offerId: o.id }]));
    } else if (o.status === "COUNTERED" && o.answerOn && o.answerOn <= date) {
      const ask = o.askingFeeEur ?? o.feeEur;
      const managerCounters = o.rounds.filter((r) => r.by === "MANAGER").length;
      if (ask <= o.maxFeeEur) next = agree(next, { ...o, rounds: [...o.rounds, { date, by: "BUYER", feeEur: ask, note: "Köparen accepterar ditt pris." }] }, ask, date, emit);
      else if (ask <= o.maxFeeEur * 1.2 && managerCounters < 2) {
        const raised = round500(Math.min(o.maxFeeEur, (o.feeEur + ask) / 2));
        const final = raised >= o.maxFeeEur;
        next = put(next, { ...o, status: "OPEN", feeEur: raised, answerOn: undefined, respondBy: addDaysIso(date, RESPOND_DAYS), rounds: [...o.rounds, { date, by: "BUYER", feeEur: raised, note: final ? "Sista bud." : "Höjt bud." }] });
        emit(buildClubEvent("TRANSFER_OFFER", `offer:${o.id}:r${o.rounds.length}`, date, "IMPORTANT", `${getClub(o.fromClubId)?.shortName ?? ""} höjer budet på ${playerName(next, o.playerId)}`, `${formatEur(raised)}${final ? " -- deras sista bud" : ""}.`, [{ route: "TRANSFER_OFFER", offerId: o.id }]));
      } else {
        next = put(next, { ...o, status: "WITHDRAWN", closedOn: date, answerOn: undefined, rounds: [...o.rounds, { date, by: "BUYER", feeEur: o.feeEur, note: "Köparen drar sig ur." }] });
        emit(buildClubEvent("TRANSFER_OFFER", `offer:${o.id}:withdrawn`, date, "INFORMATION", `${getClub(o.fromClubId)?.shortName ?? ""} drar sig ur`, `Ditt pris (${formatEur(ask)}) var för högt.`, [{ route: "TRANSFER_OFFER", offerId: o.id }]));
      }
    } else if (o.status === "AWAITING_WINDOW" && o.completesOn && o.completesOn <= date) {
      next = completeSale(next, o.id, date, emit);
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Releases and pre-contracts
// ---------------------------------------------------------------------------

/** What releasing a player costs: his remaining wages, at most six months (a settlement). */
export function releaseCost(state: CareerState, playerId: string): number {
  const wage = state.playerContracts[playerId]?.wageEurPerMonth ?? 0;
  return Math.round(wage * Math.min(6, Math.ceil(monthsLeft(state, playerId))));
}

export function releasePlayer(state: CareerState, playerId: string): CareerState {
  if (state.playerContracts[playerId]?.clubId !== state.playerClubId) throw new Error("Bara klubbens egna spelare kan släppas.");
  const cost = releaseCost(state, playerId);
  const name = playerName(state, playerId);
  let next = cost > 0 ? adjustClubCash(state, state.playerClubId, -cost, { category: "PLAYER_RELEASE", label: `Avslutat avtal: ${name}`, date: state.gameDate }) : state;
  next = releasePlayerToFreeAgency(next, playerId, state.gameDate);
  next = closePlayerDynamics(next, playerId);
  return recordDeparture(next, { playerId, playerName: name, toClubId: "", date: state.gameDate, kind: "RELEASE", feeEur: 0, costEur: cost });
}

/** Monthly from January: players in their final contract year may agree to join another club in the summer. */
export function progressPreContracts(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  if (date.endsWith("-01") && Number(date.slice(5, 7)) >= 1 && Number(date.slice(5, 7)) <= 5) {
    const end = `${date.slice(0, 4)}-05-31`;
    for (const id of managerSquadIds(next)) {
      const c = next.playerContracts[id];
      if (!c || c.contractEndDate > end || next.preContracts?.[id]) continue;
      const talks = Object.values(next.renewalTalks ?? {}).some((t) => t.playerId === id && (t.status === "OPEN" || (t.status === "AGREED")));
      const p = personalityOf(next, id);
      const morale = moraleOf(next, id);
      // Mostly unhappy or strong players: roughly one in four over a whole spring for an average player nobody talks to.
      let chance = 0.04 + (morale < 50 ? 0.08 : 0) + (caOf(next, id) >= foreignBar(next) ? 0.05 : 0) - (p.loyalty >= 15 ? 0.03 : 0);
      if (talks) chance /= 2;
      if (hash(`${next.saveSeed}:precontract:${id}:${date}`) >= chance) continue;
      const buyer = findBuyer(next, id, `${next.saveSeed}:pre:${id}:${date}`);
      if (!buyer) continue;
      next = { ...next, preContracts: { ...next.preContracts, [id]: { playerId: id, toClubId: buyer.clubId, foreign: buyer.foreign, agreedOn: date, effectiveOn: c.contractEndDate, wageEurPerMonth: Math.round(c.wageEurPerMonth * (buyer.foreign ? 1.5 : 1.15)) } } };
      for (const t of Object.values(next.renewalTalks ?? {})) if (t.playerId === id && t.status === "OPEN") next = { ...next, renewalTalks: { ...next.renewalTalks, [t.id]: { ...t, status: "WITHDRAWN", closedOn: date, answerOn: undefined } } };
      emit(dynamicsEvent(`precontract:${id}:${date}`, date, "IMPORTANT", `${playerName(next, id)} har skrivit förhandsavtal`, `Han går till ${getClub(buyer.clubId)?.name ?? buyer.clubId} när avtalet går ut ${c.contractEndDate}. Klubben får ingen ersättning.`, id));
    }
  }
  // The move itself, on the last day of his contract (before the expiry sweep releases him).
  for (const pc of Object.values(next.preContracts ?? {})) {
    if (pc.effectiveOn > date || next.playerContracts[pc.playerId]?.clubId !== next.playerClubId) continue;
    const name = playerName(next, pc.playerId);
    next = transferPlayerPermanently(next, pc.playerId, next.playerClubId, pc.toClubId, pc.wageEurPerMonth, `${seasonEndYear(addDaysIso(date, 1)) + 2}-05-31`);
    next = closePlayerDynamics(next, pc.playerId);
    next = recordDeparture(next, { playerId: pc.playerId, playerName: name, toClubId: pc.toClubId, date, kind: "PRE_CONTRACT", feeEur: 0 });
    const { [pc.playerId]: _done, ...rest } = next.preContracts ?? {};
    next = { ...next, preContracts: rest };
    emit(dynamicsEvent(`precontract:${pc.playerId}:moved`, date, "INFORMATION", `${name} har lämnat`, `Förhandsavtalet med ${getClub(pc.toClubId)?.shortName ?? pc.toClubId} gäller från i dag.`, pc.playerId));
  }
  return next;
}

/** Ends everything that belonged to the player's time at the club. */
export function closePlayerDynamics(state: CareerState, playerId: string): CareerState {
  const d = dynamicsOf(state);
  const { [playerId]: _m, ...morale } = d.morale;
  const { [playerId]: _l, ...listings } = d.listings;
  const requests = d.requests[playerId] ? { ...d.requests, [playerId]: { ...d.requests[playerId]!, status: "WITHDRAWN" as const, decidedOn: d.requests[playerId]!.decidedOn ?? state.gameDate } } : d.requests;
  const concerns = Object.fromEntries(Object.entries(d.concerns).map(([k, c]) => [k, c.playerId === playerId && c.status === "OPEN" ? { ...c, status: "LAPSED" as const } : c]));
  let next: CareerState = { ...state, playerDynamics: { ...d, morale, listings, requests, concerns } };
  for (const t of Object.values(next.renewalTalks ?? {})) if (t.playerId === playerId && t.status === "OPEN") next = { ...next, renewalTalks: { ...next.renewalTalks, [t.id]: { ...t, status: "WITHDRAWN", closedOn: state.gameDate, answerOn: undefined } } };
  return next;
}

function recordDeparture(state: CareerState, dep: PlayerDeparture): CareerState {
  const d = dynamicsOf(state);
  return { ...state, playerDynamics: { ...d, departures: [...d.departures, dep].slice(-40) } };
}

function put(state: CareerState, offer: IncomingOffer): CareerState {
  return { ...state, incomingOffers: { ...state.incomingOffers, [offer.id]: offer } };
}

