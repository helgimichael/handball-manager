# Division 2 playable qualification: results

Date: 2026-11-12. Branch `hotfix/div2-playable-qualification` in worktree `C:/DEV/WORKTREES/handball-manager/div2-playable-qualification`, based on local main `17564f5` (deployed code `4f7e542` + release report).

- **Committed locally only. Not pushed, not deployed.** Alpha stays on Worker `74bc40ce-5c57-4fa1-b3b1-52881930cea5`.
- The deployed media and URL fixes are untouched; no regression was found in them.

## Verdict

**The blocker is fixed:**
- Vinslövs HK v Lödde Vikings HK now plays as a native V2 qualifier, live with a mid-match reload or as a quick result, and persists.
- A start that cannot happen now shows a clear Swedish message without crashing or changing the career.
- No regressions: the 12 known baseline failures are unchanged.
- One pre-existing QA-script problem was found (see limitations).

## 1. Root cause audit

| Area | Finding |
| --- | --- |
| Why pool participants are empty | Division 2 pool clubs are simulated in aggregate (`gameContinuity.simulatePool`, "no fabricated players"). `careerQualifications.ts:57` explicitly exempts pool clubs from the squad requirement under `GAME_CONTINUITY`, because AI qualifiers run on the calendar simulator, where a rosterless club is a neutral side (`calendar.simulateAiFixturesForDate`). The case of the **human manager's** club being drawn against one was never covered: `createProductionSession` needs six available outfield players and a goalkeeper for both sides |
| Existing M1.2 generation | `promotionSquads.generatePromotionSquads` already creates deterministic fictional 16-player squads (2 MV and all positions), with ids from `saveSeed`/club/season/index plus collision avoidance, `generatedOrigin` provenance, Division 1 fallback ratings, `generateInitialContract`, statuses, squad roles and club history. It runs **only at season rollover** for pool clubs awarded a Division 1 place, and skips any club that already has `hasCompetitionSquad` |
| Registration and lifecycle | `hasCompetitionSquad` = ≥ 7 players including an MV, each uniquely rostered with a valid own (or loan) contract. `careerWorldCatalogClubs` already brings *roster-backed* pool clubs into the world lifecycle: CPU recruitment and contracts (`cpuRecruiterClubIds`), development, retirement and finances. That is the documented path for relegated and promoted clubs |
| Qualification scheduling | `progressCareerQualifications` runs daily in every season phase (`season.ts` via `dailyTick.progressCompetitions`) and is idempotent |
| Lineup requirements | `resolveCareerLineup` per side; failure threw from inside the career-state updater, outside the preview's `try/catch`, so React showed "This page couldn't load" |
| Save migration | `migrateCareerState` runs on every load and import, so it is the natural place to repair saves already sitting on such a matchday |

## 2–3. Solution and generation policy

| Option | Assessment |
| --- | --- |
| A. Every eligible Division 2 club at initialization | Hundreds of clubs × 16 players in every save (thousands of fictional players), CPU lifecycle work every day for clubs that never play a match, **and a balance change**: AI-vs-AI qualifiers would stop being neutral for every pool club. Rejected |
| **B. Lazily, when needed (chosen, narrowest form)** | A pool club gets a squad **only when it is drawn against the manager's own club in an unplayed qualifier**: about one club per affected season, 16 players. AI qualifiers and every other pool club stay exactly as before (verified). The generated club then follows the existing roster-backed lifecycle, and if it is later promoted the M1.2 promotion generator sees a valid squad and adds nobody |

### Implementation

