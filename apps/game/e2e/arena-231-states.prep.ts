// Arena 231 states -- headless career progression for the states a fresh career cannot reach in minutes
// (season end, closed months, board verdicts and decisions, injuries, incoming bids, a suspended manager).
//
// No fabricated data. The career is created by the game's own getOrCreateCareerState (the function /new-game's
// createNewCareerSave calls; its /api/game-world fetches are answered by the running app at HM_QA_URL) with the
// New Game defaults (Sverige, Handbollsligan + Allsvenskan, Tumba, "Avkast" = first competitive match), and it is
// advanced only with the functions the UI buttons call:
//   - Continue:                continueCareerRhythm (CareerContext.continueCareer)
//   - matchday:                playManagerFixture (CareerContext.playManagerFixture: the production match played
//                              to the end, the assistant on the bench); when the carried line-up is not playable,
//                              Taktik's "Assistentens förslag" + "Tillämpa förslaget" (buildDefaultMatchPlan →
//                              setMatchPlan), exactly what the e2e helper chooseStartingSeven clicks
//   - player talk (inbox):     answerConcern(first option)                  (InboxDecision)
//   - transfer request:        decideTransferRequest(ACCEPT)                (InboxDecision "Godkänn – lyssna på bud")
//   - board recovery plan:     submitBoardRecoveryPlan                      (InboxDecision / board meeting)
//   - press conference:        answerPressAction (the press room's tone buttons) -- a question on the referees is
//                              answered with the PROVOCATIVE tone (questioning their impartiality), every other
//                              question DIPLOMATIC; when there is no referee question the assistant takes it
//                              (delegatePressAction, "Låt … svara").
// The referee answers are the manager's real choice that leads, through the game's own discipline rules
// (lib/media/discipline.ts: a second reported statement within a year → Disciplinnämnden → avstängning), to the
// suspended-manager matchday (MDY-02k). Nothing in the career is edited by hand.
//
// Snapshots are written in the real portable backup format (lib/save/portableCareerBackup.ts, what Inställningar →
// Data → Exportera produces), validated with validatePortableCareerBackup, and imported by the spec through
// Inställningar → Data → Importera sparfil. A manifest (states.json) records why each snapshot was taken.
//
// Run (from apps/game): HM_QA_URL=http://localhost:3001 HM_STATES_DIR=<dir> \
//   node --max-old-space-size=12288 --import ./scripts/register-asset-loader.cjs --import tsx e2e/arena-231-states.prep.ts
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.HM_QA_URL ?? 'http://localhost:3001';
const OUT = process.env.HM_STATES_DIR ?? 'C:/DEV/QA/reports/arena-231/states/saves';
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => realFetch(typeof input === 'string' && input.startsWith('/') ? `${BASE}${input}` : input, init)) as typeof fetch;

