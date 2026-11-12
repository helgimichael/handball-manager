# M6C/M6D + M7D Alpha release report

Date: 2026-11-12. Scope: push the verified main, deploy it to the existing Cloudflare Alpha Worker, and verify it live. No other environment was touched, no tester career was reset, and no M6 Scouting & Delegation work was started.

## Verdict: **PARTIAL**

The release is live and works for its main paths:
- assistant-led training;
- resignation with the calendar running;
- the job market across divisions and acceptance of a new club;
- save/reload while unemployed;
- AI clubs and transfers;
- loading of old saves.

Live QA found **one M7D regression** (see "Live regression" below). After a spell of unemployment, the first employed day turns the new club's past results into the manager's own media backlog. That opens stale post-match press conferences, which block Continue until answered or skipped. It is not data-corrupting and the deployment is not materially broken, so per the release rules it was **not rolled back** and **not fixed during verification**. A small follow-up fix is needed before this can be called PASS.

Live QA also surfaced a **pre-existing M1.2 blocker**, present identically in the rollback version. A human-managed club's qualification match cannot be started, because the fixture id contains "2026/27" and the match-day link is not URL-encoded (see "Pre-existing blocker"). It does not come from this release, but it blocks live season-end and rollover testing, and it affects testers on both versions.

## Commits and deployment

| Item | Value |
| --- | --- |
| Source (local main = origin/main) | `5383771c3f2f29c3d5964989be66e7d39bddbca2`, docs: M7D main integration report |
| Integration merge | `a0e5bf7acd5aa7e853ac6903ac055d4d8cc773fd` (M6C/M6D `8a9a499` + M7D `704dce5`, `788a4ff`) |
| Previous origin/main | `455f3693788fced30428dc3e5ecc4d8731a8cbb2` |
| Push | `455f369..5383771 main -> main`, fast-forward, no force. `git ls-remote origin refs/heads/main` = `5383771c3f2f29c3d5964989be66e7d39bddbca2` |
| Worker | `handball-manager-alpha` (existing; workers.dev only, no routes or custom domains) |
| **Deployed version** | **`a848413e-9f7b-4e18-8b26-2e0b850286b2`**, created 2026-11-12T13:47:57Z, message `M6C-M6D-M7D-manager-career-5383771c…` |
| Traffic | `deployments status`: **(100%) a848413e-9f7b-4e18-8b26-2e0b850286b2** |
| **Rollback target** | **`06194a7c-b82d-4edc-bb60-0a10424d17c9`** (main `455f369`, deployed 2026-11-11T18:19Z, previously at 100%) |
| URL | https://handball-manager-alpha.helgimichael.workers.dev |

To roll back if needed, run this from `apps/game` with the pinned Wrangler:

```
node cloudflare/node_modules/wrangler/bin/wrangler.js rollback 06194a7c-b82d-4edc-bb60-0a10424d17c9 --config wrangler.jsonc
```

## 1. Pre-release check

- Local main HEAD = `5383771`, the verified commit; the working tree was clean.
- `git fetch`: origin/main was still at `455f369` and had not moved. `origin/main..main` contained exactly `8a9a499`, `704dce5`, `788a4ff`, `a0e5bf7` and `5383771`, with no unrelated commits.
- The `5383771` tree differs from the fully tested merge `a0e5bf7` only by `M7D-MAIN-INTEGRATION-REPORT.md`, so the integration test results apply unchanged. The expensive baselines were not repeated.
- Baseline status is unchanged from the integration report. The same **12 pre-existing failures** occur on the untouched base `8a9a499`, the M7D branch and the integration. `cpuQualityUpgrade.test.ts` **times out at 90 min** on the base and on the integration alike.
- Results on the integration tree:
  - M1.2 (competition transitions 65/65, season, promotion, cup schedule 13/13);
  - M1.1 continuity;
  - M2 weekly loop (weeklyManagement 8/8, matchday);
  - M3.1 intentions (11/13; the 2 failures are the baseline ones);
  - M4.1 autonomous clubs (8/8).

  All were unchanged versus main.

## 2–3. Build and deploy

