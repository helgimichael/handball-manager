// MATCH-EXPERIENCE-2.0 M18: defensive reach and contact.
//
// The test that must never be deleted is "a contact context never decides a
// foul". The whole risk of naming a situation LEGAL_CONTACT or BEATEN is that
// somebody starts reading the name as a verdict -- "beaten, therefore a foul,
// therefore two minutes". It is a description of who met whom, from which side,
// how late. M10 still decides the restart, and independently the punishment.
//
// The second thing under test is the reason M18 exists: presence inside a
// radius is not pressure. Every proof below puts two defenders at the SAME
// distance from the carrier and shows the model separating them by what they
// are actually doing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scenario, requireScenarioPlayer } from "../scenarios/matchScenario";
import { evaluateSixZeroDefense } from "../policies/defense/sixZeroDefensePolicy";
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import {
  CLOSING_SPEED_METERS_PER_SECOND,
  contactSituation,
  defensiveReaches,
  organizedContactContext,
} from "./defensiveReach";
import { judgeFoul } from "./foulDecision";
import type { AttackGapId } from "../domain/geometry/attackGaps";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { HandballState } from "../domain/handball/state";
import type { PlayerRef } from "../scenarios/matchScenario";

/**
 * The same situation with one player given a velocity.
 *
 * M16's fixtures place people; motion is what M18 is about, so a test that
 * wants "same distance, different motion" has to say so here. Nothing else in
 * the state is touched.
 */
function moving(state: HandballState, ref: PlayerRef, velocity: MeterPoint): HandballState {
  const target = requireScenarioPlayer(state, ref);
  return {
    ...state,
    players: state.players.map((p) => (p.id === target.id ? { ...p, velocity: { ...velocity } } : p)),
  };
}

/** M16's fixture builds a full-court match state; the reach model reads the handball state inside it. */
function sc(spec: Parameters<typeof scenario>[0]): HandballState {
  return scenario(spec).handball;
}

/**
 * The same situation with the carrier actually driving a gap.
 *
 * A placed attacker is standing still, and a defence with nobody to stop has no
 * primary defender and so never makes a step-out decision at all. The drive is
 * the whole point of the step-out test, so it has to be stated.
 */
function driving(state: HandballState, ref: PlayerRef, gapId: AttackGapId, target: MeterPoint): HandballState {
  const carrier = requireScenarioPlayer(state, ref);
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === carrier.id ? { ...p, intent: { type: "ATTACK" as const, gapId, target: { ...target }, completed: false } } : p,
    ),
  };
}

function reachOf(state: HandballState, carrierRef: PlayerRef, defenderRef: PlayerRef) {
  const carrier = requireScenarioPlayer(state, carrierRef);
  const defender = requireScenarioPlayer(state, defenderRef);
  const reach = defensiveReaches(state, carrier, "TOP").find((r) => r.defenderId === defender.id);
  assert.ok(reach, `${String(defenderRef)} has a reach reading`);
  return reach;
}

// A carrier driving the left gap, with the two defenders either side of him
// placed at deliberately equal distance.
const DRIVE = {
  ballCarrier: "V9" as const,
  attackers: { V9: { x: 7, y: 10 } },
  defenders: { L3: { x: 7, y: 8 }, L2: { x: 5, y: 10 } },
  phase: "ATTACK_ACTION" as const,
};

// ---------------------------------------------------------------------------
// 1. Same distance, different motion
// ---------------------------------------------------------------------------

test("two defenders the same distance away are not in the same defensive situation", () => {
  const still = sc(DRIVE);
  const l3 = requireScenarioPlayer(still, "L3");
  const l2 = requireScenarioPlayer(still, "L2");
  const carrier = requireScenarioPlayer(still, "V9");
  assert.equal(
    Math.round(Math.hypot(l3.position.x - carrier.position.x, l3.position.y - carrier.position.y) * 100),
    Math.round(Math.hypot(l2.position.x - carrier.position.x, l2.position.y - carrier.position.y) * 100),
    "the fixture puts both defenders exactly 2m away",
  );

  // Now give one of them motion toward the play and the other motion away from
  // it. Distance has not changed at all; the situation has changed entirely.
  // The attacked goal is at y=0, so running at the play means running toward it.
  const closing = moving(still, "L3", { x: 0, y: -3 });
  const retreating = moving(still, "L3", { x: 0, y: 3 });

  const closingReach = reachOf(closing, "V9", "L3");
  const retreatingReach = reachOf(retreating, "V9", "L3");

  assert.equal(closingReach.separationMeters, retreatingReach.separationMeters, "same distance in both readings");
  assert.ok(
    closingReach.defenderSeconds < retreatingReach.defenderSeconds,
    `running at the play arrives sooner than running away from it (${closingReach.defenderSeconds.toFixed(2)}s vs ${retreatingReach.defenderSeconds.toFixed(2)}s)`,
  );
  assert.ok(
    closingReach.marginSeconds > retreatingReach.marginSeconds,
    "and so wins more of the race to the meeting point",
  );
});

