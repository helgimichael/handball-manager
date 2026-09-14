const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {analyse}=require('./audit-v2-variation.cjs');
const {createMatch}=require('../src/v2/core/match.ts');
const {advanceCoreMutable,assertCore}=require('../src/v2/core/engine.ts');
const {coreHash,coreEventHash,saveCore,loadCore}=require('../src/v2/core/replay.ts');
const {setTactics}=require('../src/v2/core/coaching.ts');
const rows=[],out=path.join(__dirname,'../src/v2/core/variation-proof.json');
const persist=complete=>fs.writeFileSync(out,JSON.stringify({complete,description:'Full official matches, actual physical relationship snapshots, observed defensive recognition and exact historical save continuation.',rows},null,2)+'\n');
persist(false);
for(const seed of [1,2025])for(const direction of ['TOP','BOTTOM']){
  const s=createMatch(seed,direction),moments=new Map();let historical=null;
  while(s.status==='RUNNING'){
    const before=s.events.length;advanceCoreMutable(s);if(s.tick%1000===0)assertCore(s);
    for(const event of s.events.slice(before)){
      if(event.type==='DEFENSIVE_ENTRY_RECOGNIZED'&&!historical)historical=structuredClone(s);
      if(event.type==='ATTACK_RELATIONSHIP_ESTABLISHED'&&!moments.has(event.details.family))moments.set(event.details.family,{event,entry:structuredClone(s.offence.entry),players:s.players.filter(p=>p.population==='COURT').map(p=>({id:p.id,position:{...p.position},action:p.action?.kind,duty:p.duty.kind}))});
    }
  }
  assertCore(s);assert.equal(s.match.phase,'FULLTIME',s.reason);assert.equal(s.officialClock.timeMs,3600000);
  const counts={};for(const e of s.events)counts[e.type]=(counts[e.type]??0)+1;
  const read=s.events.find(e=>e.type==='DEFENSIVE_ENTRY_RECOGNIZED');assert.ok(read);
  const resumed=structuredClone(loadCore(saveCore(historical)));
  while(resumed.status==='RUNNING')advanceCoreMutable(resumed);
  assert.equal(coreHash(resumed),coreHash(s));assert.equal(coreEventHash(resumed),coreEventHash(s));
  const row={seed,direction,...analyse(s),stateHash:coreHash(s),eventHash:coreEventHash(s),resume:{tick:read.tick,exact:true},recognitions:counts.DEFENSIVE_ENTRY_RECOGNIZED,screenContacts:counts.SCREEN_CONTACT,handovers:counts.HANDOVER_COMPLETED,
    physicalMoments:['CROSS','PIVOT_SCREEN','WING_TRANSITION','STRETCH_SHIFT'].map(family=>{
      const moment=moments.get(family);assert.ok(moment,family);const {event,entry,players}=moment;
      return {family,tick:event.tick,officialMs:event.officialMs,evidence:event.details.evidence,entry,players};
    })};
  if(seed===2025){row.identities=[];for(const identity of ['WIDTH','DIRECT']){
    const branch=structuredClone(historical);assert.ok(setTactics(branch,branch.possession.team,{attackIdentity:identity}));
    while(branch.status==='RUNNING'){advanceCoreMutable(branch);if(branch.tick%1000===0)assertCore(branch);}
    assert.equal(branch.match.phase,'FULLTIME',branch.reason);assertCore(branch);
    row.identities.push({identity,...analyse(branch),hash:coreHash(branch)});
  }assert.notEqual(row.identities[0].hash,row.identities[1].hash);}
  rows.push(row);persist(false);console.log(JSON.stringify({seed,direction,complete:true,resume:row.resume,recognitions:row.recognitions,physical:row.physicalByFamily,identities:row.identities?.map(r=>r.identity)}));
}
persist(true);
