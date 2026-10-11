import type { CalibrationDiagnostics } from '../../scripts/lib/calibrationDiagnostics';
import type { ProductionMatchSession, resultFromSession } from '../career/productionMatch';
import type { Observation } from './evaluate';
import { distribution,ratio,wilson } from './statistics';
type Diagnostics=ReturnType<CalibrationDiagnostics['report']>;
type Shot=Diagnostics['shots'][number];
type Result=ReturnType<typeof resultFromSession>;
const position:Record<string,string>={GK:'MV',LW:'V6',LB:'V9',CB:'M9',P:'M6',P2:'M6',RB:'H9',RW:'H6'};
const numericFeatures=(x:unknown,prefix:string):Record<string,number>=>x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)).map(([k,v])=>[`${prefix}.${k}`,v as number])):{};
export function summarizeShots(shots:readonly Shot[]) {
  const goals=shots.filter(s=>s.goal).length,saves=shots.filter(s=>s.saved).length,n=goals+saves;
  return {attempts:shots.length,goals,saves,shotsFaced:n,savePct:ratio(saves,n),conversion:ratio(goals,shots.length),saveInterval:wilson(saves,n),
    pressure:distribution(shots.map(s=>s.pressure)),quality:distribution(shots.map(s=>s.quality)),opportunityQuality:distribution(shots.map(s=>s.opportunityQuality)),distance:distribution(shots.map(s=>s.distance)),angle:distribution(shots.map(s=>s.angle)),blockThreat:distribution(shots.map(s=>s.blockThreat))};
}
export function extract(session:ProductionMatchSession,diagnostics:Diagnostics,result:Result) {
  const observations:Observation[]=[],shots=diagnostics.shots,terminals=diagnostics.terminals,goals=result.homeGoals+result.awayGoals,contact=diagnostics.contact;
  const add=(metric:string,value:number|null,n=1,scope='MATCH',features?:Record<string,number>)=>observations.push({metric,value,n,scope,features});
  const all=summarizeShots(shots);
  const totals={goals,possessions:terminals.length,shots:shots.length,saves:all.saves,shotsFaced:all.shotsFaced,conversion:all.conversion,savePct:all.savePct,goalsPerPossession:ratio(goals,terminals.length),turnovers:result.homeStats.turnovers+result.awayStats.turnovers,
    technicalErrors:terminals.filter(t=>t.ending==='TECHNICAL_VIOLATION').length,offensiveFouls:terminals.filter(t=>t.ending==='OFFENSIVE_FOUL').length,
    sevenMetres:result.homeStats.sevenMetreAttempts+result.awayStats.sevenMetreAttempts,sevenMetreConversion:ratio(result.homeStats.sevenMetreGoals+result.awayStats.sevenMetreGoals,result.homeStats.sevenMetreAttempts+result.awayStats.sevenMetreAttempts),suspensions:result.homeStats.twoMinuteSuspensions+result.awayStats.twoMinuteSuspensions,
    contacts:contact.physicalContacts,assessedFouls:contact.assessedFouls,advantages:contact.advantagesPending,whistles:contact.contactWhistles,freeThrows:contact.freeThrowAwards,possessionSeconds:distribution(terminals.map(t=>t.officialSeconds)).mean,
    transitionPossessions:diagnostics.transition.distinctPossessions,transitionAttempts:diagnostics.transition.starts,transitionShots:diagnostics.transition.shots,transitionGoals:diagnostics.transition.goals,transitionConversion:diagnostics.transition.conversion,transitionRate:ratio(diagnostics.transition.distinctPossessions,terminals.length)};
  for(const [metric,value]of Object.entries(totals))add(metric,value,metric==='savePct'?all.shotsFaced:metric==='conversion'?all.attempts:metric==='goalsPerPossession'||metric==='possessionSeconds'||metric==='transitionRate'?terminals.length:metric==='sevenMetreConversion'?totals.sevenMetres:metric==='transitionConversion'?totals.transitionShots:1);
  const groups:Record<string,Shot[]>={};const put=(key:string,s:Shot)=>(groups[key]??=[]).push(s);
  for(const s of shots){put(`CATEGORY:${s.kind}`,s);put(`POSITION:${position[s.role]??s.role}`,s);put(`PRESSURE:${s.pressure<.2?'LOW_UNDER_0.2':'PRESENT_AT_LEAST_0.2'}`,s);put(`QUALITY:${s.quality>=.65?'HIGH_AT_LEAST_0.65':'LOWER_UNDER_0.65'}`,s);put(`PHASE:${s.phase}`,s);put(`DISTANCE:${s.distance<=8?'UP_TO_8M':s.distance<=10.5?'8_TO_10.5M':'BEYOND_10.5M'}`,s);if(s.areaClearance<=1.5&&s.kind!=='SEVEN_METRE')put('CONTEXT:NEAR_SIX_METRE_AREA',s);}
  const shotGroups=Object.fromEntries(Object.entries(groups).map(([scope,list])=>{
    const g=summarizeShots(list);add('conversion',g.conversion,list.length,scope);add('savePct',g.savePct,g.shotsFaced,scope);add('shotShare',ratio(list.length,shots.length),shots.length,scope);add('goalShare',ratio(g.goals,goals),goals,scope);
    for(const metric of ['pressure','quality','distance','angle','blockThreat']as const)add(metric,g[metric].mean,list.length,scope);
    return [scope,g];
  }));
  const keeperIds=[...new Set(shots.map(s=>s.keeper&&typeof s.keeper==='object'&&'id'in s.keeper?String(s.keeper.id):'UNATTRIBUTED'))];
  const keepers=keeperIds.map(id=>{
    const list=shots.filter(s=>(s.keeper&&typeof s.keeper==='object'&&'id'in s.keeper?String(s.keeper.id):'UNATTRIBUTED')===id),summary=summarizeShots(list);
    const features:Record<string,number>={};for(const s of list){if(s.keeper&&typeof s.keeper==='object'&&'profile'in s.keeper)for(const[k,v]of Object.entries(numericFeatures(s.keeper.profile,'keeper')))features[k]=(features[k]??0)+v/list.length;for(const[k,v]of Object.entries(numericFeatures(s.capabilities,'shooter')))features[k]=(features[k]??0)+v/list.length;}
    Object.assign(features,{'shot.pressure':summary.pressure.mean??0,'shot.quality':summary.quality.mean??0,'shot.distance':summary.distance.mean??0});
    if(id!=='UNATTRIBUTED')add('savePct',summary.savePct,summary.shotsFaced,'KEEPER',features);
    const byContext:Record<string,ReturnType<typeof summarizeShots>>={};
    for(const key of Object.keys(groups).filter(k=>!k.startsWith('POSITION:'))){const group=summarizeShots(list.filter(s=>groups[key].includes(s)));if(group.attempts)byContext[key]=group;}
    return {id,...summary,features,byContext,shots:list.map(s=>({category:s.kind,saved:s.saved,goal:s.goal,pressure:s.pressure,quality:s.quality,distance:s.distance,angle:s.angle,blockThreat:s.blockThreat,phase:s.phase,energy:s.energy,capabilities:s.capabilities,keeper:s.keeper,execution:s.execution})),
      diagnosis:['Raw saves = on-target volume × save rate.',`Attributed released attempts ${list.length}; on-target ${summary.shotsFaced}; saves ${summary.saves}.`,'Pressure, quality, capability and category values describe engine output. Without empirical conditional references they cannot establish an engine anomaly or real-world plausibility.']};
  });
  const players=session.core.players.map(p=>{
    const list=shots.filter(s=>s.actorId===p.id),g=summarizeShots(list),teamShots=shots.filter(s=>s.team===p.team),teamGoals=teamShots.filter(s=>s.goal).length;
    const contribution=(p.team==='HOME'?result.homePlayerContributions:result.awayPlayerContributions).find(c=>c.playerId===p.id);
    const features={...numericFeatures(p.profile,'player'),'context.home':p.team==='HOME'?1:0,'context.energy':p.condition.energy};
    add('conversion',g.conversion,list.length,`PLAYER:${position[p.role]??p.role}`,features);add('minutes',p.condition.courtMs/60000,1,`PLAYER:${position[p.role]??p.role}`,features);
    return {id:p.id,team:p.team,position:position[p.role]??p.role,minutes:p.condition.courtMs/60000,energy:p.condition.energy,...g,shotShare:ratio(list.length,teamShots.length),goalShare:ratio(g.goals,teamGoals),features,contribution:contribution??null};
  });
  const teams=(['HOME','AWAY']as const).map(team=>{
    const list=shots.filter(s=>s.team===team),g=summarizeShots(list),people=players.filter(p=>p.team===team),pos=terminals.filter(t=>t.team===team).length;
    const scorerConcentration=ratio(Math.max(0,...people.map(p=>p.goals)),g.goals),shotConcentration=ratio(Math.max(0,...people.map(p=>p.attempts)),list.length),scorerHHI=g.goals?people.reduce((sum,p)=>sum+(p.goals/g.goals)**2,0):null;
    const court=people.filter(p=>p.minutes>0&&p.position!=='MV'),features:Record<string,number>={'context.home':team==='HOME'?1:0,'context.energy':court.length?court.reduce((n,p)=>n+p.energy,0)/court.length:0};
    for(const p of court)for(const[k,v]of Object.entries(p.features))if(k.startsWith('player.'))features[k.replace('player.','team.')]=(features[k.replace('player.','team.')]??0)+v/court.length;
    add('goalsPerTeam',g.goals,1,'TEAM',features);add('possessionsPerTeam',pos,1,'TEAM',features);add('shotsPerTeam',list.length,1,'TEAM',features);add('scorerConcentration',scorerConcentration,g.goals,'TEAM',features);add('shotConcentration',shotConcentration,list.length,'TEAM',features);add('scorerHHI',scorerHHI,g.goals,'TEAM',features);
    return {team,...g,possessions:pos,scorerConcentration,shotConcentration,scorerHHI,features};
  });
  const context={fixture:session.fixture,tactics:session.core.coaching,lineup:session.people,players:players.map(p=>({id:p.id,minutes:p.minutes,energy:p.energy})),score:session.core.score};
  return {observations,totals,teams,shotGroups,keepers,players,context,possessionDistribution:distribution(terminals.map(t=>t.officialSeconds)),unsupported:['assists/created chances without verified canonical definition','M6 receptions and penalties won attribution','historical empirical team strength','defender proximity at release (not retained by current diagnostics)','score/manpower at each shot (not retained by current diagnostics)']};
}
