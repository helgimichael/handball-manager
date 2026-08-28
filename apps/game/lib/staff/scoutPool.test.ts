// HM-STAFF-SCOUT-POOL-1.0: focused proofs for the real-profile scout
// free-agent market -- source ingestion, eligibility gating, duplicate
// protection, attribute mapping/provenance, recruitment, and migration
// idempotency.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { migrateCareerState } from "../career/saveMigration";
import { TUMBA_CLUB_ID } from "../game-data";
import type { CareerState } from "../career/types";
import type { ResolvedStaffMember } from "./types";
import { SCOUT_POOL_SOURCE } from "./scoutPoolSource";
import {
  FREE_AGENT_MARKET_CLUB_ID,
  buildScoutAttributeProfile,
  findCanonicalCollisions,
  getScoutMarket,
  getScoutPoolSourceEntry,
  isFreeAgentScoutAvailable,
  seedScoutPool,
  signFreeAgentScout,
} from "./scoutPool";

function baseState(): CareerState {
  return createNewCareerState("scoutpool-test-seed", TUMBA_CLUB_ID);
}

// ---------------------------------------------------------------------------
// Source ingestion
// ---------------------------------------------------------------------------

test("SCOUT_POOL_SOURCE has exactly 100 entries", () => {
  assert.equal(SCOUT_POOL_SOURCE.length, 100);
});

test("every source entry has a unique personId", () => {
  const ids = new Set(SCOUT_POOL_SOURCE.map((e) => e.personId));
  assert.equal(ids.size, 100);
});

test("source eligibility statuses are preserved verbatim from the document", () => {
  const counts: Record<string, number> = {};
  for (const e of SCOUT_POOL_SOURCE) counts[e.sourceEligibilityStatus] = (counts[e.sourceEligibilityStatus] ?? 0) + 1;
  assert.equal(counts.LIKELY_ELIGIBLE, 7);
  assert.equal(counts.CONDITIONAL, 20);
  assert.equal(counts.RESEARCH, 72);
  assert.equal(counts.IDENTITY_CURRENT_ROLE_CHECK, 1);
});

// ---------------------------------------------------------------------------
// Seeding / eligibility gating
// ---------------------------------------------------------------------------

test("fresh career seeds all 100 source entries into scoutPoolSource", () => {
  const state = baseState();
  assert.equal(Object.keys(state.scoutPoolSource).length, 100);
});

// HM-STAFF-SCOUT-POOL-1.0A: source status is provenance/audit metadata
// only -- it must NEVER gate career availability. Every one of the 100
// candidates (across all four source statuses) is seeded as an
// available free agent, minus real in-career facts (already employed,
// or a canonical-person name collision -- covered by their own tests
// below).
test("all 100 source candidates -- across every source status -- are seeded into scoutMarket (source status is not a career-availability gate)", () => {
  const state = baseState();
  const market = getScoutMarket(state);
  const collisions = findCanonicalCollisions(state);
  assert.equal(market.length, 100 - collisions.length);

  const statusesRepresented = new Set(market.map((m) => getScoutPoolSourceEntry(state, m.id)?.sourceEligibilityStatus));
  assert.ok(statusesRepresented.has("RESEARCH"), "RESEARCH candidates must be available too");
  assert.ok(statusesRepresented.has("CONDITIONAL"), "CONDITIONAL candidates must be available too");

  const research = SCOUT_POOL_SOURCE.find((e) => e.sourceEligibilityStatus === "RESEARCH")!;
  if (!collisions.some((c) => c.personId === research.personId)) {
    assert.equal(isFreeAgentScoutAvailable(state, research.personId), true);
  }
});

test("a canonical-person collision is excluded from scoutMarket but its source record is still preserved for audit", () => {
  const state = baseState();
  const collisions = findCanonicalCollisions(state);
  for (const c of collisions) {
    assert.equal(isFreeAgentScoutAvailable(state, c.personId), false);
    assert.ok(getScoutPoolSourceEntry(state, c.personId), "collision entries must still exist in scoutPoolSource");
  }
});

test("zero generated scouts in the market -- every entry is REAL_PERSON_FICTIONAL_PROFILE, never GENERATED_FICTIONAL", () => {
  const state = baseState();
  for (const m of getScoutMarket(state)) {
    assert.equal(m.source, "REAL_PERSON_FICTIONAL_PROFILE");
  }
});

test("seedScoutPool is idempotent -- calling it again never duplicates source or market entries", () => {
  const state = baseState();
  const again = seedScoutPool(state);
  assert.equal(Object.keys(again.scoutPoolSource).length, 100);
  assert.equal(Object.keys(again.scoutMarket).length, Object.keys(state.scoutMarket).length);
  assert.equal(again, state); // true no-op reference when nothing changed
});

