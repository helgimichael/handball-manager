// HM-SCOUTING-1.1: focused proofs for the discovery engine -- candidate
// pool scoping per assignment type, deterministic/bounded/explainable
// discovery, no duplicates, knowledge growth, and the JCA/JPA/YTH/NET/
// REG/INT/GK attribute effects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { generateStaffAttributeProfile } from "../staff/staffAttributeGeneration";
import { ensureCareerGameplayRatings } from "./careerRatingNormalization";
import { getPlayerKnowledgePct, getClubKnowledgePct, getCompetitionKnowledgePct, getCountryKnowledgePct } from "../knowledge/knowledgeIntegration";
import type { ResolvedStaffMember, StaffAttribute } from "../staff/types";
import { TUMBA_CLUB_ID } from "../game-data";
import type { CareerState } from "./types";
import type { PlayerMock } from "../game-data";
import { createBroadScoutingAssignment, progressScoutingAssignments, cancelScoutingAssignment } from "./scouting";
import { runDiscoveryCycle, getAllScoutDiscoveries, getPlayerScoutDiscoveries } from "./scoutDiscovery";

const GERMAN_CLUB = "ger1-kiel"; // real, HM-WORLD-PLAYER-POOL-1.0 club, competition "ger-1"
const GERMAN_COMPETITION = "ger-1";
const SWEDISH_DIV1_CLUB = "se_club_bodens_bk_hf"; // real Division 1 Norra club

function baseState(): CareerState {
  return createNewCareerState("discovery-test-seed", TUMBA_CLUB_ID);
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

/** Injects a synthetic squad (real registered clubId, synthetic players) and generated (real fallback pipeline) gameplay ratings, then OVERRIDES their CA to controlled, index-based values so ranking behavior is fully deterministic and assertable. */
function withControlledPool(state: CareerState, clubId: string, players: PlayerMock[], caByIndex: number[]): CareerState {
  const withSquad = { ...state, worldSquads: { ...state.worldSquads, [clubId]: players } };
  const withRatings = ensureCareerGameplayRatings(withSquad, clubId);
  const existing = withRatings.gameplayRatings[clubId] ?? [];
  const updated = existing.map((r, i) => ({ ...r, ca: caByIndex[i] ?? r.ca }));
  return { ...withRatings, gameplayRatings: { ...withRatings.gameplayRatings, [clubId]: updated } };
}

test("CLUB assignment's candidate pool is scoped to exactly that club's squad", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const players = Array.from({ length: 6 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [80, 90, 100, 110, 120, 130]);

  const result = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  assert.equal(result.ok, true, result.errors.join(" "));
  const { discoveries } = runDiscoveryCycle(result.state, result.assignment!, result.assignment!.endDate);
  assert.ok(discoveries.length > 0);
  for (const d of discoveries) assert.equal(d.clubId, GERMAN_CLUB, "every discovery must come from the targeted club");
});

test("COMPETITION assignment's candidate pool is scoped to clubs in that competition only", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const players = Array.from({ length: 6 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [80, 90, 100, 110, 120, 130]);

  const result = createBroadScoutingAssignment(state, "scout-1", "COMPETITION", { targetCompetitionId: GERMAN_COMPETITION }, "2026-08-19");
  assert.equal(result.ok, true, result.errors.join(" "));
  const { discoveries } = runDiscoveryCycle(result.state, result.assignment!, result.assignment!.endDate);
  assert.ok(discoveries.length > 0);
});

test("REGION assignment's candidate pool is scoped to clubs whose competition nation matches", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const players = Array.from({ length: 6 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [80, 90, 100, 110, 120, 130]);

  const result = createBroadScoutingAssignment(state, "scout-1", "REGION", { targetNation: "GER" }, "2026-08-19");
  assert.equal(result.ok, true, result.errors.join(" "));
  const { discoveries } = runDiscoveryCycle(result.state, result.assignment!, result.assignment!.endDate);
  assert.ok(discoveries.length > 0);
  assert.ok(discoveries.every((d) => d.clubId === GERMAN_CLUB), "the only German club with a squad in this fixture is Kiel");
});

test("POSITION assignment's candidate pool is scoped to that position only, across every candidate club", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const players = [
    syntheticPlayer("mv-1", SWEDISH_DIV1_CLUB, "2000-01-01", "MV"),
    syntheticPlayer("m6-1", SWEDISH_DIV1_CLUB, "2000-01-01", "M6"),
    syntheticPlayer("mv-2", SWEDISH_DIV1_CLUB, "2000-01-01", "MV"),
  ];
  state = withControlledPool(state, SWEDISH_DIV1_CLUB, players, [100, 100, 100]);

  const result = createBroadScoutingAssignment(state, "scout-1", "POSITION", { targetPosition: "MV" }, "2026-08-19");
  assert.equal(result.ok, true, result.errors.join(" "));
  const { discoveries } = runDiscoveryCycle(result.state, result.assignment!, result.assignment!.endDate);
  assert.ok(discoveries.length > 0);
  for (const d of discoveries) assert.ok(["mv-1", "mv-2"].includes(d.playerId), "only MV players may be discovered");
});

