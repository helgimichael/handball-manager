# M7D main integration report

Date: 2026-11-12. This is a local integration only: there was no push, no Cloudflare deployment and no Alpha career reset, and no tester saves were touched.

## Integrated commits

| Role | Commit |
| --- | --- |
| main before integration | `455f3693788fced30428dc3e5ecc4d8731a8cbb2` fix(ui): show current career league on club profiles |
| M6C/M6D base (expected) | `8a9a499de81a24517a214885822924f5879c6728` feat(training): add assistant-led weekly planning and review |
| M7D implementation | `704dce5dc42fa1c9ba4ba77b06509f231a58b580` feat(manager): M7D manager reputation, history and job market |
| M7D results | `788a4ff44b0401298fb67eae7278658c4e5b86c3` docs: M7D results report |
| **Integration merge** | **`a0e5bf7acd5aa7e853ac6903ac055d4d8cc773fd`** release: integrate M7D manager reputation, history and opportunities (parents `455f369`, `788a4ff`) |

This report is committed directly on top of the integration merge. Its own hash is the final `main` HEAD and is recorded in the delivery summary.

### Pre-integration audit

- **main** was at `455f369` and checked out cleanly in `C:/DEV/WORKTREES/handball-manager/alpha-hotfix-release-2026-11-08`.
- **Source branch** `feature/m7d-manager-reputation-history` is `8a9a499 → 704dce5 → 788a4ff`. M7D is based on the expected M6C/M6D commit: `8a9a499`'s parent is `455f369`.
- **Divergence:** the merge base of main and the source branch is `455f369` itself. main had no newer commits, so nothing on main could be overwritten.
- **M6C/M6D (`8a9a499`) was not on main before this integration.** It was only on `feature/m6cd-assistant-training` and the M7D branch. M7D was built and verified on top of it, so this merge brings M6C/M6D assistant-led training into main together with M7D. The merge commit message says so.
- **Alpha state:** main is the alpha-hotfix release line (M1.2 pyramid release `c35532c` plus the `455f369` UI fix). The other alpha worktrees (`alpha-release-03`, `alpha-development-cup-*`, `m12-alpha-*`) were not touched.
- **Worktrees:** all existing worktrees were preserved. One was added: `C:/DEV/WORKTREES/handball-manager/m7d-main-integration`, on branch `integration/m7d-main-2026-11-12`. The integration was built and verified there before main was fast-forwarded.
- **Main checkout** `C:/DEV/PROJECTS/handball-manager` (branch `work/preserved-main-before-alpha-hotfix-2026-11-08`, with untracked `.claude/` and `docs/audit/`) was not modified.

### Merge

- `git merge --no-ff feature/m7d-manager-reputation-history` completed with **no conflicts**.
- The merged tree is **byte-identical to `788a4ff`** (`git diff --cached 788a4ff` is empty). The code on main is therefore exactly the code verified on the M7D branch.
- No conflict resolution or extra edits were needed.

## Files changed (`455f369..a0e5bf7`, 32 files, +1934 −143)

**M6C/M6D (`8a9a499`, 15 files)**
- `lib/training/assistantTraining.ts`, `assistantTrainingTypes.ts`, `assistantTraining.test.ts`
- `lib/training/types.ts`, `lib/career/trainingScheduleActions.ts`
- `lib/delegation/delegation.ts`, `lib/delegation/types.ts`
- `components/manager/AssistantTrainingPanel.tsx`
- `app/career/training/page.tsx`, `app/career/staff/responsibilities/page.tsx`
- `scripts/assistant-training-career.ts`, `scripts/game-test-files.json`, `package.json`, `M6C-M6D-RESULTS.md`

**M7D (`704dce5`, 19 files)**
- `lib/manager/managerCareer.ts`, `changeClub.ts`, `departure.ts` (new), `m7dCareer.test.ts` (new)
- `lib/board/types.ts`, `board.ts`, `boardCareer.test.ts`, `clubCareerPressure.test.ts`
- `lib/career/calendar.ts`, `dailyTick.ts`, `continueController.ts`, `contextualContinueAction.ts`, `weeklyManagement.ts`
- `lib/staff/staffLifecycle.ts`
- `app/career/manager/page.tsx`, `app/career/page.tsx`
- `scripts/m7d-manager-career.ts` (new), `scripts/game-test-files.json`, `package.json`

**Docs (`788a4ff`):** `M7D-RESULTS.md`

No competition, qualification, transition, match-engine, transfer, contract, economy or player-development source files changed.

## Test results (integration tree `a0e5bf7`)

The real-world bundle (`lib/gameWorld/generated/realWorldFiles.ts`) is gitignored. It was generated with the repository's own `pretest`/`prebuild` script before testing, as on the baseline trees: 827 files, the same 7,741,424-byte output.

