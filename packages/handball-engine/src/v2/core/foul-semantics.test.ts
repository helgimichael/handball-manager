import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { createContactScenario } from './contactScenarios';
import { getPlayer, record, type CoreState } from './state';
import { startAction } from './actions';
import { judgeFoul, recallAdvantage, refereeAfter } from './referee';
import { resolveContacts } from './contact';
import { advanceCoreMutable } from './engine';
import { ledger } from './ledger';

function controlledShot():CoreState{
  const s=createCoreScenario();s.checkpoint.stopOnOutcome=false;
  startAction(s,getPlayer(s,'H03'),'SHOOT','Visible controlled opportunity',null,null,'STANDING');getPlayer(s,'H03').action!.phase='EXECUTING';
  return s;
}
test('a physical legal contact is not a foul assessment or whistle',()=>{
  const s=createContactScenario('FRONTAL_CONTACT');getPlayer(s,'A03').action!.phase='EXECUTING';
  resolveContacts(s);
  const contact=s.events.find(e=>e.type==='CONTACT_EXECUTED')!;
  assert.ok(contact);assert.equal(contact.details.physicalContactId,contact.contestId);
  assert.equal(s.events.filter(e=>['FOUL','FOUL_ASSESSED','WHISTLE_RESTART'].includes(e.type)).length,0);
  assert.equal(s.ball.live,true);
});
test('an assessed ordinary foul has one explicit actual whistle linked to its physical evidence',()=>{
  const s=createCoreScenario();s.checkpoint.stopOnOutcome=false;
  judgeFoul(s,getPlayer(s,'H03'),getPlayer(s,'A03'),'ORDINARY','Actual hold',false,'contact-evidence');
  const assessed=s.events.find(e=>e.type==='FOUL_ASSESSED')!,legacy=s.events.find(e=>e.type==='FOUL')!,whistles=s.events.filter(e=>e.type==='WHISTLE_RESTART');
  assert.equal(assessed.details.decision,'WHISTLE_NOW');assert.equal(assessed.details.physicalContactId,'contact-evidence');
  assert.equal(legacy.details.advantage,false);assert.equal(whistles.length,1);assert.equal(whistles[0].details.foulId,assessed.details.foulId);
  assert.equal(whistles[0].contestId,'contact-evidence');assert.equal(s.restart?.kind,'FREE_THROW');assert.equal(s.restart.owner,'HOME');
  assert.equal(getPlayer(s,'A03').warnings,0,'ordinary contact is not a personal punishment');
});
test('realized advantage records an infringement and continuation without an actual whistle',()=>{
  const s=controlledShot();judgeFoul(s,getPlayer(s,'H03'),getPlayer(s,'A03'),'ORDINARY','Hold during controlled release',false,'held-release');
  assert.equal(s.events.find(e=>e.type==='FOUL')?.details.advantage,true);assert.equal(s.events.find(e=>e.type==='FOUL_ASSESSED')?.details.decision,'ADVANTAGE_PENDING');
  while(!s.events.some(e=>e.type==='SHOT_RELEASED')&&s.tick<20)advanceCoreMutable(s);
  assert.ok(s.events.some(e=>e.type==='ADVANTAGE_REALIZED'));assert.equal(s.events.filter(e=>e.type==='WHISTLE_RESTART').length,0);
});
test('a recalled clear chance records exactly one causal7m whistle',()=>{
  const s=controlledShot();judgeFoul(s,getPlayer(s,'H03'),getPlayer(s,'A03'),'CLEAR_CHANCE','Destroyed clear chance',true,'clear-contact');
  const id=s.referee.advantage!.id;s.ball.controllerId=null;s.ball.mode='LOOSE';refereeAfter(s);recallAdvantage(s,'Repeated caller');
  const whistles=s.events.filter(e=>e.type==='WHISTLE_RESTART');assert.equal(whistles.length,1);assert.equal(whistles[0].details.foulId,id);
  assert.equal(whistles[0].details.kind,'SEVEN_METRE');assert.equal(s.restart?.kind,'SEVEN_METRE');assert.equal(getPlayer(s,'A03').warnings,1);
});
test('a further infringement which recalls protected play does not claim a new pending advantage',()=>{
  const s=controlledShot(),a=getPlayer(s,'H03');
  judgeFoul(s,a,getPlayer(s,'A03'),'CLEAR_CHANCE','Original clear chance',true,'first');const original=s.referee.advantage!.id;
  judgeFoul(s,a,getPlayer(s,'A04'),'PUNISHABLE','Further infringement',false,'second');
  const fouls=s.events.filter(e=>e.type==='FOUL'),assessed=s.events.filter(e=>e.type==='FOUL_ASSESSED');
  assert.equal(fouls[1].details.advantage,false);assert.equal(assessed[1].details.decision,'RECALL_PENDING_ADVANTAGE');
  assert.equal(s.events.filter(e=>e.type==='WHISTLE_RESTART').length,1);assert.equal(s.events.find(e=>e.type==='WHISTLE_RESTART')?.details.foulId,original);
  assert.equal(s.restart?.kind,'SEVEN_METRE','the original clear chance is not downgraded');
});
test('ledger does not turn an advantage contact into a stopped possession',()=>{
  const s=createCoreScenario();record(s,'BALL_CONTROLLED',getPlayer(s,'H03'));record(s,'FOUL',getPlayer(s,'A03'),{advantage:true,severity:'ORDINARY',foulId:'legacy-foul'});
  assert.equal(ledger(s).records[0].ending,'STILL_IN_PROGRESS');
  record(s,'ADVANTAGE_REALIZED',getPlayer(s,'H03'),{foulId:'legacy-foul'});assert.equal(ledger(s).records[0].ending,'STILL_IN_PROGRESS');
});
test('ledger reads real new and legacy whistles and then resumes the same attack',()=>{
  for(const explicit of [false,true]){
    const s=createCoreScenario();record(s,'BALL_CONTROLLED',getPlayer(s,'H03'));
    record(s,'FOUL',getPlayer(s,'A03'),{advantage:false,severity:'ORDINARY',foulId:'foul-1'});
    if(explicit)record(s,'WHISTLE_RESTART',getPlayer(s,'A03'),{foulId:'foul-1',kind:'FREE_THROW',owner:'HOME'});
    record(s,'RESTART_AWARDED',getPlayer(s,'A03'),{kind:'FREE_THROW',owner:'HOME',reason:'Actual defensive hold'});
    assert.equal(ledger(s).records[0].ending,'DEFENSIVE_FOUL_RESTART');
    record(s,'RESTART_COMPLETED',getPlayer(s,'H03'),{kind:'FREE_THROW'});
    assert.equal(ledger(s).records[0].ending,'STILL_IN_PROGRESS');assert.equal(ledger(s).attacks,1,'a defensive restart remains the same possession');
  }
});
