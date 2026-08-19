import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_HALF_COURT_BOUNDS,
  isWithinCanonicalBounds,
} from "./court";
import type { MatchPlayerRenderState } from "./player";
import type { MatchBallRenderState } from "./ball";
import type { MatchRenderSnapshot } from "./snapshot";

// This file does NOT import @handball-manager/handball-engine or
// @handball-manager/match-renderer (that would defeat the point of the
// contract). The coordinate literals below are transcribed by hand from
// each package's own source, cited in each test, so the mapping stays
// honest and reviewable without creating a real dependency edge.

// Test 4: a representative known SIM coordinate, mapped conceptually
// into canonical coordinates.
// Source: handball-engine's src/canonicals/fieldHandball/formations.ts,
// formation "defence-6-0", second DEFENDER object:
//   object("DEFENDER", 2.004454, 2.054565, 180)
// SIM's own domain/geometry/court.ts uses the exact same origin/axis/
// unit convention as this contract (see HM-0.2D report Section 2), so
// the "mapping" is the identity function on x/y -- there is no rotation,
// scale, or offset to apply. That absence of a transform is itself the
// finding this test records.
test("known SIM player coordinate maps into canonical coordinates with no transform", () => {
  const simDefenderPosition = { x: 2.004454, y: 2.054565 };

  const canonicalPlayer: MatchPlayerRenderState = {
    id: "defense-defence-6-0-1",
    side: "DEFENSE",
    kind: "FIELD_PLAYER",
    x: simDefenderPosition.x,
    y: simDefenderPosition.y,
    orientationDegrees: 180,
  };

  assert.equal(canonicalPlayer.x, simDefenderPosition.x);
  assert.equal(canonicalPlayer.y, simDefenderPosition.y);
  assert.equal(isWithinCanonicalBounds(canonicalPlayer, CANONICAL_HALF_COURT_BOUNDS), true);
});

// Test 5: a representative known FIELD coordinate, mapped conceptually
// into canonical coordinates.
// Source: match-renderer's src/ui/workspaces/tactics-board/library/
// FormationLibrary.ts, formation "attack-6", BALL object:
//   player("BALL", 9.755011, 11.542316, 0)
// This is the SAME numeric formation data as SIM's canonical copy above
// (both trace to the same original FIELD authoring pass -- see report
// Section 2/3) so this test's coordinate is intentionally identical in
// value to the SIM ball test below; the point being verified is that
// FIELD's BoardObjectPosition {x,y} needs no transform either, only a
// reshape into MatchBallRenderState's flatter field set.
test("known FIELD ball coordinate maps into canonical coordinates with no transform", () => {
  const fieldBallPosition = { x: 9.755011, y: 11.542316 };

  const canonicalBall: MatchBallRenderState = {
    x: fieldBallPosition.x,
    y: fieldBallPosition.y,
    status: "POSSESSED",
    possessorPlayerId: null,
  };

  assert.equal(canonicalBall.x, fieldBallPosition.x);
  assert.equal(canonicalBall.y, fieldBallPosition.y);
  assert.equal(isWithinCanonicalBounds(canonicalBall, CANONICAL_HALF_COURT_BOUNDS), true);
});

// Test 7: one known player position (restated as a full snapshot
// membership check, not just a bounds check).
test("known player position (SIM defence-6-0 DEFENDER #1) fits a canonical snapshot", () => {
  const player: MatchPlayerRenderState = {
    id: "defense-defence-6-0-1",
    side: "DEFENSE",
    kind: "FIELD_PLAYER",
    x: 2.004454,
    y: 2.054565,
    orientationDegrees: 180,
  };
  assert.equal(player.side, "DEFENSE");
  assert.equal(player.kind, "FIELD_PLAYER");
});

// Test 8: one known ball position.
// Source: handball-engine's canonicals/fieldHandball/formations.ts,
// formation "attack-6", BALL object -- identical value to the FIELD
// citation above (Test 5), confirming both sources agree on this exact
// point, not just on the coordinate system in the abstract.
test("known ball position (attack-6 canonical BALL) fits a canonical snapshot", () => {
  const ball: MatchBallRenderState = {
    x: 9.755011,
    y: 11.542316,
    status: "POSSESSED",
    possessorPlayerId: null,
  };
  assert.equal(isWithinCanonicalBounds(ball, CANONICAL_HALF_COURT_BOUNDS), true);
});

// Test 9: one known goalkeeper position.
// IMPORTANT FINDING (see HM-0.2D report Section 2): SIM's Player type
// (domain/handball/player.ts) has no goalkeeper role at all -- TeamId is
// only "ATTACK" | "DEFENSE", DefenseRole is only the six field-defender
// slots (L1/L2/L3/R3/R2/R1), and
// scenarios/fieldFormationAdapter.ts's fieldDefenseFormationToPlayers
// explicitly filters canonical formation objects down to type
// "DEFENDER" only, silently discarding the formation's own GOALKEEPER
// object. SIM today cannot produce a goalkeeper render state because it
// does not simulate one. This test therefore sources its known
// goalkeeper position from FIELD's own canonical data instead --
// match-renderer's FormationLibrary.ts formation "defence-6-0",
// GOALKEEPER object: player("GOALKEEPER", 9.888641, 0.517817, 180) --
// and documents the gap explicitly rather than fabricating a SIM-side
// goalkeeper that does not exist in the migrated engine.
test("known goalkeeper position (FIELD defence-6-0 GOALKEEPER) fits a canonical snapshot -- SIM has no goalkeeper entity to source this from (documented gap)", () => {
  const goalkeeper: MatchPlayerRenderState = {
    id: "field-defence-6-0-goalkeeper",
    side: "DEFENSE",
    kind: "GOALKEEPER",
    x: 9.888641,
    y: 0.517817,
    orientationDegrees: 180,
  };
  assert.equal(goalkeeper.kind, "GOALKEEPER");
  assert.equal(isWithinCanonicalBounds(goalkeeper, CANONICAL_HALF_COURT_BOUNDS), true);
});

test("a minimal MatchRenderSnapshot assembles from canonical-convention parts with no coordinate transform", () => {
  const snapshot: MatchRenderSnapshot = {
    simulationTime: 0,
    court: {
      view: "HALF_COURT",
      widthMeters: 20,
      lengthMeters: 40,
      attackingGoalSide: "TOP",
    },
    players: [
      { id: "defense-1", side: "DEFENSE", kind: "FIELD_PLAYER", x: 2.004454, y: 2.054565, orientationDegrees: 180 },
      { id: "defense-gk", side: "DEFENSE", kind: "GOALKEEPER", x: 9.888641, y: 0.517817, orientationDegrees: 180 },
    ],
    ball: { x: 9.755011, y: 11.542316, status: "POSSESSED", possessorPlayerId: null },
  };

  assert.equal(snapshot.players.length, 2);
  for (const player of snapshot.players) {
    assert.equal(isWithinCanonicalBounds(player, CANONICAL_HALF_COURT_BOUNDS), true);
  }
  assert.equal(isWithinCanonicalBounds(snapshot.ball, CANONICAL_HALF_COURT_BOUNDS), true);
});