// ---------------------------------------------------------------------------
// 2. Goal-side is a requirement, not a bonus
// ---------------------------------------------------------------------------

test("a defender behind the play cannot engage it however fast he is running", () => {
  // L3 dropped in behind the carrier: nearer the goal line than the man he is
  // supposed to be stopping is what goal-side means, and he is not.
  const behind = moving(
    sc({ ...DRIVE, defenders: { ...DRIVE.defenders, L3: { x: 7, y: 12 } } }),
    "L3",
    { x: 0, y: 4.2 },
  );
  const reach = reachOf(behind, "V9", "L3");
  assert.equal(reach.goalSide, false, "he is on the wrong side of the attacker");
  assert.equal(reach.canEngage, false, "and cannot engage from in front, whatever his speed");
});

// ---------------------------------------------------------------------------
// 3. The three postures
// ---------------------------------------------------------------------------

test("posture separates contained, contested and beaten", () => {
  // Contained: goal-side, in front, and there with time to spare.
  const contained = organizedContactContext(sc(DRIVE), requireScenarioPlayer(sc(DRIVE), "V9"), "TOP");
  assert.ok(contained, "there is a defensive situation");
  assert.equal(contained.posture, "CLEANLY_CONTAINED", "a defender set in front of the drive contains it");

  // Beaten: every defender behind the carrier. Nobody can get goal-side, so
  // nobody is containing anything.
  const beatenState = sc({
    ...DRIVE,
    attackers: { V9: { x: 7, y: 7 } },
    defenders: { L3: { x: 7, y: 10 }, L2: { x: 5, y: 10.5 }, L1: { x: 3, y: 11 }, R3: { x: 9, y: 11 }, R2: { x: 13, y: 11 }, R1: { x: 16, y: 11 } },
  });
  const beaten = organizedContactContext(beatenState, requireScenarioPlayer(beatenState, "V9"), "TOP");
  assert.ok(beaten, "there is still a situation");
  assert.equal(beaten.posture, "BEATEN", "with the whole line behind him, the defence has been beaten");
});

// ---------------------------------------------------------------------------
// 4. Presence is not pressure
// ---------------------------------------------------------------------------

test("a beaten defender is only in contact while he is actually closing", () => {
  const base = sc({
    ...DRIVE,
    attackers: { V9: { x: 7, y: 7 } },
    defenders: { L3: { x: 7, y: 8.2 }, L2: { x: 5, y: 10.5 }, L1: { x: 3, y: 11 }, R3: { x: 9, y: 11 }, R2: { x: 13, y: 11 }, R1: { x: 16, y: 11 } },
  });
  const carrierOf = (s: HandballState) => requireScenarioPlayer(s, "V9");

  const trailing = moving(base, "L3", { x: 0, y: 0 });
  const trailingContext = organizedContactContext(trailing, carrierOf(trailing), "TOP");
  assert.equal(trailingContext?.posture, "BEATEN", "he has been gone past");
  assert.ok(trailingContext.inContact, "and he is well within arm's length");
  assert.equal(
    contactSituation(trailing, carrierOf(trailing), "TOP"),
    null,
    "but standing 1.2m behind the play is presence, not pressure -- exactly the fixed-radius reading M18 removes",
  );

  // The same man, the same distance, now recovering after him.
  const recovering = moving(base, "L3", { x: 0, y: -CLOSING_SPEED_METERS_PER_SECOND * 2 });
  const recoveringContext = contactSituation(recovering, carrierOf(recovering), "TOP");
  assert.ok(recoveringContext, "a beaten defender chasing back into the man IS contact");
  assert.equal(recoveringContext.posture, "BEATEN", "and it is still typed as what it is");
  assert.ok(recoveringContext.closingSpeed >= CLOSING_SPEED_METERS_PER_SECOND, "because he is arriving, not merely near");
});

