/**
 * MATCH-EXPERIENCE-2.0 M25: WHAT A PLAYER HAS LEFT.
 *
 * One number per player, between 0 and 1, and it is about this match only.
 *
 * WHAT IT IS. A record of the work he has actually done. It goes down when he
 * runs -- more when he sprints, much more when he is repeatedly getting back up
 * to speed -- and it comes back when he rests. It is not a rating, it is not a
 * modifier, and nothing consults it to decide whether a shot goes in.
 *
 * WHAT IT DOES. Exactly one thing: it scales how fast he can move and how
 * quickly he can get there. That is deliberately the only channel, and it is
 * why the rest of the engine needed no changes at all to feel it. M17 asks how
 * long a man takes to reach a point; a tired man takes longer. M18's defensive
 * reach, M19's contact, M8's break races, M7's step-outs and every attacking
 * run are all built on that same question, so all of them get slower for a
 * tired player without a single line of fatigue code in any of them.
 *
 * WHAT IT DELIBERATELY IS NOT. There is no `if (tired) missProbability += x`
 * anywhere, and there must not be. A tired shooter in this model misses more
 * because he arrives at worse positions and is caught more often, not because a
 * number was subtracted from him at the moment he shot. If fatigue ever needs
 * to reach execution as well, that is a later milestone making a deliberate
 * decision -- not this one leaking.
 */
import { DEFAULT_MOVEMENT_PROFILE } from "../domain/handball/movement";
import type { MovementProfile } from "../domain/handball/movement";
import type { Player } from "../domain/handball/player";

/** Nobody drops below this: an exhausted handball player is slow, not stationary. */
export const MINIMUM_CONDITION = 0.55;

/**
 * How much of his movement a player at zero condition still has.
 *
 * Fatigue costs a fraction of his capability, not most of it. A top handball
 * player at the end of sixty minutes is perceptibly slower off the mark and
 * half a step short of where he was; he is not a different athlete. The floor
 * above means the worst case actually reached is around 0.9 of top speed and
 * 0.82 of acceleration.
 */
const SPEED_AT_EMPTY = 0.78;
const ACCELERATION_AT_EMPTY = 0.6;

/**
 * The condition a player is at when nothing has said otherwise.
 *
 * Absent condition means a full tank, which is what makes every state built
 * before M25 -- every fixture, every scenario, every half-court test -- behave
 * exactly as it did.
 */
export const FULL_CONDITION = 1;

export function conditionOf(player: Player): number {
  return player.condition ?? FULL_CONDITION;
}

/**
 * The movement he can actually produce right now.
 *
 * The single place condition becomes physics. Everything else in the engine
 * reads a movement profile; this is the profile it should read.
 */
export function effectiveMovementProfile(player: Player): MovementProfile {
  const condition = conditionOf(player);
  if (condition >= FULL_CONDITION) return player.movementProfile;
  const scale = (atEmpty: number) => atEmpty + (1 - atEmpty) * condition;
  return {
    maxSpeed: player.movementProfile.maxSpeed * scale(SPEED_AT_EMPTY),
    acceleration: player.movementProfile.acceleration * scale(ACCELERATION_AT_EMPTY),
    deceleration: player.movementProfile.deceleration,
  };
}

// ---------------------------------------------------------------------------
// Losing it
// ---------------------------------------------------------------------------

/**
 * Condition lost per second by a player doing nothing at all.
 *
 * Small, and present on purpose: standing on a handball court for sixty minutes
 * is not free. Over a full match this alone costs about 0.07, which is the
 * difference between a man who has been on the whole way and a man who came on
 * fresh -- before any running is counted.
 */
const IDLE_COST_PER_SECOND = 0.00002;

/**
 * Condition lost per metre run, at the reference speed below.
 *
 * The dominant term, and the one that makes this a model of WORK rather than of
 * time. A player who covers four kilometres in a match pays for four
 * kilometres; a pivot who stands on the line and wrestles pays for what he
 * actually moved.
 */
const COST_PER_METER = 0.000075;

/**
 * Above this speed a metre costs more than a metre.
 *
 * Sprinting is not jogging twice as fast: the cost per metre rises with speed,
 * which is why a player who repeatedly breaks is emptied by a match that a
 * player who trots through it finishes comfortably.
 */
const SPRINT_THRESHOLD_METERS_PER_SECOND = 2.8;
/** How much dearer a metre gets at full speed than at the threshold. */
const SPRINT_SURCHARGE = 2.4;

/**
 * Extra cost for changing speed, per metre per second of change.
 *
 * Accelerating is the expensive part of handball -- a defender stepping out and
 * recovering, a winger going again -- and a model that only counted distance
 * would price a man who runs in a straight line the same as one who is
 * constantly starting and stopping.
 */
const ACCELERATION_COST = 0.00004;

