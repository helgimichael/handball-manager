import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { getPlayer, record, type CorePlayer, type CoreState } from './state';
import { acquire, awardRestart, changePossession } from './transitions';
import { completeRestart } from './restarts';
import { ledger, lossClassOf, readPossessionContinuations } from './ledger';
import { startAction } from './actions';
import { judgeFoul, refereeAfter } from './referee';

function fixture() {
  const s=createCoreScenario();s.events=[];s.checkpoint.stopOnOutcome=false;
  record(s,'BALL_CONTROLLED',getPlayer(s,'H03'),{reason:'Pass received'});
  return s;
}
function later(s:CoreState){s.tick++;s.timeMs=s.tick*50;s.officialClock.timeMs+=50;}
function take(s:CoreState,p:CorePlayer,reason:string,actionId:string|null=null){
  s.ball={...s.ball,live:true,mode:'LOOSE',controllerId:null,flight:null,position:{...p.position}};
  acquire(s,p,p.position,reason,actionId);
}
function outgoing(s:CoreState,id='possession-0'){return ledger(s).records.find(r=>r.possessionId===id)!;}
function broad(s:CoreState){return ledger(s).records.filter(r=>lossClassOf(r.ending)).length;}
function intercept(s:CoreState){
  const passer=getPlayer(s,'H03'),winner=getPlayer(s,'A03');
  record(s,'PASS_RELEASED',passer,{},[winner.id],null,'pass-1');
  later(s);take(s,winner,'Intercepted','pass-1');
  // advanceBall records this after acquire opened the winner's new ID.
  record(s,'INTERCEPTION',winner,{},[passer.id],null,'pass-1');
  return winner;
}
function shot(s:CoreState,kind:'SAVE_PARRY'|'SHOT_BLOCKED'|'OFF_TARGET_KEEPER_TOUCH'='SAVE_PARRY'){
  record(s,'SHOT_RELEASED',getPlayer(s,'H03'),{shotKind:'BACKCOURT_JUMP'},[],null,'shot-1');
  later(s);record(s,kind,getPlayer(s,kind==='SHOT_BLOCKED'?'A03':'A07'),{},['H03'],null,'shot-1');
}
function retain(s:CoreState){
  later(s);const p=getPlayer(s,'H03');take(s,p,'Loose-ball recovery','shot-1');
  record(s,'REBOUND_CONTROLLED',p,{},[],null,'shot-1');
}

test('actual interception transfer ends the losing ID and the event belongs to the winner',()=>{
  const s=fixture(),winner=intercept(s),change=s.events.find(e=>e.type==='POSSESSION_CHANGED')!,fact=s.events.find(e=>e.type==='INTERCEPTION')!;
  assert.equal(change.possessionId,'possession-0');assert.equal(change.details.previous,change.possessionId);
  assert.equal(fact.possessionId,s.possession.id);assert.notEqual(fact.possessionId,change.possessionId);
  assert.equal(change.tick,fact.tick,'same-tick ordering must use actual event placement');
  assert.equal(outgoing(s).ending,'INTERCEPTION');
  const gained=outgoing(s,s.possession.id);assert.equal(gained.team,winner.team);assert.equal(gained.ending,'STILL_IN_PROGRESS');
  assert.equal(broad(s),1);assert.equal(ledger(s).nonShotLoss,1);
});
test('direct changePossession remains the outgoing interception authority',()=>{
  const s=fixture();changePossession(s,getPlayer(s,'A03'),'Intercepted');
  assert.equal(outgoing(s).ending,'INTERCEPTION');assert.equal(broad(s),1);
});
test('the team winning an interception can later lose by a distinct technical rule',()=>{
  const s=fixture(),winner=intercept(s),wonId=s.possession.id;
  later(s);awardRestart(s,'FREE_THROW','HOME',winner.position,'More than three steps',winner,false);
  assert.equal(outgoing(s).ending,'INTERCEPTION');assert.equal(outgoing(s,wonId).ending,'TECHNICAL_VIOLATION');
  assert.equal(outgoing(s,wonId).evidence,'More than three steps');assert.equal(broad(s),2);
});
test('restart award reason does not stamp the benefiting new attack with its opponents violation',()=>{
  const s=fixture(),carrier=getPlayer(s,'H03');
  awardRestart(s,'FREE_THROW','AWAY',carrier.position,'Held longer than three seconds',carrier,false);
  const gainedId=s.possession.id,p=getPlayer(s,'A03');
  // Canonical dead-ball retrieval gives this new attacking ID its first touch.
  acquire(s,p,p.position,'Dead-ball retrieval');
  assert.equal(outgoing(s).ending,'TECHNICAL_VIOLATION');assert.equal(outgoing(s,gainedId).ending,'STILL_IN_PROGRESS');
  assert.equal(broad(s),1);
});

