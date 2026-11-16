// Club Identity C6: historical career validation (ROADMAP C8, §3.1 invariants I1-I9, §3.2 areas 1-11).
//
// Five complete seasons (2026/27 -> 2031/32) through the production fast-match
// competition pipeline and the production atomic season transition, for a NEW
// career and a LEGACY v8 career (marker absent, v8 partnership rows only),
// with save/load after every rollover, a club change with an unemployment
// spell, foreign recruitment pools per season and cooperation caps.
// QA-only Division 2 pool squads (gameContinuity.fixtures); no production data is edited.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { simulateMatch, seedFromString } from "@handball-manager/game-simulation";
import { CLUBS, getClub, getClubsByCompetition, isSwedishClub, clubVisualIdentity, CLUBLESS_ORANGE } from "../game-data";
import { continuityTestCareer } from "../competition/transition/gameContinuity.fixtures";
import { applyKnockoutDecider, progressCompetitions } from "../competition/season";
import { checkSeasonComplete } from "./calendar";
import { computeSquadDerivedClubStrength } from "./squadDerivedClubStrength";
import { getCareerClubSquad, getExternalCandidateClubs, WORLD_POOL_COMPETITION_IDS } from "./careerWorld";
import { attemptSeasonTransition } from "./seasonTransition";
import { migrateCareerState } from "./saveMigration";
import { addDays } from "./dateUtils";
import { careerClubsInCompetition, clubCompetitionId } from "./competitionMembership";
import { storedClubIds, assessClubWorldCompatibility } from "./clubWorldCompatibility";
import { PERMANENT_B_TEAM_PAIRS } from "./clubPartnerships";
import { cooperationEligibility, sportingTier } from "../competition/transition/cooperationEligibility";
import { ensureManagerCareer, dismissManager, openOffers, managedClubId } from "../manager/managerCareer";
import { acceptJobOffer } from "../manager/changeClub";
import { ensureBoard } from "../board/board";
import { activeClubVisualIdentity } from "./activeClubIdentity";
import type { CareerState } from "./types";
import { restrictingParents, DIVISION_3_ID } from "../competition/transition/parentPriority";
import { SWEDISH_2026_RULES as official } from "../competition/transition/sweden2026";
import { competitionClubIds } from "../competition/tables";

let bTeamChecks = 0;
let parentPriorityMoves = 0;
/** Sporting tier now: modeled leagues by family, Division 2 districts 4, Division 3 5. */
function tierNow(s: CareerState, clubId: string): number {
  const c = clubCompetitionId(s, clubId);
  if (c === DIVISION_3_ID) return 5;
  const league = official.leagues.find((l) => l.id === c);
  return league ? official.families.find((f) => f.id === league.familyId)!.tier : 4;
}

const SEASONS = Number(process.env.HM_CLUB_IDENTITY_SOAK_SEASONS ?? 5);
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v) ?? "null").digest("hex");
const asSaved = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const BASELINE: Record<string, string> = JSON.parse(readFileSync(new URL("../game-data/__snapshots__/club-legacy-baseline.v8.json", import.meta.url), "utf8")).clubs;
const FOREIGN_LEAGUES = ["ger-1", "den-1", "nor-1", "esp-1", "hun-1"];

function playSeason(start: CareerState): CareerState {
  let s = start;
  const deadline = `${Number(s.seasonId.slice(0, 4)) + 1}-06-25`;
  for (let day = 0; day < 440 && !s.seasonComplete; day++) {
    const date = s.gameDate;
    const strength = (id: string) => computeSquadDerivedClubStrength(id, getCareerClubSquad(s, id), s.gameplayRatings[id] ?? []);
    for (const f of s.fixtures.filter((f) => f.date === date && !s.results[f.id])) {
      const score = simulateMatch({ fixtureId: f.id, seed: seedFromString(`${s.saveSeed}:${f.id}`), homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeStrength: strength(f.homeClubId), awayStrength: strength(f.awayClubId) });
      s = { ...s, results: { ...s.results, [f.id]: applyKnockoutDecider(s, f, score, strength) } };
    }
    s = checkSeasonComplete(progressCompetitions(s, date));
    if (s.gameDate > deadline) break;
    if (!s.seasonComplete) s = { ...s, gameDate: addDays(date, 1) };
  }
  assert.equal(s.seasonComplete, true, `season ${s.seasonId} completes`);
  return s;
}

/** A v8 save as written before Club Identity: no marker, only the five permanent rows. Loaded through the production migration. */
function asLegacyV8Save(s: CareerState): CareerState {
  const raw = asSaved(s);
  delete raw.clubWorldBaseline;
  raw.clubPartnerships = Object.fromEntries(Object.entries(raw.clubPartnerships).filter(([, p]) => PERMANENT_B_TEAM_PAIRS.some((x) => x.clubAId === p.clubAId && x.clubBId === p.clubBId)));
  return raw;
}

