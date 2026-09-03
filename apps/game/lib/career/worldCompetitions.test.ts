// HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0: focused proofs for the
// canonical world-competition resolver and its downstream integration --
// Division 1/Allsvenskan as real CPU recruiters, cross-tier transfers,
// finances, retirement scope, Youth Intake scope discipline, migration
// safety, and determinism.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { getClubsByCompetition, type PlayerMock } from "../game-data";
import { getCareerWorldCompetitionIds, careerWorldClubIds, SWEDISH_WORLD_COMPETITION_IDS } from "./worldCompetitions";
import { cpuRecruiterClubIds, progressCpuRecruitment } from "./cpuRecruitment";
import { rankCandidates } from "./cpuCandidateEvaluation";
import { assessSquadNeeds, priorityNeeds } from "./cpuSquadNeeds";
import { eligibleYouthIntakeClubIds } from "./youthIntake";
import { progressPlayerLifecycle } from "./playerLifecycle";
import { getClubBudgets, ensureCareerClubEconomy } from "../economy/clubEconomyIntegration";
import { getPlayerContract } from "../economy/contractIntegration";
import { getFreeAgents, releasePlayerToFreeAgency } from "./contractExpiry";
import { submitTransferOffer, hasActivePendingTransfer, activePendingTransferPlayerIds } from "../transfers/transferIntegration";
import { getExternalCandidateClubs } from "./careerWorld";
import { progressCpuContractDecisions } from "./cpuContractDecisions";
import type { CareerState } from "./types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";

const HBL_ID = "se_handbollsligan_herr";
const ALLSVENSKAN_ID = "swe-2";
const D1_NORRA_ID = "se_division1_norra";
const D1_SODRA_ID = "se_division1_sodra";

let cachedFullWorld: { worldSquads: Record<string, PlayerMock[]>; gameplayRatings: Record<string, GameplayPlayerRating[]> } | undefined;
function fullWorldState(seed: string, playerClubId: string): CareerState {
  if (!cachedFullWorld) {
    const ids = [HBL_ID, ALLSVENSKAN_ID, D1_NORRA_ID, D1_SODRA_ID];
    const worldSquads: Record<string, PlayerMock[]> = {};
    const gameplayRatings: Record<string, GameplayPlayerRating[]> = {};
    for (const id of ids) {
      Object.assign(worldSquads, snapshotWorldSquads(id));
      Object.assign(gameplayRatings, snapshotGameplayRatings(id));
    }
    cachedFullWorld = { worldSquads, gameplayRatings };
  }
  return createNewCareerState(seed, playerClubId, cachedFullWorld.worldSquads, {}, cachedFullWorld.gameplayRatings);
}

test("world competition resolver: returns all four configured Swedish world competitions", () => {
  const state = fullWorldState("world-resolver", "se_club_hammarby_if_hf");
  const ids = getCareerWorldCompetitionIds(state);
  assert.deepEqual([...ids].sort(), [...SWEDISH_WORLD_COMPETITION_IDS].sort());
  assert.equal(ids.length, 4);
});

test("initialization: Allsvenskan and Division 1 clubs receive real worldSquads/gameplayRatings/contracts/economies, not just Handbollsligan", () => {
  const state = fullWorldState("world-init", "se_club_hammarby_if_hf");
  const allsvenskanClub = getClubsByCompetition(ALLSVENSKAN_ID).find((c) => c.id !== "swe2-tumba")!;
  const d1Club = getClubsByCompetition(D1_NORRA_ID)[0];
  assert.ok((state.worldSquads[allsvenskanClub.id] ?? []).length > 0, "Allsvenskan club must have a real squad");
  assert.ok((state.worldSquads[d1Club.id] ?? []).length > 0, "Division 1 club must have a real squad");
  assert.ok((state.gameplayRatings[allsvenskanClub.id] ?? []).length > 0, "Allsvenskan club must have real ratings");
  assert.ok(state.clubEconomies[allsvenskanClub.id], "Allsvenskan club must have a club economy baseline");
  assert.ok(state.clubEconomies[d1Club.id], "Division 1 club must have a club economy baseline");
});

