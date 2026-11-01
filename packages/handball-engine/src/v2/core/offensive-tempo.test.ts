// HM-ALPHA2-04B: offensive tempo is a coaching decision that changes how the
// attack plays -- reading time, willingness to progress, transition push --
// never a scoring or turnover rate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { getPlayer } from './state';
import { controlReadTicks } from './structure';
import { setTactics, tempoProfile, TEMPO_PROFILES, type OffensiveTempo } from './coaching';

test('tempo is a validated instruction with three levels; unknown stored values play BALANCED',()=>{
  const s=createCoreScenario();
  for(const tempo of ['SLOW','QUICK','BALANCED'] as const){
    assert.ok(setTactics(s,'HOME',{tempo}));
    assert.equal(s.coaching.HOME.tempo,tempo);
    assert.equal(s.events.at(-1)?.details.tempo,tempo);
  }
  assert.throws(()=>setTactics(s,'HOME',{tempo:'FRANTIC' as OffensiveTempo}),/Invalid team tactics/);
  assert.equal(tempoProfile(undefined),TEMPO_PROFILES.BALANCED);
  assert.equal(tempoProfile('LEGACY'),TEMPO_PROFILES.BALANCED);
});

test('BALANCED and QUICK keep the values the engine always used',()=>{
  // Existing careers and active saves (which only know BALANCED and QUICK)
  // must play exactly as before.
  assert.deepEqual(TEMPO_PROFILES.BALANCED,{readTicks:8,recycle:1,progress:1,freePace:0,transition:0});
  assert.deepEqual(TEMPO_PROFILES.QUICK,{readTicks:5,recycle:.94,progress:1.06,freePace:.2,transition:.04});
});

test('a slower tempo gives the carrier more reading time, a faster one less',()=>{
  const reading=(tempo:OffensiveTempo)=>{const s=createCoreScenario();s.coaching.HOME.tempo=tempo;return controlReadTicks(s,getPlayer(s,'H03'));};
  assert.ok(reading('SLOW')>reading('BALANCED')&&reading('BALANCED')>reading('QUICK'),
    `read ticks ${reading('SLOW')} / ${reading('BALANCED')} / ${reading('QUICK')}`);
});

test('SLOW mirrors QUICK around BALANCED: it prefers recycling and pushes transitions less',()=>{
  const {SLOW,BALANCED,QUICK}=TEMPO_PROFILES;
  for(const key of ['recycle','progress','freePace','transition','readTicks'] as const)
    assert.ok(Math.abs((SLOW[key]-BALANCED[key])+(QUICK[key]-BALANCED[key]))<1e-12,`${key} is symmetric`);
  assert.ok(SLOW.recycle>1&&SLOW.progress<1&&SLOW.transition<0);
});
