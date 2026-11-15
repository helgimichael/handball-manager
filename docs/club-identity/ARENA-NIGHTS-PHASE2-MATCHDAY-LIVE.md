# Arena Nights Phase 2 — Matchday and Live Match (Phase B)

**Status: PASS** for the matchday ritual, the court line-up, the live environment, the final whistle and report navigation. **PARTIAL** against the full MDY-02 "Floodlight Sequence": walk-out, timeout huddle and half-time layouts are not rebuilt.

| | |
|---|---|
| Commits | `474f28f`, plus `be68ca0` (own side in archived replays) |
| Implemented | MDY-01 (C) three-step ritual, MDY-01e (A) court line-up with readiness rings, MDY-02j (A) final-whistle card |
| Partial (deferred with reason) | MDY-02 (C), MDY-02a (A), ANL-01 (C) |
| Engine | No match engine, simulation, tactical calculation, rating or result code changed. All changes are presentation, navigation and one wrong prop (see the fix below). |

## B1–B3 Matchday preview (`/career/match-preview`)

**Ritual header.** Three numbered steps link to the three sections:

1. Före avkast
2. Laget
3. Motståndaren

Each step's state is coloured: blocking, to-do or done.

**Step 1 · Före avkast.** An attention checklist from `lib/matchday/preMatch.ts`, blocking items first:

- line-up errors;
- squad blockers and warnings;
- open decisions;
- players with lower readiness;
- missing captain or 7 m taker;
- unavailable players.

Every actionable item links to the screen where it is handled.

**Kick-off.** The existing hero, with its unchanged "STARTA MATCH →" / "SNABBRESULTAT" buttons and start logic, follows the checklist.

**Step 2 · Laget.**

- The starting seven on a **handball half-court**: 6 m line, dashed 9 m line, goal.
- Players sit in their positions: wings in the corners, backs and centre back beyond 9 m, the pivot just outside 6 m, the goalkeeper in goal.
- Each player has a readiness ring and K / 7m badges.
- The bench is grouped by position (goalkeepers, wings, backs, centre backs, pivots) with readiness bars.
- Unavailable players are listed with their status.
- Names link to the player dossier.

**Step 3 · Motståndaren.** Earlier meetings from stored results (each linking to its report), the existing match context and the opponent scouting panel.

The existing **MatchdayStage** above the steps keeps the arena, stakes, table, form and media context.

## B4–B6 Live match

**Dedicated environment on the live route.** The shell marks itself `data-route="live-match"`:

- the rail steps back to icons;
- the floor becomes a floodlight gradient in club neon;
- the hub header dims;
- the sticky score/clock bar takes the club neon.

The Week Spine is hidden, and Continue is locked ("Match pågår").

**Atmosphere, kept restrained:**

- the score figure re-mounts on every change and plays a 0.5 s pop;
- half-time and timeout scores turn amber, the full-time score gold;
- the LIVE pill pulses.

All three effects are switched off under `prefers-reduced-motion`.

**Progression.** Every existing control and stop condition is unchanged: Spela/Pausa, speed, next key event, key events, play to the end, second half, timeout resume, substitutions and instructions.

## B7 Post-match

**Final-whistle card** (MDY-02j):

- the verdict for the manager's own side;
- both crests and the final score;
- the match profiles (best rating, top scorer);
- the next step.

On the live page it points to the existing "Slutför match och öppna rapport". On an already saved replay it says the result is saved.

**Bug found and fixed by the e2e run (`be68ca0`).**

- **What was wrong:** archived replays defaulted to `team = 'HOME'`. For away matches the card said "Förlust" after a win (IFK Tumba won 35–24 away), and the replay's "own team" views showed the wrong side.
- **Fix:** `ArchiveReplay` now passes the manager's real side from the career.
- **Guard:** the journey asserts that the card's verdict matches the front page's verdict.

## B8 Match report and history

- **Editorial head:** competition, round, date and venue as a kicker; a headline generated from the result (e.g. "Varberg körde över IFK Tumba, 32–26"); the best-rated player.
- **Navigation:** links to the previous and next own match, each with its score.
- **Tidigare möten:** earlier meetings from stored results (current season, archive summaries, past seasons).
- **Unchanged:** all match ids and archives, and the existing report content (aftermath, press, statistics, timeline).

## Completion pass — score bug and event emphasis (MDY-02a)

**Score bug, always visible.** The sticky live bar (`.mc-workspace-nav`) now carries, next to the score and clock:

- a half indicator: "1:a halvlek", "2:a halvlek", "Halvtid", "Slut";
- players-on-court pips per team (6, 7 with an empty net, 5 during a suspension) from `model.manpower`;
- timeout pips per team for the current half from `model.timeouts`.

Each pip group has a spoken label ("IFK Tumba: 6 utespelare på plan", "V.Irsta: 0 timeout kvar"). Pips are omitted for archives, where the model has no manpower or timeouts, and after full time. Nothing is computed beyond what the live model already exposes.

