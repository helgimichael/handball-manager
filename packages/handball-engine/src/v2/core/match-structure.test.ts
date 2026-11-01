import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, matchBefore } from './match';
import { createContinuous } from './continuous';
import { courtPlayers, getPlayer } from './state';
import { judgeFoul, requestTeamTimeout } from './referee';
import { courtLimit, populationBefore, requestExchange } from './population';
import { advanceCoreMutable, assertCore } from './engine';
import { saveCore, loadCore, coreHash } from './replay';
import { manpowerScenario, coordinatedEnvironment } from './matchStructureScenarios';
import { coordinate } from './structure';
import { execute, startAction } from './actions';
import { readContact } from './sanction';
import { createContactScenario } from './contactScenarios';
import { resolveContacts } from './contact';
import { interrupt } from './transitions';
import { refereeAfter } from './referee';

test('a canonical sanction removes the actual body, actions, targets and defensive ownership', () => {
  const s = createContinuous(), d = getPlayer(s, 'A03');
  judgeFoul(s, getPlayer(s, 'H03'), d, 'SERIOUS', 'Staged serious infringement', false, 'actual-sanction');
  assert.equal(d.population, 'SUSPENDED'); assert.equal(d.suspensionUntilMs, 120000);
  assert.equal(courtLimit(s, 'AWAY'), 6); assert.equal(courtPlayers(s, 'AWAY').filter(p => p.kind === 'FIELD_PLAYER').length, 5);
  coordinate(s); assert.ok(!Object.keys(s.defence.marks).includes(d.id));
  const position = structuredClone(d.position); execute(s); assert.deepEqual(d.position, position);
  assert.equal(requestExchange(s, 'AWAY', null, 'A09'), false, 'A bench player cannot fill the suspended slot');
  assert.equal(requestExchange(s, 'AWAY', 'A02', d.id), false, 'A suspended player cannot enter as a replacement');
});

test('overlapping sanctions reduce the limit independently and restore eligibility at each official expiry', () => {
  const s = createContinuous(), a = getPlayer(s, 'H03'), first = getPlayer(s, 'A02'), second = getPlayer(s, 'A04');
  judgeFoul(s, a, first, 'SERIOUS', 'First', false, 'one'); s.officialClock.timeMs = 500;
  judgeFoul(s, a, second, 'SERIOUS', 'Second', false, 'two'); assert.equal(courtLimit(s, 'AWAY'), 5);
  s.officialClock.timeMs = 119950; populationBefore(s); assert.equal(first.population, 'SUSPENDED');
  s.officialClock.timeMs = 120000; populationBefore(s); assert.equal(first.population, 'COURT');
  assert.ok(first.position.x < 0, 'Admission is at the physical gate, not the vacated space');
  assert.equal(second.population, 'SUSPENDED'); assert.equal(courtLimit(s, 'AWAY'), 6);
  s.officialClock.timeMs = 120500; populationBefore(s); assert.equal(second.population, 'BENCH', 'One exchange finishes before another begins');
  assert.equal(courtLimit(s, 'AWAY'), 7);
});

test('a queued outgoing exchange cannot replace a player who is then suspended', () => {
  const s = createContinuous(); assert.ok(requestExchange(s, 'AWAY', 'A02', 'A09'));
  judgeFoul(s, getPlayer(s, 'H03'), getPlayer(s, 'A02'), 'SERIOUS', 'Sanction while queued', false, 'queued'); populationBefore(s);
  assert.equal(s.exchanges[0].phase, 'CANCELLED'); assert.equal(courtPlayers(s, 'AWAY').length, 6);
  assert.equal(getPlayer(s, 'A09').population, 'BENCH');
});

test('a third suspension expires as a team reduction but never returns the disqualified player', () => {
  const s = createContinuous(), d = getPlayer(s, 'A02'); d.sanctions = 2;
  judgeFoul(s, getPlayer(s, 'H03'), d, 'SERIOUS', 'Third', false, 'third'); assert.equal(d.population, 'DISQUALIFIED');
  s.officialClock.timeMs = 120000; populationBefore(s);
  assert.equal(courtLimit(s, 'AWAY'), 7); assert.equal(d.population, 'DISQUALIFIED');
  assert.ok(s.exchanges.some(e => e.outId === null && e.inId !== d.id));
});

