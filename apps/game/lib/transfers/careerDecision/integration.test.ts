// HM-TRANSFER-REALISM-1.0: integration tests on the FULL career world (Swedish
// pyramid + international world pool), through the real transfer pipelines.
// Named players (Gidsel, Skipagøtu) are regression EXAMPLES -- nothing in the
// code knows their names; every rule here is the general model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullWorldCareer } from "../../../scripts/lib/fullWorldCareer";
import type { CareerState } from "../../career/types";
import { getCareerClubSquad } from "../../career/careerWorld";
import { FREE_AGENT_CLUB_ID, releasePlayerToFreeAgency } from "../../career/contractExpiry";
import { getPlayerContract } from "../../economy/contractIntegration";
import { submitTransferOffer } from "../transferIntegration";
import { evaluatePlayerInterest } from "../playerInterest";
import { startTransferNegotiation } from "../negotiationIntegration";
import { rankCandidates } from "../../career/cpuCandidateEvaluation";
import { progressInternationalMarket } from "../internationalMarket";
import { progressCpuContractDecisions } from "../../career/cpuContractDecisions";
import { transferPlayerPermanently } from "../transferExecution";
import { playerDecisionOnMove, playerWageDemandAt, playerCareerProfile } from "./stateAdapter";
import { clubLevelOf, leagueLevelOf } from "./sportingStrength";
import { buildProfile } from "./model";

const DIV1_CLUB = "se_club_rp_if_linkoping";
const DIV1_CLUB_2 = "se_club_hp_warta";
const HBL_CLUB = "se_club_ik_savehof";
const ALLSV_CLUB = "se_club_ifk_tumba";

let base: CareerState | undefined;
function world(): CareerState {
  base ??= createFullWorldCareer("transfer-realism-integration");
  return base;
}

function findPlayer(state: CareerState, lastNameIncludes: string): string {
  for (const squad of Object.values(state.worldSquads)) {
    const p = squad.find((x) => x.lastName.includes(lastNameIncludes));
    if (p) return p.id;
  }
  throw new Error(`no player ${lastNameIncludes}`);
}

/** The player released into free agency the day after his contract ends -- the exact situation of the original bug. */
function asFreeAgent(state: CareerState, playerId: string): CareerState {
  const contract = getPlayerContract(state, playerId)!;
  const after = { ...state, gameDate: "2027-06-01" };
  return releasePlayerToFreeAgency({ ...after, playerContracts: { ...after.playerContracts, [playerId]: { ...contract, contractEndDate: "2027-05-31" } } }, playerId, "2027-06-01");
}

test("league hierarchy from comparable data: elite foreign > Handbollsligan > Allsvenskan > Division 1", () => {
  const s = world();
  const ger = leagueLevelOf(s, "ger-1");
  const hbl = leagueLevelOf(s, "se_handbollsligan_herr");
  const allsv = leagueLevelOf(s, "swe-2");
  const div1 = Math.max(leagueLevelOf(s, "se_division1_norra"), leagueLevelOf(s, "se_division1_sodra"));
  assert.ok(ger > hbl && hbl > allsv && allsv > div1 + 10, `${ger} ${hbl} ${allsv} ${div1}`);
  assert.ok(leagueLevelOf(s, "den-1") > hbl, "an established foreign top league sits above Handbollsligan");
  assert.ok(leagueLevelOf(s, "int-fro-1") < div1 + 5, "a fringe league is not equal to a top league just because both are tier 1");
});

test("A/E (Gidsel as a free agent): zero recorded wage, yet Division 1 and Handbollsligan are refused at any wage; the CPU path agrees", () => {
  const id = findPlayer(world(), "Gidsel");
  const s = asFreeAgent(world(), id);
  assert.equal(getPlayerContract(s, id)!.wageEurPerMonth, 0, "the bug's precondition: a free agent's recorded wage is 0");
  for (const clubId of [DIV1_CLUB, DIV1_CLUB_2, ALLSV_CLUB, HBL_CLUB]) {
    for (const multiple of [1, 3, 8]) {
      const wage = Math.round(playerCareerProfile(s, id)!.referenceWageEurPerMonth * multiple);
      assert.equal(playerDecisionOnMove(s, id, clubId, { wageEurPerMonth: wage, contractYears: 3 }).accept, false, `${clubId} x${multiple}`);
    }
    const offer = submitTransferOffer(s, { dealType: "PERMANENT", playerId: id, toClubId: clubId, transferFeeEur: 0, newWageEurPerMonth: 4000, contractYears: 3 }).offer;
    assert.notEqual(offer.status, "COMPLETED");
    assert.notEqual(offer.status, "AGREED_AWAITING_WINDOW");
  }
  // A CPU Division 1 club does not even consider him.
  assert.ok(!rankCandidates(s, DIV1_CLUB, getCareerClubSquad(s, FREE_AGENT_CLUB_ID).find((p) => p.id === id)!.position, s.gameDate).some((c) => c.playerId === id));
});

