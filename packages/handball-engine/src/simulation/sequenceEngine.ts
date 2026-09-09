/**
 * MATCH-EXPERIENCE-2.0 M2: the transition loop, and the continuous sequence
 * that joins an organized possession to the transition it causes.
 * M8: the decisions inside that transition.
 *
 * The required dependency, end to end and without reconstruction:
 *
 *   SAVE / TURNOVER
 *     -> possession changes (same ball, same positions, flipped direction)
 *     -> players react (roles and facing switch)
 *     -> defensive retreat (real x/y movement toward their own goal)
 *     -> first wave (outlet, then runners accelerating into open space)
 *     -> the attacking team advances through the full court
 *     -> the transition resolves, or settles into an organized attack
 *
 * Spatial advantage is EARNED: whether a break produces a shot depends on
 * whether a runner is actually clear of the retreating defenders at the moment
 * he arrives, measured from their real positions -- never rolled for.
 *
 * M8 -- TRANSITION INTELLIGENCE. M2 ran everybody at the goal and threw the
 * ball to whoever happened to be furthest forward. Now the regain is READ:
 *
 *   REGAIN -> READ NUMBERS + SPACE -> ASSIGN RUNNING ROLES -> ADVANCE BALL
 *     -> DEFENSIVE RETREAT -> RE-EVALUATE
 *     -> FINISH / SECOND WAVE / EARLY OFFENSE / ORGANIZED ATTACK
 *
 * transitionDecision.ts owns the reading; this module remains the loop. The
 * outlet is scored against real passing lanes and thrown through the SAME
 * pass-risk model an organized attack uses, so a long ball into a covered lane
 * is intercepted rather than assumed to arrive. The carrier re-evaluates while
 * he runs, and when the numbers have gone the break slows into early offense
 * instead of manufacturing a shot.
 *
 * BOTH GOALS ARE DEFENDED. The canonical full-court scenario carries two
 * goalkeepers, one in each goal, so a transition shot at the far end is always
 * faced by that end's keeper and a derived event never reports a null
 * goalkeeper. A keeper keeps his kind and role through a change of possession:
 * his TEAM flips with everyone else's, but he never becomes an outfield player
 * and is never given a running order.
 */
import { SIMULATION_DT_SECONDS } from "./fixedStep";
import { createPossessionRng } from "./possessionRng";
import { distanceBetween } from "../domain/geometry/coordinates";
import {
  MAX_POSSESSION_STEPS,
  deriveMatchEvent,
  resolvePass,
  resolveShot,
  takeSevenMetre,
  simulatePossession,
  type PossessionMatchEvent,
  type PossessionResult,
  type PossessionTraceEntry,
  type SimulatePossessionInput,
} from "./possessionEngine";
import { defenceHasRecovered, defenceIsSet, switchPossession } from "./transition";
import { judgeFoul, sevenMetreMark, type FoulAward } from "./foulDecision";
import { sixZeroHomePosition } from "./organizedAttack";
import { goalkeeperSetPosition } from "../policies/goalkeeper/goalkeeperPolicy";
import {
  BREAK_SHOT_RANGE_METERS,
  MAX_OUTLET_HOLD_STEPS,
  OUTLET_WORTH_PLAYING_SCORE,
  assignRetreatRoles,
  assignRunningRoles,
  decideBreakAction,
  decideOutlet,
  describeNumbers,
  describeRetreat,
  describeRunning,
  findSecondWaveRunner,
  perceiveTransition,
  retreatTargetFor,
  runningTarget,
  type RetreatAssignment,
  type RunningAssignment,
} from "./transitionDecision";
import {
  changesPossession,
  defendedGoalSide,
  goalCentre,
  type FullCourtMatchState,
  type PossessionOutcome,
  type PossessionPhase,
} from "../domain/match/possession";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { HandballAction } from "../domain/handball/actions";
import type { HandballState } from "../domain/handball/state";
import { settleArrivedExchanges, stepWithSubstitutions } from "./substitutionExit";
import { keeperRecoveryActions } from "./sevenVsSix";
import { goalAreaRecoveryActions, landAfterRelease, releaseRequiredBefore } from "./shotRelease";
import { COURT_LENGTH_METERS, COURT_WIDTH_METERS } from "../domain/geometry/court";
import { insideAnyGoalArea } from "../domain/geometry/goalArea";
import type { DefenseRole, Player } from "../domain/handball/player";

