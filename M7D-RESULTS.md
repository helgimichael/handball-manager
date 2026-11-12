# M7D: Manager reputation, history & opportunities

2026-11-11. Original roadmap milestone **7D**, from `ROADMAP-FINAL-v1.0` M7 and `POST-M6CD-REVIEW.md`: "Job offers from CPU clubs, applying for vacancies, resignation, unemployment, and a manager history page." It is implemented on the local feature branch `feature/m7d-manager-reputation-history` (worktree `C:/DEV/WORKTREES/handball-manager/m7d-manager-reputation-history`). The branch is based on the local M6C/M6D training commit `8a9a499`, so assistant-led training stays intact; that commit is itself on top of main `455f369`.

**Nothing was pushed, merged or deployed.**

Implementation commit: see "Commit" at the end.

## Scope recovered and what was reused

The original 7D and the post-M6CD acceptance criteria were read before any code was written. The M7 career already had reputation, vacancies, interviews, approaches, offers, dismissal, an employer-change transaction and a stint list. M7D reuses all of it and adds the missing parts:

| Original / review criterion | Before | M7D |
| --- | --- | --- |
| Job paths cover the playable pyramid | Eligibility and CPU sackings counted Handbollsligan and Allsvenskan only | Every job path (vacancies, monthly sackings, season-end openings, applications, approaches, post-dismissal offers, appointment) uses `MANAGEABLE_LEAGUES`: Handbollsligan, Allsvenskan and Division 1 Norra/Södra. It reads current memberships, needs a real league calendar and a squad of at least 12, and keeps Division 2 a pool |
| Voluntary resignation | Missing (only "left for a new job") | `resignationPreview` and `resignFromClub`, with a confirm step in the career UI that shows contract, forfeited salary, reputation effect and the other consequences before the decision |
| Unemployment | Continue was frozen until a job was accepted | The calendar keeps running (owner requirement in this task, overriding the earlier "paused bridge" default). The former club is run by an interim, so its fixtures are simulated as CPU fixtures. Clubs review the manager weekly |
| World-preserving appointment | Present | Reused. Departure closure is now one shared function (`lib/manager/departure.ts`) used by new job, resignation, dismissal and contract expiry. No fabricated re-opened vacancy for a club he already left |
| Reputation reflects career performance | `round((objectives−0.55)·14)` plus honours, with no record of why | Every change goes through `adjustReputation` and is logged with its reason (`reputationLog`). A season is judged on board objectives, finish against the squad's expected place, division weight (HBL ×1, Allsvenskan ×0.8, Division 1 ×0.6), titles, cup, promotion (+6 from Allsvenskan, +4 below) and relegation (−8). Success at a club far below his standing counts for less. Dismissal costs −6 and a mid-season resignation −2 |
| Persistent history | Stints with season rows (position, objectives, honours) | Each stint also stores the league at appointment and reputation at start and end. Each season row stores a W–D–L and goals record, and a part-season row when he leaves mid-season (a full row when he leaves after the season is decided). `managerCareerSummary` covers clubs, seasons, matches, titles, cups, promotions, relegations, dismissals, resignations, highest level and days unemployed |
| Clubs evaluate qualifications | Reputation against stature, plus interview fit | `assessCandidate` combines reputation, stature and explained experience: seasons at or above the level, a jump of two or more levels, promotions, titles, and dismissals in the last year. Interviews, approaches and unemployed approaches all use it, and the interview note names each factor |

## Implemented functionality

- **`lib/manager/managerCareer.ts`**
  - Pyramid eligibility and league levels, with Division 1 stature.
  - Explained, logged reputation.
  - Season judging and history records.
  - Experience-based candidate assessment.
  - CPU sackings across all four leagues (at most two a month).
  - Season-end vacancies, once per season whether he is employed or not.
  - Shared departure for dismissal and resignation, with a vacancy he cannot take: he cannot return to a club that dismissed him, or one he resigned from within a year.
  - Weekly unemployed market: a club that considers him may approach. After a resignation with no offer for six weeks, the best-fitting *open* vacancy calls.
  - Post-dismissal "never stranded" offers are kept as before.
