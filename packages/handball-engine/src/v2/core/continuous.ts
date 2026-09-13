import { createCoreScenario } from './scenarios';
import { type CorePlayer,type Direction,type CoreState } from './state';
import { requestExchange } from './population';

export type SessionMode='CONTINUOUS_PLAY'|'SEVEN_V_SIX';
export function createContinuous(mode:SessionMode='CONTINUOUS_PLAY',seed=2025,direction:Direction='TOP',stopAfter:number|null=6):CoreState {
  const s=createCoreScenario('ESTABLISHED_6V6',seed,direction);
  s.scenario=mode;s.flow={continuous:true,outcomes:0,lastOutcomeTick:-1,stopAfter,sevenVTeam:mode==='SEVEN_V_SIX'?'HOME':null};
  s.checkpoint.stopOnOutcome=false;s.checkpoint.maxTicks=12000;
  for(const team of ['HOME','AWAY'] as const) {
    const template=s.players.find(p=>p.team===team&&p.role==='CB')!;
    for(const [number,role] of [[8,'P2'],[9,'CB']] as const) {
      const player:CorePlayer=JSON.parse(JSON.stringify(template));
      player.id=`${team==='HOME'?'H':'A'}0${number}`;player.role=role;player.population='BENCH';player.position={x:-.35,y:s.directions[team]==='TOP'?24:16};s.players.push(player);
    }
  }
  if(mode==='SEVEN_V_SIX') {
    const keeper=s.players.find(p=>p.id==='H07')!;keeper.position={x:1,y:direction==='TOP'?24:16};
    requestExchange(s,'HOME','H07','H08');
  }
  return s;
}
