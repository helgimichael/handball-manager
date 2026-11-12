# Division 2 playable qualification: Alpha release report

Date: 2026-11-12. Scope: integrate the verified Division 2 qualification hotfix into main, push it, deploy it to the existing Cloudflare Alpha Worker and verify it live. No other environment was touched, no tester career was reset, and no new milestone was started.

## Final verdict: **PASS**

Every required release check passed:
- integration, final verification and push;
- build, Worker packaging and dry-run;
- deployment at 100% traffic;
- the **preserved QA career's Vinslöv v Lödde qualifier played natively on the live Alpha**, with reload/resume, report/replay, quick result, idempotence and a live season rollover;
- cross-system spot checks;
- zero new browser errors.

The only failures are the documented pre-existing baseline items (12 test failures, the `division2-stock-career.ts` round-trip assertion, the `cpuQualityUpgrade` timeout), all unchanged.

## Git

| Item | Value |
| --- | --- |
| Previous main (local) | `17564f551dea8d8bec17ba08019d9ad9bf8e3fb1`: deployed `4f7e542` + the M6/M7 release report (documented as local-only) |
| Previous origin/main | `4f7e542fe7bdc038549b8fd607f432d3b23541de` (unmoved before integration) |
| Source commits | `0a1c175f8beb1474ee055790e6620d145ec53287` (implementation + 6 tests), `80c8524228ab79a5408be84ebb52635de026f284` (results report) on `hotfix/div2-playable-qualification` |
| **Integration commit** | **`62942800b97084e78090ad887929f6aaffa6f13b`**: release(alpha): integrate playable Division 2 qualification opponents (`--no-ff`, parents `17564f5`, `80c8524`; no conflicts; tree byte-identical to `80c8524`) |
| Push | `4f7e542..6294280 main -> main`, normal push, no force; `git ls-remote origin refs/heads/main` = `62942800b97084e78090ad887929f6aaffa6f13b` |
| Report | This file is committed on main directly after the integration commit and pushed with a normal push; see the delivery summary for its hash |
| Working tree status | Main's worktree is clean. The 38 worktrees were preserved. Six have uncommitted or untracked files from earlier, unrelated work (main checkout `.claude/` and `docs/audit/`; `handball-motion-lab`, `hm-player-verification-2026-27`, `hm-playtest-improvement-04`, `hm-playtest-improvement-05`, `manager`); all untouched |

**Pre-integration audit:**
- The hotfix was based directly on local main `17564f5`.
- It contains the M6C/M6D + M7D release (`5383771`), the unemployment-media/qualification-routing hotfix (`09ce9fd`) and the deployed integration (`4f7e542`).
- The Alpha was running `74bc40ce-…` at 100% before the change, as expected.

## Build and tests (on the integration tree `6294280`)

| Gate | Result |
| --- | --- |
| Canonical manifest (300 files, excluding `cpuQualityUpgrade`) | **2,922 tests: 2,910 pass, 12 fail**, 0 cancelled. The failure set is **identical** (by name) to the established baseline. **All six new hotfix tests pass on the integrated code**, including the daily-trigger test |
| Six hotfix tests | Clean Swedish failure without mutation; persistent valid squad, once (no duplicates on retry); only the manager's pool opponent (AI qualifier byte-identical, other pool clubs untouched, nothing while unemployed); daily tick generates once; promotion adds no duplicates; native V2 live, reload, quick result, persistence |
| QA-copy validation (`validate-qa-copy.mts`, real import path) | **PASS, 26/26** |
| M7D career scenario | **PASS**, byte-identical to the release |
| M6C/M6D assistant-training scenario | **PASS**, identical to the release |
| `division2-stock-career.ts` | **Fails exactly as the documented baseline**: `persist()` line 82, 1,966 `undefined`-property round-trip diffs, identical on the previously deployed code |
| `cpuQualityUpgrade.test.ts` | Not repeated (documented multi-hour baseline timeout; untouched code path) |
| TypeScript | **0 errors** |
| Scoped ESLint (7 changed TS/TSX files) | **0 findings** |
| Ignored real-world bundle | 827 canonical files generated |
| Production build | **Pass** (`/career/match-preview` built) |
| Cloudflare Worker packaging (pinned OpenNext 1.20.0) | **Pass**: middleware bypass and artifacts verified; `.open-next/worker.js` and the 14.7 MB handler present |
| Wrangler 4.151.2 dry-run | **Pass**: 286 assets, 17,349.39 KiB / gzip 2,624.78 KiB. Bindings: ASSETS and the four expected vars. Target `handball-manager-alpha`, workers.dev only, no routes |

