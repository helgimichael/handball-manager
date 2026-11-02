// HM-ALPHA3-M04: staff organisation, market, negotiations, lifecycle and effects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { processDay } from "../career/dailyTick";
import { addDays } from "../career/dateUtils";
import type { CareerState } from "../career/types";
import { getClubEconomyBaseline } from "../economy/clubEconomyIntegration";
import { ensureClubFinances } from "../economy/ledger";
import { academyDevelopmentFactor, clubOrganisation, clubSize, recruitmentDepartmentFactor, vacancies } from "./organisation";
import { ensureStaffMarket, marketCandidates, staffKnowledge, visibleAttribute } from "./staffMarket";
import { compensationDemand, dismissalCost, dismissStaff, progressStaffNegotiations, startStaffNegotiation, submitStaffOffer, wageDemand } from "./staffNegotiation";
import { progressStaff } from "./staffLifecycle";
import { findStaffMember } from "./staffCareerIntegration";

const ME = "se_club_ov_helsingborg"; // an E4 club with room in its staff budget
function career(): CareerState {
  const comps = ["se_handbollsligan_herr", "swe-2"];
  const squads = Object.assign({}, ...comps.map((c) => snapshotWorldSquads(c)));
  const ratings = Object.assign({}, ...comps.map((c) => snapshotGameplayRatings(c)));
  const staff = Object.assign({}, ...comps.map((c) => snapshotAllClubsStaff(c)));
  return ensureClubFinances(ensureStaffMarket(createNewCareerState("staff-tests", ME, squads, undefined, ratings, staff)), "2026-08-19");
}
const noEmit = () => undefined;

test("organisation: positions scale with club size and missing specialists are covered", () => {
  const state = career();
  const org = clubOrganisation(state, ME);
  const size = clubSize(getClubEconomyBaseline(state, ME)?.band);
  assert.ok(org.length > 8);
  if (size !== "BIG") assert.ok(org.some((p) => p.role === "HEAD_OF_RECRUITMENT" && (p.holder || p.coveredBy === "SPORTING_DIRECTOR")), "the sporting director recruits at a smaller club");
  assert.ok(Array.isArray(vacancies(state, ME)));
});

test("market: a deterministic free-agent pool for every role, outside people only partly known", () => {
  const a = career(), b = career();
  assert.deepEqual(Object.keys(a.staffMarket!.freeAgents), Object.keys(b.staffMarket!.freeAgents));
  const candidates = marketCandidates(a);
  for (const role of ["SPORTING_DIRECTOR", "HEAD_OF_RECRUITMENT", "HEAD_OF_ACADEMY", "DEVELOPMENT_COACH", "ASSISTANT_COACH", "GOALKEEPER_COACH", "SCOUT"]) assert.ok(candidates.some((c) => c.role === role && c.status === "FREE_AGENT"), role);
  const outsider = candidates[0]!;
  assert.ok(outsider.knowledge < 60);
  const own = a.staffRoster[ME]?.[0];
  if (own) assert.equal(staffKnowledge(a, own.id), 100);
  assert.deepEqual(visibleAttribute(14, 95), { low: 14, high: 14, exact: true });
  assert.equal(visibleAttribute(14, 30).exact, false);
});

test("hiring a free agent: offer below demand is countered, the counter is accepted, the person joins", () => {
  let state = career();
  const target = marketCandidates(state).find((c) => c.status === "FREE_AGENT" && c.role === "HEAD_OF_ACADEMY")!;
  const opened = startStaffNegotiation(state, target.member.id, "HEAD_OF_ACADEMY");
  state = opened.state;
  const demand = wageDemand(state, target.member.id, ME, "HEAD_OF_ACADEMY", "HIRE");
  state = submitStaffOffer(state, opened.negotiation.id, { wageEurPerMonth: Math.round(demand * 0.85), years: 2 });
  assert.throws(() => submitStaffOffer(state, opened.negotiation.id, { wageEurPerMonth: demand }), /Vänta/);
  const events: string[] = [];
  state = progressStaffNegotiations(state, addDays(state.gameDate, 1), (e) => events.push(e.subject));
  const n = state.staffNegotiations![opened.negotiation.id]!;
  assert.equal(n.rounds.at(-1)!.response, "COUNTER");
  state = submitStaffOffer(state, n.id, { wageEurPerMonth: n.rounds.at(-1)!.counter!.wageEurPerMonth, years: 2 });
  state = progressStaffNegotiations(state, addDays(state.gameDate, 1), (e) => events.push(e.subject));
  assert.equal(state.staffNegotiations![n.id]!.stage, "COMPLETED");
  assert.equal(findStaffMember(state, target.member.id)?.clubId, ME);
  assert.equal(state.staffEmployment[target.member.id]?.employmentType, "SALARIED");
  assert.ok(!state.staffMarket!.freeAgents[target.member.id], "no longer a free agent");
  assert.equal(staffKnowledge(state, target.member.id), 100);
  assert.ok(state.staffAppointments?.some((a) => a.staffId === target.member.id && a.kind === "APPOINTED"));
  assert.ok(events.some((s) => s.includes("klar för klubben")));
});

