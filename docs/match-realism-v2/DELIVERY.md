# HANDBALL MANAGER — MATCH ENGINE REALISM v2

Delivered locally on 9 October 2026. The canonical career V2 model, its persisted match truth, diagnostics, reproducible QA saves and browser acceptance are implemented. Game Experience v1.1 is preserved. **Statistical calibration is not achieved:** the final sample still scores too little, circulates too much, produces too few transition finishes and has excessive raw foul events against the existing engineering bands. These results are retained in full.

1. **Starting checkpoint.** `aedf868`, the completed Game Experience v1.1 acceptance checkpoint. Work resumed in place; no implementation reset or discarded changes.

2. **Git/worktree state.** Main working tree: `C:/Users/helgi/Documents/STARKVIS-HELA/handball-manager`, branch `main`. Implementation and evidence are local commits. The unrelated original dirty files remain dirty. Motion remains a separate donor worktree.

3. **Pre-existing engine work.** The exact twelve original ecology files were preserved in `39e1dae` before new behavior changes. Original binary diff/hash inventory remains in `.tmp/match-realism-v2/`. The three unrelated QA files were rechecked byte for byte. [Checkpoint inventory](CHECKPOINT.md).

4. **V2 architecture audit.** Normal career start, live advancement, commands, full-time result, bookkeeping, archive and replay share `productionMatch.ts` and the same CoreState. Fast simulation remains for background CPU fixtures. Motion and historical spatial helpers are donor/legacy context, not alternative player-match runtimes or engine switches. [Architecture and provenance audit](ENGINE_AUDIT.md).

5. **Largest problems found.** A displaced on-court goalkeeper was mistaken for an empty goal; passing safety used the wrong reach-margin sign; recycled intentions could fall through to shots; active movement retained stale relationships; drive tracking could overrun the handling budget; ready keepers were skipped by the availability gate. Pilots additionally exposed unreachable loose-ball claimants, forced keeper-outlet reset positions, a same-segment goal-area-exit/catch chronology bug, and M6 screens that never rolled into a receiving opportunity.

6. **Baseline sample.** Fifty complete independent real Allsvenskan career league fixtures, rotating actual clubs. Fixed save recipes, canonical numerical seeds, pinned actual squads/ratings, production frames and source fingerprints. This is an independent fixture sample, not a longitudinal season calibration.

7. **Baseline metrics.** Goals mean/median 81.24/82; possessions 180.30/180; shots 142.72/141; backcourt/standing 76.52%, wing 7.36%; losses without a shot 38.54; career turnover endings 41.62; saves 51.38; conventional save rate 38.62%; possession event span 19.99 s; transition shot share 19.54%; mean team top-scorer share 32.82%. There were 1,715 attempts beyond 15 m, scoring 455 goals. Complete distributions are in [METRICS.md](METRICS.md).

8. **Chosen model.** Trigger → intent → relational movement → actual defensive response → reachable affordance → continuation → physical execution/outcome. Decisions cannot award catches, goals, turnovers or defensive breaks. Physical contact, movement, actual flight and the referee remain authoritative.

9. **Possession lifecycle.** Possession switches clear incompatible old actions/receptions while retaining actual momentum and protected airborne/exchange actions. A drive resolves into its continuation. Loose-ball recovery uses a legal, physically reachable claimant and an executing RECEIVE; it never teleports ownership. Keeper throws become live at their actual area exit, including an exit and catch in the same physical segment.

10. **Attack decisions.** A selected recycle owns its read; receiving control takes skill/energy/tempo-dependent preparation. A real helper departure identifies the off-ball threat in the vacated space. Legal bounce preparation is admitted while it fits the actual remaining handling budget. Early transition progression gets a real ahead-runner/open-lane read before settled rebuilding.

11. **9 m/backcourt.** Interval/shoulder approaches respect remaining steps and time; active drives can release after actual engagement or a genuine handling constraint. Normal/constrained shots share a geometry contract and cannot treat a merely displaced keeper as absent. Far-court ordinary desperation releases disappeared from the final sample.

