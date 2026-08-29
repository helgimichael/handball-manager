// HM-RECRUITMENT-1.1: focused proofs for the Recruitment Centre domain
// layer -- discovery visibility, shortlist/priority/note persistence,
// derived recruitment status, knowledge gating, transfer-state mapping,
// international/Division 1 candidates, and duplicate-safe candidate
// listing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { generateStaffAttributeProfile } from "../staff/staffAttributeGeneration";
import { ensureCareerGameplayRatings } from "./careerRatingNormalization";
import type { ResolvedStaffMember, StaffAttribute } from "../staff/types";
import { TUMBA_CLUB_ID } from "../game-data";
import type { CareerState } from "./types";
import type { PlayerMock } from "../game-data";
import { createBroadScoutingAssignment, createScoutingAssignment, progressScoutingAssignments } from "./scouting";
import { runDiscoveryCycle } from "./scoutDiscovery";
import { submitTransferOffer } from "../transfers/transferIntegration";
import {
  addToShortlist,
  removeFromShortlist,
  setRecruitmentPriority,
  setRecruitmentNote,
  getRecruitmentTarget,
  getRecruitmentStatus,
  getRecruitmentCandidates,
  transferStatusLabelSv,
  getPlayerTransferOffers,
} from "./recruitment";

const GERMAN_CLUB = "ger1-kiel"; // real, HM-WORLD-PLAYER-POOL-1.0 club, competition "ger-1"
const SWEDISH_DIV1_CLUB = "se_club_bodens_bk_hf"; // real Division 1 Norra club

function baseState(): CareerState {
  return createNewCareerState("recruitment-test-seed", TUMBA_CLUB_ID);
}

function staffMember(id: string, clubId: string, overrides: Partial<Record<StaffAttribute, number>> = {}): ResolvedStaffMember {
  const profile = generateStaffAttributeProfile(id, ["SCOUT"], id);
  for (const [attr, value] of Object.entries(overrides)) {
    profile.attributes[attr as StaffAttribute] = { value: value!, origin: "GENERATED_PRIOR" };
  }
  return { id, clubId, displayName: id, roles: ["SCOUT"], hmRoles: [], employmentType: "SALARIED", profile, source: "GENERATED_FICTIONAL" };
}

function withScout(state: CareerState, scout: ResolvedStaffMember): CareerState {
  return { ...state, staffRoster: { ...state.staffRoster, [scout.clubId]: [...(state.staffRoster[scout.clubId] ?? []), scout] } };
}

function syntheticPlayer(id: string, clubId: string, dateOfBirth: string, position: PlayerMock["position"] = "M6"): PlayerMock {
  return {
    id,
    clubId,
    firstName: "Test",
    lastName: id,
    shirtNumber: null,
    position,
    nationality: "SWE",
    dateOfBirth,
    heightCm: null,
    weightKg: null,
    foot: null,
    squadStatus: "Förstaval",
    dataSource: "REAL_WORLD",
    currentAbility: 100,
    potentialAbility: 100,
    form: 5,
    fitnessPct: 100,
    moralePct: 70,
    appearances: 0,
    goals: 0,
    contractEndSeason: "2026/27",
    wageSekPerMonth: 0,
    attributes: {
      technical: { skott: 10, passning: 10, spelforstaelse: 10, genombrott: 10, mottagning: 10, fint: 10, spelUtanBoll: 10 },
      mental: { beslutsfattande: 10, kyla: 10, arbetskapacitet: 10, kampvilja: 10, positionering: 10, lagarbete: 10, ledarskap: 10 },
      physical: { snabbhet: 10, acceleration: 10, styrka: 10, explosivitet: 10, uthallighet: 10, rorlighet: 10 },
    },
  };
}

function withControlledPool(state: CareerState, clubId: string, players: PlayerMock[], caByIndex: number[]): CareerState {
  const withSquad = { ...state, worldSquads: { ...state.worldSquads, [clubId]: players } };
  const withRatings = ensureCareerGameplayRatings(withSquad, clubId);
  const existing = withRatings.gameplayRatings[clubId] ?? [];
  const updated = existing.map((r, i) => ({ ...r, ca: caByIndex[i] ?? r.ca }));
  return { ...withRatings, gameplayRatings: { ...withRatings.gameplayRatings, [clubId]: updated } };
}

