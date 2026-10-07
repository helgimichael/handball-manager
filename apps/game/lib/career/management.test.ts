import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { getCareerSquad } from './careerWorld';
import { managementAttention, managementPlayers, searchManagement, syncManagementInbox, squadEnergy } from './management';
import { renewPlayerContract } from './contractRenewal';
import { markMessageRead, archiveMessage } from './inboxActions';
import { addToShortlist } from './recruitment';
import { migrateCareerState } from './saveMigration';
import { resolveDestinationHref } from './destinations';
import { createMemoryBackend } from '../save/saveStorage';
import { createSave, getSave, saveCareerState, __setSaveBackendForTests } from '../save/saveRepository';

function ready() {
  const state = createNewCareerState('management-experience', 'swe2-tumba');
  const player = getCareerSquad(state)[0];
  return { state: { ...state, playerContracts: { ...state.playerContracts, [player.id]: { playerId: player.id, clubId: state.playerClubId, contractEndDate: '2027-05-31', wageEurPerMonth: 500 } } }, player };
}
test('contract awareness is idempotent, respects read/archive and resolves after a real renewal', () => {
  const { state, player } = ready();
  let synced = syncManagementInbox(state);
  const message = synced.inbox.find(m => m.id.startsWith(`management-contract:${player.id}:`))!;
  assert.ok(message);
  assert.equal(resolveDestinationHref(message.destinations![0]), `/career/squad/${player.id}`);
  assert.equal(syncManagementInbox(synced), synced);
  synced = archiveMessage(markMessageRead(synced, message.id), message.id);
  assert.equal(syncManagementInbox(synced), synced);
  synced = syncManagementInbox(renewPlayerContract(synced, player.id, 3));
  assert.equal(synced.inbox.find(m => m.id === message.id)?.resolved, true);
  assert.equal(synced.inbox.find(m => m.id === message.id)?.read, true);
  assert.equal(synced.inbox.find(m => m.id === message.id)?.archived, true);
  assert.ok(!managementAttention(synced).contracts.some(r => r.player.id === player.id));
});
test('search links canonical players, own club and competition without duplicates', () => {
  const { state, player } = ready();
  assert.equal(managementPlayers(state).filter(p => p.id === player.id).length,1);
  const results = searchManagement(state,player.lastName);
  assert.ok(results.some(r => r.href === `/career/squad/${player.id}`));
  assert.ok(searchManagement(state,'Tumba').some(r => r.href === '/career/club'));
  assert.ok(searchManagement(state,'Allsvenskan').some(r => r.href === '/career/competitions/swe-2'));
  assert.deepEqual(searchManagement(state,'a'),[]);
  assert.equal(resolveDestinationHref({ route:'COMPETITION', competitionId:'swe-2' }),'/career/competitions/swe-2');
});
test('a season rollover cannot dismiss an unresolved contract risk and urgency follows the date', () => {
  const { state, player } = ready();
  const synced = syncManagementInbox(state);
  const id = `management-contract:${player.id}:2027-05-31`;
  const rolled = { ...synced, gameDate:'2027-03-01', inbox:synced.inbox.map(m => ({...m,resolved:true,read:true})) };
  const next = syncManagementInbox(rolled);
  assert.equal(next.inbox.find(m => m.id === id)?.resolved,false);
  assert.equal(next.inbox.find(m => m.id === id)?.important,true);
  assert.equal(next.inbox.find(m => m.id === id)?.read,true);
  assert.equal(syncManagementInbox(next),next);
});
test('condition uses live physical state', () => {
  const { state, player } = ready();
  const tired = { ...state, playerPhysicalState: { ...state.playerPhysicalState,[player.id]: { playerId:player.id,currentEnergy:42,recentLoad:20,lastUpdatedDate:state.gameDate } } };
  assert.equal(squadEnergy(tired,player),42);
  assert.ok(managementAttention(tired).tired.some(p => p.id === player.id));
});
test('transfer outcomes generate one linked notification per real outcome and preserve read state', () => {
  const { state, player } = ready();
  const offer = { id:'qa-0', dealType:'PERMANENT' as const, playerId:player.id, fromClubId:'swe2-drott', toClubId:state.playerClubId, transferFeeEur:1000, trainingCompensationEur:0, newWageEurPerMonth:500, newContractEndDate:'2029-05-31', status:'AGREED_AWAITING_WINDOW' as const, offeredDate:state.gameDate };
  let next = syncManagementInbox({ ...state, transferOffers:{[offer.id]:offer} });
  const id = `management-transfer:${offer.id}:${offer.status}`;
  assert.ok(next.inbox.find(m => m.id === id));
  next = markMessageRead(next,id);
  assert.equal(syncManagementInbox(next),next);
  next = syncManagementInbox({ ...next, transferOffers:{[offer.id]:{...offer,status:'COMPLETED'}} });
  assert.equal(next.inbox.find(m => m.id === id)?.read,true);
  const complete = next.inbox.find(m => m.id === `management-transfer:${offer.id}:COMPLETED`)!;
  assert.equal(resolveDestinationHref(complete.destinations![0]),`/career/squad/${player.id}`);
  assert.equal(syncManagementInbox(next),next);
});
test('management decisions and read state survive actual repository save/load and migration', async () => {
  __setSaveBackendForTests(createMemoryBackend());
  try {
    const { state, player } = ready();
    const save = await createSave({ manager:{name:'Management QA', nationality:'SWE',dateOfBirth:'1980-01-01'}, clubId:state.playerClubId, selectedNations:['SWE'], selectedCompetitionIds:[state.competitionId], gameDate:state.gameDate });
    let next = syncManagementInbox(addToShortlist(state,player.id,state.gameDate));
    const message = next.inbox.find(m => m.id.startsWith('management-contract:'))!;
    next = markMessageRead(next,message.id);
    next = renewPlayerContract(next,player.id,3,600);
    await saveCareerState(save.saveId,next);
    const loaded = migrateCareerState((await getSave(save.saveId))!.careerState!);
    assert.equal(loaded.recruitmentTargets[player.id].shortlisted,true);
    assert.equal(loaded.playerContracts[player.id].contractEndDate,next.playerContracts[player.id].contractEndDate);
    assert.equal(loaded.playerContracts[player.id].wageEurPerMonth,600,'negotiated wages must never be recalculated on reload');
    assert.equal(loaded.inbox.find(m => m.id === message.id)?.read,true);
    assert.equal(syncManagementInbox(syncManagementInbox(loaded)).inbox.filter(m => m.id === message.id).length,1);
  } finally { __setSaveBackendForTests(null); }
});