12. **M6/pivot.** An actual screen can complete into a short physical roll/presentation; a named feed ends incompatible screening/running before reception. A viable offer uses one timed safety gate. After securing a catch, the pivot can turn/fall or take a legal short approach into a better close window. Remote marking labels do not magically cover him. Final sample: 217 actual P/P2 attempts, 212 PIVOT-category attempts; pivot finishes occurred in 48/50 matches. Participation remains low in some matches.

13. **Wings.** Width/pinning/offering remains relational. Actual approach angle, pressure and finishing capability affect the chance; a closed corner is not granted a shot. Timed passing safety applies to wing feeds. Wing-category share nevertheless decreased to 5.34%, an explicit remaining weakness.

14. **6–0 defence.** Six spaces have stable owners, with absolute lateral coordinates at both ends. Active movement follows the current pass/relationship without continually restarting its lifecycle. Covering, screening, body position and actual missing players affect what the line can do.

15. **Pressure/help.** One primary pressure player and one helper are allocated. Help responds to real penetration. Adjacent spaces can hand over crossing attackers, and physical helper arrival can expose its vacated threat. Being assigned HELP alone never manufactures an advantage.

16. **Passing.** Release speed/aim uncertainty uses real passing/outlet ability, energy, range, pressure, receiver motion/separation, lane difficulty and urgency. Executed aim is not clamped back into a successful lane. The reach-margin sign now makes a larger defending hand less safe to pass past.

17. **Turnovers.** Contextual seeded throw scatter and difficult reachable catches can create out balls, interceptions, deflections and fumbles. A fumble leaves a physical contested ball; it does not award a turnover automatically. The ledger retains named loss causes and the separate career turnover-ending definition.

18. **Transitions.** Keeper outlets use current lawful body positions rather than returning receivers to prescribed depths. First-wave outlets, forward lanes and trailing support are read from actual position/capability. Only four transition shots and three transition goals occurred across the fifty final matches; structural support does not establish a satisfactory transition frequency.

19. **Defensive retreat.** One useful delaying defender can engage the actual ball-side threat while the others recover through their owned lanes. Incompatible old attacking movement is cleared at the turnover. Settling is a spatial/population claim, including reduced court population, not a possession-number pattern.

20. **Shot selection.** Range, available goal angle, directional pressure, block threat, real keeper presence and energy form a shared opportunity context. Decision quality is distinct from actual execution. Two retained very long attempts were protected horn direct free throws, not ordinary empty-goal decisions; one scored.

21. **Shot execution.** Placement/power/composure and energy affect actual aim and pace. Low/high selection is seeded and context-dependent. Height progresses toward the actual goal plane, including wide shots. This scoped model has no full vertical bounce integrator; a low trajectory has a floor bound and inaccurate high executions can miss above the goal.

22. **Goalkeepers.** Actual REACTION and OUTLET_PASSING feed separate capacities. Visible throwing preparation permits a ready stance without reading future aim. The ready action commits once after real release, preserving phase/action ID. Actual released seven-metre reading includes SEVEN_M_SAVES; ordinary reading/span is unchanged by that specialized attribute. Positioning, flight time/pace, explosiveness, range/height family, hand contact and fatigue retain physical influence. The final 52.71% conventional save rate is too high for the intended aggregate balance.

23. **Player attributes/provenance.** The bridge reads actual gameplay branch values. Missing attributes retain the profile's explicit neutral value and completeness provenance; CA/PA is not substituted for unobserved gameplay skills. Existing generated/locked/calibrated source tiers remain identifiable. A paired canonical test proves changing CA/PA alone cannot alter a missing sheet's capacities, while actual attributes affect movement and passing. Not every derived capacity has an independently implemented game behavior; the audit lists that boundary.

24. **Fatigue/energy.** ENDURANCE changes movement work cost; energy continuously affects movement and execution capacity. Catch/throw/shot and keeper reach use actual condition. Court time, distance and energy remain accumulated by the same chronology and are committed to the manager's career load exactly once.

25. **Tactical options.** QUICK/BALANCED changes actual read duration and progression; WIDTH/DIRECT/COMBINATION/BALANCED weights existing relational alternatives. Live commands preserve the match's tick/seed/history. These are preferences, not deterministic play scripts or score boosts. Unimplemented detailed plan sliders are not presented as newly implemented engine capabilities.

