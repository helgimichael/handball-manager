// Arena Nights 231 -- REC-01 C Scout Desk models: one pipeline, ranked shortlist, need cards, range-based sorts,
// previews that run the real rules on a copy (never mutate), and no hidden ability anywhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { getCareerClubSquad, getExternalCandidateClubs } from "../career/careerWorld";
import { getClubScouts } from "../career/scouting";
import type { RecruitmentCandidate } from "../career/recruitment";
import type { CareerState } from "../career/types";
import type { Recommendation } from "./recommendations";
import { assignmentGroups, assignmentSuggestions, broadScope, coverageTiles, needCards, pipelineCounts, previewBroadAssignment, previewPlayerAssignment, rankedShortlist, scoutCapacity, shiftPriority, sortDiscoveries } from "./scoutDesk";

let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2"];
    const s = createNewCareerState("scout-desk", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
    base = JSON.stringify(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}

const c = (id: string, extra: Partial<RecruitmentCandidate> = {}) => ({ playerId: id, firstName: "A", lastName: id, position: "V6", knowledgePct: 50, priority: "NORMAL", shortlisted: false, activeAssignment: false, hasCompletedReport: false, recruitmentStatus: "DISCOVERED", ...extra }) as RecruitmentCandidate;

test("pipeline counts and the ranked shortlist", () => {
  const list = [c("a"), c("b", { shortlisted: true, priority: "LOW", recruitmentStatus: "SHORTLISTED" }), c("c", { shortlisted: true, priority: "TOP", recruitmentStatus: "PRIORITIZED", hasCompletedReport: true }), c("d", { activeAssignment: true, recruitmentStatus: "SCOUTING" }), c("e", { shortlisted: true, knowledgePct: 90, recruitmentStatus: "SHORTLISTED" }), c("f", { shortlisted: true, knowledgePct: 20, recruitmentStatus: "SHORTLISTED" })];
  assert.deepEqual(pipelineCounts(list), { discovered: 1, scouting: 1, reports: 1, shortlist: 4 });
  assert.deepEqual(rankedShortlist(list).map((x) => x.playerId), ["c", "e", "f", "b"]);
  assert.equal(shiftPriority("NORMAL", -1), "HIGH");
  assert.equal(shiftPriority("TOP", -1), null);
  assert.equal(shiftPriority("LOW", 1), null);
});

test("need cards: thin positions only, HIGH first, candidates of that position", () => {
  const rec = (id: string, position: string) => ({ player: { id, position } }) as unknown as Recommendation;
  const cards = needCards([rec("1", "MV"), rec("2", "V6"), rec("3", "MV"), rec("4", "MV"), rec("5", "MV")], [{ position: "V6", level: "MEDIUM", projectedDepth: 1 }, { position: "MV", level: "HIGH", projectedDepth: 0 }, { position: "M9", level: "NONE", projectedDepth: 3 }], 3);
  assert.deepEqual(cards.map((x) => x.position), ["MV", "V6"]);
  assert.deepEqual(cards[0]!.candidates.map((r) => r.player.id), ["1", "3", "4"]);
  assert.equal(cards[0]!.more, 1);
});

test("discovery sorts read only ranges and knowledge", () => {
  const rows = [
    { name: "a", knowledgePct: 30, abilityRange: { min: 2, max: 4 }, potentialRange: null, needLevel: "NONE" as const, discoveredDate: "2026-08-01" },
    { name: "b", knowledgePct: 80, abilityRange: { min: 2, max: 2 }, potentialRange: null, needLevel: "HIGH" as const, discoveredDate: "2026-08-03" },
    { name: "c", knowledgePct: 50, abilityRange: { min: 4, max: 5 }, potentialRange: null, needLevel: "MEDIUM" as const, discoveredDate: "2026-08-02" },
  ];
  assert.deepEqual(sortDiscoveries(rows, "KNOWN").map((r) => r.name), ["b", "c", "a"]);
  assert.deepEqual(sortDiscoveries(rows, "ABILITY").map((r) => r.name), ["c", "a", "b"]);
  assert.deepEqual(sortDiscoveries(rows, "NEED").map((r) => r.name), ["b", "c", "a"]);
  assert.deepEqual(sortDiscoveries(rows, "NEWEST").map((r) => r.name), ["b", "c", "a"]);
});

test("typeahead covers every assignment shape", () => {
  const s = career();
  assert.deepEqual(assignmentSuggestions(s, "u21").map((t) => t.kind), ["AGE_BAND"]);
  assert.ok(assignmentSuggestions(s, "MV").some((t) => t.kind === "POSITION"));
  const club = getExternalCandidateClubs(s).find((x) => getCareerClubSquad(s, x.id).length > 0)!;
  assert.ok(assignmentSuggestions(s, club.name, 20).some((t) => t.kind === "CLUB" && t.clubId === club.id));
  const p = getCareerClubSquad(s, club.id)[0]!;
  assert.ok(assignmentSuggestions(s, `${p.firstName} ${p.lastName}`, 20).some((t) => t.kind === "PLAYER" && t.playerId === p.id));
  assert.deepEqual(broadScope({ kind: "AGE_BAND", key: "x", label: "U21", detail: "", maxAge: 21 }), { type: "AGE_BAND", scope: { targetMaxAgeYears: 21 } });
});

test("previews run the real rules on a copy and leave the career untouched", () => {
  const s = career();
  const scout = getClubScouts(s)[0];
  const before = JSON.stringify(s);
  const club = getExternalCandidateClubs(s).find((x) => getCareerClubSquad(s, x.id).length > 0)!;
  const p = getCareerClubSquad(s, club.id)[0]!;
  if (scout) {
    const pre = previewPlayerAssignment(s, scout.id, p.id, club.id);
    assert.equal(pre.ok, true);
    if (pre.ok) { assert.ok(pre.days > 0); assert.ok(pre.knowledgeAfter > pre.knowledgeNow); }
    const broad = previewBroadAssignment(s, scout.id, "POSITION", { targetPosition: "MV" });
    assert.equal(broad.ok, true);
    assert.deepEqual(scoutCapacity(s).map((x) => x.id).sort(), getClubScouts(s).map((x) => x.id).sort());
  }
  const none = previewPlayerAssignment(s, "nobody", p.id, club.id);
  assert.equal(none.ok, false);
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(assignmentGroups(s), { ready: [], running: [], sweeps: [] });
  assert.ok(coverageTiles(s).length > 0);
});

test("the scout desk never reads hidden ability", () => {
  for (const f of ["./scoutDesk.ts", "../../components/scouting/ScoutDesk.tsx", "../../components/scouting/RecruitPeek.tsx", "../../components/scouting/ScoutaSheet.tsx", "../../components/scouting/ScoutingCentre.tsx"]) {
    const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
    assert.doesNotMatch(src, /currentAbility|potentialAbility|\.ca\b|\.pa\b/, f);
  }
});