/**
 * What one fixed step of actual movement costs this player.
 *
 * Read from what he DID: how far he moved this step, how fast he was going, and
 * how much his speed changed. Nothing here consults his role, his team or the
 * clock.
 */
export function exertionCost(distanceMeters: number, speedMetersPerSecond: number, speedChange: number, dt: number): number {
  const sprintFactor =
    speedMetersPerSecond <= SPRINT_THRESHOLD_METERS_PER_SECOND
      ? 1
      : 1 +
        SPRINT_SURCHARGE *
          Math.min(1, (speedMetersPerSecond - SPRINT_THRESHOLD_METERS_PER_SECOND) / SPRINT_THRESHOLD_METERS_PER_SECOND);
  return IDLE_COST_PER_SECOND * dt + COST_PER_METER * distanceMeters * sprintFactor + ACCELERATION_COST * Math.abs(speedChange);
}

/**
 * A goalkeeper's work is not an outfield player's work.
 *
 * He covers a fraction of the ground and spends the match in a few square
 * metres, so the same movement costs him less -- but it is the SAME model
 * reading the same movement, not a separate keeper physiology. He tires; he
 * just does not tire like a wing.
 */
const GOALKEEPER_EXERTION_FRACTION = 0.35;

/**
 * The player, one fixed step later, having paid for the ground he covered.
 *
 * A player with NO condition value does not have one, and this leaves him
 * exactly as he was. That is what makes the whole model inert until somebody
 * switches it on: every fixture, scenario and half-court state written before
 * M25 has no condition, so it fatigues nobody and behaves identically. Fatigue
 * exists for a match that decided to have it.
 */
export function applyExertion(player: Player, distanceMeters: number, speedChange: number, dt: number): Player {
  if (player.condition === undefined) return player;
  const speedNow = Math.hypot(player.velocity.x, player.velocity.y);
  const cost =
    exertionCost(distanceMeters, speedNow, speedChange, dt) *
    (player.kind === "GOALKEEPER" ? GOALKEEPER_EXERTION_FRACTION : 1);
  const next = Math.max(MINIMUM_CONDITION, conditionOf(player) - cost);
  return next === conditionOf(player) ? player : { ...player, condition: next };
}

// ---------------------------------------------------------------------------
// Getting it back
// ---------------------------------------------------------------------------

/**
 * Condition recovered per second sitting on the bench.
 *
 * Deliberately slower than it is lost by a working player, and deliberately not
 * instant: about three minutes off the court buys back roughly a fifth of a
 * tank, which is enough to make a rotation worth something and not enough to
 * make it free. A man who has emptied himself does not come back new.
 */
const BENCH_RECOVERY_PER_SECOND = 0.0011;

/**
 * And a smaller trickle for a player still on the court during a stoppage.
 *
 * A timeout or a dead ball is not rest, but it is not work either. Small enough
 * that nobody recovers a match by standing about.
 */
const STOPPAGE_RECOVERY_PER_SECOND = 0.00025;

/** The same player, `seconds` of bench rest later. */
export function recoverOnBench(player: Player, seconds: number): Player {
  return recovered(player, seconds * BENCH_RECOVERY_PER_SECOND);
}

/** The same player, `seconds` of stoppage later, still on the court. */
export function recoverDuringStoppage(player: Player, seconds: number): Player {
  return recovered(player, seconds * STOPPAGE_RECOVERY_PER_SECOND);
}

function recovered(player: Player, amount: number): Player {
  // Same rule as exertion: a player without a condition value has nothing to
  // recover, and a match played without fatigue is untouched by this.
  if (player.condition === undefined) return player;
  const current = conditionOf(player);
  if (current >= FULL_CONDITION || amount <= 0) return player;
  return { ...player, condition: Math.min(FULL_CONDITION, current + amount) };
}

// ---------------------------------------------------------------------------
// Looking at it
// ---------------------------------------------------------------------------

/**
 * What a coach -- or a test -- can see about a player's condition.
 *
 * M25 owes M12 an observation and not a decision. This is that observation:
 * the number, and what it has actually done to him, in the units the rest of
 * the engine works in. Nothing here recommends a substitution.
 */
export type ConditionReading = {
  readonly playerId: string;
  readonly condition: number;
  readonly maxSpeed: number;
  readonly acceleration: number;
  /** How much of his fresh top speed he still has, as a fraction. */
  readonly speedRetained: number;
};

export function readCondition(player: Player): ConditionReading {
  const effective = effectiveMovementProfile(player);
  const fresh = player.movementProfile.maxSpeed || DEFAULT_MOVEMENT_PROFILE.maxSpeed;
  return {
    playerId: player.id,
    condition: conditionOf(player),
    maxSpeed: effective.maxSpeed,
    acceleration: effective.acceleration,
    speedRetained: effective.maxSpeed / fresh,
  };
}