**Event emphasis.** The latest-event callout re-mounts per event so its short entrance replays. Timeout and period events get their own tone (info blue, gold); commentary rows carry a thin tone edge (goal in club neon, suspension red, timeout blue, period gold, save green). Only events that exist in the session are shown; no event or statistic is invented. Entrance animation is off under `prefers-reduced-motion`.

**Fixed during the native V2 run:** the final-whistle keeper card ("Målvakt · räddningsprocent") showed "0 mål"; it now shows saves/shots and the save percentage.

## Native V2 match on the existing QA career (Phase E)

Played by hand on the existing tester career "Arena Testare" (IFK Tumba, dev origin). The career was not reset or overwritten. Source: `phase2-screenshots/native-v2-match-evidence.json`.

| | |
|---|---|
| Fixture | Svenska Cupen, 2026-08-26, IFK Tumba – VästeråsIrsta HF (home) |
| Engine | native V2 `2.9.1-court-rotation.1`, behaviour revision `career-seven-v-six-v1` |
| Line-up | valid starting seven (7/7); "STARTA MATCH →" enabled only then |
| Pause / resume | paused at 0:57, clock held, resumed |
| Tactical control | aggression Balanserad → Hög (archived `TACTICS_CHANGED`; final tactics aggression HIGH) |
| Timeout | manager timeout at 1:26 (state TIMEOUT, our timeout pip 1 → 0); opponent timeout at 20:29 |
| Half-time | 14–7; "Halvtid", 6 v 5 pips with a suspension carried over; "Starta andra halvlek" reset timeouts to 1/1 |
| Substitution | ~44:00, Albin Brauer (43 % energy) → Joakim Lindahl, via "Genomför byte" |
| Result | **IFK Tumba 31–19 V.Irsta**; "Slutsignal · Seger"; top rated David Blazevic (10 goals, 7.3) |
| Report | "IFK Tumba körde över V.Irsta, 31–19", linked to the previous report (2026-08-20, V.Irsta 29–26) |
| Archive | 2 archives in the store; the new one holds 2 period starts/ends, 1 tactics change, 3 team timeouts, 14 substitutions, 7 suspensions |
| Save / load | "Sparat"; full reloads of both reports and the schedule show 29–26 and 31–19 "Vinst" unchanged |
| Return | report "Fortsätt →" lands on the front page |

## Live-match evidence

A native V2 match was played through the new experience by the journey e2e. No result was mocked. Source: `phase2-screenshots/live-match-evidence.json`.

| | |
|---|---|
| Career | New IFK Tumba career, start at the first competitive match, re-entered from the title screen |
| Starting state | "Tors 20 aug 2026", matchday stage "Varberg – IFK Tumba" (Svenska Cupen) |
| Progression | Line-up from the assistant proposal → preview → "STARTA MATCH →" → live route (`data-route=live-match`, Spine hidden, Continue disabled) → "Spela" → "Spela till slut" (both halves played by the engine) |
| Final result | **Varberg 32–26 IFK Tumba**, final-whistle card "Slutsignal · Förlust" |
| Match report | `/career/match-report/2026-cup-R32-16-l1`, headline "Varberg körde över IFK Tumba, 32–26" |
| Save/load integrity | The report reloaded with an identical headline; the front page then led with "Varberg 32–26 IFK Tumba" (`data-kind=RESULT`) |
| Page errors | none |

An earlier attempt of the same journey on a different career seed also played a full match: "V.Irsta 24–35 IFK Tumba". That run exposed the archive side bug.

## Screenshots

`phase2-screenshots/`:

- `05-matchday-preview-desktop.png`
- `06-live-match-desktop.png`
- `07-final-whistle-desktop.png`
- `08-match-report-desktop.png`
- `09-report-phone.png`
- `11-preview-phone.png`, `12-live-phone.png`, `13-report-phone.png` (phone match)

## Tests

`lib/matchday/preMatch.test.ts`: **3 / 3 pass**.

1. Attention order and links.
2. Court line-up from a real plan, bench grouped, nothing invented without a plan.
3. Head-to-head and report navigation use stored results only.

The journey e2e covers the rest: score-bug assertions (half, 4 pip groups), pause holds the clock, and a second full native V2 match played at 375 px with the score bar kept in view while scrolling. See the E2E report.

Fixed in the completion pass: reduced-motion transitions were `0.01ms` instead of `0s`; the score bar was not sticky below 900 px; the final-whistle keeper card.

## Remaining

| Recommendation | What is missing |
|---|---|
| MDY-02 | Separate walk-out and half-time layouts (the live environment, score bug, event emphasis and final whistle are built) |
| MDY-02b–i | Their earlier layouts are kept |
| Key moments | Team timeouts are archived and shown live, but are not listed among key moments (existing importance filter) |
| ANL-01 | Momentum hero chart, turning points with court snapshots, workload box |
