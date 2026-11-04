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

const LIVE_TOUCH = new Set(['PASS_RELEASED', 'PASS_RECEIVED', 'SHOT_RELEASED', 'BALL_CONTROLLED', 'REBOUND_CONTROLLED', 'RESTART_COMPLETED']);
const TECHNICAL_RESTART_REASONS = new Set(['More than three steps', 'Held longer than three seconds', 'Illegal grounded shot in goal area', 'Illegal takeoff', 'Landed holding the ball after jump', 'Restart could not be organised', 'Repeatedly delayed restart']);

export type RecalledContinuation = {
  foulId:string; protectedTeam:TeamId; originalPossessionId:string; provisionalPossessionId:string; restoredPossessionId:string;
  tick:number; whistleEventId:string; ignoredEventIds:string[];
};
/**
 * A same-tick award can be superseded when the referee recalls an already
 * pending advantage. No opponent play occurred in that provisional restart.
 * Read those exact linked reversals as continuation, without changing events
 * or IDs in the canonical state. Every accepted alias retains its evidence.
 */
export function readPossessionContinuations(s:Pick<CoreState,'events'|'players'>) {
  const aliases:Record<string,string>={},continuations:RecalledContinuation[]=[],ignored=new Set<string>(),provisional=new Map<string,string>();
  const root=(id:string):string=>{while(aliases[id])id=aliases[id];return id;};
  const pending=new Map<string,{assessment:CoreEvent;pending:CoreEvent}>(),assessments=new Map<string,CoreEvent>();
  const teamOf=(id:string|null)=>s.players.find(p=>p.id===id)?.team;
  for(let at=0;at<s.events.length;at++){
    const e=s.events[at];
    const foulId=typeof e.details.foulId==='string'?e.details.foulId:'';
    if(e.type==='FOUL_ASSESSED'&&e.details.decision==='ADVANTAGE_PENDING')assessments.set(foulId,e);
    if(e.type==='ADVANTAGE_PENDING'&&assessments.has(foulId))pending.set(foulId,{assessment:assessments.get(foulId)!,pending:e});
    if(e.type==='ADVANTAGE_REALIZED')pending.delete(foulId);
    if(e.type!=='ADVANTAGE_RECALLED'||!foulId)continue;
    const f=pending.get(foulId);
    if(!f||f.assessment.possessionId!==f.pending.possessionId||f.pending.possessionId===e.possessionId)continue;
    const protectedTeam=teamOf(f.pending.actorId);if(!protectedTeam)continue;
    const sameInstant=(x:CoreEvent)=>x.tick===e.tick&&x.timeMs===e.timeMs&&x.officialMs===e.officialMs;
    const outgoing=s.events.slice(0,at).findLast(x=>x.type==='POSSESSION_AWARDED'&&x.details.ended===true&&x.possessionId===f.pending.possessionId);
    if(!outgoing||!sameInstant(outgoing)||outgoing.details.previous!==outgoing.possessionId||outgoing.details.owner===protectedTeam)continue;
    const outAt=s.events.indexOf(outgoing),prior=s.events.slice(outAt+1,at);
    const firstRestart=prior.find(x=>x.type==='RESTART_AWARDED'&&x.possessionId===e.possessionId&&x.details.owner===outgoing.details.owner);
    if(!firstRestart||!sameInstant(firstRestart))continue;
    const after=s.events.slice(at+1),whistle=after.find(x=>sameInstant(x)&&x.type==='WHISTLE_RESTART'&&x.details.foulId===foulId&&x.details.owner===protectedTeam&&['FREE_THROW','SEVEN_METRE'].includes(String(x.details.kind)));
    if(!whistle)continue;
    const whistleAt=s.events.indexOf(whistle,at+1),returned=s.events.slice(whistleAt+1).find(x=>sameInstant(x)&&x.type==='POSSESSION_AWARDED'&&x.details.ended===true&&x.possessionId===e.possessionId&&x.details.previous===e.possessionId&&x.details.owner===protectedTeam&&x.details.reason===whistle.details.reason);
    if(!returned)continue;
    const returnedAt=s.events.indexOf(returned,whistleAt+1),restart=s.events.slice(returnedAt+1).find(x=>sameInstant(x)&&x.type==='RESTART_AWARDED'&&x.details.owner===protectedTeam&&x.details.kind===whistle.details.kind&&x.details.reason===whistle.details.reason&&x.possessionId!==e.possessionId);
    if(!restart||restart.possessionId===f.pending.possessionId)continue;
    const endAt=s.events.indexOf(restart,returnedAt+1),interval=s.events.slice(outAt+1,endAt);
    // Only the proven no-touch provisional award is erased. A real opponent
    // acquisition/pass/shot, elapsed time or unrelated additional award is not
    // eligible for this narrow reconciliation.
    if(interval.some(x=>!sameInstant(x)||LIVE_TOUCH.has(x.type)||x.type==='PASS_RELEASED'||x.type==='DRIVE_RELEASED'))continue;
    const provisionalEvents=s.events.filter(x=>x.possessionId===e.possessionId);
    if(provisionalEvents.some(x=>!sameInstant(x)||LIVE_TOUCH.has(x.type))||provisionalEvents.filter(x=>x.type==='POSSESSION_AWARDED'&&x.details.ended===true).length!==1)continue;
    if(interval.filter(x=>x.type==='POSSESSION_AWARDED'&&x.details.ended===true).length!==1)continue;
    const original=root(f.pending.possessionId);aliases[restart.possessionId]=original;provisional.set(e.possessionId,original);
    const ignoredEventIds=[outgoing.id,firstRestart.id,returned.id];for(const id of ignoredEventIds)ignored.add(id);
    continuations.push({foulId,protectedTeam,originalPossessionId:original,provisionalPossessionId:e.possessionId,restoredPossessionId:restart.possessionId,tick:e.tick,whistleEventId:whistle.id,ignoredEventIds});
  }
  const events=continuations.length?s.events.filter(e=>!ignored.has(e.id)).map(e=>{
    const possessionId=root(provisional.get(e.possessionId)??e.possessionId),previous=typeof e.details.previous==='string'?root(provisional.get(e.details.previous)??e.details.previous):e.details.previous;
    return possessionId!==e.possessionId||previous!==e.details.previous?{...e,possessionId,details:{...e.details,...(previous!==undefined?{previous}:{})}}:e;
  }):s.events;
  return{events,aliases,voidedProvisionalPossessions:[...provisional.keys()],ignoredEventIds:[...ignored],continuations};
}