for(const kind of ['SAVE_PARRY','SHOT_BLOCKED'] as const){
  test(`${kind}: opponent's direct rebound recovery remains a shot outcome`,()=>{
    const s=fixture();shot(s,kind);later(s);take(s,getPlayer(s,'A03'),'Loose-ball recovery');
    assert.equal(outgoing(s).ending,kind==='SAVE_PARRY'?'SHOT_SAVED_REBOUND_LOST':'SHOT_BLOCKED_REBOUND_LOST');
    assert.equal(broad(s),0);
  });
  test(`${kind}: own physical recovery preserves the shot-bearing attack`,()=>{
    const s=fixture();shot(s,kind);retain(s);
    assert.equal(s.possession.id,'possession-0');assert.equal(outgoing(s).shots,1);
    assert.equal(outgoing(s).ending,kind==='SAVE_PARRY'?'SHOT_SAVED_REBOUND_KEPT':'SHOT_BLOCKED_REBOUND_KEPT');
    assert.equal(broad(s),0);
  });
  test(`${kind}: a subsequent deflected pass lost to opponent is a later loss`,()=>{
    const s=fixture();shot(s,kind);retain(s);later(s);
    record(s,'PASS_RELEASED',getPlayer(s,'H03'),{},['H04'],null,'pass-2');
    record(s,'PASS_DEFLECTED',getPlayer(s,'A03'),{},['H03'],null,'pass-2');
    later(s);take(s,getPlayer(s,'A03'),'Loose-ball recovery');
    assert.equal(outgoing(s).ending,'DUEL_LOSS');assert.equal(outgoing(s).shots,1);assert.equal(broad(s),1);
    assert.equal(ledger(s).nonShotLoss,0,'shot-bearing later loss is not a no-shot loss');
  });
  test(`${kind}: a supported technical transfer overrides the retained shot`,()=>{
    const s=fixture();shot(s,kind);retain(s);later(s);
    awardRestart(s,'FREE_THROW','AWAY',getPlayer(s,'H03').position,'Landed holding the ball after jump',getPlayer(s,'H03'),false);
    assert.equal(outgoing(s).ending,'TECHNICAL_VIOLATION');assert.equal(outgoing(s).shots,1);assert.equal(broad(s),1);
  });
}

