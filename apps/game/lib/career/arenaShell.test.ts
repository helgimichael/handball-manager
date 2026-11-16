// Arena Nights C5.1 -- hub rail (ENT-07), command palette (ENT-08a) and Week Spine (ENT-07 C / DSH-01i / ENT-10)
// over real career state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createNewCareerState } from "./newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { ensureBoard } from "../board/board";
import { ensureManagerCareer } from "../manager/managerCareer";
import { getNextPlayerFixture } from "./calendar";
import { addDays } from "./dateUtils";
import { CAREER_NAV_ITEMS } from "./navigation";
import { CAREER_HUBS, MERGED_NAV_IDS, MOBILE_TAB_HUBS, UTILITY_NAV_IDS, hubHref, hubTabs, resolveHubRoute } from "./hubs";
import { PALETTE_ACTIONS, paletteResults } from "./commandPalette";
import { buildWeekSpine } from "./weekSpine";
import type { CareerState } from "./types";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2", "se_handbollsligan_herr"];
    const squads = Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c)));
    const ratings = Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c)));
    const staff = Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c)));
    const s = createNewCareerState("arena-shell", "swe2-tumba", squads, undefined, ratings, staff);
    base = JSON.stringify(ensureManagerCareer(ensureBoard(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)), s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}

test("ENT-07: exactly six hubs; every primary destination lives in exactly one hub (settings stays a utility); no route lost", () => {
  assert.equal(CAREER_HUBS.length, 6);
  assert.deepEqual(CAREER_HUBS.map((h) => h.label), ["Idag", "Laget", "Klubben", "Rekrytering", "Tävling", "Karriär"]);
  const placed = CAREER_HUBS.flatMap((h) => h.tabs);
  assert.equal(new Set(placed).size, placed.length, "no item in two hubs");
  for (const item of CAREER_NAV_ITEMS) {
    if ((UTILITY_NAV_IDS as readonly string[]).includes(item.id)) continue;
    // A destination merged by a canonical recommendation (CLB-01: Klubbhuset into the Club Journal) must not be a tab
    // itself, its target must be, and its URL must still resolve to that hub and tab -- no route lost.
    const merged = MERGED_NAV_IDS[item.id];
    if (merged) { assert.ok(!placed.includes(item.id), `${item.id} is merged, not a tab`); assert.ok(placed.includes(merged), `${item.id} merges into a tab`); assert.equal(resolveHubRoute(item.href).navId, merged, `${item.href} resolves to ${merged}`); continue; }
    assert.ok(placed.includes(item.id), `${item.id} has a hub`);
  }
  for (const h of CAREER_HUBS) { assert.equal(hubTabs(h).length, h.tabs.length, `${h.id}: every tab resolves`); assert.ok(hubHref(h).startsWith("/career")); }
  assert.deepEqual(new Set(CAREER_HUBS.map((h) => h.icon)).size, 6, "six distinct icons");
  assert.equal(MOBILE_TAB_HUBS.length, 4, "phone: four hubs + Mer");
});

test("ENT-07: legacy and contextual routes resolve to hub + tab", () => {
  const cases: [string, string, string][] = [
    ["/career", "idag", "home"], ["/career/inbox", "idag", "inbox"], ["/career/match-report/f1", "idag", "schedule"], ["/career/fixtures/f1", "idag", "schedule"],
    ["/career/squad/p-1", "laget", "squad"], ["/career/compare", "laget", "contracts"], ["/career/medical", "laget", "medical"],
    ["/career/clubs/x", "klubben", "club"], ["/career/finance", "klubben", "finance"], ["/career/staff/s1", "klubben", "staff"],
    ["/career/transfers/t1", "rekrytering", "transfers"], ["/career/players", "rekrytering", "players"],
    ["/career/analysis/opponent", "tavling", "analysis"], ["/career/competitions/se-svenska-cupen-herr", "tavling", "cup"], ["/career/competitions/swe-2", "tavling", "competitions"],
    ["/career/media/press", "karriar", "media"], ["/career/manager", "karriar", "manager"],
  ];
  for (const [path, hub, nav] of cases) { const r = resolveHubRoute(path); assert.equal(r.hub?.id, hub, path); assert.equal(r.navId, nav, path); }
  assert.equal(resolveHubRoute("/career/settings").hub, undefined);
});