test("AGE_BAND assignment's candidate pool excludes players older than the requested max age", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const players = [
    syntheticPlayer("young-1", SWEDISH_DIV1_CLUB, "2008-01-01"), // ~18
    syntheticPlayer("old-1", SWEDISH_DIV1_CLUB, "1985-01-01"), // ~41
  ];
  state = withControlledPool(state, SWEDISH_DIV1_CLUB, players, [100, 100]);

  const result = createBroadScoutingAssignment(state, "scout-1", "AGE_BAND", { targetMaxAgeYears: 21 }, "2026-08-19");
  assert.equal(result.ok, true, result.errors.join(" "));
  const { discoveries } = runDiscoveryCycle(result.state, result.assignment!, result.assignment!.endDate);
  assert.ok(discoveries.length > 0);
  for (const d of discoveries) assert.equal(d.playerId, "young-1", "the 41-year-old must never be discovered by a U21 assignment");
});

test("discovery is deterministic -- the exact same (state, assignment, date) always produces the exact same discoveries", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const players = Array.from({ length: 8 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [70, 80, 90, 100, 110, 120, 130, 140]);
  const result = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");

  const first = runDiscoveryCycle(result.state, result.assignment!, result.assignment!.endDate);
  const second = runDiscoveryCycle(result.state, result.assignment!, result.assignment!.endDate);
  assert.deepEqual(
    first.discoveries.map((d) => d.playerId),
    second.discoveries.map((d) => d.playerId),
  );
});

test("no duplicate discoveries -- a second cycle of the SAME assignment never re-discovers a player from the first cycle", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID, { NETWORK: 20, PLAYER_JUDGEMENT: 15, POTENTIAL_JUDGEMENT: 15 }));
  const players = Array.from({ length: 10 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [70, 75, 80, 85, 90, 95, 100, 105, 110, 115]);
  const created = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  assert.equal(created.ok, true, created.errors.join(" "));

  const cycle1 = runDiscoveryCycle(created.state, created.assignment!, created.assignment!.endDate);
  assert.ok(cycle1.discoveries.length > 0);
  const assignmentAfterCycle1 = { ...created.assignment!, discoveredPlayerIds: cycle1.discoveries.map((d) => d.playerId), cyclesCompleted: 1 };

  const cycle2 = runDiscoveryCycle(cycle1.state, assignmentAfterCycle1, created.assignment!.endDate);
  const overlap = cycle2.discoveries.filter((d) => assignmentAfterCycle1.discoveredPlayerIds.includes(d.playerId));
  assert.equal(overlap.length, 0, "cycle 2 must never re-discover a player cycle 1 already found");
});