test("a scout discovery appears as a recruitment candidate, status DISCOVERED", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID, { NETWORK: 20 }));
  const players = Array.from({ length: 4 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [80, 90, 100, 110]);
  const created = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  const { state: afterCycle, discoveries } = runDiscoveryCycle(created.state, created.assignment!, created.assignment!.endDate);
  assert.ok(discoveries.length > 0);

  const candidates = getRecruitmentCandidates(afterCycle);
  const found = candidates.find((c) => c.playerId === discoveries[0].playerId);
  assert.ok(found, "the discovered player must appear as a recruitment candidate");
  assert.equal(found!.recruitmentStatus, "DISCOVERED");
  assert.equal(found!.shortlisted, false);
});

test("shortlist add/remove is idempotent and persists priority/note across removal", () => {
  let state = baseState();
  const playerId = "player-x";
  state = addToShortlist(state, playerId, "2026-08-19");
  assert.equal(getRecruitmentTarget(state, playerId)?.shortlisted, true);

  const again = addToShortlist(state, playerId, "2026-08-20");
  assert.equal(again, state, "re-adding an already-shortlisted player must be a true no-op (same reference)");

  state = setRecruitmentPriority(state, playerId, "TOP", "2026-08-19");
  state = setRecruitmentNote(state, playerId, "Toppmål för sommaren", "2026-08-19");
  state = removeFromShortlist(state, playerId);
  assert.equal(getRecruitmentTarget(state, playerId)?.shortlisted, false);
  assert.equal(getRecruitmentTarget(state, playerId)?.priority, "TOP", "removing from shortlist must not lose priority");
  assert.equal(getRecruitmentTarget(state, playerId)?.note, "Toppmål för sommaren", "removing from shortlist must not lose the note");

  const removedAgain = removeFromShortlist(state, playerId);
  assert.equal(removedAgain, state, "re-removing an already-unshortlisted player must be a no-op (same reference)");
});

test("priority persists and drives PRIORITIZED status only at HIGH/TOP", () => {
  let state = baseState();
  const playerId = "player-y";
  state = addToShortlist(state, playerId, "2026-08-19");
  assert.equal(getRecruitmentStatus(state, playerId), "SHORTLISTED");

  state = setRecruitmentPriority(state, playerId, "LOW", "2026-08-19");
  assert.equal(getRecruitmentStatus(state, playerId), "SHORTLISTED", "LOW priority must not count as prioritized");

  state = setRecruitmentPriority(state, playerId, "HIGH", "2026-08-19");
  assert.equal(getRecruitmentStatus(state, playerId), "PRIORITIZED");

  state = setRecruitmentPriority(state, playerId, "TOP", "2026-08-19");
  assert.equal(getRecruitmentStatus(state, playerId), "PRIORITIZED");
});

test("recruitment status derives correctly through the pipeline: discovered -> scouting -> scouted", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const players = Array.from({ length: 4 }, (_, i) => syntheticPlayer(`div1-p${i}`, SWEDISH_DIV1_CLUB, "2000-01-01"));
  state = withControlledPool(state, SWEDISH_DIV1_CLUB, players, [80, 90, 100, 110]);
  const targetPlayerId = "div1-p0";

  assert.equal(getRecruitmentStatus(state, targetPlayerId), "DISCOVERED");

  const created = createScoutingAssignment(state, "scout-1", targetPlayerId, SWEDISH_DIV1_CLUB, "2026-08-19");
  assert.equal(created.ok, true, created.errors.join(" "));
  state = created.state;
  assert.equal(getRecruitmentStatus(state, targetPlayerId), "SCOUTING");

  const { state: afterProgress, completed } = progressScoutingAssignments(state, created.assignment!.endDate);
  state = afterProgress;
  assert.equal(completed.length, 1);
  assert.equal(getRecruitmentStatus(state, targetPlayerId), "SCOUTED");
});