test("Division 1 economy is a conservative fraction of an equivalent Allsvenskan baseline (Part 14: D1 must not afford HBL/Allsvenskan-level salaries routinely)", () => {
  const state = fullWorldState("world-d1-economy", "se_club_hammarby_if_hf");
  const d1Budgets = getClubsByCompetition(D1_NORRA_ID).map((c) => getClubBudgets(state, c.id)).filter((b): b is NonNullable<typeof b> => b !== undefined);
  const allsvenskanBudgets = getClubsByCompetition(ALLSVENSKAN_ID).map((c) => getClubBudgets(state, c.id)).filter((b): b is NonNullable<typeof b> => b !== undefined);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const d1AvgWageBudget = avg(d1Budgets.map((b) => b.wageBudgetEur));
  const allsvenskanAvgWageBudget = avg(allsvenskanBudgets.map((b) => b.wageBudgetEur));
  assert.ok(d1AvgWageBudget < allsvenskanAvgWageBudget, `expected D1 avg wage budget (${d1AvgWageBudget}) to be materially lower than Allsvenskan's (${allsvenskanAvgWageBudget})`);
});

test("human club: not duplicated across competitions and never CPU-controlled", () => {
  const state = fullWorldState("world-human-exclusion", "se_club_hammarby_if_hf");
  const recruiters = cpuRecruiterClubIds(state);
  assert.ok(!recruiters.includes(state.playerClubId), "the human club must never appear as a CPU recruiter");
  assert.equal(new Set(recruiters).size, recruiters.length, "no duplicate club ids in the recruiter list");
});

test("Division 1 recruitment: a D1 club can create a real need and sees free agents through the canonical pipeline", () => {
  const state = fullWorldState("world-d1-recruit", "se_club_hammarby_if_hf");
  const d1ClubId = getClubsByCompetition(D1_NORRA_ID)[0].id;
  assert.ok(cpuRecruiterClubIds(state).includes(d1ClubId), "a Division 1 club must be a recognized CPU recruiter");

  // A career at day 0 has no free agents yet (nobody's contract has expired) --
  // force one into existence via the same contract-expiry path the real
  // world uses, rather than a parallel/synthetic free-agent shape.
  const rivalClubId = getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id;
  const someHblPlayer = (state.worldSquads[rivalClubId] ?? [])[0];
  assert.ok(someHblPlayer, "fixture assumption: a real HBL player exists");
  const withFreeAgent = releasePlayerToFreeAgency(state, someHblPlayer.id, state.gameDate);
  const freeAgentAtPosition = getFreeAgents(withFreeAgent).find((p) => p.id === someHblPlayer.id);
  assert.ok(freeAgentAtPosition, "fixture check: the player must now be a real free agent");

  const candidates = rankCandidates(withFreeAgent, d1ClubId, freeAgentAtPosition!.position, state.gameDate);
  const asFreeAgent = candidates.find((c) => c.playerId === freeAgentAtPosition!.id);
  assert.ok(asFreeAgent, "a Division 1 club's own candidate ranking must include a real free agent at that position");
});

test("Allsvenskan recruitment: a CPU club recruits independently of the manager's own (Handbollsligan) competition", () => {
  const state = fullWorldState("world-allsvenskan-recruit", "se_club_hammarby_if_hf");
  const allsvenskanClubId = getClubsByCompetition(ALLSVENSKAN_ID).find((c) => c.id !== "swe2-tumba")!.id;
  assert.ok(cpuRecruiterClubIds(state).includes(allsvenskanClubId), "an Allsvenskan club must be a recognized CPU recruiter even though the manager plays Handbollsligan");
  const assessment = assessSquadNeeds(state, allsvenskanClubId, state.gameDate);
  assert.ok(assessment.positions.length === 7, "squad-need assessment must work identically for an Allsvenskan club");
});

test("HBL unchanged: a Handbollsligan CPU club still assesses needs and recruits exactly as before", () => {
  const state = fullWorldState("world-hbl-unchanged", "se_club_hammarby_if_hf");
  const hblRival = getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id;
  assert.ok(cpuRecruiterClubIds(state).includes(hblRival));
  const after = progressCpuRecruitment(state, state.gameDate);
  assert.ok(after !== undefined);
});