for (const [home, away] of [[0,0],[1,0],[0,1],[1,1],[2,0],[0,2],[1,2],[2,1]] as const) {
  test(`actual geometry/perception sees ${6-home}v${6-away} in both directions`, () => {
    for (const direction of ['TOP', 'BOTTOM'] as const) {
      const s = manpowerScenario(371, home, away, direction), env = coordinatedEnvironment(s)!;
      assert.equal(env.attackers, 6-home); assert.equal(env.defenders, 6-away); assert.equal(env.receiverIds.length, 5-home);
      assert.equal(env.assignments.length, 6-away);
      assert.ok(env.receiverIds.every(id => getPlayer(s,id).population === 'COURT'));
      assert.ok(env.assignments.every(d => d.targetId === null || getPlayer(s,d.targetId).population === 'COURT'));
      assert.equal(requestExchange(s,'HOME',null,'H08'), false); assertCore(s);
    }
  });
}

test('a goalkeeper cannot be added while another keeper remains, including a field-player exchange', () => {
  const s = createMatch();
  assert.equal(requestExchange(s, 'HOME', 'H01', 'H10'), false);
  assert.equal(requestExchange(s, 'HOME', 'H07', 'H10'), true, 'A real goalkeeper swap remains legal');
});

test('an old queued second-keeper request is cancelled before anyone leaves or enters',()=>{
  const s=createMatch();s.exchanges.push({id:'legacy-invalid',team:'HOME',outId:'H01',inId:'H10',phase:'WAIT_EXIT',gate:{x:-.35,y:24},requestedTick:0});
  populationBefore(s);assert.equal(s.exchanges[0].phase,'CANCELLED');assert.equal(getPlayer(s,'H01').population,'COURT');assert.equal(getPlayer(s,'H10').population,'BENCH');assertCore(s);
});

test('a suspended goalkeeper can be replaced only by removing a field player, without restoring the missing body',()=>{
  const s=createMatch();s.match=null;s.restart=null;s.ball.live=true;s.officialClock.running=true;
  judgeFoul(s,getPlayer(s,'A03'),getPlayer(s,'H07'),'SERIOUS','Keeper sanction',false,'keeper-sanction');
  assert.equal(courtLimit(s,'HOME'),6);assert.equal(requestExchange(s,'HOME',null,'H10'),false);
  getPlayer(s,'H01').position={x:.35,y:24};assert.ok(requestExchange(s,'HOME','H01','H10'));
  for(let i=0;i<200&&!s.exchanges.some(e=>e.phase==='COMPLETED');i++){advanceCoreMutable(s);assert.ok(courtPlayers(s,'HOME').length<=6);}
  assert.equal(getPlayer(s,'H10').population,'COURT');assert.equal(courtPlayers(s,'HOME').filter(p=>p.kind==='FIELD_PLAYER').length,5);
  s.officialClock.timeMs=120000;populationBefore(s);
  assert.equal(getPlayer(s,'H07').population,'BENCH');assert.equal(courtPlayers(s,'HOME').filter(p=>p.kind==='GOALKEEPER').length,1);
});

test('goalkeeper removal for an extra field player respects the reduced total court limit', () => {
  const s = manpowerScenario(381,1,0); assert.ok(requestExchange(s,'HOME','H07','H08'));
  for(let i=0;i<1500 && !s.exchanges.some(e=>e.phase==='COMPLETED');i++) { advanceCoreMutable(s); assertCore(s); }
  assert.ok(s.exchanges.some(e=>e.phase==='COMPLETED'));
  assert.ok(courtPlayers(s,'HOME').length<=6); assert.equal(getPlayer(s,'H01').population,'SUSPENDED');
  assert.ok(courtPlayers(s,'HOME').filter(p=>p.kind==='FIELD_PLAYER').length<=6);
});

