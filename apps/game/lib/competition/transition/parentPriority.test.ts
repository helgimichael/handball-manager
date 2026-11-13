// Club Identity C4: "the A-team always has priority, the B-team must adapt" (owner decision).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLUBS } from "../../game-data";
import type { CareerState } from "../../career/types";
import type { ClubPartnership } from "../../career/clubPartnerships";
import { clubCompetitionId } from "../../career/competitionMembership";
import { DIVISION_3_ID, resolveParentPriority, restrictingParents, type ParentPriorityInput } from "./parentPriority";
import { gameContinuityRules, continuityRegionAllows, continuityRegionalLeague } from "./gameContinuity";
import type { EligibilityDecision, RankGroup } from "./types";

const rules = gameContinuityRules("2026/27", "parent-priority-test");
const ALLSV = "swe-2", NORRA = "se_division1_norra", SODRA = "se_division1_sodra";
const D2 = (d: string) => `se_division2_${d}`;
const LEJON = "se_div2_team_1576008", H43 = "swe2-h43lund";
const LIF_BLA = "se_div2_team_1575788", LINDESBERG = "se_club_lif_lindesberg";
const TUMBA_HK = "se_div2_team_1582988", TUMBA = "swe2-tumba";
const SHOF = "se_club_hk_s_hof", SAVEHOF = "se_club_ik_savehof", IFK_KRI = "se_club_ifk_kristianstad", IF_KRI = "se_club_if_kristianstad";

const row = (clubAId: string, clubBId: string, over: Partial<ClubPartnership> = {}): ClubPartnership => ({
  id: `bteam-${clubAId}-${clubBId}`, type: "AFFILIATED_B_TEAM", clubAId, clubBId, status: "ACTIVE", startDate: "2026-07-01", endDate: null, permanent: true, monthlyCostEur: 0, lastBilledDate: null, ...over,
});

type World = { overrides?: Record<string, string>; partnerships: ClubPartnership[]; pools?: Record<string, string[]>; final: Record<string, string>; eligibility?: EligibilityDecision[]; rankings?: Record<string, string[]> };

function setup(w: World) {
  const state = {
    seasonId: "2026/27", gameDate: "2027-05-30",
    competitionMembership: w.overrides ?? {},
    clubPartnerships: Object.fromEntries(w.partnerships.map((p) => [p.id, p])),
    worldSquads: Object.fromEntries(CLUBS.map((c) => [c.id, [{ id: `p-${c.id}` }]])),
    swedishContinuity: { pools: { "2026/27": { seasonId: "2026/27", provenance: "GAME_CONTINUITY", excluded: [], districts: Object.fromEntries(Object.entries(w.pools ?? {}).map(([d, order]) => [d, { clubIds: order, rows: [], order, contests: [] }])) } } },
  } as unknown as CareerState;
  const current = (id: string) => clubCompetitionId(state, id);
  // Default sporting order of a modeled league: its current members in CLUBS order (a deterministic stand-in for a completed table).
  const members = (league: string) => CLUBS.filter((c) => current(c.id) === league).map((c) => c.id);
  const rankings = rules.leagues.map((l) => ({ competitionId: l.id, groups: (w.rankings?.[l.id] ?? members(l.id)).map((clubId, i): RankGroup => ({ ranks: [i + 1], clubIds: [clubId] })) }));
  const membership: Record<string, string> = {};
  for (const c of CLUBS) { const now = current(c.id); if (now && (rules.leagues.some((l) => l.id === now) || now.startsWith("se_division2_"))) membership[c.id] = now; }
  Object.assign(membership, w.final);
  const input: ParentPriorityInput = { state, rules, membership, current, rankings, eligibility: w.eligibility, regionalLeague: continuityRegionalLeague, regionAllows: continuityRegionAllows, date: "2027-05-30" };
  return { input, membership, state };
}
const sizes = (m: Record<string, string>) => Object.fromEntries(rules.leagues.map((l) => [l.id, Object.values(m).filter((c) => c === l.id).length]));
const div2s = () => CLUBS.filter((c) => c.competitionId === D2("s")).map((c) => c.id);
const div2o = () => CLUBS.filter((c) => c.competitionId === D2("o")).map((c) => c.id);
const sodra = () => CLUBS.filter((c) => c.competitionId === SODRA).map((c) => c.id);

