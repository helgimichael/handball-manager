# Career initialization / loading screen v1

Started from `2f9fcebfa609cebb443fa0e3721d4dd4b49ec8de` on 2026-10-15. This is a presentation change. Nothing was pushed.

## Flow and architecture

| Before | After | Why |
| --- | --- | --- |
| New Game briefly displayed an overlay claiming it was saving/opening, then pushed `/career`. | Start immediately replaces setup with the branded initialization surface. | A synchronous ref guard blocks repeated submissions; `flushSync` commits acknowledgement in the click task. |
| The career layout briefly showed a generic gate. | The same pre-career surface spans the route gate and provider wait. | No career navigation mounts until a usable career exists. |
| `CareerProvider` returned `null` until all snapshot fetches, synchronous world construction and persistence finished. The body showed its cream background. | The provider renders the supplied loading fallback for the whole wait, then renders the existing shell and destination. | This is the root presentation gap. A route `loading.tsx` alone cannot cover a client effect after the layout mounts. |
| Raw exception messages could reach initialization error UI. | A dedicated Swedish failure surface focuses its heading and offers the main menu. | Diagnostics stay in developer console logs. No raw exception or stack appears in this surface. |

`getOrCreateCareerState`, its fetch ordering, `createNewCareerState`, management reconciliation, persistence, save schema and success routing remain unchanged. The provider accepts two presentation fallbacks. The layout retains only small identity metadata rather than a second full career snapshot. A frame followed by a zero-delay task yields a rendering opportunity before creation starts; it adds no artificial dwell time. Hidden tabs yield a task without depending on suspended animation frames. Cancellation is rechecked after the yield.

World construction is synchronous after several existing asynchronous reads. The caller receives one initialization promise, with no supported progress/event contract. This version keeps that routine byte-identical and deliberately uses **one indeterminate initialization status**, with no percentages, staged checkmarks, rotating messages, minimum display duration, hard timeout or pipeline restructuring. There is no second exposed creation stage to screenshot.

## Player-facing copy and identity

New career: **BYGGER DIN HANDBOLLSVÄRLD…** / **Förbereder din nya karriär.**

Existing career or initial active-save lookup: **ÖPPNAR DIN KARRIÄR…** / **Laddar ditt lag och dina sparade beslut.**

Supporting copy: **Din klubb. Din säsong.** / **Det här kan ta en liten stund.** / **Sju positioner. Ett lag. Din karriär.**

Failure: **KUNDE INTE ÖPPNA KARRIÄREN** / **Något gick fel när karriären skulle öppnas.** / **Gå till huvudmenyn för att öppna en sparad karriär eller se över dina val.** / **Till huvudmenyn →**. Failure overline: **Ditt nästa steg**.

The selected setup club, its existing crest, competition and setup season appear immediately. After the route guard reads the save, the identity comes from that save; existing careers use their stored season. The short initial save lookup has branding/status before identity is known. No club is hardcoded. The existing navy, cream, orange, display font and HM identity are reused. A bounded central two-column composition stays intentional on wide screens and stacks below 700px.

Only the small activity ring rotates (CSS transform, constant linear motion). Text carries all meaning. With `prefers-reduced-motion: reduce`, no rotation is applied and the outlined marker remains visible. There is no entrance/exit delay. Loading uses `role="status"`, polite atomic announcements and visible text; failures use `role="alert"` and focus the heading. Native keyboard buttons, contrasting text and visible focus are retained.

## Submission, success and recovery

The synchronous `startSubmitted` ref is set before React updates or any await. Setup controls are replaced, so repeated pointer/Enter/Space activation cannot submit again. The guard remains locked after failure. Success still calls the existing `createSave` once, sets its active pointer and pushes `/career` once; the provider follows the original data path and automatically opens the manager home.

There is intentionally **no inline retry**. A failure can occur after the save envelope commits but before its active pointer or world initialization finishes. The existing creation API is not idempotent across a fresh submission. Returning to the existing main menu lets the player open the saved career through the existing load flow, without silently creating another one. Recovery performs a full document navigation to clear rejected in-memory persistence promises. No failed save is deleted, reset or overwritten by recovery UI. A retry wizard, cleanup transaction or background-job coordinator would broaden this task. Existing indefinite network stalls still have no arbitrary cancellation timeout; this surface stays visible during the operation.

## Verification

See [VERIFICATION.json](VERIFICATION.json), [canonical-proof.json](canonical-proof.json), [source-proof.json](source-proof.json), [browser-flow.json](browser-flow.json) and [browser-layouts.json](browser-layouts.json) for exact receipts. Full disposable saves, captured snapshot responses and raw logs remain local under the ignored `verification/` directory.