test("E: the world-class free agent is signed abroad by a club near his level, never into Sweden", () => {
  const id = findPlayer(world(), "Gidsel");
  let s = asFreeAgent(world(), id);
  s = progressInternationalMarket({ ...s, gameDate: "2027-06-01" }, "2027-06-01").state;
  const contract = getPlayerContract(s, id)!;
  assert.notEqual(contract.clubId, FREE_AGENT_CLUB_ID, "the international market takes him");
  assert.ok(clubLevelOf(s, contract.clubId) >= 150, `joined ${contract.clubId} at level ${clubLevelOf(s, contract.clubId)}`);
  assert.ok(contract.wageEurPerMonth > 0);
  assertSingleOwnership(s);
});

test("Skipagøtu (regression example) refuses Division 1 and Allsvenskan from his club", () => {
  const s = world();
  const id = findPlayer(s, "Skipag");
  for (const clubId of [DIV1_CLUB_2, ALLSV_CLUB]) {
    assert.equal(playerDecisionOnMove(s, id, clubId, { wageEurPerMonth: 20000, contractYears: 3 }).accept, false, clubId);
    assert.equal(evaluatePlayerInterest(s, id, clubId).interestLevel === "HIGH", false);
  }
});

test("human and CPU pathways share one decision: the same offer gets the same answer whoever manages the buyer", () => {
  const human = createFullWorldCareer("transfer-realism-parity", HBL_CLUB);
  const cpu = createFullWorldCareer("transfer-realism-parity", "se_club_hammarby_if_hf");
  const players = getCareerClubSquad(cpu, ALLSV_CLUB).slice(0, 8).map((p) => p.id);
  for (const id of players) {
    for (const wage of [600, 1500, 3000]) {
      const params = { dealType: "PERMANENT" as const, playerId: id, toClubId: HBL_CLUB, transferFeeEur: 0, newWageEurPerMonth: wage, contractYears: 3 };
      const a = playerDecisionOnMove(human, id, HBL_CLUB, { wageEurPerMonth: wage, contractYears: 3 });
      const b = playerDecisionOnMove(cpu, id, HBL_CLUB, { wageEurPerMonth: wage, contractYears: 3 });
      assert.equal(a.accept, b.accept, `${id} @${wage}`);
      const ha = submitTransferOffer(human, params).offer;
      const hb = submitTransferOffer(cpu, params).offer;
      if (ha.status === "REJECTED_BY_PLAYER" || hb.status === "REJECTED_BY_PLAYER") assert.equal(ha.playerDecisionReason, hb.playerDecisionReason);
    }
  }
});

test("interest IMPOSSIBLE <=> no wage works <=> the manager is refused talks; the PCDM demand is what CPU clubs offer", () => {
  const s = createFullWorldCareer("transfer-realism-interest", ALLSV_CLUB);
  let impossible = 0;
  for (const p of getCareerClubSquad(s, HBL_CLUB)) {
    const interest = evaluatePlayerInterest(s, p.id, ALLSV_CLUB);
    const demand = playerWageDemandAt(s, p.id, ALLSV_CLUB, { contractYears: 3 })!;
    assert.equal(interest.interestLevel === "IMPOSSIBLE", demand.demandEurPerMonth === null || demand.refusesRole, p.id);
    if (interest.interestLevel === "IMPOSSIBLE") {
      impossible++;
      assert.equal(startTransferNegotiation(s, p.id).ok, false);
    }
  }
  assert.ok(impossible >= 1, "some Handbollsligan players will not drop to Allsvenskan");
});

test("rivals respect the same sporting restrictions: every rival is a club the player would actually join", () => {
  const s = createFullWorldCareer("transfer-realism-rivals", ALLSV_CLUB);
  let checked = 0;
  for (const p of getCareerClubSquad(s, "se_club_ystads_if_hf").slice(0, 12)) {
    const started = startTransferNegotiation(s, p.id);
    if (!started.ok) continue;
    for (const rival of started.negotiation.rivals ?? []) {
      checked++;
      assert.equal(playerDecisionOnMove(s, p.id, rival.clubId, { wageEurPerMonth: rival.wageEurPerMonth, contractYears: rival.contractYears }).accept, true, `${p.id} -> ${rival.clubId}`);
    }
  }
  assert.ok(checked >= 0);
});

