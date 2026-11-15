# Arena Nights Phase 2 — Playwright / E2E Report (Phase E)

## How the suite was run

- **App:** a production build (`next build --webpack` → `next start --port 3001`) of `feat/club-identity-arena`. The commit is stated in the completion report.
- **Command:** `HM_QA_URL=http://localhost:3001 npx playwright test` runs all 31 specs in `apps/game/e2e/`, with one worker.
- **Harness:** `apps/game/playwright.config.ts` (new). The local alpha access gate is pre-authorised through storage state for the `career` project. The gate's own spec runs in the `alpha-gate` project, in a fresh locked context, so its assertions are untouched.
- **Earlier screenshots kept:** the specs' own screenshot writes went to a scratch folder (`HM_QA_SCREENSHOT_DIR`). The few specs that write into tracked `docs/` evidence folders regardless were restored with `git checkout` after the run, so earlier milestones' evidence is unchanged.

## Spec changes (no assertion weakened)

| Change | Why |
|---|---|
| `e2e/hubNav.ts` + `navTo(page, tab)` in `management`, `product`, `game-experience-v11`, `game-presentation` | Destinations live in six hubs (ENT-07). Specs reach a page hub → tab, the way a manager does. |
| `worker-snapshots`: "Trupp" link visible → "Laget" hub link visible | Same intent: the career navigation is loaded. |
| Profile chapter names (`Matcher`, `Översikt`, `Kontrakt & framtid`, `Karriär`) | The player dossier renamed its chapters (SQD-02). |
| Squad selection checkboxes `Välj <namn>`; Prestation is a `tab` | Squad Matrix (SQD-01): selection now drives the bulk tray, not only comparison. |
| Calendar: assert 7 days in Vecka, then 28 in Månad | WLD-05: the calendar opens on the current week. |
| Global search → command palette | ENT-08a |
| Manager step also fills `Nationalitet` + `Födelsedatum` | **Pre-existing drift.** The wizard requires them (added before this branch), and the old specs could not get past the manager step. |
| Continue: `getByRole('button',{name:'Fortsätt »'})` → `.hm-continue-header` | **Pre-existing drift.** The button's accessible name has been its `aria-label` ("Fortsätt till nästa händelse …") since before this branch (verified at `27a559d`). |

## Genuine regressions found and fixed

1. **"Sparade karriärer →" was covered by the fixed feedback button.** Found by `game-experience-v11`: the slimmer hub rail moved the footer under the alpha feedback button. Fixed in `c2d9ed3` by reserving room in the rail.
2. **The final-whistle verdict was wrong for away matches in archived replays.** Found by the journey spec: an away win read "Förlust". `ArchiveReplay` defaulted to HOME. Fixed in `be68ca0`, and guarded by the journey (the card's verdict must match the front page's verdict).

## The new journey (E2/E3/E4)

`e2e/arena-journey.spec.ts` **passes**, three times: as a single run, inside the full suite, and in the final rerun (54 s). It covers:

| # | Step | Assertion |
|---|---|---|
| 1 | Open an existing career | New career, then title screen → FORTSÄTT → `/career` shell |
| 2 | All six hubs | Each rail hub opens its landing route, shows `<hub>: flikar` and is `aria-current` |
| 3 | Command palette | Ctrl+K → type "Taktik" → Enter → `/career/tactics`, palette closed |
| 4 | Week Spine | 7 days, exactly one today |
| 5 | Front page | Lead headline, "Att avgöra" |
| 6 | Player profile | From the Squad Matrix to the dossier (sticky bar visible) |
| 7 | Player history | Utveckling, Matcher, Karriär, Kontrakt & framtid headings |
| 8 | Tactical board | Phase × manpower grid visible (assistant proposal applied when the squad is empty) |
| 9 | Tactical views | "Försvar 6 mot 6" → heading and `data-phase=DEFENCE`, back to attack |
| 10 | Matchday preview | Continue until "STARTA MATCH →" is enabled; 3 ritual steps; 7 court spots |
| 11 | Live match | Live route: `data-route=live-match`, Spine hidden, Continue disabled |
| 12 | Progression | Spela → Spela till slut (engine plays both halves) |
| 13 | Completion | Final-whistle card; its verdict must agree with the front page's verdict |
| 14 | Match report | Editorial headline contains the final score; identical after reload (save/load) |
| 15 | Back home | Front page lead `data-kind=RESULT` with the final score |
| — | Phone (375 px) | Front, squad, tactics, report and player: no horizontal overflow, no error overlay, dock visible; Mer opens 26 page links |
| — | Errors | No page errors |

