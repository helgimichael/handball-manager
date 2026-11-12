# M6C/M6D + M7D Alpha hotfix: unemployment media + qualification routing

Date: 2026-11-12. Branch `hotfix/alpha-unemployment-media-qualification-routing` in worktree `C:/DEV/WORKTREES/handball-manager/alpha-hotfix-media-routing`, based on local main `1f5ed4b` (deployed code `5383771` + the release report).

- **Not pushed, not deployed.** The Alpha Worker stays at `a848413e-9f7b-4e18-8b26-2e0b850286b2`; rollback target `06194a7c-b82d-4edc-bb60-0a10424d17c9`.
- The live QA career `save-f5f3e949-…` was not touched. It is preserved at its qualification matchday in the built-in browser profile.

## Verdict

**Both fixes pass.** No regressions were found; the 12 known baseline failures are unchanged. The hotfix is ready for push and deploy approval.

## Bug A: stale media after unemployment

### Root cause

- **The frozen cursor.** M7D skips the media tick while the manager is unemployed (`apps/game/lib/career/dailyTick.ts`). `results()` in `apps/game/lib/media/worldTick.ts` reads every fixture after `media.lastResultsDate` and treats the managed club's fixtures as the manager's own. With the tick skipped, that cursor froze at the resignation. On the first employed day, the whole unemployed window was replayed against the *new* club: 32 stories and 2 blocking press conferences on the Alpha.
- **The season verdict.** In the same lifecycle, `seasonStories → seasonMood` would apply a season verdict already decided before an appointment to the new manager's supporter mood, once per season and club.
- **Other paths are safe.** `previews`, `fromEvents`, `coachChanges`, `transfers`, `weekly` and `progressPress` only act on the current day or upcoming fixtures and cannot replay a backlog.

### Fix (no media deleted, no press suppressed)

1. **`keepMediaClock(state, date)`** (`worldTick.ts`), called from `dailyTick.ts` when the media tick is skipped while unemployed. It advances only `media.lastResultsDate` to `date − 1`, exactly what `results()` would have done; no stories and no press. The media date progression stays consistent with the calendar.
2. **`settleMediaForAppointment(state, date)`** (`worldTick.ts`), called in `acceptJobOffer` (`apps/game/lib/manager/changeClub.ts`).
   - It catches the results clock up to the appointment, which also repairs saves made unemployed by the **deployed** release, whose clock is already frozen.
   - It marks an already-decided season verdict as felt for the new club.
3. **An own-result guard in `results()`.** For a mid-career appointment (a stint after the first), a fixture dated on or before the appointment day belongs to the predecessor. It is reported as an ordinary league result, never as the manager's match report or press conference. Appointments happen after the day's games. The first stint keeps the existing behaviour, because a new career's first match can fall on its first day.

Media generated after the appointment is untouched: match reports, press conferences, rival comments and aftermath all proceed normally, with the existing `seen` dedupe.

## Bug B: qualification match 404

### Root cause

- M1.2 qualification fixture ids carry the season, e.g. `2026/27:transition:d1-s-final-9:g1` (`careerQualifications.ts`).
- `match-preview/page.tsx` pushed `/career/match-day/${fixture.id}` without encoding. The `/` split the dynamic segment, Next answered 404, and the session update was lost.
- The same raw pattern existed in 24 more links across 14 more files: the match-report replay buttons, `GameShell` resume, `match-2d`, `contextualContinueAction`, `destinations` (notification links), `ProductionMatchView` (finish → report) and the schedule, club, analysis, home and player-performance report links.

### Fix (stored ids unchanged)

- **New `apps/game/lib/career/fixtureRoutes.ts`:**
  - `matchDayHref(id, { finish })`, `matchReportHref(id)` and `fixtureHref(id)` encode the id as one segment with `encodeURIComponent`.
  - `fixtureIdFromParam(param)` reads it back idempotently, whether or not the router already decoded `%2F`.
  - `samePath` compares routes regardless of encoding.
- **Every raw link now uses the helper.** The three fixture pages (`match-day`, `match-report`, `fixtures`) resolve their param through `fixtureIdFromParam`. The live-match "already on route" check in `contextualContinueAction` uses `samePath`.
- **Unchanged URLs for ordinary ids.** League ids (`swe-2-f5`) and cup ids (`2026-cup-R32-15-l1`) encode to themselves, so their URLs are byte-identical to before. Links that already used `encodeURIComponent` (calendar, training, history, Workspace, WeeklyManagerOverview) are untouched.

## Exact changed files

