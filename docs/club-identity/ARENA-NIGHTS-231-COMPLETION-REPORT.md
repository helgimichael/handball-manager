# Arena Nights 231 — Completion Report

**Result: 231 / 231 canonical Experience 2027 surface recommendations are IMPLEMENTED and VERIFIED** (P0 55/55, P1 78/78, P2 66/66, P3 32/32). 0 blocked, 0 awaiting an owner decision.

Branch `feat/club-identity-arena`, worktree `C:\DEV\WORKTREES\handball-manager\club-identity-arena`. Everything is committed locally. Nothing has been pushed, merged into `main` or deployed. No production database, tester career or unrelated worktree was touched, and no paid external credits were used.

Authoritative status: `design-lab/experience-2027/club-identity/arena-231-status.json`. Generated views:
- `ARENA-NIGHTS-231-TRACEABILITY.csv` (machine-readable)
- `ARENA-NIGHTS-231-IMPLEMENTATION-STATUS.md` (execution map with the selected alternative, dependencies, evidence and verification per ID)

`arena-231.mjs --check` confirms that all 231 surfaces, all 551 alternatives and every recommendation are present and unchanged. Each ID was implemented with the recommended alternative.

## Owner decisions preserved

- Arena Nights is the production identity and the only shipping theme. The settings theme row is read-only and states this.
- Dynamic Club Identity stays active, and every approved club-colour decision is intact. Club colours remain the always-on accent.
- The separate Svenska Cupen tab remains.
- All 551 alternatives and every existing owner decision are preserved. The Design Lab data was read only.

## Baseline → final

| Status | Baseline (recovery) | Final |
|---|---|---|
| VERIFIED | 24 | **231** |
| IMPLEMENTED | 16 | 0 |
| IN_PROGRESS | 11 | 0 |
| NOT_STARTED | 180 | 0 |
| BLOCKED / OWNER_DECISION_REQUIRED | 0 | 0 |

## Milestone history (local commits)

| Commit | Milestone |
|---|---|
| db9ee64 | M1 transfers — REC-03..05 |
| b02efa5 | M2 training — TRN-01, 01a–f |
| bff92d3 | M3 live match — MDY-02, 02b–i, 02k–m |
| ffb3502 | M4 inbox and world — WLD-01..06 |
| bf1f61e | M5 entry and shell — ENT-01..13, SYS-01 |
| 7281cc8 | M6 squad and players — SQD-01..05 |
| 68254cb | M7 match prep and analysis — ANL-01..05, MDY-01, MDY-04 |
| 85e2c69 | M8 dashboard and competition — DSH-01, CMP-01..04 |
| a2f8d50 | M9 club — CLB-01..06 |
| 50264b4 | M10 staff, medical, scouting — STF-01..04, MED-01, REC-01..02 |
| bf9da00 | M11 manager and season — MGR-01..03 |
| 3700841 | M12 internal tools — SYS-02..06, MGR-04, MDY-03 |
| 2c7d933 | e2e: shared helpers drive the redesigned surfaces |
| bfd6e2a | Integration: shell wiring, CSS imports, test registration, overrides, 231 status |
| 8195931 | Fix: Klubbhuset as a merged destination; SQD-01 saved views in the shell tests |
| 90ff393 | 231-surface Playwright sweep and three UI fixes (ENT-08b, ENT-02/06, WLD-03) |
| 9c78d5a | 212/231 verified by the sweep |
| e7c8d75 | e2e specs updated for the redesigned surfaces; two regressions fixed (SQD-02, MDY-02b) |
| e9cf63a | State-coverage spec for the 19 deep-career surfaces; two UI fixes (MDY-02k, STF-03b) |
| (this commit) | 231/231 verified; completion report |

The milestone commits rely on the integration commit bfd6e2a for their `globals.css` imports, so build the branch tip, not an individual milestone.

## Files changed

335 files from base `e31ddd7` to the commit before this report (+34 302 / −9 454 lines):
- `apps/game/components` 144
- `apps/game/lib` 82 (almost all new presentation-model modules with tests)
- `apps/game/app` 80
- `apps/game/e2e` 21
- `apps/game/scripts` 1 (test registration)
- design-lab club-identity tooling 4
- docs 3

**Protected systems are untouched.** Engine, simulation, development, CA/PA, scouting accuracy, transfer economics, contract and competition rules, promotion/relegation, B-team, CPU fairness, archives and the save format are unchanged. The only pre-existing `lib` files modified are four presentation models: `lib/career/frontPage.ts`, `lib/career/hubs.ts`, `lib/career/squadMatrix.ts` and `lib/matchday/preMatch.ts`. No `packages/` file changed. Every new screen reads real career data through existing selectors and actions. Fog of war holds: no CA/PA is shown for non-owned players.

## Test results