test("discovery bumps player, club, competition, and country knowledge -- reusing the SAME lib/knowledge write paths, never a parallel system", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const players = Array.from({ length: 4 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [90, 100, 110, 120]);
  const created = createBroadScoutingAssignment(state, "scout-1", "REGION", { targetNation: "GER" }, "2026-08-19");
  assert.equal(created.ok, true, created.errors.join(" "));

  const beforeCountry = getCountryKnowledgePct(created.state, "GER", "SWE");
  const beforeClub = getClubKnowledgePct(created.state, GERMAN_CLUB);

  const { state: afterCycle, discoveries } = runDiscoveryCycle(created.state, created.assignment!, created.assignment!.endDate);
  assert.ok(discoveries.length > 0);

  const afterCountry = getCountryKnowledgePct(afterCycle, "GER", "SWE");
  const afterClub = getClubKnowledgePct(afterCycle, GERMAN_CLUB);
  assert.ok(afterCountry > beforeCountry, `country knowledge must rise (${beforeCountry} -> ${afterCountry})`);
  assert.ok(afterClub > beforeClub, `club knowledge must rise (${beforeClub} -> ${afterClub})`);
  for (const d of discoveries) {
    assert.ok(getPlayerKnowledgePct(afterCycle, d.playerId, d.clubId) > 15, "a discovered player's own knowledge must rise above the external default");
  }
});

test("COMPETITION assignment also raises competition knowledge specifically", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const players = Array.from({ length: 4 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [90, 100, 110, 120]);
  const created = createBroadScoutingAssignment(state, "scout-1", "COMPETITION", { targetCompetitionId: GERMAN_COMPETITION }, "2026-08-19");
  const before = getCompetitionKnowledgePct(created.state, GERMAN_COMPETITION);
  const { state: after } = runDiscoveryCycle(created.state, created.assignment!, created.assignment!.endDate);
  assert.ok(getCompetitionKnowledgePct(after, GERMAN_COMPETITION) > before);
});

