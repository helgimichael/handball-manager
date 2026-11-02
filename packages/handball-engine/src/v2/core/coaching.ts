import { matchPlanBefore, plannedSeventhPlayer, type TeamMatchPlan } from './matchPlanDirectives';
import { courtPlayers,otherTeam,record,type CorePlayer,type CoreState,type TeamId } from './state';
import { requestExchange,exchangeActive,courtLimit } from './population';
import { requestTeamTimeout } from './referee';
import type { AttackIdentity } from './offence';

/** How far the defence is prepared to leave its line to take the ball. */
export type DefensiveAggression='LOW'|'BALANCED'|'HIGH';
export const DEFENSIVE_AGGRESSION_LEVELS:readonly DefensiveAggression[]=['LOW','BALANCED','HIGH'];
/** Offensive tempo: SLOW (LOW), BALANCED, QUICK (HIGH). */
export type OffensiveTempo='SLOW'|'BALANCED'|'QUICK';
export const OFFENSIVE_TEMPO_LEVELS:readonly OffensiveTempo[]=['SLOW','BALANCED','QUICK'];
/**
 * What tempo changes in the attack. Only the time a carrier spends reading
 * before he plays, how readily he spends an advantage instead of recycling,
 * how eagerly free play moves the ball on, and how strongly a transition
 * carrier pushes. Speed, accuracy and every outcome stay with the players.
 * BALANCED and QUICK are the values these sites always had.
 */
export type TempoProfile={
  /** Base ticks a carrier reads the court after securing the ball. */
  readonly readTicks:number;
  /** Preference multiplier for recycling the ball. */
  readonly recycle:number;
  /** Preference multiplier for every option that progresses the attack. */
  readonly progress:number;
  /** Entry score added to free, ball-moving entry families. */
  readonly freePace:number;
  /** Value added to actions taken while the attack is still in transition. */
  readonly transition:number;
};
export const TEMPO_PROFILES:Record<OffensiveTempo,TempoProfile>={
  SLOW:{readTicks:11,recycle:1.06,progress:.94,freePace:-.2,transition:-.04},
  BALANCED:{readTicks:8,recycle:1,progress:1,freePace:0,transition:0},
  QUICK:{readTicks:5,recycle:.94,progress:1.06,freePace:.2,transition:.04},
};
/** Unknown stored values play BALANCED rather than failing a resumed match. */
export const tempoProfile=(tempo:string|undefined):TempoProfile=>TEMPO_PROFILES[tempo as OffensiveTempo]??TEMPO_PROFILES.BALANCED;
/**
 * How the assistant rotates when `rotation` is on. It only ever answers a real
 * reading -- a tired player, a fresher or stronger replacement on the bench,
 * the score and the clock -- and never substitutes to meet a quota.
 */
export type RotationStrategy='SHORT'|'BALANCED'|'WIDE';
export const ROTATION_STRATEGIES:readonly RotationStrategy[]=['SHORT','BALANCED','WIDE'];
type RotationProfile={
  /** A court player below this energy is a candidate to come off. */
  readonly tiredBelow:number;
  /** The replacement must be at least this much fresher. */
  readonly freshMargin:number;
  /** Tie-break among fresh-enough replacements: the stronger player or the fresher one. */
  readonly prefer:'ENERGY'|'STRENGTH';
};
const ROTATION_PROFILES:Record<RotationStrategy,RotationProfile>={
  SHORT:{tiredBelow:.5,freshMargin:.22,prefer:'STRENGTH'},
  BALANCED:{tiredBelow:.62,freshMargin:.18,prefer:'ENERGY'},
  WIDE:{tiredBelow:.72,freshMargin:.12,prefer:'ENERGY'},
};
export const rotationStrategy=(s:CoreState,team:TeamId):RotationStrategy=>s.coaching[team]?.rotationStrategy??'BALANCED';
/** The player's own all-round execution, for choosing who plays. Never a performance modifier. */
export function playingStrength(p:CorePlayer):number {
  const q=p.profile;
  return (q.passing+q.handling+q.decision+q.finishing+q.breakthrough+q.shotPlacement+q.defPositioning+q.defTiming+q.lateral+q.covering)/10;
}
export type TeamTactics={defence:'6:0'|'5:1';tempo:OffensiveTempo;attackIdentity:AttackIdentity;rotation:boolean;timeouts:boolean;lastTimeoutPossession:string|null;
  /** Absent in active saves created before the instruction existed; reads as BALANCED. */
  aggression?:DefensiveAggression;
  /** Absent in active saves created before the instruction existed; reads as BALANCED. */
  rotationStrategy?:RotationStrategy;
  /** Absent in active saves created before the instruction existed; reads as OFF. */
  sevenVSix?:SevenVSixMode;
  /** HM-PLAYTEST-01: the manager's own match plan (pairs, situational units, defensive spaces, 7m order). Absent: unchanged behaviour. */
  plan?:TeamMatchPlan};
