// MATCH-EXPERIENCE-2.0 M20: what a contact episode does to the possession.
//
// The test that must never be deleted is "winning the duel is not winning the
// ball". M19 gave the duel one honest decision; the risk on this side of it is
// that a decision quietly becomes a possession. A defender who has been gone
// past can force a mistake and he can foul, but he cannot pick the ball out of
// the hands of a man who is already beyond him -- and if that ever silently
// becomes a turnover again, the defence is being handed possessions it never won.
//
// Every proof here forces the resolver's verdict with a stub RNG rather than
// hunting for a seed, so what is under test is the CONSEQUENCE and nothing else.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scenario, requireScenarioPlayer } from "../scenarios/matchScenario";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { resolveDisruption } from "./possessionEngine";
import { simulateGameSequence } from "./gameFlow";
import { organizedContactContext } from "./defensiveReach";
import type { ContactContext } from "./defensiveReach";
import type { PossessionRng } from "./possessionRng";
import type { HandballState } from "../domain/handball/state";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });

/**
 * An RNG that answers `chance` from a fixed script.
 *
 * `resolveContactEpisode` asks twice: illegal first, then the clean win. Saying
 * exactly what it hears makes every consequence below deterministic without
 * pinning a seed to a behaviour it does not really describe.
 */
function scripted(...answers: readonly boolean[]): PossessionRng {
  let i = 0;
  return {
    nextFloat: () => 0.5,
    nextInt: (min: number) => min,
    chance: () => answers[Math.min(i++, answers.length - 1)] ?? false,
  };
}

const NOTHING = () => scripted(false, false);
const BALL_WON = () => scripted(false, true);
const ILLEGAL = () => scripted(true);

/** A carrier meeting a defender who is set in front of him, goal-side. */
function contained(): { state: HandballState; contact: ContactContext } {
  const state = scenario({
    ballCarrier: "V9",
    attackers: { V9: { x: 7, y: 9.5 } },
    defenders: { L3: { x: 7, y: 8.6 } },
    phase: "ATTACK_ACTION",
  }).handball;
  const contact = organizedContactContext(state, requireScenarioPlayer(state, "V9"), "TOP");
  assert.ok(contact, "the fixture puts the two of them in contact");
  assert.equal(contact.reach.canEngage, true, "and the defender is in front of the man");
  return { state, contact };
}

/** The same two men, except the carrier has gone past him. */
function beaten(): { state: HandballState; contact: ContactContext } {
  const state = scenario({
    ballCarrier: "V9",
    attackers: { V9: { x: 7, y: 7 } },
    defenders: { L3: { x: 7, y: 8.2 }, L2: { x: 5, y: 10.5 }, L1: { x: 3, y: 11 }, R3: { x: 9, y: 11 }, R2: { x: 13, y: 11 }, R1: { x: 16, y: 11 } },
    phase: "ATTACK_ACTION",
  }).handball;
  const moving = {
    ...state,
    players: state.players.map((p) =>
      p.id === requireScenarioPlayer(state, "L3").id ? { ...p, velocity: { x: 0, y: -2.5 } } : p,
    ),
  };
  const contact = organizedContactContext(moving, requireScenarioPlayer(moving, "V9"), "TOP");
  assert.ok(contact, "he is chasing back into the man, which is contact");
  assert.equal(contact.posture, "BEATEN");
  assert.equal(contact.reach.canEngage, false, "but he is behind the play");
  return { state: moving, contact };
}

const ratings = { defending: {}, attacking: {} } as never;

function consequence(fixture: { state: HandballState; contact: ContactContext }, rng: PossessionRng) {
  const carrier = requireScenarioPlayer(fixture.state, "V9");
  return resolveDisruption(fixture.state, carrier, fixture.contact, "TOP", rng, ratings);
}

// ---------------------------------------------------------------------------
// 1. Nothing means nothing
// ---------------------------------------------------------------------------

test("a duel that comes to nothing has no consequence at all", () => {
  const result = consequence(contained(), NOTHING());
  assert.equal(result.resolution, "NOTHING");
  assert.equal(result.disruption, null, "no turnover, no foul, no possession change");
  assert.equal(result.ballWonDeclined, false, "and nothing was declined either -- nothing happened");
});

// ---------------------------------------------------------------------------
// 2. Legal contact does not fabricate a turnover
// ---------------------------------------------------------------------------

test("a defender who has been gone past cannot take the ball, however well he resolves", () => {
  const result = consequence(beaten(), BALL_WON());
  assert.equal(result.resolution, "DEFENCE_WINS_BALL", "M19's verdict is untouched and still reported");
  assert.equal(result.disruption, null, "but possession does not change from behind the play");
  assert.equal(result.ballWonDeclined, true, "and the engine says so rather than losing the fact");
});

test("contact alone is never a turnover: containing a man is not stripping him", () => {
  // The same contained duel, resolved every way the resolver can resolve it.
  // Only the clean-win branch may ever move the ball.
  const fixture = contained();
  assert.equal(consequence(fixture, NOTHING()).disruption, null);
  assert.equal(consequence(fixture, ILLEGAL()).disruption?.kind, "FOUL");
  assert.equal(consequence(fixture, BALL_WON()).disruption?.kind, "TURNOVER");
});

