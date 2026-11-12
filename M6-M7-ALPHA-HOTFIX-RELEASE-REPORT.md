# M6/M7 Alpha hotfix release report

Date: 2026-11-12. Scope: integrate the unemployment-media and qualification-routing hotfix into main, push it, deploy it to the existing Cloudflare Alpha Worker and verify it live. No other environment was touched, no tester career was reset or overwritten, and M6 Scouting & Delegation was not started.

## Final status: **PARTIAL**

- **Bug A (stale media after unemployment): fixed and verified live.**
- **Bug B (qualification 404): the routing is fixed live**; the encoded match-day route and its server payload return 200. The full native qualification flow is verified on the identical build.
- **The live QA career's qualification match still cannot start, for a different, pre-existing reason now exposed:** its opponent is a Division 2 pool club, and every Division 2 pool club in the qualification draw has **0 players**, so no native lineup can be built (see "Newly exposed blocker"). This was not caused by the hotfix and is not fixed by rolling back; before the hotfix the same match failed earlier, with a 404.

## Commits

| Item | Value |
| --- | --- |
| Main before | `1f5ed4b27b1bd1657aff0bea54beaa6527afd2ea` (deployed code `5383771` + release report) |
| Hotfix source | `09ce9fdc725630478cb6c23ab5ae9cd065661fb5` (implementation + 6 tests), `baffa31826ed9e698775ea0d53c36e606e829e66` (results report) on `hotfix/alpha-unemployment-media-qualification-routing` |
| **Integration commit** | **`4f7e542fe7bdc038549b8fd607f432d3b23541de`**: release(alpha): integrate unemployment media and qualification routing hotfix (parents `1f5ed4b`, `baffa31`; `--no-ff`) |
| Push | `5383771..4f7e542 main -> main`, fast-forward, no force; `git ls-remote origin refs/heads/main` = `4f7e542fe7bdc038549b8fd607f432d3b23541de` |
| **Worker version** | **`74bc40ce-5c57-4fa1-b3b1-52881930cea5`**, message `M6-M7-alpha-hotfix-media-routing-4f7e542…`, **100% traffic** |
| **Rollback target** | **`a848413e-9f7b-4e18-8b26-2e0b850286b2`** (the M6C/M6D + M7D release, previously 100%). Earlier fallback: `06194a7c-b82d-4edc-bb60-0a10424d17c9` |

This report is committed on local main on top of `4f7e542`; it is a documentation-only commit and is **not pushed**.

To roll back if needed, run this from `apps/game` with the pinned Wrangler:

```
node cloudflare/node_modules/wrangler/bin/wrangler.js rollback a848413e-9f7b-4e18-8b26-2e0b850286b2 --config wrangler.jsonc
```

## 1. Pre-integration

- Local main was `1f5ed4b`; origin/main was `5383771` (unmoved since the release).
- `main..hotfix` was exactly `09ce9fd` and `baffa31`. The hotfix is based directly on current main and includes the release-report commit `1f5ed4b`.
- Hotfix diff vs main: 24 files, +586 −33 (the files listed in `M6-M7-ALPHA-HOTFIX-RESULTS.md`).
- Worktrees (37) were all preserved; the involved ones were clean. The main checkout `C:/DEV/PROJECTS/handball-manager` was untouched (its untracked `.claude/` and `docs/audit/` were left as they were).

## 2. Integration