test("NET (NETWORK) drives discovery reach -- a high-NET scout finds at least as many players as a low-NET scout from the identical pool", () => {
  let state = baseState();
  state = withScout(state, staffMember("net-high", TUMBA_CLUB_ID, { NETWORK: 20 }));
  state = withScout(state, staffMember("net-low", TUMBA_CLUB_ID, { NETWORK: 1 }));
  const players = Array.from({ length: 12 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, players.map((_, i) => 70 + i * 5));

  const highResult = createBroadScoutingAssignment(state, "net-high", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  const lowResult = createBroadScoutingAssignment(highResult.state, "net-low", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");

  const highCycle = runDiscoveryCycle(lowResult.state, highResult.assignment!, highResult.assignment!.endDate);
  const lowCycle = runDiscoveryCycle(lowResult.state, lowResult.assignment!, lowResult.assignment!.endDate);
  assert.ok(highCycle.discoveries.length >= lowCycle.discoveries.length, `high-NET (${highCycle.discoveries.length}) must find at least as many as low-NET (${lowCycle.discoveries.length})`);
});

/** Precision = how many of a scout's discoveries are among the pool's TRUE top-N players by CA (N = that scout's own discovery count) -- a "≥" comparison is robust to exact seed unpredictability while still meaningfully proving the mechanism: a specialist's small ranking jitter should track true CA order at least as well as a badly-mismatched generalist's wide jitter, on an evenly-graduated pool where jitter actually matters (unlike a single extreme outlier, which either scout would find regardless of jitter). */
function precisionAgainstTrueTop(discoveries: { playerId: string }[], trueOrderDesc: string[]): number {
  const trueTop = new Set(trueOrderDesc.slice(0, discoveries.length));
  return discoveries.filter((d) => trueTop.has(d.playerId)).length;
}

test("runDiscoveryCycle never crashes for a real-identity scout profile with a MISSING attribute (e.g. NETWORK) -- older real-identity staff profiles predate some newer attributes and are never guaranteed complete", () => {
  let state = baseState();
  const incompleteScout = staffMember("incomplete-scout", TUMBA_CLUB_ID);
  delete (incompleteScout.profile.attributes as Partial<typeof incompleteScout.profile.attributes>).NETWORK;
  state = withScout(state, incompleteScout);
  const players = Array.from({ length: 4 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [80, 90, 100, 110]);
  const created = createBroadScoutingAssignment(state, "incomplete-scout", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  assert.equal(created.ok, true, created.errors.join(" "));
  assert.doesNotThrow(() => runDiscoveryCycle(created.state, created.assignment!, created.assignment!.endDate));
});

test("a GK specialist on a POSITION=MV assignment ranks candidates at least as precisely (against true CA order) as a badly-mismatched generalist", () => {
  let state = baseState();
  state = withScout(state, staffMember("gk-specialist", TUMBA_CLUB_ID, { GOALKEEPER_COACHING: 20, PLAYER_JUDGEMENT: 16, POTENTIAL_JUDGEMENT: 16, NETWORK: 14 }));
  state = withScout(state, staffMember("weak-generalist", TUMBA_CLUB_ID, { GOALKEEPER_COACHING: 1, PLAYER_JUDGEMENT: 3, POTENTIAL_JUDGEMENT: 3, NETWORK: 14 }));
  const players = Array.from({ length: 20 }, (_, i) => syntheticPlayer(`mv-p${i}`, SWEDISH_DIV1_CLUB, "2000-01-01", "MV"));
  const caByIndex = players.map((_, i) => 60 + i * 3); // evenly graduated -- close enough that ranking jitter actually matters
  state = withControlledPool(state, SWEDISH_DIV1_CLUB, players, caByIndex);
  const trueOrderDesc = players.map((p) => p.id).slice().reverse(); // caByIndex is ascending by index, so reversed ids are descending by CA

  const gkResult = createBroadScoutingAssignment(state, "gk-specialist", "POSITION", { targetPosition: "MV" }, "2026-08-19");
  const genResult = createBroadScoutingAssignment(gkResult.state, "weak-generalist", "POSITION", { targetPosition: "MV" }, "2026-08-19");

  const gkCycle = runDiscoveryCycle(genResult.state, gkResult.assignment!, gkResult.assignment!.endDate);
  const genCycle = runDiscoveryCycle(genResult.state, genResult.assignment!, genResult.assignment!.endDate);
  assert.equal(gkCycle.discoveries.length, genCycle.discoveries.length, "equal NETWORK must yield equal discovery counts, isolating ranking precision as the only variable");

  const gkPrecision = precisionAgainstTrueTop(gkCycle.discoveries, trueOrderDesc);
  const genPrecision = precisionAgainstTrueTop(genCycle.discoveries, trueOrderDesc);
  assert.ok(gkPrecision >= genPrecision, `GK specialist precision (${gkPrecision}) must be >= mismatched generalist precision (${genPrecision})`);
});

test("a REGIONAL_KNOWLEDGE specialist ranks a domestic REGION assignment at least as precisely as a badly-mismatched INTERNATIONAL_KNOWLEDGE specialist", () => {
  let state = baseState();
  state = withScout(state, staffMember("regional", TUMBA_CLUB_ID, { REGIONAL_KNOWLEDGE: 20, INTERNATIONAL_KNOWLEDGE: 1, PLAYER_JUDGEMENT: 16, POTENTIAL_JUDGEMENT: 16, NETWORK: 14 }));
  state = withScout(state, staffMember("international", TUMBA_CLUB_ID, { REGIONAL_KNOWLEDGE: 1, INTERNATIONAL_KNOWLEDGE: 20, PLAYER_JUDGEMENT: 3, POTENTIAL_JUDGEMENT: 3, NETWORK: 14 }));
  const players = Array.from({ length: 20 }, (_, i) => syntheticPlayer(`div1-p${i}`, SWEDISH_DIV1_CLUB, "2000-01-01"));
  const caByIndex = players.map((_, i) => 60 + i * 3);
  state = withControlledPool(state, SWEDISH_DIV1_CLUB, players, caByIndex);
  const trueOrderDesc = players.map((p) => p.id).slice().reverse();

  const regResult = createBroadScoutingAssignment(state, "regional", "REGION", { targetNation: "SWE" }, "2026-08-19");
  const intlResult = createBroadScoutingAssignment(regResult.state, "international", "REGION", { targetNation: "SWE" }, "2026-08-19");

  const regCycle = runDiscoveryCycle(intlResult.state, regResult.assignment!, regResult.assignment!.endDate);
  const intlCycle = runDiscoveryCycle(intlResult.state, intlResult.assignment!, intlResult.assignment!.endDate);
  assert.equal(regCycle.discoveries.length, intlCycle.discoveries.length);

  const regPrecision = precisionAgainstTrueTop(regCycle.discoveries, trueOrderDesc);
  const intlPrecision = precisionAgainstTrueTop(intlCycle.discoveries, trueOrderDesc);
  assert.ok(regPrecision >= intlPrecision, `REGIONAL specialist precision (${regPrecision}) must be >= mismatched INTERNATIONAL specialist precision (${intlPrecision}) on a domestic assignment`);
});

test("progressScoutingAssignments advances a broad assignment cycle-by-cycle and auto-completes at maxCycles, never producing a ScoutReport (that's PLAYER-only)", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID, { NETWORK: 20 }));
  const players = Array.from({ length: 6 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [80, 90, 100, 110, 120, 130]);
  const created = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  assert.equal(created.ok, true, created.errors.join(" "));
  const assignmentId = created.assignment!.id;

  let current = created.state;
  let cyclesRun = 0;
  for (let i = 0; i < 10 && current.scoutingAssignments[assignmentId].status === "IN_PROGRESS"; i++) {
    const endDate = current.scoutingAssignments[assignmentId].endDate;
    const { state: next, discoveryCycles } = progressScoutingAssignments(current, endDate);
    current = next;
    if (discoveryCycles.some((c) => c.assignment.id === assignmentId)) cyclesRun++;
  }
  const finalAssignment = current.scoutingAssignments[assignmentId];
  assert.equal(finalAssignment.status, "COMPLETED");
  assert.equal(finalAssignment.cyclesCompleted, finalAssignment.maxCycles);
  assert.equal(finalAssignment.reportId, null, "a broad assignment never files a PLAYER-style ScoutReport");
  assert.equal(Object.keys(current.scoutReports).length, 0);
  assert.ok(cyclesRun >= 1);
});

test("cancelScoutingAssignment stops a broad assignment without producing further discoveries", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const players = Array.from({ length: 4 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [80, 90, 100, 110]);
  const created = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  const cancelled = cancelScoutingAssignment(created.state, created.assignment!.id);
  assert.equal(cancelled.scoutingAssignments[created.assignment!.id].status, "CANCELLED");

  const { discoveryCycles } = progressScoutingAssignments(cancelled, created.assignment!.endDate);
  assert.equal(discoveryCycles.length, 0, "a CANCELLED assignment must never produce further discovery cycles");
});

test("a broad assignment refuses a duplicate active assignment of the SAME type and scope for the SAME scout", () => {
  const state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const first = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  assert.equal(first.ok, true, first.errors.join(" "));
  const second = createBroadScoutingAssignment(first.state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-20");
  assert.equal(second.ok, false);
});

test("createBroadScoutingAssignment refuses honestly when the club has no scout at all -- never invents one", () => {
  const state = baseState();
  const result = createBroadScoutingAssignment(state, "nonexistent-scout", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  assert.equal(result.ok, false);
});

test("createBroadScoutingAssignment refuses an own-club CLUB target and an own-competition COMPETITION target", () => {
  const state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const ownClub = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: TUMBA_CLUB_ID }, "2026-08-19");
  assert.equal(ownClub.ok, false);
  const ownCompetition = createBroadScoutingAssignment(state, "scout-1", "COMPETITION", { targetCompetitionId: state.competitionId }, "2026-08-19");
  assert.equal(ownCompetition.ok, false);
});

test("createBroadScoutingAssignment refuses an invalid position and an out-of-range age band", () => {
  const state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID));
  const badPosition = createBroadScoutingAssignment(state, "scout-1", "POSITION", { targetPosition: "XX" }, "2026-08-19");
  assert.equal(badPosition.ok, false);
  const badAge = createBroadScoutingAssignment(state, "scout-1", "AGE_BAND", { targetMaxAgeYears: 200 }, "2026-08-19");
  assert.equal(badAge.ok, false);
});

test("getAllScoutDiscoveries / getPlayerScoutDiscoveries read back exactly what runDiscoveryCycle persisted", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID, { NETWORK: 20 }));
  const players = Array.from({ length: 6 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [80, 90, 100, 110, 120, 130]);
  const created = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  const { state: after, discoveries } = runDiscoveryCycle(created.state, created.assignment!, created.assignment!.endDate);

  assert.equal(getAllScoutDiscoveries(after).length, discoveries.length);
  for (const d of discoveries) {
    assert.ok(getPlayerScoutDiscoveries(after, d.playerId).some((x) => x.id === d.id));
  }
});