test("B-team winning promotion: the A-team keeps its division, the B-team stays down, the next eligible club in the promotion order goes up", () => {
  const relegatedFromSodra = sodra().at(-1)!;
  const poolS = [LEJON, ...div2s().filter((id) => id !== LEJON)];
  const { input, membership } = setup({ partnerships: [row(H43, LEJON)], pools: { s: poolS }, final: { [H43]: SODRA, [LEJON]: SODRA, [relegatedFromSodra]: D2("s"), [sodra()[0]!]: ALLSV } });
  const r = resolveParentPriority(input);
  assert.deepEqual(r.blockers, []);
  assert.equal(r.membership[LEJON], D2("s"), "no promotion for the B-team");
  assert.equal(r.membership[H43], SODRA, "the A-team keeps its division");
  assert.equal(r.moves.length, 1);
  assert.equal(r.moves[0]!.replacement!.clubId, poolS[1], "rank 2 of the district order takes the place");
  assert.equal(r.membership[poolS[1]!], SODRA);
  assert.deepEqual(sizes(r.membership), sizes(membership), "league sizes unchanged");
  assert.deepEqual(input.membership, membership, "input never mutated");
  assert.deepEqual(resolveParentPriority(input), r, "deterministic");
});

test("next eligible is also ineligible: evidence, the cooperation rule and the A-team rule all skip a candidate; the order continues", () => {
  const poolS = [LEJON, ...div2s().filter((id) => id !== LEJON)];
  const [, second, third, fourth] = poolS;
  // second: ineligible by evidence; third: a B-team whose own parent (LIF Lindesberg, Division 1) caps it at tier 4.
  const { input } = setup({
    partnerships: [row(H43, LEJON), row(LINDESBERG, third!)], pools: { s: poolS },
    final: { [H43]: SODRA, [LEJON]: SODRA, [sodra().at(-1)!]: D2("s") },
    eligibility: [{ clubId: second!, targetFamilyId: "se-men-tier-3", seasonId: "2026/27", status: "INELIGIBLE", evidence: "licence refused" }],
  });
  const r = resolveParentPriority(input);
  assert.deepEqual(r.blockers, []);
  assert.equal(r.moves[0]!.replacement!.clubId, fourth);
});

test("A-team relegated into its B-team's division: the B-team moves down (Division 2 -> non-simulated Division 3)", () => {
  const { input, membership } = setup({ partnerships: [row(LINDESBERG, LIF_BLA)], final: { [LINDESBERG]: D2("m") } });
  const r = resolveParentPriority(input);
  assert.deepEqual(r.blockers, []);
  assert.equal(r.membership[LIF_BLA], DIVISION_3_ID);
  assert.equal(r.moves[0]!.replacement, undefined, "Division 2 pools have no fixed size: nothing to backfill");
  assert.deepEqual(sizes(r.membership), sizes(membership));
});

test("A-team relegated into its B-team's Division 1 group: the B-team drops to its district, the next eligible district club takes the group place (region respected)", () => {
  const poolO = div2o().filter((id) => id !== TUMBA_HK);
  const { input, membership } = setup({ overrides: { [TUMBA_HK]: NORRA }, partnerships: [row(TUMBA, TUMBA_HK)], pools: { o: [TUMBA_HK, ...poolO] }, final: { [TUMBA]: NORRA, [TUMBA_HK]: NORRA } });
  const r = resolveParentPriority(input);
  assert.deepEqual(r.blockers, []);
  assert.equal(r.membership[TUMBA_HK], D2("o"));
  assert.equal(r.membership[TUMBA], NORRA);
  assert.equal(r.moves[0]!.replacement!.to, NORRA);
  assert.ok(continuityRegionAllows(r.moves[0]!.replacement!.clubId, NORRA));
  assert.deepEqual(sizes(r.membership), sizes(membership));
});