- **`lib/manager/changeClub.ts`**
  - The employer change also waits for a matchday that has been reached but not yet played.
  - The stint is closed through the shared history logic, and the new stint records its league and starting reputation.
  - Repeated, expired or declined offers are refused.
  - The unemployment marker is removed exactly, so a save round-trip is identical.
- **Calendar and tick**
  - `calendar.ts`: while unemployed there is no "managed club". The old club's fixtures are simulated and no matchday is raised.
  - `dailyTick.ts`: while unemployed, player dynamics, delegation and media for the old club pause. Only career, board-news, competition, season and club-news events reach him, and nothing except the job market can require an action.
  - `continueController.ts` and `contextualContinueAction.ts`: no seekingJob freeze, and Continue reads "UTAN KLUBB".
  - `staffLifecycle.ts`: the old club can hire its own coach while he is unemployed.
  - `board.ts`: a dismissal meeting is important news and is no longer a blocking action.
- **UI (`/career/manager`)**
  - Hero for resigned, dismissed and contract-ended states.
  - Career statistics panel.
  - "Why reputation moved" log.
  - Stint rows with league, reputation start→end, W–D–L and part-season marks.
  - Resignation panel with listed consequences and a two-step confirm.
  - Vacancies show the league and the candidate assessment.
  - The home banner explains that the calendar continues.
- **Old saves:** all new fields are optional. A career without `reputationLog`, stint league or season records still summarises, and no migration is needed.

## Career scenarios (gameplay validation)

The realistic career is `scripts/m7d-manager-career.ts` (`npm run career:m7d`):

- Full Swedish world, seed `m7d-normal-career`, start at IFK Tumba (Allsvenskan).
- Ordinary Continue presses; ordinary decisions answered.
- Every own match is a **native V2** match with a selected available seven.
- Repository save/reload through `saveRepository`.

Evidence is in `C:/DEV/QA/reports/handball-m7d-manager-career/` (`m7d-career-scenario.json`, `m7d-career-log.json`), and the log is `C:/DEV/QA/logs/2026-11/m7d-manager-career.log`. Result: **PASS**, 2026-08-20 → 2029-04-18. The run covered 79 manager matches (all V2), seven repository reloads and three season transitions.

| Scenario | What happened (normal paths, nothing injected) |
| --- | --- |
| **A. Voluntary resignation** | After 14 V2 matches (12–0–2, 1st in Allsvenskan) he resigned on 2026-11-10. The stint closed once as RESIGNED with a part-season row (14 matches, position 1). The contract ended that day, reputation went 18 → 16 ("Lämnade IFK Tumba HK mitt under säsongen", −2), and a second resignation was refused |
| **E. Reload while unemployed** | The save was reloaded right after resigning and again three weeks later. The manager career was byte-identical after reload. Tumba played three matches under the interim, and the calendar advanced 21 days in ordinary presses |
| **B. Offer from another club** | On 2026-12-01 Anderstorps SK (Division 1 Södra, open vacancy) approached through the weekly unemployed market. The assessment was stature 10, reputation 16, +3 experience. Accepting worked; repeated acceptance was refused; player registrations, contracts, fixtures and results were unchanged by the appointment |
| **C. Move between divisions** | Allsvenskan → Division 1 Södra. First V2 match on 2026-12-03 with a selected lineup, then a reload. The 2027/28 Division 1 Södra title brought promotion to Allsvenskan, and he managed 2028/29 there |
| **D. Dismissed and continues** | Covered in focused tests rather than the long career, because the realistic run never fell to the board's dismissal line. The tests cover a board-driven dismissal after two warnings, the multi-month pressure path, a dismissal mid-tick (that day's own fixture is simulated by the world and no matchday is raised), offers, and accepting a new job. `clubCareerPressure` still checks dismissal happens once and is replay-safe |
| **F. Consistent after several seasons** | Checked after every season: the start reputation plus the sum of logged deltas equals the current reputation; there is exactly one open stint while employed and none while unemployed; stints are ordered without overlap; the career record (79 played) equals the matches he coached; player IDs are unique; and canonical identities are unchanged. The record and history survive each transition and reload |
| **G. Plausible recruitment** | Final view at reputation 32 with Allsvenskan and Division 1 experience. Both Handbollsligan clubs (stature 60 and 48) would not consider him, while both Allsvenskan clubs (28, 24) and both Division 1 clubs (10) would. Tests confirm: a Division 1 club considers an Allsvenskan coach but the biggest HBL club does not; HBL experience raises the assessment; a recent dismissal lowers it; and the interview note explains each factor |