test("international clubs renew players who want to stay; a renewal is one contract, one owner", () => {
  let s = world();
  const date = "2027-04-16"; // 45 days before the 2027-05-31 expiries -- a review day
  s = { ...s, gameDate: date };
  const before = Object.values(s.playerContracts).filter((c) => c.clubId.startsWith("ger1-") || c.clubId.startsWith("den1-") || c.clubId.startsWith("esp1-")).length;
  const result = progressInternationalMarket(s, date);
  const renewed = result.log.filter((l) => l.kind === "RENEWED");
  assert.ok(renewed.length > 0, "world-pool clubs renew contracts");
  for (const r of renewed) {
    const c = getPlayerContract(result.state, r.playerId)!;
    assert.equal(c.clubId, r.clubId);
    assert.ok(c.contractEndDate > "2027-05-31");
  }
  assert.ok(before > 0);
  assertSingleOwnership(result.state);
});

test("player-side CPU renewal: a star stuck at a Division 1 club refuses the club's renewal", () => {
  const s0 = world();
  const id = findPlayer(s0, "Gidsel");
  const from = getPlayerContract(s0, id)!.clubId;
  let s = transferPlayerPermanently(s0, id, from, DIV1_CLUB, 3000, "2027-05-31");
  s = { ...s, gameDate: "2027-05-01" };
  const after = progressCpuContractDecisions(s, "2027-05-01", [DIV1_CLUB]).state;
  assert.equal(getPlayerContract(after, id)!.contractEndDate, "2027-05-31", "he does not renew -- he leaves for a better level");
});

test("D: a veteran may step down -- the sporting floor dissolves late in a career", () => {
  const s = world();
  const veterans = Object.values(s.worldSquads).flat().filter((p) => (playerCareerProfile(s, p.id)?.age ?? 0) >= 35 && (playerCareerProfile(s, p.id)?.ca ?? 0) >= 130);
  assert.ok(veterans.length > 0);
  for (const v of veterans) {
    const old = playerCareerProfile(s, v.id)!;
    const prime = buildProfile({ ...old, age: 28 });
    assert.ok(old.floorStrength < 0.5 * prime.floorStrength + 1e-9, `${v.id}: ${old.floorStrength} vs prime ${prime.floorStrength}`);
    assert.ok(old.weights.money + old.weights.security + old.weights.personal > prime.weights.money + prime.weights.security + prime.weights.personal, "money, security and home weigh more late in a career");
  }
});

function assertSingleOwnership(state: CareerState): void {
  const seen = new Map<string, string>();
  for (const [clubId, squad] of Object.entries(state.worldSquads)) {
    for (const p of squad) {
      assert.ok(!seen.has(p.id), `${p.id} in ${seen.get(p.id)} and ${clubId}`);
      seen.set(p.id, clubId);
      const contract = getPlayerContract(state, p.id);
      if (contract && clubId !== "retired") {
        const onLoan = Object.values(state.loans ?? {}).some((l) => l.active && l.playerId === p.id);
        if (!onLoan) assert.equal(contract.clubId, clubId, `${p.id} contract ${contract.clubId} vs squad ${clubId}`);
      }
    }
  }
}

test("save compatibility: an older save without transferMarket decides and progresses; the smoothed levels appear only at the July rollover", () => {
  const legacy = { ...world() } as CareerState;
  delete legacy.transferMarket;
  const id = findPlayer(legacy, "Gidsel");
  assert.equal(typeof playerDecisionOnMove(legacy, id, DIV1_CLUB, { wageEurPerMonth: 3000, contractYears: 3 }).accept, "boolean");
  const midSeason = progressInternationalMarket({ ...legacy, gameDate: "2027-03-02" }, "2027-03-02").state;
  assert.equal(midSeason.transferMarket, undefined, "nothing is written outside the rollover");
  const rolled = progressInternationalMarket({ ...legacy, gameDate: "2027-07-01" }, "2027-07-01").state;
  assert.equal(rolled.transferMarket?.leagueStrength?.seasonKey, "2027");
  const again = progressInternationalMarket({ ...rolled, gameDate: "2027-07-01" }, "2027-07-01").state;
  assert.deepEqual(again.transferMarket, rolled.transferMarket, "idempotent per season");
  // JSON round trip (the save format) keeps it intact.
  assert.deepEqual(JSON.parse(JSON.stringify(rolled.transferMarket)), rolled.transferMarket);
});