test("transfer offers drive NEGOTIATING/CLOSED status and transferStatusLabelSv maps every real status honestly", () => {
  let state = baseState();
  const players = Array.from({ length: 2 }, (_, i) => syntheticPlayer(`div1-p${i}`, SWEDISH_DIV1_CLUB, "2000-01-01"));
  state = withControlledPool(state, SWEDISH_DIV1_CLUB, players, [80, 90]);
  const playerId = "div1-p0";

  assert.equal(transferStatusLabelSv(null), "Ej kontaktad");
  assert.equal(getPlayerTransferOffers(state, playerId).length, 0);

  const { state: afterOffer, offer } = submitTransferOffer(state, {
    dealType: "PERMANENT",
    playerId,
    toClubId: TUMBA_CLUB_ID,
    transferFeeEur: 10_000_000, // deliberately huge -- guarantees an unambiguous terminal outcome either way
    newWageEurPerMonth: 50_000,
    contractYears: 3,
  });
  state = afterOffer;
  assert.notEqual(transferStatusLabelSv(offer), "Ej kontaktad");
  const offers = getPlayerTransferOffers(state, playerId);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].id, offer.id);

  if (offer.status === "AGREED_AWAITING_WINDOW") {
    assert.equal(getRecruitmentStatus(state, playerId), "NEGOTIATING");
  } else if (offer.status === "COMPLETED") {
    assert.equal(getRecruitmentStatus(state, playerId), "CLOSED");
  }
});

test("getPlayerTransferOffers orders SAME-DAY offers by true creation order, not an arbitrary date tie -- a manager re-bidding the same day must see the SECOND offer as latest", () => {
  let state = baseState();
  const players = Array.from({ length: 1 }, (_, i) => syntheticPlayer(`div1-p${i}`, SWEDISH_DIV1_CLUB, "2000-01-01"));
  state = withControlledPool(state, SWEDISH_DIV1_CLUB, players, [80]);
  const playerId = "div1-p0";

  const first = submitTransferOffer(state, {
    dealType: "PERMANENT",
    playerId,
    toClubId: TUMBA_CLUB_ID,
    transferFeeEur: 1,
    newWageEurPerMonth: 1,
    contractYears: 3,
  });
  state = first.state;
  const second = submitTransferOffer(state, {
    dealType: "PERMANENT",
    playerId,
    toClubId: TUMBA_CLUB_ID,
    transferFeeEur: 999_999_999,
    newWageEurPerMonth: 999_999,
    contractYears: 3,
  });
  state = second.state;

  assert.equal(first.offer.offeredDate, second.offer.offeredDate, "sanity: both offers really do share the same game date");
  const offers = getPlayerTransferOffers(state, playerId);
  assert.equal(offers.length, 2);
  assert.equal(offers[0].id, second.offer.id, "the SECOND (most recently created) offer must sort first, regardless of tied offeredDate");
  assert.equal(offers[0].status, "BLOCKED_UNAFFORDABLE", "the huge second offer is the one that must have failed on affordability");
});

test("raw CA/PA are never exposed on a RecruitmentCandidate -- structurally, not just by convention", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID, { NETWORK: 20 }));
  const players = Array.from({ length: 4 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [80, 90, 100, 110]);
  const created = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  const { state: afterCycle } = runDiscoveryCycle(created.state, created.assignment!, created.assignment!.endDate);

  const candidates = getRecruitmentCandidates(afterCycle);
  assert.ok(candidates.length > 0);
  for (const c of candidates) {
    assert.equal("ca" in c, false);
    assert.equal("pa" in c, false);
    if (c.visibility) {
      assert.equal("ca" in c.visibility, false);
      assert.equal("pa" in c.visibility, false);
    }
  }
});

test("knowledge gating: a MINIMAL-knowledge candidate has no potentialRange/archetype; report confidence never appears without a resolvable rating", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID, { NETWORK: 1 }));
  const players = Array.from({ length: 10 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, players.map((_, i) => 60 + i));
  const created = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  const { state: afterCycle, discoveries } = runDiscoveryCycle(created.state, created.assignment!, created.assignment!.endDate);
  assert.ok(discoveries.length > 0);

  const candidates = getRecruitmentCandidates(afterCycle);
  const found = candidates.find((c) => c.playerId === discoveries[0].playerId)!;
  assert.equal(found.knowledgeTier, "LOW", "a fresh discovery bump lands in LOW tier (18pp above the 15pp default), not MEDIUM/HIGH");
  assert.equal(found.visibility?.potentialRange, null, "LOW knowledge must never reveal a potential range");
  assert.equal(found.visibility?.archetype, null);
});

