// THE POSSESSION LEDGER: every attack, and exactly how it ended.
//
// Two numbers were being reported from two different denominators -- "no-shot
// possessions fell to 16%" and "only 65% of attacks reach a shot" -- and both
// were honest readings of different things. That is a measurement failure
// before it is an engine failure, and nothing can be tuned on top of it.
//
// So the three words are defined here, once, and everything reads them from
// this module.
//
//   POSSESSION  One team's unbroken control of the ball, from gaining it to
//               losing it to the other team. A free throw awarded to the team
//               already in possession does NOT start a new one, because in
//               handball that is the same attack continuing.
//
//   ATTACK      A possession in which the team actually had the ball in play:
//               somebody controlled it, received it or shot it. A possession
//               that exists only as a procedural fragment -- awarded and
//               immediately re-awarded, or ended by the half-time horn before
//               anybody touched the ball -- is not an attack, and counting it
//               as one is what produced the unexplained bucket.
//
//   SEQUENCE    One uninterrupted phase of an attack, between restarts. An
//               attack interrupted by a free throw to the same team contains
//               two sequences. This is the unit a viewer sees as "a play".
//
// Every attack ends exactly once, for exactly one reason, and the reasons are
// mutually exclusive and ordered by which physically happened last.
import type { CoreEvent, CoreState, TeamId } from './state';

/**
 * How an attack ended. Mutually exclusive, and ordered so that the LAST thing
 * that physically happened is the one reported: a shot that is saved and whose
 * rebound is then lost is a lost rebound, not a shot.
 */
export type Ending =
  | 'GOAL'
  | 'SHOT_SAVED_REBOUND_KEPT'
  | 'SHOT_SAVED_REBOUND_LOST'
  | 'SHOT_BLOCKED_REBOUND_KEPT'
  | 'SHOT_BLOCKED_REBOUND_LOST'
  | 'SHOT_WIDE'
  | 'INTERCEPTION'
  | 'BAD_PASS_OUT'
  | 'RECEPTION_FAILED'
  | 'DUEL_LOSS'
  | 'OFFENSIVE_FOUL'
  | 'TECHNICAL_VIOLATION'
  | 'PASSIVE_PLAY'
  | 'OUT_OF_COURT'
  | 'DEFENSIVE_FOUL_RESTART'
  | 'PERIOD_END'
  | 'STILL_IN_PROGRESS';

/**
 * HOW AN ATTACK WAS LOST WITHOUT A SHOT. One name per cause, and one total.
 *
 * Two different numbers were being reported as "turnovers" -- 25.8 counted
 * POSSESSION_CHANGED events by a non-goalkeeper, and 43.8 counted attacks that
 * ended without a shot -- and they are not the same quantity. The event count
 * misses every turnover effected by a whistle rather than by a change of hands,
 * because a three-second violation awards a restart and never records a
 * possession change. These are the canonical names; nothing outside this module
 * derives its own.
 *
 *   TECHNICAL_TURNOVER  Lost to the referee: steps, three seconds, an illegal
 *                       shot or takeoff, passive play, an offensive foul.
 *   INTERCEPTION        A pass taken by a defender in the lane.
 *   DUEL_LOSS           A loose ball in open play won by the opponent.
 *   RECEPTION_FAILURE   The ball reached nobody and the opponent picked it up.
 *   BAD_PASS_OUT        Thrown out of court.
 *
 * NON_SHOT_LOSS is their sum. A period ending is NOT a loss -- nobody lost the
 * ball, the half ended -- and is deliberately outside every class.
 */
export type LossClass = 'TECHNICAL_TURNOVER' | 'INTERCEPTION' | 'DUEL_LOSS' | 'RECEPTION_FAILURE' | 'BAD_PASS_OUT';

export const LOSS_CLASSES: readonly LossClass[] = Object.freeze(
  ['TECHNICAL_TURNOVER', 'INTERCEPTION', 'DUEL_LOSS', 'RECEPTION_FAILURE', 'BAD_PASS_OUT'] as const);

/** Which loss an ending is, or null when the attack was not lost without a shot. */
export function lossClassOf(ending: Ending): LossClass | null {
  switch (ending) {
    case 'TECHNICAL_VIOLATION': case 'PASSIVE_PLAY': case 'OFFENSIVE_FOUL': return 'TECHNICAL_TURNOVER';
    case 'INTERCEPTION': return 'INTERCEPTION';
    case 'DUEL_LOSS': return 'DUEL_LOSS';
    case 'RECEPTION_FAILED': return 'RECEPTION_FAILURE';
    case 'BAD_PASS_OUT': case 'OUT_OF_COURT': return 'BAD_PASS_OUT';
    default: return null;
  }
}

