// HM-STAFF-CAREER-1.0: real newCareer flow proofs for the whole-
// competition staff roster/employment, career persistence of a
// recruitment move, and the migration top-up path -- mirrors
// squadStatus.test.ts's own "use the real career constructor, not a
// hand-rolled fixture" pattern.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { getClubsByCompetition, TUMBA_CLUB_ID } from "../game-data";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureCareerCompetitionStaffRoster, findStaffMember, recalibrateStaffEmploymentWages, recruitStaffMember } from "./staffCareerIntegration";
import type { CareerState } from "../career/types";

/** Real identity data for EVERY Allsvenskan club, mirroring what CareerContext.tsx's own fetchAllClubsStaffIdentity provides at career creation -- without this, every OTHER club's roster would resolve empty (a REAL_WORLD club with no identity data gets nothing, by design), making recruitment-from-another-club untestable. */
function freshTumba(seed: string): CareerState {
  const allClubs = snapshotAllClubsStaff("swe-2");
  return createNewCareerState(seed, TUMBA_CLUB_ID, {}, {}, {}, allClubs);
}

test("(1) a fresh career resolves a staff roster for EVERY club in the competition, not only the manager's own", () => {
  const state = freshTumba("staff-career-1");
  const clubIds = getClubsByCompetition(state.competitionId).map((c) => c.id);
  for (const clubId of clubIds) {
    assert.ok(state.staffRoster[clubId] !== undefined, `expected a staffRoster entry for ${clubId}`);
  }
});

test("(2) every SALARIED staff member across the whole competition has a wage and contract end date; VOLUNTARY/GOVERNANCE members have neither", () => {
  const state = freshTumba("staff-career-2");
  for (const roster of Object.values(state.staffRoster)) {
    for (const member of roster) {
      const employment = state.staffEmployment[member.id];
      assert.ok(employment, `expected an employment entry for ${member.id}`);
      if (employment.employmentType === "SALARIED") {
        assert.equal(typeof employment.wageEurPerMonth, "number");
        assert.ok(employment.wageEurPerMonth! > 0);
        assert.equal(employment.contractEndDate?.slice(5), "05-31");
      } else {
        assert.equal(employment.wageEurPerMonth, undefined);
        assert.equal(employment.contractEndDate, undefined);
      }
    }
  }
});

test("(3) findStaffMember locates a person by id regardless of which club's roster they're on", () => {
  const state = freshTumba("staff-career-3");
  const otherClubId = getClubsByCompetition(state.competitionId).find((c) => c.id !== TUMBA_CLUB_ID)!.id;
  const someone = state.staffRoster[otherClubId][0];
  const found = findStaffMember(state, someone.id);
  assert.equal(found?.id, someone.id);
  assert.equal(found?.clubId, otherClubId);
});

test("(4) recruitStaffMember moves the person's roster entry, employment, and opens a career-tracked club-history spell", () => {
  const state = freshTumba("staff-career-4");
  const otherClubId = getClubsByCompetition(state.competitionId).find((c) => c.id !== TUMBA_CLUB_ID)!.id;
  const salariedCandidate = state.staffRoster[otherClubId].find((m) => state.staffEmployment[m.id]?.employmentType === "SALARIED");
  assert.ok(salariedCandidate, "expected at least one salaried candidate at the other club for this test to be meaningful");

  const next = recruitStaffMember(state, salariedCandidate!.id, otherClubId, TUMBA_CLUB_ID, 5000, "2029-05-31");

  assert.ok(!next.staffRoster[otherClubId].some((m) => m.id === salariedCandidate!.id), "should be removed from the old club's roster");
  const moved = next.staffRoster[TUMBA_CLUB_ID].find((m) => m.id === salariedCandidate!.id);
  assert.ok(moved, "should now be on the new club's roster");
  assert.equal(moved!.clubId, TUMBA_CLUB_ID);

  const employment = next.staffEmployment[salariedCandidate!.id];
  assert.equal(employment.clubId, TUMBA_CLUB_ID);
  assert.equal(employment.wageEurPerMonth, 5000);
  assert.equal(employment.contractEndDate, "2029-05-31");
  assert.equal(employment.employmentType, "SALARIED");

  const history = next.staffClubHistory[salariedCandidate!.id];
  assert.ok(history);
  const originEntry = history.entries.find((e) => e.clubId === otherClubId);
  assert.equal(originEntry?.toDate, state.gameDate);
  const newEntry = history.entries.find((e) => e.clubId === TUMBA_CLUB_ID);
  assert.equal(newEntry?.fromDate, state.gameDate);
  assert.equal(newEntry?.toDate, undefined);
});