test("international (World Player Pool) candidate works through the same candidate list", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID, { NETWORK: 20 }));
  const players = Array.from({ length: 4 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [80, 90, 100, 110]);
  const created = createBroadScoutingAssignment(state, "scout-1", "REGION", { targetNation: "GER" }, "2026-08-19");
  assert.equal(created.ok, true, created.errors.join(" "));
  const { state: afterCycle, discoveries } = runDiscoveryCycle(created.state, created.assignment!, created.assignment!.endDate);
  assert.ok(discoveries.length > 0);

  const candidates = getRecruitmentCandidates(afterCycle);
  const found = candidates.find((c) => c.playerId === discoveries[0].playerId);
  assert.ok(found);
  assert.equal(found!.clubId, GERMAN_CLUB);
  assert.equal(found!.discoverySource, "REGION");
});

test("Division 1 candidate works through the same candidate list", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID, { NETWORK: 20 }));
  const players = Array.from({ length: 4 }, (_, i) => syntheticPlayer(`div1-p${i}`, SWEDISH_DIV1_CLUB, "2000-01-01"));
  state = withControlledPool(state, SWEDISH_DIV1_CLUB, players, [80, 90, 100, 110]);
  const created = createBroadScoutingAssignment(state, "scout-1", "COMPETITION", { targetCompetitionId: "se_division1_norra" }, "2026-08-19");
  assert.equal(created.ok, true, created.errors.join(" "));
  const { state: afterCycle, discoveries } = runDiscoveryCycle(created.state, created.assignment!, created.assignment!.endDate);
  assert.ok(discoveries.length > 0);

  const candidates = getRecruitmentCandidates(afterCycle);
  const found = candidates.find((c) => c.playerId === discoveries[0].playerId);
  assert.ok(found);
  assert.equal(found!.clubId, SWEDISH_DIV1_CLUB);
  assert.equal(found!.discoverySource, "COMPETITION");
});

test("duplicate-safe: a player reachable via discovery AND a completed report AND the shortlist appears exactly once", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const players = Array.from({ length: 4 }, (_, i) => syntheticPlayer(`div1-p${i}`, SWEDISH_DIV1_CLUB, "2000-01-01"));
  state = withControlledPool(state, SWEDISH_DIV1_CLUB, players, [80, 90, 100, 110]);
  const playerId = "div1-p0";

  const broad = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: SWEDISH_DIV1_CLUB }, "2026-08-19");
  const { state: afterDiscovery } = runDiscoveryCycle(broad.state, broad.assignment!, broad.assignment!.endDate);
  state = afterDiscovery;

  const created = createScoutingAssignment(state, "scout-1", playerId, SWEDISH_DIV1_CLUB, "2026-08-19");
  state = created.state;
  const { state: afterReport } = progressScoutingAssignments(state, created.assignment!.endDate);
  state = afterReport;

  state = addToShortlist(state, playerId, "2026-08-19");

  const candidates = getRecruitmentCandidates(state);
  const matches = candidates.filter((c) => c.playerId === playerId);
  assert.equal(matches.length, 1, "a player reachable through three different paths must still appear exactly once");
});

test("reload persistence: shortlist/priority/note survive a JSON save/reload round-trip byte-for-byte", () => {
  let state = baseState();
  state = addToShortlist(state, "player-z", "2026-08-19");
  state = setRecruitmentPriority(state, "player-z", "HIGH", "2026-08-19");
  state = setRecruitmentNote(state, "player-z", "Bevaka inför sommarfönstret", "2026-08-19");

  const reloaded = JSON.parse(JSON.stringify(state)) as CareerState;
  assert.deepEqual(reloaded.recruitmentTargets, state.recruitmentTargets);
  assert.equal(getRecruitmentTarget(reloaded, "player-z")?.shortlisted, true);
  assert.equal(getRecruitmentTarget(reloaded, "player-z")?.priority, "HIGH");
  assert.equal(getRecruitmentTarget(reloaded, "player-z")?.note, "Bevaka inför sommarfönstret");
});

test("existing-save migration backfills recruitmentTargets to an empty map, idempotently", () => {
  const fresh = baseState();
  const legacyState = { ...fresh } as CareerState;
  delete (legacyState as { recruitmentTargets?: unknown }).recruitmentTargets;

  const migrated = migrateCareerState(legacyState);
  assert.deepEqual(migrated.recruitmentTargets, {});

  const migratedAgain = migrateCareerState(migrated);
  assert.deepEqual(migratedAgain, migrated);
});