export type AttackRecord = {
  readonly possessionId: string;
  readonly team: TeamId;
  readonly firstTick: number;
  readonly lastTick: number;
  /** Restart-separated phases inside this one attack. */
  readonly sequences: number;
  readonly passes: number;
  readonly shots: number;
  readonly ending: Ending;
  /** The event that decided the ending, for a human tracing one back. */
  readonly evidence: string;
};

export type Ledger = {
  readonly possessions: number;
  readonly attacks: number;
  readonly sequences: number;
  readonly fragments: number;
  readonly records: readonly AttackRecord[];
  readonly endings: Readonly<Record<string, number>>;
  /** Attacks that reached a shot, over attacks. The only "reached a shot" rate. */
  readonly shotRate: number;
  /** Attacks lost without a shot, by cause. Per match, not a rate. */
  readonly losses: Readonly<Record<LossClass, number>>;
  /** The sum of `losses`: every attack that ended without a shot being taken. */
  readonly nonShotLoss: number;
  /** `nonShotLoss` over attacks. Was called contestedLossRate. */
  readonly nonShotLossRate: number;
};

const LIVE_TOUCH = new Set(['PASS_RECEIVED', 'SHOT_RELEASED', 'BALL_CONTROLLED', 'REBOUND_CONTROLLED']);

/**
 * Read a finished match into the ledger.
 *
 * Deliberately a pure reading of the event stream: if an ending cannot be
 * explained from the events the engine recorded, that is a hole in the events
 * and the ledger should say so rather than paper over it.
 */
export function ledger(s: CoreState): Ledger {
  const byPossession = new Map<string, CoreEvent[]>();
  for (const e of s.events) {
    const held = byPossession.get(e.possessionId) ?? [];
    held.push(e);
    byPossession.set(e.possessionId, held);
  }

  const records: AttackRecord[] = [];
  let fragments = 0;
  for (const [id, events] of byPossession) {
    const touched = events.some(e => LIVE_TOUCH.has(e.type));
    if (!touched) { fragments += 1; continue; }
    // WHOSE ATTACK IT WAS: the team of the players who actually played the ball.
    //
    // This used to read the `owner` of the first possession event in the record,
    // which is exactly the wrong place to look: a possession's own opening award
    // is recorded against the PREVIOUS possession, so the only such event inside
    // a record is the one that ENDED it -- and its owner is the opponent. Every
    // attack ending in an awarded restart was therefore filed under the team
    // that won the ball rather than the team that lost it.
    const toucher = events.find(e => LIVE_TOUCH.has(e.type) && e.actorId !== null);
    const team = (toucher ? s.players.find(p => p.id === toucher.actorId)?.team : undefined)
      ?? possessionTeamAt(s, events[0].tick);
    records.push({
      possessionId: id,
      team,
      firstTick: events[0].tick,
      lastTick: events[events.length - 1].tick,
      sequences: Math.max(1, events.filter(e => e.type === 'RESTART_COMPLETED').length),
      passes: events.filter(e => e.type === 'PASS_RECEIVED').length,
      shots: events.filter(e => e.type === 'SHOT_RELEASED').length,
      ...endingOf(events),
    });
  }

  const endings: Record<string, number> = {};
  for (const r of records) endings[r.ending] = (endings[r.ending] ?? 0) + 1;
  const withShot = records.filter(r => r.shots > 0).length;
  const losses = Object.fromEntries(LOSS_CLASSES.map(c => [c, 0])) as Record<LossClass, number>;
  for (const r of records) {
    if (r.shots > 0) continue; // a shot was taken; the attack was not lost without one
    const c = lossClassOf(r.ending);
    if (c) losses[c] += 1;
  }
  const nonShotLoss = LOSS_CLASSES.reduce((n, c) => n + losses[c], 0);
  return {
    possessions: byPossession.size,
    attacks: records.length,
    sequences: records.reduce((n, r) => n + r.sequences, 0),
    fragments,
    records,
    endings,
    shotRate: records.length ? withShot / records.length : 0,
    losses, nonShotLoss,
    nonShotLossRate: records.length ? nonShotLoss / records.length : 0,
  };
}

