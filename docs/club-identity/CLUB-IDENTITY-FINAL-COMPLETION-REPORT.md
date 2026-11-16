# Club Identity — Final Completion Report (C4 + C5 + C6)

**Worktree:** `C:\DEV\WORKTREES\handball-manager\club-identity-final` · **Branch:** `feat/club-identity-final`, created from `feat/club-identity-implementation` @ `216b24d` (the complete C0–C6 implementation). Local commits only: nothing pushed, merged or deployed. No Alpha/production data, live save or tester career touched; no other worktree changed.

## Final assessment

| Phase | Verdict | One line |
|---|---|---|
| **C4** Competition engine — A-team priority | **PASS** | B-teams can never end a transition in the same tier as, or above, their A-team. Deterministic cascading allocation inside the atomic transition; 11 Division 2 agreements now active; all focused and full regressions green against the baseline |
| **C5** Arena Nights production integration | **PARTIAL** | Arena Nights is the production theme for the whole app and follows Dynamic Club Identity everywhere; all 231 surfaces audited. Only 5 of the 214 non-internal surfaces' recommended *structures* are built — the remaining 209 layout redesigns (51 of them P0) are not |
| **C6** Final cross-system validation | **PASS** | Five-season new + legacy careers with A-team priority active, save/load each rollover, club change/resignation/new appointment, identity transitions; full regression, build, worker packaging + dry run, design-lab verifiers |

**The project is not complete**: C5 remains PARTIAL (see §C5.4).

---

## C4 — A-team priority ("the A-team always has priority, the B-team must adapt")

### Rule as implemented
For the coming season, a club bound to a parent by a **restricting** relationship must play at least one tier below that parent. A restricting relationship is an `AFFILIATED_B_TEAM` agreement, or any agreement with `competitionRestriction.applyParentDivisionRule`, that is `ACTIVE` and in force at the next season start (`restrictingParents`). Terminated, expired, historical, youth-link and plain development partnerships impose nothing. The existing farm-club cap ("not above Division 1", `cooperationEligibility.ts`, byte-identical) is unchanged and still applied.

### Why the first C4 attempt failed, and the architectural fix
The previous attempt changed the planner's *inputs* (eligibility / ranking evidence) using projected parent placements. Division 1 qualification series are scheduled mid-season from the planner's entrants and must not change afterwards. A projection that depends on the parent's final placement changed those entrants, so `gameContinuity.seasons.test.ts` failed with `QUALIFICATION_TIE_CONFLICT`.

The fix keeps the planner, its current-tier eligibility and the qualification series untouched. A new deterministic step, `competition/transition/parentPriority.ts`, runs on the planner's sporting outcome **inside** `attemptSeasonTransition`, before membership is committed:

1. Find every B-team whose final tier is not below its A-team's final tier.
2. Resolve the top tier first, the worst-ranked first (sporting order, never id order).
3. The B-team moves **one tier down**:
   - back to the league it came from (a refused promotion);
   - else its geographic league (Division 1 group by hard north/south anchor and band; Division 2 by district);
   - below Division 2, to the new non-simulated **Division 3** (`se_division3`, `outsideCareerWorld`, hidden in New Game).
4. The place it leaves in a fixed-size league goes to the **next eligible club of the destination league's own sporting order**: planner ranking, or the Division 2 pool order. The candidate must:
   - be upper half, as in the existing UPPER_HALF replacement rule;
   - not be in a tied rank;
   - not be already moving;
   - not be INELIGIBLE by evidence;
   - pass the unchanged cooperation rule and the A-team rule itself;
   - have a squad;
   - satisfy the regional anchor.

   If that candidate is ineligible, the order continues.
5. Repeat until no conflict remains. A moved B-team only ever goes down, tiers are bounded and there is a safety bound. If no valid allocation exists, the whole rollover is **BLOCKED atomically** with the exact conflict (`PARENT_PRIORITY_NO_ELIGIBLE_REPLACEMENT`, `…_UNRESOLVED_RANK`, `…_NO_DESTINATION`, or `MANAGER_DESTINATION_MISSING`), and the original state is returned unchanged.

The transition's cooperation guard, the size checks, the calendar validation and `outcome.nextMembership` / `promoted` / `relegated` now read the final allocation. Every move is recorded in `outcome.parentPriority` (B-team, parents, from, to, replacement and rank). Historical tables, results and fixtures are archived exactly as played.

The 11 Division 2 agreements (D9) are **activated** (`DIVISION2_RELATION_AGREEMENTS_ENABLED = true`): new careers have them from career start; loaded v8 careers from their next season start.

