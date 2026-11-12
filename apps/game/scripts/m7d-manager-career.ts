// HM-M7D: a realistic multi-season manager career through the normal game paths --
// native V2 matches with a selected lineup, the ordinary Continue rhythm, a voluntary
// resignation, unemployment with a running calendar, save/reload through the save
// repository while unemployed, a new job in another division found through the job
// market, and season transitions. Nothing is injected into the manager's context:
// every move uses the same functions the career UI calls.
//
//   HM_M7D_QA_DIR=C:/DEV/QA/reports/handball-m7d-manager-career node --import tsx scripts/m7d-manager-career.ts
import './register-asset-loader.cjs';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../lib/career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../lib/gameWorld/serverSnapshot';
import { snapshotAllClubsStaff } from '../lib/gameWorld/staffIdentitySnapshot';
import { SWEDISH_WORLD_COMPETITION_IDS } from '../lib/career/worldCompetitions';
import { continueCareerRhythm } from '../lib/career/continueController';
import { getCareerSquad } from '../lib/career/careerWorld';
import { playManagerFixture } from '../lib/career/matchdayAction';
import { getPlayerFixtureOn } from '../lib/career/calendar';
import { isSelectableForMatch } from '../lib/career/playerStatus';
import { resolveClubMatchPlanForFixture } from '../lib/career/playerMatchStrength';
import { withoutNationalDuty } from '../lib/nationalTeam/duty';
import { answerConcern } from '../lib/players/talks';
import { submitBoardRecoveryPlan } from '../lib/board/board';
import { answerPress, delegatePress, openPressConferences } from '../lib/media/press';
import { withEvents } from '../lib/manager/events';
import { renewPlayerContract } from '../lib/career/contractRenewal';
import { intentionMinimumWage } from '../lib/players/intentions';
import { attemptSeasonTransition } from '../lib/career/seasonTransition';
import { createSave, getSave, saveCareerState, __setSaveBackendForTests } from '../lib/save/saveRepository';
import { createMemoryBackend } from '../lib/save/saveStorage';
import { migrateCareerState } from '../lib/career/saveMigration';
import { withoutReplayPayloads } from '../lib/career/matchArchiveSummary';
import { acceptJobOffer, clubChangeBlocker } from '../lib/manager/changeClub';
import {
  acceptBoardContract, answerInterview, applyForJob, assessCandidate, clubStature, clubWish, leagueLevel, leagueName,
  managerCareerOf, managerCareerSummary, openOffers, openVacancies, resignationPreview, resignFromClub,
} from '../lib/manager/managerCareer';
import { clubCompetitionId } from '../lib/career/competitionMembership';
import { competitionClubIds } from '../lib/competition/tables';
import { getClub } from '../lib/game-data';
import type { CareerState } from '../lib/career/types';
import type { CareerEvent } from '../lib/career/careerEvents';

