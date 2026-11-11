import test from 'node:test';
import assert from 'node:assert/strict';
import { SWEDISH_COMPETITION_DATA as data, previewSwedishDataCompletion } from './swedenDataCompletion';
import { SWEDISH_2026_RULES as rules } from './sweden2026';
import { previewSeasonTransition } from './preview';
import { canonicalCompetitionClubs } from './careerSnapshot';
import { createNewCareerState } from '../../career/newCareer';
import { buildNewSeasonCalendar } from '../seasonCalendar';
import { validateCupCalendar } from '../cupSchedule';
import { ALLSVENSKAN, HANDBOLLSLIGAN, SVENSKA_CUPEN } from '../rules';
import { attemptSeasonTransition } from '../../career/seasonTransition';

test('provider registrations never conflate reserve clubs or supply future winners', () => {
 const refs=data.division2Registrations.flatMap(r=>r.registrations.map(t=>t.sourceUrl));assert.equal(new Set(refs).size,54);
 for(const r of data.division2Registrations){assert.equal(r.registrations.length,r.registeredCount);for(const t of r.registrations){assert.match(t.sourceUrl,new RegExp(`/teams/${t.sourceTeamId}$`));assert.equal(t.canonicalClubId === null,t.sourceTeamId === '1577093');assert.equal(t.canonicalMappingStatus,t.sourceTeamId === '1577093' ? 'AMBIGUOUS_SENIOR_RESERVE' : 'RESOLVED_SOURCE_REGISTRATION')}}
 assert.ok(data.division2Registrations.find(r=>r.district==='o')!.registrations.some(t=>t.name==='Tumba HK'));
 assert.ok(data.division2Registrations.find(r=>r.district==='s')!.registrations.some(t=>t.name==='HF Karlskrona U'));
 assert.deepEqual(data.division2Registrations.map(r=>r.registeredCount),[7,12,10,12,13]);assert.equal(rules.entries.filter(e=>e.selector.kind==='EXTERNAL').length,12);
});
test('current rule provenance and confirmed fees cannot unlock an unverified next-season profile',()=>{
 for(const e of rules.entries){assert.equal(e.source.seasonId,'2026/27');assert.equal(e.source.verifiedOn,'2026-11-10');assert.equal(e.source.verification,'VERIFIED')}
 assert.equal(data.nextSeason.profile,null);assert.equal(data.nextSeason.rulesStatus,'UNVERIFIED');assert.equal(data.nextSeason.calendarStatus,'UNVERIFIED');assert.deepEqual(Object.values(data.nextSeason.entryFeesSEK),[54000,32000,22000,22000]);assert.equal(data.nextSeason.applyFeesToCareer,false);assert.equal(rules.stages.find(s=>s.id==='d1-n-semi-10')!.homeOrder,null);
});
test('completion view reuses the exact planner and separates future sport, unverified rules and administration',()=>{
 const input={seasonId:rules.seasonId,rules,clubs:canonicalCompetitionClubs(),standings:[]},before=JSON.stringify(input),report=previewSwedishDataCompletion(input);
 assert.deepEqual(report.preview,previewSeasonTransition(input));assert.equal(report.preview.canGenerateNextSeason,false);assert.equal(report.boundaryPorts.length,12);assert.ok(report.boundaryPorts.every(p=>p.suppliedCanonicalClubId===null&&!p.canInferEntrantFromRegistration));
 for(const [id,category] of [['DISTRICT_SPORTING_OUTCOMES','A'],['NORRA_10_HOME_PRIORITY','B'],['GEOGRAPHIC_ALLOCATION','C'],['CLUB_ELIGIBILITY','C']])assert.equal(report.requirements.find(r=>r.id===id)!.category,category);
 assert.equal(JSON.stringify(input),before);assert.deepEqual(previewSwedishDataCompletion(JSON.parse(JSON.stringify(input))),report);
});
test('explicit league set retains fixed cup slots without adding uncovered calendars or unlocking official rollover',()=>{
 const state=createNewCareerState('m12f-calendar','swe2-tumba');const next=buildNewSeasonCalendar({...state,seasonId:'2027/28'},'2027-09-20',[HANDBOLLSLIGAN,ALLSVENSKAN]);assert.equal(next.fixtures.filter(f=>f.type==='LEAGUE').length,364);assert.ok(next.fixtures.filter(f=>f.type==='LEAGUE').every(f=>[HANDBOLLSLIGAN,ALLSVENSKAN].includes(f.competitionId)));assert.equal(next.fixtures.filter(f=>f.competitionId===SVENSKA_CUPEN).length,32);validateCupCalendar(next);
 const input={...state,seasonComplete:true},before=JSON.stringify(input),result=attemptSeasonTransition(input);assert.equal(result.status,'BLOCKED');assert.equal(result.state,input);assert.equal(JSON.stringify(input),before);
});