// ---------------------------------------------------------------------------
// 5. Help
// ---------------------------------------------------------------------------

test("help is a second defender, and whether he arrives depends on where he is", () => {
  const near = sc({ ...DRIVE, defenders: { L3: { x: 7, y: 8 }, L2: { x: 8.2, y: 8.2 } } });
  const far = sc({ ...DRIVE, defenders: { L3: { x: 7, y: 8 }, L2: { x: 17, y: 8.2 } } });

  const withHelp = organizedContactContext(near, requireScenarioPlayer(near, "V9"), "TOP");
  const withoutHelp = organizedContactContext(far, requireScenarioPlayer(far, "V9"), "TOP");
  assert.ok(withHelp && withoutHelp);

  assert.notEqual(withHelp.helpDefenderId, withHelp.defenderId, "the helper is never the man in the duel");
  assert.ok(withHelp.helpArrives, "a covering defender a metre away gets there");
  assert.ok(
    withHelp.helpMarginSeconds > withoutHelp.helpMarginSeconds,
    `and gets there earlier than one across the court (${withHelp.helpMarginSeconds.toFixed(2)}s vs ${withoutHelp.helpMarginSeconds.toFixed(2)}s)`,
  );
});

// ---------------------------------------------------------------------------
// 6. The step-out decision
// ---------------------------------------------------------------------------

test("a defender declines only the step-out he has genuinely lost", () => {
  // A real drive at the V2/V3 gap, because a defence with nobody to stop makes
  // no step-out decision at all.
  const target = { x: 7, y: 6.2 };
  const primaryReaction = (state: HandballState) => {
    const result = evaluateSixZeroDefense(driving(state, "V9", "V2_V3", target));
    const primaryId = result.primaryDefenderId;
    assert.ok(primaryId, "somebody is responsible for the drive");
    const reaction = result.reactions.find((r) => r.defenderId === primaryId);
    assert.ok(reaction, "and he has a reaction");
    return reaction;
  };

  // Slightly late: he still shows himself. A 6:0 defender arriving a fraction
  // behind the ball is normal defending, and turning that into a recovery
  // would make the whole line passive.
  // A whole 6:0 line at depth `y`, so that the man made responsible for the
  // drive is the one whose race is being tested -- displacing a single defender
  // instead just hands responsibility to a better-placed colleague, which is the
  // 6:0 covering for him and not a step-out decision at all.
  const lineAt = (y: number) => ({ L1: { x: 2.5, y }, L2: { x: 5, y }, L3: { x: 7.5, y }, R3: { x: 10, y }, R2: { x: 12.5, y }, R1: { x: 15, y } });

  const contested = primaryReaction(sc({ ...DRIVE, attackers: { V9: { x: 7, y: 8 } }, defenders: lineAt(11) }));
  assert.notEqual(contested.reactionType, "RECOVER", "a race he is only just losing is still worth contesting");

  // Hopelessly late: the carrier is through and the line is metres behind him.
  // Stepping out now would only vacate the gap he is meant to be guarding.
  const lost = primaryReaction(sc({ ...DRIVE, attackers: { V9: { x: 7, y: 8 } }, defenders: lineAt(16) }));
  assert.equal(lost.reactionType, "RECOVER", "a race lost by a wide margin is refused, and he goes back to his line");
});

test("declining lost step-outs does not turn the 6:0 into man-to-man", () => {
  // The whole line, against an ordinary organized drive: the defence must still
  // be a line doing different jobs, not six men each chasing an attacker.
  const state = sc(DRIVE);
  const reactions = evaluateSixZeroDefense(state).reactions;
  const engaging = reactions.filter((r) => r.reactionType === "ENGAGE" || r.reactionType === "PRESS");
  assert.ok(engaging.length <= 2, `at most a man and his help step out, not the line (${engaging.length} did)`);
  assert.ok(
    new Set(reactions.map((r) => r.reactionType)).size > 1,
    "and the rest are doing something else -- shifting, supporting, holding the pivot",
  );
});

// ---------------------------------------------------------------------------
// 7. The rules layer is still the rules layer
// ---------------------------------------------------------------------------

