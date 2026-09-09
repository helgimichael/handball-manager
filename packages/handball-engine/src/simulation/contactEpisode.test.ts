// MATCH-EXPERIENCE-2.0 M19: organized contact resolution.
//
// The test that must never be deleted is "one duel is decided once". Everything
// M19 is worth rests on it: the old model asked the same question of the same
// two men twenty times a second, so the answer depended on how long they leaned
// on each other rather than on what happened. If a future change lets a running
// episode be rolled again per step, that regression is back and the parameters
// in contactEpisode.ts stop meaning anything.
//
// The second thing under test is that posture is an input, not a verdict. Every
// posture must be able to produce every outcome; what it changes is how likely
// each one is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scenario, requireScenarioPlayer } from "../scenarios/matchScenario";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulatePossession } from "./possessionEngine";
import { createPossessionRng } from "./possessionRng";
import { organizedContactContext } from "./defensiveReach";
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import {
  EPISODE_BREAK_SECONDS,
  advanceEpisode,
  episodeNeedsResolving,
  markResolved,
  resolveContactEpisode,
  type ContactEpisode,
  type ContactResolution,
} from "./contactEpisode";
import type { ContactContext, ContactPosture } from "./defensiveReach";
import type { MeterPoint } from "../domain/geometry/coordinates";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });

/** A contact context with only the fields resolution actually reads made interesting. */
function contact(overrides: {
  posture?: ContactPosture;
  defenderId?: string;
  closingSpeed?: number;
  helpArrives?: boolean;
} = {}): ContactContext {
  const defenderId = overrides.defenderId ?? "d1";
  return {
    posture: overrides.posture ?? "LEGAL_CONTACT",
    defenderId,
    reach: {
      defenderId,
      role: "L3",
      engagementPoint: { x: 10, y: 6 },
      attackerSeconds: 1,
      defenderSeconds: 1,
      marginSeconds: 0,
      goalSide: true,
      separationMeters: 1.0,
      closingSpeed: overrides.closingSpeed ?? 1.5,
      canEngage: true,
    },
    helpDefenderId: null,
    helpMarginSeconds: Number.NEGATIVE_INFINITY,
    helpArrives: overrides.helpArrives ?? false,
    inContact: true,
    closingSpeed: overrides.closingSpeed ?? 1.5,
  };
}

/** Resolve the same situation many times and report the mix. */
function outcomeMix(context: ContactContext, defending = 10, runs = 4000): Record<ContactResolution, number> {
  const rng = createPossessionRng(4242);
  const mix: Record<ContactResolution, number> = { NOTHING: 0, DEFENCE_WINS_BALL: 0, ILLEGAL_CONTACT: 0 };
  for (let i = 0; i < runs; i += 1) mix[resolveContactEpisode(context, defending, rng)] += 1;
  return mix;
}

// ---------------------------------------------------------------------------
// 1. One duel, many frames
// ---------------------------------------------------------------------------

test("a duel lasting many steps is one episode and is decided once", () => {
  const situation = contact();
  let episode: ContactEpisode | null = null;
  let starts = 0;
  let decisions = 0;

  // Two seconds of continuous contact on the ordinary 0.05s grid.
  for (let step = 0; step < 40; step += 1) {
    const now = step * 0.05;
    const advanced = advanceEpisode(episode, situation, "carrier", now);
    episode = advanced.episode;
    if (advanced.started) starts += 1;
    assert.ok(episode);
    if (episodeNeedsResolving(episode)) {
      episode = markResolved(episode, situation.posture);
      decisions += 1;
    }
  }

  assert.equal(starts, 1, "forty steps of the same two men are one episode");
  assert.equal(decisions, 1, "and one decision -- not one every twentieth of a second");
});