**Real match evidence** (`phase2-screenshots/live-match-evidence.json`): Varberg 32–26 IFK Tumba (Svenska Cupen, away), reproduced identically on every run from the same career seed. A different seed in an earlier run gave V.Irsta 24–35 IFK Tumba.

**Screenshots** (`phase2-screenshots/`):

- `01` front page
- `02`/`03` player
- `04` tactics (defence)
- `05` matchday preview
- `06` live
- `07` final whistle
- `08` report
- `09-*` phone front / squad / tactics / report
- `10` phone player

## Full suite (all 31 specs, run 2)

| # | Spec | Test | Result | Time |
|---|---|---|---|---|
| 1 | `alpha-access.spec.ts` | unauthorized direct route is blocked and incorrect codes explain how to retry | **passed** | 1.2s |
| 2 | `alpha-access.spec.ts` | valid trimmed case-insensitive code unlocks immediately and persists across reload and navigation | **passed** | 636ms |
| 3 | `alpha-access.spec.ts` | a stale stored code does not grant access just because the flag is true | **passed** | 744ms |
| 4 | `alpha-access.spec.ts` | blocked local storage surfaces a Swedish recovery instruction | **passed** | 355ms |
| 5 | `alpha-access.spec.ts` | feedback exports the currently active save through the real JSON repository download | **passed** | 1.9s |
| 6 | `alpha-access.spec.ts` | feedback explains missing and unreadable active saves without a download | **passed** | 717ms |
| 7 | `arena-journey.spec.ts` | arena journey: existing career to a completed native V2 match and back, desktop and phone (1.3m) | **passed** |  |
| 8 | `career-loading-screen.spec.ts` | real New Game: immediate feedback, duplicate guard, canonical save, success and refresh | **FAILED** | 297ms |
| 9 | `career-loading-screen.spec.ts` | storage failure: safe focused recovery, no raw diagnostics and no resubmission | **skipped** |  |
| 10 | `career-loading-screen.spec.ts` | provider failure after setup persisted: keep one save, recover through main menu | **skipped** |  |
| 11 | `career-loading-screen.spec.ts` | normal live New Game: no snapshot, clock or ID overrides; save and refresh work | **skipped** |  |
| 12 | `contract-renewal-errors.spec.ts` | renewal refusal is recoverable, duplicate/over-budget offers are safe, and a valid renewal survives reload | **skipped** |  |
| 13 | `game-experience-v11.spec.ts` | career setup validates the selected league, starts another club, and safely returns to a saved career | **passed** | 4.3s |
| 14 | `game-experience-v11.spec.ts` | Continue identifies the real stop, object navigation retains workspace context, and unread reading stays visible | **FAILED** | 39.2s |
| 15 | `game-presentation.spec.ts` | five presentation screens at desktop and ultrawide, with actual career data | **passed** | 10.1s |
| 16 | `game-presentation.spec.ts` | player identity survives tabs, offer drafts survive selection and sporting screens remain navigable (1.5m) | **FAILED** |  |
| 17 | `human-match-realism-v2.spec.ts` | three automatically selected real career archives: normal report and visible immutable replay | **FAILED** | 33.2s |
| 18 | `management.spec.ts` | connected management journeys, contracts, shortlist, scouting, world links and save/load | **FAILED** | 34.5s |
| 19 | `match-calibration-v21.spec.ts` | calibrated v2.1 career match: visible 2D at live speeds, coaching, both halves, persistence, report and archived replay | **FAILED** | 42.1s |
| 20 | `match-calibration-v21.spec.ts` | retained19–19 replay stays immutable on the new build; same pinned recipe starts a new canonical match (1.5m) | **FAILED** |  |
| 21 | `match-calibration-v21.spec.ts` | selected calibration archives: three automatic cases with real replay movement and causal scene evidence (1.5m) | **FAILED** |  |
| 22 | `match-center-v21.spec.ts` | normal career: live decisions, halftime, save/load and four match review views (1.2m) | **FAILED** |  |
| 23 | `match-realism-v2.spec.ts` | canonical career match: visible 2D at live speeds, coaching, both halves, persistence, report and archived replay | **FAILED** | 41.3s |
| 24 | `product.spec.ts` | normal career UI: real squad, calendar, live match, decisions, finalization and reload | **FAILED** | 2.4s |
| 25 | `reconciliation.spec.ts` | normal career: live decisions, halftime, save/load and four match review views (1.3m) | **FAILED** |  |
| 26 | `weekly-manager.spec.ts` | weekly office links existing training, persists edits and shows daily Continue feedback | **passed** | 6.2s |
| 27 | `worker-snapshots.spec.ts` | workerd serves complete canonical squads and ratings | **passed** | 302ms |
| 28 | `worker-snapshots.spec.ts` | New Game initializes and persists a real Handbollsligan career under workerd | **FAILED** | 30.3s |
| 29 | `match-motion.spec.ts` | normal career motion: live and immutable replay at 1x/4x/16x, pause and seek (1.1m) | **FAILED** |  |
| 30 | `match-motion.spec.ts` | full canonical replay and actual handball scenes in all three motion archives | **FAILED** | 274ms |
| 31 | `match-motion.spec.ts` | actual canonical help, recovery, M6 and support cues at 1x | **passed** | 54.8s |

