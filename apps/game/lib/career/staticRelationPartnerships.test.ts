// Club Identity C4: club relationships (D7, D8, D9; ROADMAP C6 acceptance; invariant I7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CLUBS, getClub, clubRelationForSeason, clubRelationLabel, clubTeamType, parentClubOf, hasStaticCooperationRelation, TUMBA_CLUB_ID } from "../game-data";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { PERMANENT_B_TEAM_PAIRS, isClubExclusivelyPartnered, renewPartnership, progressPartnershipExpiry, terminatePartnership, type ClubPartnership } from "./clubPartnerships";
import { reconcileStaticRelationPartnerships, seedStaticRelationPartnerships, staticCooperationRelations, staticRelationPartnershipId, STATIC_RELATION_EVIDENCE_PREFIX, type StaticRelation } from "./staticRelationPartnerships";
import { cooperationEligibility } from "../competition/transition/cooperationEligibility";
import type { CareerState } from "./types";

const DIV2_LINKS: Record<string, string> = {
  se_div2_team_1585295: "se_club_lugi_hf", se_div2_team_1582183: "se_club_hf_karlskrona", se_div2_team_1585596: "se_club_ystads_if_hf",
  se_div2_team_1582988: "swe2-tumba", se_div2_team_1578886: "swe2-vasterasirsta", se_div2_team_1575715: "swe2-varberg",
  se_div2_team_1578982: "se_club_ov_helsingborg", se_div2_team_1579219: "se_club_hk_malmo", se_div2_team_1575788: "se_club_lif_lindesberg",
  se_div2_team_1583015: "swe2-ystad2", se_div2_team_1576008: "swe2-h43lund",
};
const asSaved = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const newCareer = (): CareerState => migrateCareerState(createNewCareerState("club-identity-c4", TUMBA_CLUB_ID));
/** A v8 career as it was saved before C4: marker absent, only the five permanent rows. */
function legacyCareer(): CareerState {
  const s = asSaved(newCareer());
  delete s.clubWorldBaseline;
  s.clubPartnerships = Object.fromEntries(Object.entries(s.clubPartnerships).filter(([, p]) => PERMANENT_B_TEAM_PAIRS.some((x) => x.clubAId === p.clubAId && x.clubBId === p.clubBId)));
  return migrateCareerState(s);
}

