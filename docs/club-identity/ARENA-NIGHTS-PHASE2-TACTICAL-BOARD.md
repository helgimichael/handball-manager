# Arena Nights Phase 2 — Tactical Board (Phase C, completed)

**Status: COMPLETE.** All ten tactics-board recommendations (TRN-02, TRN-02a–i) are implemented. The seven that Phase 2 left open (TRN-02a, d, e, f, g, h, i) were finished in the completion pass; none is a theme-only change.

- The court stays the visual centre: guard bar above it, overlay control and legend beside it, bench strip under it, pairing court in the Byten & Diff mode.
- Every write still goes through the existing match-plan operations; the helpers in `lib/matchPlan/tacticsBoard.ts` only describe or diff plans and stored results.
- No match engine, rating, development or competition code changed.

| | |
|---|---|
| Commits | `b09b6db` (TRN-02, 02b, 02c) · `4355fcf` (TRN-02a, 02d, 02e, 02f, 02g, 02h, 02i) |
| Screenshot | `phase2-screenshots/04-tactics-defence-desktop.png`, `09-tactics-phone.png` |

## Completion pass — the seven open recommendations

| ID | Recommendation | What was built | Evidence |
|---|---|---|---|
| TRN-02a | Inline warning + auto-fix preview | Guard bar listing every blocking issue. "Assistentens förslag" / "Åtgärda – visa förslag" now previews the proposal as a per-position diff (from → to, squad in/out) **before** saving. "Tillämpa förslaget" or "Avbryt"; after applying, "Ångra" restores the previous plan. | `diffLineups` unit test; `e2e/matchPrep.ts` uses preview → apply → "Startsju 7/7" |
| TRN-02d | Pairing lines on court | Byten & Diff draws each attack/defence substitution pair as a line on a court, with six defence-zone markers and "n par (riktmärke 3)". Tap an attacker, then a bench player, to pair; tap a defence label to unpair. Uses the existing `activeSubstitutionPairs` / `assignExchangeOnCourt`. | Browser check (add/remove pair) |
| TRN-02e | Segmented control + legend | "Taktikvisning" is a `radiogroup` (arrow keys) with a legend quoting the exact chip thresholds the court uses (energy < 75 %, rating 7.5 / 6.5, natural/secondary/off role). | Legend test reads the page source; journey switches to "Lämplighet" and checks "Naturlig roll" |
| TRN-02f | Choices with trade-off lines | Every coaching choice shows a live trade-off sentence paraphrasing what the native V2 engine does with it. Rotation quotes the engine's energy thresholds (50 / 62 / 72 %) and notes it only applies with assistant substitutions. | Test checks every option has a line and the thresholds match `coaching.ts`; journey checks lines are non-empty |
| TRN-02g | Ordered takers with stats | 7 m takers as an ordered list: rank, this season's 7 m goals/attempts from stored `SEVEN_M` events, ↑ ↓ ✕. Add a taker from candidates sorted by attempts. | Unit test (stats only from this season's stored events; reorder is a pure swap) |
| TRN-02h | Single roles editor | "Ledarskap & roller": captain, vice-captain and first-choice 7 m taker in one editor, each with what the role does. | Browser check |
| TRN-02i | Bench strip + counter | 16 match-squad places (court · bench · empty) with an n/16 counter under the court. Tap a bench chip to place it at the active position, ✕ to remove, drag supported. "Ej uttagna" drawer sorted available-first then by readiness, with "Ta ut". | Unit test (16 slots, ordering, purity); journey asserts 16 slots |

Trade-off sentences were deliberately kept to what the engine states (for example, the 6:0 / 5:1 lines describe the shape, not claimed effects).

## What changed

### Readiness header

`lib/matchPlan/boardReadiness.ts` reads the saved plan. It is read-only and changes no plan semantics or tactical calculation. The header shows nine chips:

| Chip | Done when |
|---|---|
| Trupp n/16 | The match squad is selected |
| MV | A goalkeeper is in the squad |
| Startsju | All seven attack slots are filled with available players |
| Försvar | Six defence slots and a goalkeeper |
| 7 m | Takers are chosen |
| Kapten | A captain is chosen |
| 6v5 | A saved lineup exists (otherwise "standard") |
| 5v6 | A saved lineup exists (otherwise "standard") |
| 7v6 | A seventh court player is chosen (otherwise "standard") |

Each chip either switches to its existing court mode or jumps to its existing section (set pieces, match squad).

### Phase × manpower switcher

The 2×4 grid (Anfall/Försvar × 6v6, 6v5, 5v6, 7v6) replaces the separate dual tabs and the special-situation row.

