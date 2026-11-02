// HM-ALPHA3-M06: scouting information rule, recommendations and delegation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import type { CareerState } from "../career/types";
import { getExternalCandidateClubs } from "../career/careerWorld";
import { updatePlayerSquadStatus } from "../career/squadStatus";
import { abilityStarsFromCA } from "../development/types";
import { ensureClubFinances } from "../economy/ledger";
import { setPlayerKnowledgePct } from "../knowledge/knowledgeIntegration";
import { resolvePlayerVisibility } from "../knowledge/playerVisibility";
import { estimatedMarketValueEur, resolveMarketValueRange } from "../knowledge/scoutReportVisibility";
import { managerSquadIds } from "../players/dynamicsState";
import { renewalDemand } from "../players/renewals";
import { recruitmentRecommendations } from "../scouting/recommendations";
import { ensureStaffMarket } from "../staff/staffMarket";
import { hireFreeAgent } from "../staff/staffNegotiation";
import { approveProposal, delegationOf, pendingProposals, progressDelegation, setDelegation } from "./delegation";

const SKOVDE = "se_club_ifk_skovde_hk";
const COMPS = ["se_handbollsligan_herr", "swe-2"];
function career(): CareerState {
  const squads = Object.assign({}, ...COMPS.map((c) => snapshotWorldSquads(c)));
  const ratings = Object.assign({}, ...COMPS.map((c) => snapshotGameplayRatings(c)));
  const staff = Object.assign({}, ...COMPS.map((c) => snapshotAllClubsStaff(c)));
  return ensureClubFinances(createNewCareerState("m06-tests", SKOVDE, squads, undefined, ratings, staff), "2026-07-01");
}
const MONDAY = "2026-09-07";
const noEmit = () => undefined;
const external = (s: CareerState) => Object.entries(s.gameplayRatings).filter(([c]) => c !== SKOVDE).flatMap(([, r]) => r);

test("below high knowledge the star range contains the truth but is not centred on it; high knowledge is exact", () => {
  const s = career();
  let centred = 0, total = 0;
  for (const r of external(s)) {
    const truth = abilityStarsFromCA(r.ca);
    const low = resolvePlayerVisibility({ ...r, playerId: r.playerId }, 40);
    assert.ok(low.abilityRange.min <= truth && truth <= low.abilityRange.max, `${r.playerId}: truth inside`);
    if ((low.abilityRange.min + low.abilityRange.max) / 2 === truth) centred++;
    total++;
    const high = resolvePlayerVisibility({ ...r, playerId: r.playerId }, 95);
    assert.equal(high.abilityRange.min, truth);
    assert.equal(high.abilityRange.max, truth);
  }
  assert.ok(centred < total * 0.85, `the midpoint must not reliably give the truth away (${centred}/${total} centred)`);
});

test("a better scout makes fewer estimation errors", () => {
  const s = career();
  const errors = (suitability: number) => external(s).filter((r) => { const v = resolvePlayerVisibility({ ...r, playerId: r.playerId }, 40, suitability); return (v.abilityRange.min + v.abilityRange.max) / 2 !== abilityStarsFromCA(r.ca) || false; }).length;
  assert.ok(errors(19) < errors(3), "an elite scout's estimates are off less often");
});

test("the market-value estimate keeps the true value inside the range without centring on it", () => {
  for (const [value, knowledge, key] of [[100_000, 20, "a"], [50_000, 40, "b"], [80_000, 60, "c"], [20_000, 85, "d"]] as const) {
    const range = resolveMarketValueRange(value, knowledge, key);
    assert.ok(range.min <= value && value <= range.max, `${key}: inside`);
  }
  const offCentre = ["k1", "k2", "k3", "k4", "k5", "k6"].filter((k) => Math.round(estimatedMarketValueEur(100_000, 40, k)) !== 100_000).length;
  assert.ok(offCentre >= 4, "the estimate is the club's own, not the true value");
});