// ---------------------------------------------------------------------------
// 3. A genuine regain
// ---------------------------------------------------------------------------

test("a defender in front of the man does win the ball, and it is a turnover", () => {
  const result = consequence(contained(), BALL_WON());
  assert.equal(result.resolution, "DEFENCE_WINS_BALL");
  assert.equal(result.disruption?.kind, "TURNOVER", "goal-side and in contact is a real regain");
  assert.equal(result.ballWonDeclined, false);
});

test("a regain changes possession exactly once", () => {
  // At the flow level: a turnover hands the ball over, advances the possession
  // by one, and does not do it twice.
  const run = simulateGameSequence(TOP, 12, { maxPossessions: 24 });
  const index = run.segments.findIndex((s) => s.outcome === "TURNOVER");
  assert.ok(index >= 0, "this seed contains a turnover");
  const before = run.segments[index];
  const after = run.segments[index + 1];
  assert.ok(after, "play continues after it");
  assert.notEqual(after.team, before.team, "the team that won the ball now attacks");
  assert.equal(after.possessionNumber, before.possessionNumber + 1, "exactly one possession, not two");
});

// ---------------------------------------------------------------------------
// 4. An ordinary foul keeps the attack
// ---------------------------------------------------------------------------

test("an organized free throw keeps the ball with the attacking team and does not start a new possession", () => {
  let checked = 0;
  for (let seed = 1; seed <= 60 && checked < 6; seed += 1) {
    const run = simulateGameSequence(TOP, seed, { maxPossessions: 24 });
    for (let i = 0; i < run.segments.length - 1; i += 1) {
      const segment = run.segments[i];
      if (segment.outcome !== "FREE_THROW" || segment.kind === "TRANSITION") continue;
      const next = run.segments[i + 1];
      checked += 1;
      assert.equal(next.kind, "FREE_THROW_CONTINUATION", "the whistle restarts the same attack");
      assert.equal(next.team, segment.team, "the fouled team keeps the ball");
      assert.equal(
        next.possessionNumber,
        segment.possessionNumber,
        "a free throw is not a new possession -- counting it as one would make every foul look like a lost attack",
      );
    }
  }
  assert.ok(checked > 0, "organized play produced free throws to inspect");
});

test("a free-throw restart is a real attack, not a formality", () => {
  // If the continuation could not shoot or score, "the attack continues" would
  // be true on paper and false in the match.
  let shots = 0;
  let goals = 0;
  for (const seed of [1, 3, 5, 7, 11, 12, 17, 23]) {
    for (const segment of simulateGameSequence(TOP, seed, { maxPossessions: 40 }).segments) {
      if (segment.kind !== "FREE_THROW_CONTINUATION") continue;
      if (String(segment.outcome).startsWith("SHOT")) shots += 1;
      if (segment.outcome === "SHOT_GOAL") goals += 1;
    }
  }
  assert.ok(shots > 0, "free-throw restarts produce shots");
  assert.ok(goals > 0, "and score from them");
});

// ---------------------------------------------------------------------------
// 5. M10 still owns the verdict
// ---------------------------------------------------------------------------

test("illegal contact is handed to M10, which alone decides the restart", () => {
  const near = consequence(contained(), ILLEGAL());
  assert.equal(near.resolution, "ILLEGAL_CONTACT");
  assert.equal(near.disruption?.kind, "FOUL");
  const award = near.disruption?.kind === "FOUL" ? near.disruption.award : null;
  assert.ok(award);
  // The consequence layer reports the foul; it never composes it.
  assert.equal(award.restart === "SEVEN_METRE", award.destroyedClearChance, "the restart tracks M10's clear chance");
  assert.equal(award.suspend, award.punishment === "TWO_MINUTES", "and the punishment is its own decision");
});

test("a seven metre is still M10's clear-chance call, not the episode's", () => {
  // Same forced verdict, one defender left on the court and the carrier in
  // range: M10 upgrades the restart on its own reading, with nothing about the
  // episode having changed.
  const state = scenario({
    ballCarrier: "V9",
    attackers: { V9: { x: 7, y: 6.5 } },
    defenders: { L3: { x: 7, y: 5.6 } },
    without: ["L1", "L2", "R3", "R2", "R1"],
    phase: "ATTACK_ACTION",
  }).handball;
  const contact = organizedContactContext(state, requireScenarioPlayer(state, "V9"), "TOP");
  assert.ok(contact);
  const result = consequence({ state, contact }, ILLEGAL());
  const award = result.disruption?.kind === "FOUL" ? result.disruption.award : null;
  assert.ok(award);
  assert.equal(award.destroyedClearChance, true, "nobody but the keeper was left");
  assert.equal(award.restart, "SEVEN_METRE", "so M10 gives the 7 metre");
});

// ---------------------------------------------------------------------------
// 6. Determinism and symmetry
// ---------------------------------------------------------------------------

test("the same duel produces the same consequence every time", () => {
  const fixture = contained();
  for (const rng of [NOTHING, BALL_WON, ILLEGAL]) {
    const a = consequence(fixture, rng());
    const b = consequence(fixture, rng());
    assert.equal(a.resolution, b.resolution);
    assert.equal(a.ballWonDeclined, b.ballWonDeclined);
    assert.equal(a.disruption?.kind ?? null, b.disruption?.kind ?? null);
  }
});
