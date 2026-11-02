// HM-ALPHA3 release fix: staff dossier links encode the id; generated market
// free agents ("fa-staff:2026:ROLE:n") must still resolve after decoding.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureStaffMarket } from "./staffMarket";
import { resolveStaffProfile, staffIdFromRouteParam } from "./staffProfileRoute";

const SKOVDE = "se_club_ifk_skovde_hk";
const career = () => ensureStaffMarket(createNewCareerState("staff-route", SKOVDE, snapshotWorldSquads("se_handbollsligan_herr"), undefined, snapshotGameplayRatings("se_handbollsligan_herr"), snapshotAllClubsStaff("se_handbollsligan_herr")));

test("a market free agent's encoded route segment resolves to the free agent", () => {
  const state = career();
  const freeAgentId = Object.keys(state.staffMarket!.freeAgents).find((id) => id.includes(":"))!;
  assert.ok(freeAgentId, "generated free agents carry colons in their ids");
  const segment = encodeURIComponent(freeAgentId);
  assert.notEqual(segment, freeAgentId, "the link encodes the colons");
  assert.equal(resolveStaffProfile(state, segment).member, undefined, "the raw segment does not resolve (the defect)");
  const { member, isFreeAgent } = resolveStaffProfile(state, staffIdFromRouteParam(segment));
  assert.equal(member?.id, freeAgentId);
  assert.equal(isFreeAgent, true);
});

test("employed staff ids resolve unchanged, encoded or not", () => {
  const state = career();
  const employed = (state.staffRoster[SKOVDE] ?? [])[0]!;
  assert.ok(employed, "Skövde has real staff");
  assert.equal(staffIdFromRouteParam(employed.id), employed.id);
  assert.equal(resolveStaffProfile(state, staffIdFromRouteParam(encodeURIComponent(employed.id))).member?.id, employed.id);
  assert.equal(resolveStaffProfile(state, employed.id).isFreeAgent, false);
});

test("other encoded characters decode, and a malformed escape never throws", () => {
  for (const id of ["fa-staff:2026:HEAD_COACH:3", "person-åsa östlund", "a/b?c#d&e=f", "100%"]) assert.equal(staffIdFromRouteParam(encodeURIComponent(id)), id);
  assert.equal(staffIdFromRouteParam("broken%E0%A4%A"), "broken%E0%A4%A");
});
