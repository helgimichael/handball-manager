# Arena Nights Phase 2 — Final Completion (Tactical Board · Live Match · Playwright Repair)

## Summary

| Phase | Status |
|---|---|
| A Tactical Board | **COMPLETE**: all 7 open recommendations (TRN-02a, d, e, f, g, h, i) implemented; no genuine blocker |
| B Matchday and Live Match | **COMPLETE for the P0 scope**: valid starting seven enforced; always-visible score bug (half, players on court, timeouts) on desktop and phone; event emphasis by tone; progression verified; post-match report and return. Separate walk-out and half-time layouts (MDY-02) remain deferred |
| C Playwright repair | **PARTIAL**: totals reconciled; 3 more regressions found and fixed; every match spec now chooses a real starting seven and starts its match; 15 / 27 executed pass; every remaining failure classified |
| D Integration | **PASS**: the journey runs end to end with no dead ends, desktop and phone, two full native V2 matches |
| E Real game validation | **PASS**: full native V2 match on the existing QA career, **IFK Tumba 31–19 VästeråsIrsta HF**, save/load and archives intact |
| F Visual polish | **PASS** for the checks run (phone score line, reduced motion, keeper card) |

| | |
|---|---|
| Branch / worktree | `feat/club-identity-arena`, `C:\DEV\WORKTREES\handball-manager\club-identity-arena` |
| Baseline commit | `1a73e1a` |
| Commits | `4355fcf` (tactics board), then the completion commit that adds this report |
| Pushed / merged / deployed | **No / no / no**. No production database touched, no career reset, no worktree deleted |
| Unchanged | Native V2 match engine, simulation, outcomes, ratings, development, competition rules, cooperation restrictions, transitions, B-team rules |

## Changed files (`1a73e1a..` final)

Application and tests, 23 files (+811 / −129 before the report files):

- **New:** `lib/matchPlan/tacticsBoard.ts`, `lib/matchPlan/tacticsBoard.test.ts`, `components/tactics/BoardTools.tsx`, `components/tactics/board-tools.css`.
- **Tactics:** `app/career/tactics/page.tsx`, `components/game/CoachingChoices.tsx`, `components/matchPlan/HandballPlanSections.tsx`, `app/globals.css`.
- **Live match:** `components/matchCenter/MatchCenter.tsx` (score bug `ScoreBugMeta`, keyed callout, keeper card), `components/matchday/matchday-arena.css` (score bug, tones, phone sticky bar), `app/arena.css` (reduced motion), `app/arena-overrides.css` (regenerated, unchanged check).
- **E2E:** `e2e/matchPrep.ts` (new helpers), `arena-journey`, `human-match-realism-v2`, `match-calibration-v21`, `match-center-v21`, `match-realism-v2`, `match-motion`, `product`, `reconciliation`.
- **Test list:** `scripts/game-test-files.json`.
- **Traceability:** `design-lab/experience-2027/club-identity/arena-traceability.mjs` → `ARENA-NIGHTS-SURFACE-TRACEABILITY.md`.
- **Reports:** the three Phase 2 reports, this report, `phase2-screenshots/` (01–13, `live-match-evidence.json`, `native-v2-match-evidence.json`).

## The seven Tactical Board recommendations

| ID | Recommendation | Status | Evidence |
|---|---|---|---|
| TRN-02a | Inline warning + auto-fix preview | **Implemented** | Guard bar with preview diff, apply/cancel, undo; `diffLineups` test; used by every match spec |
| TRN-02d | Pairing lines on court | **Implemented** | `PairingCourt` in Byten & Diff; browser check add/remove |
| TRN-02e | Segmented control + legend | **Implemented** | `OverlayControl` radiogroup + legend; test against the page's thresholds; journey |
| TRN-02f | Choices with trade-off lines | **Implemented** | `COACHING_TRADEOFFS`; test against engine thresholds; journey |
| TRN-02g | Ordered 7 m takers with stats | **Implemented** | `SetPieceSection`; stats test |
| TRN-02h | Single roles editor | **Implemented** | `LeadershipSection` "Ledarskap & roller" |
| TRN-02i | Bench strip + counter | **Implemented** | `BenchStrip` 16 places + drawer; test; journey asserts 16 |

None is a theme adjustment. MDY-02a (score bug with pips) also moved to Implemented in this pass.

**Traceability:** all 231 recommendations and 551 alternatives remain traceable. Implemented **34 / 231** (was 26), P0 **21 / 55** (was 17); 197 intentionally deferred, 0 blocked.

## Native V2 evidence (existing QA career)

"Arena Testare" (IFK Tumba, dev origin), not reset or overwritten. Svenska Cupen 2026-08-26 at home to VästeråsIrsta HF, engine `2.9.1-court-rotation.1`.