test("ENT-08a: palette groups, prefixes and recents never mutate the career", () => {
  const s = career();
  const before = hash(s);
  const empty = paletteResults(s, "");
  assert.ok(empty.some((r) => r.group === "Sidor") && empty.some((r) => r.group === "Åtgärder"));
  const tak = paletteResults(s, "tak");
  assert.equal(tak[0]!.label, "Taktik", "page match ranks first");
  const club = paletteResults(s, "#tumba");
  assert.ok(club.length > 0 && club.every((r) => r.group === "Klubbar"));
  assert.ok(club.some((r) => r.href === "/career/club"), "own club -> club page");
  const someone = s.worldSquads["swe2-tumba"]![0]!;
  const players = paletteResults(s, `@${someone.lastName}`);
  assert.ok(players.length > 0 && players.every((r) => r.group === "Spelare"));
  assert.ok(players.some((r) => r.href === `/career/squad/${encodeURIComponent(someone.id)}`));
  const actions = paletteResults(s, ">kontrakt");
  assert.ok(actions.length > 0 && actions.every((r) => r.group === "Åtgärder"));
  assert.ok(PALETTE_ACTIONS.every((a) => a.href.startsWith("/")), "actions only navigate");
  assert.ok(paletteResults(s, "örebro").length >= 0);
  assert.deepEqual(paletteResults(s, "zzzzqqq"), []);
  assert.equal(hash(s), before, "pure");
});

test("Week Spine: Monday-Sunday over real state; next match, Continue stop and up-next are true to the career; pure and deterministic", () => {
  const s = career();
  const before = hash(s);
  const spine = buildWeekSpine(s);
  assert.equal(spine.days.length, 7);
  assert.equal(spine.days[0]!.weekday, "Mån");
  assert.equal(spine.days.filter((d) => d.isToday).length, s.gameDate >= spine.weekStart && s.gameDate <= addDays(spine.weekStart, 6) ? 1 : 0);
  const next = getNextPlayerFixture(s)!;
  assert.equal(spine.nextMatch?.fixtureId, next.id);
  assert.ok(spine.nextMatch!.daysUntil >= 0);
  if (!spine.pendingDecisions) {
    const stops = spine.days.filter((d) => d.continueStop);
    assert.ok(stops.every((d) => d.date === next.date), "Continue stops at the next own match");
  }
  assert.ok(spine.upNext.length <= 3);
  for (const u of spine.upNext) assert.ok(u.date >= s.gameDate && u.href.startsWith("/"));
  // A week containing the next match shows its pin on the right day.
  const matchWeek = buildWeekSpine(s, next.date);
  const day = matchWeek.days.find((d) => d.date === next.date)!;
  assert.ok(day.pins.some((p) => p.kind === "MATCH" && p.href.includes(encodeURIComponent(next.id))));
  for (const d of matchWeek.days) for (const p of d.pins) assert.ok(p.href.startsWith("/career") || p.href.startsWith("/"), p.href);
  assert.deepEqual(buildWeekSpine(s), spine, "deterministic");
  assert.equal(hash(s), before, "pure");
});

test("Week Spine: an out-of-work manager sees no own matches (the interim runs the club) and no Continue stop on a match", () => {
  const s = career();
  const out: CareerState = { ...s, managerCareer: { ...s.managerCareer!, seekingJob: { since: s.gameDate, reason: "CONTRACT_ENDED", clubId: s.playerClubId } } };
  const spine = buildWeekSpine(out, getNextPlayerFixture(s)!.date);
  assert.equal(spine.nextMatch, undefined);
  assert.ok(spine.days.every((d) => d.pins.every((p) => p.kind !== "MATCH")));
});

