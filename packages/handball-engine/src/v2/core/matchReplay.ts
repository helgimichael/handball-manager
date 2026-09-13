import { advanceCoreMutable, assertCore } from './engine';
import { coreSnapshot } from './replay';
import { exactSnapshot } from '../primitives';
import type { CoreState } from './state';

type Checkpoint={body:Omit<CoreState,'events'|'contests'>;events:number;contests:number};
/** Privately owned batch state plus sparse immutable checkpoints. Events are stored once. */
export type MatchArchive={state:CoreState;checkpoints:Checkpoint[];interval:number};
function capture(s:CoreState,fromEvents=0,fromContests=0):Checkpoint {
  const {events,contests,...body}=s;
  // Canonical records are append-only. Freeze the newly appended tail once so
  // repeated late-match seeks share history instead of cloning it every frame.
  for(let i=fromEvents;i<events.length;i++)events[i]=exactSnapshot(events[i]);
  for(let i=fromContests;i<contests.length;i++)contests[i]=exactSnapshot(contests[i]);
  return {body:exactSnapshot(body),events:events.length,contests:contests.length};
}
export function archiveMatch(initial:CoreState,interval=200):MatchArchive {
  if(!Number.isInteger(interval)||interval<1||interval>2000)throw new Error('Invalid checkpoint interval');
  assertCore(initial);
  const state=JSON.parse(JSON.stringify(initial)) as CoreState;
  return {state,checkpoints:[capture(state)],interval};
}
export function advanceArchive(archive:MatchArchive,budget=1000):void {
  if(!Number.isInteger(budget)||budget<1||budget>10000)throw new Error('Invalid batch budget');
  for(let i=0;i<budget&&archive.state.status==='RUNNING';i++) {
    advanceCoreMutable(archive.state);
    if(archive.state.tick%archive.interval===0||archive.state.status!=='RUNNING') {
      assertCore(archive.state);
      const previous=archive.checkpoints[archive.checkpoints.length-1];
      archive.checkpoints.push(capture(archive.state,previous.events,previous.contests));
    }
  }
}
/** Re-execute from the preceding checkpoint, never interpolate or label from final state. */
export function seekMatch(archive:MatchArchive,tick:number):CoreState {
  if(!Number.isInteger(tick)||tick<archive.checkpoints[0].body.tick||tick>archive.state.tick)throw new Error('Unknown historical tick');
  const checkpoint=archive.checkpoints.findLast(c=>c.body.tick<=tick)!;
  const s:CoreState={...JSON.parse(JSON.stringify(checkpoint.body)),events:archive.state.events.slice(0,checkpoint.events),contests:archive.state.contests.slice(0,checkpoint.contests)};
  while(s.tick<tick&&s.status==='RUNNING')advanceCoreMutable(s);
  if(s.tick!==tick)throw new Error('Historical reconstruction ended early');
  return coreSnapshot(s);
}
