# Club Identity & Arena Nights — Complete Report (C4.1 + C5 + C6)

## Summary

| Phase | Status |
|---|---|
| C4.1 Competition completion + human-manager rule | **PASS** |
| C5 Arena Nights experience | **PARTIAL**: 17 / 231 recommendations implemented (9 / 55 P0), 214 deferred with reasons, 0 blocked |
| C5.1 Shell (hub rail, Week Spine, palette, phone dock) | **PASS** |
| C5.2 Matchweek Front Page | **PASS** |
| C5.3 Squad Matrix + Peek (player dossier not rebuilt) | **PARTIAL** |
| C5.4 Calendar + top-bar overflow (other C5.4 surfaces themed only) | **PARTIAL** |
| C5.5 Matchday / report / analysis (verified, not rebuilt) | **PARTIAL** |
| C5.6 Responsive QA, motion, performance | **PASS** |
| C6 Cross-system validation (25 items) | **PASS** |
| Quality gates | **PASS**, with no new regressions; 12 baseline failures unchanged |

## Branch and commits

| | |
|---|---|
| Worktree | `C:\DEV\WORKTREES\handball-manager\club-identity-arena` |
| Branch | `feat/club-identity-arena` |
| Base | `feat/club-identity-final` @ `27a559d` (the baseline; preserved and not modified) |
| Pushed / merged / deployed | **No / no / no** |

Commits created, in order:

| Commit | Content |
|---|---|
| `e99d303` | C4.1 human managers never lead B-teams; deterministic Division 3 re-entry |
| `a41b4cb` | C5.1 hub rail, Week Spine, command palette, phone dock; C5.2 Matchweek Front Page |
| `a70d557` | C5.3 Squad Matrix with player chips, saved views, tray and Peek |
| `1217216` | C5.4 Week Spine Calendar and top-bar overflow |
| `0debe0a` | C5.6 tactics court-mode tabs fit phone width |
| *(final)* | docs: the six reports + traceability generator (the commit containing this file) |

## Files changed (`27a559d..HEAD`, code)

**Competition and human-manager rule:**

- `apps/game/lib/game-data/clubIdentity.ts`
- `lib/manager/managerCareer.ts`
- `lib/manager/changeClub.ts`
- `lib/career/careerInitialization.ts`
- `lib/competition/transition/parentPriority.ts`
- `lib/career/seasonTransition.ts`
- `app/new-game/page.tsx`
- `app/page.tsx`

**Arena shell and models:**

- `components/GameShell.tsx`
- `components/CareerSaveControl.tsx`
- `components/shell/{CommandPalette,WeekSpine,PlayerChip,PlayerPeek}.tsx`
- `components/shell/{shell,front,matrix}.css`
- `lib/career/{hubs,weekSpine,commandPalette,frontPage,squadMatrix}.ts`

**Pages:**

- `app/career/page.tsx`
- `app/career/squad/page.tsx`
- `app/career/calendar/page.tsx`

**Generated and wiring:**

- `app/globals.css`
- `app/arena-overrides.css` (only the generated stylesheet count changed)
- `scripts/game-test-files.json`

**Tests:**

- `lib/competition/transition/parentPriority.test.ts`
- `lib/manager/bTeamHumanManager.test.ts` (new)
- `lib/career/arenaShell.test.ts` (new)
- `e2e/hubNav.ts` (new)
- `e2e/management.spec.ts`
- `e2e/game-experience-v11.spec.ts`
- `e2e/game-presentation.spec.ts`

The e2e specs were updated for hub → tab navigation, the palette, "Välj" checkboxes and the calendar views. They were **not run** in this phase; see the limitations.

Total: 35 files, +2,127 / −210.

**Docs and tools:**

- `docs/club-identity/` — the six reports
- `design-lab/experience-2027/club-identity/arena-traceability.mjs`

## C4.1 results

See `CLUB-IDENTITY-C4.1-FINAL-REPORT.md`. All 20 required tests pass. Focused suites: **149 / 149**.