| Step | Result |
| --- | --- |
| Deploy tooling | The `apps/game/cloudflare` lockfile was installed with `npm ci --workspaces=false --omit=peer`, giving the pinned **@opennextjs/cloudflare 1.20.0** and **Wrangler 4.151.2** |
| Build location | The `m7d-main-integration` worktree at `5383771`, with its own `node_modules`. In the main worktree, `node_modules` is a junction into the main checkout, so `build-cloudflare-worker.mjs` refused to modify dependencies outside its checkout and changed nothing; this is the guard working as designed. The previous Alpha deploy was built the same way |
| Ignored bundle | `generate-real-world-bundle.mjs`: 827 canonical files |
| Production build | `next build --webpack` compiled; `/career/manager` and `/career/training` built |
| Worker build | `npm run build:worker` passed: OpenNext packaging, middleware-manifest bypass verified, artifacts verified. `sharp` was restored and the worktree left clean |
| Wrangler dry-run | Passed: 286 assets, **17,303.33 KiB / gzip 2,622.50 KiB**. Bindings: ASSETS and the 4 expected vars (`HM_EDITOR_ENABLED=false`, `HM_REAL_WORLD_DATA=bundled`) |
| Deploy | `wrangler deploy --config wrangler.jsonc --message …` uploaded in 17.6 s; Worker startup 15 ms |
| Live smoke | `GET /` 200; `/api/editor/status` 200; `/api/game-world/squad-snapshot?competitionId=se_division1_sodra` 200 (240,890 B) |

Logs in `C:/DEV/QA/logs/2026-11/`:
- `m6m7-alpha-cloudflare-npm-ci.log`
- `m6m7-alpha-worker-build.log`
- `m6m7-alpha-wrangler-dry-run.log`
- `m6m7-alpha-deploy.log`

## 4. Live QA

Browser: the Claude desktop app's built-in browser, a separate profile isolated from the user's Chrome. It started empty: no IndexedDB and no localStorage for the Alpha origin. **No tester data exists in this profile, and no tester career was touched.** One QA career was created: "QA Release M7D" at IFK Tumba HK, save `save-f5f3e949-2a07-44b3-a53f-09052c53d470`. It is preserved as-is in that profile.

### A. Existing Alpha

| Check | Result |
| --- | --- |
| Application loads | Pass: access gate, main menu, new-game wizard (6 steps), and career start at Tumba (Allsvenskan) |
| Existing career saves load | **Not possible live in this profile**: tester saves live in testers' own browsers. I built a real old-release save with the **previous release code (`455f369`)**: Tumba career, 5 native V2 matches with their 5 match archives, schema 8, no M7D fields, 55 MB portable backup. I imported it with the **release code's own `importSaveFromJson`**. Validation passed; all **5 archives read back byte-identical**; the career loaded with all 139 results; match history listed every archive; the manager summary worked; the career continued with 3 more native V2 matches; the old archives were still byte-identical afterwards; resignation was available. **PASS** (Node, release code). A live import through the pane was not possible: the pane blocks local resources from a public page and has no file picker. The backups are kept for a manual tester-style import (see Evidence) |
| Existing match archives intact | Pass (above). Live: the QA match `2026-cup-R32-15-l1` was archived, and its match report and archive summary were available after reloads |
| Weekly Manager | Pass: weekly plan view, Continue stops (matchday, press, inbox), and progression day by day |
| Competition | Pass: Svenska Cupen round of 32 over two legs, decided while unemployed ("Utslagna i sextondelsfinal"). Allsvenskan and Division 1 tables updated through the season; Division 1 Södra completed all 24 rounds |
| Transfers | Pass: an AI club (Skånela) bid €17,500 for Robin Dahlin on 2026-08-24 |

### B. Assistant-led training (IFK Tumba, assistant Helgi Magnusson from the club's staff data)

| Check | Result |
| --- | --- |
| Assistant proposes a weekly plan | Pass: "Be om veckoförslag" produced a week proposal with day plan, intensities, goal template and per-player advice (load and focus with reasons) |
| Staff expertise influences recommendations | Pass: the reasons cite the responsible coach's physical, preparation and development competence and the session coaches' quality. Each session shows "Tränarens kvalitet för passet". Covered in depth by `assistantTraining` 14/14 |
| Manager can edit and approve | Pass: approved individual advice for two players, changed Blazevic's focus DEFENCE→TECHNICAL and Magnusson's load FULL→REDUCED, then clicked "Godkänn träningsplan". Decision log: PROPOSED → APPROVED ("Godkänt av dig") |
| Individual instructions persist | Pass: `playerTrainingAssignments` hold Blazevic TECHNICAL/FULL and Magnusson ATTACKING_DECISIONS/REDUCED, after a page reload and after a week of play |
| Training and recovery progress | Pass: week 2026-08-17 days executed (MATCH, RECOVERY, REST). Week 2026-08-24 was built around the 26 August cup leg (match prep the day before) and Monday's session executed. The workload ledger has 1,173 entries |
| Reload preserves decisions and history | Pass: "Senaste beslut: Godkänt · Genomfört" and the selections are unchanged after reload |

### C. Manager career