test('timeout and halftime consume simulation time without spending suspension official time', () => {
  const s = createMatch(355,'TOP',1000,1000); s.match!.phase='FIRST_HALF'; s.officialClock.running=true;
  judgeFoul(s,getPlayer(s,'H03'),getPlayer(s,'A02'),'SERIOUS','Window',false,'timeout');
  const deadline=getPlayer(s,'A02').suspensionUntilMs;
  for(let i=0;i<20;i++)advanceCoreMutable(s);
  assert.equal(s.officialClock.timeMs,0); assert.equal(getPlayer(s,'A02').suspensionUntilMs,deadline);
  s.referee.timeout=null; s.referee.resumeOnWhistle=false; s.officialClock.running=true;
  s.match!.phase='HALFTIME'; s.match!.resumeTick=s.tick+10; const ms=s.officialClock.timeMs; s.officialClock.running=false;
  for(let i=0;i<9;i++) { s.tick++; s.timeMs=s.tick*50; assert.equal(matchBefore(s),true); }
  assert.equal(s.officialClock.timeMs,ms); assert.equal(getPlayer(s,'A02').population,'SUSPENDED');
  s.match!.phase='FIRST_HALF'; s.possession.team='HOME'; s.referee.timeout=null;
  assert.ok(requestTeamTimeout(s,'HOME')); for(let i=0;i<20;i++)advanceCoreMutable(s);
  assert.equal(s.officialClock.timeMs,ms); assert.equal(getPlayer(s,'A02').suspensionUntilMs,deadline);
});

test('overlapping manpower and restart continuation preserve complete JSON state and RNG', () => {
  let s=manpowerScenario(519,1,2); coordinate(s); const saved=saveCore(s); let resumed=loadCore(saved);
  for(let i=0;i<160;i++){s=structuredClone(s);resumed=structuredClone(resumed);advanceCoreMutable(s);advanceCoreMutable(resumed);}
  assert.equal(coreHash(s),coreHash(resumed)); assertCore(s);
});

test('ordinary fouls stay unpunished even after player/team warnings are spent', () => {
  const s=createContinuous(),d=getPlayer(s,'A03');d.warnings=1;d.sanctions=2;
  for(let i=0;i<10;i++)judgeFoul(s,getPlayer(s,'H03'),d,'ORDINARY','Ordinary contact',false,`ordinary-${i}`);
  assert.equal(d.sanctions,2);assert.equal(d.population,'COURT');assert.equal(s.events.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length,0);
});

test('seven metres and personal discipline are independent decisions, with exactly one sanction per contact', () => {
  for(const [severity,clear,warned,suspends] of [['ORDINARY',false,false,false],['PUNISHABLE',false,true,true],['CLEAR_CHANCE',true,false,false],['CLEAR_CHANCE',true,true,true],['SERIOUS',false,false,true],['SERIOUS',true,false,true]] as const){
    const s=createContinuous(),d=getPlayer(s,'A03');d.warnings=warned?1:0;
    judgeFoul(s,getPlayer(s,'H03'),d,severity,'Explicit supported category',clear,'ladder');
    assert.equal(s.restart?.kind,clear?'SEVEN_METRE':'FREE_THROW');
    assert.equal(s.events.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length,suspends?1:0);
  }
});

test('actual frontal contact resolves only once; an evaded contact cannot become a sanction', () => {
  const s=createContactScenario('FRONTAL_CONTACT');getPlayer(s,'A03').action!.phase='EXECUTING';
  resolveContacts(s);resolveContacts(s);assert.equal(s.events.filter(e=>e.type==='CONTACT_EXECUTED').length,1);assert.equal(s.events.filter(e=>e.type==='LEGAL_CONTACT').length,1);
  assert.equal(s.events.filter(e=>e.type==='FOUL').length,0);
  const escaped=createContactScenario('EVADED_CONTACT');getPlayer(escaped,'H03').position.x-=3;getPlayer(escaped,'A03').action!.phase='EXECUTING';resolveContacts(escaped);
  assert.equal(escaped.events.filter(e=>e.type==='CONTACT_MISSED').length,1);assert.equal(escaped.events.filter(e=>e.type==='FOUL').length,0);
});

