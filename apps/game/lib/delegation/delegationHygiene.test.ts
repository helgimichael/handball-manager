// HM-M6.0: state hygiene -- bounded delegation proposals and activity log,
// never-reused ids, opponent-scouting cleanup, bounded scouting history and
// the two scouting fixes (foreign leagues, current league membership).
// Acceptance criteria A1-A6 and A8-A11 of M6.0-STATE-HYGIENE-SCOPE.md
// (A7, the club change, lives in lib/manager/m7dCareer.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import type { CareerState } from "../career/types";
import type { CareerEvent } from "../career/careerEvents";
import { ensureClubFinances } from "../economy/ledger";
import { compactCareerHistory, PROPOSAL_KEEP_DAYS } from "../career/historyCompaction";
import { addDays } from "../career/dateUtils";
import { migrateCareerState } from "../career/saveMigration";
import { getRecruitmentCandidates } from "../career/recruitment";
import { createBroadScoutingAssignment, createScoutingAssignment, getClubScouts, type ScoutingAssignment, type ScoutReport } from "../career/scouting";
import { assignmentNation, runDiscoveryCycle, type ScoutDiscovery } from "../career/scoutDiscovery";
import { processDay } from "../career/dailyTick";
import { getNextPlayerFixture } from "../career/calendar";
import { CLUBS } from "../game-data";
import { opponentScoutingCandidates, progressOpponentScouting, requestOpponentScouting, setScoutingDelegate } from "../scouting/opponentScouting";
import type { ResolvedStaffMember } from "../staff/types";
import { approveProposal, delegationOf, LOG_KEEP_PER_AREA, log, nextProposalId, progressDelegation, propose, setDelegation, trimActivityLog } from "./delegation";
import type { DelegationLogEntry, DelegationProposal } from "./types";

const SKOVDE = "se_club_ifk_skovde_hk";
const LIGAN = "se_handbollsligan_herr";
const ALLSVENSKAN = "swe-2";
const COMPS = [LIGAN, ALLSVENSKAN];
let cached: string | undefined;
function career(): CareerState {
  if (!cached) {
    const squads = Object.assign({}, ...COMPS.map((c) => snapshotWorldSquads(c)));
    const ratings = Object.assign({}, ...COMPS.map((c) => snapshotGameplayRatings(c)));
    const staff = Object.assign({}, ...COMPS.map((c) => snapshotAllClubsStaff(c)));
    cached = JSON.stringify(ensureClubFinances(createNewCareerState("m6-0-hygiene", SKOVDE, squads, undefined, ratings, staff), "2026-07-01"));
  }
  return JSON.parse(cached) as CareerState;
}
const collect = () => { const events: CareerEvent[] = []; return { events, emit: (e: CareerEvent) => { events.push(e); } }; };
const staffHere = (s: CareerState) => s.staffRoster[s.playerClubId]![0]!;
/** The club's scout -- a member is given the scout role when the club employs none. */
function withScout(s: CareerState): { state: CareerState; scout: ResolvedStaffMember } {
  const existing = getClubScouts(s)[0];
  if (existing) return { state: s, scout: existing };
  const roster = s.staffRoster[s.playerClubId]!;
  const scout = { ...roster[0]!, roles: [...roster[0]!.roles, "SCOUT" as const] };
  return { state: { ...s, staffRoster: { ...s.staffRoster, [s.playerClubId]: [scout, ...roster.slice(1)] } }, scout };
}
const externalPlayers = (s: CareerState, n: number) => Object.entries(s.worldSquads).filter(([c]) => c !== s.playerClubId).flatMap(([, p]) => p).slice(0, n).map((p) => p.id);

function proposal(id: string, over: Partial<DelegationProposal>): DelegationProposal {
  return { id, area: "PLAYER_RECRUITMENT", staffId: "x", createdOn: "2027-01-01", expiresOn: "2027-01-15", title: id, reason: "", consequence: "", action: { kind: "SHORTLIST", playerId: id }, status: "PENDING", ...over };
}

// --- A1-A3: proposals are bounded without losing anything still in use ---

