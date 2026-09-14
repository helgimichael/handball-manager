import { courtPlayers,record,type CoreState,type TeamId } from './state';
import { requestExchange,exchangeActive } from './population';
import { requestTeamTimeout } from './referee';
import type { AttackIdentity } from './offence';

export type TeamTactics={defence:'6:0'|'5:1';tempo:'BALANCED'|'QUICK';attackIdentity:AttackIdentity;rotation:boolean;timeouts:boolean;lastTimeoutPossession:string|null};
export const initialCoaching=():Record<TeamId,TeamTactics>=>({HOME:{defence:'6:0',tempo:'BALANCED',attackIdentity:'BALANCED',rotation:false,timeouts:false,lastTimeoutPossession:null},AWAY:{defence:'6:0',tempo:'BALANCED',attackIdentity:'BALANCED',rotation:false,timeouts:false,lastTimeoutPossession:null}});
/** Commands change future decisions; existing physical commitments finish normally. */
export function setTactics(s:CoreState,team:TeamId,patch:Partial<Pick<TeamTactics,'defence'|'tempo'|'attackIdentity'|'rotation'|'timeouts'>>) {
  if(s.status!=='RUNNING')return false;
  if(patch.attackIdentity!==undefined&&!['BALANCED','COMBINATION','WIDTH','DIRECT'].includes(patch.attackIdentity))throw new Error('Invalid attacking identity');
  if(patch.defence!==undefined&&!['6:0','5:1'].includes(patch.defence)||patch.tempo!==undefined&&!['BALANCED','QUICK'].includes(patch.tempo)||
    patch.rotation!==undefined&&typeof patch.rotation!=='boolean'||patch.timeouts!==undefined&&typeof patch.timeouts!=='boolean')throw new Error('Invalid team tactics');
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