test("(5) a staff member who moves TWICE gets two closed history spells plus one open one, never losing the first move", () => {
  const state = freshTumba("staff-career-5");
  const clubIds = getClubsByCompetition(state.competitionId).map((c) => c.id);
  const clubA = clubIds.find((id) => id !== TUMBA_CLUB_ID)!;
  const clubB = clubIds.find((id) => id !== TUMBA_CLUB_ID && id !== clubA)!;
  const candidate = state.staffRoster[clubA].find((m) => state.staffEmployment[m.id]?.employmentType === "SALARIED")!;

  let next = recruitStaffMember(state, candidate.id, clubA, clubB, 4000, "2028-05-31");
  next = recruitStaffMember(next, candidate.id, clubB, TUMBA_CLUB_ID, 4500, "2029-05-31");

  const history = next.staffClubHistory[candidate.id];
  assert.equal(history.entries.length, 3);
  assert.equal(history.entries[0].clubId, clubA);
  assert.notEqual(history.entries[0].toDate, undefined);
  assert.equal(history.entries[1].clubId, clubB);
  assert.notEqual(history.entries[1].toDate, undefined);
  assert.equal(history.entries[2].clubId, TUMBA_CLUB_ID);
  assert.equal(history.entries[2].toDate, undefined);
});

test("(6) ensureCareerCompetitionStaffRoster is a true no-op once every competition club already has a roster entry", () => {
  const state = freshTumba("staff-career-6");
  const again = ensureCareerCompetitionStaffRoster(state, state.competitionId, {}, 2030);
  assert.equal(again, state);
});

test("(7) ensureCareerCompetitionStaffRoster fills in ONLY the missing clubs, leaving an already-resolved club's roster (and any recruitment move already applied to it) untouched", () => {
  const state = freshTumba("staff-career-7");
  const otherClubId = getClubsByCompetition(state.competitionId).find((c) => c.id !== TUMBA_CLUB_ID)!.id;
  const candidate = state.staffRoster[otherClubId].find((m) => state.staffEmployment[m.id]?.employmentType === "SALARIED")!;
  const withMove = recruitStaffMember(state, candidate.id, otherClubId, TUMBA_CLUB_ID, 6000, "2029-05-31");

  // Simulate a pre-this-milestone save that predates the whole-competition
  // resolution -- only the manager's own club had a roster.
  const legacyShaped: CareerState = { ...withMove, staffRoster: { [TUMBA_CLUB_ID]: withMove.staffRoster[TUMBA_CLUB_ID] } };
  const toppedUp = ensureCareerCompetitionStaffRoster(legacyShaped, legacyShaped.competitionId, {}, 2030);

  // The manager's own club (already present, WITH the moved person) must be untouched.
  assert.equal(toppedUp.staffRoster[TUMBA_CLUB_ID], legacyShaped.staffRoster[TUMBA_CLUB_ID]);
  assert.ok(toppedUp.staffRoster[TUMBA_CLUB_ID].some((m) => m.id === candidate.id));
  // Every other competition club is now filled in.
  for (const clubId of getClubsByCompetition(legacyShaped.competitionId).map((c) => c.id)) {
    assert.ok(toppedUp.staffRoster[clubId] !== undefined, `expected ${clubId} to be filled in by the top-up`);
  }
});

test("(8) recalibrateStaffEmploymentWages backfills a missing wage for an existing SALARIED entry, and is a no-op once every SALARIED entry already has one", () => {
  const state = freshTumba("staff-career-8");
  const [staffId, employment] = Object.entries(state.staffEmployment).find(([, e]) => e.employmentType === "SALARIED")!;
  const stripped: CareerState = { ...state, staffEmployment: { ...state.staffEmployment, [staffId]: { ...employment, wageEurPerMonth: undefined } } };

  const recalibrated = recalibrateStaffEmploymentWages(stripped);
  assert.equal(typeof recalibrated.staffEmployment[staffId].wageEurPerMonth, "number");
  assert.ok(recalibrated.staffEmployment[staffId].wageEurPerMonth! > 0);

  const again = recalibrateStaffEmploymentWages(recalibrated);
  assert.equal(again, recalibrated);
});

test("(9) a career's staff fields survive a JSON save/reload round-trip byte-for-byte", () => {
  const state = freshTumba("staff-career-9");
  const roundTripped = JSON.parse(JSON.stringify(state)) as CareerState;
  assert.deepEqual(roundTripped.staffRoster, state.staffRoster);
  assert.deepEqual(roundTripped.staffEmployment, state.staffEmployment);
  assert.deepEqual(roundTripped.staffClubHistory, state.staffClubHistory);
});