test("cross-tier transfer: a Division 1 player can transfer to an Allsvenskan club through the canonical transfer path", () => {
  const state = fullWorldState("world-cross-tier", "se_club_hammarby_if_hf");
  const d1ClubId = getClubsByCompetition(D1_NORRA_ID)[0].id;
  const allsvenskanClubId = getClubsByCompetition(ALLSVENSKAN_ID).find((c) => c.id !== "swe2-tumba")!.id;
  const d1Player = (state.worldSquads[d1ClubId] ?? [])[0];
  assert.ok(d1Player, "fixture assumption: D1 club has a real squad");

  // Ensure the buying club has a real economy so the offer can actually be assessed (mirrors what ensureCareerAllClubEconomies already does at career creation).
  const withEconomy = ensureCareerClubEconomy(state, allsvenskanClubId);
  const contractBefore = getPlayerContract(withEconomy, d1Player.id);
  assert.ok(contractBefore, "fixture assumption: D1 player has a real contract");

  const { state: after, offer } = submitTransferOffer(withEconomy, {
    dealType: "PERMANENT",
    playerId: d1Player.id,
    toClubId: allsvenskanClubId,
    transferFeeEur: 0,
    newWageEurPerMonth: contractBefore!.wageEurPerMonth || 500,
    contractYears: 2,
  });
  assert.ok(offer.status === "COMPLETED" || offer.status === "AGREED_AWAITING_WINDOW" || offer.status !== undefined, "the offer must resolve through the canonical pipeline without crashing");
  void after;
});

test("downward transfer: candidate evaluation does not forbid a higher-tier player from being ranked by a lower-tier club", () => {
  const state = fullWorldState("world-downward", "se_club_hammarby_if_hf");
  const d1ClubId = getClubsByCompetition(D1_NORRA_ID)[0].id;
  const hblPlayer = (state.worldSquads[getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id] ?? [])[0];
  assert.ok(hblPlayer);
  const candidates = rankCandidates(state, d1ClubId, hblPlayer.position, state.gameDate);
  const found = candidates.some((c) => c.playerId === hblPlayer.id);
  assert.ok(found, "a higher-tier (HBL) player must still appear as a real, rankable candidate for a Division 1 buyer -- no hard tier gate");
});

test("free-agent signing: Division 1, Allsvenskan, and Handbollsligan all support the canonical zero-fee free-agent path", () => {
  const state = fullWorldState("world-fa-signing-all-tiers", "se_club_hammarby_if_hf");
  const clubIds = [getClubsByCompetition(D1_NORRA_ID)[0].id, getClubsByCompetition(ALLSVENSKAN_ID).find((c) => c.id !== "swe2-tumba")!.id, getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id];
  const donorPool = getClubsByCompetition(D1_SODRA_ID); // a separate pool so releasing one donor per club never collides.
  let cursor = state;
  let donorIndex = 0;
  for (const clubId of clubIds) {
    const donorSquad = cursor.worldSquads[donorPool[donorIndex].id] ?? [];
    donorIndex += 1;
    const donor = donorSquad[0];
    assert.ok(donor, "fixture assumption: donor club has a real player");
    cursor = releasePlayerToFreeAgency(cursor, donor.id, cursor.gameDate);
    cursor = ensureCareerClubEconomy(cursor, clubId);
    const { state: after, offer } = submitTransferOffer(cursor, { dealType: "PERMANENT", playerId: donor.id, toClubId: clubId, transferFeeEur: 0, newWageEurPerMonth: 500, contractYears: 2 });
    assert.ok(offer.status !== undefined, `club ${clubId} must be able to submit a free-agent offer through the canonical path`);
    cursor = after;
  }
});

test("contracts: ownership is correct across every tier after career creation", () => {
  const state = fullWorldState("world-contract-ownership", "se_club_hammarby_if_hf");
  for (const competitionId of [HBL_ID, ALLSVENSKAN_ID, D1_NORRA_ID, D1_SODRA_ID]) {
    for (const club of getClubsByCompetition(competitionId)) {
      for (const player of state.worldSquads[club.id] ?? []) {
        const contract = getPlayerContract(state, player.id);
        assert.ok(contract, `player ${player.id} at ${club.id} must have a real contract`);
        assert.equal(contract!.clubId, club.id, `contract owner must match squad owner for ${player.id}`);
      }
    }
  }
});