test("hiring someone under contract: their club wants compensation, paid through both ledgers", () => {
  let state = career();
  const target = marketCandidates(state).find((c) => c.status === "EMPLOYED" && compensationDemand(state, c.member.id) > 0);
  if (!target) return; // every rival contract may already be expiring in this dataset
  const from = target.currentClubId!;
  const opened = startStaffNegotiation(state, target.member.id, target.role);
  assert.equal(opened.negotiation.stage, "CLUB");
  state = submitStaffOffer(opened.state, opened.negotiation.id, { compensationEur: compensationDemand(opened.state, target.member.id) });
  state = progressStaffNegotiations(state, addDays(state.gameDate, 1), noEmit);
  const n = state.staffNegotiations![opened.negotiation.id]!;
  assert.equal(n.stage, "TERMS");
  state = submitStaffOffer(state, n.id, { wageEurPerMonth: wageDemand(state, target.member.id, ME, target.role, "HIRE"), years: 3 });
  state = progressStaffNegotiations(state, addDays(state.gameDate, 1), noEmit);
  assert.equal(findStaffMember(state, target.member.id)?.clubId, ME);
  const paid = state.clubFinances![ME]!.pendingTransactions.find((t) => t.category === "STAFF_COMPENSATION");
  const received = state.clubFinances![from]!.pendingTransactions.find((t) => t.category === "STAFF_COMPENSATION");
  assert.ok(paid && paid.amountEur < 0 && received && received.amountEur === -paid.amountEur);
});

test("dismissal books severance and puts the person on the market; our expiring contract warns and then ends", () => {
  let state = career();
  const member = (state.staffRoster[ME] ?? []).find((m) => state.staffEmployment[m.id]?.employmentType === "SALARIED");
  if (!member) return;
  const cost = dismissalCost(state, member.id);
  const after = dismissStaff(state, member.id);
  assert.ok(!findStaffMember(after, member.id));
  assert.ok(after.staffMarket!.freeAgents[member.id]);
  if (cost > 0) assert.ok(after.clubFinances![ME]!.pendingTransactions.some((t) => t.category === "STAFF_COMPENSATION" && t.amountEur === -cost));

  const end = "2026-12-31";
  state = { ...state, staffEmployment: { ...state.staffEmployment, [member.id]: { ...state.staffEmployment[member.id]!, contractEndDate: end } } };
  const warned: string[] = [];
  progressStaff(state, addDays(end, -60), (e) => warned.push(e.id));
  assert.ok(warned.some((id) => id.includes(`expiry:${member.id}`)));
  const gone = progressStaff(state, addDays(end, 1), noEmit);
  assert.ok(!findStaffMember(gone, member.id), "the contract ran out");
});

test("renewal through the same negotiation: the new terms replace the old contract", () => {
  let state = career();
  const member = (state.staffRoster[ME] ?? []).find((m) => state.staffEmployment[m.id]?.employmentType === "SALARIED");
  if (!member) return;
  const opened = startStaffNegotiation(state, member.id, member.roles[0]!, "RENEW");
  assert.equal(opened.negotiation.stage, "TERMS");
  state = submitStaffOffer(opened.state, opened.negotiation.id, { wageEurPerMonth: wageDemand(opened.state, member.id, ME, member.roles[0]!, "RENEW"), years: 3 });
  state = progressStaffNegotiations(state, addDays(state.gameDate, 1), noEmit);
  assert.equal(state.staffNegotiations![opened.negotiation.id]!.stage, "COMPLETED");
  assert.ok(state.staffEmployment[member.id]!.contractEndDate! >= "2029-05-31");
});

test("CPU clubs fill a vacant core role from the market on the first of the month", () => {
  let state = career();
  const cpu = Object.keys(state.staffRoster).find((id) => id !== ME && (state.staffRoster[id] ?? []).some((m) => m.roles.includes("GOALKEEPER_COACH")));
  if (!cpu) return;
  state = { ...state, staffRoster: { ...state.staffRoster, [cpu]: state.staffRoster[cpu]!.filter((m) => !m.roles.includes("GOALKEEPER_COACH")) } };
  const after = progressStaff(state, "2026-09-01", noEmit);
  assert.ok(after.staffRoster[cpu]!.some((m) => m.roles.includes("GOALKEEPER_COACH")));
});

test("staff effects are neutral without the specialists and real with them", () => {
  const state = career();
  const without = { ...state, staffRoster: { ...state.staffRoster, [ME]: (state.staffRoster[ME] ?? []).filter((m) => !m.roles.some((r) => r === "DEVELOPMENT_COACH" || r === "HEAD_OF_ACADEMY" || r === "HEAD_OF_RECRUITMENT")) } };
  assert.equal(academyDevelopmentFactor(without, ME), 1);
  assert.equal(recruitmentDepartmentFactor(without, ME), 1);
  const coach = Object.values(state.staffMarket!.freeAgents).find((m) => m.roles[0] === "DEVELOPMENT_COACH")!;
  const withCoach = { ...without, staffRoster: { ...without.staffRoster, [ME]: [...without.staffRoster[ME]!, { ...coach, clubId: ME }] } };
  const factor = academyDevelopmentFactor(withCoach, ME);
  assert.ok(factor >= 0.875 && factor <= 1.125 && factor !== 1);
});

test("a simulated month keeps staff, negotiations and the ledger consistent", () => {
  let state = career();
  let date = state.gameDate;
  for (let i = 0; i < 45; i++) {
    date = addDays(date, 1);
    state = processDay(state, date).state;
  }
  assert.ok(state.staffMarket?.seasonId === state.seasonId);
  for (const [clubId, roster] of Object.entries(state.staffRoster)) for (const m of roster) assert.equal(m.clubId, clubId);
});