/**
 * Read a finished match into the ledger.
 *
 * Deliberately a pure reading of the event stream: if an ending cannot be
 * explained from the events the engine recorded, that is a hole in the events
 * and the ledger should say so rather than paper over it.
 */
export function ledger(s: CoreState): Ledger {
  const byPossession = new Map<string, CoreEvent[]>();
  for (const e of readPossessionContinuations(s).events) {
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
      ...endingOf(events, team),
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
function endingOf(events: readonly CoreEvent[], team: TeamId): { ending: Ending; evidence: string } {
  let ending: Ending = 'STILL_IN_PROGRESS';
  let evidence = 'no terminal event recorded';
  let airborneShot = false;
  let shotPending = false;
  let offTargetKeeperTouch=false;
  const actualWhistle=events.some(e=>e.type==='WHISTLE_RESTART');

  for (const e of events) {
    switch (e.type) {
      case 'PASS_RELEASED':
        // A retained shot does not own every later loose ball in this attack.
        // The new physical throw has its own outcome, while record.shots still
        // records that the attack had previously reached a shot.
        airborneShot=false;shotPending=false;offTargetKeeperTouch=false;
        if(ending.startsWith('SHOT_')){ending='STILL_IN_PROGRESS';evidence='the same attack continued with a new pass';}
        break;
      case 'SHOT_RELEASED': airborneShot = true;shotPending=true;offTargetKeeperTouch=false; ending = 'SHOT_WIDE'; evidence = `shot released (${e.details.shotKind})`; break;
      case 'KEEPER_COLLECTED_OFF_TARGET':
      case 'OFF_TARGET_KEEPER_TOUCH':offTargetKeeperTouch=true;airborneShot=true;shotPending=true;ending='SHOT_WIDE';evidence='off-target attempt touched by the goalkeeper';break;
      case 'GOAL': ending = 'GOAL'; evidence = 'goal'; airborneShot = false;shotPending=false; break;
      case 'SAVE_PARRY': ending = 'SHOT_SAVED_REBOUND_LOST'; evidence = 'goalkeeper parried'; airborneShot = false;shotPending=true; break;
      case 'SHOT_BLOCKED': ending = 'SHOT_BLOCKED_REBOUND_LOST'; evidence = 'shot blocked'; airborneShot = false;shotPending=true; break;
      case 'BALL_CONTROLLED':
        // Opponent acquisition is recorded in the NEW possession. These live
        // acquisitions inside the shot's own possession are retained control,
        // not a shot whose unresolved rebound can explain a future turnover.
        if(shotPending&&['Pass received','Loose-ball recovery','Goalkeeper rebound control'].includes(String(e.details.reason))){
          airborneShot=false;shotPending=false;offTargetKeeperTouch=false;
          if(ending==='SHOT_SAVED_REBOUND_LOST'){ending='SHOT_SAVED_REBOUND_KEPT';evidence='parry recovered by the attack';}
          else if(ending==='SHOT_BLOCKED_REBOUND_LOST'){ending='SHOT_BLOCKED_REBOUND_KEPT';evidence='block recovered by the attack';}
          else if(ending==='SHOT_WIDE'){ending='STILL_IN_PROGRESS';evidence='the attack recovered its off-target attempt';}
        }
        break;
      case 'REBOUND_CONTROLLED':
        if (ending === 'SHOT_SAVED_REBOUND_LOST') { ending = 'SHOT_SAVED_REBOUND_KEPT'; evidence = 'parry recovered by the attack'; }
        else if (ending === 'SHOT_BLOCKED_REBOUND_LOST') { ending = 'SHOT_BLOCKED_REBOUND_KEPT'; evidence = 'block recovered by the attack'; }
        airborneShot=false;shotPending=false;offTargetKeeperTouch=false;
        break;
      case 'INTERCEPTION':
        // acquire() first ends the losing attack and opens the winner's attack;
        // INTERCEPTION is then stamped with that NEW possession ID. Only the
        // outgoing POSSESSION_CHANGED/Intercepted establishes a lost attack.
        break;
      case 'PASSIVE_PLAY': ending = 'PASSIVE_PLAY'; evidence = 'passive play'; break;
      case 'BALL_OUT':
        // A shot that goes out is a wide shot. A rebound off a save or a block
        // that then goes out is still a saved or blocked shot: the attack was
        // ended by the goalkeeper, not by a bad pass, and calling it one hid
        // the parries. Anything else really is a ball thrown away.
        if (airborneShot) { ending = 'SHOT_WIDE'; evidence = 'shot missed the goal'; }
        else if (shotPending&&(ending === 'SHOT_SAVED_REBOUND_KEPT' || ending === 'SHOT_SAVED_REBOUND_LOST')) { ending = 'SHOT_SAVED_REBOUND_LOST'; evidence = 'parry went out of play'; }
        else if (shotPending&&(ending === 'SHOT_BLOCKED_REBOUND_KEPT' || ending === 'SHOT_BLOCKED_REBOUND_LOST')) { ending = 'SHOT_BLOCKED_REBOUND_LOST'; evidence = 'block went out of play'; }
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
        // Modern awards to the opponent were already recorded against the old
        // ID by POSSESSION_AWARDED. This event now belongs to the team that WON
        // the restart, so its opponent's violation cannot label its new attack.
        if(e.details.owner===team)break;
        const reason = String(e.details.reason ?? '');
        if (TECHNICAL_RESTART_REASONS.has(reason)) { ending = 'TECHNICAL_VIOLATION'; evidence = reason; }
        else if (reason === 'Passive play after pass allowance') { ending = 'PASSIVE_PLAY'; evidence = reason; }
        break;
      }
      case 'POSSESSION_AWARDED': {
        // Recorded against the possession that LOST the ball. A restart handed
        // to the other team after a goal or a save is not a turnover; one after
        // a whistle against the attack is.
        if (e.details.ended !== true) break;
        const reason = String(e.details.reason ?? '');
        // A confirmed later rule transfer ends this attack even when it had
        // already taken and recovered a shot. It must override that old tag.
        if(TECHNICAL_RESTART_REASONS.has(reason)){ending='TECHNICAL_VIOLATION';evidence=reason;shotPending=false;airborneShot=false;break;}
        if(reason==='Passive play after pass allowance'){ending='PASSIVE_PLAY';evidence=reason;shotPending=false;airborneShot=false;break;}
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
          if(shotPending&&offTargetKeeperTouch){ending='SHOT_WIDE';evidence='off-target attempt recovered by the defence';}
          else if (shotPending&&ending.startsWith('SHOT_SAVED')) { ending = 'SHOT_SAVED_REBOUND_LOST'; evidence = 'parry won by the defence'; }
          else if (shotPending&&ending.startsWith('SHOT_BLOCKED')) { ending = 'SHOT_BLOCKED_REBOUND_LOST'; evidence = 'block won by the defence'; }
          else { ending = 'DUEL_LOSS'; evidence = 'loose ball lost to the opponent'; }
        }
        else if (reason.startsWith('Goalkeeper')) {
          // The keeper taking the ball is the end of a SHOT, not a turnover.
          if(shotPending&&offTargetKeeperTouch){ending='SHOT_WIDE';evidence='off-target attempt collected by the goalkeeper';}
          else if (shotPending&&(ending === 'SHOT_WIDE' || ending === 'SHOT_SAVED_REBOUND_LOST')) { ending = 'SHOT_SAVED_REBOUND_LOST'; evidence = reason; }
          else if (shotPending&&ending.startsWith('SHOT_BLOCKED')) { ending = 'SHOT_BLOCKED_REBOUND_LOST'; evidence = 'blocked shot recovered by the goalkeeper'; }
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