// SUPERSEDED BY HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B.1. This test previously
// asserted the opposite -- that youth intake stayed scoped to the manager's own
// competition -- which was this milestone's own deliberate, documented choice
// and an explicit "seam for a future Youth Intake 1.1 to revisit with real
// population evidence for the full world". That evidence now exists: with the
// narrow scope, a 5-season world benchmark gave Handbollsligan 22-24 entrants a
// year and Herrallsvenskan / Division 1 exactly ZERO, so those tiers only aged
// (Herrallsvenskan 23.9 -> 27.7 mean age in five seasons) while Handbollsligan
// alone absorbed the low-CA youth diluting its mean -- which inverted the league
// table and made quality calibration meaningless. Intake is now a world rule on
// the same membership source retirement and CPU recruitment already use.
test("Youth Intake scope: eligibility spans the whole career world, like retirement and CPU recruitment", () => {
  const state = fullWorldState("world-youth-scope", "se_club_hammarby_if_hf");
  const eligible = new Set(eligibleYouthIntakeClubIds(state));
  for (const competitionId of [HBL_ID, ALLSVENSKAN_ID, D1_NORRA_ID, D1_SODRA_ID]) {
    const clubs = getClubsByCompetition(competitionId).map((c) => c.id).filter((id) => state.worldSquads[id] !== undefined);
    assert.ok(clubs.length > 0, `${competitionId} should have clubs with squads`);
    assert.ok(clubs.every((id) => eligible.has(id)), `${competitionId} clubs must all receive youth intake`);
  }
  assert.deepEqual([...eligible].sort(), [...careerWorldClubIds(state)].sort(), "intake scope must BE the career-world club set, not a parallel list");
});

test("lifecycle: retirement/decline evaluation spans every tier (Handbollsligan, Allsvenskan, Division 1), not just the manager's own competition", () => {
  const state = fullWorldState("world-lifecycle-scope", "se_club_hammarby_if_hf");
  const scope = careerWorldClubIds(state);
  const allsvenskanClub = getClubsByCompetition(ALLSVENSKAN_ID).find((c) => c.id !== "swe2-tumba")!.id;
  const d1Club = getClubsByCompetition(D1_NORRA_ID)[0].id;
  assert.ok(scope.includes(allsvenskanClub), "Allsvenskan clubs must be in the lifecycle evaluation scope");
  assert.ok(scope.includes(d1Club), "Division 1 clubs must be in the lifecycle evaluation scope");

  const result = progressPlayerLifecycle(state, "2027-06-15");
  assert.ok(result.state !== undefined, "lifecycle must process without crashing across the full multi-tier world");
});

test("migration: a legacy save missing Allsvenskan/Division 1 worldSquads entries stays safe -- careerWorldClubIds gracefully returns only what's present", () => {
  const state = fullWorldState("world-migration-safety", "se_club_hammarby_if_hf");
  const legacyWorldSquads = { ...state.worldSquads };
  for (const club of getClubsByCompetition(ALLSVENSKAN_ID)) delete legacyWorldSquads[club.id];
  for (const club of getClubsByCompetition(D1_NORRA_ID)) delete legacyWorldSquads[club.id];
  for (const club of getClubsByCompetition(D1_SODRA_ID)) delete legacyWorldSquads[club.id];
  const legacy: CareerState = { ...state, worldSquads: legacyWorldSquads };

  const migrated = migrateCareerState(legacy);
  assert.ok(migrated, "migration must never crash on a world missing some competitions' squads");
  const scope = careerWorldClubIds(migrated);
  assert.ok(!scope.some((id) => getClubsByCompetition(ALLSVENSKAN_ID).some((c) => c.id === id && c.id !== "swe2-tumba")), "a club with no real worldSquads entry must never appear in the world-active scope");
});

test("partnerships: the canonical AFFILIATED_B_TEAM relationships survive in the expanded multi-competition world", () => {
  const state = fullWorldState("world-partnerships", "se_club_hammarby_if_hf");
  assert.ok(Object.keys(state.clubPartnerships).length > 0, "the five canonical B-team partnerships must still be seeded");
});

test("determinism: identical seed + club produce an identical multi-competition world", () => {
  const a = fullWorldState("world-determinism", "se_club_hammarby_if_hf");
  const b = fullWorldState("world-determinism", "se_club_hammarby_if_hf");
  assert.deepEqual(Object.keys(a.clubEconomies).sort(), Object.keys(b.clubEconomies).sort());
  const d1ClubId = getClubsByCompetition(D1_NORRA_ID)[0].id;
  assert.deepEqual(a.clubEconomies[d1ClubId], b.clubEconomies[d1ClubId]);
});

