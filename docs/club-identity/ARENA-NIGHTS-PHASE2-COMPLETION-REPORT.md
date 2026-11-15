# Arena Nights Phase 2 — Completion Report

## Summary

| Phase | Status | Report |
|---|---|---|
| A Player experience | **PASS** | `ARENA-NIGHTS-PHASE2-PLAYER-EXPERIENCE.md` |
| B Matchday and live match | **PASS** for the ritual, court line-up, live environment, final whistle and report navigation; the full MDY-02 sequence is **PARTIAL** | `ARENA-NIGHTS-PHASE2-MATCHDAY-LIVE.md` |
| C Tactical board | **PARTIAL**: workspace header and phase × manpower switcher; TRN-02a/d/e/f/g/h/i open | `ARENA-NIGHTS-PHASE2-TACTICAL-BOARD.md` |
| D Connected journey | **PASS**: the 15-step journey runs end to end, with no dead ends, on desktop and phone | `ARENA-NIGHTS-PHASE2-E2E-REPORT.md` |
| E Playwright / E2E | **PARTIAL**: all 31 specs actually executed; the new journey passes; every failure triaged (3 caused by this work, all fixed; the rest pre-existing) | `ARENA-NIGHTS-PHASE2-E2E-REPORT.md` |
| F Visual polish | **PASS** for the checks run: AA contrast fix, honest empty states, regressions fixed | below |

| | |
|---|---|
| Branch | `feat/club-identity-arena`, worktree `C:\DEV\WORKTREES\handball-manager\club-identity-arena` |
| Baseline | `0e2129e` (Phase 1 final) |
| Pushed / merged / deployed | **No / no / no** |
| Unchanged | Match engine, simulation, tactical calculations, ratings, development, results, C4.1 rules, competition and cooperation logic |

## Commits (`0e2129e..`)

| Commit | Content |
|---|---|
| `a54e0dc` | Phase 2A player dossier (SQD-02 C, 02a A, 02g A) |
| `474f28f` | Phase 2B matchday ritual, court line-up, live environment, final whistle, report navigation |
| `b09b6db` | Phase 2C tactics board readiness header + phase × manpower switcher |
| `be68ca0` | Integration: correct own side in archived replays, state-chosen dossier action, e2e harness and journey |
| `c2d9ed3` | QA fixes: rail foot clears the feedback button, AA contrast for faint labels, e2e drift; traceability + phase reports |
| `90edb65` | Dossier action label no longer duplicates the renewal submit; worker-snapshots in the gate project |
| *(final)* | This report + the E2E report + refreshed lab verification timestamps |

## Changed files

Application code: 36 files, +1,385 / −215 under `apps/game`.

**New:**

- `lib/players/playerDossier.ts`
- `lib/players/playerDossier.test.ts`
- `components/players/PlayerDossier.tsx`
- `components/players/dossier.css`
- `lib/matchday/preMatch.ts`
- `lib/matchday/preMatch.test.ts`
- `components/matchday/PreMatch.tsx`
- `components/matchday/matchday-arena.css`
- `lib/matchPlan/boardReadiness.ts`
- `components/tactics/TacticsBoardHeader.tsx`
- `components/tactics/tactics-board.css`
- `playwright.config.ts`
- `e2e/arena-journey.spec.ts`

**Changed pages and components:**

- `app/career/squad/[playerId]/page.tsx`
- `app/career/match-preview/page.tsx`
- `app/career/match-report/[fixtureId]/page.tsx`
- `app/career/tactics/page.tsx`
- `components/matchCenter/MatchCenter.tsx`
- `components/ProductionMatchView.tsx`
- `components/GameShell.tsx`
- `components/shell/shell.css`
- `app/arena.css` (`--arena-faint`)
- `app/globals.css`
- `scripts/game-test-files.json`

**Specs updated:** 11 existing Playwright specs (see the E2E report).

**Docs:**

- the five Phase 2 reports;
- `phase2-screenshots/` (14 images + match evidence);
- the regenerated `ARENA-NIGHTS-SURFACE-TRACEABILITY.md` and its generator.

## Traceability (canonical 231)

`ARENA-NIGHTS-SURFACE-TRACEABILITY.md` is regenerated from `data/surfaces.js`, which was read only: all 231 recommendations and 551 alternatives are preserved. `verify-amendment.cjs` and `verify-club-identity.cjs` both report **0 issues**.

| | Phase 1 | Phase 2 |
|---|---|---|
| Implemented | 17 | **26** |
| Implemented P0 | 9 / 55 | **17 / 55** |
| Intentionally deferred (with reason) | 214 | 205 |
| Blocked | 0 | 0 |

Newly implemented:

- SQD-02, SQD-02a, SQD-02g
- MDY-01, MDY-01e, MDY-02j
- TRN-02, TRN-02b, TRN-02c

Newly partial, with their reasons recorded:

- MDY-02
- MDY-02a
- ANL-01

## Live match evidence

A native V2 match was played through the new experience by e2e, with no mocked result:

- **Result:** Varberg **32–26** IFK Tumba (Svenska Cupen).
- **Route:** preview → live route → "Spela till slut" (both halves) → final-whistle card "Slutsignal · Förlust" → match report "Varberg körde över IFK Tumba, 32–26".
- **Save/load:** the report reloaded with an identical headline, and the front page then led with the result.
- **Repeatability:** reproduced identically in all three runs from the same seed.

Evidence is in `phase2-screenshots/live-match-evidence.json` and screenshots `05`–`08`.

## Desktop and mobile results

- **Journey (1440 px and 375 px):**
  - no horizontal overflow and no error overlay on front, squad, player, tactics and report;
  - the phone dock is visible;
  - the Mer sheet exposes all 26 page links;
  - no page errors.
- **Visual review:** screenshots `01`–`10`.
- **Phase 1 sweep:** the 26-route sweep at three widths still holds, because the shell is unchanged apart from rail padding.

## Regression

| Gate | Result |
|---|---|
| Full bounded node regression (316 files; `cpuQualityUpgrade.test.ts` excluded as before; 15-minute per-test timeout) | **3,010 tests: 2,998 pass, 12 fail, 0 skipped, 0 cancelled, 0 timed out** (500 s). The 12 failures are **identical** to the baseline list (`C:\DEV\QA\logs\club-identity\baseline-failures.txt`). +8 new tests, all passing. |
| New unit suites (dossier, preMatch, arenaShell, arenaTheme, navigation) | 30 / 30 |
| TypeScript | clean |
| ESLint on changed files | no new findings (pre-existing warnings in untouched files; `GameShell.tsx:133` pre-existing error) |
| `generate-arena-overrides --check` | up to date |
| Production build | exit 0 |
| Worker packaging | "Cloudflare Worker Build Successfully Verified" |
| Wrangler `deploy --dry-run` | exit 0, 17,507.39 KiB / gzip 2,668.07 KiB; nothing deployed |
| Playwright | see the E2E report: journey PASS; 3 regressions found and fixed; 13 failing + 4 not executed, all pre-existing |

Logs are in `C:\DEV\QA\logs\club-identity-arena\`:

- `phase2-full-regression.log`
- `e2e-arena-journey.log`
- `e2e-full-run2.log`
- `e2e-rerun.log`
- `phase2-build*.log`
- `phase2-wrangler-dry-run.log`
- `phase2-verify-*.log`

## Performance

**Bundle size, Phase 1 build → Phase 2 build:**

| Measure | Phase 1 | Phase 2 | Δ |
|---|---|---|---|
| All static JS | 3,863.7 KB | 3,896.1 KB | +32.4 KB (+0.8 %) |
| All static CSS | 399.2 KB | 422.0 KB | +22.8 KB (+5.7 %) |
| Worker gzip | 2,655.80 KiB | 2,668.07 KiB | +12.27 KiB |

**Runtime:**

- The new models are pure and memoised per career, like the Phase 1 models (which measured 0.2–1.6 ms).
- Motion is limited to a 0.5 s score pop, a 0.42 s final-whistle entrance, form-bar rise and the LIVE pill pulse. All of it is disabled under `prefers-reduced-motion`.
- No new dependencies.

## Visual quality (Phase F)

- **Contrast:**
  - `--arena-faint` raised from `#6c7890` (3.8–4.4:1) to `#8590a6` (≥ 4.8:1 on every Arena surface), so the small uppercase labels meet AA.
  - The other token pairs used (ink, muted, neon, status colours) measure 5.6–18:1.
- **Club neon:** used for selection, the active hub, attack phase, own rows and readiness rings. Defence uses info blue. Crests keep their original colours.
- **Empty states:** dossier development, form and career; match history ("Lagen har inte mötts tidigare"); bench ("Inga avbytare uttagna"). All say what will appear and when.
- **Found in review and fixed:** a single-match form bar stretched across the whole width; the condition panel was squeezed into the narrow rail; the pivot sat inside the 6 m area on the court line-up.
- **Not done:** a screen-reader pass and real-device testing (emulation only).

## Remaining recommendations and known limitations

- **Structures still open:** 205 of 231 recommendations keep their earlier layouts (Arena theme only). The traceability gives a reason for each. The largest open families are:
  - SQD-02b–j panels;
  - TRN-02a/d/e/f/g/h/i;
  - MDY-02 walk-out, timeout and half-time layouts;
  - MDY-02b–i;
  - ANL-01 momentum, turning points and workload;
  - REC deal room;
  - CMP League Centre;
  - WLD inbox desk;
  - CLB clubhouse;
  - ENT entry screens.
- **Peek:** squad players only.
- **Older Playwright specs** need repairs outside this phase's scope:
  - a manual line-up step before "STARTA MATCH" (4 match specs);
  - recorded fixtures (`career-loading-screen` baseline, motion archives, contract-renewal plan);
  - archived-report selectors (`.game-match-centre`);
  - seed-independent opponents;
  - player-market data for "Ahlin".
- **Pre-existing, unchanged:** the white-on-amber rating chip, and the `GameShell.tsx:133` lint error.

## Decisions for the owner

1. Whether the older Playwright match specs should be updated to choose a line-up through the assistant proposal (as the journey does), and whether recorded fixtures should be regenerated.
2. Merge timing for `feat/club-identity-arena`. It is not merged, pushed or deployed. A production release needs your separate approval.
