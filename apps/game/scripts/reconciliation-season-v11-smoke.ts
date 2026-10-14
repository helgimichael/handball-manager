/** Isolated reconciliation copy of the canonical playable season proof. */
import fs from 'node:fs';
import { createNewCareerState } from '../lib/career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../lib/gameWorld/serverSnapshot';
import { continueCareerRhythm } from '../lib/career/continueController';
import { playManagerFixture } from '../lib/career/matchdayAction';
import { rolloverSeason } from '../lib/career/seasonRollover';
import { getLiveStandings } from '../lib/career/standings';
import { strict as assert } from 'node:assert';
import { renewPlayerContract } from '../lib/career/contractRenewal';
const out = '../../docs/reconciliation-v11/verification/season';
fs.mkdirSync(out,{recursive:true});
const checkpoint = out+'/season-end-state.json';
let state = process.argv.includes('--resume') ? JSON.parse(fs.readFileSync(checkpoint, 'utf8')) : createNewCareerState('end-to-end-season-alpha', 'swe2-tumba', snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'));
let guard = 0, played = process.argv.includes('--resume') ? Object.keys(state.matchArchives ?? {}).length : 0;
while (!state.seasonComplete && guard++ < 1000) {
  const press = continueCareerRhythm(state);
  state = press.state;
  if (press.stopReason === 'ACTION_REQUIRED' || press.stopReason === 'ACTION_REQUIRED_PENDING') {
    const action = playManagerFixture(state);
    assert.ok(action.result, `unhandled career action at ${state.gameDate}`);
    state = action.state;
    played++;
    console.log(JSON.stringify({ played, date: state.gameDate, score: [action.result.homeGoals, action.result.awayGoals], engine: action.result.engine }));
    if (played === 1) console.log('SIZES', JSON.stringify(Object.fromEntries(Object.entries(state).map(([key, value]) => [key, JSON.stringify(value)?.length ?? 0]))));
    if (process.argv.includes('--limit=1')) process.exit(0);
    // Exercise persisted representation, not an engine held in development memory.
    state = JSON.parse(JSON.stringify(state));
  }
}
assert.ok(state.seasonComplete, 'season completed through normal Continue and match actions');
assert.equal(played, 26);
assert.equal(Object.values(state.matchArchives ?? {}).length, played);
assert.ok(getLiveStandings(state).every(row => row.played === 26));
fs.writeFileSync(checkpoint, JSON.stringify(state));
// The scripted manager retains the squad using the same agreement available
// on each player's normal profile; ignoring expiring contracts is not a save bug.
for (const player of state.worldSquads[state.playerClubId] ?? []) {
  const contract = state.playerContracts[player.id];
  if (contract && contract.contractEndDate < '2028-05-31') state = renewPlayerContract(state, player.id, 2);
}
console.log('Manager renewed expiring squad contracts before the offseason.');
const finalStats = state.playerSeasonStats;
state = rolloverSeason(state);
state = JSON.parse(JSON.stringify(state));
assert.equal(state.seasonId, '2027/28');
assert.equal(state.seasonHistory?.length, 1);
assert.deepEqual(state.seasonHistory[0].stats, finalStats);
assert.equal(Object.keys(state.results).length, 0);
assert.equal(state.fixtures.length, 182);
const secondSeasonPress = continueCareerRhythm(state);
assert.ok(secondSeasonPress.daysProcessed > 0, 'calendar continues in season two');
state = secondSeasonPress.state;
let seasonTwoMatch = null;
for (let i = 0; i < 600 && !seasonTwoMatch; i++) {
  const press = continueCareerRhythm(state);
  state = press.state;
  if (i % 20 === 0) console.log(JSON.stringify({ seasonTwoCalendar: state.gameDate, stops: i, squad: state.worldSquads[state.playerClubId]?.length }));
  if (press.stopReason === 'ACTION_REQUIRED' || press.stopReason === 'ACTION_REQUIRED_PENDING') {
    const action = playManagerFixture(state);
    assert.ok(action.result, `season two action at ${state.gameDate}`);
    state = action.state;
    seasonTwoMatch = action.result;
  }
}
assert.ok(seasonTwoMatch, 'a real match can be played in season two after the offseason daily ticks');
const report = { complete: true, managerMatches: played, archivedMatches: Object.keys(state.matchArchives ?? {}).length, season: state.seasonId, date: state.gameDate, seasonTwoMatch, historicalTable: state.seasonHistory![0].table, playerStatistics: finalStats, nextCalendar: { fixtures: state.fixtures.length, firstDate: state.fixtures[0].date } };
fs.writeFileSync(out+'/playable-season-result.json', JSON.stringify(report, null, 2));
console.log('COMPLETE: full season, saved match archives, rollover and season-two calendar');