test("a momentary separation does not end the duel", () => {
  const situation = contact();
  let episode = advanceEpisode(null, situation, "carrier", 0).episode;
  assert.ok(episode);
  episode = markResolved(episode, situation.posture);

  // A single frame with no contact, then contact again: bodies in a duel come
  // apart constantly, and this must not buy the defence a second roll.
  const gap = advanceEpisode(episode, null, "carrier", 0.05);
  assert.ok(gap.episode, "the episode survives a frame of separation");
  const back = advanceEpisode(gap.episode, situation, "carrier", 0.1);
  assert.equal(back.started, false, "and picking each other up again is the same duel");
  assert.ok(back.episode);
  assert.equal(episodeNeedsResolving(back.episode), false, "already decided");
});

// ---------------------------------------------------------------------------
// 2. Break and re-contact
// ---------------------------------------------------------------------------

test("a genuine break ends the episode, and new contact is a new duel", () => {
  const situation = contact();
  let episode = advanceEpisode(null, situation, "carrier", 0).episode;
  assert.ok(episode);
  episode = markResolved(episode, situation.posture);

  // Long enough apart that this is not jostling any more.
  const broken = advanceEpisode(episode, null, "carrier", EPISODE_BREAK_SECONDS + 0.1);
  assert.equal(broken.episode, null, "the duel is over");

  const again = advanceEpisode(broken.episode, situation, "carrier", EPISODE_BREAK_SECONDS + 0.15);
  assert.equal(again.started, true, "meeting him again is a new duel");
  assert.ok(again.episode);
  assert.equal(episodeNeedsResolving(again.episode), true, "which is owed its own decision");
});

test("a different defender is a different duel, and so is a different carrier", () => {
  const first = contact({ defenderId: "d1" });
  const started = advanceEpisode(null, first, "carrier", 0);
  assert.ok(started.episode);
  const resolved = markResolved(started.episode, first.posture);

  const otherDefender = advanceEpisode(resolved, contact({ defenderId: "d2" }), "carrier", 0.05);
  assert.equal(otherDefender.started, true, "a second defender stepping in is a new duel");

  const otherCarrier = advanceEpisode(resolved, first, "someone-else", 0.05);
  assert.equal(otherCarrier.started, true, "and the ball moving on is a new situation entirely");
});

// ---------------------------------------------------------------------------
// 3. One episode, one decision -- whatever the situation does
// ---------------------------------------------------------------------------

test("posture may change all it likes; the duel is still decided exactly once", () => {
  // The tempting mistake, and the reason this test exists. A defender who ends
  // up beaten is where fouls really come from, so reopening the duel when the
  // posture gets there feels right. It is not: the same two men are still
  // together, and giving them a second roll because the geometry between them
  // drifted across a threshold is the per-step lottery again, only slower.
  let episode = advanceEpisode(null, contact({ posture: "CLEANLY_CONTAINED" }), "carrier", 0).episode;
  assert.ok(episode);
  assert.equal(episodeNeedsResolving(episode), true, "a new duel is owed a decision");
  episode = markResolved(episode, "CLEANLY_CONTAINED");

  // He contains the man, then converges with him, then is gone past -- all
  // without the two of them ever coming apart.
  for (const posture of ["LEGAL_CONTACT", "BEATEN", "CLEANLY_CONTAINED", "BEATEN"] as const) {
    const step = advanceEpisode(episode, contact({ posture }), "carrier", 0.05);
    assert.equal(step.started, false, `${posture} is the same duel, not a new one`);
    assert.ok(step.episode);
    episode = step.episode;
    assert.equal(episodeNeedsResolving(episode), false, `and ${posture} does not buy a second decision`);
  }
});

test("a beaten recovery does get its own decision -- once it is a real duel", () => {
  // The situation the escalation was reaching for is still reachable; it just
  // has to be an actual new engagement rather than a threshold being crossed.
  let episode = advanceEpisode(null, contact({ posture: "CLEANLY_CONTAINED" }), "carrier", 0).episode;
  assert.ok(episode);
  episode = markResolved(episode, "CLEANLY_CONTAINED");

  const apart = advanceEpisode(episode, null, "carrier", EPISODE_BREAK_SECONDS + 0.1);
  assert.equal(apart.episode, null, "he was beaten and the two came properly apart");

  const recovery = advanceEpisode(apart.episode, contact({ posture: "BEATEN" }), "carrier", EPISODE_BREAK_SECONDS + 0.2);
  assert.equal(recovery.started, true, "catching him again from behind is a new duel");
  assert.ok(recovery.episode);
  assert.equal(episodeNeedsResolving(recovery.episode), true, "and it is judged on its own terms");
});