test("A1/A2: rollover keeps pending and recent proposals and drops old decided ones", () => {
  const today = "2027-06-01";
  const old = addDays(today, -(PROPOSAL_KEEP_DAYS + 1));
  const recent = addDays(today, -(PROPOSAL_KEEP_DAYS - 1));
  const s0 = career();
  const proposals = Object.fromEntries([
    proposal("pending-ancient", { createdOn: "2026-01-01", expiresOn: "2026-01-15" }),
    proposal("approved-old", { status: "APPROVED", decidedOn: old }),
    proposal("rejected-old", { status: "REJECTED", decidedOn: old }),
    proposal("expired-old", { status: "EXPIRED", expiresOn: old }),
    proposal("approved-recent", { status: "APPROVED", decidedOn: recent }),
    proposal("training-this-week", { area: "TRAINING_SCHEDULE", status: "APPROVED", decidedOn: today, action: { kind: "TRAINING_PLAN", plan: { clubId: s0.playerClubId, week: { weekStart: today } } as never } }),
  ].map((p) => [p.id, p]));
  const state: CareerState = { ...s0, delegation: { settings: {}, proposals, log: [] } };
  const out = compactCareerHistory(state, today);
  assert.deepEqual(Object.keys(out.delegation!.proposals).sort(), ["approved-recent", "pending-ancient", "training-this-week"]);
  assert.deepEqual(compactCareerHistory(out, today), out, "idempotent");
});

test("A3: a declined proposal is not raised again within the cooldown across a rollover", () => {
  const s0 = career();
  const staffId = staffHere(s0).id;
  const [playerId] = externalPlayers(s0, 1);
  const { emit } = collect();
  const raise = (s: CareerState, date: string) => propose(s, date, emit, { area: "PLAYER_RECRUITMENT", staffId, title: "Bevaka", reason: "r", consequence: "c", action: { kind: "SHORTLIST", playerId: playerId! } });
  let s = raise(s0, "2027-05-20");
  const id = Object.keys(delegationOf(s).proposals)[0]!;
  s = { ...s, gameDate: "2027-05-21" };
  s = { ...s, delegation: { ...delegationOf(s), proposals: { ...delegationOf(s).proposals, [id]: { ...delegationOf(s).proposals[id]!, status: "REJECTED", decidedOn: "2027-05-21" } } } };
  s = compactCareerHistory(s, "2027-06-01");
  assert.equal(raise(s, "2027-06-07"), s, "still cooling down after the rollover");
  assert.notEqual(raise(s, "2027-06-25"), s, "raised again once the cooldown has passed");
});

// --- A4: ids are never reused ---

test("A4: proposal ids stay unique after pruning, reloading, a club change and repeats on the same day", () => {
  const s0 = career();
  const staffId = staffHere(s0).id;
  const players = externalPlayers(s0, 8);
  const { events, emit } = collect();
  const day = "2027-06-07";
  const raise = (s: CareerState, playerId: string) => propose(s, day, emit, { area: "PLAYER_RECRUITMENT", staffId, title: playerId, reason: "r", consequence: "c", action: { kind: "SHORTLIST", playerId } });
  const seen = new Set<string>();
  const record = (s: CareerState) => { for (const id of Object.keys(delegationOf(s).proposals)) seen.add(id); };
  let s = s0;
  for (const p of players.slice(0, 3)) s = raise(s, p);
  record(s);
  assert.equal(seen.size, 3, "three proposals the same day get three ids");
  // Emitted events go into the log like in the daily tick.
  s = { ...s, careerEvents: [...s.careerEvents, ...events] };
  // Old decided proposals are pruned at a rollover the same day (dates only move forward).
  const old = Object.fromEntries(Object.entries(delegationOf(s).proposals).map(([k, p]) => [k, { ...p, status: "REJECTED" as const, decidedOn: "2026-01-01" }]));
  s = compactCareerHistory({ ...s, delegation: { ...delegationOf(s), proposals: old } }, day);
  assert.equal(Object.keys(delegationOf(s).proposals).length, 0, "everything decided long ago was pruned");
  // Reload and raise again the same day: the pruned ids (whose reports are still in the inbox) are not reused.
  s = migrateCareerState(JSON.parse(JSON.stringify(s)));
  s = raise(s, players[3]!);
  const fresh = Object.keys(delegationOf(s).proposals);
  assert.equal(fresh.length, 1);
  assert.ok(!seen.has(fresh[0]!), `${fresh[0]} must be new`);
  seen.add(fresh[0]!);
  // A club change empties the proposals but not the event log.
  s = { ...s, careerEvents: [...s.careerEvents, ...events.slice(3)], delegation: undefined };
  const after = nextProposalId(s, "PLAYER_RECRUITMENT", day);
  assert.ok(!seen.has(after), `${after} must be new after the club change`);
  // Existing ids keep their format.
  assert.match(after, /^proposal:PLAYER_RECRUITMENT:2027-06-07:\d+$/);
});