| File | Change |
| --- | --- |
| `apps/game/lib/media/worldTick.ts` | `keepMediaClock`, `settleMediaForAppointment`, own-result guard (`appointedMidCareerOn`) |
| `apps/game/lib/career/dailyTick.ts` | Calls `keepMediaClock` while unemployed |
| `apps/game/lib/manager/changeClub.ts` | Calls `settleMediaForAppointment` in `acceptJobOffer` |
| `apps/game/lib/career/fixtureRoutes.ts` (new) | Route helpers |
| `apps/game/app/career/match-preview/page.tsx` | Start match / quick result → `matchDayHref` |
| `apps/game/app/career/match-day/[fixtureId]/page.tsx` | Param via `fixtureIdFromParam` |
| `apps/game/app/career/match-report/[fixtureId]/page.tsx` | Param via `fixtureIdFromParam`; replay buttons → `matchDayHref` |
| `apps/game/app/career/fixtures/[fixtureId]/page.tsx` | Param via `fixtureIdFromParam`; report link |
| `apps/game/components/ProductionMatchView.tsx` | Finish / report links → `matchReportHref` |
| `apps/game/components/GameShell.tsx` | Live-match link → `matchDayHref` |
| `apps/game/lib/career/contextualContinueAction.ts` | Resume target `matchDayHref`; on-route check `samePath` |
| `apps/game/lib/career/destinations.ts` | MATCH_DAY / MATCH_REPORT notification links |
| `apps/game/app/career/match-2d/page.tsx`, `app/career/page.tsx`, `app/career/schedule/page.tsx`, `app/career/clubs/[clubId]/page.tsx`, `app/career/analysis/page.tsx`, `app/career/analysis/last-match/page.tsx`, `app/career/analysis/opponent/page.tsx`, `components/manager/PlayerPerformance.tsx` | Report/fixture links → helpers |
| `apps/game/lib/media/unemploymentMedia.test.ts` (new) | Bug A regression tests (2) |
| `apps/game/lib/career/fixtureRoutes.test.ts` (new) | Bug B regression tests (4) |
| `apps/game/scripts/game-test-files.json` | Both new tests added to the canonical manifest |

There are no gameplay, engine, competition, training or data changes, and no test was weakened, skipped or removed.

## Focused regression results

| Test | Result |
| --- | --- |
| `unemploymentMedia`: resign → six months unemployed (checked daily: no stories, no press, media clock = calendar − 1) → **reload while unemployed** (media and manager career byte-identical) → join another club with a backlog → **no press, own story or false match report for any match before the appointment**; Continue not blocked → **a genuinely new match produces the manager's own MATCH_REPORT** → **reload preserves media**; 3 more days produce no duplicate → history intact | **PASS** (235 s) |
| `unemploymentMedia`: a save made unemployed by the **deployed** release (frozen clock) → next job | **PASS**: no backlog; normal media resumes |
| **Control:** the same two tests on the unfixed release tree `5383771` | **FAIL** on day one ("the media clock follows the calendar (2026-08-26)"), confirming the tests catch the regression |
| `fixtureRoutes`: qualification `2026/27` id encoded to one segment; league and cup ids unchanged; round trip; resume and notification links | **PASS** |
| `fixtureRoutes`: a **real** M1.2 qualifier (generated by `progressCareerQualifications`), quick result → **native V2 session**, V2 result, archive under the stored id, save/load through `saveRepository` with archive read-back, **fixture ids unchanged** | **PASS** |
| `fixtureRoutes`: live qualifier → JSON reload mid-match → session still present, Continue resumes on the encoded route, result identical to the uninterrupted match | **PASS** |

## Cross-system regression