- Valid seven (7/7) before kick-off.
- Pause held the clock; aggression changed to Hög (archived `TACTICS_CHANGED`); own timeout at 1:26 (pip 1 → 0); opponent timeout at 20:29.
- Half-time 14–7 with "Halvtid" and 6 v 5 pips; second half reset timeouts.
- Manual substitution Brauer → Lindahl.
- **Final 31–19**, "Slutsignal · Seger"; report headline "IFK Tumba körde över V.Irsta, 31–19".
- Archive: 2 periods, 1 tactics change, 3 timeouts, 14 substitutions, 7 suspensions.
- Save → reload: both archives (29–26, 31–19) and the schedule unchanged.
- "Fortsätt →" returned to the front page.

Details: `phase2-screenshots/native-v2-match-evidence.json`.

The journey e2e also played two further full matches on fresh careers (desktop: Varberg 33–23 IFK Tumba; and one at 375 px), each to report and back.

## Desktop and mobile QA

- Desktop 1440 × 900: front page, dossier, tactics board (guard, overlay, legend, strip, trade-offs), preview, live, final whistle, report — screenshots 01–08.
- Phone 375 × 812: front, squad, tactics, report, player, then **preview → live → report of a full match** — screenshots 09–13. No horizontal overflow on any checked page; the score bar stays in view while scrolling.

## Playwright (reconciled)

31 tests: **27 executed, 15 passed, 12 failed, 1 skipped by design, 3 never ran**. The full table, repairs, regressions and each failure's class are in `ARENA-NIGHTS-PHASE2-E2E-REPORT.md`.

Regressions caused by Arena Nights that were found and fixed in this pass:

1. Reduced-motion transitions (`0.01ms` → `0s`).
2. Score bar not sticky on phones.
3. Keeper card on the final whistle.

## Regression

| Gate | Baseline (`1a73e1a`) | Final |
|---|---|---|
| Full bounded node regression (`cpuQualityUpgrade.test.ts` excluded as before) | 3,010 tests: 2,998 pass, 12 fail | **3,015 tests: 3,003 pass, 12 fail, 0 cancelled, 0 skipped** (575 s). The 12 failures are **identical** to `C:\DEV\QA\logs\club-identity\baseline-failures.txt`; +5 new tests, all passing |
| Unit, tactical, match, competition, save/load and development suites | included above | included above; `tacticsBoard` 5/5, Match Center 110/110 |
| TypeScript | clean | clean |
| Scoped ESLint (changed files) | — | no new findings; 7 pre-existing warnings, 10 pre-existing `any` errors in `career-loading-screen` and `match-motion` (same occurrences as the baseline) |
| `generate-arena-overrides --check` | up to date | up to date |
| Production build | exit 0 | exit 0 (four rebuilds during repair, last one used for the final Playwright run) |
| Worker packaging | verified | "Cloudflare Worker Build Successfully Verified" (the same 3 non-fatal `sharp` copy notices as every earlier worker build) |
| Wrangler `deploy --dry-run` | 17,507.39 KiB / gzip 2,668.07 KiB | exit 0, 17,535.47 KiB / gzip 2,676.17 KiB (+28 KiB / +8 KiB gzip); nothing deployed |
| Playwright | 12 passed, 15 failed, 4 "skipped" (3 of them never ran) | **15 passed, 12 failed, 1 skipped by design, 3 never ran** |

Logs: `C:\DEV\QA\logs\club-identity\phase2c-*` (build, build2–4, full-regression, failures, build-worker, wrangler-dry-run, playwright-run3…run8, playwright-final).

## Limitations and remaining work

- **Engine defect for the owner (not fixable here):** in run 6, `reconciliation` stopped with "Matchen kunde inte fortsätta … Unresolved ball flight budget" after timeout → save → reload → resume at 0:49. The engine may not be modified in this phase.
- **Save timing:** a plan applied on the tactics board is lost if the page is fully reloaded before the next autosave or "Spara". The specs now navigate in-app; the product behaviour is unchanged and worth an owner decision.
- Team timeouts are archived and shown live but not listed among key moments (existing importance filter).
- Playwright specs still failing for reasons outside this phase: recorded fixtures (`career-loading-screen`, `match-motion` archives, `contract-renewal-errors`), seed or data dependence (`game-presentation`, `game-experience-v11`, `product`, `management`), flows stale since before this branch (old live scoreboard, removed 4×/16× speeds), and the pinned-recipe hash.
- Deferred MDY / ANL layouts: MDY-02 walk-out and half-time layouts, MDY-02b–i, ANL-01 momentum chart and turning points.

**No production release without separate owner approval.**