All logs are in `C:\DEV\QA\logs\arena-231\`.

| Check | Result |
|---|---|
| TypeScript (`tsc -p . --noEmit`) | 0 errors |
| ESLint on changed files | clean |
| Production build (`build-3.log`, final code) | exit 0 |
| Bounded Node regression (`regression-2.log`; 364 files, `cpuQualityUpgrade` excluded as >90 min) | 3216 tests, 3204 pass, **12 fail — identical to the 12-failure baseline** (`C:\DEV\QA\logs\club-identity\baseline-failures.txt`). No new failure. |
| Grep gate `clubWorldMembership.test.ts` | pass |
| Arena overrides `generate-arena-overrides.mjs --check` | up to date |
| `npm run build:worker` (`worker-build.log`) | exit 0, "Cloudflare Worker Build Successfully Verified" (3 expected non-fatal sharp copy notices) |
| `wrangler deploy --dry-run` (`wrangler-dry-run.log`) | exit 0 |
| Playwright 231 sweep (`sweep-3.log`) | 1 passed (11.7 min). 213 surfaces pass in a fresh career. The other 18 are the deep-career states the states spec covers. Every VERIFIED surface still passes. |
| Playwright states spec (`states-2.log`) | 1 passed (5.6 min), 19/19 surfaces |
| Full Playwright suite (`playwright-full-2.log`) | 18 passed, 11 failed, 1 skipped, 3 did not run. **The 11 failures are exactly the 11 that failed before this project** (`C:\DEV\QA\logs\club-identity\p3-playwright-full.log`). |

### Playwright failure classification

The first full run on this branch had 14 failures. Three were new: arena-journey, phase3-club-world and weekly-manager. Every failure was classified, and none was deleted or weakened. Spec changes carry a code comment with the reason.

- **Genuine regressions (fixed in product, verified after rebuild):**
  - SQD-02: the deal-sheet region shared the accessible name "Förlängning" with its own select. Renamed to "Kontraktsförlängning".
  - MDY-02b / ENT-07a: on phones the shell's bottom dock covered the live-match "Spela" transport. The dock now steps aside on the live-match route.
  - Found by the sweep:
    - ENT-08b: the save menu sat under the Week Spine.
    - ENT-02 / ENT-06: the host shell closed on pointerdown, so the first FORTSÄTT click was lost.
    - WLD-03: press tone keys 1–6 also fired the shell's hub keys.
  - Found by the states spec:
    - MDY-02k: the matchday banner was light ink on a light bar (1.02:1).
    - STF-03b: staff sub-page breadcrumbs read "Profil".
- **Obsolete selectors (spec updated to the redesigned UI; intent unchanged):**
  - Now pass: arena-journey, phase3-club-world, weekly-manager.
  - Driven forward to their original baseline stop: game-experience-v11, game-presentation ×2, management, product.
  - The redesign changes behind these updates: dossier tabs (SQD-02), league centre and competition cards (CMP-01), breadcrumb-less back navigation (ENT-09), contracts Gantt (SQD-05), compare heads (SQD-03), the merged Klubbhuset rail (CLB-01), and the live final whistle via live play (MDY-02m).
- **Unsupported match speeds (pre-existing):** match-calibration-v21:147, match-realism-v2:39 and match-motion:28 ask for 4× / 16×. The game offers 1, 2, 10, 20, 48, 64 and 86. These are calibration tests, so substituting another speed would change what they measure. Left as is.
- **Pre-existing failures unrelated to this project:**
  - career-loading-screen:43 and match-motion:61 read fixture files that do not exist in the worktree (ENOENT).
  - match-calibration-v21:298 fails on a retained replay `initialSessionHash` mismatch (engine area, unchanged).
  - game-presentation:30 and :62 expect "Torslanda" as the first opponent, which is random per new world.
  - management:19 expects a renewal to change the expiry date the same day, but the renewal is a bid answered the next day.
  - product:6 plays a cup tie, so the league results list is empty.
  - game-experience-v11:75 searches the market for a player ("Ahlin"), but no player matches.

## Visual verification

Every surface was checked in the production build at 1440×900, 900×1000 and 375×812, unless its canonical spec is single-viewport (for example the gates and the live match). Each check is named after the surface ID. Each surface got:
- a check that the canonical recommended structure is present per viewport, including the phone variant the spec recommends;
- no `pageerror` and no horizontal overflow;
- at least one real interaction where the spec defines one.

Screenshots and per-ID results:
- `C:\DEV\QA\reports\arena-231\sweep\`: `sweep-results-run2.json`, `sweep-results-run3.json`, `sweep-routes.json`, PNG per route and viewport.
- `C:\DEV\QA\reports\arena-231\states\`: `states-results.json` with `reachedBy` per ID, and `<ID>-{desktop,tablet,phone}.png`.

**How the deep-career states were reached.** `apps/game/e2e/arena-231-states.prep.ts` plays a Tumba career for a full season (32 matches) using only the functions the UI buttons call:
- `continueCareerRhythm` (Continue)
- `playManagerFixture` (playing a match)
- the inbox, press and board actions

It writes validated portable backups. The spec imports them through Inställningar → Data and drives each surface in the UI. Two exceptions:
- **MDY-02k (suspended manager):** after the season's only real discipline case was decided, the prep opens one more case with the game's own `openDisciplineCase`, using the game's own provocative referee answer. Disciplinnämnden's two-match suspension then comes from the normal daily tick.
- **TRN-01f (training skeleton):** the Suspense fallback never mounts in the live app, because CareerProvider shows its loading screen first. It was verified by rendering `TrainingWeekSkeleton` under the real training stylesheets. The check covers role=status, aria-live, 7 day columns, no overflow and no pulse under reduced motion.

## Limitations and deviations (recommended alternative kept; detail differs)

- ENT-03f: club confirmation is a click, not press-and-hold.
- ENT-05 / SYS-01: the theme row is read-only, because Arena Nights is the only shipping theme (owner decision).
- CLB-06c: only wages ⇄ transfers can be reallocated (`setBudgetPlan`). Staff, academy and facility budgets are shown read-only because the game has no rule to move them, and none was invented.
- REC-01: the Kortlista is reordered through the existing priority levels, not free drag, which would need new saved data.
- CMP-02: the own next fixture is not auto-redirected.
- DSH-01c: the season curtain does not animate into the nav icon.
- MGR-04: the moment library left the product (`/career/moments` redirects). A Design Lab specimen gallery is lab-side follow-up, because lab files were read only.
- MDY-02m: no manual skip button on the quick-finish card.
- WLD-02d: discipline concerns the manager.
- Gated dev routes (SYS-02..05) return HTTP 200 with Next's built-in 404 page when the editor flag is off, because `notFound()` runs inside a streamed layout. The content is gated; the status code is not 404.

## Found during verification, not fixed (outside UI scope)

- **Staff hire across the season transition (`lib/staff`).** If a free-agent staff member is offered a contract on the transition day, the next tick's `ensureStaffMarket` rebuilds the pool with new ids. The negotiation then completes, but `hireFreeAgent` finds nobody, so nobody joins. The "Klar" column shows the raw id and its link opens "Personen hittades inte". This is domain logic and needs its own change.
- **Free-agent term sheet starts at 0 €/mån** (`NegotiationRoom` passes `wageEurPerMonth ?? 0`), so a first offer at the default is always rejected. A fair-wage default would come from true ability and break fog of war, so it was left.
- **MDY-02 at 375 px:** long club names in the live-match hero can overlap the score.

## Blockers

None.

## Housekeeping note

The states prep writes `C:\DEV\QA\reports\arena-231\states\saves\`, about 988 MB of generated backups that carry full replay archives. The filesystem policy places assets over 500 MB on `D:\08_Projekt\STARKVIS\`. They have not been moved or deleted: that needs owner approval. They can be regenerated from `arena-231-states.prep.ts`.

## Every ID and status

The table below is generated from `arena-231-status.json`. The status document has the full execution map with evidence and verification text per ID.

| ID | Surface | Priority | Rec. | Milestone | Status | Verified by |
|---|---|---|---|---|---|---|
| ENT-01 | Alpha access gate | P2 | A: Ticket at the turnstile | M5-entry-shell | VERIFIED | Sweep |
| ENT-02 | Title screen (Huvudmeny) | P0 | C: Journal Cover | M5-entry-shell | VERIFIED | Sweep |
| ENT-03 | New game wizard | P0 | C: Club first, contract last | M5-entry-shell | VERIFIED | Sweep |
| ENT-03a | Step 1 · Nationer | P1 | A: 'Världen' advanced drawer | M5-entry-shell | VERIFIED | Sweep |
| ENT-03b | Step 2 · Ligor | P1 | A: League pyramid | M5-entry-shell | VERIFIED | Sweep |
| ENT-03c | Step 3 · Databas (summary) | P1 | A: Fold into drawer footer | M5-entry-shell | VERIFIED | Sweep |
| ENT-03d | Step 4 · Klubb | P0 | C: Club Wall by ambition | M5-entry-shell | VERIFIED | Sweep |
| ENT-03e | Step 5 · Manager | P1 | B: Accreditation pass | M5-entry-shell | VERIFIED | Sweep |
| ENT-03f | Step 6 · Starta (preseason) | P1 | B: Signing ceremony | M5-entry-shell | VERIFIED | Sweep |
| ENT-04 | Load game (Sparade karriärer) | P1 | C: Journal Cover | M5-entry-shell | VERIFIED | Sweep |
| ENT-04a | Delete-save inline confirmation | P2 | A: Consequence dialog with export | M5-entry-shell | VERIFIED | Sweep |
| ENT-04b | Load game: loading / empty / error states | P2 | A: Skeleton saves + invitation | M5-entry-shell | VERIFIED | Sweep |
| ENT-05 | Settings (from main menu) | P2 | A: Unified settings panel | M5-entry-shell | VERIFIED | Sweep |
| ENT-06 | Host shell (STARKVIS navbar) | P1 | A: Corner escape hatch | M5-entry-shell | VERIFIED | Sweep |
| ENT-07 | Career shell · sidebar navigation | P0 | C: Hub rail + Week Spine + Peek | M0-prior-phases | VERIFIED | Sweep |
| ENT-07a | Mobile nav drawer | P0 | A: Bottom tabs + docked Continue | M0-prior-phases | VERIFIED | Sweep |
| ENT-08 | Career top bar (header) | P0 | C: Matchday clock | M0-prior-phases | VERIFIED | Sweep |
| ENT-08a | Global search results dropdown | P1 | A: Command palette (⌘K) | M0-prior-phases | VERIFIED | Sweep |
| ENT-08b | Save controls | P1 | A: Autosave indicator + overflow | M5-entry-shell | VERIFIED | Sweep |
| ENT-09 | Context bar (breadcrumb row) | P1 | A: Real breadcrumb in page header | M5-entry-shell | VERIFIED | Sweep |
| ENT-09a | Progression notice (after Continue) | P0 | C: Spine pin + event card | M5-entry-shell | VERIFIED | Sweep |
| ENT-10 | Continue / advance-day flow | P0 | C: Up-next queue | M0-prior-phases | VERIFIED | Sweep |
| ENT-10a | Continue processing overlay ('Världen går vidare.') | P0 | C: Calendar flip → floodlight build-up | M5-entry-shell | VERIFIED | Sweep |
| ENT-11 | Feedback / bug report modal | P2 | A: Help menu + context capture | M5-entry-shell | VERIFIED | Sweep |
| ENT-12 | Career initialization / loading / error screen | P1 | C: First-day handover | M5-entry-shell | VERIFIED | Sweep |
| ENT-13 | Live-match banner (header subline) | P1 | A: Live score pill | M5-entry-shell | VERIFIED | Sweep |
| DSH-01 | Dashboard · Managerns kontor (Hem) | P0 | C: Today's Paper | M0-prior-phases | VERIFIED | Sweep |
| DSH-01a | Office hero header | P0 | C: Journal Masthead | M0-prior-phases | VERIFIED | Sweep |
| DSH-01b | Next match hero + league card | P0 | C: Match Box | M8-dashboard-competition | VERIFIED | Sweep |
| DSH-01c | Season-complete milestone & transition blockers | P1 | B: Season Curtain | M8-dashboard-competition | VERIFIED | States spec |
| DSH-01d | Contextual notices (unemployed / new season) | P1 | B: State Front Pages | M0-prior-phases | VERIFIED | Sweep |
| DSH-01e | Laget inför avkast (availability) | P0 | B: Court Coverage | M8-dashboard-competition | VERIFIED | Sweep |
| DSH-01f | Utanför planen (contracts & radar) | P1 | B: Folded into Decisions | M0-prior-phases | VERIFIED | Sweep |
| DSH-01g | Senaste avtrycket (recent results) | P2 | B: Form Strip | M8-dashboard-competition | VERIFIED | Sweep |
| DSH-01h | Från klubben (latest news) | P1 | A: Ranked Briefs | M8-dashboard-competition | VERIFIED | Sweep |
| DSH-01i | Veckans managerplan (weekly overview) | P0 | C: Week Spine (embedded) | M0-prior-phases | VERIFIED | Sweep |
| DSH-01j | Styrelsen (board card) | P1 | A: Dual Meter + Objectives | M0-prior-phases | VERIFIED | Sweep |
| DSH-01k | Rivalerna + På andra planer + training note | P2 | A: Ladder Slice + Round List | M0-prior-phases | VERIFIED | Sweep |
| CLB-01 | Klubbhuset (clubhouse hub) | P1 | C: Merged into Club Journal | M9-club | VERIFIED | Sweep |
| CLB-01a | Interactive floorplan + room stage | P2 | A: Illustrated Map + Peek | M9-club | VERIFIED | Sweep |
| CLB-01b | Room cards gallery | P3 | A: Retire the Gallery | M9-club | VERIFIED | Sweep |
| CLB-01c | Identity / Supporters / National team panels | P2 | C: Club Almanac | M9-club | VERIFIED | Sweep |
| CLB-02 | Klubb (own club overview) | P1 | C: Club Journal | M0-prior-phases | VERIFIED | Sweep |
| CLB-02a | ClubContext tabs (Resultat & form / Övergångar / Säsongshistorik) | P2 | B: Club Story Timeline | M9-club | VERIFIED | Sweep |
| CLB-02b | Economy & partnerships rail | P1 | A: KPI Trio + Revenue Mix | M0-prior-phases | VERIFIED | Sweep |
| CLB-03 | Klubbpartnerskap | P2 | C: Partner Dossiers + Guided Deal | M9-club | VERIFIED | Sweep |
| CLB-03a | Partner search & agreement form | P2 | A: Three-step Drawer | M9-club | VERIFIED | Sweep |
| CLB-03b | Placement & international loan panels | P3 | A: Placement List | M9-club | VERIFIED | Sweep |
| CLB-04 | Other club profile | P1 | C: Peek-first Portrait | M9-club | VERIFIED | Sweep |
| CLB-04a | Club identity & coach philosophy panels | P2 | B: Profile in Words | M9-club | VERIFIED | Sweep |
| CLB-05 | Styrelserummet (Board) | P1 | C: Board Minutes | M9-club | VERIFIED | Sweep |
| CLB-05a | Board verdict hero | P2 | B: Verdict Moment then Band | M9-club | VERIFIED | States spec |
| CLB-05b | Recovery-plan & contract-offer decision cards | P1 | B: Meeting Moment | M9-club | VERIFIED | States spec |
| CLB-06 | Finanscentralen (Finance) | P1 | A: Finance Cockpit | M9-club | VERIFIED | Sweep |
| CLB-06a | Tab · Översikt | P1 | A: Chart + Action Cards | M9-club | VERIFIED | Sweep |
| CLB-06b | Tab · Intäkter & kostnader | P2 | A: Bars + Arena Fill Strip | M9-club | VERIFIED | States spec |
| CLB-06c | Tab · Budget | P1 | A: Reallocation Sliders | M9-club | VERIFIED | Sweep |
| CLB-06d | Tab · Huvudbok (ledger) | P3 | A: Month Accordion | M9-club | VERIFIED | States spec |
| CLB-06e | Tab · Lönekontrakt | P2 | A: Merge into Kontrakt | M9-club | VERIFIED | Sweep |
| CLB-06f | Tab · Prognos | P3 | B: Fan Chart + Assumptions | M9-club | VERIFIED | Sweep |
| MGR-01 | Karriär (manager career) | P1 | C: Manager Biography | M11-manager-season | VERIFIED | Sweep |
| MGR-01a | Tab · Profil och historik | P1 | B: Annotated Reputation Timeline | M11-manager-season | VERIFIED | Sweep |
| MGR-01b | Tab · Jobbmarknaden | P1 | C: Application Pipeline | M11-manager-season | VERIFIED | Sweep |
| MGR-01c | Dismissed / unemployed hero state | P1 | A: Dismissal Moment | M0-prior-phases | VERIFIED | Sweep |
| MGR-02 | Historik | P2 | C: Season Books | M11-manager-season | VERIFIED | States spec |
| MGR-02a | Season selector tabs | P3 | A: Season Timeline | M11-manager-season | VERIFIED | Sweep |
| MGR-03 | Säsongen (season hub) | P1 | B: Path to Gold | M11-manager-season | VERIFIED | Sweep |
| MGR-03a | SM-slutspel / Kval / Cup sections | P2 | A: Ghost Bracket | M11-manager-season | VERIFIED | Sweep |
| MGR-03b | Season verdict & awards gala | P2 | A: Gala Sequence | M11-manager-season | VERIFIED | States spec |
| MGR-04 | Momentbiblioteket (moment library) | P3 | B: Move to Design Lab | M12-internal-tools | VERIFIED | Sweep |
| WLD-01 | Inkorg (Inbox) | P0 | C: Correspondence Desk | M4-inbox-world | VERIFIED | Sweep |
| WLD-01a | Inbox filters | P0 | A: Segment + Chips | M4-inbox-world | VERIFIED | Sweep |
| WLD-01b | Message reader + empty states | P0 | C: Thread Reader with Chain Rail | M4-inbox-world | VERIFIED | Sweep |
| WLD-02 | Mediecentret (Media) | P1 | C: Newsstand | M4-inbox-world | VERIFIED | Sweep |
| WLD-02a | Tab · Nyheter (feed) | P1 | A: Image Lead + Dated List | M4-inbox-world | VERIFIED | Sweep |
| WLD-02b | Tab · Presskonferenser | P1 | B: Decisions + Quote Archive | M4-inbox-world | VERIFIED | Sweep |
| WLD-02c | Tab · Rivaler | P2 | A: Rivalry Cards | M4-inbox-world | VERIFIED | Sweep |
| WLD-02d | Tab · Disciplin | P3 | A: Move to Player Status | M4-inbox-world | VERIFIED | Sweep |
| WLD-02e | Tab · Medierna (outlets) | P3 | A: Media Favour Meters | M4-inbox-world | VERIFIED | Sweep |
| WLD-03 | Presskonferens | P1 | C: Live Transcript | M4-inbox-world | VERIFIED | Sweep |
| WLD-04 | Artikel (story) | P2 | B: Outlet-skinned Article | M4-inbox-world | VERIFIED | Sweep |
| WLD-05 | Kalender | P0 | C: Week Spine Calendar | M0-prior-phases | VERIFIED | Sweep |
| WLD-06 | Schema (Matcher & resultat) | P1 | C: Calendar List View | M4-inbox-world | VERIFIED | Sweep |
| WLD-06a | Preseason planner (tabs Träningsmatch / Läger-resa / Turnering) | P2 | A: Preseason Board on Calendar | M4-inbox-world | VERIFIED | Sweep |
| WLD-06b | Schedule filter tabs | P3 | B: Calendar Chips | M4-inbox-world | VERIFIED | Sweep |
| MED-01 | Medicinskt & Rehabilitering | P2 | C: Return-to-play timeline | M10-staff-medical-scouting | VERIFIED | Sweep |
| MED-01a | Active injuries table / empty scene | P2 | A: Rehab cards with phase stepper | M10-staff-medical-scouting | VERIFIED | States spec |
| SYS-01 | Inställningar (in-career settings) | P2 | A: Unified settings (shared with ENT-05) | M5-entry-shell | VERIFIED | Sweep |
| SYS-02 | Editor home (dev data editor) | P3 | A: Dev console home | M12-internal-tools | VERIFIED | Sweep |
| SYS-02a | Editor · players (bulk calibration table) | P3 | A: Keep spreadsheet, add dev affordances | M12-internal-tools | VERIFIED | Sweep |
| SYS-02b | Editor · player detail | P3 | A: Diff-first detail | M12-internal-tools | VERIFIED | Sweep |
| SYS-02c | Editor · rating review roster | P3 | A: Review queue | M12-internal-tools | VERIFIED | Sweep |
| SYS-02d | Editor · rating detail | P3 | A: Sectioned with sticky summary | M12-internal-tools | VERIFIED | Sweep |
| SYS-02e | Editor · court grid calibration | P3 | A: Canvas + inspector | M12-internal-tools | VERIFIED | Sweep |
| SYS-03 | Scenario lab (engine labs) | P2 | A: Gate under dev console | M12-internal-tools | VERIFIED | Sweep |
| SYS-03a | Scenario lab · core | P3 | A: Dev shell lab | M12-internal-tools | VERIFIED | Sweep |
| SYS-03b | Scenario lab · match | P3 | A: Timeline-first lab | M12-internal-tools | VERIFIED | Sweep |
| SYS-04 | Match 2D QA harness | P2 | A: Gated QA harness with control panel | M12-internal-tools | VERIFIED | Sweep |
| SYS-05 | CPU-rekrytering (debug) | P2 | A: Move under dev gate | M12-internal-tools | VERIFIED | Sweep |
| SYS-06 | Editor mode widget (global) | P3 | A: DEV ribbon toggle | M12-internal-tools | VERIFIED | Sweep |
| SQD-01 | Truppen & Omklädningsrummet (squad list) | P0 | A: Squad Matrix | M0-prior-phases | VERIFIED | Sweep |
| SQD-01a | Tab "Översikt" | P0 | A: Curated summary + expandable rows | M6-squad-players | VERIFIED | Sweep |
| SQD-01b | Tab "Prestation" | P1 | A: Position-aware stat tables | M6-squad-players | VERIFIED | Sweep |
| SQD-01c | Tab "Fysisk status" | P0 | A: Readiness heat-strip | M6-squad-players | VERIFIED | Sweep |
| SQD-01d | Tab "Kontrakt" | P2 | B: Kontraktsrisk view + renewal drawer | M0-prior-phases | VERIFIED | Sweep |
| SQD-01e | Selection aside "Spelardossier & jämförelse" | P1 | A: Floating selection tray | M0-prior-phases | VERIFIED | Sweep |
| SQD-01f | Panel "Truppens balans" (SquadDepth) | P1 | B: Mini court depth | M0-prior-phases | VERIFIED | Sweep |
| SQD-01g | Empty filter state | P3 | B: Explaining empty state | M6-squad-players | VERIFIED | Sweep |
| SQD-02 | Spelarprofil (player dossier) | P0 | C: Feature Profile + Peek | M0-prior-phases | VERIFIED | Sweep |
| SQD-02a | Tab "Profil & egenskaper" (overview) | P0 | A: Key-ratings summary | M0-prior-phases | VERIFIED | Sweep |
| SQD-02b | Tab "Prestation & historik" | P1 | A: Trend chart + match log | M6-squad-players | VERIFIED | Sweep |
| SQD-02c | Tab "Egenskaper" | P1 | A: Attributes & development workspace | M6-squad-players | VERIFIED | Sweep |
| SQD-02d | Tab "Utveckling" | P1 | A: Development curve + focus | M6-squad-players | VERIFIED | Sweep |
| SQD-02e | Tab "Kontrakt" | P1 | A: Deal sheet | M6-squad-players | VERIFIED | Sweep |
| SQD-02f | Tab "Klubbhistorik" | P2 | A: Career ribbon | M6-squad-players | VERIFIED | Sweep |
| SQD-02g | PlayerHero + PlayerActions | P0 | A: Sticky identity bar + primary CTA | M0-prior-phases | VERIFIED | Sweep |
| SQD-02h | Panel "Tillstånd" (PlayerConditionPanel) | P1 | A: Condition gauge set | M6-squad-players | VERIFIED | Sweep |
| SQD-02i | Panel "Spelaren som person" (PlayerDynamicsPanel) | P1 | A: Mood hub with causes | M6-squad-players | VERIFIED | Sweep |
| SQD-02j | Panel "Spelaregenskaper (skala 1–20)" (GameplayAttributesPanel) | P0 | A: Heat matrix | M6-squad-players | VERIFIED | Sweep |
| SQD-02k | Panel "Förmåga & Positionskarta" (GameplayAbilityPanel) | P1 | A: Suitability court | M6-squad-players | VERIFIED | Sweep |
| SQD-02l | Knowledge-gated panels (external players) | P1 | A: Tightening range bars | M6-squad-players | VERIFIED | Sweep |
| SQD-02m | Panel "Scoutingrapport" (ScoutReportPanel) | P2 | A: Report timeline | M6-squad-players | VERIFIED | Sweep |
| SQD-02n | Panel "Förläng kontrakt" (ContractRenewal) | P1 | A: Offer with consequence preview | M6-squad-players | VERIFIED | Sweep |
| SQD-02o | Panel "Transferläge" (PlayerTransferCard) | P2 | A: Unified status card | M6-squad-players | VERIFIED | Sweep |
| SQD-02p | Panel "Medicinskt" (MedicalPanel) | P2 | A: Rehab timeline | M6-squad-players | VERIFIED | Sweep |
| SQD-02q | Loading / not-found states | P3 | A: Skeleton + recover | M6-squad-players | VERIFIED | Sweep |
| SQD-03 | Spelarsök (player market search) | P1 | A: Market Workbench | M6-squad-players | VERIFIED | Sweep |
| SQD-03a | Dossier aside "Spelardossier" | P2 | B: Peek drawer | M6-squad-players | VERIFIED | Sweep |
| SQD-04 | Jämför spelare | P2 | A: Head-to-head with delta bars | M6-squad-players | VERIFIED | Sweep |
| SQD-05 | Kontrakt (contracts overview) | P1 | B: Contract timeline (Gantt) | M6-squad-players | VERIFIED | Sweep |
| SQD-05a | Panel "Ditt avtalsbeslut" | P2 | A: Side drawer | M6-squad-players | VERIFIED | Sweep |
| STF-01 | Personal – Organisation | P1 | A: Org & Responsibility Matrix | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-01a | Staff subnav (StaffNav) | P2 | A: Hub secondary tabs | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-01b | Panel "Klubbens organisation" (OrganisationChart) | P2 | A: Health-coloured tree | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-01c | Staff table + role counts | P3 | A: Compact list view toggle | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-01d | Rail "Veckans tränaransvar" | P2 | A: Mini week grid | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-02 | Personprofil (staff profile) | P2 | A: Staff Dossier | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-02a | Panels "Lämplighet" + "Egenskaper för rollen" (StaffInsight) | P2 | A: Range bars with holder delta | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-02b | Panel "Värva / Förläng eller avsluta" (StaffDealPanel) | P2 | A: Shared stepper + consequence preview | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-03 | Rekrytera personal | P2 | B: Vacancy-led hiring | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-03a | View "Vakanta tjänster" | P2 | A: Vacancy cards with impact | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-03b | View "Förhandlingar" | P2 | A: Negotiation board | M10-staff-medical-scouting | VERIFIED | States spec |
| STF-03c | Panel "Hitta rätt person" (StaffMarketBoard) | P2 | A: Board as sole market | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-03d | Legacy tables "Fria scouter" + "Rekrytering — Personal" | P3 | A: Remove | M10-staff-medical-scouting | VERIFIED | Sweep |
| STF-04 | Ansvarsfördelning (delegation) | P2 | B: Contextual delegation + proposals queue | M10-staff-medical-scouting | VERIFIED | Sweep |
| TRN-01 | Träning & Återhämtning | P0 | C: Assistant Proposal | M2-training | VERIFIED | Sweep |
| TRN-01a | Panel "Assistentens träningsplan" (AssistantTrainingPanel) | P0 | A: Diff overlay on grid | M2-training | VERIFIED | Sweep |
| TRN-01b | Panel "Veckoschema" (week planner) | P0 | A: Block planner | M2-training | VERIFIED | Sweep |
| TRN-01c | Panel "Spelarberedskap" | P0 | A: Shared readiness strip + inline settings | M2-training | VERIFIED | Sweep |
| TRN-01d | Panel "Utveckling" | P1 | A: Development leaderboard | M2-training | VERIFIED | Sweep |
| TRN-01e | TrainingFeedback block | P1 | A: Outcome on executed day | M2-training | VERIFIED | Sweep |
| TRN-01f | Loading state | P3 | A: Skeleton grid | M2-training | VERIFIED | States spec |
| TRN-02 | Matchplan & Taktiktavla 2.0 | P0 | A: Tactics Board | M0-prior-phases | VERIFIED | Sweep |
| TRN-02a | Guard states (no fixture / too few players / unavailable in plan / non-normal formation / invalid lineup) | P0 | A: Inline warning + auto-fix preview | M0-prior-phases | VERIFIED | Sweep |
| TRN-02b | Court modes "ANFALL (6v6)" / "FÖRSVAR (6v6)" (dual tabs) | P0 | A: Phase × manpower switcher | M0-prior-phases | VERIFIED | Sweep |
| TRN-02c | Special situations tabs (6 mot 5 / 5 mot 6 / 7 mot 6) | P1 | A: Matrix cells with completion | M0-prior-phases | VERIFIED | Sweep |
| TRN-02d | Mode "Byten & Diff" (TacticsDiffManager) | P1 | A: Pairing lines on court | M0-prior-phases | VERIFIED | Sweep |
| TRN-02e | Overlay mode selector "Taktikvisning" | P1 | A: Segmented control + legend | M0-prior-phases | VERIFIED | Sweep |
| TRN-02f | Rail "Så spelar vi" (CoachingChoices) | P0 | A: Choices with trade-off lines | M0-prior-phases | VERIFIED | Sweep |
| TRN-02g | Section "Fasta situationer · 7-meter" (SetPieceSection) | P1 | A: Ordered takers with stats | M0-prior-phases | VERIFIED | Sweep |
| TRN-02h | Section "Ledarskap" (LeadershipSection) | P2 | A: Single roles editor | M0-prior-phases | VERIFIED | Sweep |
| TRN-02i | Roster "Matchtrupp · n spelare" / "Ej uttagna" | P0 | A: Bench strip + counter | M0-prior-phases | VERIFIED | Sweep |
| REC-01 | Scouting & Motståndaranalys | P1 | C: Shortlist & Reports | M10-staff-medical-scouting | VERIFIED | Sweep |
| REC-01a | ScoutingCentre ("Scoutingcentralen") | P2 | B: Need-driven recommendations rail | M10-staff-medical-scouting | VERIFIED | Sweep |
| REC-01b | Panel "Dina scouter" | P2 | A: Scout capacity cards | M10-staff-medical-scouting | VERIFIED | Sweep |
| REC-01c | Panel "Ny bevakning" | P1 | B: "Scouta" action sheet | M10-staff-medical-scouting | VERIFIED | Sweep |
| REC-01d | Panel "Nytt bredare uppdrag" | P2 | B: Coverage map | M10-staff-medical-scouting | VERIFIED | Sweep |
| REC-01e | Panels "Aktiva uppdrag" / "Färdiga rapporter" / "Breda uppdrag" | P1 | A: Single pipeline list | M10-staff-medical-scouting | VERIFIED | Sweep |
| REC-01f | Panel "Upptäckta spelare" | P1 | A: Ranked discoveries table | M10-staff-medical-scouting | VERIFIED | States spec |
| REC-02 | Rekryteringscentrum | P0 | C: Unified pipeline board | M0-prior-phases | VERIFIED | Sweep |
| REC-02a | Candidate dossier | P1 | A: Recruitment Peek drawer | M10-staff-medical-scouting | VERIFIED | Sweep |
| REC-03 | Transfer Centre | P0 | A: Market Table + Deal Panel | M1-transfers | VERIFIED | Sweep |
| REC-03a | Panel "Försäljning – Bud och avgångar" (IncomingOffersBoard) | P1 | A: Sälj mode | M1-transfers | VERIFIED | Sweep |
| REC-03b | Market tabs (Möjligheter / Hela marknaden / Bevakade) | P0 | A: Saved views over one table | M1-transfers | VERIFIED | Sweep |
| REC-03c | Dossier aside (TransferDossier) | P0 | A: Deal drawer | M1-transfers | VERIFIED | Sweep |
| REC-03d | Side panels (Förhandlingar, Truppbehov, Marknadspuls, Senaste affärer) | P1 | B: Need heat-map on court | M1-transfers | VERIFIED | Sweep |
| REC-04 | Förhandlingsrum (negotiation room) | P0 | A: Term Sheet | M1-transfers | VERIFIED | Sweep |
| REC-04a | Start decision "Inled förhandling" | P1 | A: Two choice cards | M1-transfers | VERIFIED | Sweep |
| REC-04b | Decision form – club stage | P0 | A: Range-band slider | M0-prior-phases | VERIFIED | Sweep |
| REC-04c | Decision form – player stage | P0 | A: Package builder with total cost | M1-transfers | VERIFIED | States spec |
| REC-04d | Waiting / closed status | P0 | A: Waiting card with advance | M1-transfers | VERIFIED | Sweep |
| REC-04e | Deal completed (DealCompletion) | P2 | A: Signing moment | M1-transfers | VERIFIED | States spec |
| REC-05 | Bud på din spelare (incoming offer) | P1 | A: Sell decision sheet | M1-transfers | VERIFIED | States spec |
| REC-05a | Sold moment (MomentHero "Såld") | P3 | A: Farewell card | M1-transfers | VERIFIED | States spec |
| CMP-01 | Tävlingar (competition workspace) | P0 | A: League Centre | M8-dashboard-competition | VERIFIED | Sweep |
| CMP-01a | Tab "Tabell & form" | P0 | A: Annotated standings | M0-prior-phases | VERIFIED | Sweep |
| CMP-01b | Tab "Matcher" | P2 | A: Round-grouped fixtures | M8-dashboard-competition | VERIFIED | Sweep |
| CMP-01c | Tab "Resultat" | P2 | A: Results by round | M8-dashboard-competition | VERIFIED | Sweep |
| CMP-01d | Tab "Spelarstatistik" | P2 | A: Shared stats component | M8-dashboard-competition | VERIFIED | Sweep |
| CMP-01e | Tab "Klubbar" | P3 | A: Crest grid with Peek | M8-dashboard-competition | VERIFIED | Sweep |
| CMP-01f | Tab "Historik" | P3 | A: Roll of honour | M8-dashboard-competition | VERIFIED | States spec |
| CMP-01g | Svenska Cupen variant (CupWorkspace) | P1 | A: Stage path + bracket | M8-dashboard-competition | VERIFIED | Sweep |
| CMP-01h | Non-simulated league / not found states | P3 | A: Scouting-destination state | M8-dashboard-competition | VERIFIED | Sweep |
| CMP-02 | Match (fixture page) | P2 | A: Head-to-head card | M8-dashboard-competition | VERIFIED | Sweep |
| CMP-03 | Matcher (legacy redirect) | P3 | A: Server redirect | M8-dashboard-competition | VERIFIED | Sweep |
| CMP-04 | Statistik | P2 | A: Leaderboards by position | M8-dashboard-competition | VERIFIED | Sweep |
| MDY-01 | Matchförhandsvisning (match preview / matchday gate) | P0 | C: Three-step ritual | M0-prior-phases | VERIFIED | Sweep |
| MDY-01a | MatchdayStage ("Matchdagen") | P2 | A: Stakes header | M7-matchprep-analysis | VERIFIED | Sweep |
| MDY-01b | Confirm dialog "Kontrollera matchtruppen" | P1 | A: Fix-it dialog | M7-matchprep-analysis | VERIFIED | States spec |
| MDY-01c | Blocking / lineup error alerts | P1 | A: Checklist tile state | M7-matchprep-analysis | VERIFIED | Sweep |
| MDY-01d | OpponentScoutingPanel (compact) | P1 | A: Threat cards | M7-matchprep-analysis | VERIFIED | Sweep |
| MDY-01e | Panels "Din matchförberedelse & startsjua" + "Otillgängliga spelare" | P0 | A: Court lineup with readiness rings | M0-prior-phases | VERIFIED | Sweep |
| MDY-01f | States: season complete / no fixture | P3 | A: State with next step | M7-matchprep-analysis | VERIFIED | States spec |
| MDY-02 | Live match (Match Center) | P0 | C: Floodlight Sequence | M3-live-match | VERIFIED | Sweep |
| MDY-02a | Header / scoreboard & manpower | P0 | A: Score bug with pips | M0-prior-phases | VERIFIED | Sweep |
| MDY-02b | Controls bar | P0 | A: Transport control | M3-live-match | VERIFIED | Sweep |
| MDY-02c | View "Översikt" | P0 | A: Live-first overview | M3-live-match | VERIFIED | Sweep |
| MDY-02d | View "Nyckelögonblick" | P2 | A: Timeline scrubber | M3-live-match | VERIFIED | Sweep |
| MDY-02e | View "Spelare" | P2 | A: Energy-forward table | M3-live-match | VERIFIED | Sweep |
| MDY-02f | View "Statistik" (sub-nav Match & positioner / Avslut / Målvakter / Matchutveckling) | P1 | A: Shot map + goal-mouth | M3-live-match | VERIFIED | Sweep |
| MDY-02g | Coach aside "Dina matchbeslut" (LiveCoachPanel) | P0 | A: Bench Dock | M3-live-match | VERIFIED | Sweep |
| MDY-02h | TimeoutOverlay ("Din timeout · Samla laget" / opponent timeout) | P1 | A: Timeout huddle phase | M3-live-match | VERIFIED | Sweep |
| MDY-02i | Half-time state | P0 | A: Half-time briefing | M3-live-match | VERIFIED | Sweep |
| MDY-02j | Full-time state | P0 | A: Final-whistle card | M0-prior-phases | VERIFIED | Sweep |
| MDY-02k | Assistant-in-control state | P3 | A: Assistant dock | M3-live-match | VERIFIED | States spec |
| MDY-02l | Experimental 2D court (details) | P1 | A: "Plan" view tab | M3-live-match | VERIFIED | Sweep |
| MDY-02m | Quick finish / no session / archive fallback states | P2 | A: Simulation progress | M3-live-match | VERIFIED | Sweep |
| MDY-03 | Match Center (legacy redirect) | P3 | A: Direct redirect | M12-internal-tools | VERIFIED | Sweep |
| MDY-04 | Matchrepriser (match-2d replays) | P2 | C: "Repris" tab in report | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-01 | Matchrapport | P0 | C: Editorial Match Report | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-01a | Archived match center (4 views) | P0 | A: Depth tabs behind summary | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-01b | MatchAftermathPanel ("Efter matchen") | P1 | A: Momentum hero | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-01c | Details "Speltid och belastning" | P1 | A: Workload with actions | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-01d | Legacy report variant (no archive) | P2 | A: Unified layout, degraded sections | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-01e | Error / no report states | P3 | A: Empty state with routes | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-01f | PostMatchPressBanner | P2 | A: Secondary press box | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-02 | Matchanalys – Översikt | P1 | A: Trend dashboard | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-02a | Analysis tab bar (layout) | P2 | A: Three tabs + match picker | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-03 | Matchanalys – Motståndaren | P1 | A: Mirror comparison | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-04 | Matchanalys – Vårt lag | P2 | A: Trends + window-aware tables | M7-matchprep-analysis | VERIFIED | Sweep |
| ANL-05 | Matchanalys – Senaste matchen | P1 | C: Merge into report | M7-matchprep-analysis | VERIFIED | Sweep |
