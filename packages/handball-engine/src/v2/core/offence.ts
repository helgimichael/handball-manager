import { actionAvailable,courtPlayers,getPlayer,otherTeam,record,uid,type CorePlayer,type CoreState,type Point,type TeamId } from './state';
import { clearGoalArea,clamp,distance,fieldLegal,laneClearance,local,shootingAngle,world } from './space';
import { startAction,driveTarget } from './actions';
import { exchangeActive } from './population';

export const ENTRY_FAMILIES=['CROSS','PIVOT_SCREEN','WING_TRANSITION','STRETCH_SHIFT','FREE'] as const;
export type EntryFamily=typeof ENTRY_FAMILIES[number];
export type OffensivePhase='UPPSPEL'|'UPPFOLJNING'|'UPPBYGGNAD'|'AVSLUTNING';
export type AttackIdentity='BALANCED'|'COMBINATION'|'WIDTH'|'DIRECT';
type Memory={recent:string[];outlets:string[];trials:Record<string,number>;observed:Record<string,number>;value:Record<string,number>};
export type AttackEntry={id:string;family:EntryFamily;side:-1|1;team:TeamId;initiatorId:string;partnerId:string;pivotId:string|null;defenderId:string|null;
  startedTick:number;origin:Point;origins:Record<string,Point>;moved:string[];recognized:string[];established:boolean;engagedSide:boolean;targets:Record<string,Point>;response:'UNREAD'|'HOLD_LINE'|'STEP_OUT'|'SWITCH'|'COLLAPSE'|'DENIED';lastReadTick:number;actions:number;receipts:number};
