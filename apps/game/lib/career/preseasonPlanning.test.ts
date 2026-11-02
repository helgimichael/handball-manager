import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { planFriendly, planFriendlyProgramme, planFriendlyTournament, planTrainingCamp, applyPreseasonEventDay, PRESEASON_COSTS, campOn } from './preseasonPlanning';
import { applyDailyMatchFitness, matchFitnessOf } from '../players/matchFitness';
import { getCareerSquad } from './careerWorld';
import type { CareerState } from './types';

const add = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
function career(): CareerState { return createNewCareerState('pre-2026', 'swe2-tumba', undefined, undefined, undefined, undefined, '6_WEEKS' as never); }
const cashOf = (s: CareerState) => s.clubEconomies[s.playerClubId]?.cashEur ?? 0;
const firstCompetitive = (s: CareerState) => s.fixtures.filter(f => f.type !== 'FRIENDLY' && (f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)).sort((a, b) => a.date.localeCompare(b.date))[0];

test('friendlies: home, away and neutral; charged to the club; conflicts refused', () => {
  const s = career();
  const opp = 'swe2-guif';
  const away = planFriendly(s, { date: add(s.gameDate, 3), opponentClubId: opp, venue: 'AWAY' });
  assert.ok(away.ok);
  const f = away.state.fixtures.at(-1)!;
  assert.equal(f.homeClubId, opp, 'an away friendly is played at the opponent');
  assert.equal(cashOf(away.state), cashOf(s) - PRESEASON_COSTS.friendlyAway);
  assert.equal(planFriendly(away.state, { date: add(s.gameDate, 3), opponentClubId: 'swe2-varberg', venue: 'HOME' }).ok, false, 'one match per day');
  const comp = firstCompetitive(s);
  assert.equal(planFriendly(s, { date: comp.date, opponentClubId: opp, venue: 'HOME' }).ok, false, 'never on a competitive matchday');
  const neutral = planFriendly(s, { date: add(s.gameDate, 5), opponentClubId: opp, venue: 'NEUTRAL', location: 'Halmstad' });
  assert.ok(neutral.ok && neutral.state.fixtures.at(-1)!.location === 'Halmstad');
});

test('a programme is all or nothing', () => {
  const s = career();
  const ok = planFriendlyProgramme(s, [{ date: add(s.gameDate, 2), opponentClubId: 'swe2-guif', venue: 'HOME' }, { date: add(s.gameDate, 6), opponentClubId: 'swe2-drott', venue: 'AWAY' }]);
  assert.ok(ok.ok);
  assert.equal(ok.state.fixtures.length, s.fixtures.length + 2);
  const bad = planFriendlyProgramme(s, [{ date: add(s.gameDate, 2), opponentClubId: 'swe2-guif', venue: 'HOME' }, { date: add(s.gameDate, 2), opponentClubId: 'swe2-drott', venue: 'AWAY' }]);
  assert.equal(bad.ok, false);
  assert.equal(bad.state, s, 'nothing booked');
});

test('camps block the calendar, cost money, lift the match-fitness ceiling and morale; tournaments add one game a day', () => {
  let s = career();
  const start = add(s.gameDate, 4);
  const camp = planTrainingCamp(s, { kind: 'TRIP', location: 'Malaga, Spanien', startDate: start, days: 5 });
  assert.ok(camp.ok);
  s = camp.state;
  assert.equal(camp.costEur, PRESEASON_COSTS.tripTravel + 5 * PRESEASON_COSTS.tripPerDay);
  assert.equal(planFriendly(s, { date: add(start, 2), opponentClubId: 'swe2-guif', venue: 'HOME' }).ok, false, 'no friendly during the camp');
  assert.ok(campOn(s, add(start, 4)) && !campOn(s, add(start, 5)));
  const ids = getCareerSquad(s).map(p => p.id);
  let normal = s, inCamp = s;
  for (let d = 0; d < 30; d++) { normal = applyDailyMatchFitness(normal, add(start, d), ids, () => false); inCamp = applyDailyMatchFitness(inCamp, add(start, d), ids, () => false, 70); }
  assert.ok(matchFitnessOf(inCamp, ids[0]) > matchFitnessOf(normal, ids[0]));
  const after = applyPreseasonEventDay(s, add(start, 4));
  assert.ok(after.playerDynamics?.morale?.[ids[0]]?.shocks?.some(x => x.label.startsWith('Gemenskap')));
  assert.deepEqual(applyPreseasonEventDay(after, add(start, 4)).playerDynamics, after.playerDynamics, 'idempotent');
  const t = planFriendlyTournament(s, { name: 'Cup', location: 'Partille', startDate: add(start, 8), opponentClubIds: ['swe2-guif', 'swe2-drott', 'swe2-varberg'] });
  assert.ok(t.ok);
  assert.deepEqual(t.state.fixtures.slice(-3).map(f => f.date), [add(start, 8), add(start, 9), add(start, 10)]);
});

test('a club that cannot pay is refused', () => {
  const s = career();
  const broke = { ...s, clubEconomies: { ...s.clubEconomies, [s.playerClubId]: { ...s.clubEconomies[s.playerClubId]!, cashEur: 100 } } };
  const r = planTrainingCamp(broke, { kind: 'CAMP', location: 'Bosön, Lidingö', startDate: add(s.gameDate, 3), days: 3 });
  assert.equal(r.ok, false);
});
