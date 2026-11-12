// HM-M6.0: older saves on the M6.0 code (acceptance criterion A11).
// Loads real saves written by earlier releases (paths given on the command
// line), checks that loading changes no delegation or scouting state, plays
// three weeks through the ordinary daily tick, then applies the rollover
// compaction and checks it is idempotent and keeps knowledge and the
// Recruitment Centre's candidates exactly as they were.
import './register-asset-loader.cjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { migrateCareerState } from '../lib/career/saveMigration';
import { continueCareerRhythm } from '../lib/career/continueController';
import { playManagerFixture } from '../lib/career/matchdayAction';
import { answerConcern } from '../lib/players/talks';
import { submitBoardRecoveryPlan } from '../lib/board/board';
import { withoutNationalDuty } from '../lib/nationalTeam/duty';
import { getCareerSquad } from '../lib/career/careerWorld';
import { isSelectableForMatch } from '../lib/career/playerStatus';
import { resolveClubMatchPlanForFixture } from '../lib/career/playerMatchStrength';
import { getPlayerFixtureOn } from '../lib/career/calendar';
import { compactCareerHistory } from '../lib/career/historyCompaction';
import { getRecruitmentCandidates } from '../lib/career/recruitment';
import { addDays } from '../lib/career/dateUtils';
import { delegationOf, nextProposalId } from '../lib/delegation/delegation';
import type { CareerState } from '../lib/career/types';

/** Compared as stored JSON: an absent and an undefined optional field are the same save. */
const asSaved = (v: unknown) => JSON.parse(JSON.stringify(v ?? null));

for (const file of process.argv.slice(2)) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const stored = (raw.save?.careerState ?? raw.careerState ?? raw) as CareerState;
  assert.ok(stored, `${file}: no careerState`);
  const loaded = migrateCareerState(JSON.parse(JSON.stringify(stored)));
  assert.deepEqual(asSaved(loaded.delegation), asSaved(stored.delegation), 'load keeps delegation');
  assert.deepEqual(asSaved(loaded.opponentScouting), asSaved(stored.opponentScouting), 'load keeps opponent scouting');
  assert.deepEqual(loaded.scoutReports ?? {}, stored.scoutReports ?? {}, 'load keeps scout reports');
  let s = loaded;
  // Three weeks through the ordinary Continue rhythm, playing the manager's matches.
  const until = addDays(loaded.gameDate, 21);
  let stop = '';
  for (let guard = 0; guard < 300 && s.gameDate < until && !s.seasonComplete; guard++) {
    const press = continueCareerRhythm(s);
    s = press.state;
    stop = press.stopReason;
    if (press.stopReason === 'CALENDAR_CONFLICT') break;
    if (press.stopReason !== 'ACTION_REQUIRED' && press.stopReason !== 'ACTION_REQUIRED_PENDING') continue;
    let handled = false;
    for (const c of Object.values(s.playerDynamics?.concerns ?? {}).filter((c) => c.status === 'OPEN')) { const o = c.options.find((x) => ['EARN_IT', 'PATIENCE', 'LATER'].includes(x.id)) ?? c.options[0]; if (o) { s = answerConcern(s, c.id, o.id); handled = true; } }
    for (const m of s.board?.meetings ?? []) if (s.careerEvents.some((e) => e.id === `BOARD_UPDATE:${m.id}` && e.requiresAction && !e.resolved) && ['WARNING', 'FINAL_WARNING'].includes(m.kind)) { s = submitBoardRecoveryPlan(s, m.id); handled = true; }
    const fixture = getPlayerFixtureOn(s, s.gameDate);
    if (!fixture && handled) continue;
    if (fixture) {
      const available = withoutNationalDuty(s, getCareerSquad(s).filter((p) => isSelectableForMatch(s.playerStatuses, p.id)));
      const plan = resolveClubMatchPlanForFixture(s.playerClubId, fixture.id, available, undefined);
      assert.ok(plan);
      s = { ...s, matchPlans: { ...s.matchPlans, [fixture.id]: plan } };
    }
    const action = playManagerFixture(s);
    assert.ok(action.result, JSON.stringify({ date: s.gameDate, pending: s.careerEvents.filter((e) => e.requiresAction && !e.resolved).map((e) => e.subject) }));
    s = action.state;
  }
  // Every stored proposal id is still unique and none would be issued again.
  const ids = Object.keys(delegationOf(s).proposals);
  for (const area of ['PLAYER_RECRUITMENT', 'TRAINING_SCHEDULE', 'SCOUTING_ASSIGNMENTS'] as const) assert.ok(!ids.includes(nextProposalId(s, area, s.gameDate)));
  const compacted = compactCareerHistory(s, s.gameDate);
  assert.deepEqual(compactCareerHistory(compacted, s.gameDate), compacted, 'compaction idempotent');
  assert.deepEqual(compacted.playerKnowledge, s.playerKnowledge, 'knowledge unchanged');
  const candidates = (x: CareerState) => getRecruitmentCandidates(x).map((c) => c.playerId).sort();
  assert.deepEqual(candidates(compacted), candidates(s), 'Recruitment Centre unchanged');
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(compacted)));
  assert.deepEqual(asSaved(reloaded.delegation), asSaved(compacted.delegation), 'reload keeps delegation');
  console.log(JSON.stringify({
    file: basename(file), schemaVersion: (raw.save ?? raw).schemaVersion, club: loaded.playerClubId, loadedOn: loaded.gameDate, playedTo: s.gameDate, lastStop: stop, seasonComplete: Boolean(s.seasonComplete),
    delegationAreas: Object.keys(delegationOf(stored).settings), proposals: [Object.keys(delegationOf(stored).proposals).length, Object.keys(delegationOf(compacted).proposals).length],
    log: [delegationOf(stored).log.length, delegationOf(compacted).log.length],
    scoutReports: [Object.keys(stored.scoutReports ?? {}).length, Object.keys(compacted.scoutReports).length],
    scoutDiscoveries: [Object.keys(stored.scoutDiscoveries ?? {}).length, Object.keys(compacted.scoutDiscoveries).length],
    assignments: [Object.keys(stored.scoutingAssignments ?? {}).length, Object.keys(compacted.scoutingAssignments).length],
    opponentRequests: Object.keys(compacted.opponentScouting?.requests ?? {}).length, result: 'PASS',
  }));
}