- `git merge --no-ff` of the hotfix branch into main (in main's worktree `alpha-hotfix-release-2026-11-08`): no conflicts.
- The merged tree is **byte-identical to `baffa31`**, the verified hotfix tip. No other changes or refactoring.

## 3. Final verification (on the integration tree)

The tree at `4f7e542` differs from the suite-tested `09ce9fd` only by `M6-M7-ALPHA-HOTFIX-RESULTS.md`, so the full-suite evidence carries over directly.

| Gate | Result |
| --- | --- |
| Six new hotfix tests + focused regressions (qualification, transition, cup schedule, save repository, portable backup, M7D career, assistant training, contextual Continue): 10 files | **119/119 pass** |
| Full canonical manifest (from the hotfix run on the identical code) | 2,916 tests, 2,904 pass, **12 fail = the known baseline set, unchanged** |
| `cpuQualityUpgrade.test.ts` | Not repeated (multi-hour). The established baseline timeout is unchanged and the file's code paths are untouched |
| M7D career scenario (3 seasons, 79 native V2 matches, 7 reloads, resignation, division move) | **PASS**; final summary **byte-identical** to the released code |
| M6C/M6D assistant-training scenario | **PASS**; **identical** to the release |
| Save/load compatibility (old-release backup `455f369`, 5 V2 archives, via `importSaveFromJson`) | **PASS**, 16/16 checks; archives byte-identical |
| TypeScript | **0 errors** |
| Scoped ESLint (all files changed vs `1f5ed4b`) | 1 error and 3 warnings, **all pre-existing** (`GameShell` setState-in-effect; `WorldEvent`, `_plan`, `_seeking` unused). **No new findings** |
| Production build + Cloudflare Worker packaging (pinned OpenNext 1.20.0) | **Pass**; artifacts verified |
| Wrangler 4.151.2 dry-run | **Pass**: 286 assets, 17,341.62 KiB / gzip 2,625.28 KiB |
| Historical fixture ids and archived results | Unchanged. The hotfix never rewrites stored ids, which the tests assert; checked live below |

## 4. Push and deploy

- Pushed `4f7e542`.
- Before the deploy, `deployments status` showed `a848413e…` at 100%; recorded as the rollback target.
- Deployed the artifact built at `4f7e542` with `wrangler deploy --config wrangler.jsonc` to `handball-manager-alpha` only: 74 new assets uploaded (94 reused), Worker startup 22 ms.
- After the deploy: **(100%) `74bc40ce-5c57-4fa1-b3b1-52881930cea5`**.
- Live smoke: `/` 200, `/api/editor/status` 200, `/api/game-world/squad-snapshot?competitionId=se_division1_sodra` 200.

## 5. Live verification (built-in browser, separate QA profile, QA careers only)

Saves in this profile: `save-f5f3e949…` (preserved release-QA career, Vinslövs HK) and a new `save-7196fe49…` (hotfix-QA career "QA Hotfix Media", started at IFK Tumba). No tester career exists in this profile.

### Media (new QA career `save-7196fe49`)

| Check | Result |
| --- | --- |
| Unemployment continues normally | Played the 2026-08-20 cup match (quick result, 29–28; ordinary cup route `/career/match-report/2026-cup-R32-16-l1`), then resigned. Unemployed Continue ran from 2026-08-20 to 2026-12-03. **The media clock advanced with the calendar** (e.g. 08-26 → `lastResultsDate` 08-25, 09-16 → 09-15, 12-03 → 12-02), with **no stories or press conferences produced while unemployed** (2 stories and 1 press throughout) |
| Accepting a new job creates no historical match reports | Redbergslids IK (Allsvenskan) approached on 2026-12-03 and was accepted in the job market. Redbergslid had **12 matches** during the unemployed spell (2026-08-26 → 11-28), the backlog the old release replayed. First employed day (12-04): **0 stale stories**; the only new media is a genuine preview of the upcoming 12-06 match (IFK Tumba – Redbergslid, "Återkomst till din gamla klubb") and its pre-match press conference |
| Genuine new matches generate normal media | The 12-06 league match was played live via "STARTA MATCH" (ordinary route `/career/match-day/profixio-32643627`): **22–35** away, V2, archived. Post-match press conference opened normally and was delegated. Next tick: **own MATCH_REPORT from 5 outlets** (GP, Mitt i, Handbollskanalen, P4 Göteborg, SVT Väst) |
| No stale press conferences block Continue | None opened; Continue was only interrupted by the genuine pre- and post-match press conferences, both delegated to the new club's assistant (Jasmin Zuta) |
| Reload preserves media | Page reload: stored media identical (same size, same story keys) |

### Qualification (preserved release-QA career `save-f5f3e949`, Vinslövs HK, `2026/27:transition:d1-s-final-9:g1` v Lödde Vikings HK)

| Check | Result |
| --- | --- |
| Open a real qualification fixture | Pass: the match preview shows "KVAL · LÖDDE VIKINGS HK – VINSLÖV" with "STARTA MATCH" and "SNABBRESULTAT" |
| Routing | **Fixed live**: "STARTA MATCH" navigated to `/career/match-day/2026%2F27%3Atransition%3Ad1-s-final-9%3Ag1`; the server payload (`?_rsc`) and page bundle answered **200** (the old release requested `/2026/27:…` and got 404) |
| Start match / quick result on this fixture | **Blocked (newly exposed, pre-existing)**: `startProductionMatch` throws "Lödde Vikings HK behöver sex tillgängliga utespelare och en målvakt", and the page shows "This page couldn't load". Quick result calls the same start. See "Newly exposed blocker" |
| Save integrity after the failed start | Pass: fixture ids identical to before (33 qualification fixtures, ids with "/" unchanged), result count unchanged, no production match left, matchday still pending. The save is preserved for reproduction |
| Start, quick result, reload/resume, report and replay on a qualification fixture with squads | **Verified on the identical build** (hotfix production build, `next start`), Kärra HF v Täby HBK `2026/27:transition:ha-semi-n:g1`: live start (200), mid-match reload resume (8:27, 4–5), resume button, finish 34–36 → encoded match report, report reload, replay; quick result → 31–39. V2 result and archive stored under the original id, 0 ids stored encoded. Also covered by the two native qualification tests (119/119 above) |

### Cross-system

| Check | Result |
| --- | --- |
| Assistant training | Pass at the **new club**: Jasmin Zuta's proposal for week 2026-11-30 accounted for the 12-06 match and 86% energy, with expertise-based reasons; approved ("Godkänt · Genomfört") |
| Manager history survives club changes | Pass: stints `swe2-tumba 2026-08-20..2026-08-20 RESIGNED` → `swe2-redbergslid 2026-12-03..` |
| Competition and cup progression | Pass: Svenska Cupen rounds decided through the unemployed spell (R32, quarter-final milestones), Allsvenskan fixtures continued, and the M1.2 qualification series exists in the release-QA career (33 fixtures) |
| AI club management | Pass: incoming transfer bid for Kevin Nilsson (2026-12-09); CPU vacancies and approaches (HK Varberg vacancy; Redbergslid approach) |
| Existing career saves | Pass: the preserved release-QA career loaded on the new version with its ids and results unchanged. The old-release backup import passed (Node, real import path) |

### Browser console and network

- No new console errors in the media, league, cup, training or job-market flows.
- **One new error, from the blocker above:** the uncaught `Error: Lödde Vikings HK behöver sex tillgängliga utespelare och en målvakt` thrown from the match-preview start. It escapes the preview's `try/catch` because the throw happens inside the career-state updater, so React shows "This page couldn't load" instead of the inline message.
- The other entries in this tab's log predate this release: the old release's 404s for `/career/match-day/2026/27:…`, the earlier `ERR_BLOCKED_BY_CLIENT` from the local-bridge attempt, and one null `click` from my own QA script.

## Newly exposed blocker (pre-existing; not caused by the hotfix)

- **What happens.** A human-managed club drawn against a **Division 2 pool club** in an M1.2 qualification series cannot start that match, natively or as a quick result.
- **Exact cause.**
  - Division 2 pool clubs have no squad in the career (`worldSquads[se_div2_team_…]` is empty). In the release-QA career all 7 Division 2 clubs in the qualification draw have 0 players.
  - `startProductionMatch` requires six available outfield players and a goalkeeper for both sides and throws.
  - AI-versus-AI qualifiers are unaffected because they use the calendar simulator, not squads.
  - The thrown error escapes the match preview's `try/catch` (it runs inside the `updateCareer` state updater), so the page crashes instead of showing the inline message.
- **Scope.** Division 1 finals and other stages against Division 2 pool clubs. Stages between Handbollsligan, Allsvenskan and Division 1 clubs (squads present) work, as verified.
- **Release relation.** It was masked before by the 404, so the previous version fails earlier on the same match, and the rollback target would not help. **Not fixed during verification**, per the release rules. Follow-up needed:
  - give Division 2 qualification opponents a playable squad (the existing M1.2 Division 2 promotion-squad mechanism, or a generated qualification squad), or resolve such matches without a native lineup;
  - catch start errors in the preview.

## Remaining limitations

- The blocker above. The release-QA career `save-f5f3e949` stays at that matchday as the reproduction.
- **Stale stories already generated** on the previous release (the release-QA career's 32 from 2027-03-08) remain as history; the hotfix does not delete media.
- **Unchanged from earlier reports:**
  - unemployed Continue stops on approaches, not on new vacancies;
  - Division 1 clubs need a hired assistant for the planner;
  - the training-template Saturday placeholder;
  - cosmetic contract fields while unemployed;
  - the 12 baseline test failures and the `cpuQualityUpgrade` timeout.

## Evidence

Logs in `C:/DEV/QA/logs/2026-11/`:
- `hotfix-release-focused.log`
- `hotfix-release-m7d-scenario.log` and `hotfix-release-training-scenario.log`
- `hotfix-release-old-backup-import.log`
- `hotfix-release-typecheck.log` and `hotfix-release-scoped-lint.log`
- `hotfix-release-worker-build.log` and `hotfix-release-dry-run.log`
- `hotfix-release-deploy.log`
- full suite: `hotfix-suite.log`

Reports in `C:/DEV/QA/reports/handball-alpha-hotfix-release/` and `…/handball-alpha-hotfix-media-routing/`.
