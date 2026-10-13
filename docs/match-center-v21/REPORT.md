# Match Center v2.1 — UX polish and tactical storytelling

Starting checkpoint: `038f15ec560e880e13139b25d7d878e3cf1eda13`. Date: 2026-10-13. Product direction for Match Center v2 is approved by the user. **Human acceptance of v2.1 remains pending. Nothing was pushed.**

1. **Starting checkpoint.** Continued the completed Match Center v2, preserving canonical V2 career matches, empirical calibration, Motion Quality v2, Intelligence v1 and Game Experience v1.1.
2. **Git and user state.** Initial status recorded in [preservation.json](preservation.json). The three modified user files and three untracked paths remain intact; no restore/reset/discard was used.
3. **Human-QA findings.** Replaced the continuous stacked report with selected views, tightened the report heading and hero, moved dense data out of Overview, and replaced tactical step wording with evidence-based handball language.
4. **Architecture.** One match, one component, four instant local views: Översikt, Nyckelögonblick, Spelare, Statistik. No additional routes or generic navigation library.
5. **Default view.** Översikt at entry and when reaching timeout, halftime or fulltime. Normal advancing play retains the manager's selected view.
6. **Navigation.** Match-specific sporting navigation with semantic tabs, selected states and individually labelled panels. View choice is local UI state.
7. **Sticky identity.** Club names, score, clock and match state remain in the navigation bar within the app's existing content scroll area. The global header stays separate.
8. **Overview.** Sporting score hero, ranked match story, compact lead chart, eight comparisons, deduplicated performers and four moment previews. Live intervals add decision priority and player alerts.
9. **Deterministic story.** Scorer, keeper denominator, consecutive goal run, halftime result, transition goals and discipline derive from existing canonical stats/events. Four facts maximum. No LLM, RNG or causal attribution.
10. **Primary metrics.** Goals, shots, conversion, credited saves/faced, turnovers, 7m goals/attempts, two-minute suspensions and observed transition goals.
11. **Performers.** Highest rating, leading scorer and keeper save ratio. Repeated identities are removed; Overview links open that player's match dossier.
12. **Keeper visibility.** The lowest save ratio among keepers facing at least ten on-target outcomes gets a prominent factual callout. This is a selection threshold, not a claim of league rarity or a new rating.
13. **Overview moments.** Four real canonical moments ranked by late-match importance, close-score goals and available tactical context. Clicking opens that exact event within Nyckelögonblick.
14. **Tactical story.** One selected event binds canonical outcome, nearby events from the same possession, exact saved frames and known player identities.
15. **Handball terminology.** “Slår sin försvarare”, “kliver i hjälp”, “får en öppning” and named pass recipients replace internal engine concepts.
16. **Stages.** Utgångsläge, Försvararen passeras, Hjälpförsvaret kliver, Passningen and Avslut/Utfallet appear only when supported. A frame before an evidence tick cannot be labelled as that reaction. Missing stages stay neutral.
17. **Court.** Static stored positions remain exact, with closeup/full-court choice. Story labels also appear in the court caption. No interpolation or continuous animation was introduced.
18. **Actors.** Carrier/shooter, defender, helper, receiver and keeper use known event identities. Involved players are stronger; other players remain visible. Names, numbers and textual roles carry meaning beyond color.
19. **Arrows.** Retained the existing sparse pass/shot relationships from recorded coordinates. No invented drive/help trajectories or goal destinations.
20. **Moment browsing.** Scrollable chronological left list beside the selected story. Each row provides time, score, team and event/player headline. Full commentary is a separate disclosure.
21. **Filters.** Alla, Mål, Räddningar, Genombrott, Omställning, 7m and Försvar use actual event types, shot categories and phase. Empty unsupported categories are omitted.
22. **Players.** Dedicated dense home/away workspace: registered position, name, minutes, goals/shots, conversion, recorded errors, suspensions, energy and existing rating.
23. **Sorting.** Position by default; rating, goals, shots, minutes and energy available. Filtering creates a new collection; sorting never mutates match truth.
24. **Dossier.** Player selection opens compact local match detail, shot categories, discipline, energy and directly involved canonical moments. Its surface follows its contents instead of stretching to the table height. Live eligible players offer the existing substitution action.
25. **Keeper detail.** Saves/faced, save percentage, conceded goals and actual category breakdown. Denominator remains saves plus conceded goals; blocks and misses are excluded.
26. **Statistics.** Selected analysis areas: Match & positioner, Avslut, Målvakter, Matchutveckling. Only selected expensive analysis mounts.
27. **Shot map.** Exact team/player/outcome filters with explicit accessible labels. Larger labelled markers, Swedish tooltips, coordinate-gap counts, compact court and adjacent category summary. Category counts explicitly describe the filtered selection.
28. **Positions.** Compact positional strip from registered match-person positions. The caveat stays visible; this does not assert the role at the instant of each shot.
29. **Development.** Compact step chart of recorded goal difference, halftime guide, first-half score, largest observed lead and longest consecutive scoring run. No “momentum” or causality claims.
30. **Commentary.** Overview shows eight concise recent entries. Expanded commentary provides up to 60 events with time, team, score, headline and description; key events are stronger.
31. **Duplication.** Overview summarizes; moment previews identify events; the tactical view explains evidence; full commentary remains optional. Fulltime avoids repeating a latest-event headline above the report.
32. **Live behavior.** The same views update from the existing live reader. Speed, pause, next important event, substitutions, tactics and quick finish keep their existing production commands.
33. **Halftime.** Returns to Overview, presents actual clock/score, keeper facts, energy/discipline attention and existing manager decisions. The existing second-half command remains authoritative.
34. **Fulltime.** Returns to Overview and removes the coaching sidebar; review becomes primary. Report navigation and career continuation remain available.
35. **Manager decisions.** Coaching appears beside every active live view. The formation schematic is a closed disclosure below coaching, so it no longer precedes tactics, timeout and substitutions.
36. **Experimental 2D.** Retained at the bottom, closed and unmounted by default. No motion R&D or renderer polish.
37. **Archives.** Existing formats and decoder preserved. Missing positions show an explanation and available commentary/stats. Missing clock remains unknown. No metadata or archive format was added.
38. **Save/load.** Focused serialization proofs, offline archive round trips and actual browser saves/reloads passed. UI speed/view selections are local and need not persist; canonical match state does.
39. **Canonical proof.** [CANONICAL-PROOF.json](CANONICAL-PROOF.json): 26 completed season archives, 104 selected stories and 312 snapshots. Result identity, keeper denominators, serialized facts, exact coordinates and input hashes preserved. No season resimulation.
40. **Engine freeze.** All 566 baseline files remain byte-identical, including all tracked packages, career/save code, the Match Center model/control, ProductionMatchView and preserved user files. The 86 V2 core files remain unchanged. No match behavior or exposure bug needed modification.
41. **Standard desktop.** Chromium checks at 1366×768 and 1440×1080 cover all four views and detect no document-level horizontal overflow. Screenshot review completed. Overview height is about 995/984 px respectively; the smaller viewport needs a short content scroll.
42. **1920.** Chromium checks and screenshot review cover Overview, moments, court, players, keeper dossier, statistics and shot map at 1920×1080.
43. **Ultrawide.** All four views checked at 2560×1080 with no document-level horizontal overflow. Columns expand while court plots stay bounded.
44. **Browser QA.** Playwright's installed Chromium exercised a new normal career: live play, substitution, tactical instruction, timeout, save/reload, halftime, finish, archive review, filters, keyboard and reduced motion. Remaining review resumed from that browser's own completed career; live simulation was not repeated to resolve review assertions.
45. **Screenshots.** Curated evidence lives in [screenshots](screenshots). Raw additional widths and browser evidence remain locally under the ignored verification directory. Screenshots document automated QA, not user acceptance.
46. **Accessibility.** Native buttons/selects, roving tab focus, ArrowLeft/Right and Home/End, selected states, panel relationships, visible focus, skip link, labelled charts, text roles and reduced motion verified. No color-only tactical meaning.
47. **Performance.** Selective views avoid eagerly mounting every court/map/table. Across 26 archives, derived overview/preview/sort work averaged 0.184 ms per iteration (range 0.067–0.323 ms); this excludes projection and browser painting. Four browser click-to-frame samples verify that the requested view is selected; see [BROWSER-QA.json](BROWSER-QA.json). These are local samples, not an FPS guarantee.
48. **Focused tests.** 68/68 passed: existing canonical integration, save/load, archive, snapshot and command contracts plus workspace truth, sorting, filters, semantic rendering and unsupported-evidence cases.
49. **Full game.** 2,374/2,374 passed across all 217 canonical test files, once. Readers/domain: 2,211 cases; isolated filesystem/editor: 163. Final focused suite additionally verifies later presentation-only polish. No broad regression rerun.
50. **V2/core status.** Retained the completed Intelligence v1 core/game receipts and Match Center v2 deterministic full-match proof. Engine, command/control and archive source hashes are unchanged, so the expensive frozen engine cohorts were not rerun.
51. **Types.** Complete game typecheck, focused Match Center typecheck and production-build TypeScript passed. Other workspaces are unchanged and retain their earlier successful receipts.
52. **Build.** Isolated `.next-game-match-center-v21` production build passed, including TypeScript and all 48 static pages. The final server uses this output; 3014 remains available for comparison.
53. **Statistical drift.** Preserved and displayed truthfully. The browser example ended Torslanda 23–42 IFK Tumba, including Simon Larsson 4/46 saves. Post-Intelligence empirical reconciliation remains a separate future task.
54. **Limitations.** Human acceptance remains pending. Tactical depth is limited by existing events/frames; no unsupported help/recovery/space attribution is invented. Current event collections use bounded scrolling rather than virtualization. Tables may need horizontal scrolling within their own container at smaller widths. Motion-lab remains untouched.
55. **Local commits.** Implementation `9828830`; shot analysis polish `1269b3a`; canonical/browser QA closeout `bc833a9`; dossier readability `7652d79`; final receipt refresh. [VERIFICATION.json](VERIFICATION.json) records the source checkpoint and checks. All are local.
56. **Final git state.** Only the initial unrelated user state remains: modified `apps/game/app/match-qa/page.tsx`, `apps/game/lib/matchQa/qaHarness.ts`, `apps/game/scripts/season-audit.ts`; untracked `.claude/`, `apps/game/.tmp-final-benchmark.ts`, `docs/audit/`.
57. **Motion/stashes.** Motion worktree remains at `197d2a80ecea3b70efdcf8ef347cfc68e0e86b2b` with its existing untracked `.claude/`. Both WIP stash hashes remain unchanged; see preservation receipt.
58. **Push.** **NOTHING WAS PUSHED.**
59. **Exact start command**, from the primary repository:

    ```powershell
    $env:HM_NEXT_DIST_DIR='.next-game-match-center-v21'
    npm run start --workspace @handball-manager/game -- --port 3015 --hostname 127.0.0.1
    ```

60. **URL.** http://127.0.0.1:3015 — final local server available. Match Center v2 comparison: http://127.0.0.1:3014.
61. **Report path.** `C:/Users/helgi/Documents/STARKVIS-HELA/handball-manager/docs/match-center-v21/REPORT.md`.
62. **Human QA.** Open 3015. Play or open a completed normal match. Judge quick understanding in Översikt, useful explanations in Nyckelögonblick, easy player/keeper inspection, coherent Statistik and reachable live manager controls. No DevTools, JSON import or special QA save is required. **HUMAN QA PENDING.**