- **`lib/career/promotionSquads.ts`**
  - The per-club body of `generatePromotionSquads` was extracted into `addGeneratedSquad`. Promotion output is **byte-identical**: all existing `promotionSquads` and `promotionStockRollover` tests pass unchanged.
  - New `ensureQualificationOpponentSquads(state, date)`:
    - for each unplayed `QUALIFIER` dated on or after `date` that involves the manager's club, it finds the opponent;
    - if the opponent is a Division 2 pool club **without** a valid squad and **with** no conflicting registrations, it generates the 16-player squad (model `division2-qualification-v1`, provenance `DIVISION2_QUALIFICATION`, contracts valid from the first qualifier date);
    - it does nothing while the manager is unemployed (his old club's qualifier is simulated);
    - it never overwrites a conflicting registration;
    - it is idempotent, because `hasCompetitionSquad` makes any rerun a no-op.
- **`lib/game-data/types.ts`:** the `generatedOrigin.kind` union gains `"DIVISION2_QUALIFICATION"`.
- **`lib/career/dailyTick.ts`:** calls it right after `progressCompetitions`, so the squad exists the day the qualifier is on the calendar, before the matchday opens.
- **`lib/career/saveMigration.ts`:** calls it at the end of `migrateCareerState`, so a save already on such a matchday (the Alpha QA career) is repaired on load.

## 4. Match error handling

- **`lib/career/productionMatch.ts`**
  - New `tryStartProductionMatch(state, fixtureId, options)` returns `{ ok, state }` or `{ ok:false, error }`; it never throws.
  - When the **opponent** cannot field a team, the message now reads: *"{klubb} har ingen spelbar trupp just nu – det behövs sex tillgängliga utespelare och en målvakt. Matchen kan inte startas, och karriären har inte ändrats."* The old text told the manager to fix *his* squad in Taktik.
  - The manager's own-squad message is unchanged.
- **`app/career/match-preview/page.tsx`**
  - Start match and quick result first run `tryStartProductionMatch` on the current career. On failure, the Swedish message appears in the preview's alert, with no navigation and no state change.
  - On success, the career updater applies the same start, falling back to the unchanged career if the state moved in between, and then navigates.

## 5. Validation

### Preserved QA career

- **The live `save-f5f3e949-…` was not changed.** A reproducible copy was made with the deployed app's own "Exportera sparafil": `C:/DEV/QA/reports/handball-div2-playable-qualification/qa-release-m7d-vinslov-2027-04-03.json`, 31,702,878 B, sha256 `18d8ea68b16fe298…`.
- The copy matches the career: schema 8, Vinslövs HK, 2027-04-03, matchday `2026/27:transition:d1-s-final-9:g1` pending, Lödde with 0 players, 33 qualification fixtures, 1 archive.
- The browser left its unconfirmed download as a `.tmp` in Downloads; it was left alone.

**Node validation of the copy with the hotfix code** (`validate-qa-copy.mts`, real `importSaveFromJson` path): **PASS, 26/26 checks.**

| Check | Result |
| --- | --- |
| Unfixed save: start | Clear Swedish error; **no mutation, no partial session** |
| Import/load generates Lödde | 16 players, 2 MV, registered and playable, `DIVISION2_QUALIFICATION` provenance, contracts at Lödde |
| No duplicate players | 1,289 unique |
| Existing data | Every other club's players, all fixture ids, all results, the manager career and the historical archive `2026-cup-R32-15-l1` unchanged |
| Other pool clubs | The 6 other pool clubs in the draw stay rosterless |
| Retry idempotence | A second and third load add nobody |
| Native V2, live | Session created; reload mid-match at tick 2000 resumes; result **Lödde 18–28 Vinslöv (V2)**; identical to the uninterrupted match |
| Quick result | V2 (23–41 from the same starting point) |
| Persistence | Result and archive persist through save/load under the stored id; the historical archive is still unchanged |
| Rest of the series | Leg 2 natively, Vinslöv 38–28 Lödde (V2); Vinslöv wins the tie |
| Season end and rollover | Season complete on 2027-05-13. `attemptSeasonTransition` **APPLIED, no blockers**: the M1.2 planner, including its cooperation enforcement (`enforceCareerCooperationEligibility`), validated the movements. 2027/28: Vinslöv stays in Division 1 Södra; Lödde keeps its 16 qualification identities, with no regeneration and no duplicates; reload identical |

**Browser** (hotfix production build, `next start` on localhost:3741; the copy imported through "Importera sparafil"):
- The load path created and persisted Lödde's 16-player squad.
- The preview showed "KVAL · LÖDDE VIKINGS HK – VINSLÖV". "STARTA MATCH" opened the native match centre on the encoded route.
- Paused at 4:24 (2–1), page reload: HTTP 200, resumed at 4:24 (2–1). Played to the end: **18–28**, identical to the Node run (deterministic).
- Stored: V2 18–28, archived, no leftover session, matchday resolved, Lödde 16, 0 duplicate ids.
- Console: no errors.

**Error state in the browser** (a further local QA copy with Lödde reduced to 3 players whose contracts belong to another club, i.e. a conflicting registration that must not be overwritten):
- The load left it untouched (3 players).
- "STARTA MATCH" showed the alert *"Lödde Vikings HK har ingen spelbar trupp just nu – … Matchen kan inte startas, och karriären har inte ändrats."*
- No crash, no navigation; the stored career was unchanged (no session, same results and events).
- An earlier attempt with all 16 players marked injured did start the match. The opponent lineup builder does not filter injuries, which is pre-existing behaviour; it is noted under limitations.

### Fresh stock career

`lib/career/division2Qualification.test.ts` (new, 6 tests, all pass) on a stock career at IFK Tumba with rosterless pool clubs and a real pool entrant named by the game-continuity planner:

1. Without a squad: a clear Swedish error and an unchanged career (hash).
2. Generation: 16 players, 2 MV, all 7 positions, provenance, valid contracts, ratings, statuses, club history; no reused ids; other clubs, contracts, results and fixture ids unchanged; idempotent; reload keeps the same squad; loading the rosterless save produces the identical squad (deterministic).
3. Scope: a pool club in an AI qualifier stays rosterless, **the AI qualifier result is byte-identical** with or without the fix, and nothing is generated while unemployed.
4. The daily tick on the qualifier date creates the squad once; a repeated tick adds nobody.
5. Promotion after the qualifier: `generatePromotionSquads` keeps the same 16 players and contracts, with no `DIVISION2_PROMOTION` duplicates.
6. Native V2 against the pool club: live start, reload mid-match, finish (identical result), quick result (V2), save/load with result and archive, no duplicate players.

The M7D realistic career (a fresh stock pyramid career over three seasons) is **PASS and byte-identical** to the deployed code.

## 6. Cross-system regression

| Gate | Result |
| --- | --- |
| Canonical manifest (300 files, excluding `cpuQualityUpgrade`) | **2,921 tests: 2,909 pass, 12 fail**. The failure set is **identical** to the established baseline. The run covered the first 5 new tests; the sixth, the daily-tick test, was added afterwards and passes in the focused run (6/6). This run includes the unemployment-media tests, fixture-route tests, M1.2 transition, qualification, promotion squads and stock rollover, M6C/M6D assistant training, M7D career, transfers/contracts, CPU clubs, matchday and calendar |
| `cpuQualityUpgrade.test.ts` | Not repeated (multi-hour); untouched code path; established baseline timeout |
| M7D career scenario | **PASS**, identical to the release |
| M6C/M6D assistant-training scenario | **PASS**, identical to the release |
| `scripts/division2-stock-career.ts` (three stock seasons) | **Fails identically on the deployed code** (`4f7e542` tree): at `persist()` line 82, its strict save round-trip `deepEqual` trips on `undefined`-valued player properties (`calibratedSquadStatusTier`, `secondaryPosition`, `specialTags`; 1,966 occurrences) that JSON drops. Pre-existing, unrelated, not changed here |
| TypeScript | **0 errors** |
| Scoped ESLint (all changed files) | **0 findings** (the deployed tree is also clean on these files) |
| Production build | **Pass** |

## Exact changed files

| File | Change |
| --- | --- |
| `apps/game/lib/career/promotionSquads.ts` | Shared `addGeneratedSquad`; `ensureQualificationOpponentSquads` |
| `apps/game/lib/game-data/types.ts` | `DIVISION2_QUALIFICATION` provenance kind |
| `apps/game/lib/career/dailyTick.ts` | Daily call after competitions |
| `apps/game/lib/career/saveMigration.ts` | Load-time call |
| `apps/game/lib/career/productionMatch.ts` | Opponent-specific message; `tryStartProductionMatch` |
| `apps/game/app/career/match-preview/page.tsx` | Checked, non-throwing start for live and quick result |
| `apps/game/lib/career/division2Qualification.test.ts` (new) | 6 focused tests |
| `apps/game/scripts/game-test-files.json` | New test added to the manifest |

## Remaining limitations

- **Generated opponents are Division 1-level fictional squads.** The existing promotion model (`DIVISION_1` fallback ratings) is reused, so a pool qualifier is about as strong as a lower Division 1 side. The QA series ended 28–18 and 38–28 to Vinslöv.
- **A pool club that played the manager keeps its 16 players** and joins the roster-backed lifecycle (CPU contracts, transfers, development, retirement), as relegated clubs already do. Over many seasons the number of such clubs grows by at most one or two per season in which the manager meets a pool club.
- **Opponent injuries are not filtered** by the opponent lineup builder (pre-existing). A fully injured opponent squad can still start.
- **`division2-stock-career.ts` is broken on the deployed code too** (strict round-trip assertion on `undefined` properties); it needs its own fix.
- **The live QA career on the Alpha** remains blocked until this hotfix is deployed; on first load after deployment, Lödde's squad is created and the match can be played.
- **Unchanged from earlier reports:** the 12 baseline failures and the `cpuQualityUpgrade` timeout.

## Evidence

Logs in `C:/DEV/QA/logs/2026-11/`:
- `div2-unit.log` and `div2-focused.log`
- `div2-qa-copy-validation.log`
- `div2-suite.log`
- `div2-m7d-scenario.log` and `div2-training-scenario.log`
- `div2-stock-career.log` and `div2-stock-career-baseline.log`
- `div2-scoped-lint.log`
- `div2-production-build.log`

Reports in `C:/DEV/QA/reports/handball-div2-playable-qualification/`: the QA copy, `validate-qa-copy.mts`, and the scenario outputs.

## Commit

- Implementation: `0a1c175f8beb1474ee055790e6620d145ec53287` on `hotfix/div2-playable-qualification` (parent `17564f5`).
- This report is committed directly on top. **Not pushed, not deployed**; awaiting approval.