/**
 * 7v6: the goalkeeper leaves for a seventh court player during an established
 * attack, and comes back when the ball is lost (population.ts). SITUATIONAL
 * goes 7v6 only when there is a reason -- trailing late, or playing a man
 * short -- ALWAYS on every settled possession. The empty goal is real: the
 * opponent's existing shot choice reads the missing keeper.
 */
export type SevenVSixMode='OFF'|'SITUATIONAL'|'ALWAYS';
export const SEVEN_V_SIX_MODES:readonly SevenVSixMode[]=['OFF','SITUATIONAL','ALWAYS'];
export const sevenVSixMode=(s:CoreState,team:TeamId):SevenVSixMode=>s.coaching[team]?.sevenVSix??'OFF';
/** Whether the instruction wants a seventh court player right now. */
export function sevenVSixWanted(s:CoreState,team:TeamId):boolean {
  const mode=sevenVSixMode(s,team);
  if(mode!=='SITUATIONAL')return mode==='ALWAYS';
  const late=!!s.match&&s.officialClock.timeMs>s.match.periodLengthMs*2*.83,other=otherTeam(team);
  return late&&s.score[team]<s.score[other]||courtLimit(s,team)<courtLimit(s,other);
}
function sevenVSixBefore(s:CoreState,team:TeamId) {
  if(s.possession.team!==team||!s.ball.live||s.exchanges.some(e=>e.team===team&&e.phase!=='COMPLETED'&&e.phase!=='CANCELLED'))return;
  const court=courtPlayers(s,team),keeper=court.find(p=>p.kind==='GOALKEEPER');
  const ready=(p:CorePlayer)=>p.team===team&&p.population==='BENCH'&&!p.condition.unavailable&&!p.condition.exitRequired&&p.condition.attacksRemaining===0;
  if(sevenVSixWanted(s,team)) {
    // Only into a settled attack: the keeper's walk off is real time with the
    // goal already empty, and nobody leaves a goal during a counter-attack.
    if(!keeper||s.possession.phase!=='ESTABLISHED'||s.ball.controllerId===keeper.id||keeper.airborne)return;
    const seventh=plannedSeventhPlayer(s,team,ready)??s.players.filter(p=>ready(p)&&p.kind==='FIELD_PLAYER')
      .sort((a,b)=>b.profile.pivotPlay-a.profile.pivotPlay||b.condition.energy-a.condition.energy||a.id.localeCompare(b.id))[0];
    if(seventh)requestExchange(s,team,keeper.id,seventh.id);
  } else if(s.flow.sevenVTeam===team&&!keeper) {
    // Switched off mid-attack: the seventh player makes way at once rather
    // than waiting for the ball to be lost.
    const extra=court.find(p=>p.role==='P2'&&p.kind==='FIELD_PLAYER'&&p.id!==s.ball.controllerId);
    const back=s.players.find(p=>ready(p)&&p.kind==='GOALKEEPER');
    if(extra&&back)requestExchange(s,team,extra.id,back.id);
  }
}
export const initialCoaching=():Record<TeamId,TeamTactics>=>({HOME:{defence:'6:0',tempo:'BALANCED',attackIdentity:'BALANCED',rotation:false,timeouts:false,lastTimeoutPossession:null},AWAY:{defence:'6:0',tempo:'BALANCED',attackIdentity:'BALANCED',rotation:false,timeouts:false,lastTimeoutPossession:null}});
export const defensiveAggression=(s:CoreState,team:TeamId):DefensiveAggression=>s.coaching[team]?.aggression??'BALANCED';
/** Commands change future decisions; existing physical commitments finish normally. */
export function setTactics(s:CoreState,team:TeamId,patch:Partial<Pick<TeamTactics,'defence'|'tempo'|'attackIdentity'|'rotation'|'timeouts'|'aggression'|'rotationStrategy'|'sevenVSix'>>) {
  if(s.status!=='RUNNING')return false;
  if(patch.attackIdentity!==undefined&&!['BALANCED','COMBINATION','WIDTH','DIRECT'].includes(patch.attackIdentity))throw new Error('Invalid attacking identity');
  if(patch.defence!==undefined&&!['6:0','5:1'].includes(patch.defence)||patch.tempo!==undefined&&!OFFENSIVE_TEMPO_LEVELS.includes(patch.tempo)||
    patch.rotation!==undefined&&typeof patch.rotation!=='boolean'||patch.timeouts!==undefined&&typeof patch.timeouts!=='boolean'||
    patch.aggression!==undefined&&!DEFENSIVE_AGGRESSION_LEVELS.includes(patch.aggression)||
    patch.rotationStrategy!==undefined&&!ROTATION_STRATEGIES.includes(patch.rotationStrategy)||
    patch.sevenVSix!==undefined&&!SEVEN_V_SIX_MODES.includes(patch.sevenVSix))throw new Error('Invalid team tactics');
  Object.assign(s.coaching[team],patch);record(s,'TACTICS_CHANGED',null,{team,...patch});return true;
}
export function coachingBefore(s:CoreState) {
  if(!s.match||!['FIRST_HALF','SECOND_HALF'].includes(s.match.phase)||s.referee.timeout)return;
  for(const team of ['HOME','AWAY'] as const) {
    const tactics=s.coaching[team],players=courtPlayers(s,team);
    if(tactics.timeouts&&s.possession.team===team&&s.ball.controllerId&&s.ball.live&&s.officialClock.timeMs-s.match.periodStartMs>s.match.periodLengthMs*.6&&
      players.filter(p=>p.condition.energy<.72).length>=3&&tactics.lastTimeoutPossession!==s.possession.id) {
      if(requestTeamTimeout(s,team))tactics.lastTimeoutPossession=s.possession.id;
    }
    sevenVSixBefore(s,team);
    matchPlanBefore(s,team);
    if(!tactics.rotation)continue;
    const strategy=rotationStrategy(s,team),profile=ROTATION_PROFILES[strategy];
    // The match situation moves the line, never the rule. A short bench keeps
    // its best players on in a close finish; a wide one spreads the minutes
    // once the result is safe. BALANCED keeps the long-standing thresholds.
    const late=s.officialClock.timeMs>s.match.periodLengthMs*2*.83,margin=s.score[team]-s.score[otherTeam(team)];
    const tiredBelow=strategy==='SHORT'&&late&&Math.abs(margin)<=3?.42:strategy==='WIDE'&&late&&Math.abs(margin)>=6?.8:profile.tiredBelow;
    const free=(p:CorePlayer)=>p.kind==='FIELD_PLAYER'&&p.id!==s.ball.controllerId&&!p.airborne&&!exchangeActive(s,p.id);
    const ready=(p:CorePlayer)=>p.team===team&&p.population==='BENCH'&&!p.condition.unavailable&&p.condition.attacksRemaining===0;
    const tired=players.filter(p=>free(p)&&p.condition.energy<tiredBelow).sort((a,b)=>a.condition.energy-b.condition.energy||a.id.localeCompare(b.id));
    let requested=false;
    for(const outgoing of tired) {
      const incoming=s.players.filter(p=>ready(p)&&p.kind===outgoing.kind&&p.condition.energy>outgoing.condition.energy+profile.freshMargin)
        .sort((a,b)=>Number(b.role===outgoing.role)-Number(a.role===outgoing.role)||
          (profile.prefer==='STRENGTH'?playingStrength(b)-playingStrength(a):0)||b.condition.energy-a.condition.energy||a.id.localeCompare(b.id))[0];
      if(incoming&&requestExchange(s,team,outgoing.id,incoming.id)){requested=true;break;}
    }
    if(requested||strategy!=='SHORT')continue;
    // SHORT also restores its strongest lineup: a clearly stronger player in
    // the same role who has recovered on the bench replaces a weaker one.
    for(const weaker of players.filter(free).sort((a,b)=>playingStrength(a)-playingStrength(b)||a.id.localeCompare(b.id))) {
      const stronger=s.players.filter(p=>ready(p)&&p.kind===weaker.kind&&p.role===weaker.role&&p.condition.energy>=.78&&
        p.condition.energy>=weaker.condition.energy-.05&&playingStrength(p)>playingStrength(weaker)+.04)
        .sort((a,b)=>playingStrength(b)-playingStrength(a)||a.id.localeCompare(b.id))[0];
      if(stronger&&requestExchange(s,team,weaker.id,stronger.id))break;
    }
  }
}
