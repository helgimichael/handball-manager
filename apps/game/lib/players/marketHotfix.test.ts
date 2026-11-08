import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { migrateCareerState } from '../career/saveMigration';
import { getCareerPlayer, getCareerClubSquad } from '../career/careerWorld';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { acceptIncomingOffer, confirmIncomingSale, completeSale, progressIncomingOffers, requestBidFor } from './market';
import { progressDailyTransfers, submitTransferOffer } from '../transfers/transferIntegration';
import { transferPlayerPermanently } from '../transfers/transferExecution';
import { ensureClubFinances } from '../economy/ledger';
import type { IncomingOffer } from './types';

const PLAYER = 'se_player_oskar_waltin_53391dff';
const SELLER = 'swe2-tumba';
const BUYER = 'swe2-guif';
const noEmit = () => undefined;
function setup(date = '2026-11-08') {
  const base = ensureClubFinances(createNewCareerState('alpha-hotfix', SELLER, snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2')), date);
  assert.equal(getCareerPlayer(base, PLAYER)?.clubId, SELLER);
  const offer: IncomingOffer = { id: 'sale-oskar', playerId: PLAYER, fromClubId: BUYER, foreign: false, openedOn: date, feeEur: 5000, maxFeeEur: 8000, wageEurPerMonth: 1500, contractYears: 2, status: 'OPEN', respondBy: '2027-01-30', rounds: [], motive: 'hotfix reproduction' };
  const state = { ...base, gameDate: date, incomingOffers: { [offer.id]: offer }, playerDynamics: { morale: {}, promises: {}, concerns: {}, requests: { [PLAYER]: { playerId: PLAYER, submittedOn: date, reason: 'move', status: 'OPEN' as const } }, listings: {}, departures: [] } };
  return { state, offer };
}

test('Oskar cannot agree five sales while waiting for the January window', () => {
  const { state, offer } = setup();
  let next = confirmIncomingSale(acceptIncomingOffer(state, offer.id), offer.id);
  assert.equal(next.incomingOffers![offer.id].status, 'AWAITING_WINDOW');
  assert.equal(next.incomingOffers![offer.id].completesOn, '2027-01-01');
  assert.equal(confirmIncomingSale(next, offer.id), next, 'a repeated confirmation is idempotent');
  for (let i = 0; i < 4; i++) {
    const other = { ...offer, id: `sale-${i}` };
    next = { ...next, incomingOffers: { ...next.incomingOffers, [other.id]: other } };
    next = acceptIncomingOffer(next, other.id);
    assert.equal(next.incomingOffers![other.id].status, 'WITHDRAWN');
  }
  assert.equal(next.incomingOffers![offer.id].agreedOn, state.gameDate);
  assert.equal(requestBidFor(next, PLAYER, '2026-11-09', noEmit), next);
  const bid = submitTransferOffer(next, { dealType: 'PERMANENT', playerId: PLAYER, toClubId: 'swe2-varberg', transferFeeEur: 100000, newWageEurPerMonth: 5000 });
  assert.equal(bid.offer.status, 'BLOCKED_PENDING_TRANSFER');
  assert.equal(next.clubEconomies[SELLER].cashEur, state.clubEconomies[SELLER].cashEur);
  const loaded = migrateCareerState(JSON.parse(JSON.stringify(next)));
  const done = progressIncomingOffers({ ...loaded, gameDate: '2027-01-01' }, '2027-01-01', noEmit);
  assert.equal(done.incomingOffers![offer.id].status, 'COMPLETED');
  assert.equal(done.clubEconomies[SELLER].cashEur, state.clubEconomies[SELLER].cashEur + offer.feeEur);
  assert.equal(getCareerPlayer(done, PLAYER)?.clubId, BUYER);
  assert.equal(done.clubFinances![SELLER].pendingTransactions.filter(t => t.category === 'TRANSFER_FEES').length, 1);
  assert.equal(done.clubFinances![BUYER].pendingTransactions.filter(t => t.category === 'TRANSFER_FEES').length, 1);
  assert.ok(!getCareerClubSquad(done, SELLER).some(p => p.id === PLAYER));
  assert.equal(progressIncomingOffers(done, '2027-01-01', noEmit), done);
});

test('completion is status/window gated and repeated completion preserves history and money', () => {
  const { state, offer } = setup();
  assert.equal(completeSale(state, offer.id, state.gameDate, noEmit), state, 'unaccepted offer');
  const pending = confirmIncomingSale(acceptIncomingOffer(state, offer.id), offer.id);
  assert.equal(completeSale(pending, offer.id, state.gameDate, noEmit), pending, 'closed window');
  assert.equal(progressIncomingOffers(pending, '2027-02-01', noEmit), pending, 'missed January tick cannot execute in February');
  const done = progressIncomingOffers({ ...pending, gameDate: '2027-01-01' }, '2027-01-01', noEmit);
  for (let i = 0; i < 5; i++) assert.equal(completeSale(done, offer.id, '2027-01-01', noEmit), done);
  assert.equal(acceptIncomingOffer(done, offer.id), done);
  assert.equal(confirmIncomingSale(done, offer.id), done);
  const finance = done.clubFinances![SELLER];
  const duplicateHistory = { ...done, incomingOffers: { ...done.incomingOffers, legacy: { ...done.incomingOffers![offer.id], id: 'legacy' } }, clubFinances: { ...done.clubFinances, [SELLER]: { ...finance, pendingTransactions: [...finance.pendingTransactions, ...finance.pendingTransactions] } } };
  const loaded = migrateCareerState(JSON.parse(JSON.stringify(duplicateHistory)));
  assert.deepEqual(loaded.incomingOffers, JSON.parse(JSON.stringify(duplicateHistory.incomingOffers)));
  assert.deepEqual(loaded.clubFinances, duplicateHistory.clubFinances);
  assert.equal(completeSale(loaded, 'legacy', '2027-01-01', noEmit), loaded);
  const pendingAgain = { ...loaded, incomingOffers: { ...loaded.incomingOffers, stale: { ...offer, id: 'stale', status: 'AWAITING_WINDOW' as const, completesOn: '2027-01-01' } } };
  const after = progressIncomingOffers(pendingAgain, '2027-01-01', noEmit);
  assert.deepEqual(after.clubFinances, loaded.clubFinances);
  assert.equal(after.incomingOffers!.stale.status, 'WITHDRAWN');
});

test('a failed ownership mutation cannot pay a sale fee', () => {
  const { state, offer } = setup('2026-07-01');
  const moved = transferPlayerPermanently(state, PLAYER, SELLER, BUYER, 1500, '2029-05-31');
  // Old/inconsistent save: the contract says Tumba, registration says buyer.
  const stale = { ...moved, playerContracts: state.playerContracts, incomingOffers: { [offer.id]: { ...offer, status: 'AWAITING_FINAL_APPROVAL' as const } } };
  const next = confirmIncomingSale(stale, offer.id);
  assert.equal(next.clubEconomies[SELLER].cashEur, state.clubEconomies[SELLER].cashEur);
  assert.equal(next.incomingOffers![offer.id].status, 'WITHDRAWN');
});

test('direct recruitment rejects a same-club move without payment; daily completion checks the actual window', () => {
  const { state } = setup('2026-07-01');
  const same = submitTransferOffer(state, { dealType: 'PERMANENT', playerId: PLAYER, toClubId: SELLER, transferFeeEur: 100000, newWageEurPerMonth: 5000 });
  assert.notEqual(same.offer.status, 'COMPLETED');
  assert.deepEqual(same.state.clubEconomies, state.clubEconomies);
  const offer = { id: 'scheduled', dealType: 'PERMANENT' as const, playerId: PLAYER, fromClubId: SELLER, toClubId: BUYER, transferFeeEur: 5000, trainingCompensationEur: 0, newWageEurPerMonth: 1500, newContractEndDate: '2029-05-31', status: 'AGREED_AWAITING_WINDOW' as const, offeredDate: '2026-11-08', scheduledCompletionDate: '2027-01-01' };
  const pending = { ...state, transferOffers: { [offer.id]: offer } };
  assert.equal(acceptIncomingOffer(pending, 'sale-oskar').incomingOffers!['sale-oskar'].status, 'WITHDRAWN', 'recruitment commitments block sales too');
  assert.equal(progressDailyTransfers(pending, '2027-02-01'), pending);
  const done = progressDailyTransfers(pending, '2027-01-01');
  assert.equal(done.transferOffers[offer.id].status, 'COMPLETED');
  assert.equal(progressDailyTransfers(done, '2027-01-01'), done);
});

test('counteroffer processing and automatic sale approval cannot bypass another pending sale', () => {
  const { state, offer } = setup();
  const first = confirmIncomingSale(acceptIncomingOffer(state, offer.id), offer.id);
  const counter = { ...offer, id: 'counter', status: 'COUNTERED' as const, answerOn: state.gameDate, askingFeeEur: 6000 };
  const next = progressIncomingOffers({ ...first, requireFinalTransferApproval: false, incomingOffers: { ...first.incomingOffers, [counter.id]: counter } }, state.gameDate, noEmit);
  assert.equal(next.incomingOffers!.counter.status, 'WITHDRAWN');
  assert.equal(next.incomingOffers![offer.id].status, 'AWAITING_WINDOW');
  assert.deepEqual(next.clubEconomies, state.clubEconomies);
});