- **Interactive cells:** only the five court modes the tactical domain supports — Anfall 6v6, 6v5, 7v6 and Försvar 6v6, 5v6. They drive the existing `setCourtMode`.
- **Static cells:** the three manpower states with no lineup in the match plan (attack 5v6, defence 6v5, defence against 7v6) are dashed, plain text that says "följer 6 mot 6". There are no inert buttons.
- **Kept information:** the badges from the old dual tabs ("6 båda vägar", "n vilar i försvar", defence system and specialists) appear in their cells.
- **Completion dots:** green for done, red for incomplete, grey for standard.
- **Group label:** the grid is labelled "Specialsituationer", so scouting's existing advice ("Matchplan → Specialsituationer") still points to the right place.

### Visual distinction between phases

- **Attack:** club neon on the bar, the active cell and the court outline.
- **Defence:** info blue.
- **Exchanges:** keep their existing banner.

### Responsive behaviour

On a phone the grid becomes two columns per phase with the phase name as a heading. The earlier fix to the clipped phase tabs is superseded, because those tabs are now the grid. The journey checks `/career/tactics` at 375 px for horizontal overflow.

## Preserved

All existing interactions are unchanged:

- drag and swap;
- overlay modes (Energi, Lämplighet, Senaste match, Form);
- the defence system buttons (6–0 / 5–1);
- the "Så spelar vi" rail;
- exchanges and diff;
- set pieces and leadership;
- the match squad;
- the assistant proposal ("Assistentens förslag").

No match engine, tactical calculation or saved-plan format was touched.

## Stabilization — save reliability (P0)

**Root cause.** Board edits were never only React state: every edit goes through `updateMatchPlan` / `updateCareer`, which apply it to the latest committed career and queue a write. The queue is serialized and latest-wins, so an older edit cannot overwrite a newer one. The loss came from the write itself:

- Each write first re-read the whole save (tens of MB) and then put it.
- An edit made while a write was running only waited in the queue.
- A reload or closed tab in that window dropped the waiting edit; an in-flight write survived.
- Nothing showed that a write was pending, nothing guarded the reload, and a failed write left a banner with no retry.

Reproduced in the browser: V6 change and tempo change, then an immediate reload. V6 (in flight) survived; the tempo (queued) was lost.

**Fix (same save system, no second store):**

- `saveRepository.ts`
  - The queue publishes a write status (`SAVING` / `SAVED` / `FAILED`).
  - It caches the record it last wrote, so later writes put at once (every other write path invalidates the cache).
  - A sequence check means an older snapshot never puts after a newer one.
  - `flushCareerWritesOnExit()` writes a still-queued snapshot immediately.
  - `flushCareerSave` no longer re-throws an old failure into every later read.
- `CareerContext.tsx`
  - Calls the exit flush on `pagehide`, hidden `visibilitychange` and `beforeunload`.
  - Arms the browser's leave-page guard while a write is pending or failed.
  - Exposes `saveStatus` and `retrySave`.
  - The failure banner now says the changes are kept and offers "Försök igen"; it clears once a save commits.
- `BoardTools.tsx`: a save-state line on the board ("Sparar ändringarna…" / "Alla ändringar sparade" / "Ändringarna är inte sparade" + "Försök igen").
- `saveStorage.ts`: a database that exists without its stores is upgraded one version so the stores are created (found during QA; existing data is never touched).

**Evidence.**

- After the fix, three edits made about 60 ms before a reload were all restored.
- `e2e/tactics-persistence.spec.ts` covers the 13 steps:
  - starting seven, then an immediate reload;
  - formation, then reload;
  - instructions, then reload;
  - match preview shows the same seven, and back;
  - rapid edits (the last wins);
  - injected IndexedDB failure: edit kept, alert shown, retry commits it, reload confirms.
- `lib/save/careerWriteStatus.test.ts`: status transitions, latest-wins, fail then retry, and the exit flush with the newest snapshot stored.

## Tests

- **Unit:** `lib/matchPlan/tacticsBoard.test.ts` — 5 tests (trade-offs cover every option and match the engine thresholds; legend matches the page; lineup diff; 7 m stats and reorder; bench strip and drawer). All pass.
- **E2E journey (step 8):** chooses a valid starting seven through the guard preview, switches the overlay and checks the legend, checks the trade-off lines and the 16-place strip; the phase grid and "Försvar 6 mot 6" switch as before.
- **Shared e2e step:** `e2e/matchPrep.ts` (`chooseStartingSeven`, `readyStartMatch`) is now used by every match spec, so none bypasses the starting-seven requirement.
- **TypeScript:** clean. **ESLint on the tactics page:** 6 warnings, all pre-existing (down from 10).

## Remaining (traceability)

None on the tactics board. Every TRN-02 recommendation is marked Implemented in the traceability table with its evidence.