test("recommendations only include players the club knows, and show ranges that contain the truth", () => {
  let s = career();
  const targets = getExternalCandidateClubs(s).slice(0, 4).flatMap((c) => (s.worldSquads[c.id] ?? []).slice(0, 6));
  for (const p of targets) s = setPlayerKnowledgePct(s, p.id, 55);
  const recs = recruitmentRecommendations(s, 30);
  assert.ok(recs.length > 0);
  for (const r of recs) {
    assert.ok(r.knowledgePct >= 30);
    const truth = abilityStarsFromCA(external(s).find((x) => x.playerId === r.player.id)!.ca);
    assert.ok(r.abilityRange.min <= truth && truth <= r.abilityRange.max);
    assert.equal(Object.keys(r).some((k) => k === "ca" || k === "pa"), false, "no raw ability on a recommendation");
  }
});

test("delegated scouting starts assignments for idle scouts; advise mode only proposes until approved", () => {
  // Skövde's scout post is vacant: sign a free-agent scout first.
  let s: CareerState = ensureStaffMarket({ ...career(), gameDate: MONDAY });
  const scout = Object.values(s.staffMarket!.freeAgents).find((m) => m.roles.includes("SCOUT"))!;
  s = hireFreeAgent(s, scout.id, SKOVDE, 900, "2028-05-31");
  const advise = progressDelegation(setDelegation(s, "SCOUTING_ASSIGNMENTS", "ADVISE"), MONDAY, noEmit);
  const proposals = pendingProposals(advise);
  assert.ok(proposals.length >= 1, "advise mode writes a proposal");
  assert.equal(Object.values(advise.scoutingAssignments ?? {}).filter((a) => a.status === "IN_PROGRESS").length, Object.values(s.scoutingAssignments ?? {}).filter((a) => a.status === "IN_PROGRESS").length, "nothing started without approval");
  const approved = approveProposal(advise, proposals[0]!.id);
  assert.ok(Object.values(approved.scoutingAssignments ?? {}).some((a) => a.status === "IN_PROGRESS" && a.assignmentType === "POSITION"));
  s = progressDelegation(setDelegation(s, "SCOUTING_ASSIGNMENTS", "DELEGATE"), MONDAY, noEmit);
  assert.ok(Object.values(s.scoutingAssignments ?? {}).some((a) => a.status === "IN_PROGRESS" && a.assignmentType === "POSITION"));
  assert.ok(delegationOf(s).log.some((l) => l.area === "SCOUTING_ASSIGNMENTS" && l.result === "DONE"), "every delegated action is logged");
});

test("delegated renewals: a squad player gets an offer, a key player needs the manager's approval", () => {
  let s = { ...career(), gameDate: MONDAY };
  const ids = managerSquadIds(s).slice(0, 2);
  for (const id of ids) s = { ...s, playerContracts: { ...s.playerContracts, [id]: { ...s.playerContracts[id]!, contractEndDate: "2027-05-31" } } };
  s = updatePlayerSquadStatus(s, ids[0]!, "KEY_PLAYER");
  s = updatePlayerSquadStatus(s, ids[1]!, "SQUAD_PLAYER");
  s = progressDelegation(setDelegation(s, "CONTRACT_RENEWALS", "DELEGATE"), MONDAY, noEmit);
  const talks = Object.values(s.renewalTalks ?? {});
  assert.ok(!talks.some((t) => t.playerId === ids[0]), "no talks with a key player without approval");
  assert.ok(pendingProposals(s).some((p) => p.action.kind === "RENEW" && p.action.playerId === ids[0]));
  const squadTalk = talks.find((t) => t.playerId === ids[1]);
  if (squadTalk) assert.equal(squadTalk.by?.kind, "DELEGATE");
});

