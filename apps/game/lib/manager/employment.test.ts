// Career employment states & club access control: the state is derived from the career record, a
// manager without a club loses every club-internal destination and action, his former club keeps
// running as a CPU club, a new job restores full access to the new club, and saves are untouched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../career/worldCompetitions";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { competitionTable } from "../competition/tables";
import { clubCompetitionId } from "../career/competitionMembership";
import { continueCareerRhythm } from "../career/continueController";
import { playManagerFixtureLegacy } from "../career/legacy/matchday";
import { migrateCareerState } from "../career/saveMigration";
import { ensureBoard } from "../board/board";
import { cpuRecruiterClubIds } from "../career/cpuRecruitment";
import { getPlayerKnowledgePct, getClubKnowledgePct } from "../knowledge/knowledgeIntegration";
import { OWN_CLUB_KNOWLEDGE_PCT } from "../knowledge/types";
import { getCareerClubSquad } from "../career/careerWorld";
import { CAREER_NAV_ITEMS } from "../career/navigation";
import { CAREER_HUBS, hubTabs } from "../career/hubs";
import { availableHubHref, availableHubTabs, hubAvailable, isClubInternalPath, navItemAvailable, routeAccess } from "../career/clubAccess";
import { paletteResults } from "../career/commandPalette";
import { resolveContextualContinueAction } from "../career/contextualContinueAction";
import { activeClubVisualIdentity } from "../career/activeClubIdentity";
import { buildFrontPage } from "../career/frontPage";
import type { CareerState } from "../career/types";
import type { CareerEvent } from "../career/careerEvents";
import { acceptJobOffer } from "./changeClub";
import { activeClubId, assertClubAccess, canAccessClubInternals, ClubAccessError, employmentState, formerClubId, isEmployed } from "./employment";
import { dismissManager, eligibleClubs, ensureManagerCareer, managedClubId, managerCareerSummary, openOffers, resignFromClub } from "./managerCareer";

const TUMBA = "swe2-tumba";
let world: { squads: Parameters<typeof createNewCareerState>[2]; ratings: Parameters<typeof createNewCareerState>[4]; staff: Parameters<typeof createNewCareerState>[5] } | undefined;
function career(seed = "employment", clubId = TUMBA): CareerState {
  world ??= {
    squads: Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotWorldSquads(c))),
    ratings: Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotGameplayRatings(c))),
    staff: Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotAllClubsStaff(c))),
  };
  const s = createNewCareerState(seed, clubId, world.squads, undefined, world.ratings, world.staff);
  return ensureManagerCareer(ensureBoard(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)), s.gameDate));
}
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v) ?? "null").digest("hex");

/** Ordinary Continue presses; an employed manager plays his own matchday (quick legacy match keeps this fast). */
function continueUntil(s: CareerState, date: string): CareerState {
  for (let guard = 0; guard < 400 && s.gameDate < date; guard++) {
    const pending = s.careerEvents.filter((e) => e.requiresAction && !e.resolved);
    if (pending.length && isEmployed(s)) {
      if (pending.every((e) => e.type === "MATCHDAY_READY")) { s = playManagerFixtureLegacy(s).state; continue; }
      s = { ...s, careerEvents: s.careerEvents.map((e) => (e.requiresAction ? { ...e, resolved: true } : e)) };
      continue;
    }
    const r = continueCareerRhythm(s);
    s = r.state;
    if (r.stopReason === "ACTION_REQUIRED_PENDING" && !isEmployed(s)) s = { ...s, careerEvents: s.careerEvents.map((e) => (e.requiresAction && e.type !== "MANAGER_CAREER" ? { ...e, resolved: true } : e)) };
  }
  return s;
}

const CLUB_ROUTES = ["/career/squad", "/career/tactics", "/career/training", "/career/medical", "/career/contracts", "/career/compare?left=x",
  "/career/klubbhuset", "/career/club", "/career/club/partnerships", "/career/board", "/career/finance", "/career/staff", "/career/staff/recruitment",
  "/career/staff/s-1", "/career/recruitment", "/career/scouting", "/career/transfers", "/career/transfers/p-1", "/career/analysis/our-team",
  "/career/schedule", "/career/match-preview", "/career/match-day/f-1", "/career/match-2d"];
const PUBLIC_ROUTES = ["/career", "/career/inbox", "/career/calendar", "/career/players", "/career/squad/p-1", "/career/season", "/career/competitions",
  "/career/competitions/se-svenska-cupen-herr", "/career/statistics", "/career/clubs/swe2-tumba", "/career/match-report/f-1", "/career/fixtures/f-1",
  "/career/manager", "/career/manager?tab=jobs", "/career/history", "/career/media", "/career/settings"];