test("duplicate-person protection: a candidate already on a club's canonical roster (by name) is never added to scoutMarket, regardless of their source status", () => {
  const researchCandidate = SCOUT_POOL_SOURCE.find((e) => e.sourceEligibilityStatus === "RESEARCH")!;
  let state = createNewCareerState("scoutpool-dup-seed", TUMBA_CLUB_ID);
  // Remove any pre-seeded scout pool, then inject a canonical staff member sharing the candidate's exact name before re-seeding.
  state = { ...state, scoutPoolSource: {}, scoutMarket: {} };
  const collidingMember: ResolvedStaffMember = {
    id: "some-other-canonical-id",
    clubId: TUMBA_CLUB_ID,
    displayName: researchCandidate.fullName,
    roles: [],
    hmRoles: [],
    employmentType: "GOVERNANCE",
    profile: { personId: "some-other-canonical-id", attributes: {} as ResolvedStaffMember["profile"]["attributes"] },
    source: "REAL_WORLD_IDENTITY",
  };
  state = { ...state, staffRoster: { ...state.staffRoster, [TUMBA_CLUB_ID]: [...state.staffRoster[TUMBA_CLUB_ID], collidingMember] } };

  const seeded = seedScoutPool(state);
  assert.equal(seeded.scoutMarket[researchCandidate.personId], undefined, "the colliding candidate must never be seeded as a duplicate free agent");
  assert.ok(seeded.scoutPoolSource[researchCandidate.personId], "the source record itself must still be preserved for audit purposes");
});

// ---------------------------------------------------------------------------
// Attribute mapping / provenance
// ---------------------------------------------------------------------------

test("buildScoutAttributeProfile maps every source rating to its canonical attribute with SOURCE_MAPPED_FICTIONAL origin, and leaves unmapped attributes at a neutral GENERATED_PRIOR default", () => {
  const entry = SCOUT_POOL_SOURCE.find((e) => e.personId === "scout_claes_hellgren_8d6ccffb")!;
  const attrs = buildScoutAttributeProfile(entry);
  assert.equal(attrs.PLAYER_JUDGEMENT.value, entry.source.jca);
  assert.equal(attrs.POTENTIAL_JUDGEMENT.value, entry.source.jpa);
  assert.equal(attrs.YOUTH_DEVELOPMENT.value, entry.source.yth);
  assert.equal(attrs.GOALKEEPER_COACHING.value, entry.source.gk);
  assert.equal(attrs.TACTICAL_ASSESSMENT.value, entry.source.tac);
  assert.equal(attrs.NETWORK.value, entry.source.net);
  assert.equal(attrs.REGIONAL_KNOWLEDGE.value, entry.source.reg);
  assert.equal(attrs.INTERNATIONAL_KNOWLEDGE.value, entry.source.int);
  for (const attr of ["PLAYER_JUDGEMENT", "POTENTIAL_JUDGEMENT", "YOUTH_DEVELOPMENT", "GOALKEEPER_COACHING", "TACTICAL_ASSESSMENT", "NETWORK", "REGIONAL_KNOWLEDGE", "INTERNATIONAL_KNOWLEDGE"] as const) {
    assert.equal(attrs[attr].origin, "SOURCE_MAPPED_FICTIONAL");
  }
  assert.equal(attrs.TECHNICAL_COACHING.origin, "GENERATED_PRIOR");
  assert.equal(attrs.MEDICAL.origin, "GENERATED_PRIOR");
});

test("a market member's clubId is the free-agent sentinel, never a real club, until signed", () => {
  const state = baseState();
  const member = getScoutMarket(state)[0];
  assert.equal(member.clubId, FREE_AGENT_MARKET_CLUB_ID);
});

// ---------------------------------------------------------------------------
// Recruitment
// ---------------------------------------------------------------------------

test("signFreeAgentScout succeeds for an available candidate: added to staffRoster/staffEmployment, removed from scoutMarket", () => {
  const state = baseState();
  const candidate = getScoutMarket(state)[0];
  const { state: next, result } = signFreeAgentScout(state, candidate.id, TUMBA_CLUB_ID, 1200, 3, state.gameDate);
  assert.equal(result.outcome, "COMPLETED");
  assert.equal(next.scoutMarket[candidate.id], undefined);
  const hired = next.staffRoster[TUMBA_CLUB_ID].find((m) => m.id === candidate.id);
  assert.ok(hired);
  assert.equal(hired!.clubId, TUMBA_CLUB_ID);
  assert.equal(hired!.roles.includes("SCOUT"), true);
  const employment = next.staffEmployment[candidate.id];
  assert.equal(employment?.wageEurPerMonth, 1200);
  assert.equal(employment?.employmentType, "SALARIED");
});

