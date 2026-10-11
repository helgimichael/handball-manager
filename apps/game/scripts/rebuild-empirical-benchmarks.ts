/** Offline only. Regenerates derived profiles without requesting a public service. */
import {readFileSync,writeFileSync,mkdirSync,readdirSync}from'node:fs';
import{resolve,join}from'node:path';
import{deriveProfile,digest,resolveTeam,type EmpiricalDataset}from'../lib/matchBenchmarks/empirical';
import{SCHEMA_VERSION,ingestReference,METRICS,type ReferenceProfile,type ReferenceMetric}from'../lib/matchBenchmarks/reference';
import{distribution,ratio}from'../lib/matchBenchmarks/statistics';
import{CLUBS}from'../lib/game-data/clubs';
import{rebuildPositions}from'./rebuild-empirical-positions';

const root=resolve('../..'),input=join(root,'data/empirical-handball/normalized'),out=join(root,'data/empirical-handball/derived');mkdirSync(out,{recursive:true});
const write=(name:string,x:unknown)=>writeFileSync(join(out,name),JSON.stringify(x,null,2)+'\n');
const aliases:Record<string,string>={'swe-1':'se_handbollsligan_herr'};
const datasets=readdirSync(input).filter(n=>n.endsWith('-2025-26.json')&&!n.includes('player-seasons')).sort().map(name=>{
  const d=JSON.parse(readFileSync(join(input,name),'utf8'))as EmpiricalDataset;const competition=aliases[d.competition]??d.competition;
  return{...d,competition,matches:d.matches.map(m=>({...m,competition}))};
});
const derived=datasets.map(deriveProfile),profiles=derived.map(d=>d.profile);
const sourceOut=join(root,'data/empirical-handball/source-manifests');mkdirSync(sourceOut,{recursive:true});
for(const d of datasets)writeFileSync(join(sourceOut,`${d.competition}-${d.season}.json`),JSON.stringify({schemaVersion:'empirical-source-manifest/1',competition:d.competition,season:d.season,seasonStatus:d.seasonStatus,stage:d.stage,parserVersion:d.parserVersion,expectedMatches:d.expectedMatches,foundMatches:d.matches.length,sourceManifestHash:digest(d.sources),normalizedHash:digest(d),sources:d.sources,policy:'Public GET pages, published PDFs and only the rendered public infinite-scroll action. No signed live-event feed, login, private API or access-control bypass. Raw HTML/PDF buffers remain in the local cache.'},null,2)+'\n');
const normalizedName=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleUpperCase('sv');
const explicitAliases:Record<string,string>={'IFK SKÖVDE':'IFK Skövde HK','ESKILSTUNA GUIF':'Eskilstuna Guif IF','YSTADS IF':'Ystads IF HF','OV HELSINGBORG':'OV Helsingborg HK'};
const mappings=datasets.flatMap(d=>[...new Map(d.matches.flatMap(m=>[m.home,m.away]).map(t=>[t.id,t])).values()].map(team=>{
  const eligibleClubs=d.category==='women-senior'?CLUBS.filter(c=>c.competitionId===d.competition):CLUBS;
  return{sourceTeamId:team.id,sourceName:team.sourceName,competition:d.competition,category:d.category,season:d.season,...resolveTeam(team.sourceName,d.competition,eligibleClubs,explicitAliases),historicalAffiliation:d.competition};
}));
// An explicitly labeled cross-competition proxy, never an exact Allsvenskan keeper profile.
const elite=derived.find(d=>d.profile.competition==='se_handbollsligan_herr');
if(elite?.keeperRows.length){const proxy:ReferenceProfile={...elite.profile,id:'SE:HBL_HERR:2025-26:KEEPER_PROXY',competition:undefined,country:undefined,season:undefined,metrics:elite.profile.metrics.filter(m=>m.scope==='KEEPER'||m.scope==='CATEGORY:SEVEN_METRE').map(m=>({...m,provenance:{...m.provenance,confidence:'MEDIUM',notes:[...m.provenance.notes,'Cross-competition Handbollsligan Herr proxy; not Herrallsvenskan truth']}})),notes:['GLOBAL lookup fallback carrying only Handbollsligan Herr 2025-26 keeper-match and 7m context data','No claim that elite and second-tier keeper environments are equivalent; transfer confidence capped at MEDIUM']};profiles.push(ingestReference(proxy));}
const seasonSummaries:unknown[]=[];
for(const name of readdirSync(input).filter(n=>n.includes('player-seasons'))){
  const d=JSON.parse(readFileSync(join(input,name),'utf8'))as{competition:string;season:string;parserVersion:string;sources:{url:string;retrievedAt:string;sha256:string}[];players:{sourcePlayerId:string;sourceTeamId:string;sourceName:string;position:string;appearances:number;goals:number}[];keepers:{sourcePlayerId:string;saves:number;shotsFaced:number;appearances:number}[]};
  const league=derived.find(p=>p.profile.competition===d.competition);if(!league)continue;
  const players=d.players.filter(p=>p.appearances>=10),keepers=d.keepers.filter(p=>p.appearances>=10&&p.shotsFaced>=100),goals=d.players.reduce((n,p)=>n+p.goals,0),positions=[...new Set(d.players.map(p=>p.position))];
  const extras:ReferenceMetric[]=[];
  const add=(metric:string,scope:string,values:(number|null)[],events:number,notes:string[])=>{
    const base=league.profile.metrics[0];extras.push({metric,scope,unit:METRICS[metric].unit,definition:METRICS[metric].denominator,distribution:distribution(values),provenance:{...base.provenance,name:'Handbollsligan official player-season statistics',location:d.sources.map(s=>s.url).join(' ; '),timestamp:d.sources.map(s=>s.retrievedAt).sort().at(-1)!,extractionVersion:d.parserVersion,sourceHashes:d.sources.map(s=>s.sha256),normalizedHash:digest(d),events,notes,confidence:'MEDIUM'},transformations:notes});
  };
  add('playerGoalsPerAppearance','PLAYER_SEASON',players.map(p=>p.goals/p.appearances),players.reduce((n,p)=>n+p.appearances,0),['player-season observations; minimum 10 appearances; not player-match variance']);
  add('savePct','KEEPER_SEASON',keepers.map(p=>ratio(p.saves,p.shotsFaced)),keepers.reduce((n,p)=>n+p.shotsFaced,0),['ordinary + 7m saves and shots faced; minimum 10 appearances and 100 shots faced','variance across keeper-seasons, never substituted for keeper-match variance']);
  for(const position of positions.filter(p=>['MV','V6','V9','M9','M6','H9','H6'].includes(p)))add('goalShare','POSITION_SEASON:'+position,[ratio(d.players.filter(p=>p.position===position).reduce((n,p)=>n+p.goals,0),goals)],goals,['single pooled season share, N=1 aggregate; no match-level z-score','denominator is all goals recorded in this official player-season table, including unresolved positions']);
  const index=profiles.findIndex(p=>p.id===league.profile.id);profiles[index]=ingestReference({...profiles[index],metrics:[...profiles[index].metrics,...extras]});
  seasonSummaries.push({competition:d.competition,season:d.season,players:d.players.length,qualifyingPlayers:players.length,keepers:d.keepers.length,qualifyingKeepers:keepers.length,goals,positions:Object.fromEntries(positions.map(p=>[p,{players:d.players.filter(r=>r.position===p).length,goals:d.players.filter(r=>r.position===p).reduce((n,r)=>n+r.goals,0),share:ratio(d.players.filter(r=>r.position===p).reduce((n,r)=>n+r.goals,0),goals)}])),keepersSeason:distribution(keepers.map(p=>ratio(p.saves,p.shotsFaced))),sourceHash:digest(d)});
}
write('profiles.json',profiles);write('quality.json',derived.map(d=>({competition:d.profile.competition,...d.quality})));write('team-profiles.json',derived.flatMap(d=>d.teams.map(t=>({competition:d.profile.competition,season:d.profile.season,...t}))));write('team-mapping.json',mappings);write('keeper-matches.json',derived.flatMap(d=>d.keeperRows.map(r=>({competition:d.profile.competition,season:d.profile.season,...r}))));write('player-season-summaries.json',seasonSummaries);
write('league-outcomes.json',datasets.map(d=>({competition:d.competition,season:d.season,n:d.matches.length,homeWins:d.matches.filter(m=>m.homeGoals>m.awayGoals).length,draws:d.matches.filter(m=>m.homeGoals===m.awayGoals).length,awayWins:d.matches.filter(m=>m.homeGoals<m.awayGoals).length,homeWinRate:ratio(d.matches.filter(m=>m.homeGoals>m.awayGoals).length,d.matches.length),drawRate:ratio(d.matches.filter(m=>m.homeGoals===m.awayGoals).length,d.matches.length),awayWinRate:ratio(d.matches.filter(m=>m.homeGoals<m.awayGoals).length,d.matches.length),definition:'Count and share of official completed regular-season full-time results; no playoff or penalty-shootout outcomes mixed',sourceManifestHash:digest(d.sources),normalizedHash:digest(d)})));
write('manifest.json',{schemaVersion:SCHEMA_VERSION,normalized:derived.map(d=>({competition:d.profile.competition,hash:d.normalizedHash})),profiles:profiles.map(p=>({id:p.id,version:p.version,hash:digest(p)})),regeneration:'node --import tsx scripts/rebuild-empirical-benchmarks.ts (from apps/game)',network:false});
console.log(JSON.stringify({profiles:profiles.length,competitions:datasets.length,out}));
rebuildPositions();