Totals: 31 tests — 12 passed, 15 failed, 4 skipped.


## Rerun after the fixes (`90edb65` build)

| # | Spec | Test | Result | Time |
|---|---|---|---|---|
| 1 | `worker-snapshots.spec.ts` | workerd serves complete canonical squads and ratings | **passed** | 413ms |
| 2 | `worker-snapshots.spec.ts` | New Game initializes and persists a real Handbollsligan career under workerd | **passed** | 4.4s |
| 3 | `arena-journey.spec.ts` | arena journey: existing career to a completed native V2 match and back, desktop and phone | **passed** | 54.1s |
| 4 | `game-experience-v11.spec.ts` | career setup validates the selected league, starts another club, and safely returns to a saved career | **passed** | 3.0s |
| 5 | `game-experience-v11.spec.ts` | Continue identifies the real stop, object navigation retains workspace context, and unread reading stays visible | **FAILED** | 34.4s |
| 6 | `product.spec.ts` | normal career UI: real squad, calendar, live match, decisions, finalization and reload | **FAILED** | 32.6s |

Totals: 6 tests — 4 passed, 2 failed, 0 skipped.


## Every remaining failure, triaged

None of these is caused by Arena Nights Phase 1 or 2. Each was checked against the baseline code.

| Spec | Failure | Cause | Evidence |
|---|---|---|---|
| `career-loading-screen` (1 failed + 3 not run, serial) | `ENOENT …/verification/baseline-snapshots.json` | Environment: needs a baseline recorded with `HM_LOADING_BASELINE=1` | File absent in this worktree; the spec reads it unconditionally |
| `contract-renewal-errors` | skipped | By design: needs an exported controlled career + plan file | `test.skip(!backup \|\| !planFile)` |
| `game-experience-v11` › Continue … | No `.game-target-dossier` for "Ahlin" + M9 in Spelarsök ("Inga spelare matchar filtren") | Data drift in the player market. Everything before it in the spec passes (hub nav, inbox stop, squad selection memory, back navigation) | `/career/players` is untouched by this branch |
| `game-presentation` › player identity … | Expects "Torslanda" on the front page after New Game | Seed-dependent: the first opponent varies per career seed (V.Irsta, Varberg in my runs) | Same spec's first test passes |
| `human-match-realism-v2`, `match-calibration-v21` (retained 19–19, selected archives) | `.game-match-centre > strong` not found on archived match reports | Pre-existing: the archived-report branch never rendered `MatchHero` | `git show 27a559d:…/match-report/[fixtureId]/page.tsx`: archive branch has no `MatchHero` |
| `management` | Expects the contract end date to change immediately after offering a renewal | Pre-existing: renewal talks answer the next day ("Svar i morgon") | Contracts and renewal code untouched |
| `match-calibration-v21` (calibrated), `match-center-v21`, `match-realism-v2`, `reconciliation` | "STARTA MATCH →" stays disabled | Pre-existing: careers need a chosen starting seven (manual line-up), which these specs never set; the journey uses the assistant proposal | Disabled by the existing line-up checks in `match-preview` (unchanged logic) |
| `match-motion` (2) | `ENOENT …/after-final/match-007-completed.json` | Environment: recorded motion archives (`HM_MOTION_ARCHIVE_DIR`) not present | The third motion test passes |
| `product` (rerun) | `getByText('Startsju', { exact: true })` not found | Pre-existing: no element with exactly that text exists at `0e2129e` or `27a559d` either. My regression in this spec (duplicate "Förläng kontrakt") is fixed and the spec now gets past the renewal step. | `git show 0e2129e:…/tactics/page.tsx \| grep Startsju` |