/** How often the carrier re-reads the break, in fixed steps (0.3s). */
const REEVALUATE_STEPS = 6;
/** How often off-ball runners and retreating defenders refresh their targets (0.25s). */
const REFRESH_STEPS = 5;
/** How often the retreat re-assigns its jobs (0.5s), with the sticky roles kept. */
const RETREAT_REASSESS_STEPS = 10;
/**
 * How long early offense may last before the attack is simply set (6s). A
 * bound, not a duration: normally the defence recovering ends it sooner.
 */
const MAX_EARLY_OFFENSE_STEPS = 120;
/** How close to the goal the ball is walked during early offense. */
const ORGANIZED_APPROACH_METERS = 11;

export type SimulateTransitionInput = {
  readonly seed: number;
  /** The state produced by switchPossession -- already flipped, never re-formed. */
  readonly initialState: FullCourtMatchState;
  readonly ratings?: SimulatePossessionInput["ratings"];
  readonly maxSteps?: number;
};

export type TransitionResult = {
  readonly outcome: PossessionOutcome;
  readonly finalState: FullCourtMatchState;
  readonly trace: readonly PossessionTraceEntry[];
  readonly resolvingPlayerId: string | null;
  readonly goalkeeperId: string | null;
  readonly shotOrigin: MeterPoint | null;
  /** M15: the defender who blocked the shot, when one did. */
  readonly shotBlockedByDefenderId: string | null;
  readonly steps: number;
  readonly guardTripped: boolean;
  /** M10: fouls the referee gave during the transition. */
  readonly fouls: readonly FoulAward[];
  readonly sevenMetreTaken: boolean;
};

function positionsOf(state: HandballState): PossessionTraceEntry["playerPositions"] {
  return state.players.map((p) => ({ playerId: p.id, position: { ...p.position } }));
}

function findPlayer(state: HandballState, id: string | null): Player | undefined {
  return id === null ? undefined : state.players.find((p) => p.id === id);
}

function goalkeeperOf(state: HandballState, team: "ATTACK" | "DEFENSE"): Player | undefined {
  return state.players.find((p) => p.team === team && p.kind === "GOALKEEPER");
}

/**
 * Per-step probability that a recovering defender at `distance` metres takes
 * the ball off the breaking carrier. Zero beyond CATCH_RANGE_METERS, rising as
 * he closes.
 */
const CATCH_RANGE_METERS = 1.5;
function catchProbability(distance: number): number {
  if (distance >= CATCH_RANGE_METERS) return 0;
  return ((CATCH_RANGE_METERS - distance) / CATCH_RANGE_METERS) * 0.02;
}

/** Nearest defender to a point, and how far away they are. */
function nearestDefender(
  state: HandballState,
  point: MeterPoint,
  /** QA FIX 2A: for a regain, skip men standing where they may not play it. */
  options: { readonly legalGroundOnly?: boolean } = {},
): { distance: number; id: string | null } {
  let best = Number.POSITIVE_INFINITY;
  let id: string | null = null;
  const candidates = state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER");
  const eligible = options.legalGroundOnly ? candidates.filter((p) => !insideAnyGoalArea(p.position)) : candidates;
  for (const d of (eligible.length > 0 ? eligible : candidates)) {
    const distance = distanceBetween(d.position, point);
    if (distance < best) {
      best = distance;
      id = d.id;
    }
  }
  return { distance: Number.isFinite(best) ? best : 99, id };
}

/**
 * Runs one transition from a completed possession switch to a terminal outcome.
 * Pure and deterministic for a given seed and starting state.
 */