const SEASONS = Number(process.env.HM_M7D_SEASONS ?? 3);
const out = process.env.HM_M7D_QA_DIR ?? 'C:/DEV/QA/reports/handball-m7d-manager-career';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v) ?? 'null').digest('hex');
const name = (id: string) => getClub(id)?.name ?? id;
const log: unknown[] = [];
const note = (kind: string, data: Record<string, unknown>) => { const e = { kind, ...data }; log.push(e); console.log(JSON.stringify(e)); };

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const comps = [...SWEDISH_WORLD_COMPETITION_IDS];
  const squads = Object.assign({}, ...comps.map((c) => snapshotWorldSquads(c)));
  const ratings = Object.assign({}, ...comps.map((c) => snapshotGameplayRatings(c)));
  const staff = Object.assign({}, ...comps.map((c) => snapshotAllClubsStaff(c)));
  let s: CareerState = createNewCareerState('m7d-normal-career', 'swe2-tumba', squads, undefined, ratings, staff, '4_WEEKS');
  __setSaveBackendForTests(createMemoryBackend());
  const save = await createSave({ selectedNations: ['SWE'], selectedCompetitionIds: comps, clubId: s.playerClubId, manager: { name: 'M7D QA manager', nationality: 'SWE', dateOfBirth: '1982-03-01' }, gameDate: s.gameDate });
  const startReputation = managerCareerOf(s).reputation;
  const identity = Object.values(s.worldSquads).flat().map((p) => [p.id, p.firstName, p.lastName, p.birthYear]);
  let managerMatches = 0, v2Matches = 0, reloads = 0, unemployedDays = 0, unemployedPresses = 0;
  const scenario: Record<string, unknown> = {};

  const persistReload = async (label: string) => {
    await saveCareerState(save.saveId, s);
    const stored = (await getSave(save.saveId))!.careerState!;
    const loaded = migrateCareerState(JSON.parse(JSON.stringify(stored)));
    assert.deepEqual(loaded.managerCareer, s.managerCareer, `${label}: manager career survives save/load`);
    assert.equal(loaded.playerClubId, s.playerClubId);
    assert.equal(hash(loaded.results), hash(s.results));
    assert.equal(hash(loaded.fixtures), hash(withoutReplayPayloads(s).fixtures));
    s = loaded; reloads++;
  };

  const handleDecisions = (): boolean => {
    let handled = false;
    if (s.board?.contractOffer && s.board.contractOffer.expiresOn >= s.gameDate) { s = acceptBoardContract(s); handled = true; }
    for (const c of Object.values(s.playerDynamics?.concerns ?? {}).filter((c) => c.status === 'OPEN')) { const o = c.options.find((x) => ['EARN_IT', 'PATIENCE', 'LATER'].includes(x.id)) ?? c.options[0]; if (o) { s = answerConcern(s, c.id, o.id); handled = true; } }
    for (const m of s.board?.meetings ?? []) if (s.careerEvents.some((e) => e.id === `BOARD_UPDATE:${m.id}` && e.requiresAction && !e.resolved) && ['WARNING', 'FINAL_WARNING'].includes(m.kind)) { s = submitBoardRecoveryPlan(s, m.id); handled = true; }
    for (const press of openPressConferences(s)) {
      // An assistant takes it when the club has one; otherwise the manager answers diplomatically himself.
      const events: CareerEvent[] = [];
      try { s = delegatePress(s, press.id, (e) => events.push(e)); }
      catch { s = answerPress(s, press.id, Object.fromEntries(press.questions.map((q) => [q.id, 'DIPLOMATIC' as const])), (e) => events.push(e)); }
      s = withEvents(s, events); handled = true;
    }
    return handled;
  };

  const renewals = () => {
    if (s.managerCareer?.seekingJob) return;
    for (const p of s.worldSquads[s.playerClubId] ?? []) {
      const c = s.playerContracts[p.id];
      if (c && c.contractEndDate <= `${Number(s.gameDate.slice(0, 4)) + 1}-05-31` && c.contractEndDate >= s.gameDate && s.gameDate.slice(5, 7) === '03') {
        try { s = renewPlayerContract(s, p.id, 2, Math.max(c.wageEurPerMonth, intentionMinimumWage(s, p.id))); } catch { /* ordinary refusal */ }
      }
    }
  };

  /** The manager picks an available seven (default plan from the selectable squad) and plays the native V2 match. */
  const playOwn = () => {
    const fixture = getPlayerFixtureOn(s, s.gameDate);
    assert.ok(fixture, 'matchday fixture');
    const available = withoutNationalDuty(s, getCareerSquad(s).filter((p) => isSelectableForMatch(s.playerStatuses, p.id)));
    const plan = resolveClubMatchPlanForFixture(s.playerClubId, fixture.id, available, undefined);
    assert.ok(plan, 'a valid lineup can be selected');
    s = { ...s, matchPlans: { ...s.matchPlans, [fixture.id]: plan } };
    const r = playManagerFixture(s);
    assert.ok(r.result, JSON.stringify({ date: s.gameDate, pending: s.careerEvents.filter((e) => e.requiresAction && !e.resolved).map((e) => e.id) }));
    if (r.result.engine === 'V2') v2Matches++;
    s = r.state; managerMatches++;
    return { fixture: fixture.id, engine: r.result.engine, score: [r.result.homeGoals, r.result.awayGoals] };
  };

  /** One ordinary step: answer decisions, play a due matchday, or press Continue. */
  const step = () => {
    renewals();
    if (handleDecisions()) return 'DECISION';
    const pending = s.careerEvents.filter((e) => e.requiresAction && !e.resolved);
    if (pending.some((e) => e.type === 'MATCHDAY_READY') && getPlayerFixtureOn(s, s.gameDate)) { playOwn(); return 'MATCH'; }
    const before = s.processedThroughDate;
    const r = continueCareerRhythm(s);
    assert.notEqual(r.stopReason, 'CALENDAR_CONFLICT', JSON.stringify(r.events.at(-1)));
    assert.notEqual(r.stopReason, 'ACTION_REQUIRED_PENDING', JSON.stringify(pending.map((e) => e.id)));
    s = r.state;
    if (s.managerCareer?.seekingJob) { unemployedPresses++; unemployedDays += r.daysProcessed; }
    return before === s.processedThroughDate && r.stopReason !== 'SEASON_COMPLETE' ? 'STUCK' : r.stopReason;
  };

  const runUntil = (pred: () => boolean, guardDays = 400) => {
    const limit = new Date(Date.parse(`${s.gameDate}T00:00:00Z`) + guardDays * 86400000).toISOString().slice(0, 10);
    for (let g = 0; g < 5000 && !pred(); g++) {
      const r = step();
      assert.notEqual(r, 'STUCK', `Continue made no progress on ${s.gameDate}`);
      assert.ok(s.gameDate <= limit, `ran past ${limit}`);
      if (s.seasonComplete) return;
    }
  };

  const consistency = (label: string) => {
    const c = managerCareerOf(s);
    const logSum = (c.reputationLog ?? []).reduce((n, r) => n + r.delta, 0);
    assert.equal(startReputation + logSum, c.reputation, `${label}: every reputation change is logged`);
    assert.ok(c.stints.filter((x) => !x.to).length === (c.seekingJob ? 0 : 1), `${label}: open stint matches employment`);
    for (let i = 1; i < c.stints.length; i++) assert.ok(c.stints[i - 1]!.to && c.stints[i - 1]!.to! <= c.stints[i]!.from, `${label}: stints in order without overlap`);
    const summary = managerCareerSummary(s);
    assert.equal(summary.record.played, managerMatches, `${label}: career record equals the matches he coached`);
    const ids = Object.values(s.worldSquads).flat().map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `${label}: unique player registrations`);
    return { reputation: c.reputation, stints: c.stints.length, summary };
  };

  // ---------------------------------------------------------------- Season 1 at Tumba (Allsvenskan)
  note('START', { club: name(s.playerClubId), league: leagueName(s.competitionId), reputation: startReputation, date: s.gameDate });
  runUntil(() => s.gameDate >= '2026-11-10' && !getPlayerFixtureOn(s, s.gameDate) && resignationPreview(s).allowed);
  const tumbaMatches = managerMatches;
  note('BEFORE_RESIGNATION', { date: s.gameDate, managerMatches, v2Matches, reputation: managerCareerOf(s).reputation, preview: resignationPreview(s) });

  // A. Voluntary resignation.
  const oldClub = s.playerClubId;
  const oldFixturesUnplayed = s.fixtures.filter((f) => (f.homeClubId === oldClub || f.awayClubId === oldClub) && !s.results[f.id]).map((f) => f.id);
  s = resignFromClub(s);
  assert.equal(managerCareerOf(s).seekingJob?.reason, 'RESIGNED');
  assert.throws(() => resignFromClub(s));
  scenario.A_resignation = { date: s.gameDate, club: name(oldClub), stint: managerCareerOf(s).stints.at(-1), reputation: managerCareerOf(s).reputation };
  await persistReload('after resignation');

  // E. Unemployed: the calendar continues; reload while unemployed.
  const unemployedFrom = s.gameDate;
  runUntil(() => s.gameDate >= '2026-11-24', 30);
  assert.ok(managerCareerOf(s).seekingJob);
  await persistReload('while unemployed');
  const interimPlayed = oldFixturesUnplayed.filter((id) => s.results[id]).length;
  assert.ok(interimPlayed > 0, 'the old club played on under an interim');
  scenario.E_unemployed_reload = { from: unemployedFrom, reloadedOn: s.gameDate, interimMatchesPlayed: interimPlayed, openVacancies: openVacancies(s).map((v) => ({ club: name(v.clubId), league: leagueName(clubCompetitionId(s, v.clubId)) })), offers: openOffers(s).map((o) => ({ club: name(o.clubId), source: o.source })) };

  // B/C. Find the next job through the normal market: wait for a club to call (until early January), else apply.
  runUntil(() => openOffers(s).length > 0 || s.gameDate >= '2027-01-05', 60);
  let route: string;
  let offerId: string | undefined;
  const otherDivision = (clubId: string) => leagueLevel(clubCompetitionId(s, clubId)) !== leagueLevel(clubCompetitionId(s, oldClub));
  const approached = openOffers(s).sort((a, b) => Number(otherDivision(b.clubId)) - Number(otherDivision(a.clubId)) || clubStature(s, b.clubId) - clubStature(s, a.clubId));
  if (approached.length) { offerId = approached[0]!.id; route = `approach (${approached[0]!.source})`; }
  else {
    const vacancies = openVacancies(s).sort((a, b) => Number(otherDivision(b.clubId)) - Number(otherDivision(a.clubId)) || clubStature(s, a.clubId) - clubStature(s, b.clubId));
    assert.ok(vacancies.length > 0, 'the job market has an open vacancy by early January');
    const target = vacancies[0]!.clubId;
    s = applyForJob(s, target);
    const app = Object.values(managerCareerOf(s).applications).find((a) => a.clubId === target && a.status === 'INTERVIEW')!;
    // The manager reads the club's situation; the questions themselves hint at what the board wants.
    const w = clubWish(s, target);
    s = answerInterview(s, app.id, { goal: w.goal, youth: w.youth, money: w.money });
    runUntil(() => managerCareerOf(s).applications[app.id]!.status !== 'ANSWERED', 10);
    const verdict = managerCareerOf(s).applications[app.id]!;
    note('INTERVIEW', { club: name(target), status: verdict.status, note: verdict.note });
    offerId = openOffers(s).find((o) => o.clubId === target)?.id ?? openOffers(s)[0]?.id;
    route = `application (${verdict.status})`;
  }
  assert.ok(offerId, 'a genuine offer exists');
  const offer = managerCareerOf(s).offers[offerId]!;
  assert.equal(clubChangeBlocker(s, offer.clubId), null);
  const beforeMove = { players: hash(Object.values(s.worldSquads).flat().map((p) => p.id).sort()), contracts: Object.keys(s.playerContracts).length, fixtures: hash(s.fixtures), results: hash(s.results) };
  s = acceptJobOffer(s, offerId);
  assert.throws(() => acceptJobOffer(s, offerId!), 'repeated acceptance is refused');
  assert.equal(hash(Object.values(s.worldSquads).flat().map((p) => p.id).sort()), beforeMove.players, 'no player registrations change on appointment');
  assert.equal(Object.keys(s.playerContracts).length, beforeMove.contracts);
  assert.equal(hash(s.fixtures), beforeMove.fixtures); assert.equal(hash(s.results), beforeMove.results);
  scenario.B_offer = { route, club: name(offer.clubId), source: offer.source, stature: clubStature(s, offer.clubId), reputation: managerCareerOf(s).reputation, assessment: assessCandidate(s, offer.clubId) };
  scenario.C_division_move = { from: leagueName(clubCompetitionId(s, oldClub)), to: leagueName(s.competitionId), crossDivision: leagueLevel(s.competitionId) !== leagueLevel(clubCompetitionId(s, oldClub)), unemployedDays: s.gameDate.localeCompare(unemployedFrom) >= 0 ? Math.round((Date.parse(s.gameDate) - Date.parse(unemployedFrom)) / 86400000) : 0 };
  note('APPOINTED', { date: s.gameDate, ...scenario.B_offer as object, ...scenario.C_division_move as object });
  await persistReload('after appointment');

  // First native V2 match at the new club with a selected lineup, then reload.
  const firstNew = managerMatches;
  runUntil(() => managerMatches > firstNew, 60);
  assert.ok(v2Matches > 0, 'native V2 matches');
  await persistReload('after first match at new club');
  scenario.first_match_new_club = { date: s.gameDate, club: name(s.playerClubId), engineV2Matches: v2Matches };

  // ---------------------------------------------------------------- Seasons: finish, transition, repeat
  const seasons: unknown[] = [];
  for (let n = 1; n <= SEASONS; n++) {
    runUntil(() => s.seasonComplete, 400);
    assert.ok(s.seasonComplete, `season ${s.seasonId} completes`);
    const check = consistency(`season ${s.seasonId}`);
    const transition = attemptSeasonTransition(s);
    assert.equal(transition.status, 'APPLIED', JSON.stringify(transition.blockers));
    const from = s.seasonId;
    s = transition.state;
    await persistReload(`after transition ${from}`);
    const c = managerCareerOf(s);
    assert.equal(managerCareerSummary(s).record.played, check.summary.record.played, 'the transition keeps the career record');
    const entry = { season: from, club: name(c.stints.at(-1)!.clubId), employed: !c.seekingJob, reputation: c.reputation, lastSeason: c.stints.at(-1)!.seasons.at(-1), summary: managerCareerSummary(s), reputationChanges: (c.reputationLog ?? []).filter((r) => r.date >= `${from.slice(0, 4)}-07-01`) };
    seasons.push(entry);
    note('SEASON', entry);
    if (n === SEASONS) break;
  }
  const final = consistency('final');
  const finalPlayers = Object.values(s.worldSquads).flat(), byId = new Map(finalPlayers.map((p) => [p.id, [p.id, p.firstName, p.lastName, p.birthYear]]));
  for (const p of identity) if (byId.has(p[0] as string)) assert.deepEqual(byId.get(p[0] as string), p, 'canonical identities unchanged by ID');

  // G. Plausible recruitment: how clubs at each level read this manager now.
  const levels = ['se_handbollsligan_herr', 'swe-2', 'se_division1_norra'].map((comp) => {
    const ids = competitionClubIds(s, comp).sort((a, b) => clubStature(s, b) - clubStature(s, a));
    return [ids[0]!, ids.at(-1)!].map((id) => { const a = assessCandidate(s, id); return { club: name(id), league: leagueName(comp), need: a.need, reputation: a.reputation, experience: a.experiencePoints, parts: a.parts, wouldConsider: a.reputation + a.experiencePoints >= a.need - 4 }; });
  }).flat();
  const result = {
    status: 'PASS', seed: 'm7d-normal-career', startClub: 'Tumba', seasonsCompleted: SEASONS, finalDate: s.gameDate,
    managerMatches, nativeV2Matches: v2Matches, tumbaMatchesBeforeResignation: tumbaMatches, repositoryReloads: reloads, unemployedPresses, unemployedDaysProcessed: unemployedDays,
    scenarios: scenario, seasons, final: { ...final, career: managerCareerOf(s) }, recruitmentView: levels,
  };
  fs.writeFileSync(path.join(out, 'm7d-career-scenario.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(out, 'm7d-career-log.json'), JSON.stringify(log, null, 2));
  console.log(JSON.stringify({ ...result, seasons: seasons.length, final: final.summary, recruitmentView: levels.map((l) => `${l.club}:${l.wouldConsider}`) }));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