The A–E acceptance checks were covered on the integrated code as follows:

- **A. Squad generation:** 16 players, 2 MV, all positions, persistent ids, valid contracts and registrations, provenance. Reloads add nobody; valid squads are never overwritten; conflicting registrations block generation; promotion does not regenerate.
- **B. AI integrity:** AI-vs-AI qualifier result byte-identical; only the manager's opponent generated; the generated club joins the roster-backed lifecycle (CPU recruitment, contracts, development, retirement via `careerWorldCatalogClubs`); cooperation enforced by the planner; rollover atomic (`attemptSeasonTransition` APPLIED).
- **C. Match creation:** see the live section below.
- **D. Failure handling:** verified on the identical build in the browser with a conflicting-registration copy. The Swedish alert appeared with no crash, no navigation, no session and an unchanged career. Not repeated on the live origin, to avoid putting an experimental failure save there.
- **E. Regressions:** the full suite above.

## Deployment

| Item | Value |
| --- | --- |
| Active version immediately before deploying (rollback target) | **`74bc40ce-5c57-4fa1-b3b1-52881930cea5`** (100%). Earlier fallback: `a848413e-9f7b-4e18-8b26-2e0b850286b2` |
| **New Worker version** | **`aaf554ba-76fc-4ea9-a098-8d02749cd5d2`**, message `Division2-playable-qualification-62942800…`; 75 new assets uploaded (93 reused); startup 17 ms |
| Status | Deployed; `deployments status`: **(100%) aaf554ba-76fc-4ea9-a098-8d02749cd5d2** (rechecked after live QA) |
| Endpoints | `/`, `/new-game`, `/load-game`, `/api/editor/status`, `squad-snapshot?competitionId=se_division1_sodra`, `squad-snapshot?competitionId=swe-2`: all **200** |
| Access and career loading | Access gate passed; both QA careers listed and loaded |

To roll back if needed, run this from `apps/game` with the pinned Wrangler:

```
node cloudflare/node_modules/wrangler/bin/wrangler.js rollback 74bc40ce-5c57-4fa1-b3b1-52881930cea5 --config wrangler.jsonc
```

## Qualification: preserved QA career `save-f5f3e949-…` on the live Alpha

### Original state (read-only, recorded before deploying)

- Vinslövs HK on 2027-04-03, with `MATCHDAY_READY:2026/27:transition:d1-s-final-9:g1` pending.
- **Lödde (`se_div2_team_1571471`): 0 players**; no Division 2 pool club with a squad.
- 734 fixtures (id-list hash `230d0262…`), 720 results (hash `281a8c9a…`), 1,273 players.
- Historical archive `…:2026-cup-R32-15-l1` hash `d89e8b27…`.
- A reproducible copy existed beforehand (`qa-release-m7d-vinslov-2027-04-03.json`, sha256 `18d8ea68…`).

### First load on the new version

- **Lödde: 16 registered players**: 2 MV, positions H6/H9/M6/M9/MV/V6/V9, provenance `DIVISION2_QUALIFICATION`, contracts at Lödde valid past the match date. Persistent ids, e.g. `generated-division2-qualification-v1-save-f5f3e949-…-se_div2_team_1571471-2026-27-0`.
- 1,289 players (1,273 + 16), **0 duplicate ids**. **No other pool club** got a squad, and the other clubs' 1,273 players were unchanged.
- **Fixture ids, all results and the historical archive hash-identical** to the original.

### Native V2 match (live)