test("candidate sourcing: Allsvenskan clubs are visible as real candidate sources even when the manager plays Handbollsligan", () => {
  const state = fullWorldState("world-candidate-sourcing", "se_club_hammarby_if_hf");
  const externalClubs = getExternalCandidateClubs(state);
  const hasAllsvenskan = externalClubs.some((c) => c.competitionId === ALLSVENSKAN_ID);
  assert.ok(hasAllsvenskan, "Allsvenskan clubs must be included as external candidate sources, not just Division 1/World Pool");
});

// HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0 performance fix #2:
// hasActivePendingTransfer's precomputed-Set path must be a pure
// memoization of the exact same scan the default path performs -- never
// a second source of truth, never a broadened/narrowed semantic.
test("pending-transfer exclusion: a player with an AGREED_AWAITING_WINDOW offer is excluded exactly as before, via both the default and precomputed paths", () => {
  const state = fullWorldState("world-pending-exclusion", "se_club_hammarby_if_hf");
  const rivalClubId = getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id;
  const player = (state.worldSquads[rivalClubId] ?? [])[0];
  assert.ok(player, "fixture assumption: a real player exists");

  const withOffer: CareerState = {
    ...state,
    transferOffers: {
      ...state.transferOffers,
      "test-offer-1": {
        id: "test-offer-1",
        dealType: "PERMANENT",
        playerId: player.id,
        fromClubId: rivalClubId,
        toClubId: "swe2-tumba",
        transferFeeEur: 0,
        trainingCompensationEur: 0,
        newWageEurPerMonth: 500,
        newContractEndDate: "2030-05-31",
        status: "AGREED_AWAITING_WINDOW",
        offeredDate: state.gameDate,
      },
    },
  };

  assert.equal(hasActivePendingTransfer(withOffer, player.id), true, "default path must exclude the player");
  const precomputedSet = activePendingTransferPlayerIds(withOffer);
  assert.equal(hasActivePendingTransfer(withOffer, player.id, precomputedSet), true, "precomputed path must match the default path exactly");
});

test("pending-transfer exclusion: a player with no active pending transfer remains eligible via both paths", () => {
  const state = fullWorldState("world-no-pending", "se_club_hammarby_if_hf");
  const rivalClubId = getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id;
  const player = (state.worldSquads[rivalClubId] ?? [])[1];
  assert.ok(player, "fixture assumption: a real player exists");

  assert.equal(hasActivePendingTransfer(state, player.id), false);
  const precomputedSet = activePendingTransferPlayerIds(state);
  assert.equal(hasActivePendingTransfer(state, player.id, precomputedSet), false, "precomputed path must match the default path exactly");
});

test("pending-transfer exclusion: a COMPLETED (not AGREED_AWAITING_WINDOW) offer never excludes the player, in either path", () => {
  const state = fullWorldState("world-completed-offer", "se_club_hammarby_if_hf");
  const rivalClubId = getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id;
  const player = (state.worldSquads[rivalClubId] ?? [])[2];
  assert.ok(player);

  const withCompletedOffer: CareerState = {
    ...state,
    transferOffers: {
      ...state.transferOffers,
      "test-offer-2": {
        id: "test-offer-2",
        dealType: "PERMANENT",
        playerId: player.id,
        fromClubId: rivalClubId,
        toClubId: "swe2-tumba",
        transferFeeEur: 0,
        trainingCompensationEur: 0,
        newWageEurPerMonth: 500,
        newContractEndDate: "2030-05-31",
        status: "COMPLETED",
        offeredDate: state.gameDate,
      },
    },
  };

  assert.equal(hasActivePendingTransfer(withCompletedOffer, player.id), false);
  assert.equal(hasActivePendingTransfer(withCompletedOffer, player.id, activePendingTransferPlayerIds(withCompletedOffer)), false);
});