| Gate | Result |
| --- | --- |
| Canonical manifest: all 297 files except `cpuQualityUpgrade` (tsx, asset loader, `--test-concurrency=4`) | **2910 tests, 2898 pass, 12 fail**, 0 cancelled (702 s). Every manifest file reported |
| The 12 failures | **The identical set fails on the untouched base `8a9a499`** and on the M7D branch (`diff` of failure names is empty). All pre-existing; see below |
| `lib/career/cpuQualityUpgrade.test.ts` alone (90-minute cap) | **Timed out at 5400 s with no subtest completed**, the same as the established baseline (`8a9a499`) and the M7D branch |
| `cupSchedule.test.ts` and `headroomHighEnd.test.ts` (outside the canonical manifest on main) | **24/24 pass** on the integration tree and on main `455f369` |
| `autonomousClubs.test.ts` (M4.1; outside the canonical manifest on main) | **8/8 pass** on the integration tree and on main `455f369` |
| TypeScript (`tsc --noEmit`) | **0 errors** |
| Scoped ESLint (28 changed TS/TSX files) | **0 errors, 10 warnings**. Main has the same files at 9 warnings. The extra one is M7D's intentional `_seeking` destructure; M6C/M6D renamed `plan` to `_plan` |
| Production build (`next build --webpack`) | **Pass**: compiled successfully; `/career/manager` and `/career/training` built |

### Requested areas (per-file results in the integration suite run)

| Area | Files: result |
| --- | --- |
| All 11 M7D focused tests | `m7dCareer`: **11/11** |
| Resignation and unemployment | `m7dCareer`: resignation consequences; match guards; unemployed approaches; reload while unemployed. All pass |
| Job applications and offers | `m7dCareer`: stale, expired, declined and repeated offers; application → interview → Division 1 appointment. Pass |
| Dismissal and calendar progression | `boardCareer` **9/9**, `clubCareerPressure` **10/10**, `m7dCareer` dismissal mid-tick (pass), `dailyTick` **11/11**, `weeklyManagement` **8/8**, `weeklyReports` **2/2** |
| Save/load and career history | `saveRepository` **14/14**, `portableCareerBackup` **7/7**, `replayLifecycle` **6/6**, plus `m7dCareer` reload and old-save summary tests |
| M1.2 competition | `competition/transition/*`: **65/65** across 7 files; `season` **6/6**; `promotionSquads` **5/5**; `promotionStockRollover` **1/1**; `cupSchedule` **13/13** |
| M6C/M6D training | `assistantTraining` **14/14**; `trainingSchedule` **15/15**, `trainingLoad` **13/13**, `trainingExecution` **7/7**, `workloadLedger` **12/12**, `individualRecovery` **11/11** |
| Weekly manager / matchday | `matchdayAction` **13/13**, `matchdaySessionIntegration` **6/6**, `matchday` **3/3**, `matchdaySquadIntegrity` (pass), `contextualContinueAction` **8/8** |
| Club AI and recruitment, transfers, development | `cpu*` (6 files, excluding `cpuQualityUpgrade`) **115/115**; `autonomousClubs` **8/8**; `transfers/*` **all pass except the pre-existing `playerInterest` IMPOSSIBLE-gate test**; `development/*` **all pass** |
| M3.1 player intentions | `intentions` **11/13**. The two failures are pre-existing and identical on base |

### Baseline failures (pre-existing; identical on `8a9a499`, the M7D branch and this integration)

1. `careerInitialization`: a complete initialization publishes one complete save using its own deterministic seed
2. `continueController`: Continue Controller: same seed reproduces an identical season end-to-end
3. `simulationHarness`: harness: the season-0 checkpoint reproduces the audited database baseline
4. `allsvenskanPlayers`: (2) total real Allsvenskan player count matches the HM-DATA-1.5 corrected roster (284 players)
5. `allsvenskanRosterConsistency`: no cross-league name+DOB identity collision beyond documented owner decisions
6. `dataFiles`: bundled Handbollsligan squads, ratings, staff and dated identity snapshots equal native Node data
7. `gameplayRatingSnapshot`: population audit 1191/1191…
8. `hblBioIntegrity`: exactly 265 unique active HBL playerIds, no duplicates
9. `hblBioIntegrity`: CA/PA ratings are completely unaffected by the bio-data corrections
10. `intentions`: legacy saves are neutral, intentions persist…
11. `intentions`: persistent financial crisis and an ambitious player facing a sporting setback…
12. `playerInterest`: Allsvenskan club cannot negotiate with top Handbollsligan stars (IMPOSSIBLE gate)

Separately, `cpuQualityUpgrade.test.ts` cannot complete within 90 minutes on the base either.

