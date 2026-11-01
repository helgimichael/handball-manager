// HM-ALPHA2-04A: defensive aggression is a coaching decision that moves the
// line. It may change only where defenders choose to stand; the consequences
// (metres run, space behind the step-out) have to come from that movement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { allocate, assignZones, dutyTarget, readDefence, type ZoneDuty } from './defence';
import { courtPlayers, getPlayer, type CoreState, type Direction } from './state';
import { local, world } from './space';
import { defensiveAggression, setTactics, type DefensiveAggression } from './coaching';
import { startAction } from './actions';

const fieldDefenders=(s:CoreState)=>courtPlayers(s,s.defence.team).filter(p=>p.kind==='FIELD_PLAYER');
const fieldAttackers=(s:CoreState)=>courtPlayers(s,s.possession.team).filter(p=>p.kind==='FIELD_PLAYER');

/** The pressing and helping targets for one fixed carrier position, at one aggression level. */
function targets(level:DefensiveAggression|undefined,direction:Direction='TOP',drive=false){
  const s=createCoreScenario('ESTABLISHED_6V6',7,direction);
  if(level)s.coaching[s.defence.team].aggression=level;
  const carrier=getPlayer(s,'H03');carrier.position=world({x:9.5,y:10.8},direction);s.ball.position={...carrier.position};
  if(drive)assert.ok(startAction(s,carrier,'DRIVE','Threaten the interval',world({x:9,y:8},direction),null));
  const defenders=fieldDefenders(s);assignZones(s,defenders,direction);
  const read=readDefence(s,defenders,carrier,direction);
  const duties=allocate(s,defenders,fieldAttackers(s),carrier,read,direction);
  const job=(kind:ZoneDuty['kind'])=>{const [id,duty]=[...duties].find(([,d])=>d.kind===kind)!;
    const d=getPlayer(s,id);return {id,at:local(dutyTarget(s,d,duty,read,direction),direction)};};
  return {carrier:local(carrier.position,direction),press:job('PRESSURE'),help:job('HELP')};
}

test('aggression is a validated instruction; an absent one plays BALANCED',()=>{
  const s=createCoreScenario();
  assert.equal(s.coaching.HOME.aggression,undefined,'new and old states carry no instruction until a coach gives one');
  assert.equal(defensiveAggression(s,'HOME'),'BALANCED');
  assert.ok(setTactics(s,'HOME',{aggression:'HIGH'}));
  assert.equal(defensiveAggression(s,'HOME'),'HIGH');
  assert.equal(s.events.at(-1)?.type,'TACTICS_CHANGED');
  assert.equal(s.events.at(-1)?.details.aggression,'HIGH');
  assert.throws(()=>setTactics(s,'HOME',{aggression:'EXTREME' as DefensiveAggression}),/Invalid team tactics/);
});

test('BALANCED is exactly the calibrated line',()=>{
  assert.deepEqual(targets('BALANCED'),targets(undefined));
});

test('a higher aggression steps further out and closes tighter on the carrier',()=>{
  const low=targets('LOW'),balanced=targets('BALANCED'),high=targets('HIGH');
  assert.equal(low.press.id,high.press.id,'the same owner presses; aggression changes how, not who');
  assert.ok(high.press.at.y>balanced.press.at.y+.2,`HIGH meets the carrier higher (${high.press.at.y.toFixed(2)} vs ${balanced.press.at.y.toFixed(2)})`);
  assert.ok(balanced.press.at.y>low.press.at.y+.2,`LOW stays nearer its line (${low.press.at.y.toFixed(2)} vs ${balanced.press.at.y.toFixed(2)})`);
  assert.ok(high.carrier.y-high.press.at.y<low.carrier.y-low.press.at.y,'pressure distance shrinks as aggression rises');
});

test('help leaves its post sooner and further at HIGH, and stays home at LOW',()=>{
  // Before any penetration the BALANCED helper only shades; HIGH already reads
  // a carrier this deep as a threat to the interval.
  const low=targets('LOW'),balanced=targets('BALANCED'),high=targets('HIGH');
  const reach=(t:ReturnType<typeof targets>)=>Math.hypot(t.help.at.x-t.carrier.x,t.help.at.y-t.carrier.y);
  assert.ok(reach(high)<reach(balanced)-.1,`HIGH helps toward the ball (${reach(high).toFixed(2)} vs ${reach(balanced).toFixed(2)})`);
  assert.ok(reach(low)>=reach(balanced),'LOW does not leave the post earlier than the calibrated line');
  // Against a real drive every level helps, but by different amounts.
  const lowDrive=targets('LOW','TOP',true),highDrive=targets('HIGH','TOP',true);
  assert.ok(reach(highDrive)<reach(lowDrive)-.2,'the drive draws a longer help run from an aggressive line');
});

test('aggression mirrors at either goal',()=>{
  for(const level of ['LOW','HIGH'] as const){
    const top=targets(level,'TOP'),bottom=targets(level,'BOTTOM');
    for(const key of ['press','help'] as const){
      assert.ok(Math.abs(top[key].at.x-bottom[key].at.x)<1e-9&&Math.abs(top[key].at.y-bottom[key].at.y)<1e-9,`${level} ${key} is direction-invariant`);
    }
  }
});
