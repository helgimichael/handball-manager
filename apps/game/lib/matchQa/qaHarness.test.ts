// HUMAN QA GATE 1: focused technical validation for the QA harness.
//
// These do NOT judge whether anything looks right -- that is the human's job at
// the gate, and writing assertions for it would defeat the purpose of building
// the harness. They check only the things a tester has to be able to trust
// before his eyes are worth anything: that the same inputs give the same match,
// that a control actually changes the input it claims to, and that what is on
// screen came from the real engine rather than from this folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_QA_SETTINGS,
  DEFENCE_SYSTEMS,
  QA_PRESETS,
  buildQaMatch,
  phaseAt,
  readConditions,
  readTeams,
} from "./qaHarness";

const seedFor = (n: number) => ({ ...DEFAULT_QA_SETTINGS, seed: n });

test("the same settings produce the same match, every time", () => {
  const a = buildQaMatch(seedFor(12));
  const b = buildQaMatch(seedFor(12));
  assert.deepEqual(a.match.finalScore, b.match.finalScore);
  assert.equal(a.match.totalPossessions, b.match.totalPossessions);
  assert.equal(a.events.length, b.events.length);
  assert.deepEqual(
    a.events.map((e) => `${e.sequence}:${e.type}:${e.matchSeconds.toFixed(3)}`),
    b.events.map((e) => `${e.sequence}:${e.type}:${e.matchSeconds.toFixed(3)}`),
  );
});

test("a different seed is a different match", () => {
  const a = buildQaMatch(seedFor(12));
  const b = buildQaMatch(seedFor(13));
  assert.notDeepEqual(
    a.events.map((e) => `${e.type}:${e.matchSeconds.toFixed(3)}`),
    b.events.map((e) => `${e.type}:${e.matchSeconds.toFixed(3)}`),
    "the seed control has to reach the engine",
  );
});

test("the defence controls actually change the defence each side plays", () => {
  for (const system of DEFENCE_SYSTEMS) {
    const home = buildQaMatch({ ...DEFAULT_QA_SETTINGS, home: system.id });
    const away = buildQaMatch({ ...DEFAULT_QA_SETTINGS, away: system.id });
    assert.equal(home.match.finalState.instructions.HOME.defenceSystem, system.id, `HOME plays ${system.label}`);
    assert.equal(away.match.finalState.instructions.AWAY.defenceSystem, system.id, `AWAY plays ${system.label}`);
  }
});

test("the fatigue control actually turns condition on and off", () => {
  const off = buildQaMatch({ ...DEFAULT_QA_SETTINGS, fatigue: false });
  const on = buildQaMatch({ ...DEFAULT_QA_SETTINGS, fatigue: true });
  assert.ok(
    off.match.finalState.match.handball.players.every((p) => p.condition === undefined),
    "off means nobody has a tank at all",
  );
  assert.ok(
    on.match.finalState.match.handball.players.every((p) => p.condition !== undefined),
    "on means everybody does",
  );
  assert.ok(readConditions(off.match, []).length === 0, "and the panel has nothing to show when it is off");
  assert.ok(readConditions(on.match, []).length > 0, "and something to show when it is on");
});

test("the 7v6 control genuinely empties a goal at some point", () => {
  const { match } = buildQaMatch({ ...DEFAULT_QA_SETTINGS, sevenOut: true });
  const homeIds = new Set(match.finalState.rosters.HOME);
  const keeperIds = new Set(match.finalState.goalkeeperIds);
  const emptyFrames = match.trace.filter((entry) => {
    const onCourt = entry.playerPositions.filter((p) => homeIds.has(p.playerId));
    return onCourt.length > 0 && onCourt.every((p) => !keeperIds.has(p.playerId));
  });
  assert.ok(emptyFrames.length > 0, "HOME really plays with its goal open");
});

test("every preset builds a real match from the engine", () => {
  for (const preset of QA_PRESETS) {
    const { match, events } = buildQaMatch(preset.settings);
    assert.ok(match.trace.length > 0, `${preset.label}: a real trace`);
    assert.ok(events.length > 0, `${preset.label}: real canonical events`);
    assert.ok(match.totalPossessions > 0, `${preset.label}: real possessions`);
    // Presets that seek must land inside the match they just built.
    if (preset.seek) {
      const target = preset.seek(events, match);
      if (target !== null) {
        assert.ok(target >= 0, `${preset.label}: seeks to a real clock`);
        assert.ok(
          target <= events[events.length - 1].matchSeconds,
          `${preset.label}: seeks inside the match, not past the end`,
        );
      }
    }
  }
});

test("the debug readings describe the state they were given", () => {
  const { match } = buildQaMatch(DEFAULT_QA_SETTINGS);
  const first = match.trace[0];
  const players = first.playerPositions.map((p) => ({ id: p.playerId, x: p.position.x, y: p.position.y }));
  const teams = readTeams(match, players, DEFAULT_QA_SETTINGS, { HOME: "BOTTOM", AWAY: "TOP" });
  assert.equal(teams.length, 2);
  for (const team of teams) {
    assert.ok(team.onCourt > 0 && team.onCourt <= 7, `${team.team} has a legal side (${team.onCourt})`);
    assert.equal(team.fieldPlayers + (team.goalkeeperOnCourt ? 1 : 0), team.onCourt);
    // QA GATE 1 FIX: guarded is a position, so it can never be true without a
    // keeper -- but it may be false with one.
    if (team.goalGuarded) assert.ok(team.goalkeeperOnCourt, `${team.team}: a guarded goal has a keeper in it`);
  }
  assert.notEqual(phaseAt(match, first.matchSeconds), "", "a phase is reported");
});

test("nothing in the harness simulates anything", () => {
  // Structural. The harness may configure the engine and read its output; the
  // moment it computes a position, a contact or an outcome, the thing on screen
  // has stopped being the thing we ship.
  const source = require("node:fs").readFileSync("lib/matchQa/qaHarness.ts", "utf8") as string;
  for (const forbidden of ["Math.random", "advancePlayerMovement", "timeToReach", "resolveShot", "judgeFoul", "step("]) {
    assert.ok(!source.includes(forbidden), `qaHarness.ts must not ${forbidden}`);
  }
});
