// HM-M6.0: long-career state-hygiene scenario (acceptance criterion A1).
// A stock Tumba career with every delegable area handed to the staff, the
// opponent analyst delegated and routine press delegated, played season after
// season through the ordinary Continue rhythm and the real season transition.
// After every rollover it records how much delegation and scouting state the
// save carries, reloads through the save migration, and checks that no
// proposal id is ever issued twice. Output: HM_M60_QA_DIR (a C:/DEV/QA/reports
// directory); resumable from its own per-season checkpoint with --resume.
import './register-asset-loader.cjs';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createNewCareerState } from '../lib/career/newCareer';
import { snapshotGameplayRatings, snapshotWorldSquads } from '../lib/gameWorld/serverSnapshot';
import { snapshotAllClubsStaff } from '../lib/gameWorld/staffIdentitySnapshot';
import { SWEDISH_WORLD_COMPETITION_IDS } from '../lib/career/worldCompetitions';
import { continueCareerRhythm } from '../lib/career/continueController';
import { playManagerFixture } from '../lib/career/matchdayAction';
import { playManagerFixtureLegacy } from '../lib/career/legacy/matchday';
import { attemptSeasonTransition } from '../lib/career/seasonTransition';
import { migrateCareerState } from '../lib/career/saveMigration';
import { withoutReplayPayloads } from '../lib/career/matchArchiveSummary';
import { acceptBoardContract } from '../lib/manager/managerCareer';
import { acceptJobOffer } from '../lib/manager/changeClub';
import { openOffers } from '../lib/manager/managerCareer';
import { answerConcern } from '../lib/players/talks';
import { submitBoardRecoveryPlan } from '../lib/board/board';
import { withoutNationalDuty } from '../lib/nationalTeam/duty';
import { getCareerSquad } from '../lib/career/careerWorld';
import { isSelectableForMatch } from '../lib/career/playerStatus';
import { resolveClubMatchPlanForFixture } from '../lib/career/playerMatchStrength';
import { getPlayerFixtureOn } from '../lib/career/calendar';
import { approveProposal, delegationOf, pendingProposals, rejectProposal, setDelegation } from '../lib/delegation/delegation';
import { opponentScoutingCandidates, setScoutingDelegate } from '../lib/scouting/opponentScouting';
import { setRoutinePressDelegation } from '../lib/media/actions';
import type { CareerState } from '../lib/career/types';

const SEASONS = Number(process.env.HM_M60_SEASONS ?? 5);

function delegateEverything(s: CareerState): CareerState {
  let n = s;
  n = setDelegation(n, 'TRAINING_SCHEDULE', 'DELEGATE');
  n = setDelegation(n, 'SCOUTING_ASSIGNMENTS', 'DELEGATE');
  n = setDelegation(n, 'PLAYER_RECRUITMENT', 'ADVISE');
  n = setDelegation(n, 'CONTRACT_RENEWALS', 'ADVISE');
  n = setDelegation(n, 'STAFF_HIRING', 'ADVISE');
  const analyst = opponentScoutingCandidates(n)[0];
  if (analyst) n = setScoutingDelegate(n, analyst.id);
  return setRoutinePressDelegation(n, true);
}

function metrics(s: CareerState) {
  const d = delegationOf(s);
  const byStatus: Record<string, number> = {};
  for (const p of Object.values(d.proposals)) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  const logPerArea: Record<string, number> = {};
  for (const e of d.log) logPerArea[e.area] = (logPerArea[e.area] ?? 0) + 1;
  const json = JSON.stringify(withoutReplayPayloads(s));
  return {
    date: s.gameDate, season: s.seasonId, club: s.playerClubId,
    proposals: Object.keys(d.proposals).length, byStatus,
    trainingPlanProposals: Object.values(d.proposals).filter((p) => p.action.kind === 'TRAINING_PLAN').length,
    log: d.log.length, logPerArea,
    scoutReports: Object.keys(s.scoutReports).length, scoutDiscoveries: Object.keys(s.scoutDiscoveries).length,
    scoutingAssignments: Object.keys(s.scoutingAssignments).length,
    activeAssignments: Object.values(s.scoutingAssignments).filter((a) => a.status === 'IN_PROGRESS').length,
    opponentRequests: Object.keys(s.opponentScouting?.requests ?? {}).length, opponentReports: Object.keys(s.opponentScouting?.reports ?? {}).length,
    opponentDelegate: Boolean(s.opponentScouting?.delegateStaffId), delegatePress: Boolean(s.media?.delegatePress),
    careerEvents: s.careerEvents.length, inbox: s.inbox.length,
    delegationBytes: JSON.stringify(s.delegation ?? null).length,
    scoutingBytes: JSON.stringify([s.scoutReports, s.scoutDiscoveries, s.scoutingAssignments]).length,
    saveBytes: json.length, saveGzipBytes: gzipSync(json).length,
  };
}

