/** Offline normalized observations → the existing match-benchmarks/1 contract. */
import {createHash} from 'node:crypto';
import {distribution,ratio} from './statistics';
import {SCHEMA_VERSION,METRICS,ingestReference,type ReferenceProfile,type ReferenceMetric,type Evidence} from './reference';
export type Source={url:string;retrievedAt:string;sha256:string;method:string;status:number};
export type EmpiricalPlayer={sourcePlayerId:string;sourceName:string;side:'home'|'away';identityStatus:string;position:string|null;goals:number;suspensions:number;shots?:number;sevenMetres?:number;sevenMetreGoals?:number;saves?:number;shotsFaced?:number;goalsConceded?:number;denominatorValid?:boolean;ordinaryNumerator?:number;ordinaryDenominator?:number;sevenMetreNumerator?:number;sevenMetreDenominator?:number;passErrors?:number;lostBalls?:number;ruleErrors?:number};
export type EmpiricalMatch={id:string;sourceMatchId:string;competition:string;season:string;stage:string;date?:string|null;sourceUrl:string;home:{id:string;sourceName:string;sourceTeamId:string};away:{id:string;sourceName:string;sourceTeamId:string};homeGoals:number;awayGoals:number;qualityIssues:unknown[];protocol?:{players:EmpiricalPlayer[];teamStats:Record<'home'|'away',{sevenMetres:number;sevenMetreGoals:number;suspensions:number;redCards:number}>;evidenceTier:string};pdf?:{players:EmpiricalPlayer[];sourceUrl:string;issues:{kind:string}[];date:string;evidenceTier:string}};
export type EmpiricalDataset={schemaVersion:'empirical-handball-observations/1';parserVersion:string;competition:string;name:string;country:string;category:string;season:string;seasonStatus:Evidence['seasonStatus'];stage:string;expectedMatches:number;sourceUrl:string;matches:EmpiricalMatch[];sources:Source[];duplicates:string[];qualityIssues:unknown[]};
export const digest=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function resolveTeam(sourceName:string,competition:string,clubs:readonly{id:string;name:string;competitionId:string}[],aliases:Record<string,string>={}){
  const normalize=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleUpperCase('sv'),name=aliases[normalize(sourceName)]??sourceName,all=clubs.filter(c=>normalize(c.name)===normalize(name)),within=all.filter(c=>c.competitionId===competition),candidates=within.length?within:all;
  return{canonicalClubId:candidates.length===1?candidates[0].id:null,status:candidates.length===1?'RESOLVED':candidates.length>1?'AMBIGUOUS':'UNRESOLVED',method:name!==sourceName?'EXPLICIT_DOCUMENTED_ALIAS':'EXACT_NAME_AND_COMPETITION_OR_UNIQUE_CLUB',currentGameAffiliation:candidates.length===1?candidates[0].competitionId:null};
}
export function validateDataset(x:EmpiricalDataset):EmpiricalDataset {
  if(x.schemaVersion!=='empirical-handball-observations/1'||!x.competition||!x.season||!x.parserVersion||!['COMPLETE_SEASON','PARTIAL_SEASON','MULTI_SEASON'].includes(x.seasonStatus)||!x.country||!x.category||!Number.isInteger(x.expectedMatches)||x.expectedMatches<1||!x.sources.length)throw new Error('Dataset identity/provenance required');
  for(const source of x.sources)if(!/^https:\/\//.test(source.url)||!Number.isFinite(Date.parse(source.retrievedAt))||!/^[a-f0-9]{64}$/.test(source.sha256)||source.status!==200)throw new Error('Invalid source provenance');
  const seen=new Set<string>();
  for(const m of x.matches){
    if(seen.has(m.id))throw new Error('Duplicate match '+m.id);seen.add(m.id);
    if(m.competition!==x.competition||m.season!==x.season||m.stage!==x.stage||!m.id||!m.home.id||!m.away.id||m.home.id===m.away.id)throw new Error('Match identity mismatch');
    for(const n of [m.homeGoals,m.awayGoals])if(!Number.isInteger(n)||n<0)throw new Error('Invalid score');
    const validatePlayers=(players:EmpiricalPlayer[],reconcile:boolean)=>{
      const identities=new Set<string>();
      for(const p of players){const id=p.side+':'+p.sourcePlayerId;if(identities.has(id))throw new Error('Duplicate player-match identity');identities.add(id);if(!p.sourcePlayerId||!p.sourceName||!['home','away'].includes(p.side)||!p.identityStatus||typeof p.goals!=='number')throw new Error('Invalid player identity/goals');}
      for(const p of players){for(const [key,value]of Object.entries(p))if(['goals','shots','saves','shotsFaced','goalsConceded','suspensions','sevenMetres','sevenMetreGoals','ordinaryNumerator','ordinaryDenominator','sevenMetreNumerator','sevenMetreDenominator','passErrors','lostBalls','ruleErrors'].includes(key)&&(typeof value!=='number'||!Number.isInteger(value)||value<0))throw new Error('Negative/non-integer player stat');
        if(p.sevenMetreGoals!==undefined&&p.sevenMetreGoals>(p.sevenMetres??-1)||p.shots!==undefined&&p.goals>p.shots||p.saves!==undefined&&p.saves>(p.shotsFaced??-1))throw new Error('Impossible player fraction');
        if(p.denominatorValid===true&&(p.shotsFaced!==p.saves!+p.goalsConceded!))throw new Error('False keeper denominator validity');}
      if(reconcile)for(const side of ['home','away']as const)if(players.filter(p=>p.side===side).reduce((n,p)=>n+p.goals,0)!==m[`${side}Goals`])throw new Error('Player goal sum mismatch');
    };
    if(m.protocol){validatePlayers(m.protocol.players,true);for(const row of Object.values(m.protocol.teamStats))if(row.sevenMetreGoals>row.sevenMetres||Object.values(row).some(n=>!Number.isInteger(n)||n<0))throw new Error('Invalid protocol rules');}
    if(m.pdf)validatePlayers(m.pdf.players,!m.pdf.issues.some(i=>i.kind==='PDF_PLAYER_GOAL_SUM_MISMATCH'));
  }
  if(x.matches.length>x.expectedMatches)throw new Error('Coverage exceeds declared schedule');
  return structuredClone(x);
}
export function deriveProfile(raw:EmpiricalDataset) {
  const data=validateDataset(raw),samples=new Map<string,{metric:string;scope:string;values:number[];matchIds:Set<string>;events:number;tier:Evidence['tier'];transformations:string[]}>();
  const add=(metric:string,scope:string,value:number|null,m:EmpiricalMatch,n=1,tier:Evidence['tier']='D',transformations:string[]=[])=>{
    if(value===null)return;const key=metric+':'+scope,held=samples.get(key)??{metric,scope,values:[],matchIds:new Set<string>(),events:0,tier,transformations};held.values.push(value);held.matchIds.add(m.id);held.events+=n;samples.set(key,held);
  };
  const keeperRows:{matchId:string;teamId:string;player:EmpiricalPlayer}[]=[],teams=new Map<string,{id:string;name:string;goalsFor:number[];goalsAgainst:number[];matches:number}>();
  for(const m of data.matches){
    const total=m.homeGoals+m.awayGoals;add('goals','MATCH',total,m);add('margin','MATCH',Math.abs(m.homeGoals-m.awayGoals),m);add('homeGoals','MATCH',m.homeGoals,m);add('awayGoals','MATCH',m.awayGoals,m);
    for(const side of ['home','away']as const){add('goalsPerTeam','TEAM',m[`${side}Goals`],m);const t=teams.get(m[side].id)??{id:m[side].id,name:m[side].sourceName,goalsFor:[],goalsAgainst:[],matches:0};t.goalsFor.push(m[`${side}Goals`]);t.goalsAgainst.push(m[side==='home'?'awayGoals':'homeGoals']);t.matches++;teams.set(t.id,t);}
    const pdfGood=m.pdf&&!m.pdf.issues.some(i=>i.kind==='PDF_PLAYER_GOAL_SUM_MISMATCH'),players=m.protocol?.players??(pdfGood?m.pdf!.players:undefined);
    if(players)for(const side of ['home','away']as const){const values=players.filter(p=>p.side===side).map(p=>p.goals),goals=m[`${side}Goals`];add('scorerConcentration','TEAM',ratio(Math.max(0,...values),goals),m,goals);add('scorerHHI','TEAM',goals?values.reduce((n,g)=>n+(g/goals)**2,0):null,m,goals);}
    if(m.protocol){const a=m.protocol.teamStats.home,b=m.protocol.teamStats.away;add('sevenMetres','MATCH',a.sevenMetres+b.sevenMetres,m);add('sevenMetreConversion','MATCH',ratio(a.sevenMetreGoals+b.sevenMetreGoals,a.sevenMetres+b.sevenMetres),m,a.sevenMetres+b.sevenMetres);add('suspensions','MATCH',a.suspensions+b.suspensions,m);}
    else if(pdfGood){const field=m.pdf!.players.filter(p=>p.position!=='MV'),attempts=field.reduce((n,p)=>n+p.sevenMetres!,0);add('sevenMetres','MATCH',attempts,m,1,'C');add('sevenMetreConversion','MATCH',ratio(field.reduce((n,p)=>n+p.sevenMetreGoals!,0),attempts),m,attempts,'C');add('suspensions','MATCH',m.pdf!.players.reduce((n,p)=>n+p.suspensions,0),m,1,'C');}
    if(pdfGood){const field=m.pdf!.players.filter(p=>p.position!=='MV'),shots=field.reduce((n,p)=>n+p.shots!,0);
      const penaltyGoals=field.reduce((n,p)=>n+(p.sevenMetreGoals??0),0),penaltySaves=m.pdf!.players.filter(p=>p.position==='MV').reduce((n,p)=>n+(p.sevenMetreNumerator??0),0);
      add('savePct','CATEGORY:SEVEN_METRE',ratio(penaltySaves,penaltySaves+penaltyGoals),m,penaltySaves+penaltyGoals,'C',['7m saves / (7m saves + 7m goals); wide/post attempts excluded; match-level conditional rate']);
      add('outfieldShots','MATCH',shots,m,1,'C',['sum ordinary field player attempts + 7m field player attempts; goalkeeper attempts unavailable']);add('outfieldConversion','MATCH',ratio(field.reduce((n,p)=>n+p.goals,0),shots),m,shots,'C');
      add('sourceTechnicalErrors','MATCH',field.reduce((n,p)=>n+(p.passErrors??0)+(p.lostBalls??0)+(p.ruleErrors??0),0),m,1,'C');
      for(const side of ['home','away']as const){const list=field.filter(p=>p.side===side),n=list.reduce((n,p)=>n+p.shots!,0);add('shotConcentration','TEAM',ratio(Math.max(0,...list.map(p=>p.shots!)),n),m,n,'C',['field player shot share; no recorded goalkeeper attempts']);}
    }
    if(m.pdf)for(const p of m.pdf.players.filter(p=>p.position==='MV'&&p.denominatorValid&&p.shotsFaced!>=10)){
      keeperRows.push({matchId:m.id,teamId:m[p.side].id,player:p});const transforms=['ordinary saves + 7m saves; ordinary shots faced + 7m shots faced','require recorded goalsConceded = shotsFaced - saves; minimum 10 on-target shots per keeper-match'];
      add('saves','KEEPER',p.saves!,m,1,'C',transforms);add('shotsFaced','KEEPER',p.shotsFaced!,m,1,'C',transforms);add('savePct','KEEPER',ratio(p.saves!,p.shotsFaced!),m,p.shotsFaced!,'C',transforms);
    }
  }
  const makeEvidence=(parsedMatches:number,tier:Evidence['tier']):Evidence=>({tier,seasonStatus:data.seasonStatus,expectedMatches:data.expectedMatches,foundMatches:data.matches.length,parsedMatches,coverage:parsedMatches/data.expectedMatches,playerObservations:data.matches.reduce((n,m)=>n+(m.protocol?.players.length??m.pdf?.players.length??0),0),keeperObservations:keeperRows.length,missingMetrics:['possessions','possession duration','whistles/free throws','transition','detailed shot context','per-match outfield position']});
  const normalizedHash=digest(data),timestamp=[...data.sources].map(s=>s.retrievedAt).sort().at(-1)!;
  const metrics:ReferenceMetric[]=[...samples.values()].map(s=>{
    const coverage=s.matchIds.size/data.expectedMatches;
    return {metric:s.metric,scope:s.scope,unit:METRICS[s.metric].unit,definition:METRICS[s.metric].denominator,distribution:distribution(s.values),evidence:makeEvidence(s.matchIds.size,s.tier),provenance:{name:'Svenska Handbollförbundet / Profixio'+(s.tier==='C'?' + Handbollsligan / Jilsén System player-statistics PDFs':''),location:data.sourceUrl,collectionMethod:'Public rendered results and protocols; official published player-statistics PDF tables',extractionVersion:data.parserVersion,timestamp,confidence:coverage>=.9?'HIGH':coverage>=.5?'MEDIUM':'LOW',matches:s.matchIds.size,events:s.events,coverage,sourceHashes:[...new Set(data.sources.map(s=>s.sha256))],normalizedHash,notes:['Regular season only; no playoff or cross-season blending','Scope '+s.scope+'; values are descriptive match/keeper-match observations']},transformations:['deduplicate using official source match ID','sample SD; linearly interpolated quantiles',...s.transformations]};
  });
  const dates=data.matches.map(m=>m.date??m.pdf?.date).filter((d):d is string=>!!d).sort();
  const profile=ingestReference({schemaVersion:SCHEMA_VERSION,id:`SE:${data.competition}:${data.season}:regular`,version:'empirical-sweden/1',kind:'REAL_WORLD_REFERENCE',sport:'handball',country:data.country,competition:data.competition,category:data.category,season:data.season,dateRange:dates.length?{start:dates[0],end:dates.at(-1)!}:undefined,metrics,notes:[data.name,'Regular-season environment; season status and metric-specific coverage remain explicit'],evidence:makeEvidence(data.matches.length,keeperRows.length?'C':'D')});
  const baseline=profile.metrics.find(m=>m.metric==='goalsPerTeam')!.distribution.mean!;
  return {profile,normalizedHash,profileHash:digest(profile),teams:[...teams.values()].map(t=>({...t,goalsFor:distribution(t.goalsFor),goalsAgainst:distribution(t.goalsAgainst),attackDeviation:t.goalsFor.reduce((a,b)=>a+b,0)/t.matches-baseline,defenceDeviation:t.goalsAgainst.reduce((a,b)=>a+b,0)/t.matches-baseline,model:'Whole-season descriptive deviation; no future-match prediction claim',status:t.matches>=10?'SUFFICIENT_SAMPLE':'INSUFFICIENT_SAMPLE'})),keeperRows,quality:{expected:data.expectedMatches,found:data.matches.length,coverage:data.matches.length/data.expectedMatches,protocols:data.matches.filter(m=>m.protocol).length,pdfs:data.matches.filter(m=>m.pdf).length,keeperMatches:keeperRows.length,rejected:data.matches.filter(m=>m.qualityIssues.length).map(m=>({id:m.id,issues:m.qualityIssues})),pdfIssues:data.matches.filter(m=>m.pdf?.issues.length).map(m=>({id:m.id,issues:m.pdf!.issues})),duplicates:data.duplicates,unresolvedPlayers:'Protocol IDs remain source identities; PDF IDs are match-local, never merged by name',unresolvedPositions:true}};
}