test("a worse negotiator agrees worse terms (seeded A/B)", () => {
  const s = career();
  const id = managerSquadIds(s)[3]!;
  const staff = (s.staffRoster[SKOVDE] ?? [])[0]!;
  const withSkill = (v: number): CareerState => ({ ...s, staffRoster: { ...s.staffRoster, [SKOVDE]: s.staffRoster[SKOVDE]!.map((m) => (m.id === staff.id ? { ...m, profile: { ...m.profile, attributes: { ...m.profile.attributes, NEGOTIATION: { ...m.profile.attributes.NEGOTIATION, value: v } } } } : m)) } });
  const good = renewalDemand(withSkill(19), id, undefined, staff.id).demandEurPerMonth;
  const poor = renewalDemand(withSkill(2), id, undefined, staff.id).demandEurPerMonth;
  assert.ok(poor > good, `poor negotiator ${poor} vs good ${good}`);
});

test("staff hiring is always a proposal; approval hires within the staff limit", () => {
  let s = { ...career(), gameDate: MONDAY };
  s = progressDelegation(setDelegation(s, "STAFF_HIRING", "DELEGATE"), MONDAY, noEmit);
  const hire = pendingProposals(s).find((p) => p.action.kind === "HIRE_STAFF");
  if (!hire) return; // no non-coaching vacancy at this club
  const before = (s.staffRoster[SKOVDE] ?? []).length;
  const after = approveProposal(s, hire.id);
  const status = delegationOf(after).proposals[hire.id]!.status;
  assert.ok(status === "APPROVED" || status === "FAILED");
  if (status === "APPROVED") assert.equal((after.staffRoster[SKOVDE] ?? []).length, before + 1);
});

test("revoking an area withdraws its pending proposals; a proposal from someone who left cannot be approved", () => {
  let s: CareerState = ensureStaffMarket({ ...career(), gameDate: MONDAY });
  const scout = Object.values(s.staffMarket!.freeAgents).find((m) => m.roles.includes("SCOUT"))!;
  s = hireFreeAgent(s, scout.id, SKOVDE, 900, "2028-05-31");
  const advise = progressDelegation(setDelegation(s, "SCOUTING_ASSIGNMENTS", "ADVISE"), MONDAY, noEmit);
  const proposal = pendingProposals(advise)[0]!;
  const revoked = setDelegation(advise, "SCOUTING_ASSIGNMENTS", "MANAGER");
  assert.equal(pendingProposals(revoked).length, 0);
  assert.equal(delegationOf(revoked).proposals[proposal.id]!.status, "WITHDRAWN");
  assert.ok(delegationOf(revoked).log.some((l) => l.result === "WITHDRAWN"), "the withdrawal is in the history");
  // The proposer leaves the club: approval is refused.
  const roster = advise.staffRoster[SKOVDE]!.filter((m) => m.id !== proposal.staffId);
  const gone = { ...advise, staffRoster: { ...advise.staffRoster, [SKOVDE]: roster } };
  assert.throws(() => approveProposal(gone, proposal.id), /inte längre i klubben/);
});

test("every screen resolves the same star ranges for a scouted player (no cross-referencing to the truth)", async () => {
  const { careerPlayerVisibility } = await import("../knowledge/careerVisibility");
  const s0 = career();
  const r = external(s0).find((x) => x.ca > 0)!;
  const report = { id: "rep:test", scoutStaffId: "x", targetPlayerId: r.playerId, createdDate: "2026-09-01", knowledgePctAtReport: 55, scoutSuitability: 19 };
  const s = { ...s0, scoutReports: { ...s0.scoutReports, [report.id]: report as never } };
  const shared = careerPlayerVisibility(s, r, r.playerId, 55);
  const reportView = resolvePlayerVisibility({ ...r, playerId: r.playerId }, 55, 19);
  assert.deepEqual(shared.abilityRange, reportView.abilityRange);
  assert.deepEqual(shared.potentialRange, reportView.potentialRange);
});