test("multiple B-teams in one division and two parent clubs in the same division resolve together, worst-ranked first, sizes intact", () => {
  const poolS = div2s(), poolV = CLUBS.filter((c) => c.competitionId === D2("v")).map((c) => c.id);
  const { input, membership } = setup({ partnerships: [row(SAVEHOF, SHOF), row(IFK_KRI, IF_KRI)], pools: { s: poolS, v: poolV }, final: { [SAVEHOF]: SODRA, [IFK_KRI]: SODRA } });
  const r = resolveParentPriority(input);
  assert.deepEqual(r.blockers, []);
  assert.equal(r.moves.length, 2);
  assert.ok(!r.membership[SHOF]!.startsWith("se_division1") && !r.membership[IF_KRI]!.startsWith("se_division1"));
  assert.equal(new Set(r.moves.map((m) => m.replacement!.clubId)).size, 2, "two different replacements");
  assert.deepEqual(sizes(r.membership), sizes(membership));
  for (const c of [SHOF, IF_KRI]) assert.ok(r.membership[c]!.startsWith("se_division2_"));
});

test("cascading displacement through three divisions terminates deterministically (Division 1 -> Division 2 -> Division 3)", () => {
  const poolO = div2o().filter((id) => id !== TUMBA_HK);
  const grandchild = poolO.at(-1)!; // a Division 2 Öst club bound to Tumba HK
  const { input, membership } = setup({ overrides: { [TUMBA_HK]: NORRA }, partnerships: [row(TUMBA, TUMBA_HK), row(TUMBA_HK, grandchild)], pools: { o: [TUMBA_HK, ...poolO] }, final: { [TUMBA]: NORRA, [TUMBA_HK]: NORRA } });
  const r = resolveParentPriority(input);
  assert.deepEqual(r.blockers, []);
  assert.deepEqual(r.moves.map((m) => [m.clubId, m.to]), [[TUMBA_HK, D2("o")], [grandchild, DIVISION_3_ID]]);
  assert.deepEqual(sizes(r.membership), sizes(membership));
  assert.deepEqual(resolveParentPriority(input), r);
});

test("only restricting relationships count: terminated, expired and plain development partnerships impose nothing", () => {
  const nextStart = "2027-07-01";
  assert.deepEqual(restrictingParents({ a: row(LINDESBERG, LIF_BLA, { status: "TERMINATED", endDate: "2027-01-15", permanent: false }) }, LIF_BLA, nextStart), []);
  assert.deepEqual(restrictingParents({ a: row(LINDESBERG, LIF_BLA, { status: "EXPIRED", endDate: "2026-12-31", permanent: false }) }, LIF_BLA, nextStart), []);
  assert.deepEqual(restrictingParents({ a: row(LINDESBERG, LIF_BLA, { type: "DEVELOPMENT_PARTNERSHIP", permanent: false, endDate: "2028-06-30" }) }, LIF_BLA, nextStart), []);
  assert.deepEqual(restrictingParents({ a: row(LINDESBERG, LIF_BLA, { type: "DEVELOPMENT_PARTNERSHIP", permanent: false, endDate: "2028-06-30", competitionRestriction: { origin: "CAREER_AGREEMENT", evidence: "x", effectiveFrom: "2026-07-01", effectiveUntil: null, applyParentDivisionRule: true } }) }, LIF_BLA, nextStart), [LINDESBERG]);
  assert.deepEqual(restrictingParents({ a: row(LINDESBERG, LIF_BLA, { startDate: "2027-07-01" }) }, LIF_BLA, nextStart), [LINDESBERG], "an agreement starting with the coming season governs its allocation");
  const terminated = setup({ partnerships: [row(LINDESBERG, LIF_BLA, { status: "TERMINATED", endDate: "2027-03-01", permanent: false })], final: { [LINDESBERG]: D2("m") } });
  assert.deepEqual(resolveParentPriority(terminated.input).moves, [], "a terminated cooperation no longer forces the club down");
});

test("no valid allocation is reported exactly and nothing is half-applied", () => {
  // Empty district order: nobody can take the B-team's Division 1 place.
  const none = setup({ overrides: { [TUMBA_HK]: NORRA }, partnerships: [row(TUMBA, TUMBA_HK)], pools: { o: [] }, final: { [TUMBA]: NORRA, [TUMBA_HK]: NORRA } });
  const r = resolveParentPriority(none.input);
  assert.equal(r.blockers[0]!.code, "PARENT_PRIORITY_NO_ELIGIBLE_REPLACEMENT");
  assert.equal(r.blockers[0]!.status, "BLOCKED");
  assert.deepEqual(none.input.membership, none.membership);
});