1. Opened "KVAL · LÖDDE VIKINGS HK – VINSLÖV" and pressed **STARTA MATCH**: native match centre on `/career/match-day/2026%2F27%3Atransition%3Ad1-s-final-9%3Ag1`, no crash.
2. Played to **10:39 (4–5)**, paused, **reloaded the browser**: HTTP 200, the same match resumed at 10:39, 4–5, and the top bar showed "Match pågår i matchcentrum".
3. Played to full time: **Lödde 18–28 Vinslöv**. Identical to the Node validation and to the local browser run, so the result is deterministic and the reload changed nothing.
4. Stored: result **V2 18–28**; archive under the original id (`save-f5f3e949-…:2026/27:transition:d1-s-final-9:g1`) beside the untouched historical archive; no production session left; matchday resolved; **fixture id unchanged**, 0 ids stored encoded.
5. **Match report** reloaded (HTTP 200, "Vinslöv vinner. Hannes Ohlsson leder målskyttet med 11 mål på 14 avslut."), and **replay** opened from the archive on the encoded route.
6. **Retry and idempotence:** a further full reload kept the same 16 Lödde ids, 1,289 players, 0 duplicates.
7. **Quick result** on the separate eligible fixture (leg 2, 2027-04-11): **Vinslöv 38–28 Lödde**, native, encoded report route. Vinslöv won the tie.
8. Genuine media worked around the series: post-match press "Det blev seger med 28–18…", the leg-2 pre-match press, and a player-concern press, all answered by the manager (Vinslöv has no assistant).

### Season rollover (live)

- The season completed on **2027-05-13**, the same date as the Node validation, with board review and AI coach vacancies (Guif, Sannadal, Aranäs, Örebro SK).
- "Börja nästa säsong →" moved the career to **2027/28**: Vinslöv in Division 1 Södra with 22 new fixtures.
- **Lödde kept the same 16 ids.** The M1.2 promotion generator created 80 `DIVISION2_PROMOTION` players for the pool clubs it promoted. 1,369 players in total, **0 duplicates**. Manager history intact.
- Cooperation restrictions were applied by the M1.2 planner during the transition, which the QA-copy rollover reports as APPLIED with no blockers.

## Cross-system (live, deployed version)

| Area | Result |
| --- | --- |
| M1.2 | Qualification series, Division 1 tables, Svenska Cupen history, promotion/relegation and rollover all worked live (above) |
| M6C/M6D | Redbergslid career (`save-7196fe49`): the assistant (Jasmin Zuta) proposal was requested and approved, and "Godkänt · Genomfört" persisted after a reload. Training after the club change is functional |
| M7D | Manager history intact in both careers (Tumba → resigned; Redbergslid / Vinslöv stints); season rows recorded at rollover; new vacancies at season end |
| Media | Redbergslid career: 0 stale stories, no blocking press. Vinslöv: genuine pre- and post-match press only |
| Transfers / AI clubs | 4 incoming offers for Redbergslid players; AI coach changes creating vacancies; CPU lifecycle for roster-backed clubs (unit and QA-copy checks) |
| Contracts / development | Generated players carry contracts and ratings, and enter the same lifecycle as promoted squads (verified in promotion and generation tests) |

## Browser errors

- **Clean tab on the deployed version** (load-game): **0 console errors, 0 failed requests**; one pre-existing Next.js CSS-preload warning.
- **During the live QA flow:** no new errors. The QA tab's console log still holds entries from before this deployment (the old 404s, the previous version's `Lödde … behöver sex …` crash with chunk `4532-5f06…`, and one script null-click of mine); none came from `aaf554ba`.

## Remaining limitations

- **Pre-existing, unchanged:** the 12 baseline test failures; the `division2-stock-career.ts` save round-trip assertion on `undefined` properties; the `cpuQualityUpgrade.test.ts` timeout.
- **Generated qualification opponents use the Division 1-level promotion rating model**; in the QA series Vinslöv won 28–18 and 38–28.
- **A pool club that met the manager keeps its 16 players** and the roster-backed AI lifecycle, as promoted and relegated clubs do.
- **The opponent lineup builder does not filter injuries** (pre-existing).
- **The failure-state check (D)** was verified on the identical build locally, not on the live origin, deliberately, to keep experimental failure saves off the Alpha.
- **Unchanged from earlier reports:** unemployed Continue stops on approaches only; a Division 1 club's assistant must be hired; the training-template Saturday placeholder; cosmetic contract fields while unemployed.

## Evidence

Logs in `C:/DEV/QA/logs/2026-11/`:
- `div2-release-suite.log` and `div2-release-qa-copy.log`
- `div2-release-m7d.log` and `div2-release-training.log`
- `div2-release-stock.log`
- `div2-release-typecheck.log` and `div2-release-lint.log`
- `div2-release-worker-build.log` and `div2-release-dry-run.log`
- `div2-release-deploy.log`

Reports in `C:/DEV/QA/reports/handball-div2-playable-qualification/` (QA copy, validation script) and `C:/DEV/QA/reports/handball-div2-alpha-release/`.
