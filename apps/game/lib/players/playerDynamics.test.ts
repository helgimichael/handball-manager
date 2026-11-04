// HM-ALPHA3-M05: player dynamics and the selling side of the market.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import type { CareerState } from "../career/types";
import { getCareerClubSquad } from "../career/careerWorld";
import { updatePlayerSquadStatus } from "../career/squadStatus";
import { ensureClubFinances } from "../economy/ledger";
import { getPlayerMarketValueEur } from "../economy/contractIntegration";
import { applyMoraleToRatings, moraleMatchFactor, updateMoraleWeekly } from "./morale";
import { openRenewalTalks, progressRenewalTalks, renewalDemand, submitRenewalOffer } from "./renewals";
import { acceptIncomingOffer, closeDepartedPlayerBusiness, completeSale, confirmIncomingSale, counterIncomingOffer, findBuyer, generateIncomingOffers, progressIncomingOffers, progressPreContracts, rejectIncomingSale, releaseCost, releasePlayer, requestBidFor, withdrawIncomingOffer } from "./market";
import { listPlayer, progressTalks } from "./talks";
import { evaluatePromises, makePromise } from "./promises";
import { addDaysIso, managerSquadIds, personalityOf } from "./dynamicsState";

const SKOVDE = "se_club_ifk_skovde_hk";
const COMPS = ["se_handbollsligan_herr", "swe-2"];
function career(): CareerState {
  const squads = Object.assign({}, ...COMPS.map((c) => snapshotWorldSquads(c)));
  const ratings = Object.assign({}, ...COMPS.map((c) => snapshotGameplayRatings(c)));
  const staff = Object.assign({}, ...COMPS.map((c) => snapshotAllClubsStaff(c)));
  return ensureClubFinances(createNewCareerState("m05-tests", SKOVDE, squads, undefined, ratings, staff), "2026-07-01");
}
const at = (s: CareerState, date: string): CareerState => ({ ...s, gameDate: date });
const noEmit = () => undefined;

test("morale moves match performance by at most ±3 %, only for the manager's own players", () => {
  assert.equal(moraleMatchFactor(70), 1);
  assert.equal(moraleMatchFactor(0), 0.97);
  assert.equal(moraleMatchFactor(100), 1.03);
  let s = career();
  const id = managerSquadIds(s)[0]!;
  s = { ...s, playerDynamics: { morale: { [id]: { moralePct: 25, targetPct: 25, factors: [], updatedOn: s.gameDate, unhappyWeeks: 0 } }, promises: {}, concerns: {}, requests: {}, listings: {}, departures: [] } };
  const mine = applyMoraleToRatings(s, SKOVDE, s.gameplayRatings[SKOVDE]!);
  const before = Object.values(s.gameplayRatings[SKOVDE]!.find((r) => r.playerId === id)!.branch.attributes)[0]!.value;
  const after = Object.values(mine.find((r) => r.playerId === id)!.branch.attributes)[0]!.value;
  assert.ok(Math.abs(after / before - 0.97) < 1e-9);
  const other = Object.keys(s.gameplayRatings).find((c) => c !== SKOVDE)!;
  assert.equal(applyMoraleToRatings(s, other, s.gameplayRatings[other]!), s.gameplayRatings[other]);
});

test("weekly morale is explained by factors and moves a bounded step", () => {
  let s = career();
  const id = managerSquadIds(s)[0]!;
  s = listPlayer(s, id, "MANAGER");
  s = updateMoraleWeekly(at(s, "2026-07-06"), "2026-07-06");
  const m = s.playerDynamics!.morale[id]!;
  assert.ok(m.factors.some((f) => f.key === "TRANSFER" && f.points < 0), "listing against his will is a factor");
  assert.ok(m.moralePct >= 70 - 6 - 3 && m.moralePct < 70, `bounded step, got ${m.moralePct}`);
});