| Check | Result |
| --- | --- |
| Voluntary resignation | Pass. Two-step "Avgå som huvudtränare… → Ja, jag avgår" on 2026-08-24, with consequences shown first: 21 forfeited monthly salaries, no reputation effect pre-season, a one-year lock-out, a Tumba interim, and the calendar continuing. Stint closed as RESIGNED (part-season 0–0–1); milestone logged |
| Calendar continues while unemployed | Pass. Continue becomes "UTAN KLUBB". Tumba's second cup leg was played under the interim; the calendar ran 2026-08-24 → 2027-03-08 |
| Manager history persists | Pass. Byte-identical `managerCareer` after a reload while unemployed. After the new appointment, the Tumba stint is unchanged (2026-08-20–08-24, RESIGNED, rep 18→18, 1 match) and a new stint records `se_division1_sodra` and rep 18 |
| Job opportunities across eligible divisions | Pass. Vacancies opened at Örebro SK (Division 1 Norra, 2026-11-01), Ystads IF (Handbollsligan, Dec/Jan), IK Sävehof (Handbollsligan, Feb) and Vinslövs HK (Division 1 Södra, 2027-03-01). Örebro (2026-11-02) and Vinslöv (2027-03-08) approached with offers. The offer card shows job level 10 against reputation 18; the vacancy shows "du är en stark kandidat" with the reason |
| Accept a new position | Pass. Accepted Vinslöv (2 years, €1,500/month), a move from Allsvenskan to Division 1. The save's club, `playerClubId` and the new stint all switched correctly |
| Dismissal does not freeze the career | Not reproduced live: it needs a board collapse over months. Covered by the release-code tests `boardCareer` 9/9, `clubCareerPressure` 10/10 and `m7dCareer` "dismissal mid-tick … does not stall Continue". Dismissal is now an IMPORTANT, non-blocking event |
| Save/load during unemployment | Pass (live reload above; also the Node save-compat check) |

### D. Cross-system

| Check | Result |
| --- | --- |
| Training before and after changing clubs | Before (Tumba): full assistant flow. After (Vinslöv): the weekly schedule, templates and execution work. The assistant panel correctly reports "Ingen ansvarig tränare finns. Utse en assistent i ledarstaben." and the proposal button is disabled (no error). Vinslöv has 0 staff (Division 1 has no staff rosters); assistant coaches on the market are all under contract, and free agents are scouts only |
| New employment does not corrupt history | Pass (see C) |
| Competition rollover | **Live: blocked before the rollover by a pre-existing M1.2 defect** (see "Pre-existing blocker"). The season itself progressed live: the Division 1 Södra regular season ended (2027-03-22 milestone) and M1.2 generated Vinslöv's qualification series `2026/27:transition:d1-s-final-9`. A pre-match press conference ("Kval") was answered, and match preparation ran on 2027-04-02. The first leg (2027-04-03) cannot be started from the UI. **Offline on the identical release code:** three applied season transitions (2026/27 → 2029/30), the first right after an unemployed spell, one with promotion; M1.2 transition tests 65/65 |
| AI club management active | Pass: transfer bid by Skånela; CPU coach sackings (Örebro, Ystad, Sävehof, Vinslöv) creating vacancies; tables and cup progressing for every non-managed club, including Tumba under its interim |

### Browser console and page errors

- A fresh tab on the release (start page): **0 console messages, 0 failed requests**.
- QA tab: one `net::ERR_BLOCKED_BY_CLIENT` and one 404. Both were caused by my attempts to load a local backup bridge (`http://127.0.0.1:8799`, blocked by the pane; the bridge page returned 404 from a stale local server). There was also one `TypeError … reading 'click'` from one of my own QA scripts. **No application errors.**
- Warnings only: Next.js CSS-preload "not used within a few seconds" (pre-existing).

## Live regression (M7D): stale media backlog after unemployment

- **What happened.** On the first employed day after 196 days unemployed (Vinslöv, 2027-03-08), the media layer produced **32 stories** for Vinslöv matches played 2026-08-26 → 2027-02-27, under the previous coach: 26 MATCH_REPORT and 6 UPSET. It also opened **2 post-match press conferences** for 2026-09-17 and 2026-10-11 ("Vad avgjorde matchen i dag?"). The primary top-bar action became "Presskonferens väntar", so Continue was blocked until they were answered or skipped. Skipping them produced an additional "absence" story. Supporter mood was −22 afterwards, likely influenced by those results.
- **Exact cause.**
  - M7D wraps the media tick in `if (!unemployed(next))` (`apps/game/lib/career/dailyTick.ts:439`).
  - `results()` in `apps/game/lib/media/worldTick.ts:100` reads every fixture since `media.lastResultsDate` and treats the managed club's fixtures as "own" results.
  - Because the tick is skipped, `lastResultsDate` freezes during unemployment (it stayed at the resignation date). On re-employment, the whole unemployed window is replayed against the new `playerClubId`.
  - Pre-M7D, unemployment froze the calendar, so this could not occur.