let employedCache: string | undefined;
/** One career a few weeks into the season (league games played), shared by the slower tests. */
function inSeason(): CareerState {
  employedCache ??= JSON.stringify(continueUntil(career("employment-season"), "2026-09-26"));
  return JSON.parse(employedCache) as CareerState;
}

// 1. Employed manager: full access to his own club, nothing changes for him.
test("an employed manager can access his own club: state, routes, hubs, actions", () => {
  const s = career();
  assert.equal(employmentState(s), "EMPLOYED");
  assert.equal(activeClubId(s), TUMBA);
  assert.equal(managedClubId(s), TUMBA, "the existing selector agrees");
  assert.equal(formerClubId(s), undefined);
  assert.ok(canAccessClubInternals(s, TUMBA));
  assert.ok(!canAccessClubInternals(s, "swe1-sävehof"), "never another club's internals");
  assert.equal(assertClubAccess(s), TUMBA);
  for (const r of [...CLUB_ROUTES, ...PUBLIC_ROUTES]) assert.equal(routeAccess(s, r).allowed, true, r);
  assert.equal(getPlayerKnowledgePct(s, getCareerClubSquad(s, TUMBA)[0]!.id, TUMBA), OWN_CLUB_KNOWLEDGE_PCT);
});

// 11. Existing employed navigation is unchanged.
test("employed navigation is exactly the existing hub rail, tabs and palette", () => {
  const s = career();
  for (const hub of CAREER_HUBS) {
    assert.ok(hubAvailable(s, hub), hub.id);
    assert.deepEqual(availableHubTabs(s, hub).map((t) => t.id), hubTabs(hub).map((t) => t.id), hub.id);
    assert.equal(availableHubHref(s, hub), hubTabs(hub)[0]!.href, `${hub.id} lands where it always did`);
  }
  for (const item of CAREER_NAV_ITEMS) assert.ok(navItemAvailable(s, item.id), item.id);
  const pages = paletteResults(s, "", 100).filter((i) => i.group === "Sidor");
  assert.ok(pages.some((p) => p.href === "/career/tactics") && pages.some((p) => p.href === "/career/finance"));
});

// 2. Resigning removes club access immediately.
test("resigning immediately removes club access (positive and negative checks)", () => {
  const before = inSeason();
  const own = before.playerClubId;
  const s = resignFromClub(before);
  assert.equal(employmentState(s), "UNEMPLOYED");
  assert.equal(activeClubId(s), undefined);
  assert.equal(managedClubId(s), undefined);
  assert.equal(formerClubId(s), own);
  assert.ok(!canAccessClubInternals(s, own), "a former employment grants nothing");
  assert.throws(() => assertClubAccess(s), ClubAccessError);
  for (const r of CLUB_ROUTES) {
    const a = routeAccess(s, r);
    assert.equal(a.allowed, false, `${r} is refused`);
    if (!a.allowed) assert.equal(a.formerClubId, own);
  }
  for (const r of PUBLIC_ROUTES) assert.equal(routeAccess(s, r).allowed, true, `${r} stays open`);
  // Hubs: Laget and Klubben have nothing without a club; Rekrytering keeps the player market; the rest stay.
  const avail = Object.fromEntries(CAREER_HUBS.map((h) => [h.id, hubAvailable(s, h)]));
  assert.deepEqual(avail, { idag: true, laget: false, klubben: false, rekrytering: true, tavling: true, karriar: true });
  assert.equal(availableHubHref(s, CAREER_HUBS.find((h) => h.id === "rekrytering")!), "/career/players");
  assert.deepEqual(availableHubTabs(s, CAREER_HUBS.find((h) => h.id === "karriar")!).map((t) => t.id), ["manager", "history", "media"]);
  assert.ok(!navItemAvailable(s, "klubbhuset"), "a merged destination follows its target");
  // Visual identity: clubless, never the former club.
  assert.equal(activeClubVisualIdentity(s).kind, "clubless");
  // Idag: the lead story is the job market, not the former club.
  assert.equal(buildFrontPage(s).lead.kind, "SEEKING_JOB");
  assert.equal(resolveContextualContinueAction(s).kind, "ADVANCE_DAY");
});

