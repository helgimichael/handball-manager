import type { MatchRenderSnapshot } from '@handball-manager/match-contract';
import type { CoreState } from '@handball-manager/handball-engine/src/v2/core/state';

/** This adapter reads one supplied tick; it has no gameplay, history or future state. */
export function v2CoreRenderSnapshot(s:CoreState):MatchRenderSnapshot {
  return {simulationTime:s.timeMs/1000,court:{view:'FULL_COURT',widthMeters:20,lengthMeters:40,attackingGoalSide:s.directions[s.possession.team]},
    players:s.players.filter(p=>p.population==='COURT').map(p=>({id:p.id,side:p.team===s.possession.team?'ATTACK':'DEFENSE',kind:p.kind,x:p.position.x,y:p.position.y,roleLabel:p.role,
      orientationDegrees:Math.hypot(p.velocity.x,p.velocity.y)>0?(Math.atan2(p.velocity.x,-p.velocity.y)*180/Math.PI+360)%360:null})),
    ball:{x:s.ball.position.x,y:s.ball.position.y,possessorPlayerId:s.ball.controllerId,...(s.ball.live?{status:s.ball.flight?'IN_FLIGHT' as const:s.ball.controllerId?'POSSESSED' as const:'LOOSE' as const}:{})}};
}
