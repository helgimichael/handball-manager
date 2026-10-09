import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { getPlayer } from './state';
import { world } from './space';
import { readContact } from './sanction';
import { setProfile } from './testProfile';
import { createContactScenario } from './contactScenarios';
import { tickCore } from './engine';

test('equal total pace sideways is containment while pace toward the attacker is a charge',()=>{
  for(const direction of ['TOP','BOTTOM'] as const){
    const s=createCoreScenario('ESTABLISHED_6V6',2025,direction),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
    a.position=world({x:10,y:10},direction);d.position=world({x:10,y:9.3},direction);setProfile(d,{balance:.5});
    d.velocity={x:3.2,y:0};const sliding=readContact(s,a,d,'BENT_ARMS','FRONT',.7);
    d.velocity={x:0,y:direction==='TOP'?3.2:-3.2};const charging=readContact(s,a,d,'BENT_ARMS','FRONT',.7);
    assert.equal(sliding.severity,'LEGAL');assert.equal(charging.severity,'ORDINARY');
    assert.equal(sliding.detail.closingSpeed,charging.detail.closingSpeed,'total pace is identical');
    assert.equal(sliding.detail.radialClosingSpeed,0);assert.ok(Number(charging.detail.radialClosingSpeed)>3);
    assert.equal(sliding.detail.contactClass,'FRONTAL_CONTAINMENT');assert.equal(charging.detail.contactClass,'FRONTAL_CHARGE');
  }
});

test('actual contact balance raises the same defender movement he can control',()=>{
  const s=createCoreScenario(),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
  a.position={x:10,y:10};d.position={x:10,y:9.3};d.velocity={x:0,y:2.5};
  setProfile(d,{balance:.1});const poor=readContact(s,a,d,'BENT_ARMS','FRONT',.7);
  setProfile(d,{balance:.9});const stable=readContact(s,a,d,'BENT_ARMS','FRONT',.7);
  assert.equal(poor.severity,'ORDINARY');assert.equal(stable.severity,'LEGAL');
  assert.ok(Number(stable.detail.controlledClosingLimit)>Number(poor.detail.controlledClosingLimit));
});

test('giving ground or being run into does not make a stationary defender charge',()=>{
  const s=createCoreScenario(),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
  a.position={x:10,y:10};d.position={x:10,y:9.3};a.velocity={x:0,y:-6};
  for(const velocity of [{x:0,y:0},{x:0,y:-3.2}]){
    d.velocity=velocity;const read=readContact(s,a,d,'BENT_ARMS','FRONT',.7);
    assert.equal(read.severity,'LEGAL');assert.equal(read.detail.radialClosingSpeed,0);
    assert.ok(Number(read.detail.relativeClosingSpeed)>2,'impact context is inspectable separately from defender blame');
  }
});

test('radial containment does not excuse holding, contact from behind or dangerous airborne contact',()=>{
  const s=createCoreScenario(),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
  a.position={x:10,y:10};d.position={x:10,y:9.3};d.velocity={x:3.5,y:0};
  const held=readContact(s,a,d,'HOLD','SIDE',.7),behind=readContact(s,a,d,'BENT_ARMS','BEHIND',.7);
  assert.notEqual(held.severity,'LEGAL');assert.notEqual(behind.severity,'LEGAL');
  a.airborne={takeoff:{...a.position},untilTick:20};
  assert.equal(readContact(s,a,d,'HOLD','SIDE',.7).severity,'SERIOUS');
});

test('a physical hold destroying a clear chance still produces the canonical7m restart',()=>{
  for(const direction of ['TOP','BOTTOM'] as const){
    let s=createContactScenario('LATE_HOLD',2025,direction);
    for(let n=0;n<5;n++)s=tickCore(s);
    assert.equal(s.restart?.kind,'SEVEN_METRE');assert.equal(s.restart?.owner,'HOME');
    const assessed=s.events.find(e=>e.type==='FOUL_ASSESSED')!,whistle=s.events.find(e=>e.type==='WHISTLE_RESTART')!;
    assert.equal(assessed.details.clearChance,true);assert.equal(whistle.details.foulId,assessed.details.foulId);
  }
});