- **Competition rules:** B-teams always stay below their A-teams, re-enter Division 2 deterministically, and are replaced by the next eligible club. Allocations cascade, run atomically and keep league sizes.
- **Human-manager rule:** humans cannot select, apply for, receive or keep a B-team, while CPU B-teams keep operating. Existing saves are recovered by a neutral release.

## All 19 surfaces

See the table in `ARENA-NIGHTS-IMPLEMENTATION-REPORT.md`.

| Status | Surfaces |
|---|---|
| Implemented | Dashboard, Navigation, Squad, Calendar, Manager career (clubless state) |
| Partial | Career creation, Club selection |
| Deferred with reasons | the remaining 12 |

## Recommendation traceability

`ARENA-NIGHTS-SURFACE-TRACEABILITY.md` has all 231 rows with Recommendation | Surface | Priority | Existing state | Implemented state | Evidence | Disposition. It is regenerable with `node design-lab/experience-2027/club-identity/arena-traceability.mjs`.

| Priority | Implemented | Deferred | Blocked |
|---|---|---|---|
| P0 (55) | 9 | 46 | 0 |
| P1 (78) | 6 | 72 | 0 |
| P2 (66) | 2 | 64 | 0 |
| P3 (32) | 0 | 32 | 0 |

The lab data is unchanged: `verify-amendment.cjs` and `verify-club-identity.cjs` both report **0 issues** (logs in `C:\DEV\QA\logs\club-identity-arena\`).

## Desktop and mobile QA

See `ARENA-NIGHTS-RESPONSIVE-QA.md`. 26 routes × 3 widths showed no page overflow and no error overlay. One pre-existing defect (tactics tabs at 375 px) was fixed. A full live match was played through the UI under the new shell.

## Performance

See the implementation report.

- **Bundle:** JS +1.1 %, CSS +8.4 %; worker gzip +10.5 KiB.
- **Runtime:** the new pure models take 0.2–1.6 ms per call on a 660-fixture career.
- **Dependencies:** none added.
- **Not measured:** browser LCP/INP.

## Save compatibility

- **Older saves:** v8 saves load and switch at their first rollover (LEGACY soak).
- **No new fields:** C5 adds no career-state fields. All new UI state is per device (`localStorage`: rail pin, palette recents) or workspace memory (matrix view, density, sort).
- **New write paths:** the only new writes are existing operations reached from the tray (squad status, training load, captaincy, transfer list).
- **B-team recovery:** saves where the manager leads a B-team are recovered on load by a neutral, idempotent release.

## Five-season validation

Both soaks use quick simulation; live play was validated separately (C6 item 22).

| Soak | Seed | Result |
|---|---|---|
| NEW | `club-identity-soak-new-b` | 5 rollovers, identity, leagues, relations, history and league sizes intact; A-team priority exercised |
| LEGACY v8 | — | 5 rollovers, world preserved, switch at the first rollover |

## Regression

**Baseline (`27a559d`):** 2,988 tests, 2,976 pass, 12 fail.

| Gate | Result |
|---|---|
| Full bounded regression (314 files; `cpuQualityUpgrade.test.ts` excluded as before, over 90 minutes; 15-minute per-test timeout), run at `a70d557` | **3,002 tests: 2,990 pass, 12 fail, 0 skipped, 0 cancelled, 0 timed out** (633 s). The 12 failures are **identical** to the baseline list. +14 tests, all passing. |
| Shell, palette, Spine, front page, matrix and season-strip suite after `1217216` (`arenaShell.test.ts`) | 9 / 9 pass |
| C4.1 focused suites | 149 / 149 pass |
| TypeScript (`tsc --noEmit`) | clean |
| Scoped ESLint on changed files | 0 new errors. One pre-existing `react-hooks/set-state-in-effect` error in `GameShell.tsx:133` (`setNavOpen(false)` on route change, present at `27a559d`) and two pre-existing unused-var warnings in `changeClub.ts`. |
| `generate-arena-overrides.mjs --check` | up to date |
| Production build (`next build --webpack`) | exit 0 |
| Worker packaging (`build:worker`) | "Cloudflare Worker Build Successfully Verified" |
| Wrangler `deploy --dry-run` | exit 0, 17,465.57 KiB / gzip 2,655.80 KiB; nothing deployed |
| Lab verifiers | 0 issues / 0 issues |

Logs are in `C:\DEV\QA\logs\club-identity-arena\`: `full-regression.log`, `c41-focused.log`, `build.log`, `build-worker.log`, `wrangler-dry-run.log` and `verify-*.log`.

### Known baseline failures (unchanged, pre-existing at `27a559d`)

1. Total real Allsvenskan player count matches the HM-DATA-1.5 corrected roster (284 players).
2. Continue Controller: same seed reproduces an identical season end-to-end.
3. HBL bio milestone: CA/PA ratings unaffected by bio-data corrections.
4. HBL bio milestone: exactly 265 unique active HBL playerIds.
5. HM-PLAYTEST-IMPROVEMENT-02: Allsvenskan club cannot negotiate with top Handbollsligan stars.
6. Population audit: 1191/1191 real players receive a complete gameplay CA, PA and attribute branch.
7. A complete initialization publishes one complete save using its own deterministic seed.
8. Bundled Handbollsligan squads, ratings, staff and identity snapshots equal native Node data.
9. Harness: the season-0 checkpoint reproduces the audited database baseline.
10. Legacy saves are neutral, intentions persist…
11. No cross-league name+DOB identity collision beyond documented owner decisions.
12. Persistent financial crisis and an ambitious player create explained gradual intentions.

## Remaining limitations

1. **Recommendations still open.** 214 of 231 are deferred: their structures are not rebuilt (Arena theme only). The traceability gives each one a reason. The largest open families are:
   - player dossier (SQD-02);
   - tactics board and training (TRN-01/02; M6C/M6D assistant proposals preserved);
   - recruitment and deal room (REC-02–04);
   - League Centre (CMP-01);
   - matchday ritual and live Match Center (MDY-01/02);
   - editorial match report (ANL-01);
   - inbox desk (WLD-01);
   - clubhouse (CLB);
   - entry screens (ENT-02/03).
2. **Peek** is wired for squad players only; clubs, staff and fixtures still navigate.
3. **Breadcrumb** stops at hub › tab; the entity level (e.g. the player's name) is not resolved.
4. **Phone gestures:** long-press-to-last-sub-page and swipe-to-close on the Mer sheet are not implemented.
5. **Playwright e2e specs** were updated for the new navigation but **not executed** in this phase (each spec needs a long-running server session). The node test suite and manual browser QA cover the same flows.
6. **Browser performance** (LCP/INP) not measured; the QA pane was intermittently a background page.
7. **Pre-existing, not fixed:**
   - white-on-amber rating chip (inline style, about 2:1 contrast);
   - the lint error in `GameShell.tsx:133`;
   - `DIVISION2_POOL_INSUFFICIENT` for seed `club-identity-soak-new` at rollover 5.

## Decisions still required from the owner

1. **"B-team" definition.** Confirm that only second-team relation kinds count. U-teams (e.g. HK Cliff) and partner associations (IF Kristianstad) remain human-manageable.
2. **Existing B-team saves.** Confirm the neutral `CONTRACT_ENDED` release on load, rather than forcing a club choice before Continue.
3. **Re-entry hysteresis.** Confirm that a B-team re-enters Division 2 only after its A-team has been above Division 2 for the season just played and the next.
4. **Hub mapping.**
   - Media is placed under Karriär and Analys under Tävling, as the lab suggested. The lab flags this as ambiguous.
   - "Rekrytering" appears both as a hub and as its first tab.
5. **Order for the remaining structural work.** The proposal is:
   1. player dossier (SQD-02);
   2. matchday ritual and Match Center (MDY-01/02);
   3. tactics board (TRN-02);
   4. deal room (REC-03/04);
   5. League Centre (CMP-01);
   6. inbox desk (WLD-01).
6. **Merge.** Whether and when `feat/club-identity-arena` should be merged. It has not been merged, pushed or deployed.