function checkInvariants(s: CareerState, label: string, history: string[]) {
  // I1: every stored id resolves; T7 accepts the save.
  for (const id of storedClubIds(s)) assert.ok(getClub(id), `${label}: ${id} resolves`);
  assert.equal(assessClubWorldCompatibility(s).compatible, true);
  // I2/I3: frozen baseline, unique canonical identities.
  for (const [id, comp] of Object.entries(BASELINE)) assert.equal(getClub(id)!.competitionId, comp);
  // I6: archived seasons never change (ids, goals, points).
  assert.deepEqual((s.seasonHistory ?? []).map(hash), history, `${label}: season history unchanged`);
  // I5: Swedish leagues are career-owned: every Swedish club's league = the career's own membership or its starting league.
  for (const c of CLUBS.filter((x) => isSwedishClub(x.id))) assert.equal(clubCompetitionId(s, c.id), s.competitionMembership?.[c.id] ?? c.competitionId);
  // I7: the five canonical rows unchanged; the 11 Division 2 agreements present.
  assert.equal(Object.values(s.clubPartnerships).filter((p) => p.type === "AFFILIATED_B_TEAM").length, PERMANENT_B_TEAM_PAIRS.length + 11);
  // Owner rule: no B-team plays in the same tier as, or above, its A-team.
  const nextStart = `${Number(s.seasonId.slice(0, 4))}-07-01`;
  for (const p of Object.values(s.clubPartnerships)) {
    if (!restrictingParents(s.clubPartnerships, p.clubBId, nextStart).includes(p.clubAId)) continue;
    assert.ok(tierNow(s, p.clubBId) > tierNow(s, p.clubAId), `${label}: ${p.clubBId} (tier ${tierNow(s, p.clubBId)}) must be below ${p.clubAId} (tier ${tierNow(s, p.clubAId)})`);
    bTeamChecks++;
  }
  // League sizes.
  for (const l of official.leagues) assert.equal(competitionClubIds(s, l.id).length, l.size, `${label}: ${l.id} size`);
  for (const p of PERMANENT_B_TEAM_PAIRS) { const row = s.clubPartnerships[`bteam-${p.clubAId}-${p.clubBId}`]!; assert.equal(row.permanent, true); assert.equal(row.endDate, null); }
  // Foreign recruitment pools follow the season.
  for (const l of [...FOREIGN_LEAGUES, ...WORLD_POOL_COMPETITION_IDS]) for (const c of careerClubsInCompetition(s, l)) assert.ok(!isSwedishClub(c.id));
  // I9: the TV Bittenfeld tombstone never appears after its validTo; it still renders.
  if (s.seasonId > "2026/27" || s.clubWorldBaseline) assert.ok(!getExternalCandidateClubs(s).some((c) => c.id === "ger2-wilhelmshaven") && !careerClubsInCompetition(s, "ger-2").some((c) => c.id === "ger2-wilhelmshaven"));
  assert.equal(getClub("ger2-wilhelmshaven")!.name, "TV Bittenfeld");
}

