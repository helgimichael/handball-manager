# Arena Nights — Stabilization Report

## 1. Baseline and final commits

| | |
|---|---|
| Branch / worktree | `feat/club-identity-arena`, `C:\DEV\WORKTREES\handball-manager\club-identity-arena` |
| Baseline | `65668fa` (Phase 2 completion), clean worktree verified at start |
| Final | the stabilization commit that adds this report (local only) |
| Pushed / merged / deployed | **No / no / no**. No production data touched, no career reset, no archive or worktree deleted |
| Engine | `packages/handball-engine` **unchanged** |
| Unchanged | Match calculations and outcomes, player development, competition rules, season transitions, Arena Nights design system, club identity, Tactical Board, Player Dossier, Matchday and Live Match |

Changed application files: `lib/save/saveRepository.ts`, `lib/save/saveStorage.ts`, `lib/career/CareerContext.tsx`, `lib/career/productionMatch.ts`, `components/game/LiveCoachPanel.tsx`, `components/tactics/BoardTools.tsx`, `components/tactics/board-tools.css`, `app/career/tactics/page.tsx`.

New tests: `lib/save/careerWriteStatus.test.ts`, `lib/career/timeoutDuringFlight.test.ts`, `e2e/tactics-persistence.spec.ts`.

Repaired specs: `reconciliation`, `match-center-v21`, `match-realism-v2`, `match-calibration-v21`, plus helpers in `e2e/matchPrep.ts`.

## 2. Root cause — Tactical Board persistence

Board edits were **not** held only in React state. Every edit (starting seven, formation, instructions) goes through `updateMatchPlan` / `updateCareer`. Those apply it to the latest committed career (so rapid edits never act on a stale plan) and queue a write in `saveCareerState`. The queue is serialized and latest-wins.

The loss was in the write path:

- **Slow writes.** Each write first re-read the whole save record (tens of MB) and then put it.
- **Queued edits were exposed.** An edit made while a write was running waited in the queue. A reload or closed tab in that window dropped it. An in-flight write survived.
- **No feedback.** Nothing showed a pending write, nothing guarded a reload, and a failed write showed a banner with no retry that never cleared.
- **Reads poisoned by a failure.** After one failed write, `flushCareerSave` re-threw that failure into every later read of the save.

Reproduced in the browser on the QA career:

1. Change V6.
2. Change the tempo.
3. Reload immediately.

V6 (its write in flight) survived; the tempo (queued) was **lost**. No leave-page prompt appeared, because script clicks carry no user activation, and mobile browsers often ignore the prompt anyway.

## 3. Persistence solution (existing save system, no second store)

- **Write status.** The one write queue publishes `SAVING` / `SAVED` / `FAILED` (`subscribeCareerWriteStatus`). Only the newest snapshot decides the status.
- **Cached envelope.** The queue caches the record it last wrote, so a write puts at once instead of re-reading the save first. Every other write path invalidates the cache (create, touch, import, delete, migration, test backend swap).
- **Ordering guard.** Every write carries a sequence number, and an older snapshot never puts after a newer one.
- **Exit flush.** `flushCareerWritesOnExit()` runs on `pagehide`, hidden `visibilitychange` and `beforeunload`. It writes a snapshot still waiting in the queue immediately, after the running write.
- **Leave-page guard.** The browser's own guard is armed while a write is pending or failed.
- **Failure handling.**
  - Edits stay in memory and on screen.
  - The banner says "Ändringarna är inte sparade. De finns kvar här tills de sparas." with **Försök igen**, which re-persists the current career; the banner clears once a write commits.
  - The board shows its own save-state line with retry.
  - Reads after a failure return the last committed state.
- **Matchday consistency.** The preview, the match start and the board all read the same provider state that is being written, so the match always starts with the lineup on the board.
- **Robustness found during QA.** If an `hm-game` database exists without its stores (left by an interrupted first open or another tool), the open path upgrades it one version to create them. Existing stores and data are never touched.

**Tests:**