function possessionTeamAt(s: CoreState, tick: number): TeamId {
  const change = [...s.events].reverse().find(e => e.tick <= tick && (e.type === 'POSSESSION_CHANGED' || e.type === 'POSSESSION_AWARDED'));
  return (change?.details.owner as TeamId | undefined) ?? s.possession.team;
}

/**
 * What ended it.
 *
 * Walked forward, keeping the last decisive thing. The order inside the walk is
 * the order of physical reality: a shot is decisive until something happens to
 * the rebound, and a whistle is decisive until play restarts.
 */
function endingOf(events: readonly CoreEvent[]): { ending: Ending; evidence: string } {
  let ending: Ending = 'STILL_IN_PROGRESS';
  let evidence = 'no terminal event recorded';
  let airborneShot = false;
  let offTargetKeeperTouch=false;
  const actualWhistle=events.some(e=>e.type==='WHISTLE_RESTART');

  for (const e of events) {
    switch (e.type) {
      case 'SHOT_RELEASED': airborneShot = true;offTargetKeeperTouch=false; ending = 'SHOT_WIDE'; evidence = `shot released (${e.details.shotKind})`; break;
      case 'KEEPER_COLLECTED_OFF_TARGET':
      case 'OFF_TARGET_KEEPER_TOUCH':offTargetKeeperTouch=true;airborneShot=true;ending='SHOT_WIDE';evidence='off-target attempt touched by the goalkeeper';break;
      case 'GOAL': ending = 'GOAL'; evidence = 'goal'; airborneShot = false; break;
      case 'SAVE_PARRY': ending = 'SHOT_SAVED_REBOUND_LOST'; evidence = 'goalkeeper parried'; airborneShot = false; break;
      case 'SHOT_BLOCKED': ending = 'SHOT_BLOCKED_REBOUND_LOST'; evidence = 'shot blocked'; airborneShot = false; break;
      case 'REBOUND_CONTROLLED':
        if (ending === 'SHOT_SAVED_REBOUND_LOST') { ending = 'SHOT_SAVED_REBOUND_KEPT'; evidence = 'parry recovered by the attack'; }
        else if (ending === 'SHOT_BLOCKED_REBOUND_LOST') { ending = 'SHOT_BLOCKED_REBOUND_KEPT'; evidence = 'block recovered by the attack'; }
        break;
      case 'INTERCEPTION': ending = 'INTERCEPTION'; evidence = 'pass intercepted'; break;
      case 'PASSIVE_PLAY': ending = 'PASSIVE_PLAY'; evidence = 'passive play'; break;
      case 'BALL_OUT':
        // A shot that goes out is a wide shot. A rebound off a save or a block
        // that then goes out is still a saved or blocked shot: the attack was
        // ended by the goalkeeper, not by a bad pass, and calling it one hid
        // the parries. Anything else really is a ball thrown away.
        if (airborneShot) { ending = 'SHOT_WIDE'; evidence = 'shot missed the goal'; }
        else if (ending === 'SHOT_SAVED_REBOUND_KEPT' || ending === 'SHOT_SAVED_REBOUND_LOST') { ending = 'SHOT_SAVED_REBOUND_LOST'; evidence = 'parry went out of play'; }
        else if (ending === 'SHOT_BLOCKED_REBOUND_KEPT' || ending === 'SHOT_BLOCKED_REBOUND_LOST') { ending = 'SHOT_BLOCKED_REBOUND_LOST'; evidence = 'block went out of play'; }
        else { ending = 'BAD_PASS_OUT'; evidence = 'ball left the court'; }
        break;
      case 'DEFENDER_BEATEN': break;
      case 'FOUL':
        // Legacy archives have assessments but no explicit whistle. Read only
        // an actual correlated restart, never a contact allowed to continue.
        if(!actualWhistle&&e.details.advantage!==true&&events.some(next=>next.type==='RESTART_AWARDED'&&next.tick===e.tick&&
          (next.details.kind==='FREE_THROW'||next.details.kind==='SEVEN_METRE'))){
          ending='DEFENSIVE_FOUL_RESTART';evidence=`defensive foul stopped play (${e.details.severity})`;
        }
        break;
      case 'WHISTLE_RESTART':
        ending='DEFENSIVE_FOUL_RESTART';evidence=`whistle for ${e.details.foulId} (${e.details.kind})`;
        break;
      case 'ADVANTAGE_RECALLED':
        if(!actualWhistle&&events.some(next=>next.type==='RESTART_AWARDED'&&next.tick===e.tick&&
          (next.details.kind==='FREE_THROW'||next.details.kind==='SEVEN_METRE'))){
          ending='DEFENSIVE_FOUL_RESTART';evidence=`legacy recalled foul ${e.details.foulId} stopped play`;
        }
        break;
      case 'RESTART_COMPLETED':
        if(ending==='DEFENSIVE_FOUL_RESTART'){ending='STILL_IN_PROGRESS';evidence='the same attack resumed after the defensive-foul restart';}
        break;
      case 'RESTART_AWARDED': {
        const reason = String(e.details.reason ?? '');
        if (reason === 'More than three steps' || reason === 'Held longer than three seconds') { ending = 'TECHNICAL_VIOLATION'; evidence = reason; }
        else if (reason === 'Passive play after pass allowance') { ending = 'PASSIVE_PLAY'; evidence = reason; }
        else if (reason === 'Illegal grounded shot in goal area' || reason === 'Illegal takeoff') { ending = 'TECHNICAL_VIOLATION'; evidence = reason; }
        else if (reason === 'Landed holding the ball after jump') { ending = 'TECHNICAL_VIOLATION'; evidence = reason; }
        else if (reason === 'Restart could not be organised') { ending = 'TECHNICAL_VIOLATION'; evidence = reason; }
        break;
      }
      case 'POSSESSION_AWARDED': {
        // Recorded against the possession that LOST the ball. A restart handed
        // to the other team after a goal or a save is not a turnover; one after
        // a whistle against the attack is.
        if (e.details.ended !== true) break;
        const reason = String(e.details.reason ?? '');
        if (reason === 'Goal crossed line') break; // the goal already ended it
        if (reason === 'Keeper controls ball inside goal area' || reason === 'Keeper recovered rebound') break;
        if (reason === 'Ball crossed court boundary') break; // BALL_OUT already ended it
        // Also overrides a recorded defensive foul: that foul was a restart of
        // THIS attack, as the comment on the FOUL case says, so it must not
        // survive as the ending when the attack later gave the ball away. Four
        // three-second violations a match were being filed as defensive fouls.
        if (ending === 'STILL_IN_PROGRESS' || ending === 'DEFENSIVE_FOUL_RESTART') { ending = 'TECHNICAL_VIOLATION'; evidence = reason || 'restart awarded against the attack'; }
        break;
      }
      case 'POSSESSION_CHANGED': {
        const reason = String(e.details.reason ?? '');
        if (reason === 'Intercepted') { ending = 'INTERCEPTION'; evidence = reason; }
        else if (reason === 'Loose-ball recovery') {
          // A loose ball the defence wins after a save or a block is the REBOUND
          // being lost -- the attack was ended by the goalkeeper. Only a loose
          // ball in open play is a duel the attack lost, and failing to separate
          // the two took fifteen saves a match out of the goalkeeper's column
          // and filed them as contested losses.
          if(offTargetKeeperTouch){ending='SHOT_WIDE';evidence='off-target attempt recovered by the defence';}
          else if (ending.startsWith('SHOT_SAVED')) { ending = 'SHOT_SAVED_REBOUND_LOST'; evidence = 'parry won by the defence'; }
          else if (ending.startsWith('SHOT_BLOCKED')) { ending = 'SHOT_BLOCKED_REBOUND_LOST'; evidence = 'block won by the defence'; }
          else { ending = 'DUEL_LOSS'; evidence = 'loose ball lost to the opponent'; }
        }
        else if (reason.startsWith('Goalkeeper')) {
          // The keeper taking the ball is the end of a SHOT, not a turnover.
          if(offTargetKeeperTouch){ending='SHOT_WIDE';evidence='off-target attempt collected by the goalkeeper';}
          else if (ending === 'SHOT_WIDE' || ending === 'SHOT_SAVED_REBOUND_LOST') { ending = 'SHOT_SAVED_REBOUND_LOST'; evidence = reason; }
          else { ending = 'RECEPTION_FAILED'; evidence = reason; }
        }
        else if (ending === 'STILL_IN_PROGRESS' || ending === 'DEFENSIVE_FOUL_RESTART') { ending = 'RECEPTION_FAILED'; evidence = reason || 'ball taken by the opponent'; }
        break;
      }
      case 'PERIOD_ENDED': ending = 'PERIOD_END'; evidence = 'period ended'; break;
      default: break;
    }
  }
  return { ending, evidence };
}
