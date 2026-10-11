import{evaluate}from'./evaluate';
import{ratio}from'./statistics';
import type{ReferenceProfile,Identity}from'./reference';
import type{Distribution}from'./statistics';
export function compareDistributions(metric:string,scope:string,actual:Distribution,profiles:readonly ReferenceProfile[],identity:Identity,engineMatches:number,values:number[]=[]){
  const comparison=evaluate({metric,scope,value:actual.mean,n:actual.n},profiles,identity),reference=comparison.reference;
  if(!reference||actual.mean===null)return{metric,scope,actual,comparison,status:'NO REFERENCE',priority:0};
  const d=reference.row.distribution,expected=d.mean??d.median;if(expected==null)return{metric,scope,actual,comparison,status:'UNRESOLVED',priority:0};
  const standardized=typeof d.sd==='number'&&d.sd>0?(actual.mean-expected)/d.sd:null;
  const referenceN=Math.min(d.n,reference.row.provenance.matches),actualN=Math.min(actual.n,engineMatches);
  const se=actualN>1&&referenceN>1&&actual.sd!==null&&typeof d.sd==='number'?Math.sqrt(actual.sd**2/actualN+d.sd**2/referenceN):null;
  const interval=se===null?null:{low:actual.mean-expected-1.96*se,high:actual.mean-expected+1.96*se,confidence:.95,method:'Approximate descriptive mean-difference interval, conservative N capped at matches; unmodeled fixture and roster selection remain caveats'};
  const systematic=values.length&&typeof d.sd==='number'&&d.sd>0?values.filter(v=>Math.abs((v-expected)/d.sd!)>=2).length/values.length:0;
  const confidence={HIGH:1,MEDIUM:.65,LOW:.25}[reference.row.provenance.confidence],coverage=reference.row.provenance.coverage??1,impact:Record<string,number>={savePct:1,saves:.8,goals:.9,sevenMetres:.8,suspensions:1,scorerConcentration:.75};
  const priority=standardized===null?0:100*(impact[metric]??.6)*confidence*coverage*Math.min(1,d.n/100)*Math.min(1,engineMatches/20)*(.7*Math.min(1,Math.abs(standardized)/2)+.3*systematic);
  const different=interval!==null&&(interval.low>0||interval.high<0),proxy=reference.fallback!=='EXACT_COMPETITION_SEASON';
  const sufficient=engineMatches>=10&&d.n>=30&&reference.row.provenance.confidence!=='LOW';
  return{metric,scope,actual,comparison,standardizedMeanDifference:standardized,meanDifference:actual.mean-expected,interval,systematicFraction:systematic,priority:sufficient?priority:0,status:different&&sufficient?proxy?'LIKELY PROBLEM':'SUPPORTED PROBLEM':'UNRESOLVED',caveats:[proxy?'Cross-competition/global reference transfer; not exact league evidence':'Historical competition-season environment, not a prediction of these 2026/27 fixtures','No player/shot-context coefficient fit; descriptive comparison only']};
}
export function empiricalPercentile(value:number,values:readonly number[]){return{n:values.length,percentile:ratio(values.filter(v=>v<=value).length,values.length),aboveMaximum:values.length>0&&value>Math.max(...values),ties:values.filter(v=>v===value).length,definition:'empirical CDF count(reference <= actual) / N; above maximum is not proof of impossibility'};}