Reputation path: 18 → 16 (mid-season resignation) → 19 (2026/27: objectives +4, 8th vs expected 3rd −1) → 28 (2027/28: objectives +4, 1st vs 3rd +1, promotion +4) → 32 (2028/29: objectives +5, 11th vs 7th −1).

## Test results

| Gate | Result |
| --- | --- |
| New focused `lib/manager/m7dCareer.test.ts` (11 tests: eligibility and exclusions, membership/Division 2/thin squad, recruitment plausibility, resignation, match guards, stale/expired/declined/repeated offers and handover, unemployed approaches, reload while unemployed, explained reputation, old-save summary, dismissal mid-tick, application → interview → Division 1 appointment) | **11/11 pass** (in the full-suite run on the final code) |
| Board/career regressions `boardCareer`, `clubCareerPressure` (two assertions updated from "Continue frozen" to the new "calendar continues" policy) | **19/19 pass** |
| `continueController`, `contextualContinueAction`, `weeklyManagement` | All pass except `Continue Controller: same seed reproduces an identical season end-to-end`, which **fails identically on the untouched base `8a9a499`** (pre-existing) |
| Full canonical suite (`npm test`) | 2910 tests outside `cpuQualityUpgrade`: **2898 pass, 12 fail, all 12 failing identically on base `8a9a499`**. `cpuQualityUpgrade` times out identically on base and M7D. **0 regressions.** Details under "Full suite" |
| Multi-season career scenario | **PASS** (above) |
| TypeScript (`tsc --noEmit`) | **0 errors** |
| Scoped ESLint (all changed files) | **0 errors**, 7 warnings: 6 pre-existing, plus one `_seeking` destructure that follows the repository's existing `_unused` pattern |
| Production build (`next build --webpack`) | **Pass** (`/career/manager` built) |
| Browser check (production server, built-in browser) | New local career at Tumba. `/career/manager` showed statistics, the reputation log and the resignation consequences. The two-step resign set the stint to "avgick" and the summary to 0/1 resignations with "Utan klubb". Continue ("UTAN KLUBB") advanced six days and stopped on Tumba's interim cup result. The job market rendered the unemployed state. No console errors |

### Full suite

The canonical manifest (`scripts/game-test-files.json`) has 298 files, including the new `m7dCareer.test.ts`. No existing test was skipped, removed or weakened. The only edits to existing tests are the two policy assertions in `boardCareer` and `clubCareerPressure` described above.

1. **`npm test` (6600 s cap): did not finish.** It ended with exit 124 because `lib/career/cpuQualityUpgrade.test.ts` was still running after 6584 s. Node reports files in order, so about 130 later files never printed. Two failures were reported before the stop, and both pre-exist (see the table).
2. **All other 297 manifest files on M7D** (same flags: tsx, asset loader, `--test-concurrency=4`):
   - Totals: **2910 tests, 2898 pass, 12 fail**, 0 cancelled, 1411 s.
   - All 11 `m7dCareer` tests pass in this run.
