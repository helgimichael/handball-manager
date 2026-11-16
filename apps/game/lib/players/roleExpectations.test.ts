// SQUAD-ROLE-MINUTES: the five squad roles' playing-time expectations and
// satisfaction over a rolling window of matches the player was available for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMatch, type ClubStrength } from '@handball-manager/game-simulation';
import { createNewCareerState } from '../career/newCareer';
import { migrateCareerState } from '../career/saveMigration';
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, updatePlayerSquadStatus, type SquadStatusTier } from '../career/squadStatus';
import { addDays } from '../career/dateUtils';
import { careerEventToInboxMessage } from '../career/inboxBridge';
import type { CareerFixture, CareerState } from '../career/types';
import type { CareerEvent } from '../career/careerEvents';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { assessPlayingTime, DEVELOPMENT_HORIZON_MATCHES, expectedCourtMinutes, guaranteedCourtMinutes, recordPlayingTimeMatch, roleGuaranteesMinutes } from './playingTime';
import { updateMoraleWeekly, moraleFactors, moraleOf } from './morale';
import { openConcerns, progressTalks } from './talks';
import { managerSquadIds } from './dynamicsState';

const club = 'swe2-tumba';
const strength = (clubId: string): ClubStrength => ({ clubId, overall: 60, attack: 60, defense: 60, goalkeeper: 60, depth: 60 });
function fresh(): CareerState {
  const s = createNewCareerState('squad-role-minutes', club, snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'));
  return { ...s, gameDate: '2026-08-09', playerStatuses: Object.fromEntries(managerSquadIds(s).map(id => [id, { playerId: id, availability: 'AVAILABLE' as const }])), playerSquadStatus: Object.fromEntries(managerSquadIds(s).map(id => [id, 'SQUAD_PLAYER' as const])) };
}
/** One competitive match a week; everybody plays 15 minutes unless overridden. */
function addMatch(s: CareerState, week: number, overrides: ReadonlyMap<string, number> = new Map()): CareerState {
  const f: CareerFixture = { id: `role-minutes:${week}`, competitionId: s.competitionId, round: week, date: addDays('2026-08-09', week * 7), homeClubId: club, awayClubId: 'swe2-aranas', type: 'LEAGUE' };
  const result = simulateMatch({ fixtureId: f.id, seed: week, homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeStrength: strength(f.homeClubId), awayStrength: strength(f.awayClubId) });
  const next = { ...s, gameDate: f.date, fixtures: [...s.fixtures, f], results: { ...s.results, [f.id]: result } };
  return recordPlayingTimeMatch(next, f, new Map(managerSquadIds(s).map(id => [id, overrides.get(id) ?? 15])), 'MEASURED', s);
}
function week(s: CareerState): CareerState {
  const date = addDays(s.gameDate, 1), events: CareerEvent[] = [];
  let next = updateMoraleWeekly({ ...s, gameDate: date }, date);
  next = progressTalks(next, date, e => events.push(e));
  for (const event of events) if (!next.careerEvents.some(e => e.id === event.id)) next = { ...next, careerEvents: [...next.careerEvents, event], inbox: [...next.inbox, careerEventToInboxMessage(event, next)] };
  return next;
}
function withRole(tier: SquadStatusTier, index = 0): { s: CareerState; id: string } {
  const s = fresh(), id = managerSquadIds(s)[index]!;
  return { s: updatePlayerSquadStatus(s, id, tier), id };
}
const setAvailability = (s: CareerState, id: string, availability: 'AVAILABLE' | 'INJURED' | 'SUSPENDED') => ({ ...s, playerStatuses: { ...s.playerStatuses, [id]: { playerId: id, availability } } });
const negativeTime = (s: CareerState, id: string) => moraleFactors(s, id).some(f => f.key === 'PLAYING_TIME' && f.points < 0);

test('the five roles keep their Swedish names; Key > First Choice > Rotation guarantee minutes, Squad Player and Talent guarantee none', () => {
  assert.deepEqual(SQUAD_STATUS_TIERS.map(t => SQUAD_STATUS_TIER_LABEL_SV[t]), ['Nyckelspelare', 'Förstaval', 'Rotation', 'Truppspelare', 'Talang']);
  const g = (t: SquadStatusTier) => guaranteedCourtMinutes(t, 'BOTH_PHASES', 25);
  assert.ok(g('KEY_PLAYER') > g('FIRST_CHOICE') && g('FIRST_CHOICE') > g('ROTATION') && g('ROTATION') > 0);
  assert.equal(g('SQUAD_PLAYER'), 0);
  assert.equal(g('TALENT'), 0);
  assert.deepEqual(SQUAD_STATUS_TIERS.map(roleGuaranteesMinutes), [true, true, true, false, false]);
  // The stored reference level is unchanged for every role (old samples keep their meaning).
  assert.equal(expectedCourtMinutes('KEY_PLAYER', 'BOTH_PHASES', 25), 42);
});

test('a Squad Player who never plays is not dissatisfied by minutes alone', () => {
  const role = withRole('SQUAD_PLAYER'); let s = role.s; const id = role.id;
  for (let w = 0; w < 10; w++) s = week(addMatch(s, w, new Map([[id, 0]])));
  const time = assessPlayingTime(s, id);
  assert.equal(time.status, 'MET'); assert.equal(time.basis, 'NO_GUARANTEE');
  assert.ok(!negativeTime(s, id));
  assert.equal(s.playerDynamics!.morale[id]!.playingTimeUnmetWeeks, 0);
  assert.equal(openConcerns(s, id).length, 0);
  assert.ok(moraleOf(s, id) >= 60);
});

test('a Squad Player given real chances notices it positively', () => {
  const role = withRole('SQUAD_PLAYER'); let s = role.s; const id = role.id;
  for (let w = 0; w < 6; w++) s = week(addMatch(s, w, new Map([[id, 25]])));
  assert.equal(assessPlayingTime(s, id).status, 'EXCEEDED');
  assert.ok(moraleFactors(s, id).some(f => f.key === 'PLAYING_TIME' && f.points > 0));
});

test('a Talent is not judged match by match, only over a long horizon of available matches', () => {
  const role = withRole('TALENT', 1); let s = role.s; const id = role.id;
  for (let w = 0; w < DEVELOPMENT_HORIZON_MATCHES - 1; w++) s = week(addMatch(s, w, new Map([[id, 0]])));
  assert.notEqual(assessPlayingTime(s, id).status, 'UNMET', 'no development verdict before the horizon');
  assert.ok(!negativeTime(s, id));
  s = week(addMatch(s, DEVELOPMENT_HORIZON_MATCHES - 1, new Map([[id, 0]])));
  const time = assessPlayingTime(s, id);
  assert.equal(time.status, 'UNMET'); assert.equal(time.basis, 'DEVELOPMENT');
  const factor = moraleFactors(s, id).find(f => f.key === 'PLAYING_TIME')!;
  assert.ok(factor.points < 0 && factor.points >= -10, 'a modest, slow weight -- never a role-sized shortfall');
});

test('a Talent who gets occasional development minutes passes the long-horizon check', () => {
  const role = withRole('TALENT', 1); let s = role.s; const id = role.id;
  for (let w = 0; w < 12; w++) s = week(addMatch(s, w, new Map([[id, w % 4 === 0 ? 8 : 0]])));
  assert.notEqual(assessPlayingTime(s, id).status, 'UNMET');
  assert.ok(!negativeTime(s, id));
});

test('Talent development horizon counts only matches he was available for (injury and suspension excluded)', () => {
  const role = withRole('TALENT', 1); let s = role.s; const id = role.id;
  for (let w = 0; w < 12; w++) {
    const unavailable = w % 2 === 1;
    s = setAvailability(s, id, unavailable ? (w % 4 === 1 ? 'INJURED' : 'SUSPENDED') : 'AVAILABLE');
    s = addMatch(s, w, new Map([[id, 0]]));
  }
  s = setAvailability(s, id, 'AVAILABLE');
  assert.equal(s.playerDynamics!.developmentLedger![id]!.availableMatches, 6);
  assert.notEqual(assessPlayingTime(s, id).status, 'UNMET');
});

test('one missed match never flips a Key Player to dissatisfied', () => {
  const role = withRole('KEY_PLAYER'); let s = role.s; const id = role.id;
  for (let w = 0; w < 6; w++) s = week(addMatch(s, w, new Map([[id, w === 5 ? 0 : 45]])));
  assert.notEqual(assessPlayingTime(s, id).status, 'UNMET');
  assert.ok(!negativeTime(s, id));
  // Even a borderline window: three solid matches and one blank.
  const b = withRole('FIRST_CHOICE');
  for (let w = 0; w < 4; w++) b.s = addMatch(b.s, w, new Map([[b.id, w === 3 ? 0 : 30]]));
  assert.notEqual(assessPlayingTime(b.s, b.id).status, 'UNMET');
});

test('a repeatedly benched Key Player declines gradually over several matches, not at once', () => {
  const role = withRole('KEY_PLAYER'); let s = role.s; const id = role.id;
  const morale: number[] = [];
  for (let w = 0; w < 7; w++) { s = week(addMatch(s, w, new Map([[id, 0]]))); morale.push(moraleOf(s, id)); }
  assert.equal(assessPlayingTime(s, id).status, 'UNMET');
  for (let i = 1; i < morale.length; i++) assert.ok(morale[i - 1]! - morale[i]! <= 6, 'bounded weekly step');
  assert.ok(openConcerns(s, id).length <= 1);
  assert.ok(morale[2]! >= 55, 'still okay after three matches');
});

test('Rotation is evaluated over more matches than Key Player before any verdict', () => {
  const key = withRole('KEY_PLAYER'), rot = withRole('ROTATION', 1);
  let s = updatePlayerSquadStatus(key.s, rot.id, 'ROTATION');
  for (let w = 0; w < 5; w++) s = addMatch(s, w, new Map([[key.id, 0], [rot.id, 0]]));
  assert.equal(assessPlayingTime(s, key.id).status, 'UNMET');
  assert.equal(assessPlayingTime(s, rot.id).status, 'WARMUP');
  s = addMatch(s, 5, new Map([[key.id, 0], [rot.id, 0]]));
  assert.equal(assessPlayingTime(s, rot.id).status, 'UNMET');
  void rot.s;
});

test('injured or suspended matches inside the window are not counted against a First Choice player', () => {
  const role = withRole('FIRST_CHOICE'); let s = role.s; const id = role.id;
  for (let w = 0; w < 8; w++) {
    s = setAvailability(s, id, w >= 2 && w <= 5 ? (w % 2 ? 'INJURED' : 'SUSPENDED') : 'AVAILABLE');
    s = addMatch(s, w, new Map([[id, w >= 2 && w <= 5 ? 0 : 35]]));
  }
  s = setAvailability(s, id, 'AVAILABLE');
  const time = assessPlayingTime(s, id);
  assert.equal(time.eligibleMatches, 2, 'only the available matches inside the six-week window');
  assert.notEqual(time.status, 'UNMET');
});

test('demoting a benched Key Player to Squad Player removes the minutes complaint going forward', () => {
  const role = withRole('KEY_PLAYER'); let s = role.s; const id = role.id;
  for (let w = 0; w < 5; w++) s = addMatch(s, w, new Map([[id, 0]]));
  assert.equal(assessPlayingTime(s, id).status, 'UNMET');
  s = updatePlayerSquadStatus(s, id, 'SQUAD_PLAYER');
  assert.equal(assessPlayingTime(s, id).status, 'MET');
  assert.ok(!negativeTime(s, id));
});

test('hidden expectations are never shown: explanations carry no expectation figures or formulas', () => {
  for (const tier of SQUAD_STATUS_TIERS) {
    const role = withRole(tier); let s = role.s; const id = role.id;
    for (let w = 0; w < 12; w++) s = week(addMatch(s, w, new Map([[id, 0]])));
    const time = assessPlayingTime(s, id);
    const texts = [time.explanation, ...moraleFactors(s, id).map(f => f.label), ...openConcerns(s, id).map(c => c.message)];
    for (const text of texts) {
      assert.doesNotMatch(text, /riktmärke|förväntning|förväntan på|procent|%|formel/i, `${tier}: ${text}`);
      if (time.expectedMinutes > 0) assert.ok(!text.includes(String(Math.round(time.expectedMinutes))), `${tier} leaks its expectation: ${text}`);
    }
  }
});

test('save/load keeps the development ledger; older saves without it behave as fresh evidence', () => {
  const role = withRole('TALENT', 1); let s = role.s; const id = role.id;
  for (let w = 0; w < 11; w++) s = week(addMatch(s, w, new Map([[id, 0]])));
  const loaded = migrateCareerState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(loaded.playerDynamics!.developmentLedger, s.playerDynamics!.developmentLedger);
  assert.deepEqual(assessPlayingTime(loaded, id), assessPlayingTime(s, id));
  const legacy = migrateCareerState(JSON.parse(JSON.stringify({ ...s, playerDynamics: { ...s.playerDynamics!, developmentLedger: undefined } })));
  assert.notEqual(assessPlayingTime(legacy, id).status, 'UNMET', 'no invented development history');
  // A new season starts the Talent tally afresh.
  const next = addMatch({ ...s, seasonId: `${s.seasonId}-next` }, 11, new Map([[id, 0]]));
  assert.equal(next.playerDynamics!.developmentLedger![id]!.availableMatches, 1);
});
