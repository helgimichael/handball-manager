// HM-M9E/M9F: history compaction at rollover, and older saves.
import test from "node:test";
import assert from "node:assert/strict";
import { syntheticTransitionCareer, withSyntheticLiveKval } from "./seasonTransition.fixtures";
import { transitionCareerSeason, managerModePackageOptions, buildCareerTransitionRequest } from "./careerTransitionEvidence";
import { migrateCareerState } from "./saveMigration";
import { RECENT_DAYS } from "./historyCompaction";
import { addDays } from "./dateUtils";
import { competitionClubIds, hasLeagueCalendar } from "../competition/tables";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { SWEDISH_LEAGUES as L } from "../competition/transition/sweden2026";
import { CLUBS } from "../game-data";
import type { CareerState } from "./types";

const complete = withSyntheticLiveKval(syntheticTransitionCareer(), true);
const msg = (id: string, date: string, open = false) => ({ id, category: "Klubb", sender: "x", subject: id, preview: "", body: "", date, read: true, important: false, archived: false, resolved: !open, priority: "INFORMATION", actionRequired: open }) as never;

test("M9E: the rollover trims old working records again -- history, contracts and recent items stay", () => {
  const old = addDays(complete.gameDate, -(RECENT_DAYS + 30));
  const recent = addDays(complete.gameDate, -10);
  const someone = Object.keys(complete.playerContracts)[0]!;
  const longHistory = Array.from({ length: 40 }, (_, i) => ({ date: addDays(old, i), attribute: "PASSING", previousValue: 10, newValue: 11, sourceSummary: "x" })) as never;
  const state: CareerState = {
    ...complete,
    inbox: [...complete.inbox, msg("m9-old", old), msg("m9-recent", recent), msg("m9-open", old, true)],
    playerDevelopmentState: { ...complete.playerDevelopmentState, [someone]: { playerId: someone, attributeStimulus: {}, attributeQualityWeightedSum: {}, attributeProgress: {}, lastDevelopmentDate: null, developmentHistory: longHistory } },
  };
  const out = transitionCareerSeason(state);
  assert.equal(out.status, "APPLIED", JSON.stringify(out.blockers.slice(0, 3)));
  const ids = out.state.inbox.map((m) => m.id);
  assert.ok(!ids.includes("m9-old"), "an old, resolved message is trimmed");
  assert.ok(ids.includes("m9-recent") && ids.includes("m9-open"), "recent and still-open items survive");
  assert.ok(out.state.playerDevelopmentState[someone]!.developmentHistory.length <= 24, "development history bounded");
  assert.equal(out.state.seasonHistory!.length, (complete.seasonHistory?.length ?? 0) + 1, "the finished season is archived, never trimmed");
  assert.deepEqual(out.state.playerContracts, state.playerContracts, "contracts untouched");
  // A blocked attempt touches nothing -- not even the compaction.
  const blocked = transitionCareerSeason({ ...state, results: {} } as CareerState);
  assert.equal(blocked.status, "BLOCKED");
  assert.ok(blocked.state.inbox.some((m) => m.id === "m9-old"));
});

test("M9F: a save round-trip (JSON + migration) transitions identically and needs no schema change", () => {
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(complete)));
  const a = transitionCareerSeason(complete);
  const b = transitionCareerSeason(reloaded);
  assert.equal(b.status, "APPLIED");
  assert.deepEqual(b.state.competitionMembership, a.state.competitionMembership);
  // An older save without a transition receipt is accepted as-is.
  const legacy: CareerState = { ...reloaded };
  delete legacy.lastSeasonTransition;
  assert.equal(transitionCareerSeason(legacy).status, "APPLIED");
});

test("M9F: a legacy season that simulated only its own league moves nobody, and season 2 gets both tiers", () => {
  // Older saves joined mid-season keep only their own league's calendar (seasonCalendar.ts).
  const ownOnly: CareerState = { ...complete, fixtures: complete.fixtures.filter((f) => !(f.type === "LEAGUE" && f.competitionId === L.hbl)), competitionTies: {} };
  assert.equal(hasLeagueCalendar(ownOnly, L.hbl), false);
  assert.equal(managerModePackageOptions(ownOnly).frozen, true);
  const out = transitionCareerSeason(ownOnly);
  assert.equal(out.status, "APPLIED", JSON.stringify(out.blockers.slice(0, 5)));
  for (const c of CLUBS) assert.equal(out.state.competitionMembership?.[c.id] ?? c.competitionId, ownOnly.competitionMembership?.[c.id] ?? c.competitionId, "no evidenced movement, no movement");
  assert.ok(out.state.lastSeasonTransition!.ruleId.includes("frozen"), "the receipt says the season was frozen");
  // The next season gains the missing tier before kickoff (the existing calendar flow).
  const firstDay = ensureSeasonCalendar(out.state);
  assert.ok(hasLeagueCalendar(firstDay, L.hbl) && hasLeagueCalendar(firstDay, L.allsvenskan));
});

test("M9F: a career that cannot transition safely gets an explicit, recoverable block -- never a corrupted save", () => {
  // Drifted membership from a pre-fix save: Allsvenskan with 15 clubs.
  const extra = CLUBS.find((c) => c.competitionId === "se_division1_norra")!.id;
  const drifted: CareerState = { ...complete, competitionMembership: { ...complete.competitionMembership, [extra]: L.allsvenskan } };
  assert.equal(competitionClubIds(drifted, L.allsvenskan).length, 15);
  const out = transitionCareerSeason(drifted);
  assert.equal(out.status, "BLOCKED");
  assert.equal(out.state, drifted, "the original career is returned unchanged");
  assert.ok(out.blockers.length > 0 && out.blockers.every((b) => b.code && b.message));
  // The request itself is still buildable (no throw), so the UI can show exact reasons.
  assert.doesNotThrow(() => buildCareerTransitionRequest(drifted));
});
