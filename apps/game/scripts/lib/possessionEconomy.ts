/** Passive developer reconstruction. Never imported by canonical simulation. */
import type {CoreState,CoreEvent,TeamId} from '@handball-manager/handball-engine/src/v2/core/state';
import {ledger,lossClassOf,readPossessionContinuations,type Ending} from '@handball-manager/handball-engine/src/v2/core/ledger';
import {releasePressure} from '@handball-manager/handball-engine/src/v2/core/execution';
import {distribution,ratio} from '../../lib/matchBenchmarks/statistics';

const touch=new Set(['BALL_CONTROLLED','PASS_RECEIVED','SHOT_RELEASED','REBOUND_CONTROLLED']);
const terminal=new Set(['POSSESSION_CHANGED','POSSESSION_AWARDED']);
const own=(s:Readonly<CoreState>,e:CoreEvent)=>s.players.find(p=>p.id===e.actorId)?.team;
const segment=(ms:number)=>Math.min(3,Math.floor(Math.max(0,ms-1)/900000));
export type TechnicalObservation={eventId:string;actionId:string|null;type:string;team:TeamId;playerId:string;energy:number;acute:number;pressure:number;difficulty:number|null;error:number|null;risk:number|null};
export class EconomyObserver {
 readonly technical:TechnicalObservation[]=[];private seen=new Set<string>();
 observe=(s:Readonly<CoreState>,events:readonly CoreEvent[])=>{
  for(const e of events){if(this.seen.has(e.id))continue;this.seen.add(e.id);
   if(!['PASS_RELEASED','PASS_RECEIVED','RECEPTION_FAILED','INTERCEPTION','CONTROL_MISTOUCH'].includes(e.type))continue;
   const p=s.players.find(p=>p.id===e.actorId);if(!p)continue;
   this.technical.push({eventId:e.id,actionId:e.actionId,type:e.type,team:p.team,playerId:p.id,energy:p.condition.energy,acute:p.condition.acuteExertion??0,
    pressure:typeof e.details.pressure==='number'?e.details.pressure:releasePressure(s as CoreState,p),difficulty:typeof e.details.difficulty==='number'?e.details.difficulty:null,
    error:typeof e.details.executionError==='number'?e.details.executionError:null,risk:typeof e.details.risk==='number'?e.details.risk:null});
  }
 };
}
type Loss='BAD_PASS_OUT'|'INTERCEPTION'|'DROPPED_RECEPTION'|'DEFLECTED_PASS_RECOVERED'|'DRIBBLE_CONTROL_LOSS'|'BALL_CONTROL_LOSS_UNSPECIFIED'|'FAILED_RECEIVE_UNSPECIFIED'|'TECHNICAL_RULE_VIOLATION'|'PASSIVE_PLAY'|'OFFENSIVE_FOUL'|'OTHER';
type EconomyEnding='OFFENSIVE_FOUL'|'TURNOVER'|'GOAL'|'HALF_END'|'FIELD_SHOT_MISS_SAVE'|'UNRESOLVED'|'OTHER';
export type EconomyRecord={
 key:string;canonicalId:string;period:number;team:TeamId;
 firstTick:number;lastTick:number;startMs:number;endMs:number;durationSeconds:number;
 ending:EconomyEnding;ledgerEnding:Ending;reconstructedTerminal:string;evidence:string;loss:Loss|null;
 hasShot:boolean;hasSevenMetre:boolean;shots:number;fieldShots:number;sevenMetres:number;
 passesReleased:number;passesReceived:number;freeThrows:number;freeThrowsBeforeShot:number;freeThrowsBeforeLoss:number;
 freeThrowSegments:number[];transferEvents:number;receptionFumbles:number;retainedFumbles:boolean;retainedRebounds:number;
};
const lossKeys:Loss[]=['BAD_PASS_OUT','INTERCEPTION','DROPPED_RECEPTION','DEFLECTED_PASS_RECOVERED','DRIBBLE_CONTROL_LOSS','BALL_CONTROL_LOSS_UNSPECIFIED','FAILED_RECEIVE_UNSPECIFIED','TECHNICAL_RULE_VIOLATION','PASSIVE_PLAY','OFFENSIVE_FOUL','OTHER'];
const counts=(keys:readonly string[])=>Object.fromEntries(keys.map(k=>[k,0]));
/** Independent terminal ownership reading; a winner's opening INTERCEPTION is not its loss. */
function terminalEnding(events:readonly CoreEvent[],team:TeamId,s:Readonly<CoreState>){
 const transferIndex=events.findLastIndex(e=>terminal.has(e.type)&&e.details.ended===true&&
  (e.type==='POSSESSION_AWARDED'?e.details.owner!==team:own(s,e)!==team));
 const transfer=events[transferIndex];
 if(!transfer){if(events.some(e=>e.type==='GOAL'))return{ending:'GOAL',evidence:'goal'};if(events.some(e=>e.type==='PERIOD_ENDED'))return{ending:'PERIOD_END',evidence:'actual half end'};return{ending:'STILL_IN_PROGRESS',evidence:'no confirmed opponent transfer'};}
 const before=events.slice(0,transferIndex+1),reason=String(transfer.details.reason??''),release=before.findLast(e=>e.type==='PASS_RELEASED'||e.type==='SHOT_RELEASED');
 if(reason==='Goal crossed line'||before.some(e=>e.type==='GOAL'))return{ending:'GOAL',evidence:reason||'goal'};
 if(reason==='Intercepted')return{ending:'INTERCEPTION',evidence:'confirmed opponent control: '+reason};
 if(before.some(e=>e.type==='OFFENSIVE_FOUL'))return{ending:'OFFENSIVE_FOUL',evidence:'explicit offensive foul with transfer'};
 if(reason==='Passive play after pass allowance'||before.some(e=>e.type==='PASSIVE_PLAY'&&e.tick===transfer.tick))return{ending:'PASSIVE_PLAY',evidence:reason};
 if(transfer.type==='POSSESSION_AWARDED'&&reason!=='Ball crossed court boundary'&&reason!=='Keeper controls ball inside goal area'&&reason!=='Keeper recovered rebound')return{ending:'TECHNICAL_VIOLATION',evidence:reason||'restart awarded against attack'};
 if(release?.type==='SHOT_RELEASED'){
  const following=before.slice(before.indexOf(release)+1),retained=following.some(e=>touch.has(e.type)&&e.type!=='SHOT_RELEASED'&&own(s,e)===team);
  const facts=following.filter(e=>e.actionId===release.actionId);
  if(!retained)return{ending:facts.some(e=>e.type==='KEEPER_COLLECTED_OFF_TARGET'||e.type==='OFF_TARGET_KEEPER_TOUCH')?'SHOT_WIDE':facts.some(e=>e.type==='SAVE_PARRY'||e.type==='SAVE_CAUGHT')?'SHOT_SAVED_REBOUND_LOST':facts.some(e=>e.type==='SHOT_BLOCKED')?'SHOT_BLOCKED_REBOUND_LOST':'SHOT_WIDE',evidence:'last actual shot action outcome: '+reason};
 }
 if(reason==='Ball crossed court boundary')return{ending:'BAD_PASS_OUT',evidence:reason};
 if(reason==='Loose-ball recovery')return{ending:'DUEL_LOSS',evidence:reason};
 return{ending:'RECEPTION_FAILED',evidence:reason||'other confirmed opponent control'};
}
function cause(ending:string,events:readonly CoreEvent[],s:Readonly<CoreState>,team:TeamId):Loss|null {
 if(!lossClassOf(ending as Parameters<typeof lossClassOf>[0]))return null;
 if(ending==='INTERCEPTION')return 'INTERCEPTION';
 if(ending==='TECHNICAL_VIOLATION')return 'TECHNICAL_RULE_VIOLATION';
 if(ending==='PASSIVE_PLAY')return 'PASSIVE_PLAY';
 if(ending==='OFFENSIVE_FOUL')return 'OFFENSIVE_FOUL';
 const transfer=events.findLast(e=>terminal.has(e.type)&&e.details.ended===true);
 const through=transfer?events.filter(e=>e.tick<=transfer.tick):events;
 const lastControl=through.findLastIndex(e=>['BALL_CONTROLLED','PASS_RECEIVED','REBOUND_CONTROLLED'].includes(e.type)&&own(s,e)===team);
 // Earlier fumbles followed by own control are retained incidents, not the terminal cause.
 const relevant=through.slice(lastControl+1);
 if(relevant.some(e=>e.type==='CONTROL_MISTOUCH'))return 'DRIBBLE_CONTROL_LOSS';
 if(relevant.some(e=>e.type==='RECEPTION_FAILED'))return 'DROPPED_RECEPTION';
 if(relevant.some(e=>e.type==='PASS_DEFLECTED'))return 'DEFLECTED_PASS_RECOVERED';
 if(ending==='BAD_PASS_OUT'||ending==='OUT_OF_COURT')return 'BAD_PASS_OUT';
 if(ending==='RECEPTION_FAILED')return 'FAILED_RECEIVE_UNSPECIFIED';
 if(ending==='DUEL_LOSS')return 'BALL_CONTROL_LOSS_UNSPECIFIED';
 return 'OTHER';
}
function actionBreakdown(technical:readonly TechnicalObservation[]){
 const bands:Record<string,Record<string,{n:number;error:number;risk:number;errors:number;riskSamples:number}>>={};
 for(const e of technical){const fatigue=e.energy<.3||e.energy<.4&&e.acute>.35?'SEVERE':e.energy>=.7&&e.acute<.35?'READY':'MODERATE',pressure=e.pressure<.2?'LOW':e.pressure<1?'MEDIUM':'HIGH',difficulty=e.difficulty===null?'UNRECORDED':e.difficulty<.2?'SIMPLE':e.difficulty<=.5?'MODERATE':'DIFFICULT';
  for(const [dimension,value]of [['fatigue',fatigue],['acute',e.acute>=.6?'HIGH':'LOWER'],['pressure',pressure],['difficulty',difficulty],['fatiguePressureDifficulty',[fatigue,pressure,difficulty].join(':')]]){
   const r=(bands[dimension]??={})[value+':'+e.type]??=({n:0,error:0,risk:0,errors:0,riskSamples:0});r.n++;if(e.error!==null){r.error+=e.error;r.errors++;}if(e.risk!==null){r.risk+=e.risk;r.riskSamples++;}
  }
 }
 return Object.fromEntries(Object.entries(bands).map(([d,values])=>[d,Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{n:v.n,meanThrowError:ratio(v.error,v.errors),meanRecordedCatchRisk:ratio(v.risk,v.riskSamples)}]))]));
}
export function possessionEconomy(s:Readonly<CoreState>,technical:readonly TechnicalObservation[]=[]){
 const raw:CoreEvent[]=[],ids=new Set<string>();let duplicateEvents=0;
 for(const e of s.events){if(ids.has(e.id)){duplicateEvents++;continue;}ids.add(e.id);raw.push(e);}
 const continuation=readPossessionContinuations({...s,events:raw}),all=continuation.events;
 const byAction=new Map<string,CoreEvent[]>();for(const e of all)if(e.actionId){const a=byAction.get(e.actionId)??[];a.push(e);byAction.set(e.actionId,a);}
 const groups=new Map<string,{period:number;id:string;events:CoreEvent[]}>();let period=1;
 for(const e of all){const key=period+':'+e.possessionId,g=groups.get(key)??{period,id:e.possessionId,events:[]};g.events.push(e);groups.set(key,g);if(e.type==='PERIOD_ENDED'&&e.details.period===1)period=2;}
 const whistleIds=new Set<string>(),whistles:CoreEvent[]=[];let duplicateWhistles=0;
 for(const e of all.filter(e=>e.type==='WHISTLE_RESTART'&&e.details.kind==='FREE_THROW')){const id=String(e.details.foulId??e.id);if(whistleIds.has(id)){duplicateWhistles++;continue;}whistleIds.add(id);whistles.push(e);}
 const nextControl=new Map<string,CoreEvent>();let upcoming:CoreEvent|undefined;for(let i=all.length-1;i>=0;i--){if(upcoming)nextControl.set(all[i].id,upcoming);if(all[i].type==='BALL_CONTROLLED'||all[i].type==='REBOUND_CONTROLLED')upcoming=all[i];}
 const legacy=ledger({...s,events:raw} as CoreState),records:EconomyRecord[]=[];
 let fragments=0;
 for(const [key,g]of groups){if(!g.events.some(e=>touch.has(e.type))){fragments++;continue;}
  const book=ledger({...s,events:g.events} as CoreState),r=book.records[0];if(!r)continue;
  const actualEnding=terminalEnding(g.events,r.team,s);
  const first=g.events[0],last=g.events.at(-1)!,transfers=g.events.filter(e=>terminal.has(e.type)&&e.details.ended===true);
  const shots=g.events.filter(e=>e.type==='SHOT_RELEASED'&&own(s,e)===r.team),seven=shots.filter(e=>e.details.shotKind==='SEVEN_METRE');
  const free=whistles.filter(e=>g.events.includes(e)&&e.details.owner===r.team),loss=cause(actualEnding.ending,g.events,s,r.team);
  const ending=loss==='OFFENSIVE_FOUL'?'OFFENSIVE_FOUL':loss?'TURNOVER':actualEnding.ending==='GOAL'?'GOAL':actualEnding.ending==='PERIOD_END'?'HALF_END':shots.length&&actualEnding.ending!=='STILL_IN_PROGRESS'?'FIELD_SHOT_MISS_SAVE':actualEnding.ending==='STILL_IN_PROGRESS'?'UNRESOLVED':'OTHER';
  records.push({key,canonicalId:g.id,period:g.period,team:r.team,firstTick:first.tick,lastTick:last.tick,startMs:first.officialMs,endMs:last.officialMs,durationSeconds:Math.max(0,last.officialMs-first.officialMs)/1000,
   ending,ledgerEnding:r.ending,reconstructedTerminal:actualEnding.ending,evidence:actualEnding.evidence,loss,hasShot:shots.length>0,hasSevenMetre:seven.length>0,shots:shots.length,fieldShots:shots.filter(e=>e.details.shotKind!=='SEVEN_METRE'&&s.players.find(p=>p.id===e.actorId)?.kind!=='GOALKEEPER').length,sevenMetres:seven.length,
   passesReleased:g.events.filter(e=>e.type==='PASS_RELEASED'&&own(s,e)===r.team).length,passesReceived:g.events.filter(e=>e.type==='PASS_RECEIVED'&&own(s,e)===r.team).length,freeThrows:free.length,freeThrowsBeforeShot:free.filter(f=>shots.some(shot=>g.events.indexOf(shot)>g.events.indexOf(f))).length,freeThrowsBeforeLoss:loss?free.filter(f=>transfers.some(t=>g.events.indexOf(t)>g.events.indexOf(f))).length:0,freeThrowSegments:free.map(e=>segment(e.officialMs)),transferEvents:transfers.length,
   receptionFumbles:g.events.filter(e=>e.type==='RECEPTION_FAILED').length,retainedFumbles:g.events.filter(e=>e.type==='RECEPTION_FAILED').some(e=>{const next=nextControl.get(e.id);return next&&own(s,next)===r.team;}),retainedRebounds:g.events.filter(e=>e.type==='REBOUND_CONTROLLED'&&own(s,e)===r.team).length});
 }
 const passRows=all.filter(e=>e.type==='PASS_RELEASED').map(e=>{const following=(byAction.get(e.actionId??'')??[]).filter(x=>x.tick>=e.tick),team=own(s,e),received=following.some(x=>x.type==='PASS_RECEIVED'),intercepted=following.some(x=>x.type==='INTERCEPTION'),fumbled=following.some(x=>x.type==='RECEPTION_FAILED'),out=following.some(x=>x.type==='BALL_OUT'),recovered=nextControl.get(e.id),beforeOut=!!recovered&&(!out||recovered.tick<following.find(x=>x.type==='BALL_OUT')!.tick);return{id:e.id,actionId:e.actionId,team,received,intercepted,fumbled,out,ownRecovery:!received&&beforeOut&&own(s,recovered!)===team,opponentRecovery:!intercepted&&beforeOut&&own(s,recovered!)!==team,difficulty:Number(e.details.difficulty??0),error:Number(e.details.executionError??0),pressure:Number(e.details.pressure??0)};});
 const teams=Object.fromEntries((['HOME','AWAY']as const).map(team=>{const rows=records.filter(r=>r.team===team),losses=counts(lossKeys),endings:Record<string,number>={};for(const r of rows){if(r.loss)losses[r.loss]++;endings[r.ending]=(endings[r.ending]??0)+1;}
  const shots=all.filter(e=>e.type==='SHOT_RELEASED'&&own(s,e)===team),p=passRows.filter(p=>p.team===team),free=whistles.filter(e=>e.details.owner===team),broad=rows.filter(r=>r.loss).length;
  const goalActions=new Set(all.filter(e=>e.type==='GOAL'&&own(s,e)===team&&e.actionId!==null).map(e=>e.actionId)),rawGoals=all.filter(e=>e.type==='GOAL'&&own(s,e)===team).length;
  const fieldGoals=shots.filter(e=>goalActions.has(e.actionId)&&e.details.shotKind!=='SEVEN_METRE'&&s.players.find(p=>p.id===e.actorId)?.kind!=='GOALKEEPER').length,sevenMetreGoals=shots.filter(e=>goalActions.has(e.actionId)&&e.details.shotKind==='SEVEN_METRE').length,keeperGoals=shots.filter(e=>goalActions.has(e.actionId)&&e.details.shotKind!=='SEVEN_METRE'&&s.players.find(p=>p.id===e.actorId)?.kind==='GOALKEEPER').length;
  return[team,{possessions:rows.length,canonicalLedgerPossessions:legacy.records.filter(r=>r.team===team).length,goals:rawGoals,fieldGoals,sevenMetreGoals,keeperGoals,fieldAttempts:shots.filter(e=>e.details.shotKind!=='SEVEN_METRE'&&s.players.find(p=>p.id===e.actorId)?.kind!=='GOALKEEPER').length,sevenMetres:shots.filter(e=>e.details.shotKind==='SEVEN_METRE').length,totalAttempts:shots.length,freeThrows:free.length,allFreeThrowAwards:raw.filter(e=>e.type==='RESTART_AWARDED'&&e.details.kind==='FREE_THROW'&&e.details.owner===team).length,broadBallLosses:broad,canonicalUiBallLosses:legacy.records.filter(r=>r.team===team&&lossClassOf(r.ending)).length,nonShotLosses:rows.filter(r=>r.loss&&!r.hasShot).length,losses,endings,sevenMetrePossessions:rows.filter(r=>r.hasSevenMetre).length,
   technicalExecutionCandidate:losses.BAD_PASS_OUT+losses.DROPPED_RECEPTION,technicalRuleViolations:losses.TECHNICAL_RULE_VIOLATION,offensiveFouls:losses.OFFENSIVE_FOUL,
   freeThrowChains:{zero:rows.filter(r=>!r.freeThrows).length,one:rows.filter(r=>r.freeThrows===1).length,two:rows.filter(r=>r.freeThrows===2).length,threePlus:rows.filter(r=>r.freeThrows>=3).length},freeThrowsBySegment:[0,1,2,3].map(i=>free.filter(e=>segment(e.officialMs)===i).length),freeThrowsBeforeShot:rows.reduce((n,r)=>n+r.freeThrowsBeforeShot,0),freeThrowsBeforeLoss:rows.reduce((n,r)=>n+r.freeThrowsBeforeLoss,0),freeThrowsInShotBearingEpisodes:rows.filter(r=>r.hasShot).reduce((n,r)=>n+r.freeThrows,0),freeThrowsInLostEpisodes:rows.filter(r=>r.loss).reduce((n,r)=>n+r.freeThrows,0),
   passes:p.length,successfulPasses:p.filter(p=>p.received).length,interceptedPasses:p.filter(p=>p.intercepted).length,passesOut:p.filter(p=>p.out&&!p.received).length,fumbledPasses:p.filter(p=>p.fumbled).length,ownRecoveredFumbles:p.filter(p=>p.fumbled&&p.ownRecovery).length,unresolvedPasses:p.filter(p=>!p.received&&!p.intercepted&&!p.out&&!p.ownRecovery&&!p.opponentRecovery).length,
   passesBeforeShot:distribution(rows.filter(r=>r.hasShot).map(r=>r.passesReleased)),passesBeforeLoss:distribution(rows.filter(r=>r.loss).map(r=>r.passesReleased)),duration:distribution(rows.map(r=>r.durationSeconds)),durationByEnding:Object.fromEntries(['GOAL','FIELD_SHOT_MISS_SAVE','TURNOVER','OFFENSIVE_FOUL','HALF_END','OTHER','UNRESOLVED'].map(k=>[k,distribution(rows.filter(r=>r.ending===k).map(r=>r.durationSeconds))])),sevenMetreDuration:distribution(rows.filter(r=>r.hasSevenMetre).map(r=>r.durationSeconds)),
   rates:{fieldShotsPerPossession:ratio(shots.filter(e=>e.details.shotKind!=='SEVEN_METRE'&&s.players.find(p=>p.id===e.actorId)?.kind!=='GOALKEEPER').length,rows.length),totalShotsPerPossession:ratio(shots.length,rows.length),freeThrowsPerPossession:ratio(free.length,rows.length),passesPerPossession:ratio(p.length,rows.length),lossesPerPossession:ratio(broad,rows.length),lossSubtypesPerPossession:Object.fromEntries(Object.entries(losses).map(([k,v])=>[k,ratio(v,rows.length)]))}}];}));
 const assessedPossessions=new Map(raw.filter(e=>e.type==='FOUL_ASSESSED').map(e=>[String(e.details.foulId),e.possessionId]));
 const crossPossessionRecalls=raw.filter(e=>e.type==='ADVANTAGE_RECALLED'&&assessedPossessions.has(String(e.details.foulId))&&assessedPossessions.get(String(e.details.foulId))!==e.possessionId).map(e=>({eventId:e.id,foulId:e.details.foulId,assessedPossession:assessedPossessions.get(String(e.details.foulId)),recalledPossession:e.possessionId,tick:e.tick,reconciled:continuation.continuations.some(c=>c.foulId===e.details.foulId)}));
 return{schema:'possession-economy/1',complete:s.match?.phase==='FULLTIME',definitions:{possession:'Played attacking control episode, canonical possessionId partitioned at each actual PERIOD_ENDED. Same-team defensive free throws/restarts and retained rebounds remain inside one episode. Procedural no-touch fragments excluded and reported.',endings:'Exclusive terminal reason (goal, shot outcome, loss, half end or other). Shot-bearing and 7m are independent flags: never add those again to terminal count.',freeThrows:'Distinct WHISTLE_RESTART kind FREE_THROW/foulId, attacking owner. Excludes 7m, assessments, realized advantage, timeout/admin/technical FREE_THROW awards and horn retakes.',ballLoss:'One loss-class terminal per played episode. Bad throw/reception candidates are not assumed equivalent to official registered technical errors. An earlier shot does not erase a later genuine non-shot loss.',cause:'Last released pass action linked to its fumble/deflection and confirmed terminal. Unspecified loose-ball control remains unspecified; no inferred dribble error or offensive foul producer.',duration:'Elapsed official-clock seconds, including ordinary running-clock dead-ball restart preparation; excludes stopped-clock halftime/timeout. NO_REFERENCE.',technicalContext:'Read-only post-event tick state; throw difficulty/error recorded canonically; catch pressure measured from current geometry, catch risk exists only for failed catches. Context associations are not causal estimates.'},teams,records,passes:passRows,technicalContexts:actionBreakdown(technical),
  integrity:{crossPossessionRecalls,recalledContinuations:continuation.continuations,continuationAliases:continuation.aliases,voidedProvisionalPossessions:continuation.voidedProvisionalPossessions,voidedProvisionalEventIds:continuation.ignoredEventIds,freeThrowsAssignedToPlayedPossessions:records.reduce((n,r)=>n+r.freeThrows,0),freeThrowsUnassigned:whistles.length-records.reduce((n,r)=>n+r.freeThrows,0),terminalClassificationDisagreements:records.filter(r=>r.ledgerEnding!==r.reconstructedTerminal).map(r=>({key:r.key,ledger:r.ledgerEnding,reconstructed:r.reconstructedTerminal,evidence:r.evidence})),allGroupsWithMultipleTransfers:[...groups.entries()].filter(([,g])=>g.events.filter(e=>terminal.has(e.type)&&e.details.ended===true).length>1).map(([key])=>key),duplicateEventIds:duplicateEvents,duplicateWhistleFoulIds:duplicateWhistles,rawPossessionIds:new Set(raw.map(e=>e.possessionId)).size,periodPartitionedGroups:groups.size,proceduralFragments:fragments,playedPossessions:records.length,canonicalRawIdPlayedAttacks:legacy.attacks,periodSplitDifference:records.length-legacy.attacks,groupsWithMultipleTransfers:records.filter(r=>r.transferEvents>1).map(r=>r.key),unresolvedPossessions:records.filter(r=>r.ending==='UNRESOLVED').map(r=>r.key),lossSumMatches:records.filter(r=>r.loss).length===Object.values(teams).reduce((n,t)=>n+t.broadBallLosses,0)},
  unsupported:['OFFENSIVE_FOUL has no current canonical producer; zero is not proof of modeled offensive fouls.','No distinct dribble/control-error lottery; unspecified open-play recovery is not an attributed technical error.','Official HBL technical errors have no proven one-to-one mapping to these engine categories.','Pass success can involve multiple explanatory events; pass incident flags overlap, broad losses do not.']};
}