- **Unit** (`careerWriteStatus.test.ts`, 3 tests): SAVING → SAVED with the newest plan stored; a failed write reports FAILED, writes nothing half-way, reads still work, and a retry commits; the exit flush issues the queued put immediately and the newest edit is stored; `touchSave` invalidates the cache.
- **E2E** (`tactics-persistence.spec.ts`, 13 steps):
  - starting seven, then an immediate reload;
  - formation, then reload;
  - instructions, then reload;
  - preview shows the same seven, and back;
  - rapid edits (the last wins);
  - injected IndexedDB failure → alert and FAILED → edit kept → retry → SAVED → reload confirms.
- **Browser:** after the fix, three edits made about 60 ms before a reload all survived.
- **Existing careers load without migration.** The save schema is unchanged; the archives and the Phase 2 match evidence load as before; all 3,019 node tests run against unchanged fixtures.

## 4. Native V2 resume — investigation and findings

**Reproduction.**
- `lib/career/timeoutDuringFlight.test.ts` (and the scratch reproduction behind it) granted a team time-out in six different ball-flight situations of a real career match.
- Each time it compared the uninterrupted continuation with a JSON save → reload continuation.
- **Every reloaded continuation was identical**, so serialization and restoration are not the cause.

| Time-out granted while… | Result |
|---|---|
| a live pass is in the air | the engine converts it to a free throw; the match continues |
| a **non-live** ball is in the air (throw-off pass, dead-ball return to the restart taker) | always `INCOMPLETE: Unresolved ball flight budget` once the time-out ends |

**Root cause:**
- During any official time-out, `advanceOneTick` returns before `execute`. The flight is not advanced, but `tick − releasedTick` keeps counting.
- A team time-out lasts 1,200 ticks; the flight budget (`interactions.ts`) is 160.
- `requestTeamTimeout` handles a live ball but leaves a non-live flight in the air.
- Contextual CPU time-outs already require a live, controlled ball, so only the manager's command reached this state.
- The Phase 2 save/reload was coincidental.

**Classification:**
- not incomplete serialization;
- not restoration order;
- not missing pending state;
- not an invalid clock transition;
- a genuine engine-state edge case reachable only through the manager's time-out command.

## 5. Engine changes and justification

**None.** The fix is in the product layer:

- `commandProductionMatch` refuses a manager time-out while a non-live ball is in the air, exactly as it refuses one without possession.
- A refused request changes nothing (asserted byte-for-byte).
- The coach panel says "Vänta tills bollen är i spel."
- Every previously accepted time-out in that state ended the match as INCOMPLETE, so no completed match changes outcome.
- CPU behaviour is untouched.

The regression test fails without the fix. Engine-level suites run in the full regression (below).

Remaining theoretical risk, not observed: treatment (600 ticks) and personal-sanction (40 ticks) time-outs use the same pause. They start after fouls or injuries, when no non-live flight is open in any observed case. Documented, not changed.

## 6. Reconciled Playwright totals

Final full run on the stabilization build:

| Measure | Count |
|---|---|
| Tests | **32** (31 + `tactics-persistence`) |
| Executed | **28** |
| Passed | **17** |
| Failed | **11** |
| Skipped by design | **1** |
| Never ran | **3** |

17 + 11 + 1 + 3 = 32. Phase 2 final: 31 tests, 15 passed, 12 failed. `tactics-persistence` and `arena-journey` were rerun and passed on the final build after a lint-only refactor.

## 7. Remaining failures and classification

All existed on the Phase 2 baseline. None is a product regression (A) or an engine failure (E).