export function simulateTransition(input: SimulateTransitionInput): TransitionResult {
  const rng = createPossessionRng(input.seed);
  const maxSteps = input.maxSteps ?? MAX_POSSESSION_STEPS;
  const attackingGoal = input.initialState.possession.attackingGoalSide;
  // The defending team defends the goal the attackers are ATTACKING -- not the
  // opposite one. Getting this backwards made the retreat run toward the goal
  // the team had just been defending, so it never left the ball carrier and
  // every break died within a couple of seconds.
  const defendedGoal = defendedGoalSide(attackingGoal);
  const goal = goalCentre(attackingGoal);
  const ratings = input.ratings;

  let handball = input.initialState.handball;
  let phase: PossessionPhase = "POSSESSION_CHANGE";
  let completed = false;
  let outcome: PossessionOutcome | null = null;
  let resolvingPlayerId: string | null = null;
  let shotOrigin: MeterPoint | null = null;
  let shotBlockedByDefenderId: string | null = null;
  let steps = 0;
  let guardTripped = false;
  const fouls: FoulAward[] = [];
  let sevenMetreTaken = false;
  const trace: PossessionTraceEntry[] = [];

  // The reading of the break, assigned at the regain and refreshed as it runs.
  let running: RunningAssignment[] = [];
  let retreat: RetreatAssignment[] = [];
  let nextReevaluateStep = 0;
  let nextRefreshStep = 0;
  let nextRetreatAssessStep = RETREAT_REASSESS_STEPS;
  let secondWaveUsed = false;
  let outletHoldStartedAt = 0;
  let outletLookedUp = false;
  let earlyOffenseStartedAt = -1;

  function record(note: string): void {
    trace.push({
      simulationTime: Number(handball.simulationTime.toFixed(4)),
      phase,
      ballPossessorId: handball.ball.possessorId,
      ballStatus: handball.ball.status,
      ballPosition: { ...handball.ball.position },
      playerPositions: positionsOf(handball),
      primaryDefenderId: null,
      note,
    });
  }

  /**
   * MOVE commands for everyone who is not carrying the ball: runners to their
   * lane at their wave's depth, defenders to whatever their retreat job is.
   * Refreshed as positions change, so nobody stops on an old target.
   */
  function offBallActions(carrierId: string | null, settling = false): HandballAction[] {
    const perception = perceiveTransition(handball, attackingGoal);
    const actions: HandballAction[] = [];
    for (const assignment of running) {
      if (assignment.playerId === carrierId) continue;
      const player = findPlayer(handball, assignment.playerId);
      if (!player || player.kind === "GOALKEEPER") continue;
      actions.push({ type: "MOVE", playerId: player.id, target: runningTarget(assignment, attackingGoal) });
    }
    for (const assignment of retreat) {
      const defender = findPlayer(handball, assignment.defenderId);
      if (!defender || defender.kind === "GOALKEEPER") continue;
      // Once the break is dead, the retreat jobs are over. Marking a trailer
      // 22m from goal is a transition job, not a defensive one, and leaving it
      // running was measurably wrong: the "defensive line" the following
      // organized attack faced was spread twenty metres down the court. In
      // early offense everybody recovers into the canonical 6:0 instead, which
      // is the shape M7's collective defence then takes over.
      const home = settling ? sixZeroHomePosition(defender.role as DefenseRole, defendedGoal) : null;
      actions.push({
        type: "MOVE",
        playerId: defender.id,
        target: home ?? retreatTargetFor(assignment, defender, perception, handball),
      });
    }
    // M9: the goalkeeper defending this end tracks the ball as the break comes
    // at him, so a transition shot is faced by a keeper who has actually set
    // himself rather than one standing where the match started.
    const keeper = handball.players.find((p) => p.team === "DEFENSE" && p.kind === "GOALKEEPER");
    if (keeper && keeper.id !== carrierId) {
      actions.push({ type: "MOVE", playerId: keeper.id, target: goalkeeperSetPosition(handball.ball.position, defendedGoal, ratings, keeper.id) });
    }
    return actions;
  }

  record(`possession changes: ${handball.ball.possessorId} regains, attack now toward the ${attackingGoal} goal`);

  while (!completed && steps < maxSteps) {
    const actions: HandballAction[] = [];
    const carrier = findPlayer(handball, handball.ball.possessorId);
    const perception = perceiveTransition(handball, attackingGoal);

    /**
     * QA FIX 2A: release the shot from `from`, and land.
     *
     * One place for every ending that puts the ball in the air, so the origin
     * reported to the match and the origin M9 resolved from can never drift
     * apart, and so a take-off is the same shot as any other.
     */
    const shootFrom = (shooter: Player, from: MeterPoint, detail: string): void => {
      const event = resolveShot(handball, { ...shooter, position: { ...from } }, attackingGoal, rng, ratings, (flying, note) => {
        handball = flying;
        record(note);
      });
      // The approach is over the instant the ball goes: he lands and recovers
      // rather than carrying on to the goal centre and standing in the D.
      handball = landAfterRelease(event.state, shooter.id);
      const shot = event.resolution;
      shotOrigin = { ...event.origin };
      outcome = shot.outcome;
      resolvingPlayerId = shooter.id;
      shotBlockedByDefenderId = shot.blockedByDefenderId;
      phase = "RESOLUTION";
      record(`${shooter.id} shoots (${detail}) from ${distanceBetween(event.origin, goal).toFixed(2)}m: ${shot.detail}`);
    };

    if (phase === "POSSESSION_CHANGE") {
      // READ NUMBERS + SPACE, then ASSIGN RUNNING ROLES. Both teams react at
      // once: the losing side turns for its own goal with a job each, the
      // winning side breaks forward into distinct lanes. Neither teleports.
      running = assignRunningRoles(perception);
      retreat = assignRetreatRoles(perception, undefined, ratings);
      actions.push(...offBallActions(carrier?.id ?? null));
      outletHoldStartedAt = steps;
      phase = "DEFENSIVE_RETREAT";
      record(`regain read: ${describeNumbers(perception)}`);
      record(`attack: ${describeRunning(running)}`);
      record(`retreat: ${describeRetreat(retreat)}`);
    } else if (phase === "DEFENSIVE_RETREAT" && carrier && handball.ball.status === "POSSESSED") {
      // ADVANCE BALL. The regainer -- usually the goalkeeper after a save --
      // chooses between a safe short ball, a medium one, the long outlet, and
      // (if he is an outfield player) simply carrying it.
      //
      // A GOALKEEPER looks up first. Deciding on the instant of the save is
      // the wrong reading and was measurably so: at that moment nobody has run
      // yet, so no long option can exist and every save produced a short ball.
      // He therefore holds while the break develops, plays the moment somebody
      // is genuinely on, and plays the safe ball if nobody ever is. An
      // OUTFIELD regainer does not stand and look -- he takes the ball and
      // goes, and his "pass or keep going" question is the same one the break
      // re-evaluation already asks every 0.3s while he runs.
      const outlet = decideOutlet(perception, carrier, rng, ratings);
      const chosen = outlet.chosen;
      const held = steps - outletHoldStartedAt;
      const mayHold = carrier.kind === "GOALKEEPER" && held < MAX_OUTLET_HOLD_STEPS;
      if (chosen.score < OUTLET_WORTH_PLAYING_SCORE && mayHold) {
        if (!outletLookedUp) {
          outletLookedUp = true;
          record(`${carrier.id} looks up: ${describeNumbers(perception)}; nothing on yet, the break develops`);
        }
        actions.push(...offBallActions(carrier.id));
      } else if (chosen.targetPlayerId) {
        const receiver = findPlayer(handball, chosen.targetPlayerId);
        const resolution = receiver ? resolvePass(handball, carrier, receiver, rng, ratings) : ({ kind: "COMPLETE" } as const);
        if (resolution.kind !== "COMPLETE") {
          outcome = "TURNOVER";
          resolvingPlayerId = carrier.id;
          phase = "RESOLUTION";
          record(
            resolution.kind === "INTERCEPTED"
              ? `${resolution.defenderId} reads the ${chosen.kind.toLowerCase()} outlet from ${carrier.id} and intercepts -> TURNOVER`
              : `${carrier.id} throws the outlet away -> TURNOVER`,
          );
        } else {
          actions.push({ type: "PASS", fromPlayerId: carrier.id, toPlayerId: chosen.targetPlayerId });
          phase = "FIRST_WAVE";
          record(`${carrier.id} plays the ${chosen.detail}`);
        }
      } else {
        phase = "FIRST_WAVE";
        record(`${carrier.id} keeps it: ${chosen.detail}`);
      }
      nextReevaluateStep = steps + REEVALUATE_STEPS;
      actions.push(...offBallActions(carrier.id));
    } else if ((phase === "FIRST_WAVE" || phase === "SECOND_WAVE") && carrier && handball.ball.status === "POSSESSED") {
      const { distance: pressure, id: pressuringId } = nearestDefender(handball, carrier.position);
      // QA FIX 2A: the contact that is actually there, at the moment it is
      // actually there.
      //
      // An earlier version of this fix compounded this per-step probability
      // over the steps the take-off removed, to hold the old 7-metre rate. That
      // was wrong: those steps were a carrier running illegally on into the goal
      // area with a defender chasing him there, and replaying their odds is
      // preserving an invalid sequence by arithmetic. The chase is whatever the
      // chase is, judged from the real state each real step.
      if (pressuringId && rng.chance(catchProbability(pressure))) {
        // Caught by the retreat. A PER-STEP probability that grows as the
        // recovering defender closes, exactly like the organized-attack
        // disruption model -- not a deterministic "within 1.4m ends it".
        //
        // M10: this is the single most likely place in handball for a clear
        // chance to be destroyed -- a man chasing back at a breaking attacker
        // -- so the same judgement the organized attack uses applies here.
        // M13 (Calibration 1.0): how a chase actually ends. At an even split
        // this produced seven 7-metre throws a match against a real three to
        // five, because ~97% of all fouls in this engine happen on the break
        // and a foul on a breaking carrier is, correctly, a clear chance
        // destroyed. The split is the honest lever: a defender who catches a
        // man running at goal more often knocks the ball away or forces him
        // wide than commits a bookable foul. 0.4 gives five 7 metres a match
        // and leaves the turnover rate at 21.6%.
        if (!rng.chance(0.4)) {
          outcome = "TURNOVER";
          resolvingPlayerId = carrier.id;
          phase = "RESOLUTION";
          record(`${pressuringId} catches ${carrier.id} cleanly in transition (${pressure.toFixed(2)}m) -> TURNOVER`);
        } else {
          const defender = handball.players.find((p) => p.id === pressuringId)!;
          const award = judgeFoul(handball, carrier, defender, attackingGoal, handball.simulationTime);
          fouls.push(award);
          record(`FOUL in transition: ${award.reason} -> ${award.restart === "SEVEN_METRE" ? "7 metres" : "free throw"}${award.suspend ? " and two minutes" : ""}`);
          if (award.restart === "SEVEN_METRE") {
            sevenMetreTaken = true;
            const event = takeSevenMetre(handball, carrier.id, attackingGoal, rng, ratings, (flying, note) => {
              handball = flying;
              record(note);
            });
            handball = event.state;
            outcome = event.resolution.outcome;
            resolvingPlayerId = carrier.id;
            shotOrigin = { ...sevenMetreMark(attackingGoal) };
            phase = "RESOLUTION";
            record(`7m: ${event.resolution.detail ?? outcome}`);
          } else {
            outcome = "FREE_THROW";
            resolvingPlayerId = carrier.id;
            phase = "DEAD_BALL";
          }
        }
      } else if (steps >= nextReevaluateStep) {
        // RE-EVALUATE from the state as it now is.
        nextReevaluateStep = steps + REEVALUATE_STEPS;
        const recovered = defenceHasRecovered(handball, defendedGoal);
        const decision = decideBreakAction(perception, carrier, recovered, ratings);
        if (decision.kind === "SHOOT") {
          record(`${carrier.id} breaks clear (${decision.detail}) and shoots`);
          shootFrom(carrier, carrier.position, decision.detail);
        } else if (decision.kind === "PASS" && decision.targetPlayerId) {
          const receiver = findPlayer(handball, decision.targetPlayerId);
          const resolution = receiver ? resolvePass(handball, carrier, receiver, rng, ratings) : ({ kind: "COMPLETE" } as const);
          if (resolution.kind !== "COMPLETE") {
            outcome = "TURNOVER";
            resolvingPlayerId = carrier.id;
            phase = "RESOLUTION";
            record(
              resolution.kind === "INTERCEPTED"
                ? `${resolution.defenderId} intercepts ${carrier.id}'s pass in the break -> TURNOVER`
                : `${carrier.id} loses it in the break -> TURNOVER`,
            );
          } else {
            actions.push({ type: "PASS", fromPlayerId: carrier.id, toPlayerId: decision.targetPlayerId });
            record(`${carrier.id} plays it on: ${decision.detail}`);
          }
        } else if (decision.kind === "SLOW_DOWN") {
          phase = "EARLY_OFFENSE";
          record(`the break slows: ${decision.detail} (${describeNumbers(perception)})`);
        } else {
          record(`${carrier.id} runs on: ${decision.detail}`);
        }
      }
      if (!completed && phase !== "RESOLUTION" && phase !== "DEAD_BALL" && phase !== "EARLY_OFFENSE") {
        // The carrier attacks the goal down his own lane rather than the
        // centre; everybody else keeps their running or retreat job.
        const lane = running.find((r) => r.playerId === carrier.id)?.laneX ?? carrier.position.x;
        const toGoal = distanceBetween(carrier.position, goal);
        // QA FIX 2A: he still attacks the GOAL, not the line.
        //
        // Clamping this target to the last legal point was tried and measured,
        // and it is the wrong model: it makes a man running at an open goal
        // decelerate into the six-metre line and stand on it, which cost 42% of
        // all possessions and 40% of all goals. A breaking attacker does not
        // brake at the D -- he takes off over it. What keeps him legal is the
        // take-off above, which puts the ball out of his hands before the line
        // rather than putting a wall in front of him.
        actions.push({
          type: "MOVE",
          playerId: carrier.id,
          target: toGoal <= BREAK_SHOT_RANGE_METERS ? goal : { x: lane, y: carrier.position.y + (goal.y - carrier.position.y) * 0.8 },
        });
        if (steps >= nextRefreshStep) {
          nextRefreshStep = steps + REFRESH_STEPS;
          actions.push(...offBallActions(carrier.id));
        }
      }
    } else if (phase === "EARLY_OFFENSE") {
      // The first wave did not resolve. Early offense is a REAL phase, not a
      // relabel: the ball is walked up while the retreat finishes. Ending the
      // transition the instant the break slowed was measurably wrong -- the
      // organized possession then began against a defence still strung 18m
      // deep down the court, because nothing had waited for it to set.
      if (earlyOffenseStartedAt < 0) {
        earlyOffenseStartedAt = steps;
        record("early offense: the ball is brought up while the defence sets");
      }
      const secondWave = carrier && !secondWaveUsed ? findSecondWaveRunner(perception, carrier, running) : null;
      const settled = defenceIsSet(handball, defendedGoal) || steps - earlyOffenseStartedAt >= MAX_EARLY_OFFENSE_STEPS;
      if (!secondWave && !settled) {
        // Keep advancing at a controlled pace; the retreat keeps running.
        if (carrier && handball.ball.status === "POSSESSED") {
          // QA FIX 2A: he is walked TO the approach distance, from either
          // side of it. Only the "still too far away" case was ordered before,
          // so a carrier who arrived here closer than eleven metres -- which is
          // every carrier whose break was called off near the goal -- kept the
          // break's own order to run at the goal and carried the ball into the
          // area. Early offense means bringing the ball up and holding it at an
          // organized distance, and that is a distance he can be on the wrong
          // side of.
          const toGoal = distanceBetween(carrier.position, goal);
          const t = (toGoal - ORGANIZED_APPROACH_METERS) / Math.max(toGoal, 1e-6);
          // Backing away from the goal can run off the end of the court, so the
          // target is kept on it -- he retreats as far as there is court to
          // retreat into.
          actions.push({
            type: "MOVE",
            playerId: carrier.id,
            target: {
              x: Math.min(COURT_WIDTH_METERS - 0.2, Math.max(0.2, carrier.position.x + (goal.x - carrier.position.x) * t)),
              y: Math.min(COURT_LENGTH_METERS - 0.2, Math.max(0.2, carrier.position.y + (goal.y - carrier.position.y) * t)),
            },
          });
        }
        if (steps >= nextRefreshStep) {
          nextRefreshStep = steps + REFRESH_STEPS;
          actions.push(...offBallActions(handball.ball.possessorId, true));
        }
      } else if (carrier && secondWave) {
        secondWaveUsed = true;
        const resolution = resolvePass(handball, carrier, secondWave, rng, ratings);
        if (resolution.kind !== "COMPLETE") {
          outcome = "TURNOVER";
          resolvingPlayerId = carrier.id;
          phase = "RESOLUTION";
          record(`the second wave ball is lost -> TURNOVER`);
        } else {
          actions.push({ type: "PASS", fromPlayerId: carrier.id, toPlayerId: secondWave.id });
          phase = "SECOND_WAVE";
          nextReevaluateStep = steps + REEVALUATE_STEPS;
          record(`second wave: ${carrier.id} finds ${secondWave.id} arriving behind the break`);
        }
      } else {
        phase = "ORGANIZED_SETUP";
        record("attack settles into an organized shape at the opposite end");
      }
    } else if (phase === "ORGANIZED_SETUP") {
      outcome = "ORGANIZED_ATTACK_REACHED";
      resolvingPlayerId = handball.ball.possessorId;
      phase = "COMPLETE";
      completed = true;
      record("transition complete: ORGANIZED_ATTACK_REACHED");
      break;
    } else if (phase === "RESOLUTION" || phase === "DEAD_BALL") {
      phase = "COMPLETE";
      completed = true;
      record(`transition complete: ${outcome}`);
      break;
    }

    if (completed) break;

    // While the ball is in the air nobody carries it, but the break does not
    // stop: runners keep filling their lanes and defenders keep retreating.
    if (actions.length === 0 && steps >= nextRefreshStep) {
      nextRefreshStep = steps + REFRESH_STEPS;
      actions.push(...offBallActions(handball.ball.possessorId));
    }
    // The retreat re-reads its jobs periodically: who is now the danger, who
    // can still get to the ball. Sticky roles keep it from thrashing.
    if (steps >= nextRetreatAssessStep) {
      nextRetreatAssessStep = steps + RETREAT_REASSESS_STEPS;
      const reassigned = assignRetreatRoles(perception, retreat, ratings);
      if (describeRetreat(reassigned) !== describeRetreat(retreat)) {
        retreat = reassigned;
        record(`retreat: ${describeRetreat(retreat)}`);
      }
    }

    // QA GATE 1B: a keeper substituted during a break is still a keeper. He was
    // never told to go home here, so he stayed at the substitution area for the
    // rest of the match with his goal standing open behind him.
    actions.push(
      ...keeperRecoveryActions(handball, (keeper) =>
        keeper.team === "DEFENSE" ? attackingGoal : attackingGoal === "TOP" ? "BOTTOM" : "TOP",
      ),
    );

    // QA FIX 2A: and any field player who has landed in an area is leaving it.
    actions.push(...goalAreaRecoveryActions(handball));

    // QA FIX 2A: THE TAKE-OFF, asked last and of the real step.
    //
    // Last, because the orders collected above are what he is about to do, and
    // the question is whether THEY carry the ball over the line. Asking at the
    // top of the loop instead used the intent he arrived with, said no, and let
    // him cross under an order issued moments later. And of every phase,
    // because the rule does not know what phase it is: the retreat and early
    // offense have no shot in them and could still walk a carrier in.
    if (!completed && phase !== "RESOLUTION" && phase !== "DEAD_BALL") {
      const release = releaseRequiredBefore(handball, actions, handball.ball.possessorId, SIMULATION_DT_SECONDS);
      const releasing = release === null ? null : findPlayer(handball, handball.ball.possessorId);
      if (release !== null && releasing) {
        record(`${releasing.id} takes off at the line and releases`);
        shootFrom(releasing, release, "the take-off");
        steps += 1;
        continue;
      }
    }

    handball = stepWithSubstitutions(handball, actions, SIMULATION_DT_SECONDS);
    steps += 1;
  }

  if (!completed) {
    guardTripped = true;
    outcome = "TURNOVER";
    resolvingPlayerId = handball.ball.possessorId;
    phase = "COMPLETE";
    record(`max-step guard (${maxSteps}) reached; terminating deterministically as TURNOVER`);
  }

  // M11: same as the possession engine -- a break can end on the step a man
  // reaches his line, so the exchange is settled once more here rather than
  // being held over to the next segment.
  handball = settleArrivedExchanges(handball);

  return {
    outcome: outcome ?? "TURNOVER",
    finalState: {
      handball,
      possession: { ...input.initialState.possession, phase: "COMPLETE", outcome: outcome ?? "TURNOVER" },
    },
    trace,
    resolvingPlayerId,
    goalkeeperId: shotOrigin ? (goalkeeperOf(handball, "DEFENSE")?.id ?? null) : null,
    shotOrigin,
    shotBlockedByDefenderId,
    steps,
    guardTripped,
    fouls,
    sevenMetreTaken,
  };
}