3. **The 10 files containing those 12 failures, re-run on the untouched base `8a9a499`:** **the same 12 tests fail there**, with identical names, giving 67 tests and 55 passes on both sides. The failures are data, roster and identity audits, plus seed-reproduction, intentions and player-interest tests. None of them touch manager-career code. **They pre-exist; no regressions.**

   | File | Failing tests (base = M7D) |
   | --- | --- |
   | `career/careerInitialization` | a complete initialization publishes one complete save… |
   | `career/continueController` | Continue Controller: same seed reproduces an identical season… |
   | `career/simulationHarness` | harness: the season-0 checkpoint reproduces the audited database baseline |
   | `gameWorld/allsvenskanPlayers` | (2) total real Allsvenskan player count… (284 players) |
   | `gameWorld/allsvenskanRosterConsistency` | no cross-league name+DOB identity collision… |
   | `gameWorld/dataFiles` | bundled Handbollsligan squads, ratings, staff… equal native Node data |
   | `gameWorld/gameplayRatingSnapshot` | population audit: 1191/1191… |
   | `gameWorld/hblBioIntegrity` | exactly 265 unique active HBL playerIds; CA/PA ratings unaffected by bio corrections |
   | `players/intentions` | legacy saves are neutral…; persistent financial crisis… |
   | `transfers/playerInterest` | Allsvenskan club cannot negotiate with top Handbollsligan stars |

4. **`lib/career/cpuQualityUpgrade.test.ts`, run alone on base and on M7D at the same time** (90-minute cap each): **both timed out identically** after 5400 s, with no subtest completed on either side. The file only uses `cpuRecruitment`, `cpuSquadNeeds`, `cpuContractDecisions`, `simulate-player-development` and `game-data`, and M7D changes none of them. This is a pre-existing problem, not an M7D regression.

Logs are in `C:/DEV/QA/logs/2026-11/`:
- `m7d-full-suite.log`
- `m7d-full-suite-rest.log`
- `m7d-failing-files-baseline.log`
- `m7d-cpuQualityUpgrade-baseline.log`
- `m7d-cpuQualityUpgrade-m7d.log`
- `m7d-typecheck.log`
- `m7d-scoped-lint.log`
- `m7d-production-build.log`
- `m7d-manager-career.log`

## Protection

- **M1.2 competition rules:** no competition, qualification, cooperation or geography code changed. Membership is only read, and a farm-club job cannot alter eligibility. Season transitions passed three times in the realistic career with an unemployed spell before the first.
- **M6C/M6D training:** branched from `8a9a499`; no training files changed. The assistant planner already pauses while `seekingJob`, and the old club's planned week is closed at departure as before.
- **Existing tester careers:** additive optional fields only, no migration. The one policy change is that an existing save which is currently unemployed now advances its calendar instead of being frozen.
- **Match engine:** untouched. Only which fixtures count as the manager's changed (none while unemployed).
- **Player development:** untouched.

## Remaining limitations

- **Interim club behaviour.** While he is unemployed, the former club keeps `playerClubId` until he signs elsewhere. Its fixtures are simulated, it can hire a staff coach, and its player dynamics, delegation and media pause. CPU recruitment does not run for it during that spell. Unemployment usually lasts weeks, but a very long spell leaves that club unmanaged in the transfer market.
- **"Never stranded" offers can come without a vacancy.** After a dismissal or an expired contract, the existing M7 offers may come from clubs without an open vacancy ("beredda att byta tränare"). This original M7 behaviour is kept, though clubs with a real vacancy now rank first. Resignation never uses it; it uses only open vacancies.
- **Board objective scores are lenient.** They come unchanged from the existing M7A/B board. A newly promoted club's "avoid relegation" target is met at 11th, which scored 100 % in the scenario. The new expectation-vs-finish term counterweighs it but is deliberately small.
- **Division 1 clubs have no staff rosters or economy baseline.** Press conferences there cannot be delegated (the manager answers them), and stature defaults to economic band 7. That was already true of the M1.2 data.
- **Scenario D was not reached naturally.** Dismissal-and-recovery is verified in focused tests, not in the long career.
- **Pre-existing suite problems (not M7D).** `npm test` cannot finish inside 110 minutes, because `cpuQualityUpgrade.test.ts` alone runs past 90 minutes on the untouched base. Twelve data, audit and determinism tests also fail on the base. Both need their own follow-up; M7D neither causes nor hides them.

## Commit

Implementation: `704dce5dc42fa1c9ba4ba77b06509f231a58b580` on local branch `feature/m7d-manager-reputation-history` (parent `8a9a499`). This report is committed on top of it. Not pushed, merged or deployed.
