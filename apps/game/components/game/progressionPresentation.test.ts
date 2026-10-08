import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { CareerEvent } from '@/lib/career/careerEvents';
import { progressionNotice } from './progressionPresentation';

function event(patch: Partial<CareerEvent>): CareerEvent {
  return { id: 'real-event', type: 'STAFF_REPORT', date: '2026-08-01', createdAtGameDate: '2026-08-01',
    subject: 'Rapport från tränarstaben', summary: 'Den registrerade rapporten.', priority: 'IMPORTANT',
    requiresAction: false, resolved: true, read: false, destinations: [{route:'ANALYSIS_OUR_TEAM'}], relatedEntities: [], ...patch };
}
test('an already pending non-match decision opens its actual message, not match preview', () => {
  const pending = Object.freeze(event({id:'contract:player-7',type:'PLAYER_CONTRACT_EXPIRED',requiresAction:true,resolved:false,priority:'ACTION_REQUIRED',destinations:[{route:'PLAYER_PROFILE',playerId:'player-7'}]}));
  const notice = progressionNotice([], 'ACTION_REQUIRED_PENDING', pending);
  assert.equal(notice.title, pending.subject);
  assert.equal(notice.actionHref, '/career/squad/player-7');
  assert.equal(notice.navigateHref, '/career/inbox?message=msg%3Acontract%3Aplayer-7');
  assert.equal(pending.resolved, false);
});
test('matchday stops return to preparation even when an older information event precedes them', () => {
  const matchday = event({type:'MATCHDAY_READY',requiresAction:true,resolved:false,priority:'ACTION_REQUIRED',destinations:[{route:'MATCH_PREVIEW'}]});
  const notice = progressionNotice([event({priority:'INFORMATION'}),matchday], 'ACTION_REQUIRED');
  assert.equal(notice.navigateHref, '/career/match-preview');
  assert.equal(notice.kind, 'matchday');
});
test('the exact important stop event is linked instead of opening an arbitrary inbox item', () => {
  const report = event({id:'scout:target',type:'SCOUT_REPORT_READY',subject:'Rapport om målspelaren',destinations:[{route:'SCOUT_REPORT',playerId:'target'}]});
  const notice = progressionNotice([event({priority:'INFORMATION'}),report], 'IMPORTANT');
  assert.equal(notice.event, report);
  assert.equal(notice.actionHref, '/career/squad/target');
  assert.equal(notice.navigateHref, '/career/inbox?message=msg%3Ascout%3Atarget');
});
test('quiet time advance does not invent training or a manager decision', () => {
  const notice = progressionNotice([], 'MAX_DAYS_REACHED');
  assert.equal(notice.kind, 'calendar');
  assert.equal(notice.event, undefined);
  assert.equal(notice.navigateHref, '/career');
});
test('season completion leads to the milestone while stored history remains the contextual action', () => {
  const notice = progressionNotice([event({type:'COMPETITION_UPDATE'})], 'SEASON_COMPLETE');
  assert.equal(notice.kind, 'season');
  assert.equal(notice.navigateHref, '/career');
  assert.equal(notice.actionHref, '/career/history');
});