// ---------------------------------------------------------------------------
// The continuous sequence
// ---------------------------------------------------------------------------

export type SequenceResult = {
  /** The organized possession that started it. */
  readonly possession: PossessionResult;
  /** The transition it caused, when the possession changed hands. */
  readonly transition: TransitionResult | null;
  /** ONE continuous trace across both, with no reconstruction between them. */
  readonly trace: readonly PossessionTraceEntry[];
  readonly events: readonly PossessionMatchEvent[];
  readonly finalState: FullCourtMatchState;
};

/**
 * Simulates an organized possession and, when it ends in a save or a turnover,
 * continues STRAIGHT ON into the transition it caused -- same ball, same
 * player positions, opposite direction.
 */
export function simulateSequence(input: SimulatePossessionInput): SequenceResult {
  const possession = simulatePossession(input);
  const events: PossessionMatchEvent[] = [deriveMatchEvent(possession)];

  if (!changesPossession(possession.outcome)) {
    return { possession, transition: null, trace: possession.trace, events, finalState: possession.finalState };
  }

  // Who won the ball: the goalkeeper after a save, otherwise whoever was
  // nearest to it when it was lost. Both are read from the state the
  // possession actually ended in.
  const ended = possession.finalState.handball;
  const keeper = goalkeeperOf(ended, "DEFENSE");
  // QA FIX 2A: whoever wins it must be able to LEGALLY win it where he stands.
  // A field player inside the goal area may not play the ball there, so the
  // nearest legally placed defender takes it instead.
  const nearest = nearestDefender(ended, ended.ball.position, { legalGroundOnly: true });
  const regainingPlayerId =
    possession.outcome === "SHOT_SAVED" ? (keeper?.id ?? nearest.id) : (nearest.id ?? keeper?.id ?? null);
  if (!regainingPlayerId) {
    return { possession, transition: null, trace: possession.trace, events, finalState: possession.finalState };
  }

  const switched = switchPossession(possession.finalState, possession.outcome, regainingPlayerId);
  const transition = simulateTransition({
    // A distinct but derived seed, so the transition is deterministic and
    // never replays the possession's own random sequence.
    seed: (input.seed ^ 0x9e3779b9) >>> 0,
    initialState: switched.state,
    ratings: input.ratings,
    maxSteps: input.maxSteps,
  });
  events.push(deriveMatchEvent(transition as unknown as PossessionResult));

  return {
    possession,
    transition,
    trace: [...possession.trace, ...transition.trace],
    events,
    finalState: transition.finalState,
  };
}