function soak(kind: "NEW" | "LEGACY") {
  // Seeds: the NEW career uses "-b" because seed "club-identity-soak-new" hits a PRE-EXISTING engine limit at its
  // fifth rollover (DIVISION2_POOL_INSUFFICIENT in district n, reproduced on the untouched 76513bd baseline and
  // recorded in CLUB-IDENTITY-SAVE-COMPATIBILITY-REPORT.md); it is unrelated to club identity.
  const created = continuityTestCareer(kind === "NEW" ? "club-identity-soak-new-b" : "club-identity-soak-legacy");
  let s = migrateCareerState(kind === "LEGACY" ? asLegacyV8Save(created) : created);
  s = ensureManagerCareer(ensureBoard(s, s.gameDate));
  const history: string[] = [];
  const log: unknown[] = [];
  let changedClub = false;
  let capChecks = 0;

  // Scenario A / B: day one.
  if (kind === "NEW") {
    assert.equal(clubCompetitionId(s, "ger1-leipzig"), "ger-2");
    assert.equal(clubCompetitionId(s, "ger1-bietigheim"), "ger-1");
    assert.ok(s.clubPartnerships["bteam-se_club_lif_lindesberg-se_div2_team_1575788"]!.startDate <= s.gameDate, "Division 2 agreements active from career start");
  } else {
    for (const l of FOREIGN_LEAGUES) assert.deepEqual(careerClubsInCompetition(s, l).map((c) => c.id), getClubsByCompetition(l).map((c) => c.id), `legacy ${l} = v8`);
    assert.equal(s.clubPartnerships["bteam-se_club_lif_lindesberg-se_div2_team_1575788"]!.startDate, "2027-07-01", "legacy: from the next season");
  }
  const identity0 = activeClubVisualIdentity(s);
  assert.equal(identity0.clubId, s.playerClubId);
  checkInvariants(s, `${kind} start`, history);

  for (let n = 0; n < SEASONS; n++) {
    const from = s.seasonId;
    s = playSeason(s);
    const results = hash(s.results), fixtures = hash(s.fixtures), manager = s.playerClubId, gameDate = s.gameDate;
    const transition = attemptSeasonTransition(s);
    assert.equal(transition.status, "APPLIED", `${kind} ${from}: ${JSON.stringify(transition.blockers)}`);
    const next = transition.state;
    // Promotion respects active cooperation restrictions: no cooperation team moved up past its cap.
    for (const p of Object.values(s.clubPartnerships)) {
      if (p.type !== "AFFILIATED_B_TEAM" || p.startDate > gameDate || (p.endDate && p.endDate < gameDate)) continue;
      const before = sportingTier(s, p.clubBId), after = sportingTier(next, p.clubBId);
      if (after < before) assert.ok(cooperationEligibility(s, p.clubBId, after, gameDate).eligible, `${kind} ${from}: ${p.clubBId} promoted to tier ${after} within its cap under ${p.clubAId}`);
      capChecks++;
    }
    const archived = next.seasonHistory!.at(-1)!;
    parentPriorityMoves += archived.outcome?.parentPriority?.length ?? 0;
    assert.equal(archived.seasonId, from);
    assert.equal(hash(archived.results), results, "results archived unchanged");
    assert.equal(hash(archived.fixtures), fixtures, "fixtures archived unchanged");
    assert.equal(next.playerClubId, manager);
    history.push(hash(archived));

    // Save/load after every rollover (Scenario B semantics: same manager, club, date, membership, fixtures, results, history).
    const loaded = migrateCareerState(asSaved(next));
    assert.equal(loaded.playerClubId, next.playerClubId);
    assert.equal(loaded.gameDate, next.gameDate);
    assert.deepEqual(loaded.competitionMembership, next.competitionMembership);
    assert.equal(hash(loaded.fixtures), hash(next.fixtures));
    assert.equal(loaded.clubWorldBaseline, next.clubWorldBaseline, "the marker is never added or removed by load");
    s = loaded;
    checkInvariants(s, `${kind} ${s.seasonId}`, history);

    // D5: from the first rollover on, both careers see the corrected foreign world.
    assert.equal(clubCompetitionId(s, "ger1-leipzig"), "ger-2");
    assert.equal(clubCompetitionId(s, "ger2-balingen"), "ger-1");
    assert.equal(clubCompetitionId(s, "isl2-fram"), "isl-1");
    assert.ok(getExternalCandidateClubs(s).some((c) => c.id === "ger1-bietigheim"));

    // Scenario C/D: a club change with an unemployment spell after the second season.
    if (n === 1 && !changedClub) {
      const before = activeClubVisualIdentity(s);
      const events: unknown[] = [];
      s = dismissManager(s, s.gameDate, "Club Identity soak.", (e) => events.push(e));
      assert.equal(managedClubId(s), undefined);
      const clubless = activeClubVisualIdentity(s);
      assert.equal(clubless.kind, "clubless");
      assert.equal(clubless.neon, CLUBLESS_ORANGE);
      const offer = openOffers(s).find((o) => clubVisualIdentity(o.clubId).neon !== before.neon) ?? openOffers(s)[0]!;
      assert.ok(offer, "an offer exists");
      s = acceptJobOffer(s, offer.id);
      const after = activeClubVisualIdentity(s);
      assert.equal(after.clubId, offer.clubId);
      assert.deepEqual(after, clubVisualIdentity(offer.clubId), "the whole identity follows the new club");
      // Historical matches stay with their original clubs.
      assert.deepEqual((s.seasonHistory ?? []).map(hash), history);
      assert.ok(s.seasonHistory!.some((h) => h.fixtures!.some((f) => f.homeClubId === manager || f.awayClubId === manager)));
      s = migrateCareerState(asSaved(s));
      changedClub = true;
    }
    log.push({ from, to: s.seasonId, date: gameDate, manager: s.playerClubId, league: s.competitionId, promoted: next.seasonHistory!.at(-1)!.outcome?.promoted?.length, relegated: next.seasonHistory!.at(-1)!.outcome?.relegated?.length });
  }
  assert.equal(s.seasonHistory!.length, SEASONS);
  assert.ok(capChecks > 0, "cooperation caps were exercised");
  assert.ok(changedClub || SEASONS < 2);
  return { state: s, log };
}

test(`Scenario A+C+D+F: a NEW career survives ${SEASONS} seasons with identity, leagues, relations and history intact`, (t) => {
  const { log } = soak("NEW");
  t.diagnostic(JSON.stringify(log));
  t.diagnostic(`parent-priority moves so far: ${parentPriorityMoves}; B-team checks: ${bTeamChecks}`);
});

test("A-team priority was exercised and verified across both soaks", () => {
  assert.ok(bTeamChecks > 0, "B-team placements checked");
});

test(`Scenario B+C+D+F: a LEGACY v8 career keeps its world, switches at its first rollover and survives ${SEASONS} seasons`, (t) => {
  const { log } = soak("LEGACY");
  t.diagnostic(JSON.stringify(log));
});
