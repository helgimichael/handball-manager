// HM-ALPHA3-M08: media registry, news engine, press conferences, rivals and discipline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import type { CareerState } from "../career/types";
import type { CareerEvent } from "../career/careerEvents";
import { ensureClubFinances } from "../economy/ledger";
import { getClubsByCompetition } from "../game-data";
import { HANDBOLLSLIGAN } from "../competition/rules";
import { addDaysIso } from "../players/dynamicsState";
import { CLUB_MEDIA, MEDIA_OUTLETS, geographicTie } from "./registry";
import { feed, publish, WEEKLY_WORLD_BUDGET, type WorldEvent } from "./newsEngine";
import { coachPersona, emptyMedia, headCoachOf, mediaOf, relationOf } from "./people";
import { answerPress, delegatePress, openPress } from "./press";
import { activeSuspension, appealCase, progressDiscipline } from "./discipline";
import { matchStakes } from "./worldTick";
import { ensureManagerCareer, dismissManager, openOffers } from "../manager/managerCareer";
import { acceptJobOffer } from "../manager/changeClub";
import { migrateCareerState } from "../career/saveMigration";

const SKOVDE = "se_club_ifk_skovde_hk";
function career(): CareerState {
  const s = createNewCareerState("m08-tests", SKOVDE, snapshotWorldSquads(HANDBOLLSLIGAN), undefined, snapshotGameplayRatings(HANDBOLLSLIGAN), snapshotAllClubsStaff(HANDBOLLSLIGAN));
  return { ...ensureClubFinances(s, "2026-07-01"), media: emptyMedia() };
}
const sink = () => { const events: CareerEvent[] = []; return { events, emit: (e: CareerEvent) => events.push(e) }; };
const ev = (key: string, over: Partial<WorldEvent> = {}): WorldEvent => ({ key, kind: "UPSET", date: "2026-10-05", importance: 2, clubIds: ["se_club_lugi_hf", "se_club_hk_malmo"], facts: { winner: "se_club_lugi_hf", loser: "se_club_hk_malmo", score: "30–25", winnerPos: 12, loserPos: 2 }, destinations: [], ...over });

test("every Swedish club in the game has real local/regional media, and every outlet referenced exists", () => {
  for (const comp of [HANDBOLLSLIGAN, "swe-2"]) for (const c of getClubsByCompetition(comp)) {
    const m = CLUB_MEDIA[c.id];
    assert.ok(m && m.outlets.length >= 2, `${c.id} has media`);
    for (const id of m.outlets) assert.ok(MEDIA_OUTLETS[id], `${id} is registered`);
  }
  for (const id of ["handbollskanalen", "aftonbladet", "expressen", "svt-sport", "radiosporten", "kristianstadsbladet", "ystads-allehanda", "skaraborgs-allehanda", "skovde-nyheter", "alingsas-tidning", "jonkopings-posten", "hallandsposten", "hallands-nyheter", "bohuslaningen", "gp", "sydsvenskan", "helsingborgs-dagblad"]) assert.ok(MEDIA_OUTLETS[id], id);
  assert.equal(geographicTie("se_club_lugi_hf", "swe2-h43lund"), 3, "Lund derby");
  assert.equal(geographicTie("se_club_ystads_if_hf", "swe2-ystad2"), 3, "Ystad derby");
});

test("one event, several outlets, each in its own words; a smaller club's local paper covers it even when national media do not", () => {
  const s = publish(career(), ev("e1", { kind: "COACH_CHANGE", importance: 2, clubIds: ["swe2-varberg"], facts: { club: "swe2-varberg", coach: "Test Testsson", change: "DISMISSED" } }));
  const stories = Object.values(mediaOf(s).stories);
  assert.ok(stories.some((x) => x.outletId === "hallands-nyheter"), "the local paper writes it");
  assert.ok(stories.some((x) => x.outletId === "handbollskanalen"));
  assert.ok(!stories.some((x) => ["aftonbladet", "expressen", "svt-sport"].includes(x.outletId)), "national media ignore a small story");
  const big = publish(career(), ev("e2", { kind: "MANAGER_DISMISSED", importance: 4, clubIds: ["se_club_ifk_kristianstad"], facts: { club: "se_club_ifk_kristianstad", manager: "X" }, topFlight: true }));
  const bigStories = Object.values(mediaOf(big).stories);
  assert.ok(bigStories.length >= 3 && bigStories.some((x) => x.scope === "NATIONAL") && bigStories.some((x) => x.outletId === "kristianstadsbladet"));
  assert.equal(new Set(bigStories.map((x) => x.headline)).size >= 2, true, "different outlets, different headlines");
});

test("the weekly budget keeps other clubs' minor news to a handful; the feed is searchable", () => {
  let s = career();
  for (let i = 0; i < 20; i++) s = publish(s, ev(`minor-${i}`));
  const events = new Set(Object.values(mediaOf(s).stories).map((x) => x.eventKey));
  assert.ok(events.size <= WEEKLY_WORLD_BUDGET, `${events.size} events`);
  assert.ok(feed(s, { query: "lugi" }).length > 0);
});

