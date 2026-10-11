import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {advanceProductionMatch,finalizeProductionMatch,archiveFrames} from '../lib/career/productionMatch';
import type {CareerSave} from '../lib/save/saveRepository';
const initial=JSON.parse(readFileSync('../../docs/match-realism-v21/human-qa/match-007-initial.json','utf8')) as CareerSave;
function canonical(value:unknown):unknown{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical((value as Record<string,unknown>)[key])]));return value;}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function finish(state:typeof initial.careerState){assert.ok(state);while(state.productionMatch!.core.status==='RUNNING')state=advanceProductionMatch(state,10000,false);return state;}
const direct=finish(structuredClone(initial.careerState));
const partial=advanceProductionMatch(structuredClone(initial.careerState!),555,false);
const loaded=JSON.parse(JSON.stringify(partial)),resumed=finish(loaded);
assert.equal(hash(direct.productionMatch!.core),hash(resumed.productionMatch!.core));
assert.deepEqual(direct.productionMatch!.frames,resumed.productionMatch!.frames);
const completed=finalizeProductionMatch(direct),restored=finalizeProductionMatch(resumed),id='swe-2-f7';
assert.deepEqual(completed.results,restored.results);assert.deepEqual(completed.matchArchives,restored.matchArchives);
assert.deepEqual(archiveFrames(completed.matchArchives![id]),direct.productionMatch!.frames);
const diagnostic=JSON.parse(readFileSync('../../docs/match-motion-continuity/final/motion/match-007-completed.json','utf8')) as CareerSave;
assert.deepEqual(diagnostic.careerState!.matchArchives![id],completed.matchArchives![id]);
const receipt={seed:direct.productionMatch!.core.seed,reloadTick:555,coreHash:hash(direct.productionMatch!.core),sameSeedAndState:true,saveLoadCoreEqual:true,saveLoadFramesEqual:true,saveLoadResultsEqual:true,immutableArchiveEqual:true,archiveCodecFramesEqual:true,diagnosticAndProductionArchiveEqual:true,score:direct.productionMatch!.core.score,frameCount:direct.productionMatch!.frames.length};
writeFileSync('../../docs/match-motion-continuity/final/continuation-proof.json',JSON.stringify(receipt,null,2));console.log(receipt);
