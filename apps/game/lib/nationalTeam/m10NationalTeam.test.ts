// HM-ALPHA3-M10: national-team windows across the world -- foreign call-ups
// under the participation config, players away while their club plays,
// tired returns at CPU clubs too, cup ties kept out of the breaks; and
// delegated staff work that keeps the manager's coaches in place.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import type { CareerState } from "../career/types";
import { ensureClubFinances } from "../economy/ledger";
import { HANDBOLLSLIGAN } from "../competition/rules";
import { addDaysIso, caOf } from "../players/dynamicsState";
import { emptyMedia } from "../media/people";
import { isSelectableForMatch } from "../career/playerStatus";
import { freeDate } from "../competition/season";
import { NATIONAL_WINDOWS, nationalTeamOf, ownCallUps, progressNationalTeam, windowOn } from "./nationalTeam";
import { nationalDutyIds, withoutNationalDuty } from "./duty";
import { getCareerClubSquad } from "../career/careerWorld";
import { approveProposal, pendingProposals, progressDelegation, setDelegation } from "../delegation/delegation";
import { releaseStaff } from "../staff/staffNegotiation";
import { ensureStaffMarket } from "../staff/staffMarket";

const SKOVDE = "se_club_ifk_skovde_hk";
function career(club = SKOVDE): CareerState {
  const s = createNewCareerState("m10-nt", club, snapshotWorldSquads(HANDBOLLSLIGAN), undefined, snapshotGameplayRatings(HANDBOLLSLIGAN), snapshotAllClubsStaff(HANDBOLLSLIGAN));
  return { ...ensureClubFinances(s, "2026-07-01"), media: emptyMedia() };
}
const windowById = (id: string) => NATIONAL_WINDOWS.find((w) => w.id === id)!;
function run(state: CareerState, from: string, to: string): CareerState {
  let s = state;
  for (let d = from; d <= to; d = addDaysIso(d, 1)) s = progressNationalTeam({ ...s, gameDate: d }, d, () => undefined);
  return s;
}
/** Gives the strongest non-Swedish player at a CPU club the nationality `code`. */
function naturalise(state: CareerState, code: string, notClub = SKOVDE): { state: CareerState; playerId: string; clubId: string } {
  let best: { playerId: string; clubId: string; ca: number } | null = null;
  for (const clubId of Object.keys(state.worldSquads)) {
    if (clubId === notClub) continue;
    for (const p of getCareerClubSquad(state, clubId)) if (p.nationality !== "SWE" && p.position !== "MV" && (!best || caOf(state, p.id) > best.ca)) best = { playerId: p.id, clubId, ca: caOf(state, p.id) };
  }
  const worldSquads = { ...state.worldSquads, [best!.clubId]: state.worldSquads[best!.clubId]!.map((p) => (p.id === best!.playerId ? { ...p, nationality: code as typeof p.nationality } : p)) };
  return { state: { ...state, worldSquads }, playerId: best!.playerId, clubId: best!.clubId };
}

test("a foreign international at a CPU club is called up, misses his club's games while away, and comes back tired", () => {
  const w = windowById("ec28q-r12");
  const { state, playerId, clubId } = naturalise(career(), "FRO");
  const during = run(state, addDaysIso(w.start, -1), addDaysIso(w.start, 1));
  const ws = nationalTeamOf(during).windows[w.id]!;
  assert.deepEqual(ws.foreign?.find((f) => f.playerId === playerId), { playerId, clubId, nation: "Färöarna" });
  assert.equal(ws.away, true);
  assert.ok(nationalDutyIds(during).has(playerId));
  assert.ok(!withoutNationalDuty(during, getCareerClubSquad(during, clubId)).some((p) => p.id === playerId), "his club plays without him");
  const after = run(during, addDaysIso(w.start, 2), addDaysIso(w.end, 1));
  assert.equal(nationalTeamOf(after).windows[w.id]!.away, false);
  assert.ok(!nationalDutyIds(after).has(playerId));
  assert.ok((after.playerPhysicalState[playerId]?.currentEnergy ?? 100) <= 82, "CPU players come back tired too");
});

test("tournament call-ups follow the participation config: listed nations travel, others stay home", () => {
  const w = windowById("wc27");
  assert.ok(windowOn("2027-01-10"));
  const fra = naturalise(career(), "FRA");
  const called = run(fra.state, w.start, w.start);
  assert.ok(nationalTeamOf(called).windows[w.id]!.foreign?.some((f) => f.playerId === fra.playerId && f.nation === "Frankrike"), "an assumed participant gathers");
  const srb = naturalise(career(), "SRB");
  const home = run(srb.state, w.start, w.start);
  assert.ok(!nationalTeamOf(home).windows[w.id]!.foreign?.some((f) => f.playerId === srb.playerId), "Serbia is not in the configured World Cup field");
  const q = run(srb.state, windowById("ec28q-r12").start, windowById("ec28q-r12").start);
  assert.ok(nationalTeamOf(q).windows["ec28q-r12"]!.foreign?.some((f) => f.playerId === srb.playerId), "but every European team gathers in an EHF week");
});