| Gate | Result |
| --- | --- |
| Canonical manifest (299 files, excluding `cpuQualityUpgrade`) | **2,916 tests: 2,904 pass, 12 fail**. The failure set is **identical** (by name) to the integration baseline, i.e. the documented 12 pre-existing failures. All 6 new tests pass in the suite |
| `cpuQualityUpgrade.test.ts` | Not re-run (multi-hour). Its imports (`cpuRecruitment`, `cpuSquadNeeds`, `cpuContractDecisions`, `simulate-player-development`, `game-data`) are untouched by the hotfix; established baseline: times out identically on base and release |
| M7D realistic career scenario (resign → unemployed → new club in another division → 3 seasons, 79 native V2 matches, 7 reloads) | **PASS**; final summary **byte-identical** to the released code |
| M6C/M6D assistant-training scenario (9 weeks, 45 reloads) | **PASS**; identical metrics to the release |
| M6C/M6D training, M7D career, board, competition transitions, cup schedule, qualification scheduling, weekly manager, matchday, saves | All pass in the suite. The M1.2 qualification and transition tests (`careerQualifications`, `transition`, …) all pass |
| Existing save compatibility | The old-release backup (`455f369`, 5 V2 archives) was imported through `importSaveFromJson` with the hotfix code: archives byte-identical before and after further play, and the career continued with 3 more V2 matches. **PASS** (16/16 checks) |
| Training after changing clubs | Covered by the unchanged training code paths and the M7D/M6C scenarios; verified live on the release before this hotfix. The hotfix touches no training file |
| TypeScript | **0 errors** |
| Scoped ESLint (all changed/new files) | 1 error and 3 warnings, **all pre-existing** and identical on the release tree (`GameShell` setState-in-effect; `WorldEvent`, `_plan`, `_seeking` unused). The hotfix adds none |
| Production build | **Pass**: `/career/match-day/[fixtureId]`, `/career/match-report/[fixtureId]`, `/career/fixtures/[fixtureId]` built |
| Cloudflare Worker build (pinned OpenNext 1.20.0) | **Pass**; artifacts verified |
| Wrangler 4.151.2 dry-run | **Pass**: 286 assets, 17,341.62 KiB / gzip 2,625.35 KiB; no upload |

## Native qualification match: browser verification

Run against the hotfix production build (`next start`, localhost:3731) in the built-in browser; nothing was deployed.

- **The career.** A career on a real M1.2 qualification matchday was built with the hotfix code (`make-qual-backup.mts`): Kärra HF (Division 1 Norra) v Täby HBK, `2026/27:transition:ha-semi-n:g1`, 2027-03-25. It was imported through the app's own "Importera sparafil".
- **STARTA MATCH:** `/career/match-day/2026%2F27%3Atransition%3Aha-semi-n%3Ag1`, **HTTP 200**, native match centre "KÄRRA – TÄBY · Kval".
  - Played to 8:27 (4–5) and paused.
  - **Page reload:** same URL, HTTP 200; resumed at 8:27, 4–5, paused. The top bar recognised the route ("Match pågår i matchcentrum").
  - From the office, "Återgå till aktiv match" pointed to the encoded route and resumed the paused match.
  - Finished: **34–36**, redirected to `/career/match-report/2026%2F27%3A…`.
  - Report reload: HTTP 200. "Se matchrepris" opened the archive replay on the encoded match-day route.
- **IndexedDB after the match:**
  - result `engine: "V2"`, 34–36;
  - `matchArchiveIds` = `["2026/27:transition:ha-semi-n:g1"]`, the stored id;
  - all 5 qualification ids stored unchanged, 0 ids stored encoded;
  - matchday resolved, no hanging session.
- **SNABBRESULTAT (the Alpha's 404 path), after a fresh import:** `/career/match-day/2026%2F27%3A…?finish=1` played out natively, finishing **31–39**, then the encoded match report.
- **Console:** no errors.

## Remaining limitations

- **The live QA career on the Alpha origin** still sits at its blocked qualification matchday until the hotfix is deployed. After deployment the same buttons work, and its existing stale media backlog stays as history; that is not data loss.
- **Saves already re-employed on the deployed release** keep the stale stories that were already generated, since the hotfix does not delete media. Saves still unemployed are protected by `settleMediaForAppointment`.
- **Unchanged from the release report:**
  - unemployed Continue stops on approaches, not on new vacancies;
  - the Division 1 assistant needs a hired assistant coach;
  - the training-template Saturday placeholder;
  - the 12 baseline test failures and the `cpuQualityUpgrade` timeout.

## Evidence

Logs in `C:/DEV/QA/logs/2026-11/`:
- `hotfix-media-test-fixed.log` and `hotfix-media-test-unfixed-control.log`
- `hotfix-routing-test.log`
- `hotfix-suite.log`
- `hotfix-m7d-career-scenario.log` and `hotfix-training-scenario.log`
- `hotfix-old-backup-import.log`
- `hotfix-scoped-lint.log`
- `hotfix-production-build.log`
- `hotfix-worker-build.log` and `hotfix-wrangler-dry-run.log`

Reports in `C:/DEV/QA/reports/handball-alpha-hotfix-media-routing/` (scenario outputs and `make-qual-backup.mts`).

## Commits

- Implementation: `09ce9fdc725630478cb6c23ab5ae9cd065661fb5` on `hotfix/alpha-unemployment-media-qualification-routing` (parent `1f5ed4b`).
- This report is committed directly on top. Nothing pushed, nothing deployed.