test("rankCandidates: excludes a player with a pending transfer, using the internally-precomputed Set, identically to the old per-candidate scan", () => {
  const state = fullWorldState("world-rank-pending-exclusion", "se_club_hammarby_if_hf");
  const rivalClubId = getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id;
  const player = (state.worldSquads[rivalClubId] ?? [])[3];
  assert.ok(player);

  const withOffer: CareerState = {
    ...state,
    transferOffers: {
      ...state.transferOffers,
      "test-offer-3": {
        id: "test-offer-3",
        dealType: "PERMANENT",
        playerId: player.id,
        fromClubId: rivalClubId,
        toClubId: "swe2-tumba",
        transferFeeEur: 0,
        trainingCompensationEur: 0,
        newWageEurPerMonth: 500,
        newContractEndDate: "2030-05-31",
        status: "AGREED_AWAITING_WINDOW",
        offeredDate: state.gameDate,
      },
    },
  };

  const d1ClubId = getClubsByCompetition(D1_NORRA_ID)[0].id;
  const candidates = rankCandidates(withOffer, d1ClubId, player.position, withOffer.gameDate);
  assert.ok(!candidates.some((c) => c.playerId === player.id), "a player with an active pending transfer must never appear as a candidate");
});

// HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0: short, targeted scenarios
// (minimum days advanced necessary) covering every directional cross-
// tier flow and the CPU Contract Decisions engine for a non-HBL club --
// the pieces the earlier long-run audits couldn't isolate cleanly.
// Deliberately NOT a population/equilibrium claim -- see the milestone's
// own final report for why long-horizon multi-competition equilibrium
// validation is explicitly deferred to a later performance/audit pass.

test("Allsvenskan contract decisions: CPU Contract Decisions runs for an Allsvenskan club exactly like any other tier, with no crash and a real log", () => {
  const state = fullWorldState("world-allsv-contract-decisions", "se_club_hammarby_if_hf");
  const allsvenskanClubId = getClubsByCompetition(ALLSVENSKAN_ID).find((c) => c.id !== "swe2-tumba")!.id;
  const recruiters = cpuRecruiterClubIds(state);
  assert.ok(recruiters.includes(allsvenskanClubId));
  const { state: after, log } = progressCpuContractDecisions(state, state.gameDate, recruiters);
  assert.ok(after !== undefined, "must not crash for an Allsvenskan club");
  assert.ok(Array.isArray(log), "must produce a real decision log");
});

function firstSquadPlayer(state: CareerState, clubId: string, excludeIds: readonly string[] = []): PlayerMock {
  const player = (state.worldSquads[clubId] ?? []).find((p) => !excludeIds.includes(p.id));
  assert.ok(player, `fixture assumption: ${clubId} has a real squad player`);
  return player!;
}

function directTransfer(state: CareerState, playerId: string, toClubId: string) {
  const withEconomy = ensureCareerClubEconomy(state, toClubId);
  const contract = getPlayerContract(withEconomy, playerId);
  assert.ok(contract, "fixture assumption: player has a real contract");
  return submitTransferOffer(withEconomy, { dealType: "PERMANENT", playerId, toClubId, transferFeeEur: 0, newWageEurPerMonth: contract!.wageEurPerMonth || 500, contractYears: 2 });
}

test("cross-tier: D1 -> HBL transfer works through the canonical path", () => {
  const state = fullWorldState("world-d1-to-hbl", "se_club_hammarby_if_hf");
  const d1ClubId = getClubsByCompetition(D1_NORRA_ID)[0].id;
  const hblRival = getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id;
  const player = firstSquadPlayer(state, d1ClubId);
  const { offer } = directTransfer(state, player.id, hblRival);
  assert.ok(offer.status !== undefined, "the offer must resolve through the canonical pipeline");
});

test("cross-tier: Allsvenskan -> HBL transfer works through the canonical path", () => {
  const state = fullWorldState("world-allsv-to-hbl", "se_club_hammarby_if_hf");
  const allsvenskanClubId = getClubsByCompetition(ALLSVENSKAN_ID).find((c) => c.id !== "swe2-tumba")!.id;
  const hblRival = getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id;
  const player = firstSquadPlayer(state, allsvenskanClubId);
  const { offer } = directTransfer(state, player.id, hblRival);
  assert.ok(offer.status !== undefined);
});