test("A4: scouting assignment ids are not reused once older records are compacted", () => {
  const setup = withScout(career());
  let s = setup.state;
  const scout = setup.scout;
  const [target] = externalPlayers(s, 1);
  const owner = Object.entries(s.worldSquads).find(([, ps]) => ps.some((p) => p.id === target))![0];
  const first = createScoutingAssignment(s, scout.id, target!, owner, s.gameDate);
  assert.ok(first.ok);
  s = first.state;
  const id1 = first.assignment!.id;
  // A report and discoveries of an assignment id that no longer has an assignment still reserve it.
  const { [id1]: _gone, ...rest } = s.scoutingAssignments;
  void _gone;
  s = { ...s, scoutingAssignments: rest, scoutReports: { ...s.scoutReports, [`report-${id1}`]: { id: `report-${id1}`, assignmentId: id1 } as ScoutReport } };
  const again = createScoutingAssignment(s, scout.id, target!, owner, s.gameDate);
  assert.ok(again.ok);
  assert.notEqual(again.assignment!.id, id1);
});

// --- A5: the bounded activity log ---

test("A5: the activity log keeps the newest 40 per area, so training never pushes other areas out", () => {
  const entry = (area: DelegationLogEntry["area"], i: number): DelegationLogEntry => ({ date: `2027-01-${String((i % 28) + 1).padStart(2, "0")}`, area, staffId: "x", staffName: "x", action: `${area}-${i}`, reason: "", result: "DONE" });
  const entries = [...Array.from({ length: 5 }, (_, i) => entry("CONTRACT_RENEWALS", i)), ...Array.from({ length: 200 }, (_, i) => entry("TRAINING_SCHEDULE", i))];
  const kept = trimActivityLog(entries);
  assert.equal(kept.filter((e) => e.area === "CONTRACT_RENEWALS").length, 5);
  assert.equal(kept.filter((e) => e.area === "TRAINING_SCHEDULE").length, LOG_KEEP_PER_AREA);
  assert.equal(kept.at(-1)!.action, "TRAINING_SCHEDULE-199", "newest kept, order preserved");
  // Through the real log() as well.
  let s: CareerState = { ...career(), delegation: { settings: {}, proposals: {}, log: entries } };
  s = log(s, { date: "2027-02-01", area: "STAFF_HIRING", staffId: "x", action: "hire", reason: "", result: "PROPOSED" });
  assert.equal(delegationOf(s).log.filter((e) => e.area === "CONTRACT_RENEWALS").length, 5);
  assert.equal(delegationOf(s).log.at(-1)!.action, "hire");
});