export type OffenceState={possessionId:string;phase:OffensivePhase;sinceTick:number;entry:AttackEntry|null;nextEntryTick:number;eventsSeen:number;memory:Record<TeamId,Memory>};
export const initialOffence=():OffenceState=>({possessionId:'',phase:'UPPSPEL',sinceTick:0,entry:null,nextEntryTick:0,eventsSeen:0,memory:{HOME:{recent:[],outlets:[],trials:{},observed:{},value:{}},AWAY:{recent:[],outlets:[],trials:{},observed:{},value:{}}}});
const available=(s:CoreState,p:CorePlayer)=>p.population==='COURT'&&p.kind==='FIELD_PLAYER'&&!exchangeActive(s,p.id)&&!p.condition.exitRequired;
const nearDefenders=(s:CoreState,p:CorePlayer,r:number)=>courtPlayers(s,otherTeam(p.team)).filter(d=>d.kind==='FIELD_PLAYER'&&distance(d.position,p.position)<r);
function finishEntry(s:CoreState,reason:string,value=0) {
  const e=s.offence.entry;if(!e)return;
  const memory=s.offence.memory[e.team],key=`${e.family}/${e.side}`;
  memory.value[key]=(memory.value[key]??0)*.7+value*.3;
  record(s,'ATTACK_ENTRY_ENDED',null,{entryId:e.id,family:e.family,reason,value,actions:e.actions,receipts:e.receipts});
  s.offence.entry=null;s.offence.nextEntryTick=s.tick+24;
}
function phase(s:CoreState,next:OffensivePhase,reason:string) {
  if(s.offence.phase===next&&s.offence.possessionId===s.possession.id)return;
  s.offence.phase=next;s.offence.sinceTick=s.tick;record(s,'OFFENSIVE_SUBPHASE',null,{phase:next,reason,gamePhase:s.possession.phase});
}
/** Observe executed events before making another decision. No planned result is credited. */
export function offenceAfter(s:CoreState) {
  const o=s.offence,through=s.events.length;
  for(let i=o.eventsSeen;i<through;i++) {
    const event=s.events[i],e=o.entry;if(!e)continue;
    if(event.type==='PASS_RECEIVED'&&event.possessionId===o.possessionId)e.receipts++;
    if(event.type==='SHOT_RELEASED'&&event.possessionId===o.possessionId){
      const shooter=getPlayer(s,event.actorId!);const q=local(shooter.position,s.directions[shooter.team]);
      finishEntry(s,'Shot released from the resulting situation',clamp((13-q.y)/5,0,1)-nearDefenders(s,shooter,1.5).length*.2);
    }else if(event.type==='RESTART_AWARDED'||event.type==='POSSESSION_CHANGED'||event.type==='PERIOD_ENDED')finishEntry(s,event.type);
  }
  o.eventsSeen=s.events.length;
}
/** Candidate utilities describe different defensive problems, not named animations. */
export function entryCandidates(s:CoreState) {
  const team=s.possession.team,players=courtPlayers(s,team).filter(p=>available(s,p)),carrier=players.find(p=>p.id===s.ball.controllerId);
  if(!carrier)return [];
  const direction=s.directions[team],c=local(carrier.position,direction),defenders=courtPlayers(s,otherTeam(team)).filter(p=>p.kind==='FIELD_PLAYER');
  const centre=players.find(p=>p.role==='CB'),pivot=players.find(p=>p.role==='P'||p.role==='P2'),identity=s.coaching[team].attackIdentity,memory=s.offence.memory[team];
  const late=s.match&&s.period===2&&s.officialClock.timeMs-s.match.periodStartMs>s.match.periodLengthMs*.85;
  const urgency=late&&s.score[team]<s.score[otherTeam(team)]?.7:0;
  const candidates:{family:EntryFamily;side:-1|1;partner:CorePlayer;pivot:CorePlayer|undefined;score:number;reason:string}[]=[];
  for(const side of [-1,1] as const) {
    const back=players.find(p=>p.role===(side<0?'LB':'RB')),wing=players.find(p=>p.role===(side<0?'LW':'RW'));
    const partner=carrier.id===back?.id?centre:back;
    const defendersOnSide=defenders.filter(d=>(d.position.x-10)*side>0),depth=defendersOnSide.length?defendersOnSide.reduce((n,d)=>n+local(d.position,direction).y,0)/defendersOnSide.length:7;
    const gap=defendersOnSide.length?Math.min(...defendersOnSide.map(d=>Math.abs(d.position.x-(10+side*4)))):4;
    const skill=partner?partner.attributes.skill*partner.condition.energy:0;
    const spatial=(c.x-10)*side>0?.3:0;
    const add=(family:EntryFamily,who:CorePlayer|undefined,score:number,reason:string)=>{
      if(!who||who.id===carrier.id)return;
      const key=`${family}/${side}`,recent=memory.recent.reduce((n,k,i)=>n+(k===key?(i+1)/memory.recent.length:0),0);
      const exposure=memory.recent.filter(k=>k.startsWith(family+'/')).length;
      const effort=family==='CROSS'||family==='WING_TRANSITION'?(who.condition.energy-.8)*1.5:0;
      const pace=family==='FREE'||family==='STRETCH_SHIFT'?urgency+(s.coaching[team].tempo==='QUICK'?.2:0):0;
      candidates.push({family,side,partner:who,pivot,score:score+spatial+skill*.6+effort+pace+(memory.value[key]??0)*.4-recent*.8-exposure*.12,reason});
    };
    if(partner&&distance(partner.position,carrier.position)<12)add('CROSS',partner,1.1+(depth>8?.8:0)+(identity==='COMBINATION'?.8:0),'Change the backcourt matchup and test switch versus pursuit');
    if(pivot&&partner)add('PIVOT_SCREEN',partner,1.15+gap*.2+pivot.attributes.skill*.4+(identity==='COMBINATION'?.6:0),'Bind inside cover to a stationary pivot and attack its adjacent interval');
    if(pivot&&wing&&players.length>=6)add('WING_TRANSITION',wing,.8+(depth>8?.7:0)+(identity==='COMBINATION'?.3:0)+(defenders.length<6?.5:0),'Move a wing into a second line-player relationship behind advanced cover');
    if(back)add('STRETCH_SHIFT',back,1.25+(depth<8?.5:0)+(identity==='WIDTH'?1:0),'Engage one half of the defence and preserve a weak-side outlet');
    add('FREE',partner??wing,.9+(identity==='DIRECT'?1.3:0)+(s.offence.phase==='UPPFOLJNING'?.8:0),'Keep width and exploit player-led opportunities without a prescribed partner');
  }
  return candidates.sort((a,b)=>b.score-a.score||a.family.localeCompare(b.family)||a.side-b.side);
}
function selectEntry(s:CoreState) {
  const candidates=entryCandidates(s),choice=candidates[0];if(!choice)return;
  const carrier=getPlayer(s,s.ball.controllerId!),team=carrier.team,direction=s.directions[team],c=local(carrier.position,direction),side=choice.side;
  const defender=courtPlayers(s,otherTeam(team)).filter(d=>d.kind==='FIELD_PLAYER').sort((a,b)=>distance(a.position,carrier.position)-distance(b.position,carrier.position))[0];
  const e:AttackEntry={id:uid(s,'entry'),family:choice.family,side,team,initiatorId:carrier.id,partnerId:choice.partner.id,pivotId:choice.pivot?.id??null,defenderId:defender?.id??null,
    startedTick:s.tick,origin:{...c},origins:{},moved:[],recognized:[],established:false,engagedSide:false,targets:{},response:'UNREAD',lastReadTick:s.tick-12,actions:0,receipts:0};
  const target=(p:CorePlayer,x:number,y:number)=>{const point=clearGoalArea(world({x:clamp(x,.8,19.2),y:clamp(y,6.8,18)},direction),direction,p.radius+.55);if(fieldLegal(point,p.radius))e.targets[p.id]=point;};
  if(e.family==='CROSS') {
    const towards=Math.sign(choice.partner.position.x-c.x)||side;
    target(choice.partner,clamp(c.x-towards*2.2,3,17),clamp(c.y+1.2,10,15));
    target(carrier,clamp(c.x+towards*2.4,3,17),clamp(c.y,10,14));
  }else if(e.family==='PIVOT_SCREEN'&&choice.pivot) {
    const dx=defender?.position.x??10;
    target(choice.pivot,dx+side*.85,7.1);target(choice.partner,dx+side*2.2,10.2);
  }else if(e.family==='WING_TRANSITION'&&choice.pivot) {
    target(choice.partner,10+side*2.5,7.3);target(choice.pivot,10-side*2.2,7.1);
    const back=courtPlayers(s,team).find(p=>p.role===(side<0?'LB':'RB'));if(back)target(back,10+side*6.4,10.8);
  }else if(e.family==='STRETCH_SHIFT') {
    target(choice.partner,10+side*5.8,10.8);
    if(choice.pivot)target(choice.pivot,10+side*2.4,7);
  }
  for(const id of Object.keys(e.targets))e.origins[id]={...getPlayer(s,id).position};
  s.offence.entry=e;
  const memory=s.offence.memory[team],key=`${e.family}/${side}`;memory.trials[key]=(memory.trials[key]??0)+1;memory.recent.push(key);if(memory.recent.length>10)memory.recent.shift();
  record(s,'ATTACK_ENTRY_SELECTED',carrier,{entryId:e.id,family:e.family,side,partnerId:e.partnerId,score:choice.score,alternative:candidates[1]?.family??'none',reason:choice.reason,identity:s.coaching[team].attackIdentity},[e.partnerId]);
}
export function offenceBefore(s:CoreState) {
  const o=s.offence;if(!s.ball.live)return;
  const changed=o.possessionId!==s.possession.id;
  if(changed){finishEntry(s,'Possession changed');o.possessionId=s.possession.id;o.nextEntryTick=s.tick;}
  const carrier=s.ball.controllerId?getPlayer(s,s.ball.controllerId):null;if(!carrier||carrier.team!==s.possession.team)return;
  const direction=s.directions[carrier.team],q=local(carrier.position,direction),defenders=courtPlayers(s,otherTeam(carrier.team)).filter(d=>d.kind==='FIELD_PLAYER');
  const recovered=defenders.filter(d=>local(d.position,direction).y<11).length;
  const finish=q.y<9&&shootingAngle(carrier.position,direction)>.2||carrier.airborne!==null||!!carrier.action&&['JUMP','SHOOT'].includes(carrier.action.kind)&&!['COMPLETED','INTERRUPTED','FAILED'].includes(carrier.action.phase);
  const next:OffensivePhase=finish?'AVSLUTNING':s.possession.phase==='TRANSITION'?(q.y>20?'UPPSPEL':recovered<Math.min(5,defenders.length)?'UPPFOLJNING':'UPPBYGGNAD'):'UPPBYGGNAD';
  if(changed||next!==o.phase){o.phase=next;o.sinceTick=s.tick;record(s,'OFFENSIVE_SUBPHASE',carrier,{phase:next,reason:finish?'Actual finishing window':recovered>=5?'Defence recovered':'Ball progress and supporting waves',gamePhase:s.possession.phase});}
  const e=o.entry;
  if(e&&(![e.initiatorId,e.partnerId,...(e.pivotId?[e.pivotId]:[])].every(id=>available(s,getPlayer(s,id)))||s.tick-e.startedTick>160))finishEntry(s,'Relationship no longer available');
  if(!o.entry&&s.tick>=o.nextEntryTick&&q.y<19&&q.y>8&&next!=='AVSLUTNING'&&s.referee.passive.warnedTick===null&&courtPlayers(s,carrier.team).filter(p=>available(s,p)).length>=5&&actionAvailable(carrier))selectEntry(s);
  const active=o.entry;if(!active||s.tick-active.lastReadTick<12)return;
  for(const [id,origin] of Object.entries(active.origins))if(!active.moved.includes(id)&&distance(getPlayer(s,id).position,origin)>.8){
    if(active.moved.length===0){const memory=o.memory[active.team],key=`${active.family}/${active.side}`;memory.observed[key]=(memory.observed[key]??0)+1;}
    active.moved.push(id);record(s,'ATTACK_ENTRY_MOVEMENT',getPlayer(s,id),{entryId:active.id,family:active.family,metres:distance(getPlayer(s,id).position,origin)});
  }
  const initiator=getPlayer(s,active.initiatorId),partnerPlayer=getPlayer(s,active.partnerId),pivot=active.pivotId?getPlayer(s,active.pivotId):null;
  const crossed=active.family==='CROSS'&&(initiator.position.x-partnerPlayer.position.x)*(active.origins[initiator.id].x-active.origins[partnerPlayer.id].x)<0;
  const screen=pivot&&pivot.action?.kind==='SCREEN'&&pivot.action.phase==='EXECUTING'&&active.targets[pivot.id]&&distance(pivot.position,active.targets[pivot.id])<.8;
  const entered=active.family==='WING_TRANSITION'&&active.targets[partnerPlayer.id]&&distance(partnerPlayer.position,active.targets[partnerPlayer.id])<.8;
  if((carrier.position.x-10)*active.side>2)active.engagedSide=true;
  const reversed=active.family==='STRETCH_SHIFT'&&active.engagedSide&&active.receipts>0&&(carrier.position.x-10)*active.side<-2;
  if(!active.established&&(crossed||active.family==='PIVOT_SCREEN'&&screen||entered||reversed)){active.established=true;record(s,'ATTACK_RELATIONSHIP_ESTABLISHED',initiator,{entryId:active.id,family:active.family,evidence:crossed?'RELATIVE_CROSSING':entered?'WING_REACHED_LINE':reversed?'BALL_REVERSED_TO_WEAK_SIDE':'STATIONARY_SCREEN'},[partnerPlayer.id]);}
  active.lastReadTick=s.tick;
  const defender=active.defenderId?getPlayer(s,active.defenderId):null,partner=getPlayer(s,active.partnerId);
  const response:AttackEntry['response']=s.defence.handover?.attackerIds.some(id=>id===active.initiatorId||id===active.partnerId)?'SWITCH':nearDefenders(s,carrier,3).length>=2?'COLLAPSE':defender&&local(defender.position,direction).y>9?'STEP_OUT':laneClearance(s,carrier.position,partner.position,carrier.team)<.5?'DENIED':'HOLD_LINE';
  if(response!==active.response){active.response=response;record(s,'ATTACK_RESPONSE',carrier,{entryId:active.id,family:active.family,response},defender?[defender.id]:[]);}
}
/** Off-ball assignments are intentions; only the existing executor moves a body. */
export function offensiveTarget(s:CoreState,p:CorePlayer):Point|null {
  const e=s.offence.entry;if(!e||e.team!==p.team||e.family==='FREE')return null;
  if(e.response==='COLLAPSE'&&p.id===e.partnerId&&e.family!=='WING_TRANSITION')return clearGoalArea(world({x:10-e.side*5.5,y:11.5},s.directions[p.team]),s.directions[p.team],p.radius+.55);
  return e.targets[p.id]??null;
}
export function offensiveScreen(s:CoreState,p:CorePlayer) {
  const e=s.offence.entry;return !!e&&(e.family==='PIVOT_SCREEN'||e.family==='WING_TRANSITION')&&(p.id===e.pivotId||e.family==='WING_TRANSITION'&&p.id===e.partnerId);
}
/** Recognition needs repeated exposure AND observable committed movement, not knowledge of a play call. */
export function anticipatedDefenceTarget(s:CoreState,p:CorePlayer,target:Point):Point {
  const e=s.offence.entry;if(!e||p.team===e.team||e.actions===0||e.family!=='CROSS'||s.defence.marks[p.id]!==e.partnerId)return target;
  if((s.offence.memory[e.team].observed[`${e.family}/${e.side}`]??0)<3)return target;
  const partner=getPlayer(s,e.partnerId);
  if(!partner.action||!['COMMITTED','EXECUTING'].includes(partner.action.phase)||Math.hypot(partner.velocity.x,partner.velocity.y)<.8)return target;
  const carrier=s.ball.controllerId?getPlayer(s,s.ball.controllerId):null;if(!carrier)return target;
  const read={x:target.x+Math.sign(carrier.position.x-target.x)*.5*p.attributes.defence,y:target.y};
  if(!fieldLegal(read,p.radius))return target;
  if(!e.recognized.includes(p.id)){e.recognized.push(p.id);record(s,'DEFENSIVE_ENTRY_RECOGNIZED',p,{entryId:e.id,family:e.family,observed:s.offence.memory[e.team].observed[`${e.family}/${e.side}`],targetX:read.x,ordinaryTargetX:target.x},[partner.id]);}
  return read;
}
function action(s:CoreState,p:CorePlayer,kind:'PASS'|'DRIVE'|'FEINT'|'JUMP',reason:string,target:Point|null=null,targetId:string|null=null) {
  if(!startAction(s,p,kind,reason,target,targetId))return false;
  const e=s.offence.entry;if(e){e.actions++;record(s,'ATTACK_ENTRY_ACTION',p,{entryId:e.id,family:e.family,response:e.response,kind,reason},targetId?[targetId]:[]);}
  if(kind==='JUMP')phase(s,'AVSLUTNING',reason);return true;
}
/** Safe opportunities can override the relationship. Scores never grant an outcome. */
export function chooseOffensiveAction(s:CoreState,p:CorePlayer):boolean {
  const e=s.offence.entry;if(!e||e.team!==p.team||p.airborne)return false;
  const direction=s.directions[p.team],q=local(p.position,direction),held=s.tick-p.handling.heldSinceTick;
  const pressure=nearDefenders(s,p,2).length,angle=shootingAngle(p.position,direction);
  if(q.y<9&&angle>.18&&pressure<2)return action(s,p,'JUMP','Exploit immediate finishing window ahead of the planned relationship');
  const receivers=courtPlayers(s,p.team).filter(a=>a.id!==p.id&&available(s,a)&&!a.airborne);
  const candidates=receivers.map(a=>{
    const point=local(a.position,direction),clear=laneClearance(s,p.position,a.position,p.team),crowded=nearDefenders(s,a,1.7).length;
    const finish=point.y<9&&shootingAngle(a.position,direction)>.18&&crowded<2?2.4:0;
    const relationship=a.id===e.partnerId?e.response==='DENIED'?0:1.2:a.id===e.pivotId&&e.response==='STEP_OUT'?1.8:0;
    const weakSide=e.response==='COLLAPSE'&&(a.position.x-10)*e.side<0?1.7:0;
    const wave=s.offence.phase==='UPPFOLJNING'?(q.y-point.y)*.12+Math.hypot(a.velocity.x,a.velocity.y)*.1:0;
    return {a,clear,score:Math.min(clear,2)*.65+finish+relationship+weakSide+wave+(q.y-point.y)*.13-crowded*.45-(a.id===s.possession.lastPasserId?.9:0)-(distance(a.position,p.position)>15?1.5:0)};
  }).filter(c=>c.clear>.5).sort((a,b)=>b.score-a.score||a.a.id.localeCompare(b.a.id));
  const shot=q.y<13.5&&angle>.13?1.4+(13.5-q.y)*.22+p.attributes.skill*.5-pressure*.8:-10;
  const pass=candidates[0];
  if(shot>(pass?.score??-10)&&held>=6)return action(s,p,'JUMP','Defence leaves a shot worth taking; break the entry');
  if(e.family==='CROSS'&&p.id===e.initiatorId&&e.receipts===0&&held<20&&p.handling.steps===0&&pressure<2) {
    const target=e.targets[p.id];if(target&&distance(p.position,target)>.8)return action(s,p,'DRIVE','Engage across the adjacent defender before reading the crossing partner',target,e.defenderId);
  }
  if(e.family==='FREE'&&pressure===1&&p.handling.steps===0&&held<24&&!p.handling.dribbleUsed&&p.attributes.skill>.55)return action(s,p,'FEINT','Player-led duel against isolated pressure',null,s.defence.pressureId);
  if(e.response==='SWITCH'&&pressure===0&&p.handling.steps===0&&held<24&&q.y<13)return action(s,p,'DRIVE','Attack the interval exposed by the defensive switch',driveTarget(s,p),s.defence.pressureId);
  if(pass&&held>=6)return action(s,p,'PASS',pass.a.id===e.partnerId?'Continue the available entry relationship':e.response==='COLLAPSE'?'Release away from converging cover':'Better opportunity overrides the intended partner',null,pass.a.id);
  return false;
}