async function main() {
  const dir = process.env.HM_M60_QA_DIR;
  assert.ok(dir, 'Set HM_M60_QA_DIR to a C:/DEV/QA/reports directory');
  mkdirSync(dir, { recursive: true });
  const checkpoint = join(dir, 'checkpoint.json'), reportPath = join(dir, 'm6-0-state-hygiene-career.json');
  const prior = process.argv.includes('--resume') && existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : undefined;
  let s: CareerState;
  if (prior) s = migrateCareerState(JSON.parse(readFileSync(checkpoint, 'utf8')));
  else {
    const comps = SWEDISH_WORLD_COMPETITION_IDS;
    const squads = Object.assign({}, ...comps.map((c) => snapshotWorldSquads(c)));
    const ratings = Object.assign({}, ...comps.map((c) => snapshotGameplayRatings(c)));
    const staff = Object.assign({}, ...comps.map((c) => snapshotAllClubsStaff(c)));
    s = delegateEverything(createNewCareerState('m6-0-state-hygiene', 'swe2-tumba', squads, undefined, ratings, staff, 'FIRST_MATCH'));
  }
  const seasons: unknown[] = prior?.seasons ?? [];
  const issued: Record<string, string> = prior?.issued ?? {}; // proposal id -> createdOn, across the whole run
  const counters = prior?.counters ?? { matches: 0, approved: 0, rejected: 0, approveFailed: 0, clubChanges: 0, pressNotices: 0, analystNotices: 0, reloads: 0 };
  const started = Date.now();
  let lastMonth = '';
  const track = () => {
    for (const p of Object.values(delegationOf(s).proposals)) {
      const seen = issued[p.id];
      assert.ok(seen === undefined || seen === p.createdOn, `proposal id ${p.id} reused (first ${seen}, now ${p.createdOn})`);
      issued[p.id] = p.createdOn;
    }
  };
  const write = (status: string, extra: Record<string, unknown> = {}) => writeFileSync(reportPath, JSON.stringify({ status, seasonsTarget: SEASONS, seasons, counters, issued, uniqueProposalIds: Object.keys(issued).length, ...extra }, null, 2));
  try {
    for (let season = seasons.length; season < SEASONS; season++) {
      const from = s.seasonId;
      for (let guard = 0; guard < 4000 && !s.seasonComplete; guard++) {
        if (s.board?.contractOffer && s.board.contractOffer.expiresOn >= s.gameDate) s = acceptBoardContract(s);
        if (s.managerCareer?.seekingJob) {
          const offer = openOffers(s)[0];
          if (offer) { s = delegateEverything(acceptJobOffer(s, offer.id)); counters.clubChanges++; }
        }
        // The manager answers his staff the way a manager would: shortlists and scouting yes, money decisions alternately.
        for (const p of pendingProposals(s)) {
          if (p.action.kind === 'TRAINING_PLAN') continue;
          const yes = p.action.kind === 'SHORTLIST' || p.action.kind === 'START_SCOUTING' || counters.approved <= counters.rejected;
          try { s = yes ? approveProposal(s, p.id) : rejectProposal(s, p.id); if (yes) counters.approved++; else counters.rejected++; }
          catch { counters.approveFailed++; }
        }
        const press = continueCareerRhythm(s);
        s = press.state;
        track();
        if (s.gameDate.slice(0, 7) !== lastMonth) { lastMonth = s.gameDate.slice(0, 7); console.log(JSON.stringify({ date: s.gameDate, season: s.seasonId, matches: counters.matches, minutes: Math.round((Date.now() - started) / 60000), proposals: Object.keys(delegationOf(s).proposals).length, stop: press.stopReason })); }
        if (press.stopReason === 'ACTION_REQUIRED' || press.stopReason === 'ACTION_REQUIRED_PENDING') {
          let handled = false;
          for (const c of Object.values(s.playerDynamics?.concerns ?? {}).filter((c) => c.status === 'OPEN')) { const option = c.options.find((o) => ['EARN_IT', 'PATIENCE', 'LATER'].includes(o.id)) ?? c.options[0]; if (option) { s = answerConcern(s, c.id, option.id); handled = true; } }
          for (const m of s.board?.meetings ?? []) { if (s.careerEvents.some((e) => e.id === `BOARD_UPDATE:${m.id}` && e.requiresAction && !e.resolved) && ['WARNING', 'FINAL_WARNING'].includes(m.kind)) { s = submitBoardRecoveryPlan(s, m.id); handled = true; } }
          const fixture = getPlayerFixtureOn(s, s.gameDate);
          if (!fixture && handled) continue;
          let shortHanded = false;
          if (fixture) {
            const available = withoutNationalDuty(s, getCareerSquad(s).filter((p) => isSelectableForMatch(s.playerStatuses, p.id)));
            const plan = resolveClubMatchPlanForFixture(s.playerClubId, fixture.id, available, undefined);
            // This scenario does not sign players; when injuries leave no valid seven (e.g. the only
            // goalkeeper out) the match is resolved by the legacy simulator instead of the V2 engine.
            if (plan) s = { ...s, matchPlans: { ...s.matchPlans, [fixture.id]: plan } };
            else shortHanded = true;
          }
          if (s.managerCareer?.seekingJob) continue;
          if (shortHanded) counters.shortHandedMatches = (counters.shortHandedMatches ?? 0) + 1;
          const action = shortHanded ? playManagerFixtureLegacy(s) : playManagerFixture(s);
          assert.ok(action.result, JSON.stringify({ date: s.gameDate, pending: s.careerEvents.filter((e) => e.requiresAction && !e.resolved).map((e) => [e.type, e.subject]) }));
          s = action.state; counters.matches++;
        }
        assert.notEqual(press.stopReason, 'CALENDAR_CONFLICT');
      }
      assert.ok(s.seasonComplete, `season ${from} did not complete`);
      const beforeRollover = metrics(s);
      const transition = attemptSeasonTransition(s);
      assert.equal(transition.status, 'APPLIED', JSON.stringify(transition.blockers));
      s = transition.state;
      const afterRollover = metrics(s);
      // Reload exactly like a browser save, then keep going.
      const reloaded = migrateCareerState(JSON.parse(JSON.stringify(withoutReplayPayloads(s))));
      // Compared as stored JSON: absent and undefined optional fields are the same save.
      const asSaved = (v: unknown) => JSON.parse(JSON.stringify(v ?? null));
      assert.deepEqual(asSaved(reloaded.delegation), asSaved(s.delegation), 'reload keeps delegation');
      assert.deepEqual(asSaved([reloaded.scoutReports, reloaded.scoutDiscoveries, reloaded.scoutingAssignments]), asSaved([s.scoutReports, s.scoutDiscoveries, s.scoutingAssignments]), 'reload keeps scouting');
      s = reloaded; counters.reloads++;
      counters.pressNotices = s.careerEvents.filter((e) => e.id.startsWith('MANAGER_CAREER:press-delegation-reset:')).length;
      counters.analystNotices = s.careerEvents.filter((e) => e.id.includes('opponent-analysis-unassigned')).length;
      // A1 bounds: after a rollover only pending proposals and decided ones from the last 56 days remain.
      const keepFrom = new Date(Date.parse(`${beforeRollover.date}T00:00:00Z`) - 56 * 864e5).toISOString().slice(0, 10);
      for (const p of Object.values(delegationOf(s).proposals)) assert.ok(p.status === 'PENDING' || (p.decidedOn ?? p.expiresOn) >= keepFrom, `${p.id} should have been compacted`);
      for (const [area, n] of Object.entries(afterRollover.logPerArea)) assert.ok(n <= 40, `${area} log ${n} > 40`);
      seasons.push({ from, to: s.seasonId, beforeRollover, afterRollover, minutes: Math.round((Date.now() - started) / 60000) });
      console.log('ROLLOVER ' + JSON.stringify({ from, to: s.seasonId, before: beforeRollover.proposals, after: afterRollover.proposals, saveGzip: afterRollover.saveGzipBytes }));
      writeFileSync(checkpoint, JSON.stringify(withoutReplayPayloads(s)));
      write('RUNNING');
    }
    const after = seasons.map((x) => (x as { afterRollover: { proposals: number; delegationBytes: number; scoutingBytes: number } }).afterRollover);
    write('PASS', { growth: { proposalsAfterEachRollover: after.map((a) => a.proposals), delegationBytesAfterEachRollover: after.map((a) => a.delegationBytes), scoutingBytesAfterEachRollover: after.map((a) => a.scoutingBytes) } });
    console.log('PASS');
  } catch (error) {
    writeFileSync(join(dir, 'failure-state.json'), JSON.stringify(withoutReplayPayloads(s)));
    write('FAIL', { error: String(error instanceof Error ? error.stack : error), date: s.gameDate });
    throw error;
  }
}
void main();