test("signFreeAgentScout refuses a non-existent/unavailable personId honestly", () => {
  const state = baseState();
  const { result } = signFreeAgentScout(state, "not-a-real-person", TUMBA_CLUB_ID, 1000, 2, state.gameDate);
  assert.equal(result.outcome, "NOT_AVAILABLE");
});

// HM-STAFF-SCOUT-POOL-1.0A: a RESEARCH-status candidate IS a real,
// signable free agent -- source status is provenance metadata only.
test("a RESEARCH-status candidate can be signed just like any other free agent", () => {
  const state = baseState();
  const research = SCOUT_POOL_SOURCE.find((e) => e.sourceEligibilityStatus === "RESEARCH" && isFreeAgentScoutAvailable(state, e.personId))!;
  assert.ok(research, "expected at least one RESEARCH candidate to be available for this test to be meaningful");
  const { result } = signFreeAgentScout(state, research.personId, TUMBA_CLUB_ID, 1000, 2, state.gameDate);
  assert.equal(result.outcome, "COMPLETED");
});

test("a personId with no scoutMarket entry at all (never existed) is refused honestly", () => {
  const state = baseState();
  const { result } = signFreeAgentScout(state, "totally-made-up-id", TUMBA_CLUB_ID, 1000, 2, state.gameDate);
  assert.equal(result.outcome, "NOT_AVAILABLE");
});

test("signFreeAgentScout blocks an unaffordable offer without mutating state", () => {
  const state = baseState();
  const candidate = getScoutMarket(state)[0];
  const { state: next, result } = signFreeAgentScout(state, candidate.id, TUMBA_CLUB_ID, 10_000_000, 2, state.gameDate);
  assert.equal(result.outcome, "BLOCKED_UNAFFORDABLE");
  assert.equal(next, state);
});

// ---------------------------------------------------------------------------
// Migration idempotency
// ---------------------------------------------------------------------------

// HM-STAFF-SCOUT-POOL-1.0A: a save created under the PREVIOUS
// implementation (only the 7 LIKELY_ELIGIBLE candidates in scoutMarket)
// must be backfilled so every other candidate becomes available too.
test("existing-save migration backfills previously-unavailable RESEARCH/CONDITIONAL candidates into scoutMarket", () => {
  const fresh = baseState();
  // Simulate the OLD (1.0) implementation's narrower seed: only LIKELY_ELIGIBLE in scoutMarket.
  const oldShapedMarket = Object.fromEntries(
    Object.entries(fresh.scoutMarket).filter(([id]) => getScoutPoolSourceEntry(fresh, id)?.sourceEligibilityStatus === "LIKELY_ELIGIBLE"),
  );
  const legacy = { ...fresh, scoutMarket: oldShapedMarket };
  assert.equal(Object.keys(legacy.scoutMarket).length, 7, "sanity: simulating the old, narrower market shape");

  const migrated = migrateCareerState(legacy);
  const collisions = findCanonicalCollisions(migrated);
  assert.equal(Object.keys(migrated.scoutMarket).length, 100 - collisions.length, "migration must backfill every non-colliding candidate, not just LIKELY_ELIGIBLE ones");

  const migratedAgain = migrateCareerState(migrated);
  assert.equal(Object.keys(migratedAgain.scoutMarket).length, Object.keys(migrated.scoutMarket).length, "migration must be idempotent");
});

test("existing-save migration backfills the scout pool for a save that predates this milestone, and never re-adds an already-signed scout as a free agent", () => {
  const state = baseState();
  const candidate = getScoutMarket(state)[0];
  const { state: withHire } = signFreeAgentScout(state, candidate.id, TUMBA_CLUB_ID, 1000, 2, state.gameDate);

  const legacy = { ...withHire } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).scoutPoolSource;
  delete (legacy as Record<string, unknown>).scoutMarket;

  const migrated = migrateCareerState(legacy as CareerState);
  assert.equal(Object.keys(migrated.scoutPoolSource).length, 100);
  assert.equal(migrated.scoutMarket[candidate.id], undefined, "an already-signed scout must never reappear as a free agent after migration");
  assert.ok(migrated.staffRoster[TUMBA_CLUB_ID].some((m) => m.id === candidate.id), "the signed scout must still be on the roster");

  const migratedAgain = migrateCareerState(migrated);
  assert.equal(Object.keys(migratedAgain.scoutMarket).length, Object.keys(migrated.scoutMarket).length);
});