test('an old beaten stamp cannot turn a new set frontal contact into a personal sanction',()=>{
  const s=createContactScenario('FRONTAL_CONTACT'),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');d.beatenUntilTick=100;d.beatenBy=a.id;
  const read=readContact(s,a,d,'BENT_ARMS','FRONT',.8);assert.equal(read.severity,'LEGAL');assert.equal(read.clearChance,false);
});

test('an actual takeoff cannot reclassify existing stationary frontal containment as a personal foul',()=>{
  for(const direction of ['TOP','BOTTOM']as const)for(const warned of [false,true]){
    const s=createContactScenario('FRONTAL_CONTACT',2025,direction),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');s.checkpoint.stopOnOutcome=false;d.warnings=warned?1:0;
    interrupt(s,a,'Controlled actual jump');assert.ok(startAction(s,a,'JUMP','Take off in front of the already set defender'));
    for(let i=0;i<4;i++)advanceCoreMutable(s);
    assert.ok(s.events.some(e=>e.type==='TAKEOFF'));const contact=s.events.find(e=>e.type==='CONTACT_EXECUTED')!;
    assert.equal(contact.details.establishedFrontal,true);assert.equal(contact.details.severity,'LEGAL');
    assert.equal(s.events.filter(e=>['FOUL_ASSESSED','WARNING','TWO_MINUTE_SUSPENSION'].includes(e.type)).length,0);
  }
});

test('airborne intervention protection still applies to moving, holding and rear contact',()=>{
  const s=createContactScenario('FRONTAL_CONTACT'),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');a.airborne={takeoff:{...a.position},untilTick:24};
  d.velocity={x:0,y:.1};assert.equal(readContact(s,a,d,'BENT_ARMS','FRONT',.8).severity,'PUNISHABLE');
  d.velocity={x:0,y:0};assert.equal(readContact(s,a,d,'HOLD','FRONT',.8).severity,'SERIOUS');
  d.velocity={x:0,y:3};assert.equal(readContact(s,a,d,'BENT_ARMS','BEHIND',.8).severity,'SERIOUS');
});

test('one player receives the strongest unannounced discipline once at the protected stoppage',()=>{
  for(const warned of [false,true])for(const serious of [false,true]){
    const s=createContinuous(),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');d.warnings=warned?1:0;
    startAction(s,a,'SHOOT','Controlled protected opportunity',null,null,'STANDING');a.action!.phase='EXECUTING';
    judgeFoul(s,a,d,'CLEAR_CHANCE','Original infringement',true,'first');const original=s.referee.advantage!.id;
    judgeFoul(s,a,d,serious?'SERIOUS':'PUNISHABLE','Direct-sequence infringement',false,'second');refereeAfter(s);
    const sanctions=s.events.filter(e=>['WARNING','TWO_MINUTE_SUSPENSION','DISQUALIFICATION'].includes(e.type));
    assert.equal(sanctions.length,1);assert.equal(sanctions[0].type,warned||serious?'TWO_MINUTE_SUSPENSION':'WARNING');
    assert.equal(sanctions[0].details.disciplineCases,2);assert.equal(String(sanctions[0].details.disciplineFoulIds).split('|').length,2);
    assert.equal(s.restart?.kind,'SEVEN_METRE');assert.equal(s.events.find(e=>e.type==='WHISTLE_RESTART')?.details.foulId,original);
    assert.equal(s.events.filter(e=>e.type==='FOUL_ASSESSED').length,2,'Physical infringements remain separate evidence');
  }
});

