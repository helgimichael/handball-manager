import { exactSnapshot, fingerprint } from '../primitives';
import { CORE_VERSION, type CoreState } from './state';
import { assertCore, tickCore } from './engine';

export function coreSnapshot(s:CoreState):CoreState {
  // Reuse only already-frozen historical records. Copy all mutable physical state.
  // This avoids duplicating each old event object into every subsequent tick.
  const {events,contests,...body}=s;
  const snapshot:CoreState={...exactSnapshot(body),events:events.map(e=>Object.isFrozen(e)?e:exactSnapshot(e)),contests:contests.map(c=>Object.isFrozen(c)?c:exactSnapshot(c))};
  Object.freeze(snapshot.events);Object.freeze(snapshot.contests);return Object.freeze(snapshot);
}
export const coreHash=(s:CoreState)=>fingerprint(s);
export const coreEventHash=(s:CoreState)=>fingerprint(s.events);
export function saveCore(s:CoreState) {assertCore(s);return JSON.stringify({format:'HANDBALL_CORE_SAVE_1',version:CORE_VERSION,hash:coreHash(s),eventHash:coreEventHash(s),state:s});}
export function loadCore(json:string):CoreState {
  if(json.length>256000000)throw new Error('Save exceeds match limit');
  const saved=JSON.parse(json);if(saved?.format!=='HANDBALL_CORE_SAVE_1'||saved.version!==CORE_VERSION)throw new Error('Unsupported core save');
  assertCore(saved.state);if(saved.hash!==coreHash(saved.state)||saved.eventHash!==coreEventHash(saved.state))throw new Error('Core save fingerprint mismatch');
  return coreSnapshot(saved.state);
}
export type CoreReplay={frames:readonly CoreState[];cursor:number;remainderMs:number};
export function replayCore(s:CoreState):CoreReplay{return {frames:[coreSnapshot(s)],cursor:0,remainderMs:0};}
export function stepCoreReplay(r:CoreReplay):CoreReplay {
  if(r.cursor<r.frames.length-1)return {...r,cursor:r.cursor+1};
  const s=r.frames[r.cursor];if(s.status!=='RUNNING')return r;
  return {...r,frames:[...r.frames,coreSnapshot(tickCore(s))],cursor:r.cursor+1};
}
export function seekCore(r:CoreReplay,cursor:number):CoreReplay {if(!Number.isInteger(cursor)||cursor<0||cursor>=r.frames.length)throw new Error('Unknown tick');return {...r,cursor,remainderMs:0};}
export function playCore(r:CoreReplay,elapsed:number,speed:number):CoreReplay {
  if(!Number.isFinite(elapsed)||elapsed<0||![.25,.5,1,2,4].includes(speed))throw new Error('Invalid playback clock');
  let next={...r,remainderMs:r.remainderMs+Math.min(elapsed,1000)*speed};
  while(next.remainderMs>=50){next=stepCoreReplay(next);next={...next,remainderMs:next.remainderMs-50};if(next.frames[next.cursor].status!=='RUNNING'){next.remainderMs=0;break;}}
  return next;
}