- Targeted unit/domain regression: **59 passed**, sequentially: render/task boundary, hidden-tab behavior, new career, preseason, preseason integration, save migration, save repository and existing progression presentation.
- Canonical browser proof: the preserved production build on port 3018 supplies the before result. The after result uses the same setup, save UUID, clock and 42 recorded real snapshot responses, then compares the complete persisted save. **Byte-identical**, SHA-256 `cbaae75e3584b9f0322894ba0d1abe315ceb41604dfd6f0425da80e651f33126` before and after.
- **Four final browser tests passed** in 3.2 minutes. Cases cover a six-step New Game with **Alingsås HK**, immediate acknowledgement in the click task, repeated activation, selected identity, initialization wait, **zero blank frames across 37 sampled loading frames**, existing destination, one save/one navigation, manual save and refresh. Disposable-context fault injection covers creation storage failure and provider initialization persistence failure, focused recovery, hidden raw diagnostics, returning to the menu and reopening the **same saved ID** without another career. A separate **IFK Tumba HK** flow uses live API snapshots, normal clock/IDs and no overrides, then saves and refreshes identically.
- Widths: 1366, 1440, 1920 and 2560; reduced motion is emulated and its computed animation is checked. Actual rendered screenshots are retained in [screenshots/](screenshots/).
- The full 2374-case game suite was not rerun for this isolated UI change (the preceding checkpoint passed it; that run took approximately 41 minutes). Relevant career/save/UI regression is run here. No engine, HBL, Allsvenskan or rotation benchmark cohorts were run.

Game typecheck and the final isolated production build both passed. Build ID: `-RNSpJe4apx4OLEONUxcE`. Nine screenshots include initialization at every requested width, reduced motion, both failures and both successful career landings. Visual inspection covered the loading surface, ultrawide layout, provider failure and both club landings. Text contrast ratios are 12.91:1 (body), 9.72:1 (supporting), 9.90:1 (accent) and 4.85:1 (button).

Two harness issues were corrected during verification: an unscoped alert locator also matched Next's route announcer, and the default 30-second provider-failure test deadline was shorter than real snapshot initialization. Neither required a production timeout. Final checks use one browser worker and all four tests pass.

For reproducing the canonical browser proof, first capture the preserved port 3018 build with `HM_LOADING_BASELINE=1` and `HM_QA_URL=http://127.0.0.1:3018`, running `npx.cmd playwright test e2e/career-loading-screen.spec.ts --workers=1 --reporter=line` from `apps/game`. Clear `HM_LOADING_BASELINE`, set `HM_QA_URL=http://127.0.0.1:3019` and run the same command. The baseline switch writes only disposable test-context snapshots/saves under the ignored evidence directory. The separate `normal live New Game` case needs no baseline artifacts or overrides.

Local implementation commit: **`1a2fc9f275b728c24497d33c2eababb896f5cf75`**, `Show branded career initialization with safe failure recovery`. The following local closeout commit contains this report, verification receipts and screenshots; use `git log -2 --oneline` for both commit IDs. Nothing was pushed.

## Preservation and scope

The 65 recorded user/presentation/reference files retain their hashes. The user's modified Match QA page, QA harness and season audit, plus `.claude/`, `.tmp-final-benchmark.ts` and `docs/audit/`, are preserved. Match Center, V2 engine, intelligence, fatigue, keeper/foul/7m/tactical and empirical runtime are unchanged. New career/save modules and the complete provider creation routine are source-identical to the starting checkpoint. Schema remains **8** with no migration or new stored UI field. Previous isolated build IDs are retained.

Motion worktree remains at `197d2a80ecea3b70efdcf8ef347cfc68e0e86b2b` on `motion-lab`, with only its existing untracked `.claude/`. Both stashes remain `ddba79055949b76898b12fc1b947e8f8645589cb` and `b068a9586209b9405b8d5f0dc6fae6384dd09001`. No resets, restores, stash changes, pushes or unrelated cleanup were performed.

Final Git status retains only the starting unrelated state:

```text
 M apps/game/app/match-qa/page.tsx
 M apps/game/lib/matchQa/qaHarness.ts
 M apps/game/scripts/season-audit.ts
?? .claude/
?? apps/game/.tmp-final-benchmark.ts
?? docs/audit/
```

## Run and human QA

Production output: `apps/game/.next-game-loading-screen-v1`. From the repository root in PowerShell:

```powershell
Set-Location C:\Users\helgi\Documents\STARKVIS-HELA\handball-manager\apps\game
$env:HM_NEXT_DIST_DIR = '.next-game-loading-screen-v1'
npm.cmd run start -- --hostname 127.0.0.1 --port 3019
```

Open **http://127.0.0.1:3019**. Start a normal New Game, finish setup and press **STARTA KARRIÄR**. Check that the HM surface and selected club appear immediately, activity/text explain the wait, there is no blank cream/white screen, and manager home opens automatically. Save and refresh normally. No DevTools, imported save or special QA data is needed.

Exact report path: `C:\Users\helgi\Documents\STARKVIS-HELA\handball-manager\docs\career-loading-screen-v1\REPORT.md`.

**NOTHING WAS PUSHED.**
