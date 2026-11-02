import { loadClubStaffIdentity } from '../gameWorld/staffIdentityLoader';
import { getClubsByCompetition } from '../game-data';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { getNextPlayerFixture } from '../career/calendar';
import { buildOpponentScoutReport, opponentScoutingCandidates, progressOpponentScouting, requestOpponentScouting, scoutingReliability, setScoutingDelegate } from './opponentScouting';
import type { ResolvedStaffMember } from '../staff/types';

function career() {
  const squads = snapshotWorldSquads('swe-2');
  const staff = Object.fromEntries(getClubsByCompetition('swe-2').map(c => [c.id, loadClubStaffIdentity(c.id, 'allsvenskan')]));
  const s = createNewCareerState('scout-2026', 'swe2-tumba', squads, undefined, snapshotGameplayRatings('swe-2'), staff as never);
  const club = Object.keys(s.worldSquads).find(id => id.toLowerCase().includes('tumba'))!;
  return { ...s, playerClubId: club };
}
const withAbility = (m: ResolvedStaffMember, value: number): ResolvedStaffMember => ({ ...m, profile: { ...m.profile, attributes: Object.fromEntries(Object.entries(m.profile.attributes).map(([k, v]) => [k, v ? { ...v, value } : v])) as never } });

test('reliability rises with ability and evidence, within honest bounds', () => {
  assert.ok(scoutingReliability(4, 0) < scoutingReliability(18, 0));
  assert.ok(scoutingReliability(10, 0) < scoutingReliability(10, 5));
  assert.ok(scoutingReliability(1, 0) >= 0.35 && scoutingReliability(20, 10) <= 0.95);
});

test('a strong scout reports the opponent\'s real setup; a weak one is less certain and can be wrong', () => {
  const s = career();
  const fixture = getNextPlayerFixture(s)!;
  const staff = opponentScoutingCandidates(s)[0];
  assert.ok(staff, 'the club has someone who can scout');
  const strong = buildOpponentScoutReport(s, fixture, withAbility(staff, 20), s.gameDate);
  const weak = buildOpponentScoutReport(s, fixture, withAbility(staff, 1), s.gameDate);
  assert.ok(strong.reliability > weak.reliability);
  assert.notEqual(strong.reliabilityLabel, weak.reliabilityLabel);
  assert.ok(strong.scouted.some(c => c.topic === 'Försvarsstruktur'));
  assert.deepEqual(buildOpponentScoutReport(s, fixture, withAbility(staff, 20), s.gameDate), strong, 'deterministic');
  const starters = (r: typeof strong) => r.scouted.find(c => c.topic === 'Trolig startsju')?.text.split(',').length ?? 0;
  assert.ok(starters(strong) >= starters(weak), 'a weak scout identifies fewer of the likely starters');
  assert.ok(weak.observed.length > 0, 'observed data is still reported');
});

test('requests complete into reports; delegation scouts the next opponent automatically', () => {
  let s = career();
  const fixture = getNextPlayerFixture(s)!;
  const staff = opponentScoutingCandidates(s)[0];
  s = requestOpponentScouting(s, fixture.id, staff.id);
  const due = s.opponentScouting!.requests[fixture.id].readyOn;
  assert.equal(progressOpponentScouting(s, s.gameDate, fixture).completed.length, due === s.gameDate ? 1 : 0);
  const done = progressOpponentScouting(s, due, fixture);
  assert.equal(done.completed.length, 1);
  assert.ok(done.state.opponentScouting!.reports[fixture.id]);
  let d = setScoutingDelegate(career(), staff.id);
  d = progressOpponentScouting(d, d.gameDate, fixture).state;
  assert.ok(d.opponentScouting!.requests[fixture.id] || d.opponentScouting!.reports[fixture.id], 'delegate picked up the next opponent');
});