test("L9 guard: the cooperation rule source is byte-identical to the pre-Club-Identity baseline", () => {
  const src = readFileSync(new URL("../competition/transition/cooperationEligibility.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(src).digest("hex"), "7b1e45122120994f5471279bb731d61e24fbb8741489eee20347009e439d7e3d");
  assert.equal(PERMANENT_B_TEAM_PAIRS.length, 5, "the canonical five are unchanged (MS §6.2)");
});

test("static relations: 16 cooperation teams (5 existing + 11 Division 2), distinct kinds, never interchangeable", () => {
  const coop = staticCooperationRelations();
  assert.equal(coop.length, 16);
  for (const [child, parent] of Object.entries(DIV2_LINKS)) {
    assert.equal(parentClubOf(child), parent, child);
    assert.ok(hasStaticCooperationRelation(child));
  }
  for (const p of PERMANENT_B_TEAM_PAIRS) assert.equal(parentClubOf(p.clubBId), p.clubAId, p.clubBId);
  // D7 HK Cliff: own identity, Hammarby U under the Cliff licence, still selectable.
  const cliff = getClub("se_club_hk_cliff")!;
  assert.equal(cliff.playable, true);
  assert.equal(cliff.name, "HK Cliff");
  assert.equal(clubRelationForSeason("se_club_hk_cliff")?.relation, "U_TEAM_UNDER_PARTNER_LICENCE");
  assert.equal(clubTeamType("se_club_hk_cliff"), "U_TEAM");
  assert.equal(clubRelationLabel("se_club_hk_cliff"), "Hammarby U · HK Cliffs licens");
  // D8 IF Kristianstad: partial partner association, the existing B-team row is kept.
  assert.equal(clubRelationForSeason("se_club_if_kristianstad")?.relationConfidence, "PARTIAL");
  assert.equal(clubTeamType("se_club_if_kristianstad"), "PARTNER_ASSOCIATION");
  assert.equal(clubRelationForSeason("se_div2_team_1575715")?.relationConfidence, "MAJORITY", "HK Varberg 09");
  assert.equal(clubRelationForSeason("se_div2_team_1582183")?.relation, "SAME_CLUB_SECOND_TEAM", "HF Karlskrona U");
  // Informational and foreign relations are not cooperations.
  assert.equal(clubRelationForSeason("se_div2_team_1578270")?.relation, "YOUTH_LINK");
  assert.equal(parentClubOf("se_div2_team_1578270"), undefined);
  assert.equal(hasStaticCooperationRelation("se_div2_team_1578270"), false);
  assert.equal(clubTeamType("int-veszprem-academy"), "ACADEMY");
  assert.equal(hasStaticCooperationRelation("int-veszprem-academy"), false);
  // Independent clubs, and no automatic merge: ids and squads stay separate.
  assert.equal(clubTeamType(TUMBA_CLUB_ID), "FIRST_TEAM");
  for (const c of CLUBS) for (const r of c.relations ?? []) { assert.ok(getClub(r.parentClubId), `${c.id} parent resolves`); assert.notEqual(r.parentClubId, c.id); assert.ok(r.evidence.length > 10); }
});

test("new career: the 11 relations are agreements from career start; the five permanent rows are untouched", () => {
  const s = newCareer();
  for (const [child, parent] of Object.entries(DIV2_LINKS)) {
    const row = s.clubPartnerships[`bteam-${parent}-${child}`]!;
    assert.ok(row, child);
    assert.equal(row.type, "AFFILIATED_B_TEAM");
    assert.ok(row.startDate <= "2026-12-31");
    assert.ok(row.competitionRestriction?.evidence.startsWith(STATIC_RELATION_EVIDENCE_PREFIX));
  }
  for (const p of PERMANENT_B_TEAM_PAIRS) assert.equal(s.clubPartnerships[`bteam-${p.clubAId}-${p.clubBId}`]!.competitionRestriction, undefined, "existing rows keep their exact shape");
  assert.equal(Object.keys(s.clubPartnerships).length, 16);
});

test("D9 legacy career: rows appear on load but take effect at the NEXT season start; idempotent; save/load preserves them", () => {
  const before = legacyCareer();
  const lifBla = before.clubPartnerships["bteam-se_club_lif_lindesberg-se_div2_team_1575788"]!;
  assert.equal(lifBla.startDate, "2027-07-01");
  // In-progress 2026/27 (its own end-of-season transition included): HK Lif Blå may still be promoted to Division 1 (tier 3).
  assert.equal(cooperationEligibility(before, "se_div2_team_1575788", 3, "2027-05-30").eligible, true);
  // From 2027/28 the SHF cap applies: parent LIF Lindesberg is Division 1 (tier 3) -> highest eligible tier 4.
  const next = { ...before, seasonId: "2027/28", gameDate: "2028-05-30" };
  assert.equal(cooperationEligibility(next, "se_div2_team_1575788", 3, "2028-05-30").eligible, false);
  // Tumba HK below Allsvenskan parent IFK Tumba: may reach Division 1 but never the parent's tier.
  assert.equal(cooperationEligibility(next, "se_div2_team_1582988", 3, "2028-05-30").eligible, true);
  assert.equal(cooperationEligibility(next, "se_div2_team_1582988", 2, "2028-05-30").eligible, false);
  const again = migrateCareerState(asSaved(before));
  assert.deepEqual(asSaved(again.clubPartnerships), asSaved(before.clubPartnerships), "load twice = load once");
  // A later rollover/load never moves an existing row's start.
  const reloadedLater = migrateCareerState(asSaved({ ...before, seasonId: "2029/30" }));
  assert.equal(reloadedLater.clubPartnerships[lifBla.id]!.startDate, "2027-07-01");
});

test("linked teams are never development-partnership candidates; an existing development partnership runs out without renewal (D9-A1)", () => {
  const s = legacyCareer();
  for (const id of [...Object.keys(DIV2_LINKS), ...PERMANENT_B_TEAM_PAIRS.map((p) => p.clubBId)]) assert.equal(isClubExclusivelyPartnered(s, id), true, id);
  const dev: ClubPartnership = { id: "dev-x", type: "DEVELOPMENT_PARTNERSHIP", clubAId: "se_club_uppsala_hk", clubBId: "se_div2_team_1575788", status: "ACTIVE", startDate: "2026-08-01", endDate: "2027-08-01", permanent: false, monthlyCostEur: 1000, lastBilledDate: null };
  const withDev = { ...s, clubPartnerships: { ...s.clubPartnerships, [dev.id]: dev } };
  assert.equal(renewPartnership(withDev, dev.id, 12), withDev, "no renewal with a newly linked team");
  assert.equal(migrateCareerState(asSaved(withDev)).clubPartnerships[dev.id]!.endDate, "2027-08-01", "nothing is rewritten");
  const expired = progressPartnershipExpiry(withDev, "2027-08-01").state.clubPartnerships[dev.id]!;
  assert.equal(expired.status, "EXPIRED", "runs to its end date through the existing path");
  // Independent Division 1 clubs remain renewable partners.
  const free: ClubPartnership = { ...dev, id: "dev-y", clubBId: "se_club_taby_hbk" };
  const withFree = { ...s, clubPartnerships: { ...s.clubPartnerships, [free.id]: free } };
  assert.equal(renewPartnership(withFree, free.id, 12).clubPartnerships[free.id]!.endDate, "2028-08-01");
});

test("termination: a relation that ends in reality ends its agreement at the season boundary; history is kept and the cap lifts only after", () => {
  const s = newCareer();
  const ended: StaticRelation[] = staticCooperationRelations().map((r) => r.childClubId === "se_div2_team_1575788" ? { ...r, validTo: "2027/28" } : r);
  const reconciled = reconcileStaticRelationPartnerships(s, ended);
  const row = reconciled.clubPartnerships[staticRelationPartnershipId({ parentClubId: "se_club_lif_lindesberg", childClubId: "se_div2_team_1575788" })]!;
  assert.equal(row.endDate, "2028-06-30");
  assert.equal(row.permanent, false);
  assert.equal(reconcileStaticRelationPartnerships(reconciled, ended), reconciled, "idempotent");
  assert.equal(cooperationEligibility({ ...reconciled, seasonId: "2027/28" }, "se_div2_team_1575788", 3, "2028-05-30").eligible, false, "still capped in its last season");
  const afterExpiry = progressPartnershipExpiry(reconciled, "2028-06-30").state;
  assert.equal(afterExpiry.clubPartnerships[row.id]!.status, "EXPIRED", "historical row kept, not deleted");
  assert.equal(cooperationEligibility({ ...afterExpiry, seasonId: "2028/29" }, "se_div2_team_1575788", 3, "2029-05-30").eligible, true, "no effect on later seasons");
  // The five canonical rows are never ended by reconciliation, and an ended relation is not seeded into a career that starts later.
  const permanentEnded = staticCooperationRelations().map((r) => ({ ...r, validTo: "2026/27" }));
  const r2 = reconcileStaticRelationPartnerships(s, permanentEnded);
  for (const p of PERMANENT_B_TEAM_PAIRS) assert.equal(r2.clubPartnerships[`bteam-${p.clubAId}-${p.clubBId}`]!.endDate, null);
  const late = seedStaticRelationPartnerships({ ...s, seasonId: "2030/31", clubPartnerships: {} }, "NEXT_SEASON", undefined, permanentEnded);
  assert.deepEqual(late.clubPartnerships, {});
});

test("existing termination rule (SHF 9:5-7) still governs a seeded agreement terminated through the normal path", () => {
  const s = newCareer();
  const id = "bteam-swe2-tumba-se_div2_team_1582988";
  const terminable = { ...s, clubPartnerships: { ...s.clubPartnerships, [id]: { ...s.clubPartnerships[id]!, permanent: false } } };
  const late = terminatePartnership(terminable, id, "2027-01-15");
  assert.equal(late.clubPartnerships[id]!.status, "TERMINATED");
  assert.equal(cooperationEligibility(late, "se_div2_team_1582988", 2, "2027-05-30").eligible, false, "late termination keeps this season's restriction");
  assert.equal(cooperationEligibility({ ...late, seasonId: "2027/28" }, "se_div2_team_1582988", 2, "2028-05-30").eligible, true, "lifted from the next season");
});