No test was weakened, skipped or removed.

## Cross-system validation

| # | Check | Evidence | Result |
| --- | --- | --- | --- |
| 1 | Resign and the calendar continues | M7D career scenario: resigned from Tumba on 2026-11-10, then 21 unemployed days in ordinary Continue presses while Tumba played 3 interim matches. Save-compat run: resigned on 2026-10-20, and the calendar ran to 2026-12-01 with world results added | **PASS** |
| 2 | Employment in another division | Scenario: Anderstorps SK (Division 1 Södra) approached on 2026-12-01 and he was appointed (Allsvenskan → Division 1). First native V2 match on 2026-12-03. Division 1 title and promotion in 2027/28, then Allsvenskan in 2028/29 | **PASS** |
| 3 | Career history survives reload | Scenario: 7 repository reloads, with the manager career byte-identical each time. Save-compat run: history byte-identical after reload while unemployed | **PASS** |
| 4 | Training planning continues | M6C/M6D assistant-training career on the integration tree: **PASS**. 9 weeks, 10 matches, 9 plan approvals or edits, 45 repository reloads, 57 executed days, 39 sessions, measured coaching quality 0.91–1.07, canonical identities unchanged | **PASS** |
| 5 | Club AI and recruitment keep operating | Full-suite CPU recruitment, squad-building, contract and market files pass; `autonomousClubs` 8/8; the scenario's three-season world simulates every non-managed club, including Tumba under its interim | **PASS** |
| 6 | Competition progression and season rollover | Scenario: three season transitions (2026/27 → 2029/30 calendar), including the first after an unemployed spell and one promotion between divisions. All M1.2 transition tests pass | **PASS** |
| 7 | Existing saves stay compatible | A save was built with **main `455f369` code**: Tumba career advanced to 2026-10-05 with 255 results, no `reputationLog`, and a stint without `competitionId`. It was then loaded with the **integrated code** through `saveRepository` and `migrateCareerState`. Date, club and results were intact, and the career summary works (old record 9 played). Own matches continued to 2026-10-20. Resignation was available, and the stint closed as RESIGNED. The calendar continued while unemployed. The history was byte-identical after reload, and an offer and three vacancies were open | **PASS** |

The realistic M7D career scenario on the integration tree ended with **PASS**: 2026-08-20 → 2029-04-18, 79 manager matches (all native V2), 7 reloads and 3 seasons. Its final summary line is **byte-identical** to the pre-integration run on the M7D branch.

### Evidence

Logs in `C:/DEV/QA/logs/2026-11/`:
- `m7d-main-integration-npm-ci.log`
- `m7d-main-suite.log`
- `m7d-main-cpuQualityUpgrade.log`
- `m7d-main-extra-competition-tests.log`
- `m7d-main-autonomous-clubs.log`
- `m7d-main-typecheck.log`
- `m7d-main-scoped-lint.log`
- `m7d-main-production-build.log`
- `m7d-main-career-scenario.log`
- `m7d-main-training-scenario.log`
- `m7d-main-save-compat.log`

The baseline comparison logs are in the same folder: `m7d-failing-files-baseline.log`, `m7d-cpuQualityUpgrade-baseline.log` and `m7d-full-suite-rest.log`.

Reports are in `C:/DEV/QA/reports/handball-m7d-main-integration/`:
- `m7d-career/`
- `m6cd-training/`
- `save-compat.mts`, the existing-save check script

## Remaining limitations

- **M6C/M6D arrives on main with this integration.** It was never merged on its own; it comes in as M7D's verified base. Alpha deployment of either needs separate authorisation.
- **M7D limitations carry over unchanged** (see `M7D-RESULTS.md`):
  - while the manager is unemployed, the former club keeps `playerClubId` and pauses CPU recruitment;
  - "never stranded" offers after a dismissal or an expired contract can come without a vacancy;
  - board objective scores are lenient;
  - Division 1 has no staff rosters or economy baseline;
  - dismissal-and-recovery (scenario D) is verified in focused tests, not in the long career.
- **Existing unemployed tester saves** now advance their calendar instead of being frozen. This is the intended M7D policy. No save is migrated or rewritten.
- **Pre-existing suite problems:** the 12 base failures and the `cpuQualityUpgrade` timeout remain, and `npm test` as a single command cannot finish within 110 minutes because of that file. They need their own follow-up.
- The `autonomousClubs`, `cupSchedule` and `headroomHighEnd` test files are not in the canonical manifest on main. They were run separately here and pass.

## Final state

- **Integration merge commit:** `a0e5bf7acd5aa7e853ac6903ac055d4d8cc773fd`
- **Report commit:** directly on top; its hash is the final local `main` HEAD.
- Not pushed. Not deployed.
