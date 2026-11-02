// HM-ALPHA3-M09: matchday presentation, club colours, and the full world-to-matchday loop.
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
import { continueCareerRhythm } from "../career/continueController";
import { playManagerFixtureLegacy } from "../career/legacy/matchday";
import { migrateCareerState } from "../career/saveMigration";
import { emptyMedia, mediaOf, relationOf } from "../media/people";
import { answerPress, openPressConferences } from "../media/press";
import { progressMedia } from "../media/worldTick";
import { contrast, matchAftermath, matchColors, matchdayBriefing } from "./matchday";

const LUGI = "se_club_lugi_hf", MALMO = "se_club_hk_malmo";
function career(club = LUGI): CareerState {
  const s = createNewCareerState("m09-tests", club, snapshotWorldSquads(HANDBOLLSLIGAN), undefined, snapshotGameplayRatings(HANDBOLLSLIGAN), snapshotAllClubsStaff(HANDBOLLSLIGAN));
  return { ...ensureClubFinances(s, "2026-07-01"), media: emptyMedia() };
}
const sink = () => { const events: CareerEvent[] = []; return { events, emit: (e: CareerEvent) => events.push(e) }; };

test("club colours are readable on the court and never clash, for every pairing of the Swedish clubs", () => {
  const clubs = [...getClubsByCompetition(HANDBOLLSLIGAN), ...getClubsByCompetition("swe-2")];
  assert.ok(clubs.length >= 28);
  for (const h of clubs) for (const a of clubs) {
    if (h.id === a.id) continue;
    const { home, away } = matchColors(h.id, a.id);
    assert.ok(contrast(home, "#173e51") >= 2.2, `${h.id} home ${home}`);
    assert.ok(contrast(away, "#173e51") >= 2.2, `${a.id} away ${away}`);
    assert.notEqual(home, away);
  }
});

test("the matchday briefing shows only what the club knows: no ratings, analysis only when done", () => {
  const s = career();
  const f = s.fixtures.find((x) => x.homeClubId === LUGI || x.awayClubId === LUGI)!;
  const b = matchdayBriefing(s, f);
  const json = JSON.stringify(b);
  assert.ok(!/"(ca|pa|currentAbility|potentialAbility)":/.test(json), "no hidden ability in the briefing");
  assert.equal(b.analysisReady, false);
});

test("the full loop: a derby preview, the rival and the press, the engine plays it, the media report, relations and history persist", () => {
  let s = career();
  const f = s.fixtures.filter((x) => x.type === "LEAGUE" && ((x.homeClubId === LUGI && x.awayClubId === MALMO) || (x.homeClubId === MALMO && x.awayClubId === LUGI))).sort((a, b) => a.date.localeCompare(b.date))[0]!;
  assert.ok(f, "Lugi meets Malmö in the league");
  const { emit } = sink();
  // Two days out: the local media preview the derby and the press conference opens.
  s = progressMedia({ ...s, gameDate: addDaysIso(f.date, -2) }, addDaysIso(f.date, -2), [], emit);
  const stakes = matchdayBriefing(s, f).stakes;
  assert.ok(stakes.derby, "Lugi–Malmö is a regional derby");
  assert.ok(Object.values(mediaOf(s).stories).some((x) => x.kind === "DERBY_PREVIEW" && ["sydsvenskan", "skanska-dagbladet", "p4-malmohus", "kvallsposten"].includes(x.outletId)), "Skåne media preview it");
  const press = openPressConferences({ ...s, gameDate: addDaysIso(f.date, -2) }).find((p) => p.fixtureId === f.id)!;
  assert.ok(press, "a pre-match press conference");
  const answers = Object.fromEntries(press.questions.map((q) => [q.id, q.answers.some((a) => a.tone === "PROVOCATIVE") ? "PROVOCATIVE" : q.answers[0]!.tone])) as never;
  s = answerPress({ ...s, gameDate: addDaysIso(f.date, -2) }, press.id, answers, emit);
  assert.ok((mediaOf(s).pressure[f.id]?.level ?? 0) >= 2, "words create pressure on the match");
  const supportersBefore = mediaOf(s).supporters;
  // The match itself: the real engine, through the career rhythm.
  for (let i = 0; i < 200 && !s.results[f.id]; i++) { const r = continueCareerRhythm(s); s = r.state; if (r.stopReason === "ACTION_REQUIRED" || r.stopReason === "ACTION_REQUIRED_PENDING") s = playManagerFixtureLegacy(s).state; }
  assert.ok(s.results[f.id], "played by the engine");
  for (let i = 0; i < 5 && !Object.values(mediaOf(s).stories).some((x) => x.fixtureId === f.id && x.kind === "MATCH_REPORT"); i++) { const r = continueCareerRhythm(s); s = r.state; if (r.stopReason === "ACTION_REQUIRED" || r.stopReason === "ACTION_REQUIRED_PENDING") s = playManagerFixtureLegacy(s).state; }
  const after = matchAftermath(s, f.id);
  assert.ok(after.stories.some((x) => x.kind === "MATCH_REPORT"), "the media report the result");
  assert.ok(after.consequences.length > 0, "the derby and the words before it have consequences");
  assert.notEqual(mediaOf(s).supporters, supportersBefore);
  // Save/reload keeps all of it.
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(matchAftermath(reloaded, f.id).consequences, after.consequences);
  assert.equal(Object.keys(mediaOf(reloaded).stories).length, Object.keys(mediaOf(s).stories).length);
  if (stakes.rival) assert.equal(relationOf(reloaded, "manager", stakes.rival.staffId).score, relationOf(s, "manager", stakes.rival.staffId).score);
});