test("a contact context never decides a foul", () => {
  // Structural, and deliberately so. The context is geometry and timing; if
  // this module ever learns the words for a verdict, the separation M10 was
  // built for has been lost.
  const source = readFileSync("src/simulation/defensiveReach.ts", "utf8");
  for (const forbidden of ["judgeFoul", "SEVEN_METRE", "FREE_THROW", "TWO_MINUTES", "suspend"]) {
    assert.ok(!source.includes(forbidden), `defensiveReach.ts must not mention ${forbidden}`);
  }

  const state = sc(DRIVE);
  const context = organizedContactContext(state, requireScenarioPlayer(state, "V9"), "TOP");
  assert.ok(context);
  // Every field is a fact about the two players. None is an award.
  assert.deepEqual(
    Object.keys(context).sort(),
    ["closingSpeed", "defenderId", "helpArrives", "helpDefenderId", "helpMarginSeconds", "inContact", "posture", "reach"],
    "the context says who met whom and how, and nothing about what is given for it",
  );
});

test("posture describes the contact; M10 alone decides what it costs", () => {
  // The same defender, the same challenge, at two distances from goal. If the
  // posture were driving the verdict these would agree; they must not.
  // The rest of the line is off the court, so the only thing separating the two
  // situations is the one M10 actually reads: how far from goal it happened.
  const award = (carrierY: number) => {
    const state = sc({
      ...DRIVE,
      attackers: { V9: { x: 7, y: carrierY } },
      defenders: { L3: { x: 7, y: carrierY - 1 } },
      without: ["L1", "L2", "R3", "R2", "R1"],
    });
    const carrier = requireScenarioPlayer(state, "V9");
    const defender = requireScenarioPlayer(state, "L3");
    const context = organizedContactContext(state, carrier, "TOP");
    assert.ok(context);
    return { posture: context.posture, award: judgeFoul(state, carrier, defender, "TOP", 0) };
  };

  const close = award(6.5);
  const far = award(16);
  assert.equal(close.posture, far.posture, "the two contacts are the same kind of contact");
  assert.notEqual(close.award.restart, far.award.restart, "but M10 gives a different restart, from its own reading of the chance");

  // And the two halves of M10's verdict stay independent of each other: a
  // restart is not a punishment and a punishment is not a restart.
  for (const { award: given } of [close, far]) {
    assert.ok(given.restart === "FREE_THROW" || given.restart === "SEVEN_METRE");
    assert.ok(given.punishment === "NO_PERSONAL_PUNISHMENT" || given.punishment === "TWO_MINUTES");
  }
});

// ---------------------------------------------------------------------------
// 8. Mirrored court
// ---------------------------------------------------------------------------

test("the same situation reads the same attacking either goal", () => {
  const mirror = (p: MeterPoint): MeterPoint => ({ x: p.x, y: mirrorYForOppositeGoalSide(p.y) });
  const top = sc(DRIVE);
  const bottom = sc({
    ...DRIVE,
    attackingGoalSide: "BOTTOM",
    attackers: { V9: mirror(DRIVE.attackers.V9) },
    defenders: { L3: mirror(DRIVE.defenders.L3), L2: mirror(DRIVE.defenders.L2) },
  });

  const a = organizedContactContext(top, requireScenarioPlayer(top, "V9"), "TOP");
  const b = organizedContactContext(bottom, requireScenarioPlayer(bottom, "V9"), "BOTTOM");
  assert.ok(a && b);
  assert.equal(a.posture, b.posture, "the same defensive situation, whichever end it happens at");
  assert.equal(a.reach.marginSeconds.toFixed(6), b.reach.marginSeconds.toFixed(6), "and the same race");
  assert.equal(a.reach.separationMeters.toFixed(6), b.reach.separationMeters.toFixed(6), "and the same distance");
});

// ---------------------------------------------------------------------------
// 9. Determinism
// ---------------------------------------------------------------------------

test("the same situation always reads the same way", () => {
  const state = sc(DRIVE);
  const carrier = requireScenarioPlayer(state, "V9");
  const once = defensiveReaches(state, carrier, "TOP");
  const twice = defensiveReaches(state, carrier, "TOP");
  assert.deepEqual(once, twice, "pure, ordered, and free of any clock");
  assert.deepEqual(
    once.map((r) => r.defenderId),
    [...once].sort((a, b) => a.defenderSeconds - b.defenderSeconds || a.defenderId.localeCompare(b.defenderId)).map((r) => r.defenderId),
    "quickest first, ties broken on id",
  );
});