test("A5: expired and failed proposals are written to the activity log", () => {
  let s = career();
  const staffId = staffHere(s).id;
  const lapsed = proposal("lapsed", { staffId, createdOn: "2026-06-01", expiresOn: "2026-06-15" });
  const broken = proposal("broken", { staffId, area: "SCOUTING_ASSIGNMENTS", createdOn: s.gameDate, expiresOn: addDays(s.gameDate, 14), action: { kind: "START_SCOUTING", scoutStaffId: "nobody", position: "LW" } });
  s = { ...s, delegation: { settings: {}, proposals: { lapsed, broken }, log: [] } };
  s = approveProposal(s, "broken");
  assert.equal(delegationOf(s).proposals.broken!.status, "FAILED");
  s = progressDelegation(s, "2026-07-02", () => undefined); // a Thursday: expiry only
  assert.equal(delegationOf(s).proposals.lapsed!.status, "EXPIRED");
  const results = delegationOf(s).log.map((e) => `${e.action}:${e.result}`);
  assert.ok(results.includes("broken:FAILED"), results.join(","));
  assert.ok(results.includes("lapsed:EXPIRED"), results.join(","));
  // Withdrawal on revert is unchanged.
  const pending = proposal("pending", { staffId, createdOn: s.gameDate, expiresOn: addDays(s.gameDate, 14) });
  s = setDelegation({ ...s, delegation: { ...delegationOf(s), proposals: { ...delegationOf(s).proposals, pending } } }, "PLAYER_RECRUITMENT", "MANAGER");
  assert.equal(delegationOf(s).proposals.pending!.status, "WITHDRAWN");
});

// --- A6: opponent scouting closes work that can no longer be done ---

test("A6: requests for departed analysts and played matches are dropped; a departed delegate is cleared and reported once", () => {
  let s = career();
  const fixture = getNextPlayerFixture(s)!;
  const analyst = opponentScoutingCandidates(s)[0]!;
  s = setScoutingDelegate(requestOpponentScouting(s, fixture.id, analyst.id), analyst.id);
  const played = s.fixtures.find((f) => f.id !== fixture.id)!;
  s = { ...s, opponentScouting: { ...s.opponentScouting!, requests: { ...s.opponentScouting!.requests, [played.id]: { fixtureId: played.id, staffId: analyst.id, requestedOn: s.gameDate, readyOn: addDays(s.gameDate, 30) } } }, results: { ...s.results, [played.id]: {} as never } };
  // The analyst leaves the club.
  const gone: CareerState = { ...s, staffRoster: { ...s.staffRoster, [s.playerClubId]: s.staffRoster[s.playerClubId]!.filter((m) => m.id !== analyst.id) } };
  const r = progressOpponentScouting(gone, gone.gameDate, fixture);
  assert.equal(r.delegateLeft, analyst.id);
  assert.equal(r.state.opponentScouting!.delegateStaffId, undefined);
  assert.ok(!("delegateStaffId" in r.state.opponentScouting!), "no undefined key left in the save");
  assert.deepEqual(Object.keys(r.state.opponentScouting!.requests), []);
  // Nothing more to report the next day.
  assert.equal(progressOpponentScouting(r.state, addDays(gone.gameDate, 1), fixture).delegateLeft, undefined);
  // The daily tick turns it into exactly one inbox message.
  const day = processDay(gone, addDays(gone.gameDate, 1));
  const notes = day.state.careerEvents.filter((e) => e.id.includes("opponent-analysis-unassigned"));
  assert.equal(notes.length, 1);
  // A valid request and delegate are untouched.
  const kept = progressOpponentScouting(s, s.gameDate, fixture);
  assert.equal(kept.delegateLeft, undefined);
  assert.equal(kept.state.opponentScouting!.delegateStaffId, analyst.id);
});

// --- A8: bounded scouting history with identical knowledge and candidates ---