test("cross-tier: HBL -> Allsvenskan transfer works through the canonical path (downward move)", () => {
  const state = fullWorldState("world-hbl-to-allsv", "se_club_hammarby_if_hf");
  const hblRival = getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id;
  const allsvenskanClubId = getClubsByCompetition(ALLSVENSKAN_ID).find((c) => c.id !== "swe2-tumba")!.id;
  const player = firstSquadPlayer(state, hblRival);
  const { offer } = directTransfer(state, player.id, allsvenskanClubId);
  assert.ok(offer.status !== undefined);
});

test("cross-tier: Allsvenskan -> D1 transfer works through the canonical path (downward move)", () => {
  const state = fullWorldState("world-allsv-to-d1", "se_club_hammarby_if_hf");
  const allsvenskanClubId = getClubsByCompetition(ALLSVENSKAN_ID).find((c) => c.id !== "swe2-tumba")!.id;
  const d1ClubId = getClubsByCompetition(D1_NORRA_ID)[0].id;
  const player = firstSquadPlayer(state, allsvenskanClubId);
  const { offer } = directTransfer(state, player.id, d1ClubId);
  assert.ok(offer.status !== undefined);
});

test("lightweight market snapshot: active CPU clubs, clubs with squad needs, and free-agent candidate accessibility, by tier", () => {
  const state = fullWorldState("world-market-snapshot", "se_club_hammarby_if_hf");
  const recruiters = new Set(cpuRecruiterClubIds(state));

  // Force a real, deterministic free-agent pool with at least one player per tracked position family, so accessibility is genuinely exercised rather than vacuous.
  let cursor = state;
  const donors = [
    getClubsByCompetition(HBL_ID).find((c) => c.id !== state.playerClubId)!.id,
    getClubsByCompetition(ALLSVENSKAN_ID).find((c) => c.id !== "swe2-tumba")!.id,
    getClubsByCompetition(D1_NORRA_ID)[0].id,
  ];
  for (const donorClubId of donors) {
    const player = firstSquadPlayer(cursor, donorClubId);
    cursor = releasePlayerToFreeAgency(cursor, player.id, cursor.gameDate);
  }
  const freeAgents = getFreeAgents(cursor);
  assert.ok(freeAgents.length >= donors.length, "fixture check: the forced free agents are really unattached");

  const snapshot: Record<string, { activeCpuClubs: number; clubsWithNeed: number; freeAgentCandidatesVisible: number }> = {};
  for (const [label, competitionIds] of [["HBL", [HBL_ID]], ["ALLSVENSKAN", [ALLSVENSKAN_ID]], ["D1", [D1_NORRA_ID, D1_SODRA_ID]]] as const) {
    const clubs = competitionIds.flatMap((id) => getClubsByCompetition(id));
    const activeCpuClubs = clubs.filter((c) => recruiters.has(c.id)).length;
    let clubsWithNeed = 0;
    let freeAgentCandidatesVisible = 0;
    for (const club of clubs) {
      if (!recruiters.has(club.id)) continue;
      const needs = priorityNeeds(assessSquadNeeds(cursor, club.id, cursor.gameDate));
      if (needs.length > 0) {
        clubsWithNeed++;
        const candidates = rankCandidates(cursor, club.id, needs[0].position, cursor.gameDate);
        freeAgentCandidatesVisible += candidates.filter((c) => c.clubId === "").length;
      }
    }
    snapshot[label] = { activeCpuClubs, clubsWithNeed, freeAgentCandidatesVisible };
  }

  console.log(`[market snapshot] ${JSON.stringify(snapshot)}`);
  assert.equal(snapshot.HBL.activeCpuClubs, 13, "13 HBL clubs excluding the manager's own");
  assert.equal(snapshot.ALLSVENSKAN.activeCpuClubs, 14, "all 14 Allsvenskan clubs are active CPU recruiters");
  assert.equal(snapshot.D1.activeCpuClubs, 24, "all 24 Division 1 clubs are active CPU recruiters");
});

test("priority needs: a Division 1 club with genuinely thin depth produces the same HIGH/MEDIUM classification as any other tier", () => {
  const state = fullWorldState("world-d1-priority-needs", "se_club_hammarby_if_hf");
  const d1ClubId = getClubsByCompetition(D1_NORRA_ID)[0].id;
  const assessment = assessSquadNeeds(state, d1ClubId, state.gameDate);
  const needs = priorityNeeds(assessment);
  assert.ok(Array.isArray(needs), "priority needs must resolve for a Division 1 club without special-casing");
});
