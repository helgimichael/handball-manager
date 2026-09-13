import { seedFromString } from '../simulation/possessionRng';

export type RandomState = { algorithm:'mulberry32'; state:number; draws:number };
/** Pure RNG primitive with explicit serializable state, shared by V2 executors. */
export function nextRandom(rng:RandomState):number {
  rng.state=(rng.state+0x6d2b79f5)>>>0;
  let t=Math.imul(rng.state^(rng.state>>>15),1|rng.state);
  t=(t+Math.imul(t^(t>>>7),61|t))^t;rng.draws++;
  return ((t^(t>>>14))>>>0)/4294967296;
}
function canonical(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value!==null&&typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,v])=>`${JSON.stringify(key)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Stable regression fingerprints, not authentication/security signatures. */
export function fingerprint(value:unknown):string {return seedFromString(canonical(value)).toString(16).padStart(8,'0');}
function freeze<T>(value:T):T {
  if(value!==null&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;
}
export function exactSnapshot<T>(state:T):T {return freeze(JSON.parse(JSON.stringify(state)));}
