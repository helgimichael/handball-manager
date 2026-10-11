import type { Distribution } from './statistics';
export const SCHEMA_VERSION='match-benchmarks/1';
export type Unit='count'|'ratio'|'seconds'|'minutes'|'metres'|'radians'|'capability';
export type Definition={unit:Unit;denominator:string;minimumSample:number;sampleUnit:string};
const count=(denominator:string):Definition=>({unit:'count',denominator,minimumSample:1,sampleUnit:'matches'});
const rate=(denominator:string):Definition=>({unit:'ratio',denominator,minimumSample:10,sampleUnit:'denominator events'});
export const METRICS:Record<string,Definition>={
  margin:count('absolute difference between home and away full-time goals'),homeGoals:count('home team full-time goals per match'),awayGoals:count('away team full-time goals per match'),homeWin:rate('home wins / completed matches'),draw:rate('draws / completed matches'),awayWin:rate('away wins / completed matches'),
  sourceTechnicalErrors:count('official recorded pass errors + lost balls + rule errors per match; not assumed equivalent to canonical turnover endings'),playerGoalsPerAppearance:{unit:'count',denominator:'official player season goals / recorded appearances',minimumSample:10,sampleUnit:'appearances'},
  outfieldShots:count('recorded released shot attempts by field players, both teams; keeper attempts excluded'),outfieldConversion:rate('field player goals / recorded field player shot attempts, including 7m'),
  goals:count('both teams per completed match'),goalsPerTeam:count('one team per completed match'), possessions:count('completed canonical ledger attacks, both teams'),possessionsPerTeam:count('completed ledger attacks for one team'),
  shots:count('SHOT_RELEASED attempts, both teams'),shotsPerTeam:count('released shots for one team'),saves:count('non-goal SAVE_CAUGHT/PARRY shot actions'),shotsFaced:count('saves + goals; misses and blocks excluded'),
  savePct:rate('saves / (saves + goals); goalkeeper-attributed shots only'),conversion:rate('goals / released attempts'),goalsPerPossession:rate('goals / completed ledger attacks'),
  turnovers:count('career result turnovers'),technicalErrors:count('canonical ledger TECHNICAL_VIOLATION endings'),sevenMetres:count('career result 7m attempts'),sevenMetreConversion:rate('7m goals / 7m attempts'),suspensions:count('career result two-minute suspensions'),
  contacts:count('CONTACT_EXECUTED events'),assessedFouls:count('deduplicated canonical foul IDs'),advantages:count('ADVANTAGE_PENDING events'),whistles:count('deduplicated WHISTLE_RESTART foul IDs; contact-rule stops'),freeThrows:count('FREE_THROW restart awards including technical/passive'),offensiveFouls:count('canonical ledger OFFENSIVE_FOUL endings'),
  possessionSeconds:{unit:'seconds',denominator:'mean first-to-last official event seconds per completed ledger attack; includes its stoppage intervals only when official clock runs',minimumSample:10,sampleUnit:'completed attacks'},
  transitionPossessions:count('distinct possession IDs with observed TRANSITION phase'),transitionAttempts:count('observed TRANSITION phase entries (may repeat in a possession)'),transitionShots:count('shots released in TRANSITION'),transitionGoals:count('goals from those released shots'),transitionConversion:rate('transition goals / transition shots'),transitionRate:rate('distinct transition possessions / completed ledger attacks'),
  shotShare:rate('group attempts / team or match attempts as identified by scope'),goalShare:rate('group goals / team or match goals as identified by scope'),scorerConcentration:rate('largest player goal count / team goals'),shotConcentration:rate('largest player shot count / team shots'),scorerHHI:rate('sum of squared player shares of team goals'),
  minutes:{unit:'minutes',denominator:'canonical courtMs / 60000',minimumSample:1,sampleUnit:'players'},
  pressure:{unit:'capability',denominator:'mean canonical release pressure per attempt',minimumSample:10,sampleUnit:'shots'},quality:{unit:'capability',denominator:'mean canonical decisionQuality per attempt',minimumSample:10,sampleUnit:'shots'},distance:{unit:'metres',denominator:'mean distance from goal centre at release',minimumSample:10,sampleUnit:'shots'},angle:{unit:'radians',denominator:'mean canonical shooting angle at release',minimumSample:10,sampleUnit:'shots'},blockThreat:{unit:'capability',denominator:'mean release block threat per attempt',minimumSample:10,sampleUnit:'shots'},
};
export type Evidence={tier:'A'|'B'|'C'|'D';seasonStatus:'COMPLETE_SEASON'|'PARTIAL_SEASON'|'MULTI_SEASON';expectedMatches:number|null;foundMatches:number;parsedMatches:number;coverage:number|null;playerObservations:number;keeperObservations:number;missingMetrics:string[]};
export type Provenance={name:string;location:string;collectionMethod:string;extractionVersion:string;timestamp:string;confidence:'LOW'|'MEDIUM'|'HIGH';matches:number;events?:number;notes:string[];sourceHashes?:string[];sourceManifestHash?:string;normalizedHash?:string;coverage?:number|null};
export type Adjustment={layer:'TEAM'|'PLAYER'|'MATCH_CONTEXT';feature:string;centre:number;coefficient:number;provenance:Provenance};
export type ReferenceMetric={metric:string;unit:Unit;definition:string;scope:string;distribution:Partial<Distribution>&{n:number};provenance:Provenance;transformations:string[];adjustments?:Adjustment[];evidence?:Evidence};
export type ReferenceProfile={schemaVersion:typeof SCHEMA_VERSION;id:string;version:string;kind:'REAL_WORLD_REFERENCE'|'ENGINEERING_SANITY_RANGE';sport:'handball';country?:string;competition?:string;level?:string;category?:string;season?:string;dateRange?:{start:string;end:string};metrics:ReferenceMetric[];notes:string[];evidence?:Evidence};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const required=(x:Record<string,unknown>,names:string[])=> { for(const name of names) if(typeof x[name]!=='string'||!String(x[name]).trim()) throw new Error(`Missing ${name}`); };
export function validateProvenance(x:unknown):asserts x is Provenance {
  if(!object(x))throw new Error('Provenance required');required(x,['name','location','collectionMethod','extractionVersion','timestamp']);
  if(!Number.isFinite(Date.parse(String(x.timestamp)))||!['LOW','MEDIUM','HIGH'].includes(String(x.confidence))||!Number.isInteger(x.matches)||Number(x.matches)<0||!Array.isArray(x.notes)||x.notes.some(n=>typeof n!=='string')||x.events!==undefined&&(!Number.isInteger(x.events)||Number(x.events)<0))throw new Error('Malformed provenance');
  if(x.sourceHashes!==undefined&&(!Array.isArray(x.sourceHashes)||x.sourceHashes.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))||x.normalizedHash!==undefined&&(typeof x.normalizedHash!=='string'||!/^[a-f0-9]{64}$/.test(x.normalizedHash))||x.coverage!==undefined&&x.coverage!==null&&(typeof x.coverage!=='number'||x.coverage<0||x.coverage>1))throw new Error('Invalid empirical provenance');
  if(x.sourceManifestHash!==undefined&&(typeof x.sourceManifestHash!=='string'||!/^[a-f0-9]{64}$/.test(x.sourceManifestHash)))throw new Error('Invalid source manifest hash');
}
function validateEvidence(x:unknown) {
  if(!object(x)||!['A','B','C','D'].includes(String(x.tier))||!['COMPLETE_SEASON','PARTIAL_SEASON','MULTI_SEASON'].includes(String(x.seasonStatus)))throw new Error('Invalid empirical evidence');
  for(const k of ['foundMatches','parsedMatches','playerObservations','keeperObservations'])if(!Number.isInteger(x[k])||Number(x[k])<0)throw new Error('Invalid evidence counts');
  if(x.expectedMatches!==null&&(!Number.isInteger(x.expectedMatches)||Number(x.expectedMatches)<1)||Number(x.parsedMatches)>Number(x.foundMatches))throw new Error('Invalid coverage counts');
  const expected=x.expectedMatches===null?null:Number(x.parsedMatches)/Number(x.expectedMatches);
  if(x.coverage!==expected||expected!==null&&(expected<0||expected>1)||!Array.isArray(x.missingMetrics))throw new Error('Invalid coverage');
}
export function ingestReference(x:unknown):ReferenceProfile {
  if(!object(x))throw new Error('Profile required'); required(x,['id','version','sport']);
  if(x.schemaVersion!==SCHEMA_VERSION||x.sport!=='handball'||!['REAL_WORLD_REFERENCE','ENGINEERING_SANITY_RANGE'].includes(String(x.kind))||!Array.isArray(x.metrics)||!Array.isArray(x.notes)||x.notes.some(n=>typeof n!=='string'))throw new Error('Malformed profile');
  for(const key of ['country','competition','level','category','season'])if(x[key]!==undefined&&(typeof x[key]!=='string'||!String(x[key]).trim()))throw new Error(`Invalid ${key}`);
  if(x.season&&!x.competition)throw new Error('Season requires competition identity');
  if(x.competition&&!x.country)throw new Error('Competition requires country');
  if(x.dateRange!==undefined&&(!object(x.dateRange)||!Number.isFinite(Date.parse(String(x.dateRange.start)))||!Number.isFinite(Date.parse(String(x.dateRange.end)))||String(x.dateRange.start)>String(x.dateRange.end)))throw new Error('Invalid date range');
  if(x.evidence!==undefined)validateEvidence(x.evidence);
  const seen=new Set<string>();
  for(const row of x.metrics){
    if(!object(row)||typeof row.metric!=='string'||!METRICS[row.metric]||row.unit!==METRICS[row.metric].unit)throw new Error('Unknown metric/unit'); required(row,['definition','scope']);
    if(row.definition!==METRICS[row.metric].denominator)throw new Error('Metric definition mismatch');
    const key=`${row.metric}:${row.scope}`;if(seen.has(key))throw new Error('Duplicate metric scope');seen.add(key);
    validateProvenance(row.provenance);
    if(row.evidence!==undefined)validateEvidence(row.evidence);
    if(!Array.isArray(row.transformations)||row.transformations.some(t=>typeof t!=='string'))throw new Error('Transformations required');
    const d=row.distribution;if(!object(d)||!Number.isInteger(d.n)||Number(d.n)<1)throw new Error('Invalid distribution sample');
    for(const [field,v] of Object.entries(d))if(!['n','mean','median','sd','min','max','p05','p10','p25','p75','p90','p95'].includes(field)||v!==null&&(typeof v!=='number'||!Number.isFinite(v)))throw new Error('Invalid distribution field');
    if(d.sd!==undefined&&d.sd!==null&&Number(d.sd)<0)throw new Error('Negative SD');
    const ordered=['min','p05','p10','p25','median','p75','p90','p95','max'].map(k=>d[k]).filter((v):v is number=>typeof v==='number');if(ordered.some((v,i)=>i>0&&v<ordered[i-1]))throw new Error('Unordered percentiles');
    for(const [k,v]of Object.entries(d))if(k!=='n'&&k!=='sd'&&typeof v==='number'&&(d.min!==undefined&&v<Number(d.min)||d.max!==undefined&&v>Number(d.max)||row.unit==='ratio'&&(v<0||v>1)))throw new Error('Distribution outside bounds');
    if(x.kind==='REAL_WORLD_REFERENCE'&&row.provenance.matches<1)throw new Error('Empirical reference requires matches');
    if(row.adjustments!==undefined){if(!Array.isArray(row.adjustments))throw new Error('Malformed adjustments');for(const a of row.adjustments){if(!object(a)||!['TEAM','PLAYER','MATCH_CONTEXT'].includes(String(a.layer))||typeof a.feature!=='string'||/\b(ca|pa)\b/i.test(a.feature)||typeof a.centre!=='number'||!Number.isFinite(a.centre)||typeof a.coefficient!=='number'||!Number.isFinite(a.coefficient))throw new Error('Invalid capability adjustment');validateProvenance(a.provenance);}}
  }
  return structuredClone(x) as ReferenceProfile;
}
export type Identity={country?:string;competition:string;level?:string;category?:string;season:string};
export function lookup(profiles:readonly ReferenceProfile[],identity:Identity,metric:string,scope='MATCH') {
  const levels=['EXACT_COMPETITION_SEASON','COMPETITION_MULTI_SEASON','COUNTRY_LEVEL','GLOBAL'] as const;
  for(const fallback of levels){
    const candidates=profiles.filter(p=>p.kind==='REAL_WORLD_REFERENCE'&&p.sport==='handball'&&p.category===identity.category&&(!p.country||p.country===identity.country)&&
      (fallback==='EXACT_COMPETITION_SEASON'?p.competition===identity.competition&&p.season===identity.season:
      fallback==='COMPETITION_MULTI_SEASON'?p.competition===identity.competition&&!p.season:
      fallback==='COUNTRY_LEVEL'?!!identity.country&&!!identity.level&&p.country===identity.country&&p.level===identity.level&&!p.competition&&!p.season:!p.country&&!p.competition&&!p.level&&!p.season));
    if(candidates.length>1&&candidates.filter(p=>p.metrics.some(r=>r.metric===metric&&r.scope===scope)).length>1)throw new Error(`Ambiguous reference ${fallback} ${metric} ${scope}`);
    for(const profile of candidates){const row=profile.metrics.find(r=>r.metric===metric&&r.scope===scope);if(row)return {fallback,profileId:profile.id,profileVersion:profile.version,row};}
  }
  return null;
}
