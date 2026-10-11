import { METRICS, lookup, type Identity, type ReferenceProfile } from './reference';
export type Observation={metric:string;scope:string;value:number|null;n:number;features?:Record<string,number>;contributors?:string[]};
export function evaluate(observation:Observation,profiles:readonly ReferenceProfile[],identity:Identity) {
  const reference=lookup(profiles,identity,observation.metric,observation.scope),definition=METRICS[observation.metric];
  if(!definition)throw new Error(`Unsupported metric ${observation.metric}`);
  const base={...observation,definition,reference,expectation:null as null|{baseline:number;value:number;components:{layer:string;feature:string;value:number;source:string}[];missingFeatures:string[]},deviation:null as number|null,z:null as number|null,confidence:reference?.row.provenance.confidence??'UNKNOWN'};
  if(observation.value===null)return {...base,status:'UNSUPPORTED' as const};
  if(!reference)return {...base,status:'NO_REFERENCE' as const};
  const d=reference.row.distribution,baseline=d.mean??d.median;
  if(baseline===undefined||baseline===null)return {...base,status:'INSUFFICIENT_REFERENCE' as const};
  const components:{layer:string;feature:string;value:number;source:string}[]=[],missingFeatures:string[]=[];
  for(const a of reference.row.adjustments??[]){const feature=observation.features?.[a.feature];if(feature===undefined||!Number.isFinite(feature)){missingFeatures.push(a.feature);continue;}components.push({layer:a.layer,feature:a.feature,value:(feature-a.centre)*a.coefficient,source:a.provenance.location});}
  const expected=baseline+components.reduce((sum,a)=>sum+a.value,0),deviation=observation.value-expected;
  const expectation={baseline,value:expected,components,missingFeatures};
  if(definition.unit==='ratio'&&(expected<0||expected>1))return {...base,expectation,status:'INVALID_EXPECTATION' as const};
  const enough=d.n>=30&&observation.n>=definition.minimumSample&&reference.row.provenance.confidence!=='LOW';
  if(!enough||missingFeatures.length)return {...base,expectation,deviation,status:'INSUFFICIENT_SAMPLE' as const};
  const z=typeof d.sd==='number'&&d.sd>0?deviation/d.sd:null;
  // Reporting policy, not competition targets. Only an adequately sampled reference supplies the scale.
  let status:'NORMAL'|'WATCH'|'OUTLIER'|'EXTREME'|'INSUFFICIENT_REFERENCE'='INSUFFICIENT_REFERENCE';
  if(z!==null)status=Math.abs(z)>=4?'EXTREME':Math.abs(z)>=3?'OUTLIER':Math.abs(z)>=2?'WATCH':'NORMAL';
  else if(d.p05!=null&&d.p95!=null){const shifted=observation.value-(expected-baseline);status=shifted<d.p05||shifted>d.p95?'OUTLIER':d.p10!=null&&d.p90!=null&&(shifted<d.p10||shifted>d.p90)?'WATCH':'NORMAL';}
  return {...base,expectation,deviation,z,status};
}