// 3. Dismissal produces the same unemployed state.
test("a dismissal produces the unemployed state, with offers on the job market", () => {
  const before = inSeason();
  const own = before.playerClubId;
  const events: CareerEvent[] = [];
  const s = dismissManager(before, before.gameDate, "Resultaten räckte inte.", (e) => events.push(e));
  assert.equal(employmentState(s), "UNEMPLOYED");
  assert.equal(s.managerCareer!.seekingJob!.reason, "DISMISSED");
  assert.equal(formerClubId(s), own);
  assert.ok(!canAccessClubInternals(s, own));
  assert.equal(routeAccess(s, "/career/tactics").allowed, false);
  assert.ok(openOffers(s).length >= 1, "a sacked manager is never stranded");
  assert.ok(events.some((e) => e.id.startsWith("MANAGER_CAREER") || e.type === "MANAGER_CAREER"));
  assert.equal(dismissManager(s, s.gameDate, "igen", () => undefined), s, "a second dismissal is a no-op");
});

// 4. The former club keeps operating under its own (CPU) organisation.
test("the former club stays in the world and is run like a CPU club", () => {
  const before = inSeason();
  const own = before.playerClubId;
  assert.ok(!cpuRecruiterClubIds(before).includes(own), "while he runs it, the CPU never recruits for his club");
  let s = resignFromClub(before);
  assert.ok(cpuRecruiterClubIds(s).includes(own), "without him, it recruits and decides contracts like every CPU club");
  const comp = clubCompetitionId(s, own)!;
  const squadBefore = getCareerClubSquad(s, own).length;
  const ownFixtures = s.fixtures.filter((f) => (f.homeClubId === own || f.awayClubId === own) && !s.results[f.id] && f.date <= "2026-10-31");
  assert.ok(ownFixtures.length > 0);
  s = continueUntil(s, "2026-11-01");
  for (const f of ownFixtures) assert.ok(s.results[f.id], `${f.id} was played`);
  assert.ok(competitionTable(s, comp).some((r) => r.clubId === own && r.played > 0), "still in the league table");
  assert.ok(getCareerClubSquad(s, own).length >= Math.min(squadBefore, 12), "still a playable squad");
  assert.ok((s.staffRoster[own] ?? []).length > 0, "still a staff");
  const cpuActivity = Object.values(s.cpuRecruitmentPlans ?? {}).some((p) => p.clubId === own) || (s.cpuDecisionLog ?? []).some((e) => JSON.stringify(e).includes(own));
  assert.ok(cpuActivity, "the club's own organisation evaluates its squad needs");
  assert.ok(Object.values(s.incomingOffers ?? {}).every((o) => o.status !== "OPEN" || o.openedOn < s.managerCareer!.seekingJob!.since), "no bid for its players waits on the manager");
});

// 5. Direct URLs (with query, hash, trailing slash) cannot bypass the guard.
test("direct URLs to the former club's workspace are refused in every spelling", () => {
  const s = resignFromClub(inSeason());
  for (const r of ["/career/tactics/", "/career/finance?section=ledger", "/career/club#rooms", "/career/staff/recruitment?role=SCOUT", "/career/squad/", "/career/match-day/abc?x=1"]) {
    assert.equal(routeAccess(s, r).allowed, false, r);
  }
  assert.ok(isClubInternalPath("/career/club/cpu-recruitment"));
  assert.ok(!isClubInternalPath("/career/clubs/swe2-tumba"), "another club's (or his former club's) public portrait is not internal");
  assert.ok(!isClubInternalPath("/career/squad/p-1"), "player profiles are public, seen from the outside");
});

// 6. Stale client state: nothing that outlives the resignation exposes the former club.
test("old club data does not leak through knowledge, palette or recents", () => {
  const before = inSeason();
  const own = before.playerClubId;
  const player = getCareerClubSquad(before, own)[0]!;
  assert.equal(getPlayerKnowledgePct(before, player.id, own), OWN_CLUB_KNOWLEDGE_PCT);
  const s = resignFromClub(before);
  const pct = getPlayerKnowledgePct(s, player.id, own);
  assert.ok(pct < OWN_CLUB_KNOWLEDGE_PCT && pct >= 85, `former players are remembered, not owned (${pct})`);
  assert.ok(getClubKnowledgePct(s, own) < OWN_CLUB_KNOWLEDGE_PCT);
  const offered = paletteResults(s, "", 100);
  for (const item of offered) assert.equal(routeAccess(s, item.href).allowed, true, `palette offers ${item.href}`);
  assert.ok(!offered.some((i) => i.href === "/career/tactics" || i.href === "/career/board"));
  assert.ok(offered.some((i) => i.href.startsWith("/career/manager")), "the job market is offered");
  // A player search still finds the former squad -- as public profiles.
  const found = paletteResults(s, `@${player.lastName}`, 20).filter((i) => i.group === "Spelare");
  for (const f of found) assert.equal(routeAccess(s, f.href).allowed, true);
});