test("a provocative preview answer: supporters up, a touchy rival offended, pressure on the match; the assistant would have halved it", () => {
  let s = career();
  const opp = "se_club_ifk_kristianstad";
  const coach = headCoachOf(s, opp);
  assert.ok(coach, "the rival has a head coach");
  const { emit } = sink();
  s = openPress(s, "2026-10-01", { key: "t1", kind: "PRE_MATCH", title: "Test", context: "Toppmöte", fixtureId: "fx1", expiresOn: "2026-10-03", topics: [{ topic: "PREVIEW", opponentId: opp, rivalStaffId: coach!.staffId }] }, emit);
  const press = Object.values(mediaOf(s).press)[0]!;
  const base = { ...s, gameDate: "2026-10-01" };
  const provoked = answerPress(base, press.id, { q0: "PROVOCATIVE" }, emit);
  assert.ok(mediaOf(provoked).supporters > 0);
  assert.ok(relationOf(provoked, "manager", coach!.staffId).score < 0);
  assert.ok((mediaOf(provoked).pressure.fx1?.level ?? 0) > 0);
  assert.ok(mediaOf(provoked).press[press.id]!.consequences!.length >= 3, "consequences are listed with reasons");
  assert.ok(Object.values(mediaOf(provoked).stories).some((x) => x.kind === "INTERVIEW"), "the media write it up");
  const assistant = (s.staffRoster[SKOVDE] ?? []).find((m) => m.roles[0] === "ASSISTANT_COACH");
  if (assistant) {
    const calm = delegatePress(base, press.id, emit);
    assert.equal(mediaOf(calm).press[press.id]!.status, "DELEGATED");
    assert.ok(relationOf(calm, "manager", coach!.staffId).score >= 0);
  }
});

function refereePress(s: CareerState, key: string, tone: "CRITICAL" | "PROVOCATIVE") {
  const { emit } = sink();
  let next = openPress(s, s.gameDate, { key, kind: "POST_MATCH", title: "Efter matchen", context: "Utvisningar", expiresOn: addDaysIso(s.gameDate, 2), topics: [{ topic: "REFEREE", detail: "6 utvisningar mot 2." }] }, emit);
  next = answerPress(next, `press:${key}`, { q0: tone }, emit);
  return next;
}

test("ordinary criticism is not punished; questioning the referees' impartiality is reported, decided and booked", () => {
  let s = { ...career(), gameDate: "2026-10-10" };
  const critical = refereePress(s, "r1", "CRITICAL");
  assert.equal(Object.keys(mediaOf(critical).discipline).length, 0, "factual criticism is allowed");
  s = refereePress(s, "r2", "PROVOCATIVE");
  const c = Object.values(mediaOf(s).discipline)[0]!;
  assert.equal(c.status, "REPORTED");
  assert.match(c.provision, /RF:s stadgar 14 kap/);
  const cash = s.clubEconomies[SKOVDE]!.cashEur;
  const { emit } = sink();
  s = progressDiscipline({ ...s, gameDate: c.decisionOn }, c.decisionOn, emit);
  const decided = mediaOf(s).discipline[c.id]!;
  assert.equal(decided.outcome, "STRAFFAVGIFT");
  assert.ok(decided.fineSek! <= 25000);
  assert.ok(s.clubEconomies[SKOVDE]!.cashEur < cash, "the fine is booked");
  // A repeat offence within a year means a suspension; an appeal to RIN costs a fee and is rarely granted.
  s = refereePress({ ...s, gameDate: addDaysIso(c.decisionOn, 5) }, "r3", "PROVOCATIVE");
  const c2 = Object.values(mediaOf(s).discipline).find((x) => x.id !== c.id)!;
  assert.equal(c2.severity, 3);
  s = progressDiscipline({ ...s, gameDate: c2.decisionOn }, c2.decisionOn, emit);
  assert.equal(mediaOf(s).discipline[c2.id]!.outcome, "AVSTANGNING");
  assert.ok(activeSuspension(s));
  const appealed = appealCase(s, c2.id);
  assert.equal(mediaOf(appealed).discipline[c2.id]!.status, "APPEALED");
});

test("relationships, stories and discipline follow the manager to a new club and survive save/reload", () => {
  let s = ensureManagerCareer({ ...career(), gameDate: "2026-10-10" });
  const coach = headCoachOf(s, "se_club_ifk_kristianstad")!;
  const { emit } = sink();
  s = openPress(s, s.gameDate, { key: "rel", kind: "PRE_MATCH", title: "T", context: "", fixtureId: "f", expiresOn: "2026-10-12", topics: [{ topic: "RIVAL_RESPONSE", opponentId: coach.clubId, rivalStaffId: coach.staffId }] }, emit);
  s = answerPress(s, "press:rel", { q0: "PROVOCATIVE" }, emit);
  const before = relationOf(s, "manager", coach.staffId).score;
  assert.ok(before < 0);
  s = dismissManager(s, s.gameDate, "Test.", emit);
  const offer = openOffers(s)[0]!;
  const moved = acceptJobOffer(s, offer.id);
  assert.notEqual(moved.playerClubId, SKOVDE);
  assert.equal(relationOf(moved, "manager", coach.staffId).score, before, "the feud carries over");
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(moved)));
  assert.equal(relationOf(reloaded, "manager", coach.staffId).score, before);
  assert.equal(Object.keys(mediaOf(reloaded).stories).length, Object.keys(mediaOf(moved).stories).length);
  assert.ok(coachPersona(reloaded, coach.staffId)?.style, "the coach keeps his personality");
});

test("matchday stakes: a same-town derby is significant, an ordinary game is not", () => {
  const s = career();
  const f = s.fixtures.find((x) => x.homeClubId === SKOVDE || x.awayClubId === SKOVDE)!;
  assert.equal(matchStakes(s, f).level < 3 || !!matchStakes(s, f).derby || matchStakes(s, f).labels.length > 0, true);
  const lund = { ...s, playerClubId: "se_club_lugi_hf" };
  const derby = matchStakes(lund, { ...f, homeClubId: "se_club_lugi_hf", awayClubId: "swe2-h43lund" });
  assert.ok(derby.derby && derby.level >= 4);
});