- **Impact.**
  - Cosmetic and narrative: stale stories.
  - Press: up to a few stale press conferences block Continue until handled, and there is no assistant at Division 1 clubs to delegate to.
  - A possible supporter-mood effect.
  - No data loss, no history corruption, no crash; saves and reloads are fine.
- **Handling.** The QA save is preserved, the deployment was not rolled back (not materially broken), no speculative fix was made, and release changes stopped.
- **Suggested follow-up (not applied).** Keep `media.lastResultsDate` advancing while unemployed, for example by setting it to `date − 1` when the media tick is skipped, or reset it when the new club is accepted. Then add a regression test: unemployed spell → accept job → no stories or press for fixtures dated before the appointment.

## Pre-existing blocker (M1.2, not introduced by this release): qualification matches cannot be started

- **What happened.** On Vinslöv's qualification matchday (2027-04-03, fixture `2026/27:transition:d1-s-final-9:g1`), "SNABBRESULTAT" navigated to `/career/match-day/2026/27:transition:d1-s-final-9:g1?finish=1` and the Worker answered **HTTP 404**. No match session started; `MATCHDAY_READY` stays pending, so the career cannot progress past that day through the UI. "STARTA MATCH" uses the same unencoded route.
- **Exact cause.**
  - Qualification fixture ids are `${state.seasonId}:transition:${stage.id}`, and the season id contains a slash ("2026/27") (`apps/game/lib/competition/transition/careerQualifications.ts:45`).
  - `apps/game/app/career/match-preview/page.tsx:79` and `:86` push `/career/match-day/${fixture.id}` without `encodeURIComponent`, so the slash splits the dynamic segment.
  - The same unencoded pattern exists in `match-report/[fixtureId]/page.tsx:73,126`, `GameShell.tsx:82`, `match-2d/page.tsx:16`, `contextualContinueAction.ts:57` and `destinations.ts:31`.
  - The correctly encoded URL `/career/match-day/2026%2F27%3Atransition%3A…` resolves (the page renders), which confirms the encoding is the issue.
- **Not caused by M6C/M6D or M7D.** None of these files changed between `455f369` and `5383771`. The rollback target `06194a7c` (455f369) has the identical behaviour, so rolling back would not help.
- **Impact.** Any human-managed club that enters an M1.2 qualification series (Division 1 finals, Allsvenskan/Handbollsligan kval) is stuck at its first qualification matchday. Testers at Allsvenskan or Division 1 clubs reaching season end can hit this on the currently deployed version and on the previous one alike.
- **Handling.** No speculative fix was made. The QA save is preserved at the pending matchday as a reproduction. **A follow-up fix is needed** (encode fixture ids in every `/career/match-day/…` and `/career/match-report/…` link, plus a test for slash-containing ids), followed by a hotfix deploy.

## Remaining limitations

- **Old tester saves on the live origin** could not be loaded in this isolated profile. They were verified with the release code via the real import path (5 V2 archives byte-identical). A tester-style manual import of the provided old-release backup in a normal browser is recommended for completeness.
- **Unemployed Continue only stops on approaches, not on new vacancies.** Vacancy openings are informational, so a run of presses can pass a vacancy window (the Sävehof window passed without a stop). Approaches arrive only from clubs that consider the manager; the first came 70 days after resigning.
- **The Division 1 assistant is unavailable** without hiring staff; the assistant planner needs an assistant coach. Division 1 clubs start with no staff, and only scouts are free agents.
- **Pre-existing training template.** The `BALANCED` and other templates place a placeholder `MATCH` day on Saturday even without a fixture, so the assistant's proposal shows a "Match" on a fixture-free Saturday. This comes from `trainingSchedule.ts` (2026-08-26) and is not M6C/M6D or M7D.
- **Cosmetic.** While unemployed, the profile still shows the last contract's salary and end date under "Utan klubb".
- **Carried over from the integration report:** the 12 baseline test failures; the `cpuQualityUpgrade` timeout; lenient board objective scores; and no staff or economy baseline in Division 1.

## Evidence

- QA reports in `C:/DEV/QA/reports/handball-m6m7-alpha-release/`:
  - `old-release-455f369-tumba-2026-09-10-5v2.json` and `old-release-455f369-tumba-2026-08-22-1v2.json`: portable backups made with the previous release code, for manual import;
  - `make-old-backup.mts` and `import-old-backup.mts`.
- Log: `C:/DEV/QA/logs/2026-11/m6m7-alpha-old-backup-import.log`.
- Integration evidence: `M7D-MAIN-INTEGRATION-REPORT.md` and `C:/DEV/QA/logs/2026-11/m7d-main-*`.