test("A8: scouting compaction keeps the newest report and discovery per player, knowledge and candidates unchanged", () => {
  const s0 = career();
  const today = "2028-06-01", ancient = "2026-08-01", older = "2026-07-15", recent = "2028-03-01";
  const [p1, p2, p3, p4, p5] = externalPlayers(s0, 5) as [string, string, string, string, string];
  const asg = (id: string, over: Partial<ScoutingAssignment>): ScoutingAssignment => ({ id, scoutStaffId: "s", assignmentType: "PLAYER", targetPlayerId: "", targetClubId: "", targetCompetitionId: "", targetNation: "", targetPosition: "", targetMaxAgeYears: null, startDate: older, endDate: older, status: "COMPLETED", reportId: null, cyclesCompleted: 0, maxCycles: 1, discoveredPlayerIds: [], ...over });
  const rep = (id: string, assignmentId: string, playerId: string, date: string): ScoutReport => ({ id, assignmentId, scoutStaffId: "s", targetPlayerId: playerId, createdDate: date, knowledgePctAtReport: 50, scoutSuitability: 10 });
  const dis = (id: string, assignmentId: string, playerId: string, date: string) => ({ id, assignmentId, playerId, discoveredDate: date }) as unknown as ScoutDiscovery;
  const state: CareerState = {
    ...s0,
    playerKnowledge: { ...s0.playerKnowledge, [p1]: 70, [p2]: 55, [p3]: 40 },
    scoutingAssignments: Object.fromEntries([
      asg("a-p1-old", { targetPlayerId: p1, endDate: older }),
      asg("a-p1-new", { targetPlayerId: p1, endDate: ancient }),
      asg("a-broad-old", { assignmentType: "POSITION", targetPosition: "LW", endDate: older }),
      asg("a-p4-cancelled", { targetPlayerId: p4, status: "CANCELLED", endDate: older }),
      asg("a-live", { targetPlayerId: p5, status: "IN_PROGRESS", endDate: today }),
    ].map((a) => [a.id, a])),
    scoutReports: Object.fromEntries([rep("r1-old", "a-p1-old", p1, older), rep("r1-new", "a-p1-new", p1, ancient), rep("r2", "a-p1-old", p2, recent)].map((r) => [r.id, r])),
    scoutDiscoveries: Object.fromEntries([dis("d3-old", "a-broad-old", p3, older), dis("d3-new", "a-broad-old", p3, ancient)].map((d) => [d.id, d])),
  };
  const out = compactCareerHistory(state, today);
  assert.deepEqual(Object.keys(out.scoutReports).sort(), ["r1-new", "r2"]);
  assert.deepEqual(Object.keys(out.scoutDiscoveries).sort(), ["d3-new"]);
  assert.deepEqual(Object.keys(out.scoutingAssignments).sort(), ["a-broad-old", "a-live", "a-p1-new", "a-p1-old", "a-p4-cancelled"]);
  assert.deepEqual(out.playerKnowledge, state.playerKnowledge, "knowledge untouched");
  const ids = (s: CareerState) => getRecruitmentCandidates(s).map((c) => c.playerId).sort();
  assert.deepEqual(ids(out), ids(state), "the Recruitment Centre lists the same players");
  // With every reference gone, an old finished assignment is dropped.
  const lean = compactCareerHistory({ ...state, scoutReports: {}, scoutDiscoveries: {} }, today);
  assert.ok(!lean.scoutingAssignments["a-broad-old"], "an unreferenced old broad assignment is gone");
  assert.ok(lean.scoutingAssignments["a-p4-cancelled"], "the newest assignment on a player stays (it makes him a candidate)");
  assert.deepEqual(compactCareerHistory(out, today), out, "idempotent");
});

// --- A9: a foreign league is international work ---

function withGeography(member: ResolvedStaffMember, regional: number, international: number): ResolvedStaffMember {
  const attrs = { ...member.profile.attributes } as Record<string, { value: number } | undefined>;
  attrs.REGIONAL_KNOWLEDGE = { ...(attrs.REGIONAL_KNOWLEDGE ?? {}), value: regional };
  attrs.INTERNATIONAL_KNOWLEDGE = { ...(attrs.INTERNATIONAL_KNOWLEDGE ?? {}), value: international };
  return { ...member, profile: { ...member.profile, attributes: attrs as never } };
}