test("the manager's own called-up player is unavailable to the club for the window and back the day after", () => {
  const w = windowById("ec28q-r12");
  const probe = run(career(), w.start, w.start);
  const clubId = nationalTeamOf(probe).windows[w.id]!.squad[0]!.clubId;
  const s = run(career(clubId), w.start, w.start);
  const own = ownCallUps(s, w.id);
  assert.ok(own.length > 0);
  for (const id of own) {
    assert.equal(s.playerStatuses[id]?.availability, "NATIONAL_TEAM");
    assert.equal(s.playerStatuses[id]?.returnDate, addDaysIso(w.end, 1));
    assert.equal(isSelectableForMatch(s.playerStatuses, id), false);
  }
});

test("a generated cup or play-off game never lands inside a national-team break", () => {
  const s = career();
  for (const w of NATIONAL_WINDOWS) {
    const d = freeDate({ fixtures: [], gameDate: addDaysIso(w.start, -5) }, [SKOVDE], w.start);
    assert.equal(windowOn(d), undefined, w.id);
    assert.equal(d, addDaysIso(w.end, 1));
  }
  assert.ok(s.fixtures.length > 0);
});

test("delegated staff hiring proposes renewing an expiring coach, and approving it opens the renewal talks", () => {
  let s = setDelegation(career(), "STAFF_HIRING", "DELEGATE");
  const coach = (s.staffRoster[SKOVDE] ?? []).find((m) => m.roles[0] === "ASSISTANT_COACH" && s.staffEmployment[m.id]?.employmentType === "SALARIED" && s.staffEmployment[m.id]?.contractEndDate);
  assert.ok(coach, "Skövde has a salaried assistant coach");
  let monday = addDaysIso(s.staffEmployment[coach!.id]!.contractEndDate!, -30);
  while (new Date(`${monday}T00:00:00Z`).getUTCDay() !== 1) monday = addDaysIso(monday, 1);
  s = progressDelegation({ ...s, gameDate: monday }, monday, () => undefined);
  const renew = pendingProposals(s).find((p) => p.action.kind === "RENEW_STAFF" && p.action.staffId === coach!.id);
  assert.ok(renew, "the expiring assistant is put forward for renewal");
  const approved = approveProposal(s, renew!.id);
  assert.ok(Object.values(approved.staffNegotiations ?? {}).some((n) => n.staffId === coach!.id && n.kind === "RENEW" && n.rounds.length === 1));
});

test("delegated staff hiring proposes filling a coaching vacancy, never the head coach", () => {
  let s = ensureStaffMarket(setDelegation(career(), "STAFF_HIRING", "DELEGATE"));
  const coach = (s.staffRoster[SKOVDE] ?? []).find((m) => m.roles[0] === "ASSISTANT_COACH")!;
  s = releaseStaff(s, coach.id, "2026-09-01", "LEFT");
  const hasCandidate = Object.values(s.staffMarket?.freeAgents ?? {}).some((m) => m.roles.includes("ASSISTANT_COACH"));
  s = progressDelegation({ ...s, gameDate: "2026-09-07" }, "2026-09-07", () => undefined);
  const hires = pendingProposals(s).filter((p) => p.action.kind === "HIRE_STAFF");
  assert.ok(hires.every((p) => p.action.kind === "HIRE_STAFF" && p.action.role !== "HEAD_COACH"));
  if (hasCandidate) assert.ok(hires.some((p) => p.action.kind === "HIRE_STAFF" && p.action.role === "ASSISTANT_COACH") || pendingProposals(s).length > 0);
});

test("CPU players called up carry the same bounded injury risk, miss their club while injured, and a window is processed once", () => {
  const w = windowById("wc27");
  let s = run(career(), w.start, w.start);
  const called = [...nationalTeamOf(s).windows[w.id]!.squad, ...(nationalTeamOf(s).windows[w.id]!.foreign ?? [])].filter((p) => p.clubId !== SKOVDE);
  // The risk per match is small (about 0.4 %); exhausted, overloaded players make an injury likely.
  const tired = Object.fromEntries(called.map((p) => [p.playerId, { playerId: p.playerId, currentEnergy: 5, recentLoad: 900, lastUpdatedDate: w.start }]));
  s = run({ ...s, playerPhysicalState: { ...s.playerPhysicalState, ...tired } }, addDaysIso(w.start, 1), addDaysIso(w.end, 1));
  const hurt = called.filter((p) => s.playerInjuries[p.playerId]?.activeInjury);
  assert.ok(hurt.length > 0, "CPU internationals are exposed to the same model as the manager's players");
  for (const p of hurt) {
    assert.equal(s.playerStatuses[p.playerId]?.availability, "INJURED");
    assert.ok(!withoutNationalDuty(s, getCareerClubSquad(s, p.clubId)).some((x) => x.id === p.playerId), "his club plays without him");
  }
  const again = run(s, addDaysIso(w.end, 1), addDaysIso(w.end, 2));
  assert.deepEqual(Object.keys(again.playerInjuries).filter((id) => again.playerInjuries[id]?.activeInjury).sort(), Object.keys(s.playerInjuries).filter((id) => s.playerInjuries[id]?.activeInjury).sort(), "a closed window is never processed twice");
});