| Test | Category | Reason | Action |
|---|---|---|---|
| `career-loading-screen` › real New Game | D | Missing baseline snapshots file | Record with `HM_LOADING_BASELINE=1` |
| `career-loading-screen` × 3 | F | Never ran after the first serial failure | Resolves with the above |
| `contract-renewal-errors` | D (skipped by design) | Needs an exported controlled career + plan | Provide the fixture |
| `match-motion` › full canonical replay | D | Missing recorded motion archives | Provide `HM_MOTION_ARCHIVE_DIR` |
| `match-motion` › normal career motion | B | Speeds 4×/16× absent since `48446f0` | Owner to choose replacement speeds, then rewrite |
| `match-calibration-v21` › calibrated | B | Same speed selection (kick-off, court and play now work) | As above |
| `match-realism-v2` | B | Same speed selection | As above |
| `match-calibration-v21` › retained 19–19 | D | Recorded initial hash predates the behaviour revision | Re-record after an owner decision |
| `game-presentation` × 2 | C | Expects "Torslanda", which depends on the New Game seed | Derive from the career or pin the seed via a hook |
| `game-experience-v11` › Continue | C | "Ahlin" absent from the current market | Choose a target from the live market |
| `management` | B | Expects an immediate contract change; renewals answer next day | Advance a day, accept either answer |
| `product` | C | Expects league results after a cup opener | Use the played fixture's own competition |

## 8. Desktop and mobile evidence

- **Playwright `arena-journey`** (passes on the final build):
  - desktop 1440 px: career entry → front page → hubs → squad → dossier → tactics → preview → valid seven → live match with score bug and pause/resume → final whistle → report → save/reload → front page;
  - phone 375 px: a second full match, preview → live (sticky score bar) → report.
- **Playwright `tactics-persistence`** (passes): board save/reload, the preview lineup, failure and retry.
- **Integration QA in the browser** (`phase2-screenshots/stabilization-qa-evidence.json`), on a new career "Stabilization QA" (left in place):
  - board edits survived immediate reloads, and the preview showed the saved seven;
  - the match kicked off with that seven and the saved tempo (archived kickoff tempo QUICK);
  - own timeout at 1:10 → Spara → full reload restored the timeout → resume → played on without error;
  - substitution Brauer → Wettebrandt;
  - final **Kropps 17–24 IFK Tumba**;
  - report identical after reload; archive intact (2 periods, 2 timeouts, 13 substitutions, no INCOMPLETE);
  - "Fortsätt →" led to the front page with the result.
- **Preserved tester career.** "Arena Testare" (Phase 2) was **no longer in the browser pane's storage** when this phase started: no `hm-game` database, no active-save key, no exported copy on disk. Nothing in this phase deleted it; the pane's storage had been reset. It could not be used, so the Stabilization QA career took its place.

## 9. Regression

| Gate | Baseline (`65668fa`) | Final |
|---|---|---|
| Full bounded node regression (unit, tactical, match centre, persistence, save/load, competition, development, engine-backed career match suites; `cpuQualityUpgrade.test.ts` excluded as before) | 3,015 tests: 3,003 pass, 12 fail | **3,019 tests: 3,007 pass, 12 fail, 0 cancelled** (781 s); failures **identical** to `baseline-failures.txt`; +4 new tests, all passing |
| Save suites (`lib/save/*`) | — | 29 + new, all pass |
| TypeScript | clean | clean |
| Scoped ESLint (changed files) | — | no findings |
| Production build | exit 0 | exit 0 |
| Worker packaging | verified | verified (same 3 non-fatal `sharp` copy notices) |
| Wrangler `deploy --dry-run` | 17,535.47 / 2,676.17 KiB | exit 0, 17,538.67 KiB / gzip 2,677.07 KiB; nothing deployed |
| Playwright | 15 / 31 pass | **17 / 32 pass** (section 6) |

Logs: `C:\DEV\QA\logs\club-identity\stab-*` (build, build2, build-worker, wrangler-dry-run, full-regression, failures, playwright-full, playwright-final-build).

## 10. Known limitations

- A browser can still be killed hard (crash or power loss) while a write is in flight. The exit flush covers reload, navigation, tab close and backgrounding, not a process kill.
- The leave-page guard depends on the browser. Chromium needs user activation, and iOS Safari may not show it. The exit flush is the primary protection.
- Treatment and personal-sanction time-outs share the paused-flight behaviour. No case was observed; it was not changed, because the engine is protected.
- Eleven Playwright failures remain, all pre-existing and classified (section 7). The B-class speed rewrites need an owner choice of speeds.
- The original "Arena Testare" QA career is gone from the browser pane (section 8).

**No production release without separate owner approval.**
