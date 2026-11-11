import { renewPlayerContract } from './contractRenewal';
import { retirePlayer } from './playerLifecycle';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { generatePromotionSquads } from './promotionSquads';
import { gameContinuityRules, prepareGameContinuity, hasCompetitionSquad } from '../competition/transition/gameContinuity';
import { migrateCareerState } from './saveMigration';
import { buildInitialMatchSquad } from '../matchPlan/careerSquadBridge';
import { buildDefaultMatchPlan } from '../matchPlan/defaultMatchPlan';

const stock=()=>createNewCareerState('promotion-unit','swe2-tumba');
const club=(s:ReturnType<typeof stock>)=>prepareGameContinuity(s,'2027-03-18').request.evidence!.externalEntrants![0]!.clubId;
test('promotion generation reuses Division 1 ratings, complete positions and contracts; deterministic and persistent',()=>{
 const s=stock(),id=club(s),rules=gameContinuityRules(s.seasonId,s.saveSeed),membership={[id]:'se_division1_norra'},before=JSON.stringify(s);
 const next=generatePromotionSquads(s,membership,rules,'2027-09-01'),players=next.worldSquads[id]!;
 assert.equal(players.length,16);assert.equal(players.filter(p=>p.position==='MV').length,2);
 assert.ok(buildDefaultMatchPlan(buildInitialMatchSquad(players,'next',id)).ok);
 assert.ok(hasCompetitionSquad({...next,gameDate:'2027-09-01'},id));
 assert.ok(players.every(p=>p.dataSource==='MOCK'&&p.generatedOrigin?.kind==='DIVISION2_PROMOTION'&&p.currentAbility>=55&&p.currentAbility<=130&&p.potentialAbility>=p.currentAbility));
 assert.ok(players.every(p=>next.playerContracts[p.id]!.contractEndDate>'2028-05-31'&&next.playerContracts[p.id]!.wageEurPerMonth>0));
 assert.equal(new Set(players.map(p=>p.id)).size,16);assert.deepEqual(generatePromotionSquads(s,membership,rules,'2027-09-01'),next);
 assert.equal(generatePromotionSquads(next,membership,rules,'2027-09-01'),next);
 const loaded=migrateCareerState(JSON.parse(JSON.stringify(next)));assert.deepEqual(loaded.worldSquads,next.worldSquads);assert.deepEqual(loaded.playerContracts,next.playerContracts);
 assert.equal(JSON.stringify(s),before);
});
test('no pool-wide generation, no replacement of existing records, and invalid registration fails without mutation',()=>{
 const s=stock(),id=club(s),rules=gameContinuityRules(s.seasonId,s.saveSeed);
 assert.equal(generatePromotionSquads(s,{[id]:'se_division2_n'},rules,'2027-09-01'),s);
 const next=generatePromotionSquads(s,{[id]:'se_division1_norra'},rules,'2027-09-01');
 const partial={...s,worldSquads:{...s.worldSquads,[id]:next.worldSquads[id]!.slice(0,1)},playerContracts:{...s.playerContracts,[next.worldSquads[id]![0]!.id]:next.playerContracts[next.worldSquads[id]![0]!.id]!}};
 const filled=generatePromotionSquads(partial,{[id]:'se_division1_norra'},rules,'2027-09-01');assert.deepEqual(filled.worldSquads[id]![0],partial.worldSquads[id]![0]);assert.equal(filled.worldSquads[id]!.length,16);
 const broken={...partial,worldSquads:{...partial.worldSquads,other:[...partial.worldSquads[id]!]}};const before=JSON.stringify(broken);assert.throws(()=>generatePromotionSquads(broken,{[id]:'se_division1_norra'},rules,'2027-09-01'));assert.equal(JSON.stringify(broken),before);
});

test('a previously promoted club can be relegated and promoted again without regenerating its persistent squad',()=>{
 const s=stock(),id=club(s),membership={[id]:'se_division1_norra'};
 const promoted=generatePromotionSquads(s,membership,gameContinuityRules(s.seasonId,s.saveSeed),'2027-09-01');
 const relegated={...promoted,seasonId:'2027/28',gameDate:'2028-04-01',competitionMembership:{...promoted.competitionMembership,[id]:'se_division2_n'}};
 const returned=generatePromotionSquads(relegated,membership,gameContinuityRules(relegated.seasonId,relegated.saveSeed),'2028-09-01');
 assert.equal(returned,relegated);assert.deepEqual(returned.worldSquads[id],promoted.worldSquads[id]);
});

test('generated players retain identity/provenance through ordinary contract renewal, retirement and reload',()=>{
 const s=stock(),id=club(s),membership={[id]:'se_division1_norra'};
 const promoted=generatePromotionSquads(s,membership,gameContinuityRules(s.seasonId,s.saveSeed),'2027-09-01');
 const managed={...promoted,playerClubId:id,competitionId:membership[id]!,competitionMembership:membership,gameDate:'2028-04-01'};
 const p=managed.worldSquads[id]!.find(p=>managed.playerContracts[p.id]!.contractEndDate<'2031-05-31')!;assert.ok(p);
 const renewed=renewPlayerContract(managed,p.id,3);assert.ok(renewed.playerContracts[p.id]!.contractEndDate>managed.playerContracts[p.id]!.contractEndDate);
 assert.deepEqual(renewed.worldSquads[id]!.find(x=>x.id===p.id),p);
 const retired=retirePlayer(renewed,p.id,'2028-04-02');const before=JSON.parse(JSON.stringify({...retired,gameDate:'2028-04-03'}));
 const loaded=migrateCareerState(before);assert.deepEqual(loaded.worldSquads,before.worldSquads);assert.deepEqual(loaded.playerContracts,before.playerContracts);
 assert.deepEqual(loaded.worldSquads.retired!.find(x=>x.id===p.id)!.generatedOrigin,p.generatedOrigin);
 assert.ok(!(loaded.worldSquads['']??[]).some(x=>x.id===p.id));
});

test('returning clubs retain currently valid squads and ordinary expiring contracts without forced regeneration',()=>{
 const s=stock(),id=club(s),membership={[id]:'se_division1_norra'};
 const promoted=generatePromotionSquads(s,membership,gameContinuityRules(s.seasonId,s.saveSeed),'2027-09-01');
 const returning={...promoted,seasonId:'2028/29',gameDate:'2029-04-17',competitionMembership:{...promoted.competitionMembership,[id]:'se_division2_n'}};
 assert.ok(hasCompetitionSquad(returning,id));
 const next=generatePromotionSquads(returning,membership,gameContinuityRules(returning.seasonId,returning.saveSeed),'2029-09-01');
 assert.equal(next,returning);assert.deepEqual(next.playerContracts,promoted.playerContracts);assert.deepEqual(next.worldSquads,promoted.worldSquads);
 assert.ok(next.worldSquads[id]!.some(p=>next.playerContracts[p.id]!.contractEndDate<'2029-09-01'));
});