## Completion pass — Playwright repair (Phase C)

### What was repaired (no assertion weakened)

| Change | Specs | Why |
|---|---|---|
| `e2e/matchPrep.ts`: `chooseStartingSeven` (guard preview → apply → "Startsju 7/7") and `readyStartMatch` (if "STARTA MATCH →" is disabled, choose a seven on the board and return **in-app** via "Till matchen →", then assert the button is enabled, with the preview's own attention list in the failure message) | `match-calibration-v21`, `match-center-v21`, `match-realism-v2`, `reconciliation`, `product`, `arena-journey` | Careers require a manual starting seven; the specs now select one the way a manager does. A full reload right after applying drops the plan before autosave, so the helper navigates in-app. |
| `product`: `getByText('Startsju', {exact:true})` → choose the starting seven first | `product` | A new career has no seven; the old exact text never existed. |
| Report score: `.game-match-centre > strong` → `.game-match-centre > strong, .mc-scoreline .mc-score-figure` (first) | `human-match-realism-v2`, `match-calibration-v21`, `match-realism-v2` | Archived reports render the Match Center scoreline, plain results the `MatchHero`. The same score is still asserted exactly. |
| `showCourt2D`: open the "Experimental 2D" disclosure (retrying past hydration) before asserting the court is visible | `match-calibration-v21`, `match-realism-v2`, `match-motion` | The 2D court has been opt-in since `c3d4ad4`, before this branch. |
| Optional `storageState({indexedDB:true})` resume dump made best-effort | `match-center-v21`, `reconciliation` | With full match archives the dump exceeds Node's maximum string length (`RangeError`). It is a resume aid for `HM_QA_REVIEW`, not a check. |
| Key-moment "Mål" filter: the first row contains `/mål/i` | `match-center-v21`, `reconciliation` | 7 m goals are labelled "7m-mål" (since `0f7a84e`); they are goals. |
| `product` advance loop waits for the preview to render before checking for "STARTA MATCH →" | `product` | It checked `isVisible()` before render and then clicked a disabled Continue. |
| Journey: score-bug and pause/resume assertions; a **second full native V2 match played at 375 px** (preview → live → report), press conferences delegated; the sticky score bar must stay in the viewport after scrolling | `arena-journey` | B2/B4 and the mobile journey. |

### Genuine regressions found and fixed in this pass

1. **Reduced motion:** `arena.css` set `transition-duration: 0.01ms` on every element, overriding the Match Center's own `transition: none` (found by `match-center-v21`). Now `0s`.
2. **Phone live match:** below 900 px the Match Center unsticks its score bar, so score and clock scrolled away (found by the new phone journey). The live route now keeps it sticky on phones.
3. **Final-whistle keeper card** showed "0 mål" under "Målvakt · räddningsprocent" (found in the native V2 run). It now shows saves/shots and the percentage.

### Final full run (production build of the final code, all 31 tests)

| Measure | Count |
|---|---|
| Tests in the suite | 31 |
| Executed | 27 |
| Passed | **15** |
| Failed | 12 |
| Skipped by design | 1 (`contract-renewal-errors`: needs an exported controlled career) |
| Never ran | 3 (`career-loading-screen` serial tests after its first failure) |

Run 2 (Phase 2) had 12 passed and 15 failed; its table also counted the 3 never-run tests as "skipped" (4), which is corrected here. Newly passing: `arena-journey` (now two full matches, desktop and phone), `human-match-realism-v2`, `match-calibration-v21` › selected archives, and `match-center-v21`. `game-presentation` #1 passed in run 3 and failed in the final run because it is seed-dependent (below).

| Spec | Cause | Class |
|---|---|---|
| `career-loading-screen` (1 failed + 3 not run) | Missing `docs/career-loading-screen-v1/verification/baseline-snapshots.json` (record with `HM_LOADING_BASELINE=1`) | Environment |
| `match-motion` › full canonical replay | Missing recorded archives in `docs/match-motion-continuity/after-final/` (`HM_MOTION_ARCHIVE_DIR`) | Environment |
| `match-motion` › normal career motion | The court now opens; the spec then selects speeds 4× and 16×, which the speed list (since `48446f0`) does not offer | Pre-existing stale flow |
| `match-calibration-v21` › calibrated; `match-realism-v2` | Kick-off now works; the spec then reads the old live scoreboard `.game-scoreboard-top`, replaced by the Match Center in `c3d4ad4` | Pre-existing stale flow |
| `match-calibration-v21` › retained 19–19 | Kick-off and court work; the new session's initial hash differs from the recorded one (the behaviour revision changed after the recording; the engine is untouched here) | Pre-existing recorded fixture |
| `reconciliation` | Kick-off works. In the final run the match stops in an opponent timeout the spec never resumes. In run 6 **the engine stopped with "Matchen kunde inte fortsätta … Unresolved ball flight budget" after timeout → save → reload → resume** | Seed-dependent flow; **engine defect for the owner** |
| `game-presentation` (2) | Expects "Torslanda" as the first opponent; the opponent depends on the New Game seed, which the UI cannot pin | Seed nondeterminism |
| `game-experience-v11` › Continue … | No "Ahlin" M9 in the player market | Data drift |
| `management` | Expects the contract date to change right after offering; renewals answer the next day and may be refused | Pre-existing, nondeterministic |
| `product` | Gets through the live match and report, then expects league results; the first competitive match was a cup tie | Seed-dependent |

### Environment prerequisites

- Production build: `npm run build` in `apps/game`, then `next start --port 3001`. Never run it alongside the dev server; they share `.next`.
- `HM_QA_URL=http://localhost:3001`, and `HM_QA_SCREENSHOT_DIR=<scratch folder>` so specs do not overwrite tracked evidence.
- Recorded fixtures for the environment-class specs: an `HM_LOADING_BASELINE=1` run for `career-loading-screen`, `HM_MOTION_ARCHIVE_DIR` for `match-motion`, and an exported career plus plan file for `contract-renewal-errors`.
- Some specs still write into tracked `docs/` (`docs/game-experience/*`, `docs/match-realism-v2/human-qa/browser/*`) and create `docs/match-motion-continuity/browser-baseline/canonical-cues.{json,webm}`. Restore with `git checkout --` and remove those two files after each run.

## Summary

| | |
|---|---|
| Journey | **PASS**: career → front page → squad → dossier → tactics (valid seven via the guard preview) → preview → live (score bug, pause/resume) → final whistle → report → front page, then a second full match on a phone |
| Final suite | 31 tests: 27 executed, 15 passed, 12 failed, 1 skipped by design, 3 never ran |
| Regressions caused by Arena Nights | 6 found across Phase 2 and this pass, all fixed |
| Remaining failures | All classified above: missing recorded fixtures, seed or data dependence, flows stale since before this branch, and one engine defect (reported, not fixable here) |

**Status: PARTIAL.** Every regression is fixed, and every match spec now selects a valid starting seven and starts its match. The remaining failures need recorded fixtures, seed control, rewrites of flows that predate this branch, or an engine fix, which this phase may not make.
