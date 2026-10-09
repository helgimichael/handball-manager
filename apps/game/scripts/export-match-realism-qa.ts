/** Developer-only export of exact sampled career matches, using canonical V2. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createNewCareerState } from '../lib/career/newCareer';
import { buildMatchdayReadyEvent } from '../lib/career/careerEvents';
import { advanceProductionMatch, archiveFrames, finalizeProductionMatch, resultFromSession, startProductionMatch } from '../lib/career/productionMatch';
import type { CareerFixture, CareerState } from '../lib/career/types';
import type { CareerSave } from '../lib/save/saveRepository';
import type { PlayerMock } from '../lib/game-data';
import type { GameplayPlayerRating } from '../lib/gameWorld/gameplayRatingSnapshot';
import type { FastMatchResult } from '@handball-manager/game-simulation';

type Inputs={competitionId:string;clubs:string[];worldSquads:Record<string,PlayerMock[]>;gameplayRatings:Record<string,GameplayPlayerRating[]>};
type Recipe={index:number;saveSeed:string;managerClubId:string};
type Selection=Recipe&{purpose:string;canonicalSeed:number;fixture:CareerFixture;homeName:string;awayName:string;selection:string;inspect:string};
type RecordedMatch=Recipe&{canonicalSeed:number;fixture:CareerFixture;complete:boolean;truthHash:string;initialSessionHash:string;finalCoreHash:string;resultHash:string;result:FastMatchResult};
const args=process.argv.slice(2);
const option=(key:string,fallback:string)=>{const at=args.indexOf(key);if(at<0)return fallback;if(!args[at+1]||args[at+1].startsWith('--'))throw new Error(`Missing value for ${key}`);return args[at+1];};
const after=resolve(option('--after','../../docs/match-realism-v2/after'));
const baseline=resolve(option('--baseline','../../docs/match-realism-v2/baseline'));
const output=resolve(option('--out','../../docs/match-realism-v2/human-qa'));
const inputPath=resolve(option('--inputs',join(baseline,'inputs.json')));
const primarySelection=join(after,'human-qa-matches.json');
const selectionPath=resolve(option('--selections',existsSync(primarySelection)?primarySelection:join(dirname(after),'human-qa-matches.json')));
const base=option('--url','http://localhost:3008').replace(/\/$/,'');
const read=<T>(path:string):T=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,'')) as T;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same=(actual:unknown,expected:unknown,label:string)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(`${label} differs from the recorded AFTER match`);};
const inputs=read<Inputs>(inputPath),selections=read<Selection[]>(selectionPath);
const afterRecipes=read<Recipe[]>(join(after,'seed-set.json')),beforeRecipes=read<Recipe[]>(join(baseline,'seed-set.json'));
const aggregate=read<{inputsHash:string;sourceFingerprintsStableDuringBatch:boolean}>(join(after,'aggregate.json'));
if(!aggregate.sourceFingerprintsStableDuringBatch)throw new Error('AFTER source changed during its sample');
same(hash(inputs),aggregate.inputsHash,'Pinned input snapshot');
if(selections.length!==3||new Set(selections.map(s=>s.index)).size!==3)throw new Error('Expected three distinct automatically selected Human QA cases');

function envelope(career:CareerState,selection:Selection,phase:'initial'|'completed'):CareerSave{
  const date=`${selection.fixture.date}T12:00:00.000Z`;
  return {saveId:`hm-realism-v2-${selection.index}-${phase}`,schemaVersion:8,selectedNations:['SWE'],selectedCompetitionIds:[inputs.competitionId],
    clubId:selection.managerClubId,manager:{name:`Realism QA · ${selection.purpose}`,nationality:'SWE',dateOfBirth:'1985-02-01'},
    gameDate:career.gameDate,createdAt:date,lastPlayedAt:date,
    // Inline archives are supported by getSave when no external archive ids
    // are present. Normal subsequent saves move them to the archive database.
    careerState:{...career,matchArchiveIds:undefined}};
}
mkdirSync(output,{recursive:true});
const manifestCases=[];
for(const selection of selections){
  const recipe=afterRecipes.find(r=>r.index===selection.index),baselineRecipe=beforeRecipes.find(r=>r.index===selection.index);
  if(!recipe||!baselineRecipe)throw new Error(`Missing recipe ${selection.index}`);
  same(recipe,baselineRecipe,`Paired recipe ${selection.index}`);
  same({index:selection.index,saveSeed:selection.saveSeed,managerClubId:selection.managerClubId},recipe,`Selected recipe ${selection.index}`);
  const recorded=read<RecordedMatch>(join(after,`match-${String(selection.index).padStart(3,'0')}.json`));
  if(!recorded.complete)throw new Error(`Selected match ${selection.index} is incomplete`);
  let career=createNewCareerState(recipe.saveSeed,recipe.managerClubId,structuredClone(inputs.worldSquads),undefined,structuredClone(inputs.gameplayRatings));
  const fixture=career.fixtures.find(f=>f.type==='LEAGUE'&&(f.homeClubId===recipe.managerClubId||f.awayClubId===recipe.managerClubId));
  if(!fixture)throw new Error(`No canonical league fixture for ${recipe.managerClubId}`);
  same(fixture,recorded.fixture,'Canonical fixture');same(fixture,selection.fixture,'Selected fixture');
  career={...career,gameDate:fixture.date,careerEvents:[buildMatchdayReadyEvent(fixture.id,fixture.date)]};
  career=startProductionMatch(career,fixture.id);
  if(!career.productionMatch)throw new Error('Canonical match start refused');
  const initial=career,initialSession=career.productionMatch;
  const initialSessionHash=hash({fixture:initialSession.fixture,core:initialSession.core,people:initialSession.people});
  same(initialSessionHash,recorded.initialSessionHash,'Initial session hash');
  same(initialSession.core.seed,recorded.canonicalSeed,'Canonical seed');same(initialSession.core.seed,selection.canonicalSeed,'Selected seed');
  let calls=0;
  while(career.productionMatch!.core.status==='RUNNING'&&calls++<40)career=advanceProductionMatch(career,10000,false);
  const session=career.productionMatch!,core=session.core;
  if(core.match?.phase!=='FULLTIME')throw new Error(`Match ${selection.index} did not finish: ${core.status} ${core.reason}`);
  const result=resultFromSession(session);
  const truthHash=hash({score:core.score,events:core.events,rng:core.rng,frames:session.frames});
  const finalCoreHash=hash(core),resultHash=hash(result);
  same(truthHash,recorded.truthHash,'Score/events/RNG/observed frames truth hash');
  same(finalCoreHash,recorded.finalCoreHash,'Full final core hash');same(resultHash,recorded.resultHash,'Result hash');same(result,recorded.result,'Derived result');
  const completed=finalizeProductionMatch(career),archive=completed.matchArchives?.[fixture.id];
  if(!archive||completed.productionMatch)throw new Error('Canonical finalization did not produce a completed archived career');
  same(archive.result,result,'Archive result');same(hash(archiveFrames(archive)),hash(session.frames),'Lossless archived frames');
  same(completed.results[fixture.id],result,'Career committed result');
  const again=finalizeProductionMatch(completed);same(again.playerSeasonStats,completed.playerSeasonStats,'Exactly-once career statistics');
  const initialName=`match-${String(selection.index).padStart(3,'0')}-initial.json`,completedName=`match-${String(selection.index).padStart(3,'0')}-completed.json`;
  const initialSave=envelope(initial,selection,'initial'),completedSave=envelope(completed,selection,'completed');
  writeFileSync(join(output,initialName),JSON.stringify(initialSave)+'\n');writeFileSync(join(output,completedName),JSON.stringify(completedSave)+'\n');
  manifestCases.push({purpose:selection.purpose,index:selection.index,saveSeed:recipe.saveSeed,canonicalSeed:core.seed,fixture,
    homeName:selection.homeName,awayName:selection.awayName,score:{...core.score},selection:selection.selection,inspect:selection.inspect,
    initialFile:initialName,completedFile:completedName,initialSaveId:initialSave.saveId,completedSaveId:completedSave.saveId,
    initialSessionHash,finalCoreHash,resultHash,truthHash,archiveHash:hash(archive),framesHash:hash(session.frames),frameCount:session.frames.length,
    resultUrl:`${base}/career/match-report/${fixture.id}`,replayUrl:`${base}/career/match-day/${fixture.id}`,
    verifiedAgainstRecordedAfter:true});
  console.log(JSON.stringify({index:selection.index,purpose:selection.purpose,score:core.score,truthIdentical:true}));
}
writeFileSync(join(output,'manifest.json'),JSON.stringify({format:1,createdAt:new Date().toISOString(),inputPath,inputHash:hash(inputs),selectionPath,
  provenance:'Pinned real-career input and AFTER seed recipes; canonical start/continuation/result/finalization; exact initial/final/result/truth hashes validated before export.',
  saveSchema:8,cases:manifestCases},null,2)+'\n');
