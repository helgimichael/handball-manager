import test from 'node:test';
import assert from 'node:assert/strict';
import { playbackTick } from './matchPlayback';
import { encodeFrames, decodeFrames, frameAt } from './matchFrames';
const frames=[[0,0,1,0,0,100,100,0,200,200],[1,50,1,0,0,110,100,0,220,200],[2,100,1,0,0,120,100,0,240,200]];
test('fractional playback follows recorded geometry monotonically at all speeds',()=>{
  for(const speed of [1,4,16]){let tick=0,last=0;while(tick<2){tick=playbackTick(tick,1,speed,2);const frame=frameAt(frames,tick);assert.ok(frame[8]>=last);assert.ok(Math.abs(frame[8]-(200+20*tick))<1e-9);last=frame[8];}assert.equal(tick,2);}
});
test('clock never extrapolates; pause/resume and seek have no elapsed-time debt',()=>{
  assert.equal(playbackTick(1,10000,16,2),2);assert.equal(playbackTick(.5,0,16,2),.5);assert.equal(playbackTick(1,0,1,2),1);assert.equal(playbackTick(.5,25,1,2),1);
});
test('archive codec keeps exact canonical poses and interpolation is immutable',()=>{
  const before=JSON.stringify(frames);assert.deepEqual(decodeFrames(encodeFrames(frames)),frames);assert.deepEqual(frameAt(frames,1),frames[1]);assert.equal(frameAt(frames,.5)[8],210);assert.equal(JSON.stringify(frames),before);
});
test('period and score boundaries do not invent trajectories across placements',()=>{
  const flip=[frames[0],[1,50,2,0,0,1000,1000,0,1800,3800]];assert.deepEqual(frameAt(flip,.5),flip[0]);assert.deepEqual(frameAt(flip,1),flip[1]);
});