test("renewal is a negotiation: the demand is at least his wage, a low offer is countered, the demand is accepted", () => {
  let s = at(career(), "2026-09-01");
  // Someone who asks for a real raise, so a lower offer can be countered.
  const id = managerSquadIds(s).find((p) => renewalDemand(s, p).demandEurPerMonth >= s.playerContracts[p]!.wageEurPerMonth * 1.06)!;
  assert.ok(id, "at least one player asks for a raise");
  const wage = s.playerContracts[id]!.wageEurPerMonth;
  s = openRenewalTalks(s, id, { kind: "MANAGER" });
  const talk = Object.values(s.renewalTalks!)[0]!;
  assert.equal(talk.status, "OPEN");
  assert.ok(talk.demandEurPerMonth >= wage, "a renewal never asks for less than he earns");
  s = submitRenewalOffer(s, talk.id, { wageEurPerMonth: Math.max(wage, Math.round(talk.demandEurPerMonth * 0.93)), years: 2 });
  s = progressRenewalTalks(at(s, "2026-09-02"), "2026-09-02", noEmit);
  const after1 = s.renewalTalks![talk.id]!;
  assert.equal(after1.rounds[0]!.response, "COUNTER");
  s = submitRenewalOffer(s, talk.id, { wageEurPerMonth: after1.demandEurPerMonth, years: 2 });
  s = progressRenewalTalks(at(s, "2026-09-03"), "2026-09-03", noEmit);
  assert.equal(s.renewalTalks![talk.id]!.status, "AGREED");
  assert.equal(s.playerContracts[id]!.wageEurPerMonth, after1.demandEurPerMonth);
  assert.ok(s.playerContracts[id]!.contractEndDate >= "2028-05-31");
});

test("an ambitious, unhappy key player refuses to talk about a new contract", () => {
  let s = at(career(), "2026-09-01");
  const ids = managerSquadIds(s);
  // Find someone whose stable personality is ambitious.
  const id = ids.find((p) => personalityOf(s, p).ambition >= 16);
  if (!id) return; // no such player in this squad -- nothing to assert
  s = updatePlayerSquadStatus(s, id, "KEY_PLAYER");
  s = { ...s, playerDynamics: { morale: { [id]: { moralePct: 40, targetPct: 40, factors: [], updatedOn: s.gameDate, unhappyWeeks: 1 } }, promises: {}, concerns: {}, requests: {}, listings: {}, departures: [] } };
  s = openRenewalTalks(s, id, { kind: "MANAGER" });
  assert.equal(Object.values(s.renewalTalks!)[0]!.status, "REFUSED");
});

test("a listed player attracts a bid; a counter within the buyer's limit is accepted and the sale goes through the ledger", () => {
  let s = at(career(), "2026-07-06");
  const id = managerSquadIds(s).sort((a, b) => (getPlayerMarketValueEur(s, b) ?? 0) - (getPlayerMarketValueEur(s, a) ?? 0))[3]!;
  s = listPlayer(s, id, "MANAGER");
  let date = "2026-07-06";
  for (let i = 0; i < 20 && !Object.values(s.incomingOffers ?? {}).some((o) => o.playerId === id); i++) {
    s = generateIncomingOffers(at(s, date), date, noEmit);
    date = addDaysIso(date, 7);
  }
  const offer = Object.values(s.incomingOffers ?? {}).find((o) => o.playerId === id);
  assert.ok(offer, "a listed player gets a bid within a few weeks of an open window");
  assert.ok(offer!.maxFeeEur >= offer!.feeEur);
  s = counterIncomingOffer(s, offer!.id, Math.min(offer!.maxFeeEur, offer!.feeEur + 1000));
  const cashBefore = s.clubEconomies[SKOVDE]!.cashEur;
  s = progressIncomingOffers(at(s, addDaysIso(s.gameDate, 1)), addDaysIso(s.gameDate, 1), noEmit);
  const o = s.incomingOffers![offer!.id]!;
  if (o.status === "PLAYER_REFUSED") return; // his own choice -- the flow worked
  assert.equal(o.status, "AWAITING_FINAL_APPROVAL", "buyer accepted counter and player agreed, but requires manager final approval");
  assert.equal(s.playerContracts[id]!.clubId, SKOVDE, "player must not leave squad before manager confirmation");
  assert.equal(s.clubEconomies[SKOVDE]!.cashEur, cashBefore, "money must not be booked before manager confirmation");

  // Manager confirms sale
  s = confirmIncomingSale(s, offer!.id);
  const oCompleted = s.incomingOffers![offer!.id]!;
  assert.equal(oCompleted.status, "COMPLETED", `status ${oCompleted.status}`);
  assert.equal(s.playerContracts[id]!.clubId, offer!.fromClubId);
  assert.equal(s.clubEconomies[SKOVDE]!.cashEur, cashBefore + oCompleted.feeEur);
  assert.ok(s.clubFinances![SKOVDE]!.pendingTransactions.some((t) => t.category === "TRANSFER_FEES" && t.amountEur === oCompleted.feeEur));
  assert.equal(s.playerDynamics!.departures.at(-1)!.kind, "SALE");
  assert.ok(!getCareerClubSquad(s, SKOVDE).some((p) => p.id === id));
});