// ---------------------------------------------------------------------------
// 4. Posture is an input, never a verdict
// ---------------------------------------------------------------------------

test("every posture can produce every outcome", () => {
  for (const posture of ["CLEANLY_CONTAINED", "LEGAL_CONTACT", "BEATEN"] as const) {
    const mix = outcomeMix(contact({ posture, closingSpeed: 2.0 }));
    for (const outcome of ["NOTHING", "DEFENCE_WINS_BALL", "ILLEGAL_CONTACT"] as const) {
      assert.ok(mix[outcome] > 0, `${posture} can still end as ${outcome}`);
    }
  }
});

test("containment and a beaten recovery are materially different risks", () => {
  const hard = { closingSpeed: 2.5 };
  const contained = outcomeMix(contact({ posture: "CLEANLY_CONTAINED", ...hard }));
  const contested = outcomeMix(contact({ posture: "LEGAL_CONTACT", ...hard }));
  const beaten = outcomeMix(contact({ posture: "BEATEN", ...hard }));

  assert.ok(
    contested.ILLEGAL_CONTACT > contained.ILLEGAL_CONTACT * 2,
    `a real duel fouls far more than a defender who got there first (${contested.ILLEGAL_CONTACT} vs ${contained.ILLEGAL_CONTACT})`,
  );
  assert.ok(
    beaten.ILLEGAL_CONTACT > contained.ILLEGAL_CONTACT * 2,
    `and so does a man recovering from behind (${beaten.ILLEGAL_CONTACT} vs ${contained.ILLEGAL_CONTACT})`,
  );
  assert.ok(
    beaten.DEFENCE_WINS_BALL < contained.DEFENCE_WINS_BALL,
    "while from behind he can hardly ever take the ball cleanly, which is why he holds instead",
  );
});

test("how hard they converge changes the risk; standing next to a man is not a challenge", () => {
  const drifting = outcomeMix(contact({ posture: "BEATEN", closingSpeed: 0.05 }));
  const arriving = outcomeMix(contact({ posture: "BEATEN", closingSpeed: 3.5 }));
  assert.ok(
    arriving.ILLEGAL_CONTACT > drifting.ILLEGAL_CONTACT * 2,
    `arriving hard is a challenge; drifting together is adjacency (${arriving.ILLEGAL_CONTACT} vs ${drifting.ILLEGAL_CONTACT})`,
  );
});

test("cover behind him lowers the risk, because losing the duel stops being fatal", () => {
  const alone = outcomeMix(contact({ posture: "BEATEN", closingSpeed: 2.5, helpArrives: false }));
  const covered = outcomeMix(contact({ posture: "BEATEN", closingSpeed: 2.5, helpArrives: true }));
  assert.ok(covered.ILLEGAL_CONTACT < alone.ILLEGAL_CONTACT, "the last man leans on it harder than one with help");
});

test("a better defender fouls less and takes the ball more", () => {
  const poor = outcomeMix(contact({ closingSpeed: 2.5 }), 6);
  const strong = outcomeMix(contact({ closingSpeed: 2.5 }), 14);
  assert.ok(strong.ILLEGAL_CONTACT < poor.ILLEGAL_CONTACT, "defending buys fewer fouls");
  assert.ok(strong.DEFENCE_WINS_BALL > poor.DEFENCE_WINS_BALL, "and more clean wins");
});

// ---------------------------------------------------------------------------
// 5. The rules stay where they are
// ---------------------------------------------------------------------------

test("the episode resolver never decides what a foul is worth", () => {
  // Structural. The resolver answers one question -- was this contact illegal --
  // and if it ever learns the vocabulary of a verdict, M10 has been duplicated.
  const source = readFileSync("src/simulation/contactEpisode.ts", "utf8");
  for (const forbidden of ["judgeFoul", "SEVEN_METRE", "FREE_THROW", "TWO_MINUTES", "suspend", "clearScoringChance"]) {
    assert.ok(!source.includes(forbidden), `contactEpisode.ts must not mention ${forbidden}`);
  }
});