test('a new pass going out after retained parry is a bad pass, not the old saved shot',()=>{
  const s=fixture();shot(s);retain(s);later(s);
  record(s,'PASS_RELEASED',getPlayer(s,'H03'),{},['H04'],null,'pass-2');
  record(s,'BALL_OUT',getPlayer(s,'H03'),{x:0,y:15},[],null,'pass-2');
  awardRestart(s,'THROW_IN','AWAY',{x:0,y:15},'Ball crossed court boundary',getPlayer(s,'H03'),false);
  assert.equal(outgoing(s).ending,'BAD_PASS_OUT');assert.equal(broad(s),1);
});
test('a retained off-target touch does not turn a subsequent pass out into a wide shot',()=>{
  const s=fixture();shot(s,'OFF_TARGET_KEEPER_TOUCH');retain(s);later(s);
  record(s,'PASS_RELEASED',getPlayer(s,'H03'),{},['H04'],null,'pass-2');
  record(s,'BALL_OUT',getPlayer(s,'H03'),{x:0,y:15},[],null,'pass-2');
  awardRestart(s,'THROW_IN','AWAY',{x:0,y:15},'Ball crossed court boundary',getPlayer(s,'H03'),false);
  assert.equal(outgoing(s).ending,'BAD_PASS_OUT');assert.equal(broad(s),1);
});
test('confirmed own control clears rebound context before any later loose-control transfer',()=>{
  const s=fixture();shot(s);retain(s);later(s);
  take(s,getPlayer(s,'A03'),'Loose-ball recovery');
  assert.equal(outgoing(s).ending,'DUEL_LOSS');assert.equal(broad(s),1);
});
test('a direct held save remains a saved shot, never a broad ball loss',()=>{
  const s=fixture(),keeper=getPlayer(s,'A07');
  record(s,'SHOT_RELEASED',getPlayer(s,'H03'),{shotKind:'STANDING'},[],null,'shot-1');
  later(s);record(s,'SAVE_CAUGHT',keeper,{},['H03'],null,'shot-1');
  take(s,keeper,'Goalkeeper catch','shot-1');s.ball.live=false;
  awardRestart(s,'GOALKEEPER_THROW','AWAY',keeper.position,'Keeper controls ball inside goal area',keeper,false);
  assert.equal(outgoing(s).ending,'SHOT_SAVED_REBOUND_LOST');assert.equal(broad(s),0);
});
test('off-target attempt recovered by the defending keeper stays a miss',()=>{
  const s=fixture();shot(s,'OFF_TARGET_KEEPER_TOUCH');later(s);
  take(s,getPlayer(s,'A07'),'Goalkeeper rebound control');
  assert.equal(outgoing(s).ending,'SHOT_WIDE');assert.equal(broad(s),0);
});
test('blocked shot collected by the goalkeeper stays a blocked-shot ending without a turnover',()=>{
  const s=fixture(),keeper=getPlayer(s,'A07');shot(s,'SHOT_BLOCKED');later(s);
  take(s,keeper,'Goalkeeper rebound control');
  awardRestart(s,'GOALKEEPER_THROW',keeper.team,keeper.position,'Keeper recovered rebound',keeper,false);
  assert.equal(outgoing(s).ending,'SHOT_BLOCKED_REBOUND_LOST');assert.equal(outgoing(s).shots,1);
  assert.equal(broad(s),0);assert.equal(ledger(s).nonShotLoss,0);
});
for(const reason of ['Goalkeeper catch','Goalkeeper rebound control'])test(`${reason} of a pass remains a genuine pass/control loss`,()=>{
  const s=fixture(),keeper=getPlayer(s,'A07');
  record(s,'PASS_RELEASED',getPlayer(s,'H03'),{},['H04'],null,'pass-1');later(s);
  take(s,keeper,reason,'pass-1');
  awardRestart(s,'GOALKEEPER_THROW',keeper.team,keeper.position,'Keeper recovered rebound',keeper,false);
  assert.equal(outgoing(s).ending,'RECEPTION_FAILED');assert.equal(outgoing(s).shots,0);
  assert.equal(broad(s),1);assert.equal(ledger(s).nonShotLoss,1);
});
test('passive-play terminal ownership reason overrides a previously retained shot',()=>{
  const s=fixture();shot(s);retain(s);later(s);
  awardRestart(s,'FREE_THROW','AWAY',getPlayer(s,'H03').position,'Passive play after pass allowance',null,false);
  assert.equal(outgoing(s).ending,'PASSIVE_PLAY');assert.equal(broad(s),1);
});
test('ordinary defensive free throw and completion retain the same attack',()=>{
  const s=fixture();record(s,'WHISTLE_RESTART',getPlayer(s,'A03'),{kind:'FREE_THROW',owner:'HOME',foulId:'foul-1'});
  awardRestart(s,'FREE_THROW','HOME',getPlayer(s,'H03').position,'Defensive contact',getPlayer(s,'A03'),false);
  completeRestart(s,'BALL_RELEASE');
  assert.equal(s.possession.id,'possession-0');assert.equal(outgoing(s).ending,'STILL_IN_PROGRESS');assert.equal(broad(s),0);
});
test('ledger reading preserves canonical state, events, IDs, score and RNG exactly',()=>{
  const s=fixture();shot(s);retain(s);later(s);awardRestart(s,'FREE_THROW','AWAY',getPlayer(s,'H03').position,'More than three steps',null,false);
  const before=JSON.stringify(s);ledger(s);ledger(s);
  assert.equal(JSON.stringify(s),before);
});
function recalledRestart(opponentTouch=false,elapsed=false){
  const s=fixture(),attacker=getPlayer(s,'H03'),defender=getPlayer(s,'A03');
  startAction(s,attacker,'DRIVE','Committed action for the pending advantage');attacker.action!.phase='EXECUTING';
  judgeFoul(s,attacker,defender,'ORDINARY','Contact from behind the attacker',false,'test-contact');
  assert.ok(s.referee.advantage);later(s);
  awardRestart(s,'FREE_THROW','AWAY',attacker.position,'Held longer than three seconds',attacker,false);
  const provisional=s.possession.id;
  if(opponentTouch)acquire(s,defender,defender.position,'Dead-ball retrieval');
  if(elapsed)later(s);
  refereeAfter(s);const restored=s.possession.id;
  acquire(s,attacker,attacker.position,'Dead-ball retrieval');completeRestart(s,'BALL_RELEASE');
  record(s,'SHOT_RELEASED',attacker,{shotKind:'STANDING'},[],null,'final-shot');record(s,'GOAL',attacker,{},[],null,'final-shot');
  return{s,provisional,restored};
}
test('same-tick no-touch recalled advantage restores one protected attack without a technical loss',()=>{
  const{s,provisional,restored}=recalledRestart(),before=JSON.stringify(s),read=readPossessionContinuations(s),book=ledger(s);
  assert.equal(read.continuations.length,1);assert.equal(read.aliases[restored],'possession-0');
  assert.deepEqual(read.voidedProvisionalPossessions,[provisional]);assert.equal(read.ignoredEventIds.length,3);
  assert.equal(book.attacks,1);assert.equal(book.records[0].team,'HOME');assert.equal(book.records[0].ending,'GOAL');
  assert.equal(broad(s),0);assert.equal(JSON.stringify(s),before,'the canonical reversal events and RNG remain unchanged');
  assert.equal(read.events.find(e=>e.type==='WHISTLE_RESTART')!.possessionId,'possession-0');
});
test('recalled reversal with opponent control is not silently merged',()=>{
  const{s}=recalledRestart(true);assert.equal(readPossessionContinuations(s).continuations.length,0);
});
test('recalled reversal with elapsed time is outside the narrow same-tick reconciliation',()=>{
  const{s}=recalledRestart(false,true);assert.equal(readPossessionContinuations(s).continuations.length,0);
});
test('unlinked recall identity cannot merge unrelated possession IDs',()=>{
  const{s}=recalledRestart();s.events.find(e=>e.type==='ADVANTAGE_RECALLED')!.details.foulId='unrelated-foul';
  assert.equal(readPossessionContinuations(s).continuations.length,0);
});