26. **Defence systems.** 5:1 has a real higher central point and lower supporting spaces, with different pressure/passing/retreat consequences. 6:0 retains its lower collective line. Normal formation dropdowns now expose the two executable formations; an unsupported legacy own plan is rejected before kickoff with a correction message. Legacy board layouts are preserved. No tactics scene was redesigned.

27. **Fouls/7 m/suspensions.** Existing physical contact, advantage, restart, sanction and official-clock rules remain authoritative. Failed feints no longer reset passive-idle judgment; an actual wrong-footed defender can. Four post-warning passes and existing exceptions remain. Mean 7 m attempts 2.86 and suspensions/disqualifications 3.20. Raw FOUL events rose to 96.10; many continued under advantage (40.86 pending, 38.46 realized, 2.40 recalled per match), so this is not a count of 96 stopped whistles. No separate whistle count was retained. Rules grounding: [IHF indoor rules, effective July 2025](https://www.ihf.info/sites/default/files/2025-07/09A%20-%20Rules%20of%20the%20Game_Indoor%20Handball_E.pdf). Existing broad numerical bands are engineering inferences, not precise Allsvenskan empirical targets; [EHF 2024 analysis](https://ehfeuro.eurohandball.com/men/2024/news/en/all-the-stats-stars-and-analysis-from-ehf-euro-2024/) is elite-context reference only.

28. **Seeded RNG.** Execution uncertainty and keeper reads use the persisted canonical RNG. No core Math.random turnover lottery, possession-index pattern, catch-up score system or scorer quota was added. Easy physical catches have no naked failure floor; protected dead-ball returns use exact execution and no scatter draws.

29. **Determinism.** Two independent full-match repeats matched all four hashes: initial session, complete final CoreState, derived result, and score/full events/RNG/all observed frames. Inputs, seed recipe, fixture and sampled source bytes also matched. [Exact repeat proof](after/repeat-proof.json). After sampling, unused imports and one documented compatibility-parameter lint directive were cleaned up; their emitted runtime JavaScript is byte-identical, recorded in [release source equivalence](release-source-equivalence.json).

30. **Trace/explainability.** Reasons retain actual intentions and defensive response. Pass/shot release facts add pressure, execution capability/error/energy, quality/block and selected height where relevant. Developer records retain actual causal windows and frames, possession endings and loss classes. All 4,180 final releases have same-tick shooter frames with zero release-origin errors. Controller checks are sampled, not a claim of every-tick production assertion.

31. **Archives/replay.** Archives include useful real pass/loss/rebound/settling/drive/advantage facts and optional behavior revision `career-realism-v2.1`. The compatible core schema literal remains unchanged. Old recorded frames remain historical truth. Replay decodes observed frames and never resimulates against changed squads, ratings or plans.

32. **Match 2D.** No visual redesign or alternative visualization engine. Existing Court draws observed canonical positions/ball; replay uses the same archived frame stream. Browser screenshots and timed SVG observations show actual moving bodies/ball, width and shifting/recovering lines. Sampling does not prove every desired handball episode occurs in every match.

33. **AFTER sample.** The same fifty fixture/seed recipes and pinned input snapshot; every match reached FULLTIME. No result was excluded. Source stayed fixed throughout the batch. [Final records](after/README.md).

34. **AFTER metrics.** Goals mean/median 34.08/34, p10–p90 26–43, range 18–50. Possessions 111.46/111 (102.8–121.1); attempts 83.60/82.5 (73.9–94.1). Backcourt/standing 63.86%, wing 5.34%, other categories 30.80%. Non-shot losses 28.46; career turnover endings 34.10; saves 38.00; conventional save rate 52.71%. Recorded possession span 32.44 s; completed passes/possession 8.43; transition shot share about 0.1%; top-scorer share 38.32%.

35. **BEFORE vs AFTER.** [METRICS.md](METRICS.md) contains mean, median, p10/p90 and full ranges for every supported measure and its denominator. The biggest physical improvement is the disappearance of ordinary far-court false-empty-goal attempts: beyond 15 m 1,715/7,136 → 2/4,180, with the two residual protected horn throws retained. Possessions/non-shot losses fell and close categories increased. Low scoring, wing usage, save balance, transition finishes, foul incidence and scorer concentration did not meet the desired balance.

36. **Remaining outliers.** Highest final total 50, Aranäs 22–28 IFK Ystad, seed 1765851951; lowest 18, 9–9, seed 1619981876 (index 18). Longest recorded attack 187.1 s, still undesirable, though not the first pilot's 1,702.8 s stranded phase. Against existing engineering bands, 43/50 are below 42 goals, 47/50 exceed 70 raw foul events, 47/50 are outside the backcourt-share band and all fifty fall below 2% transition shot share. All outlier records remain available.

37. **Human-QA matches.** Automatically selected without removing bad games: representative index 5, Torslanda 12–22 Kroppskultur, seed 1793243603; naturally closest index 16, Guif 19–19 Varberg, seed 3443931976; highest/unusual index 0, Aranäs 22–28 IFK Ystad, seed 1765851951. Six exact kickoff/completed save envelopes and the manifest are in [human-qa](human-qa/README.md), with four-hash equality verified before export. Inspect buildup, actual help/vacated space, M6 presentation, width, poor opportunities/recycling, recovery and goalkeeper timing; also observe the documented weaknesses.

38. **Browser QA.** Actual Chromium, normal player-facing production game. Primary match: preview/kickoff, 1×/4×/16× timed 2D sequences, coaching, admitted substitution, legal timeout, exact saved live-state reload, normal 64× progression to 30:00 halftime, explicit second half, full time/report/reload/replay and season/player-stat links. The live career cup fixture finished Torslanda 15–29 Tumba. Separate browser acceptance replayed all three selected actual league archives. Both tests passed with zero page errors. [Live receipt](browser/browser-receipt.json) and [three-match receipt](human-qa/browser/human-browser-receipt.json).

39. **Tactical-change proof.** Browser selected 5:1, QUICK and WIDTH, verified pressed states before/after reload and recorded canonical TACTICS_CHANGED. Focused source tests verify actual shape/read/action consequences. No tick/seed rewind or result replacement.

40. **Substitution proof.** Browser requested a real outgoing/incoming player, observed pending exchange and completed admission/actual Court identity. Canonical acceptance proves the physical exchange completed before result/archive bookkeeping. Court population invariants remain tested.

41. **Timeout proof.** Legal own-possession request; browser observed active timeout and disabled reuse. Canonical acceptance checks stopped official time, once-per-half eligibility and identical JSON continuation during an active timeout. Saved/reloaded tactical and timeout context persisted.

42. **Save/load proof.** Browser saved active match state, reloaded the normal route and compared exact persisted core SHA-256/RNG plus visible context. Headless acceptance independently finished original and reloaded states with equal results/archives. Existing storage separation keeps historical frames outside repeated career autosaves.

43. **Archive/replay proof.** Final score, actual goal facts, contributions and last frame agree. Archives survive changing present-day squads/ratings/plans. Export/replay proved exact frame round-trip and unchanged archive hash/results, with no live session created. The three selected archives stayed byte-identical after visible playback and seeking.

44. **Season-stat reconciliation.** Canonical league acceptance checks one table appearance, own player goals/shots/saves/appearances, team shot/save/7 m/suspension counts, energy/recent load, and idempotent finalization including a stale completed session. Browser visited persisted report, statistics and player match history. Full season-two longitudinal calibration was not added or claimed.

45. **Performance.** Canonical full simulation plus production frame capture: BEFORE mean/median 5.254/5.031 s, AFTER 4.317/3.373 s; AFTER p10–p90 3.137–4.738 s, range 2.796–19.904 s. Repeats under concurrent verification were slower. Machine load/warmup and concurrent checks differ; these are observational timings, not proof of an isolated speedup. Real normal-speed browser playback and full completion passed; FPS/Core Web Vitals were not measured.

46. **Focused tests.** 64/64 focused checks passed, covering attack/pressure/pivot/wing/restarts, execution, loose-ball reachability, passive judgment and legacy wing physical state. Canonical production acceptance 5/5 passed. The full V2 suite passed 175/175. Three old post-hoc aggregate quotas (eight passes/shot, ten pivot shots/seed, third reaction in every sample) were replaced with actual construction/finish/continued-advantage contracts. Their undesirable frequencies remain exposed in the fifty-match metrics rather than being forced by the model.

47. **Full game tests.** Final complete portable suite: 2,298 passed, zero failed, 435.25 s. Existing selected canonical suite remains the source of truth; no tests were omitted to mask a failure.

48. **Workspace typechecks.** All nine workspaces passed. Final application helpers/E2E specs also typechecked. Changed engine and new career/tooling files passed lint after the nonfunctional cleanup documented above.

49. **Production build.** `npm run build` in `apps/game`, Next webpack production build, passed into isolated `.next-game-realism-v2`; build ID `XkNsqFziP2f_j3IFTn3Vy`. It served the real browser acceptance at `127.0.0.1:3008`. Only that owned background server was stopped after QA; port 3008 has no remaining listener. Older game output directories were preserved.

50. **Meaningful limitations.** Final scoring/save balance is poor, wing usage and transition finishing are too rare, scorer concentration increased, raw ordinary fouls are excessive relative to the existing engineering bands, and long/many-pass attacks persist. These are not presented as calibration success. The model is scoped 2D physics with a limited height trajectory, inferred decision/execution coefficients and incomplete attribute/advanced-option consumption; no exact Allsvenskan empirical targets or comprehensive season-two/FPS validation were invented. Visual review covered real sampled sequences and complete UI lifecycle, not sixty real-time minutes of every seed.

51. **Local commits.** `39e1dae` preserve original ecology; `a35b647` pin fifty-match baseline; `2617bc1` physical engine decisions/relationships; `4ef68a1` actual career attributes/replay truth/supported formations; `e61e21f` continued-advantage regression contract. Final evidence, QA tools and lint-only equivalence are committed under `test(game): deliver matched realism evidence and browser acceptance` (delivery HEAD). No commits were pushed.

52. **Final git status.** Requested source/evidence is committed. Original dirty `apps/game/app/match-qa/page.tsx`, `apps/game/lib/matchQa/qaHarness.ts`, `apps/game/scripts/season-audit.ts` remain. Original untracked `.claude/`, `apps/game/.tmp-final-benchmark.ts`, `docs/audit/` remain. A clean working tree is not falsely claimed.

53. **Motion/stashes.** Motion remains at `197d2a8`, branch `motion-lab`, with its existing untracked `.claude/`. Stashes remain `ddba79055949b76898b12fc1b947e8f8645589cb` (M6 breakthrough screen) and `b068a9586209b9405b8d5f0dc6fae6384dd09001` (M6 line game). No stash pop/drop, donor writes or git auto-maintenance.

54. **NOTHING WAS PUSHED.** No git push, deployment or external publication was performed.

55. **Exact start command**, from repository root in PowerShell:

    ```powershell
    $env:HM_NEXT_DIST_DIR = '.next-game-realism-v2'
    npm run start --workspace=@handball-manager/game -- --port 3008 --hostname 127.0.0.1
    ```

56. **Exact URL.** `http://127.0.0.1:3008`. The QA server is intentionally stopped after acceptance; run the command above to serve the retained production build.

57. **HOW TO QA MATCH REALISM.** Start the retained build, create/load a normal career, reach Match Preview and start Match 2D. Watch 1×/4×/16×: the carrier attacks actual space, the line shifts, the helper leaves a threat, M6 checks/rolls and the next pass needs a physical catch. Change 6:0/5:1, tempo/orientation, request a bench substitution, take a legal timeout, save/reload while paused, resume halftime/second half, finish and compare report/player statistics with replay end. Repeat at 1920×1080 and 2560×1080; inspect lower sideline controls as well as the Court. For exact retained seeds follow [the six-save import instructions](human-qa/README.md), which seed only an isolated QA browser context. The same canonical path can reproduce any of the fifty recipes through the documented developer benchmark. Observe low scoring, long rebuilding and sparse transition finishes instead of assuming every match looks good.

Screenshots: normal flow under `browser/{1920,2560}/` (80 PNGs), and selected replay scenes under `human-qa/browser/match-{005,016,000}/{1920,2560}/` (66 PNGs). These capture the existing visual direction and actual new behavior; no new graphic assets or layout redesign were introduced.