test("A9: a foreign league assignment uses international knowledge; a Swedish league keeps regional", () => {
  assert.equal(assignmentNation({ assignmentType: "COMPETITION", targetNation: "", targetCompetitionId: "den-1" }), "DEN");
  assert.equal(assignmentNation({ assignmentType: "COMPETITION", targetNation: "", targetCompetitionId: ALLSVENSKAN }), "SWE");
  assert.equal(assignmentNation({ assignmentType: "REGION", targetNation: "NOR", targetCompetitionId: "" }), "NOR");
  assert.equal(assignmentNation({ assignmentType: "POSITION", targetNation: "", targetCompetitionId: "" }), undefined);
  const { state: s0, scout } = withScout(career());
  const cycle = (regional: number, international: number, competition: string) => {
    const s: CareerState = { ...s0, staffRoster: { ...s0.staffRoster, [s0.playerClubId]: s0.staffRoster[s0.playerClubId]!.map((m) => (m.id === scout.id ? withGeography(m, regional, international) : m)) } };
    const r = createBroadScoutingAssignment(s, scout.id, "COMPETITION", { targetCompetitionId: competition }, s.gameDate);
    assert.ok(r.ok, r.errors.join(" "));
    return r.assignment!.endDate;
  };
  // Abroad, only the international attribute matters ...
  assert.equal(cycle(1, 20, "den-1"), cycle(20, 20, "den-1"));
  assert.notEqual(cycle(20, 1, "den-1"), cycle(20, 20, "den-1"), "a weak international network slows league scouting abroad");
  // ... at home, only the regional one.
  assert.equal(cycle(20, 1, ALLSVENSKAN), cycle(20, 20, ALLSVENSKAN));
});

// --- A10: league pools follow promotion and relegation ---

test("A10: a promoted club is scouted in its new league and no longer in its old one", () => {
  const s0 = career();
  const promoted = CLUBS.find((c) => c.competitionId === ALLSVENSKAN && c.id !== s0.playerClubId && (s0.worldSquads[c.id]?.length ?? 0) > 0)!;
  const { state: s1, scout } = withScout(s0);
  const s: CareerState = { ...s1, competitionMembership: { ...(s1.competitionMembership ?? {}), [promoted.id]: LIGAN } };
  const othersIn = (competition: string) => CLUBS.filter((c) => c.id !== promoted.id && (s.competitionMembership?.[c.id] ?? c.competitionId) === competition).flatMap((c) => (s.worldSquads[c.id] ?? []).map((p) => p.id));
  const run = (competition: string) => {
    const a: ScoutingAssignment = { id: `t-${competition}`, scoutStaffId: scout.id, assignmentType: "COMPETITION", targetPlayerId: "", targetClubId: "", targetCompetitionId: competition, targetNation: "", targetPosition: "", targetMaxAgeYears: null, startDate: s.gameDate, endDate: s.gameDate, status: "IN_PROGRESS", reportId: null, cyclesCompleted: 0, maxCycles: 3, discoveredPlayerIds: othersIn(competition) };
    return runDiscoveryCycle(s, a, s.gameDate).discoveries;
  };
  const promotedIds = new Set(s.worldSquads[promoted.id]!.map((p) => p.id));
  const inNew = run(LIGAN);
  assert.ok(inNew.length > 0, "the promoted club's players are discoverable in their new league");
  assert.ok(inNew.every((d) => promotedIds.has(d.playerId)));
  assert.equal(run(ALLSVENSKAN).filter((d) => promotedIds.has(d.playerId)).length, 0, "not in the league they left");
});

// --- A11: old saves load and compaction is idempotent on a real state ---

test("A11: a pre-M6.0 save (old-format ids and log) loads, advances and compacts idempotently", () => {
  let s = career();
  const staffId = staffHere(s).id;
  // An older save: proposals and log written before M6.0, with the old id scheme.
  const day = addDays(s.gameDate, -1);
  const legacy = proposal(`proposal:PLAYER_RECRUITMENT:${day}:0`, { staffId, status: "REJECTED", createdOn: day, decidedOn: s.gameDate });
  s = { ...s, delegation: { settings: { PLAYER_RECRUITMENT: { mode: "ADVISE" } }, proposals: { [legacy.id]: legacy }, log: [{ date: s.gameDate, area: "PLAYER_RECRUITMENT", staffId, staffName: "x", action: "a", reason: "r", result: "REJECTED" }] } };
  const loaded = migrateCareerState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(loaded.delegation, s.delegation, "loading changes nothing");
  let next = loaded;
  for (let i = 1; i <= 10; i++) next = processDay(next, addDays(loaded.gameDate, i)).state;
  const once = compactCareerHistory(next, next.gameDate);
  assert.deepEqual(compactCareerHistory(once, once.gameDate), once, "idempotent on a played state");
  assert.ok(delegationOf(once).proposals[legacy.id], "a recent decided proposal survives");
});