async function main() {
  const { getOrCreateCareerState } = await import('../lib/career/careerInitialization');
  const { continueCareerRhythm } = await import('../lib/career/continueController');
  const { playManagerFixture } = await import('../lib/career/matchdayAction');
  const { CURRENT_SAVE_SCHEMA_VERSION } = await import('../lib/save/saveRepository');
  const { validatePortableCareerBackup } = await import('../lib/save/portableCareerBackup');
  const { getCareerSquad } = await import('../lib/career/careerWorld');
  const { getNextPlayerFixture } = await import('../lib/career/calendar');
  const { isSelectableForMatch } = await import('../lib/career/playerStatus');
  const { buildInitialMatchSquad } = await import('../lib/matchPlan/careerSquadBridge');
  const { buildDefaultMatchPlan } = await import('../lib/matchPlan/defaultMatchPlan');
  const { linkDefenceStarters } = await import('../lib/matchPlan/startingUnits');
  const { setMatchPlan } = await import('../lib/career/matchPlanActions');
  const { decisionFor } = await import('../lib/inbox/threads');
  const { answerConcern, decideTransferRequest } = await import('../lib/players/talks');
  const { submitBoardRecoveryPlan } = await import('../lib/board/board');
  const { answerPressAction, delegatePressAction, skipPressAction } = await import('../lib/media/actions');
  const { activeSuspension, openDisciplineCase } = await import('../lib/media/discipline');
  const { answersFor, openPressConferences } = await import('../lib/media/press');
  const { mediaOf } = await import('../lib/media/people');
  const { attemptSeasonTransition } = await import('../lib/career/seasonRollover');
  const { boardMinutes } = await import('../lib/club/boardMinutes');
  type CareerState = Awaited<ReturnType<typeof getOrCreateCareerState>>;

  mkdirSync(OUT, { recursive: true });
  // TRN-01f: the training page's Suspense fallback, rendered as a component (it is not observable in the running
  // app -- see the spec). The spec mounts this markup under the real /career/training stylesheets.
  {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { default: TrainingWeekSkeleton } = await import('../components/training/TrainingWeekSkeleton');
    writeFileSync(`${OUT}/trn-01f-skeleton.html`, renderToStaticMarkup(createElement(TrainingWeekSkeleton)));
    console.log('rendered TrainingWeekSkeleton');
    if (process.argv.includes('--skeleton-only')) return;
  }
  const now = new Date().toISOString();
  const draft = {
    saveId: 'save-arena-states', schemaVersion: CURRENT_SAVE_SCHEMA_VERSION, selectedNations: ['SWE'], selectedCompetitionIds: ['se_handbollsligan_herr', 'swe-2'],
    clubId: 'swe2-tumba', manager: { name: 'States Sweep', nationality: 'SWE', dateOfBirth: '1985-04-12' }, gameDate: '2026-08-19', preseasonStart: 'FIRST_MATCH' as const,
    createdAt: now, lastPlayedAt: now,
  };
  const t0 = Date.now();
  // --from=<snapshot>: continue a branch of the career from one of this script's own snapshots (the backup's career
  // state with its archives put back inline, exactly as the script held it when the snapshot was written).
  const FROM = process.argv.find((a) => a.startsWith('--from='))?.slice(7);
  const DISCIPLINE_FALLBACK = process.argv.includes('--discipline-fallback');
  let s: CareerState;
  if (FROM) {
    const b = JSON.parse(readFileSync(`${OUT}/${FROM}.json`, 'utf8'));
    s = { ...b.save.careerState, matchArchives: b.archives, matchArchiveIds: [] };
    console.log(`branch from snapshot ${FROM} @${s.gameDate} (${Object.keys(b.archives).length} archives)`);
  } else {
    s = await getOrCreateCareerState(draft as never, false);
    console.log(`created ${s.seasonId} ${s.gameDate} in ${Date.now() - t0} ms; world clubs ${Object.keys(s.worldSquads).length}`);
  }

  const manifest: Record<string, { file: string; gameDate: string; seasonId: string; why: string; facts: Record<string, unknown> }> =
    FROM && existsSync(`${OUT}/states.json`) ? JSON.parse(readFileSync(`${OUT}/states.json`, 'utf8')) : {};
  async function snapshot(name: string, state: CareerState, why: string, facts: Record<string, unknown> = {}) {
    if (manifest[name]) return;
    if (FROM && name !== 'suspended-matchday') return; // a branch only contributes the state it was started for
    const archives: Record<string, unknown> = { ...(state.matchArchives ?? {}) };
    const ids = [...new Set([...(state.matchArchiveIds ?? []), ...Object.keys(archives)])];
    const save = { ...draft, gameDate: state.gameDate, careerState: { ...state, matchArchives: undefined, matchArchiveIds: ids } };
    const backup = { backupVersion: 1 as const, exportedAt: new Date().toISOString(), save, archives };
    validatePortableCareerBackup(backup, CURRENT_SAVE_SCHEMA_VERSION);
    // Streamed: a full season's replay archives exceed what one JSON string should hold comfortably.
    const file = `${OUT}/${name}.json`;
    await new Promise<void>((resolve, reject) => {
      const w = createWriteStream(file);
      w.on('error', reject);
      w.write(`{"backupVersion":1,"exportedAt":${JSON.stringify(backup.exportedAt)},"save":${JSON.stringify(save)},"archives":{`);
      ids.forEach((id, i) => w.write(`${i ? ',' : ''}${JSON.stringify(id)}:${JSON.stringify(archives[id])}`));
      w.end('}}', resolve);
    });
    manifest[name] = { file, gameDate: state.gameDate, seasonId: state.seasonId, why, facts };
    writeFileSync(`${OUT}/states.json`, JSON.stringify(manifest, null, 1));
    console.log(`SNAPSHOT ${name} @${state.gameDate}: ${why} ${JSON.stringify(facts)}`);
  }

  /** Taktik → "Assistentens förslag" → "Tillämpa förslaget", when the carried line-up is not playable. */
  function assistantLineup(state: CareerState): CareerState {
    const fixture = getNextPlayerFixture(state);
    if (!fixture) return state;
    const squad = getCareerSquad(state).filter((p) => isSelectableForMatch(state.playerStatuses, p.id));
    const auto = buildDefaultMatchPlan(buildInitialMatchSquad(squad, fixture.id, state.playerClubId), state.tactics[state.playerClubId], state.playerMatchDefaults);
    if (!auto.ok || !auto.plan) throw new Error(`assistant could not build a line-up at ${state.gameDate}`);
    return setMatchPlan(state, fixture.id, linkDefenceStarters(auto.plan));
  }
  function playFixture(state: CareerState) {
    try { return playManagerFixture(state); }
    catch (e) { console.log(`  line-up: ${(e as Error).message.slice(0, 80)} -> assistant suggestion`); return playManagerFixture(assistantLineup(state)); }
  }

  const ownIds = (state: CareerState) => new Set(getCareerSquad(state).map((p) => p.id));
  const injured = (state: CareerState) => { const own = ownIds(state); return Object.values(state.playerInjuries ?? {}).filter((i) => own.has(i.playerId) && i.activeInjury).map((i) => i.playerId); };
  const openBids = (state: CareerState) => Object.values(state.incomingOffers ?? {}).filter((o) => /OPEN|OFFER_RECEIVED/.test(o.status));
  let provocative = 0;

  /** Answer every open inbox decision the way a manager does from the inbox; returns false when one is not handled. */
  async function resolvePending(state: CareerState): Promise<{ state: CareerState; handled: boolean }> {
    const pending = state.careerEvents.filter((e) => e.requiresAction && !e.resolved);
    let next = state;
    let handled = false;
    for (const ev of pending) {
      const msg = next.inbox.find((m) => m.careerEventId === ev.id);
      const d = msg ? decisionFor(next, msg) : null;
      if (!d) continue;
      if (d.kind === 'concern' && d.open) { next = answerConcern(next, d.concernId, d.options[0]!.id); handled = true; console.log(`  talk answered (${d.options[0]!.id})`); }
      else if (d.kind === 'transferRequest' && d.open) { next = decideTransferRequest(next, d.playerId, 'ACCEPT'); handled = true; console.log(`  transfer request accepted for ${d.playerId}`); }
      else if (d.kind === 'boardPlan' && d.open) {
        await snapshot('board-decision', next, 'open board decision: recovery plan requested (CLB-05b)', { meetingId: d.meetingId });
        next = submitBoardRecoveryPlan(next, d.meetingId); handled = true; console.log('  recovery plan submitted');
      } else if (d.kind === 'press' && d.open) {
        next = answerPress(next, d.pressId); handled = true;
      }
    }
    return { state: next, handled };
  }
  function answerPress(state: CareerState, pressId: string): CareerState {
    const press = mediaOf(state).press[pressId]!;
    const ref = press.questions.find((q) => q.topic === 'REFEREE' && q.answers.some((a) => a.tone === 'PROVOCATIVE'));
    if (ref && provocative < 2 && !activeSuspension(state)) {
      provocative++;
      const answers = Object.fromEntries(press.questions.map((q) => [q.id, q === ref ? 'PROVOCATIVE' : (q.answers.find((a) => a.tone === 'DIPLOMATIC') ?? q.answers[0]!).tone]));
      console.log(`  press ${press.title}: referee question answered PROVOCATIVE (#${provocative})`);
      return answerPressAction(state, pressId, answers as never);
    }
    try { console.log(`  press ${press.title}: delegated`); return delegatePressAction(state, pressId); }
    catch { console.log(`  press ${press.title}: declined`); return skipPressAction(state, pressId); }
  }

  let played = 0;
  let meetings = s.board?.meetings.length ?? 0;
  const discipline = () => Object.values(mediaOf(s).discipline);
  for (let i = 0; i < 3000 && !s.seasonComplete; i++) {
    if (FROM && manifest['suspended-matchday']?.gameDate && manifest['suspended-matchday'].gameDate >= (manifest[FROM]?.gameDate ?? '')) break;
    // Branch fallback (documented, only with --discipline-fallback). The season offers exactly one referee
    // controversy (Tumba–Drott, 2026-11-09); the provocative answer to it is reported and decided as a straffavgift
    // by the game itself. No second controversy follows within the year, so once that first case is decided the
    // second report is made with the game's own lib/media/discipline.ts openDisciplineCase(kind INTEGRITY) -- the
    // event a provocative referee answer creates -- with the text of the game's real PROVOCATIVE referee answer
    // (press.ts answersFor, topic REFEREE). Disciplinnämnden's decision (avstängning, a repeat offence), the
    // suspension and serving it are the game's own daily tick.
    if (DISCIPLINE_FALLBACK && !activeSuspension(s)) {
      const cases = discipline();
      const open = cases.some((c) => c.status === 'REPORTED' || c.status === 'APPEALED');
      if (!open && cases.length === 1 && cases[0]!.status === 'DECIDED') {
        const text = answersFor(s, { topic: 'REFEREE' }).find((a) => a.tone === 'PROVOCATIVE')?.text ?? '';
        s = openDisciplineCase(s, { statement: text, kind: 'INTEGRITY' });
        console.log(`  FALLBACK openDisciplineCase(INTEGRITY) @${s.gameDate}: "${text.slice(0, 80)}"`);
      }
    }
    const press = continueCareerRhythm(s);
    s = press.state;
    // A manager reading the press room: a conference with a question on the referees gets the provocative answer.
    for (const pc of openPressConferences(s)) if (pc.questions.some((q) => q.topic === 'REFEREE')) s = answerPress(s, pc.id);
    // State checks after each Continue press (the page the manager would now look at).
    const inj = injured(s);
    if (inj.length && !getNextPlayerFixture(s)?.date.startsWith(s.gameDate)) await snapshot('injury', s, 'own player injured (MED-01a)', { injured: inj });
    const bids = openBids(s);
    if (bids.length) await snapshot('incoming-bid', s, 'open incoming bid for an own player (REC-05)', { offers: bids.map((o) => ({ id: o.id, playerId: o.playerId, status: o.status, from: o.fromClubId })) });
    const m = s.board?.meetings ?? [];
    if (m.length > meetings) {
      const latest = m.at(-1)!;
      console.log(`  board meeting ${latest.kind} ${latest.verdict} ${latest.date}`);
      if (boardMinutes(s).verdictToday) await snapshot(`verdict-${latest.kind.toLowerCase()}`, s, `board verdict dated today (CLB-05a): ${latest.kind}/${latest.verdict}`, { meetingId: latest.id });
      meetings = m.length;
    }
    const pendingMatch = press.stopReason === 'ACTION_REQUIRED' || press.stopReason === 'ACTION_REQUIRED_PENDING';
    const fixtureToday = getNextPlayerFixture(s);
    if (pendingMatch && fixtureToday?.date === s.gameDate && activeSuspension(s)) await snapshot('suspended-matchday', s, 'matchday while the manager is suspended (MDY-02k)', { caseId: activeSuspension(s)!.id, fixtureId: fixtureToday.id });
    if (pendingMatch) {
      const r0 = await resolvePending(s);
      s = r0.state;
      if (fixtureToday?.date === s.gameDate && !s.results[fixtureToday.id]) {
        const r = playFixture(s);
        if (r.result) { s = r.state; played++; console.log(`match ${played} ${s.gameDate} ${r.result.homeGoals}-${r.result.awayGoals}`); continue; }
      }
      if (!r0.handled) {
        const kinds = s.careerEvents.filter((e) => e.requiresAction && !e.resolved).map((e) => `${e.type}:${e.id}`);
        console.log(`UNHANDLED pending at ${s.gameDate}: ${kinds.join(', ')}`);
        break;
      }
    }
  }
  const disc = Object.values(mediaOf(s).discipline);
  console.log(`season loop done ${s.gameDate} complete=${s.seasonComplete} played=${played} discipline=${JSON.stringify(disc.map((c) => [c.id, c.outcome, c.servedMatches, c.matches]))} in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (FROM) return;
  if (!s.seasonComplete) throw new Error('season did not complete');
  const bm = boardMinutes(s);
  await snapshot('season-complete', s, 'season complete, not rolled over (DSH-01c, MGR-03b, MDY-01f, CLB-06b/d, CLB-05a/b)', {
    verdictToday: bm.verdictToday?.kind ?? null, decision: bm.decision?.kind ?? null, gala: !!s.seasonOutcome, injured: injured(s), openBids: openBids(s).length,
  });
  const tr = attemptSeasonTransition(s);
  console.log(`season transition: ${tr.status}; blockers ${JSON.stringify(tr.blockers).slice(0, 600)}`);
  console.log(`total ${Math.round((Date.now() - t0) / 1000)} s`);
}

main().catch((e) => { console.error(e); process.exit(1); });