test("shell wiring: rail, hub tabs, spine, palette and the phone dock are rendered by GameShell", () => {
  const shell = readFileSync(fileURLToPath(new URL("../../components/GameShell.tsx", import.meta.url)), "utf8");
  for (const needle of ["CAREER_HUBS.map", "hm-hub-tabs", "<WeekSpine", "<CommandPalette", "hm-mobile-dock", "useCommandPaletteHotkey"]) assert.ok(shell.includes(needle), needle);
  assert.equal((shell.match(/continueButton\(/g) ?? []).length, 2, "one Continue model, two placements (header, phone dock)");
});

test("DSH-01 Matchweek Front Page: lead story, numbered decisions, ears with delta/reason and ladder ±2 come from real state", async () => {
  const { buildFrontPage, isoWeek } = await import("./frontPage");
  const s = career();
  const before = hash(s);
  const fp = buildFrontPage(s);
  assert.equal(fp.masthead.week, isoWeek(s.gameDate));
  assert.equal(isoWeek("2026-01-01"), 1);
  assert.equal(isoWeek("2026-08-20"), 34);
  assert.equal(fp.ears[0].label, "Förtroende");
  assert.equal(fp.ears[0].value, s.board!.confidence);
  assert.equal(fp.ears[1].value, s.managerCareer!.reputation);
  const next = getNextPlayerFixture(s)!;
  if (next.date === s.gameDate) { assert.equal(fp.lead.kind, "MATCHDAY"); assert.equal(fp.lead.fixtureId, next.id); }
  else assert.ok(["PREVIEW", "DEADLINE", "INJURIES", "BOARD", "RESULT"].includes(fp.lead.kind));
  assert.deepEqual(fp.decisions.map((d) => d.n), fp.decisions.map((_, i) => i + 1), "numbered from 1");
  assert.ok(fp.decisions.length <= 5);
  const open = s.careerEvents.filter((e) => e.requiresAction && !e.resolved);
  for (const e of open.slice(0, 5)) assert.ok(fp.decisions.some((d) => d.title === e.subject), "every open decision is listed");
  assert.ok(fp.ladder.length <= 5 && fp.ladder.filter((r) => r.own).length === 1, "own club in the ±2 ladder");
  assert.equal(hash(s), before, "pure");
  // A result two days ago leads the page; a season complete or a jobless manager change the lead.
  assert.equal(buildFrontPage({ ...s, seasonComplete: true }).lead.kind, "SEASON_COMPLETE");
  const jobless = { ...s, managerCareer: { ...s.managerCareer!, seekingJob: { since: s.gameDate, reason: "CONTRACT_ENDED" as const, clubId: s.playerClubId } } };
  assert.equal(buildFrontPage(jobless).lead.kind, "SEEKING_JOB");
  const played = { ...s, gameDate: addDays(next.date, 1), results: { ...s.results, [next.id]: { fixtureId: next.id, homeGoals: 30, awayGoals: 25 } as never } };
  const r = buildFrontPage(played).lead;
  assert.equal(r.kind, "RESULT");
  assert.match(r.headline, /30–25/);
});

test("SQD-01 Squad Matrix: rows carry the chip data, four saved views of 8 columns, sorting puts missing values last, tray actions use existing write paths", async () => {
  const { MATRIX_VIEWS, applyTrayAction, buildMatrixRows, cardMetrics, filterSortMatrix } = await import("./squadMatrix");
  const s = career();
  const before = hash(s);
  const rows = buildMatrixRows(s);
  assert.equal(rows.length, s.worldSquads[s.playerClubId]!.length);
  // SQD-01a (A) adds the curated Översikt as the default view; SQD-01c (A) turns Matchberedskap into the Fysisk status heat-strip.
  assert.deepEqual(MATRIX_VIEWS.map((v) => v.label), ["Översikt", "Fysisk status", "Prestation", "Kontraktsrisk", "Utveckling"]);
  for (const v of MATRIX_VIEWS) { assert.ok(v.columns.length <= 8, `${v.id}: at most 8 default columns (fits 1280 px)`); if (v.id !== "OVERVIEW") assert.equal(v.columns.length, 8, `${v.id}: 8 default columns`); assert.ok(v.columns.length + v.detailed.length <= 14); assert.equal(cardMetrics(v.id).length, 3); }
  for (const r of rows) { assert.ok(r.energy >= 0 && r.energy <= 100); assert.ok(["LOW", "MID", "HIGH"].includes(r.fitnessBand)); assert.ok(r.morale >= 0 && r.morale <= 100); }
  const gk = filterSortMatrix(rows, { query: "", position: "MV", state: "ALL", sortKey: "position", direction: "asc" });
  assert.ok(gk.length > 0 && gk.every((r) => r.position === "MV" || r.secondaryPosition === "MV"));
  const bySave = filterSortMatrix(rows, { query: "", position: "ALL", state: "ALL", sortKey: "savePct", direction: "desc" });
  const firstNull = bySave.findIndex((r) => r.savePct == null);
  assert.ok(firstNull === -1 || bySave.slice(firstNull).every((r) => r.savePct == null), "missing values sort last");
  const two = rows.slice(0, 2).map((r) => r.id);
  const rest = applyTrayAction(s, two, { kind: "REST" });
  assert.deepEqual(rest.skipped, []);
  for (const id of two) assert.equal(rest.state.playerTrainingAssignments[id]!.loadSetting, "REST");
  const role = applyTrayAction(s, two, { kind: "ROLE", tier: "TALENT" });
  for (const id of two) assert.equal(role.state.playerSquadStatus[id], "TALENT");
  assert.equal(applyTrayAction(s, two, { kind: "CAPTAIN" }).skipped.length, 2, "captain needs exactly one player");
  const cap = applyTrayAction(s, [two[0]!], { kind: "CAPTAIN" });
  assert.equal(buildMatrixRows(cap.state).find((r) => r.id === two[0])!.captain, true);
  assert.equal(hash(s), before, "tray actions never mutate the input");
});

test("WLD-05 season strip: consecutive Monday weeks, the current week marked once, own matches per week, windows and breaks flagged", async () => {
  const { buildSeasonStrip } = await import("./weekSpine");
  const s = career();
  const strip = buildSeasonStrip(s, [{ start: "2026-11-02", end: "2026-11-08" }]);
  assert.ok(strip.length > 20);
  for (let i = 1; i < strip.length; i++) assert.equal(strip[i]!.weekStart, addDays(strip[i - 1]!.weekStart, 7));
  assert.equal(strip.filter((w) => w.isCurrent).length, 1);
  const ownUnplayed = s.fixtures.filter((f) => (f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId) && !s.results[f.id]).length;
  assert.equal(strip.reduce((n, w) => n + w.matches.filter((m) => m === "M").length, 0), ownUnplayed);
  assert.ok(strip.some((w) => w.nationalBreak));
  assert.ok(strip.some((w) => w.transferWindow));
});