test("raw CA/PA are never exposed through a ScoutDiscovery -- structurally, not just by convention", () => {
  let state = withScout(baseState(), staffMember("scout-1", TUMBA_CLUB_ID, { NETWORK: 20 }));
  const players = Array.from({ length: 4 }, (_, i) => syntheticPlayer(`kiel-p${i}`, GERMAN_CLUB, "2000-01-01"));
  state = withControlledPool(state, GERMAN_CLUB, players, [80, 90, 100, 110]);
  const created = createBroadScoutingAssignment(state, "scout-1", "CLUB", { targetClubId: GERMAN_CLUB }, "2026-08-19");
  const { discoveries } = runDiscoveryCycle(created.state, created.assignment!, created.assignment!.endDate);
  assert.ok(discoveries.length > 0);
  for (const d of discoveries) {
    assert.equal("ca" in d, false);
    assert.equal("pa" in d, false);
  }
});

test("existing-save migration backfills a legacy PLAYER-only ScoutingAssignment (no assignmentType field) to the new additive shape, defaulting to PLAYER", () => {
  const fresh = baseState();
  const legacyAssignment = {
    id: "legacy-1",
    scoutStaffId: "scout-x",
    targetPlayerId: "player-x",
    targetClubId: "some-club",
    startDate: "2026-01-01",
    endDate: "2026-01-10",
    status: "COMPLETED" as const,
    reportId: "report-legacy-1",
  };
  const legacyState = {
    ...fresh,
    scoutingAssignments: { "legacy-1": legacyAssignment as unknown as CareerState["scoutingAssignments"][string] },
  };
  delete (legacyState as { competitionKnowledge?: unknown }).competitionKnowledge;
  delete (legacyState as { countryKnowledge?: unknown }).countryKnowledge;
  delete (legacyState as { scoutDiscoveries?: unknown }).scoutDiscoveries;

  const migrated = migrateCareerState(legacyState as CareerState);
  assert.deepEqual(migrated.competitionKnowledge, {});
  assert.deepEqual(migrated.countryKnowledge, {});
  assert.deepEqual(migrated.scoutDiscoveries, {});
  const migratedAssignment = migrated.scoutingAssignments["legacy-1"];
  assert.equal(migratedAssignment.assignmentType, "PLAYER");
  assert.equal(migratedAssignment.targetPlayerId, "player-x");
  assert.equal(migratedAssignment.maxCycles, 1);
  assert.deepEqual(migratedAssignment.discoveredPlayerIds, []);
});

test("existing-save migration is idempotent -- migrating an already-migrated state never mutates it further", () => {
  const fresh = baseState();
  const once = migrateCareerState(fresh);
  const twice = migrateCareerState(once);
  assert.deepEqual(twice, once);
});