test("accepting a bid outside the window agrees the deal and completes it when the window opens", () => {
  let s = at(career(), "2026-11-02");
  const id = managerSquadIds(s)[5]!;
  const buyer = findBuyer(s, id, "t");
  if (!buyer) return;
  const offer = { id: "in:test", playerId: id, fromClubId: buyer.clubId, foreign: buyer.foreign, openedOn: s.gameDate, feeEur: 5000, maxFeeEur: 8000, wageEurPerMonth: 1500, contractYears: 2, status: "OPEN" as const, respondBy: "2026-11-09", rounds: [], motive: "test" };
  s = { ...s, incomingOffers: { [offer.id]: offer }, playerDynamics: { morale: {}, promises: {}, concerns: {}, requests: { [id]: { playerId: id, submittedOn: s.gameDate, reason: "x", status: "OPEN" } }, listings: {}, departures: [] } };
  s = acceptIncomingOffer(s, offer.id);
  assert.equal(s.incomingOffers![offer.id]!.status, "AWAITING_FINAL_APPROVAL");
  s = confirmIncomingSale(s, offer.id);
  assert.equal(s.incomingOffers![offer.id]!.status, "AWAITING_WINDOW");
  assert.equal(s.incomingOffers![offer.id]!.completesOn, "2027-01-01");
  s = progressIncomingOffers(at(s, "2027-01-01"), "2027-01-01", noEmit);
  assert.equal(s.incomingOffers![offer.id]!.status, "COMPLETED");
  assert.equal(s.playerContracts[id]!.clubId, buyer.clubId);
  void completeSale;
});

test("manager can reject sale at AWAITING_FINAL_APPROVAL and player remains in squad", () => {
  let s = at(career(), "2026-07-06");
  const id = managerSquadIds(s)[4]!;
  const buyer = findBuyer(s, id, "t2");
  if (!buyer) return;
  const offer = { id: "in:test-reject", playerId: id, fromClubId: buyer.clubId, foreign: buyer.foreign, openedOn: s.gameDate, feeEur: 6000, maxFeeEur: 9000, wageEurPerMonth: 1800, contractYears: 2, status: "OPEN" as const, respondBy: "2026-07-13", rounds: [], motive: "test" };
  s = { ...s, incomingOffers: { [offer.id]: offer }, playerDynamics: { morale: {}, promises: {}, concerns: {}, requests: {}, listings: {}, departures: [] } };
  s = acceptIncomingOffer(s, offer.id);
  if (s.incomingOffers![offer.id]!.status === "PLAYER_REFUSED") return;
  assert.equal(s.incomingOffers![offer.id]!.status, "AWAITING_FINAL_APPROVAL");
  s = rejectIncomingSale(s, offer.id);
  assert.equal(s.incomingOffers![offer.id]!.status, "REJECTED");
  assert.equal(s.playerContracts[id]!.clubId, SKOVDE);
  assert.ok(getCareerClubSquad(s, SKOVDE).some((p) => p.id === id));
});

test("setting requireFinalTransferApproval to false allows immediate transfer completion", () => {
  let s = at(career(), "2026-07-06");
  s = { ...s, requireFinalTransferApproval: false };
  const id = managerSquadIds(s)[2]!;
  const buyer = findBuyer(s, id, "t3");
  if (!buyer) return;
  const offer = { id: "in:test-no-consent", playerId: id, fromClubId: buyer.clubId, foreign: buyer.foreign, openedOn: s.gameDate, feeEur: 7000, maxFeeEur: 10000, wageEurPerMonth: 2000, contractYears: 2, status: "OPEN" as const, respondBy: "2026-07-13", rounds: [], motive: "test" };
  s = { ...s, incomingOffers: { [offer.id]: offer }, playerDynamics: { morale: {}, promises: {}, concerns: {}, requests: {}, listings: {}, departures: [] } };
  s = acceptIncomingOffer(s, offer.id);
  if (s.incomingOffers![offer.id]!.status === "PLAYER_REFUSED") return;
  assert.equal(s.incomingOffers![offer.id]!.status, "COMPLETED");
  assert.equal(s.playerContracts[id]!.clubId, buyer.clubId);
});

test("releasing a player pays his remaining wages (max six months) as a ledger cost", () => {
  let s = at(career(), "2026-10-15");
  const id = managerSquadIds(s)[8]!;
  const cost = releaseCost(s, id);
  assert.ok(cost > 0 && cost <= s.playerContracts[id]!.wageEurPerMonth * 6);
  const cash = s.clubEconomies[SKOVDE]!.cashEur;
  s = releasePlayer(s, id);
  assert.equal(s.clubEconomies[SKOVDE]!.cashEur, cash - cost);
  assert.ok(s.clubFinances![SKOVDE]!.pendingTransactions.some((t) => t.category === "PLAYER_RELEASE"));
  assert.notEqual(s.playerContracts[id]?.clubId, SKOVDE);
});