// 7 + 8. A new job activates the new club; the history stays intact.
test("accepting a new job activates the new club and keeps the employment history", () => {
  const before = inSeason();
  const own = before.playerClubId;
  const events: CareerEvent[] = [];
  let s = dismissManager(before, before.gameDate, "Resultaten räckte inte.", (e) => events.push(e));
  const history = JSON.parse(JSON.stringify({ stints: s.managerCareer!.stints, milestones: s.managerCareer!.milestones, reputationLog: s.managerCareer!.reputationLog }));
  const offer = openOffers(s)[0]!;
  s = acceptJobOffer(s, offer.id);
  assert.equal(employmentState(s), "EMPLOYED");
  assert.equal(activeClubId(s), offer.clubId);
  assert.equal(s.playerClubId, offer.clubId);
  assert.ok(canAccessClubInternals(s, offer.clubId));
  assert.ok(!canAccessClubInternals(s, own), "the old club stays closed");
  for (const r of CLUB_ROUTES) assert.equal(routeAccess(s, r).allowed, true, r);
  for (const hub of CAREER_HUBS) assert.ok(hubAvailable(s, hub), hub.id);
  assert.equal(activeClubVisualIdentity(s).kind === "clubless", false);
  assert.ok(!cpuRecruiterClubIds(s).includes(offer.clubId), "the CPU no longer runs his new club");
  assert.ok(cpuRecruiterClubIds(s).includes(own), "the old club stays a CPU club");
  assert.equal(getPlayerKnowledgePct(s, getCareerClubSquad(s, offer.clubId)[0]!.id, offer.clubId), OWN_CLUB_KNOWLEDGE_PCT);
  const c = s.managerCareer!;
  assert.deepEqual(c.stints.slice(0, history.stints.length), history.stints, "earlier stints are untouched");
  assert.equal(c.stints.at(-1)!.clubId, offer.clubId);
  assert.ok(history.milestones.every((m: unknown) => c.milestones.some((x) => hash(x) === hash(m))), "milestones kept");
  assert.equal(managerCareerSummary(s).dismissals, 1);
  assert.equal(c.seekingJob, undefined);
});

// 9. Reload preserves the employment state (and the guard's verdicts).
test("saving and reloading preserves the employment state and access", () => {
  const unemployed = resignFromClub(inSeason());
  const loaded = migrateCareerState(JSON.parse(JSON.stringify(unemployed)));
  assert.equal(employmentState(loaded), "UNEMPLOYED");
  assert.equal(formerClubId(loaded), formerClubId(unemployed));
  for (const r of [...CLUB_ROUTES, ...PUBLIC_ROUTES]) assert.equal(routeAccess(loaded, r).allowed, routeAccess(unemployed, r).allowed, r);
  assert.equal(hash(loaded.managerCareer), hash(unemployed.managerCareer));
  const employed = migrateCareerState(JSON.parse(JSON.stringify(career())));
  assert.equal(employmentState(employed), "EMPLOYED");
});

// 10. Retirement: the game has no manager retirement; the state is never invented.
test("retirement follows the existing behaviour: there is no manager retirement, so the state never reads RETIRED", () => {
  const s = inSeason();
  const unemployed = resignFromClub(s);
  for (const x of [s, unemployed, continueUntil(unemployed, "2026-10-03")]) assert.notEqual(employmentState(x), "RETIRED");
  // Player retirement is a separate world system and never touches the manager's employment.
  assert.equal(employmentState({ ...s, playerClubId: s.playerClubId }), "EMPLOYED");
});

// 12. Existing saves stay loadable, with their employment resolved from what they carry.
test("older saves load and resolve their employment state without a migration", () => {
  const s = career();
  // A pre-M7D save has no managerCareer at all: employed by its club, as it always was.
  const legacy: Partial<CareerState> = { ...s };
  delete legacy.managerCareer;
  const old = migrateCareerState(JSON.parse(JSON.stringify(legacy)) as CareerState);
  assert.equal(employmentState(old), "EMPLOYED");
  assert.equal(activeClubId(old), s.playerClubId);
  // An early M7D unemployed save whose seekingJob has no clubId: the former club is the career anchor.
  const early = { ...s, managerCareer: { ...s.managerCareer!, seekingJob: { since: s.gameDate, reason: "DISMISSED" as const } } };
  const loaded = migrateCareerState(JSON.parse(JSON.stringify(early)));
  assert.equal(employmentState(loaded), "UNEMPLOYED");
  assert.equal(formerClubId(loaded), s.playerClubId);
  assert.equal(routeAccess(loaded, "/career/squad").allowed, false);
  // The save format is unchanged: no employment field is stored.
  assert.ok(!("employment" in loaded) && !("employmentState" in (loaded.managerCareer ?? {})));
  assert.ok(eligibleClubs(loaded).length > 0);
});
