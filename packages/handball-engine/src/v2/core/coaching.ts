import { courtPlayers,record,type CoreState,type TeamId } from './state';
import { requestExchange,exchangeActive } from './population';
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
export type TeamTactics={defence:'6:0'|'5:1';tempo:OffensiveTempo;attackIdentity:AttackIdentity;rotation:boolean;timeouts:boolean;lastTimeoutPossession:string|null;
  /** Absent in active saves created before the instruction existed; reads as BALANCED. */
  aggression?:DefensiveAggression};
export const initialCoaching=():Record<TeamId,TeamTactics>=>({HOME:{defence:'6:0',tempo:'BALANCED',attackIdentity:'BALANCED',rotation:false,timeouts:false,lastTimeoutPossession:null},AWAY:{defence:'6:0',tempo:'BALANCED',attackIdentity:'BALANCED',rotation:false,timeouts:false,lastTimeoutPossession:null}});
export const defensiveAggression=(s:CoreState,team:TeamId):DefensiveAggression=>s.coaching[team]?.aggression??'BALANCED';
/** Commands change future decisions; existing physical commitments finish normally. */
export function setTactics(s:CoreState,team:TeamId,patch:Partial<Pick<TeamTactics,'defence'|'tempo'|'attackIdentity'|'rotation'|'timeouts'|'aggression'>>) {
  if(s.status!=='RUNNING')return false;
  if(patch.attackIdentity!==undefined&&!['BALANCED','COMBINATION','WIDTH','DIRECT'].includes(patch.attackIdentity))throw new Error('Invalid attacking identity');
  if(patch.defence!==undefined&&!['6:0','5:1'].includes(patch.defence)||patch.tempo!==undefined&&!OFFENSIVE_TEMPO_LEVELS.includes(patch.tempo)||
    patch.rotation!==undefined&&typeof patch.rotation!=='boolean'||patch.timeouts!==undefined&&typeof patch.timeouts!=='boolean'||
    patch.aggression!==undefined&&!DEFENSIVE_AGGRESSION_LEVELS.includes(patch.aggression))throw new Error('Invalid team tactics');
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
    if(!tactics.rotation)continue;
    const tired=players.filter(p=>p.kind==='FIELD_PLAYER'&&p.id!==s.ball.controllerId&&!p.airborne&&!exchangeActive(s,p.id)&&p.condition.energy<.62).sort((a,b)=>a.condition.energy-b.condition.energy||a.id.localeCompare(b.id));
    for(const outgoing of tired) {
      const incoming=s.players.filter(p=>p.team===team&&p.population==='BENCH'&&p.kind===outgoing.kind&&!p.condition.unavailable&&p.condition.attacksRemaining===0&&p.condition.energy>outgoing.condition.energy+.18)
        .sort((a,b)=>Number(b.role===outgoing.role)-Number(a.role===outgoing.role)||b.condition.energy-a.condition.energy||a.id.localeCompare(b.id))[0];
      if(incoming&&requestExchange(s,team,outgoing.id,incoming.id))break;
    }
  }
}