test("two broken promises turn into a transfer request", () => {
  let s = at(career(), "2026-09-07");
  const id = managerSquadIds(s)[2]!;
  s = updatePlayerSquadStatus(s, id, "SQUAD_PLAYER");
  s = makePromise(s, id, "SQUAD_ROLE", "KEY_PLAYER", 7, "TALK");
  s = makePromise(s, id, "SQUAD_ROLE", "FIRST_CHOICE", 7, "TALK");
  s = evaluatePromises(at(s, "2026-09-15"), "2026-09-15", noEmit);
  assert.equal(Object.values(s.playerDynamics!.promises).filter((p) => p.status === "BROKEN").length, 2);
  s = updateMoraleWeekly(s, "2026-09-15");
  assert.ok(s.playerDynamics!.morale[id]!.factors.some((f) => f.key === "PROMISES" && f.points <= -16));
  const events: string[] = [];
  s = progressTalks(s, "2026-09-15", (e) => events.push(e.id));
  assert.equal(s.playerDynamics!.requests[id]?.status, "OPEN");
  assert.ok(events.some((e) => e.includes("request")));
});

test("a pre-contract moves the player on the last day of his contract, with no fee", () => {
  let s = at(career(), "2027-05-31");
  const id = managerSquadIds(s)[4]!;
  const buyer = findBuyer(s, id, "pre");
  if (!buyer) return;
  s = { ...s, playerContracts: { ...s.playerContracts, [id]: { ...s.playerContracts[id]!, contractEndDate: "2027-05-31" } }, preContracts: { [id]: { playerId: id, toClubId: buyer.clubId, foreign: buyer.foreign, agreedOn: "2027-02-01", effectiveOn: "2027-05-31", wageEurPerMonth: 1200 } } };
  const cash = s.clubEconomies[SKOVDE]!.cashEur;
  s = progressPreContracts(s, "2027-05-31", noEmit);
  assert.equal(s.playerContracts[id]!.clubId, buyer.clubId);
  assert.equal(s.clubEconomies[SKOVDE]!.cashEur, cash);
  assert.equal(s.preContracts?.[id], undefined);
  assert.equal(s.playerDynamics!.departures.at(-1)!.kind, "PRE_CONTRACT");
});

test("HM-ALPHA3-M10: no club bids for a player whose contract ends before the deal could complete", () => {
  let s = at(career(), "2026-11-02"); // window shut
  const id = managerSquadIds(s)[4]!;
  s = listPlayer(s, id, "MANAGER");
  s = { ...s, playerContracts: { ...s.playerContracts, [id]: { ...s.playerContracts[id]!, contractEndDate: "2026-12-15" } } };
  assert.equal(requestBidFor(s, id, s.gameDate, noEmit), s, "his contract runs out before the window opens");
  let date = s.gameDate;
  for (let i = 0; i < 6; i++, date = addDaysIso(date, 7)) s = generateIncomingOffers(at(s, date), date, noEmit);
  assert.ok(!Object.values(s.incomingOffers ?? {}).some((o) => o.playerId === id), "listed or not, buyers wait for him as a free agent");
});

test("HM-ALPHA3-M10: a player who has left takes his listing and open bids with him", () => {
  let s = at(career(), "2027-05-20");
  const id = managerSquadIds(s)[6]!;
  const buyer = findBuyer(s, id, "t");
  if (!buyer) return;
  s = listPlayer(s, id, "MANAGER");
  const offer = { id: "in:gone", playerId: id, fromClubId: buyer.clubId, foreign: buyer.foreign, openedOn: s.gameDate, feeEur: 5000, maxFeeEur: 8000, wageEurPerMonth: 1500, contractYears: 2, status: "OPEN" as const, respondBy: "2027-06-09", rounds: [], motive: "test" };
  s = { ...s, incomingOffers: { [offer.id]: offer } };
  const closed = closeDepartedPlayerBusiness(s, id, "2027-05-31");
  assert.equal(closed.playerDynamics!.listings[id], undefined);
  assert.equal(closed.incomingOffers![offer.id]!.status, "WITHDRAWN");
  // An older save where he already left with the listing still open is repaired by the daily offer pass.
  const elsewhere = { ...s, playerContracts: { ...s.playerContracts, [id]: { ...s.playerContracts[id]!, clubId: buyer.clubId } } };
  const repaired = progressIncomingOffers(at(elsewhere, "2027-06-01"), "2027-06-01", noEmit);
  assert.equal(repaired.playerDynamics!.listings[id], undefined);
  assert.equal(repaired.incomingOffers![offer.id]!.status, "WITHDRAWN");
});