test('deferred discipline cannot use a newly manufactured warning or suspension from the same stoppage',()=>{
  const s=createContinuous(),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');d.warnings=1;d.sanctions=1;
  startAction(s,a,'SHOOT','Pending attack',null,null,'STANDING');a.action!.phase='EXECUTING';
  judgeFoul(s,a,d,'PUNISHABLE','Earlier deferred infringement',false,'earlier');s.tick=40;s.timeMs=2000;refereeAfter(s);
  assert.equal(s.referee.sanctions.length,1);assert.equal(d.sanctions,1);
  a.action=null;judgeFoul(s,a,d,'PUNISHABLE','Later infringement at the same first stoppage',false,'later');refereeAfter(s);
  assert.equal(d.sanctions,2);assert.equal(d.population,'SUSPENDED');assert.equal(s.events.filter(e=>e.type==='DISQUALIFICATION').length,0);
  assert.equal(s.events.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length,1);assert.equal(s.referee.sanctions.length,0);
});

test('a deferred suspension for a player substituted off still reduces the team on court',()=>{
  const s=createContinuous(),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');d.warnings=1;
  startAction(s,a,'SHOOT','Pending attack',null,null,'STANDING');a.action!.phase='EXECUTING';
  judgeFoul(s,a,d,'PUNISHABLE','Deferred under advantage',false,'deferred');s.tick=40;s.timeMs=2000;refereeAfter(s);
  assert.equal(s.referee.sanctions.length,1);
  // The offender is exchanged off before the next stoppage.
  const sub=s.players.find(p=>p.team==='AWAY'&&p.population==='BENCH'&&p.kind==='FIELD_PLAYER')!;
  d.population='BENCH';sub.population='COURT';sub.role=d.role;sub.position={...d.position};
  a.action=null;judgeFoul(s,a,getPlayer(s,'A04'),'ORDINARY','Whistled stoppage',false,'stoppage');refereeAfter(s);
  assert.equal(d.population,'SUSPENDED');assert.equal(courtLimit(s,'AWAY'),6);
  assert.equal(courtPlayers(s,'AWAY').length,6,'the team plays short although the offender was on the bench');
  assert.equal(courtPlayers(s,'AWAY').filter(p=>p.kind==='GOALKEEPER').length,1);
  assert.ok(s.events.some(e=>e.type==='PLAYER_LEFT_COURT'&&e.details.reason==='Team reduced for a personal sanction'));
  assertCore(s);
});

test('different offenders retain independent discipline and progression still applies after separate whistles',()=>{
  const s=createContinuous(),a=getPlayer(s,'H03'),one=getPlayer(s,'A03'),two=getPlayer(s,'A04');
  startAction(s,a,'SHOOT','Pending attack',null,null,'STANDING');a.action!.phase='EXECUTING';
  judgeFoul(s,a,one,'CLEAR_CHANCE','First offender',true,'first');judgeFoul(s,a,two,'PUNISHABLE','Second offender',false,'second');
  assert.equal(one.warnings,1);assert.equal(two.warnings,1);
  a.action=null;judgeFoul(s,a,one,'PUNISHABLE','Separate later decision',false,'third');assert.equal(one.sanctions,1);assert.equal(two.sanctions,0);
});

test('a throw-off that cannot be organised still opens the half through the referee fallback',()=>{
  // HM-ALPHA2-04A: bodies jammed on the centre spot at the half-time switch
  // left the throw-off unorganisable. The fallback free throw dropped the
  // opening context, so the half never started and the clock never ran again.
  const s=createMatch(4,'TOP',1800000,0);
  s.restart!.awardedTick=s.tick-1601;
  advanceCoreMutable(s);
  assert.equal(s.events.some(e=>e.type==='RESTART_UNRESOLVED'),true);
  assert.equal(s.restart?.kind,'FREE_THROW');
  assert.equal(s.restart?.context,'OPENING_HALF','the replacement throw still opens the period');
  for(let i=0;i<1200&&s.match!.phase==='PREMATCH';i++)advanceCoreMutable(s);
  assert.equal(s.match!.phase,'FIRST_HALF');
  assert.equal(s.officialClock.running,true);
  assert.ok(s.events.some(e=>e.type==='PERIOD_STARTED'));
});
