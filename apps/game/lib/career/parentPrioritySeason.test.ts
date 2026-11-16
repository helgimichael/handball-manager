// Club Identity C4 integration: A-team priority inside the real atomic season transition
// (production fast-match competition pipeline, QA-only Division 2 pool squads).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { simulateMatch, seedFromString } from "@handball-manager/game-simulation";
import { continuityTestCareer } from "../competition/transition/gameContinuity.fixtures";
import { applyKnockoutDecider, progressCompetitions } from "../competition/season";
import { checkSeasonComplete } from "./calendar";
import { computeSquadDerivedClubStrength } from "./squadDerivedClubStrength";
import { getCareerClubSquad } from "./careerWorld";
import { addDays } from "./dateUtils";
import { attemptSeasonTransition } from "./seasonTransition";
import { migrateCareerState } from "./saveMigration";
import { clubCompetitionId } from "./competitionMembership";
import { competitionClubIds } from "../competition/tables";
import { SWEDISH_2026_RULES as official } from "../competition/transition/sweden2026";
import type { CareerState } from "./types";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v) ?? "null").digest("hex");
const asSaved = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
function playSeason(s: CareerState): CareerState {
  const deadline = `${Number(s.seasonId.slice(0, 4)) + 1}-06-25`;
  for (let d = 0; d < 440 && !s.seasonComplete; d++) {
    const date = s.gameDate;
    const st = (id: string) => computeSquadDerivedClubStrength(id, getCareerClubSquad(s, id), s.gameplayRatings[id] ?? []);
    for (const f of s.fixtures.filter((f) => f.date === date && !s.results[f.id])) {
      const sc = simulateMatch({ fixtureId: f.id, seed: seedFromString(`${s.saveSeed}:${f.id}`), homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeStrength: st(f.homeClubId), awayStrength: st(f.awayClubId) });
      s = { ...s, results: { ...s.results, [f.id]: applyKnockoutDecider(s, f, sc, st) } };
    }
    s = checkSeasonComplete(progressCompetitions(s, date));
    if (s.gameDate > deadline) break;
    if (!s.seasonComplete) s = { ...s, gameDate: addDays(date, 1) };
  }
  assert.equal(s.seasonComplete, true);
  return s;
}

// Seed with a real conflict at 2026/27: Lunds HS Lejon wins promotion into Division 1 Södra in the transition in which H43 Lund is relegated there.
let completed: CareerState | undefined;
const season = () => (completed ??= playSeason(migrateCareerState(continuityTestCareer("club-identity-soak-new"))));
const LEJON = "se_div2_team_1576008", H43 = "swe2-h43lund";

test("a B-team that earns promotion into its A-team's division stays down; the next eligible club goes up; sizes and history intact", () => {
  const s = season();
  const before = hash(s);
  const t = attemptSeasonTransition(s);
  assert.equal(t.status, "APPLIED", JSON.stringify(t.blockers));
  assert.equal(hash(s), before, "the input is never mutated");
  const next = t.state;
  const moves = next.seasonHistory!.at(-1)!.outcome!.parentPriority!;
  const lejon = moves.find((m) => m.clubId === LEJON)!;
  assert.ok(lejon, "the conflict was resolved by A-team priority");
  assert.equal(clubCompetitionId(next, H43), lejon.from, "the A-team keeps its division");
  assert.equal(clubCompetitionId(next, LEJON), lejon.to);
  assert.ok(lejon.to.startsWith("se_division2_"));
  assert.equal(clubCompetitionId(next, lejon.replacement!.clubId), lejon.from, "the next eligible club took the place");
  const outcome = next.seasonHistory!.at(-1)!.outcome!;
  assert.ok(!outcome.promoted.includes(LEJON) && outcome.promoted.includes(lejon.replacement!.clubId));
  for (const l of official.leagues) assert.equal(competitionClubIds(next, l.id).length, l.size, l.id);
  // History: the completed season is archived byte-identically.
  assert.equal(hash(next.seasonHistory!.at(-1)!.results), hash(s.results));
  assert.equal(hash(next.seasonHistory!.at(-1)!.fixtures), hash(s.fixtures));
  // Save/load after rollover; retry is idempotent.
  const loaded = migrateCareerState(asSaved(next));
  assert.deepEqual(loaded.competitionMembership, next.competitionMembership);
  assert.equal(attemptSeasonTransition(loaded, JSON.parse(t.receipt!.requestKey)).status, "ALREADY_APPLIED");
  assert.notEqual(attemptSeasonTransition(loaded).status, "APPLIED", "a second default rollover cannot apply twice");
});

test("no valid allocation blocks the whole rollover atomically and reports the exact conflict", () => {
  const s = season();
  // QA-only agreement starting with the coming season: the manager's club becomes the B-team of a Division 2 club,
  // so A-team priority would push it below Division 2 -- a club the manager leads cannot leave the simulated pyramid.
  const parent = Object.keys(s.worldSquads).find((id) => clubCompetitionId(s, id) === "se_division2_n")!;
  const qa = { ...s, clubPartnerships: { ...s.clubPartnerships, "qa-impossible": { id: "qa-impossible", type: "AFFILIATED_B_TEAM" as const, clubAId: parent, clubBId: s.playerClubId, status: "ACTIVE" as const, startDate: "2027-07-01", endDate: null, permanent: true, monthlyCostEur: 0, lastBilledDate: null } } };
  const before = hash(qa);
  const t = attemptSeasonTransition(qa);
  assert.equal(t.status, "BLOCKED");
  assert.ok(t.blockers.some((b) => b.code === "MANAGER_DESTINATION_MISSING" || b.code.startsWith("PARENT_PRIORITY_")), JSON.stringify(t.blockers.map((b) => b.code)));
  assert.equal(t.state, qa, "the original state is returned");
  assert.equal(hash(qa), before, "nothing was written");
});
