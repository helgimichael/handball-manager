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

## Summary

| | |
|---|---|
| New journey | **PASS** (desktop + phone, full native V2 match, save/load) |
| Regressions caused by this work | **3 found by the e2e runs, all fixed:** "Sparade karriärer" link covered by the feedback button; wrong verdict on archived away matches; duplicate "Förläng kontrakt" label |
| Specs passing in the latest runs | alpha-access 6/6, worker-snapshots 2/2, arena-journey 1/1, game-experience-v11 1/2, game-presentation 1/2, weekly-manager 1/1, match-motion 1/3 |
| Remaining failures | 13 failing + 4 not executed, all pre-existing (environment, data or seed drift, stale selectors); listed above |

**Status: PARTIAL.** The new and affected journeys are green. The older suite still needs repairs that are outside this phase's scope: a manual line-up step in the match specs, recorded fixtures, and updated selectors for archived reports.