test("M10 still decides restart and punishment independently of the episode", () => {
  // Same resolver verdict, two places on the court: the consequences differ
  // because M10 read them, not because the episode said anything about them.
  const run = (seed: number) => simulatePossession({ seed, initialState: TOP });
  // Widened for M21: the attack commits more, so the mix of organized fouls
  // changed and a 400-seed window no longer reliably contains both punishments.
  // The assertion below is the point of the test and is kept intact.
  const awards = [];
  for (let seed = 1; seed <= 500 && awards.length < 40; seed += 1) awards.push(...run(seed).fouls);
  assert.ok(awards.length > 0, "organized play produces fouls to inspect");

  for (const award of awards) {
    assert.ok(award.restart === "FREE_THROW" || award.restart === "SEVEN_METRE");
    assert.ok(award.punishment === "NO_PERSONAL_PUNISHMENT" || award.punishment === "TWO_MINUTES");
    assert.equal(award.suspend, award.punishment === "TWO_MINUTES");
    // The restart tracks the destroyed chance and nothing else.
    assert.equal(award.restart === "SEVEN_METRE", award.destroyedClearChance);
  }
  // Both axes genuinely vary, so this is not passing on a single shape of foul.
  assert.ok(new Set(awards.map((a) => a.punishment)).size > 1, "punishment is not constant across fouls");
});

// ---------------------------------------------------------------------------
// 6. Through the real engine
// ---------------------------------------------------------------------------

test("a possession decides exactly as many duels as it contained", () => {
  // The invariant, end to end and in the real engine. One episode, one
  // decision -- so these two counters can never come apart. If a per-step
  // lottery ever returns anywhere in the loop, this is what catches it.
  let contacts = 0;
  for (let seed = 1; seed <= 200; seed += 1) {
    const result = simulatePossession({ seed, initialState: TOP });
    assert.equal(
      result.resolvedContacts,
      result.contacts,
      `seed ${seed}: ${result.resolvedContacts} decisions over ${result.contacts} episodes`,
    );
    contacts += result.contacts;
  }
  assert.ok(contacts > 0, "the sample contains real contact");
});

// ---------------------------------------------------------------------------
// 7. Determinism and symmetry
// ---------------------------------------------------------------------------

test("the same seed resolves the same duels", () => {
  for (const seed of [7, 41, 109]) {
    const a = simulatePossession({ seed, initialState: TOP });
    const b = simulatePossession({ seed, initialState: TOP });
    assert.equal(a.contacts, b.contacts);
    assert.equal(a.resolvedContacts, b.resolvedContacts);
    assert.deepEqual(a.fouls, b.fouls);
    assert.equal(a.outcome, b.outcome);
  }
});

test("resolution reads the same situation the same way at either end of the court", () => {
  const mirror = (p: MeterPoint): MeterPoint => ({ x: p.x, y: mirrorYForOppositeGoalSide(p.y) });
  const attackers = { V9: { x: 7, y: 9 } };
  const defenders = { L3: { x: 7, y: 8 } };
  const top = scenario({ ballCarrier: "V9", attackers, defenders, phase: "ATTACK_ACTION" }).handball;
  const bottom = scenario({
    ballCarrier: "V9",
    attackingGoalSide: "BOTTOM",
    attackers: { V9: mirror(attackers.V9) },
    defenders: { L3: mirror(defenders.L3) },
    phase: "ATTACK_ACTION",
  }).handball;

  const a = organizedContactContext(top, requireScenarioPlayer(top, "V9"), "TOP");
  const b = organizedContactContext(bottom, requireScenarioPlayer(bottom, "V9"), "BOTTOM");
  assert.ok(a && b);
  assert.equal(a.posture, b.posture, "the same duel at either goal");
  assert.deepEqual(outcomeMix(a), outcomeMix(b), "and therefore the same resolution mix");
});