### Files changed (C4)
`apps/game/lib/competition/transition/parentPriority.ts` (new), `parentPriority.test.ts` (new), `apps/game/lib/career/parentPrioritySeason.test.ts` (new), `apps/game/lib/career/seasonTransition.ts`, `apps/game/lib/competition/transition/gameContinuity.ts` (regional helpers only), `apps/game/lib/competition/types.ts` (`SeasonOutcome.parentPriority`), `apps/game/lib/game-data/competitions.ts` + `types.ts` (Division 3), `apps/game/app/new-game/page.tsx` (hide Division 3), `apps/game/lib/career/staticRelationPartnerships.ts` (gate opened) + `.test.ts`, `apps/game/lib/career/clubPartnerships.test.ts` (C4 expectations: five canonical rows unchanged + 11 agreements), `apps/game/lib/career/clubIdentitySoak.test.ts` (A-team invariant + league sizes after every rollover), `apps/game/scripts/game-test-files.json`.

### C4 tests
| Required scenario | Test | Result |
|---|---|---|
| B-team winning promotion | `parentPriority.test.ts` + real transition (`parentPrioritySeason.test.ts`: Lunds HS Lejon refused promotion into H43 Lund's Division 1 Södra, LUGI HF U takes the place) | PASS |
| A-team relegation into B-team division | `parentPriority.test.ts` (Division 2 → Division 3; Division 1 group → district with replacement) | PASS |
| Multiple B-teams in one division | `parentPriority.test.ts` (HK S-hof + IF Kristianstad together) | PASS |
| Two parent clubs in the same division | same test (IK Sävehof + IFK Kristianstad) | PASS |
| Cascading displacement through three divisions | `parentPriority.test.ts` (Division 1 → Division 2 → Division 3) | PASS |
| Next eligible team receives promotion | `parentPriority.test.ts`, real transition | PASS |
| Next eligible team also ineligible | `parentPriority.test.ts` (evidence + cooperation + A-team rule skipped) | PASS |
| Existing active cooperation restrictions | candidate filter; transition guard; `cooperationEligibility.test.ts` unchanged; L9 sha guard | PASS |
| Terminated cooperation | `parentPriority.test.ts`, `staticRelationPartnerships.test.ts` (SHF 9:5-7) | PASS |
| Historical partnership without restriction | `parentPriority.test.ts` (expired / development / informal) | PASS |
| League sizes after allocation | allocation tests + soak (every rollover) | PASS |
| Save/load after rollover; retry | `parentPrioritySeason.test.ts`, soak | PASS (`ALREADY_APPLIED`, no double apply) |
| Atomic rollback after conflict | `parentPrioritySeason.test.ts` (BLOCKED, original state returned, nothing written) | PASS |
| Existing competition regression suites, unchanged | 119 focused tests incl. three-season continuity | PASS |

Deterministic seeds with real conflicts (fast-match pipeline, 5 rollovers each): `club-identity-soak-new` resolves 4 moves (incl. Lejon refused promotion; HK Lif Blå and HK Önnerediterna to Division 3) — its 5th rollover stops on the **pre-existing** `DIVISION2_POOL_INSUFFICIENT` (reproduced on the untouched baseline earlier); `club-identity-soak-new-b`, `cid-c4-x1`, `cid-c4-x2` complete all five with 1–2 moves each.

### Remaining C4 edge cases
1. **Division 3 is not simulated.** A B-team displaced there leaves the simulated pyramid and does not return automatically when its A-team moves up.
2. **A manager leading a B-team that must leave Division 2** blocks the rollover atomically (`MANAGER_DESTINATION_MISSING`) — by design no invalid structure is created, but the player has no in-game resolution.
3. **Replacement from the destination league's order**: when a refused promotion came through qualification (kval), the place goes to the next eligible club of the B-team's own league, not to the kval opponent — per the owner rule's "official promotion order".
4. Division 2 pools can shrink when B-teams leave for Division 3, making the pre-existing `DIVISION2_POOL_INSUFFICIENT` blocker somewhat more likely in small districts.

---

## C5 — Arena Nights in the production application

### What is implemented
- **Global Arena Nights theme** (`app/arena.css`, `<html data-theme="arena">`). Every production token is mapped to the Arena contract from `proto/themes.css` [B]: night foundation, solid dark surfaces for dense tables (no blur, per the amendment), Arena ink and status colours, condensed italic uppercase display type with tracked kickers, radii and depth. Fonts are local stacks (Barlow if installed, otherwise Bahnschrift); no web-font download, for speed.
- **Generated Arena mapping of hard-coded colours** (`app/arena-overrides.css`, 425+ rules from every production stylesheet, `scripts/generate-arena-overrides.mjs`, staleness-tested):
  - paper surfaces and gradients → Arena solids;
  - ink → Arena ink;
  - status hues → Arena status colours;
  - ink blocks → raised;
  - text on the accent → neon ink;
  - `!important` preserved.
- **Dynamic Club Identity** drives the accent. The accent tokens re-resolve wherever `data-club-identity` is set:
  - The career shell follows the club the manager actually leads. It updates on appointment, resignation (orange "Utan klubb"), new appointment, promotion/relegation (no colour change, the club is the same) and save/load (derived live, nothing stored).
  - The New Game wizard follows the chosen club (ENT-03).
  - Ice Silver and the marked orange fallback come from the registry.
  - Crests keep their own colours.
  - Affiliates never inherit their parent's colours.
  - Glow appears only on the primary action and Continue.
- **MDY-01 intensity escalation:** calm preparation → the club neon floods the header on matchday → a glowing live state.
- **Fixed:** the pre-existing sideways scroll of the whole shell at ~1024 px (save controls + Continue were wider than the header).

### Verification (browser, local QA career "QA Arena", IFK Tumba)
- **Desktop:** a computed-style sweep (no light paper surfaces, no text below 3:1, no horizontal overflow) was clean on 30 routes. These included the first screen, all New Game steps, dashboard, clubhouse, squad, tactics, training, calendar, schedule, analysis, players, scouting, transfers, finance, staff, media, inbox, manager, history, club, other-club (HK Cliff), season, competition, board, match preview, live match and match report (a full match was played through the UI).
- **Mobile (375 px):** 14 routes, no overflow.
- **Console:** no console errors.
- **Known minor issue not fixed:** a rating chip with white text on amber (a pre-existing inline style, about 2:1).

### All 19 named surfaces
| Surface (assignment) | Lab ids | Arena language | Club identity | Recommended structure |
|---|---|---|---|---|
| First game screen | ENT-02 | yes | orange default | not built (Season Cover adaptation) |
| Career creation | ENT-03, ENT-03a–f | yes | **follows chosen club** | ENT-03/03d identity elements built; step layouts not built |
| Dashboard | DSH-01* | yes | yes | not built (Matchweek Front Page) |
| Clubhouse | CLB-01 | yes | yes | not built |
| Navigation | ENT-07, 07a, 08, 08a–b, 09, 10 | yes | **yes (badge, active item, header)** | hub rail + Week Spine + Peek + ⌘K not built |
| Squad | SQD-01* | yes | yes | Squad Matrix not built |
| Player profiles | SQD-02 | yes | player's club | Athlete Feature not built |
| Scouting | REC-* | yes | yes | Scout Desk not built |
| Transfers | REC-* | yes | yes | not built |
| Training | TRN-* | yes | yes | not built |
| Matchday | MDY-* | yes | **intensity escalation built** | Matchday Sequence layout not built |
| Match report | ANL-01 | yes | yes | Match Feature not built |
| Analysis | ANL-* | yes | yes | not built |
| Inbox | WLD-01* | yes | yes | Message Desk / Thread Reader not built |
| Calendar | WLD-05/06 | yes | yes | Week Spine Calendar not built |
| Manager career | MGR-01* | yes | **clubless state built** | Career Chapters not built |
| Career history | MGR-02 | yes (season-correct names, C5 earlier) | yes | Season Shelf not built |
| Club selection | ENT-03d | yes | **built** | Club Wall by ambition not built |
| Promotion & relegation | MGR-03 / DSH-01c | yes | gold season state | Season Curtain not built |

Per-surface detail for all 231 recommendations: `CLUB-IDENTITY-ARENA-SURFACE-AUDIT.md`. Totals:
- 214 surfaces in Arena;
- 17 internal tools;
- 5 recommended structures implemented;
- 209 not, 51 of them P0.

The 231 recommendations and 551 alternatives are unchanged (`verify-amendment.cjs`: 0 issues).

### Motion and assets
Blender and Higgsfield were evaluated and deliberately **not** used. The Arena language is carried by native CSS (custom properties, `color-mix`, restrained gradients, one glow token), which adds no download weight. The existing environment photography (`components/clubhq/assets`) is kept. Reduced motion is respected.

### C5.4 Why PARTIAL, and what is missing
The Arena language and Dynamic Club Identity are integrated across the real application. The structural redesigns behind the recommendations were not built, and each is a substantial feature of its own:
- the hub-rail navigation with Week Spine, Peek and command palette;
- Matchweek Front Page;
- Squad Matrix;
- Scout Desk;
- Thread Reader;
- Career Chapters;
- the rest of the 209.

Building them faithfully, with real data binding and tests, is a multi-milestone programme. Shipping simplified substitutes would violate the instruction not to replace them with decorative or simplified versions. **Next step:** implement the 51 P0 structures milestone by milestone on top of this theme layer, starting with ENT-07/08 (navigation) and DSH-01 (dashboard).

---

## C6 — Final cross-system validation

| # | Scenario | Evidence | Result |
|---|---|---|---|
| 1 | New career | soak NEW; New Game in browser | PASS |
| 2 | Existing v8 career | soak LEGACY (marker removed, v8 partnership rows only, loaded through migration); D9 rows from 2027-07-01 | PASS |
| 3 | Five-season progression | soak: 2026/27 → 2031/32, 5 atomic rollovers per career, production competition engine, production fast-match pipeline | PASS |
| 4–5 | Promotion / relegation | 10–12 movements per rollover; league sizes asserted every rollover | PASS |
| 6–7 | B-team displacement / multiple B-teams, cascading | real moves in soak seeds; allocation tests | PASS |
| 8–9 | Active / terminated cooperation | transition guard, allocation and SHF tests | PASS |
| 10 | International club membership | soak: corrected foreign leagues from first rollover (legacy) / day one (new) | PASS |
| 11–13 | Club change, resignation, new appointment | soak (dismissal → clubless → offer accepted); browser resignation | PASS |
| 14 | Visual identity transition | soak asserts full identity of the new club; browser: Tumba blue → clubless orange | PASS |
| 15 | Save/load | JSON save + production migration after every rollover; marker never added or removed | PASS |
| 16 | Historical match integrity | archived results/fixtures hash-identical across later rollovers and loads | PASS |
| 17 | Player identity integrity | stored ids resolve; squads untouched by transitions (existing transition assertions) | PASS |
| 18 | League size integrity | all modeled leagues exact after every rollover | PASS |
| 19–20 | Desktop / mobile UI | §C5 verification | PASS (theme) |

**QA runner limitation (reported, not hidden).** The five-season soak plays every fixture through the production **fast-match** competition pipeline (`simulateMatch` + `applyKnockoutDecider`, the same pipeline the game uses for every non-manager match) and the production transition. The manager's own matches are not played through the V2 live match engine, because five V2 seasons are not feasible in a test run. One real V2 match was played end to end in the browser instead.

### Regression and quality

| Check | Result |
|---|---|
| Full bounded suite after C4 (`final2-c4-suite.log`) | 2985 tests · 2973 pass · 12 fail · 0 skipped · 0 timed out · 0 cancelled — failures **identical to the 76513bd baseline** |
| Full bounded suite, final state (`final3-suite.log`) | **2988 tests · 2976 pass · 12 fail · 0 skipped · 0 timed out · 0 cancelled** — failures **identical to the 76513bd baseline** (0 new, 0 fixed); 312 files, 1258 s |
| Excluded by design | `lib/career/cpuQualityUpgrade.test.ts` (pre-existing >90 min) |
| Focused C4/competition run | 119/119 pass |
| C5 tests (theme, identity, crests, court colours) | 16/16 pass |
| TypeScript | clean |
| Scoped ESLint (changed files) | clean |
| Production build | success, 58/58 pages |
| Worker packaging | success ("Worker saved"); three `Failed to copy` messages for native `sharp`/`@img` modules (Windows OpenNext copy; same as in the previous phase) |
| Worker dry run (`wrangler deploy --dry-run`) | success: 17,416.80 KiB / gzip 2,645.31 KiB; nothing deployed |
| Design-lab `verify-amendment.cjs` | 0 issues (231 / 551 intact) |
| Design-lab `verify-club-identity.cjs` | 0 issues (204/204 clubs) |

Baseline failures (unchanged, unrelated to this work) are listed in `CLUB-IDENTITY-COMPLETE-IMPLEMENTATION-REPORT.md` §5.

---

## Git

| Item | Value |
|---|---|
| Branch | `feat/club-identity-final` (worktree `club-identity-final`) |
| Based on | `feat/club-identity-implementation` @ `216b24d` (C0–C6, 10 commits) |
| Commits in this assignment | `f931f8d` C4 A-team priority · `4b07475` C5 Arena Nights production theme · final docs commit (this report, regenerated verifier reports) |
| Final HEAD | see the final docs commit (`git log -1`) |
| Tree | clean after the final commit |
| Pushed / merged / deployed | no / no / no |
| Other worktrees | untouched. `club-identity-implementation` and the read-only comparison worktree `club-identity-baseline` from the previous phase remain |
