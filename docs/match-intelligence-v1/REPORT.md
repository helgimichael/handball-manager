# Handball Intelligence Engine v1

Starting checkpoint: **939efd3**. Canonical V2 is retained. **HUMAN QA PENDING**. This report is the single closeout report; `comparison.json`, `controlled-scenarios.json` and `VERIFICATION.json` contain its supporting receipts. Engineering closeout checks are complete. Empirical acceptance remains qualified by the drift below; visual approval remains pending. Completed expensive receipts were reused after recovery, and no gameplay implementation was restarted.

## Recovery, failure and architecture — requested items 1–19

1. **Starting checkpoint.** Main started at `939efd38d442a41224d8dc8d08d3bcb4a948b33a`, following the five Motion Quality commits after `5569b59`.
2. **Preserved state.** The original modifications to `apps/game/app/match-qa/page.tsx`, `apps/game/lib/matchQa/qaHarness.ts` and `apps/game/scripts/season-audit.ts`, plus `.claude/`, `apps/game/.tmp-final-benchmark.ts` and `docs/audit/`, are excluded from task commits. File hashes, Motion HEAD and stash object IDs are recorded in the preservation receipts. Season outputs use an isolated directory.
3. **Old decisions.** `chooseCarrier` evaluated control read, special role finishes, handling constraints, transition progress, `readContinuation`, attack-entry choices and fallback passes in order. `releaseFromDrive` could terminate an approach as soon as its man was beaten. Each `startAction` replaced the existing motor `intent`; no persistent attacking purpose survived that replacement.
4. **Reproduced failure.** With a real goalkeeper present, the controlled free-to-goal fixture at ten-and-a-half metres has its primary defender behind it, forward momentum and a safe goal corridor. The retained old continuation scorer chooses `RECYCLE` to H04. Current canonical execution begins `DRIVE`, uses a legal bounce, then jumps and shoots. This is a technical reproduction of the reported decision failure, not a recreation of the user's exact career save or a visual approval.
5. **Free-player passing cause.** The scorer lacked a direct goalward affordance when the old interval search found no defender below eleven metres. It could still value a reachable reset. A beaten relationship also ended the motor approach, opening that scoring path again. Defensive reassignment could replace the beaten primary with the new helper and erase who the helper had left.
6. **Hesitation cause.** Tactical purpose ended with short motor actions; ordinary reconsideration could change the objective, and carrier hand preparation could brake an already compatible threat. Short lawful actions and physical collisions still exist, but they now execute a surviving tactical purpose.
7. **Perception.** `perceiveHandball` copies a whitelist of present ball/body positions, velocity, capability estimates, handling state, teammates, corridor geometry, pressure and current shot opportunity. It does not read RNG, committed shot aim, future defensive targets, contest results, future event outcomes or benchmark targets. `carrierRead` remembers observed primary/receiver-cover ownership before coordination rewrites responsibilities.
8. **Situations.** Explicit coexisting states cover no advantage, beaten primary, open lane, arriving help, 2v1/3v2, created line/wing receiver, unbalanced defence, shot window, transition advantage, manpower, pressure, created passing lane and lost advantage. Recognizing a numeric surplus alone does not require an early pass.
9. **Continuous advantage.** The transparent components are beaten margin, legal corridor clearance, estimated help arrival, carried momentum, local numbers and present shot potential. The level is NONE/SMALL/CLEAR/DECISIVE, with the component values retained alongside it. Receiver advantage is separately explained.
10. **Defender beaten.** `defenderRelation` projects the defender onto the carrier-to-goal direction and lateral shoulder. Forward loss or insufficient lateral containment with recovery slower than carried motion indicates the defender is beaten. This is not a fixed court-coordinate threshold or a permanent flag. The 0.65m physical beaten-leverage margin is shared with the existing duel contract; an executing targeted CONTACT within 0.95m retains containment. Remembered identity never overrides recovered geometry.
11. **Open lane.** A goalward approach is clipped outside the actual curved area. Defender body occupancy and goalward/lateral leverage determine clearance; the route need not be perfectly empty to the goal line. Keeper angle, lawful travel and momentum remain separate inputs.
12. **Help arrival.** Relevant next-layer bodies are compared by current position, observed closing velocity and V2's capability/fatigue/reaction-based arrival estimate. Physical engagement is distinct from a nominal HELP assignment. The former can break attacking commitment and create a receiver.
13. **Numbers.** Court manpower counts actual on-court bodies, including a planned substitution exit until the canonical population changes. Court manpower and bounded local goalward/support relationships are exposed separately. A useful forward receiver is required for the new overload attack affordance. This avoids treating an unrelated trailing player as an automatic bind/pass play.
14. **Affordances.** The layer generates context-valid goalward drive/gap/next-defender actions, lawful dribble continuation, present-window shot, line/wing/backcourt pass, reversal/recycle and transition continuation. It leaves established no-advantage combinations, role-specific pivot turns and special restart execution with their existing V2 authorities. It does not script a possession sequence.
15. **Scoring.** Every generated candidate retains immediate advantage, continuation, actual capability, tactical preference, risk and commitment components. A sideways/reset pass carries an explicit cost while the carrier retains a strong personal threat; created receiver advantage and actual cover commitment increase bind/pass value. No shot-share, scorer-share or empirical quota participates.
16. **Intent.** Optional persisted `handballIntent` sits above the retained motor `intent` and `CoreAction`. Carrier purposes include exploit advantage, attack gap, attack next defender, bind help, prepare shot and recycle. Off-ball support and defensive contain/help/recover/retreat have their own purposes. IDs and starting ticks survive compatible actions.
17. **Commitment.** Initial strength reflects advantage, momentum and composure. Continuation depends on the tactical relationship remaining valid, rather than simply waiting out a fixed timer. Ordinary ticks can refresh a lawful target without issuing a new action.
18. **Breaks.** Changed ball control, lawful release requirements, committed help, occupied corridor, recovered containment, a preferable shot window or a materially better alternative can end commitment. Airborne release, contact, goalkeeper flight and restart contracts retain their existing authority. A new decision tick is not a break condition.
19. **Hysteresis.** A different alternative must exceed the surviving intent by `0.12 + 0.10 × commitment`. Existing intent also contributes an explained scoring component. This threshold is bypassed by actual hard breaks; it does not conceal a closed lane or delay a required release.

## Attacking and defensive behavior — requested items 20–40

20. **Free carrier.** Own goalward threat wins over a lateral recycle in the controlled acceptance suite. This favors continuation rather than forcing an immediate shot.
21. **Next defender.** A nearby next-layer helper creates ATTACK_NEXT_DEFENDER, with that defender named as the relationship and the legal goal corridor as the execution target.
22. **Bind and pass.** A receiver is considered created after its observed cover engages the carrier or physically compresses away while no other body supplies close cover. BIND_AND_PASS rises after that evidence, not merely from a receiver being wide or visible.
23. **2v1.** The canonical controlled case attacks first, then releases its receiver after engagement. In a numeric overload the one defender can be read as the receiver's relational cover once it physically commits, even without a nominal man-marking assignment.
24. **3v2.** The controlled case keeps its direct advantage, carries through and finishes. There is no fixed three-player passing order. Defender occupancy and receiver creation still decide whether to pass.
25. **M6.** The existing `pivotOffer` lane/readiness contract remains mandatory. Saved cover ownership distinguishes a line player left by actual help from a merely visible pivot. The evolving scenario drives at tick 21 and passes after helper commitment at tick 29.
26. **Wing.** Compression/displacement of the wing's cover creates receiver advantage, subject to actual separation, passing time and shooting angle. Width alone retains its opportunity cost.
27. **Backcourt.** Existing player-led entries and support remain. V9/M9/H9 can receive, retain a threat, attack a shoulder, carry beyond the first defender, force help and then finish or pass. There is no CB preference or position-share feedback.
28. **No advantage.** Existing circulation, width restoration, combinations, screens and controlled threats are retained. Recycle remains a valid affordance. A no-advantage attack can choose to create a new threat; no rule requires every such possession to pass immediately.
29. **Defensive intelligence.** Explicit defensive readings cover primary threat, beaten teammate, help required/already supplied, handoff, recovery, clear danger, released M6/wing, numbers and transition danger. Their observations and actual selected duty can be inspected in a developer trace.
30. **Help.** Losing physical containment can hand primary ownership to the appropriate neighboring space even if a duel timer has expired. Pressure/help/cover still come from the existing zonal allocation; the patch does not add nearest-player chasing.
31. **Handoff.** Existing neighboring-space crossing handoffs remain, with ownership-based target IDs and HANDOVER_COMPLETED events. Observed carrier memory survives these changes, so the attack can reason about the defender just beaten.
32. **Recovery.** The passed primary receives RECOVER rather than retaining nominal containment. Existing recovery routes regain legal goal-side structure. When duties change, the defensive tactical purpose changes with them; helpers are not permanently locked onto a former carrier.
33. **6:0.** Unique zone ownership, one primary, at most one help and at most one cover remain enforced. Own pivot threat continues to outrank optional double pressure. Line shift, engaged zone and compactness remain shared unit context.
34. **5:1.** The forward defender and rear-five ownership rules remain separate from 6:0. Existing system-specific posts and pressure eligibility are preserved and checked by the retained defensive tests and final regressions.
35. **Reaction.** V2's reaction, anticipation, covering and movement-reading capacities remain. Arrival estimates include those capacities. Players do not consult teammates' future decisions or receive invented random visual delays.
36. **Cadence.** V2 continues at 50ms. A carrier may perceive a changed physical relationship during an executing drive, while tactical identity survives ordinary reconsideration. Diagnostic continuation samples are taken every ten ticks or on meaningful decisions; this diagnostic sampling is not a gameplay delay.
37. **Decision while moving.** Executing drives can keep their existing action/phase/velocity or legally release into a pass/shot when evidence changes. Compatible tactical drive/dribble hand preparation and receipt/HOLD reading can carry existing momentum; they cannot accelerate before readiness or bypass steps/bounce rules. A free dribbler retains its goalward target until material change; gathering a previously known threat does not repeat the catch-read budget.
38. **Motion integration.** Motion Quality's braking, velocity steering, body routes, receiving approach, retreat route, reaction reads and legal movement remain. The change feeds purpose into that machinery. No renderer or replay interpolation was retuned.
39. **Capabilities.** Decision, anticipation, composure, passing, handling, shooting/finishing, breakthrough, velocity, reaction and fatigue affect the visible estimates and values. Low and high readers both preserve an obvious goal lane; their timing and risk components differ. No raw CA/PA is consumed.
40. **Tactics.** DIRECT favors valid personal threats, COMBINATION favors created bind/pass, WIDTH favors a legitimately released wing, and QUICK favors existing transition opportunity. These preferences are small enough to preserve an obvious personal lane.

## Trace, controlled proofs and regression — requested items 41–65

41. **Decision trace.** Developer opt-in uses a WeakMap outside canonical state, with bounded attack and defence rings. IDs combine possession/player/tick; timestamps are canonical. Perception, situations, advantage components, candidate values, prior intent, commitment, selected motor, receiver, actual action ID and break reason are stored. A fallback trace explicitly records the actual existing V2 reason and does not claim a hypothetical top candidate executed.
42. **Why did he pass?** `whyDidPlayerAct` queries player/possession/motor; `whyDidDefenderHelp` queries defensive intent and observed unit situation. The evolving M6 example reads PRIMARY_DEFENDER_BEATEN, then HELP_COMMITTED plus FREE_M6; its actual motor changes from DRIVE to PASS with `created=true; coverCommitted=true`. Complete component values are in `controlled-scenarios.json`. The final full-match sample at simulation 58:28.500 (HBL index 0) shows RB Fabian Gudmundsson retaining ATTACK_GAP (commitment 0.731), then actual help at 0.968m creating the pass to Adam Tysk: HELP_COMMITTED, BIND_AND_PASS value 0.976 versus SWITCH_SIDE 0.256 and SHOOT 0.141. It is reproduced by query-handball-decision.ts --file ../../docs/match-intelligence-v1/delivery/hbl/intelligence-000.json --action action-202769. Disabled and enabled tracing produce identical canonical states and RNG.
43. **A–J scenarios.** Stored actual action sequences cover free goal lane, committed M6 help, help staying home, bind-before-pass 2v1, preserved 3v2 advantage, created wing, false lateral openness, an initially contained/no-advantage attack, defensive help and recovery. Synthetic cases are explicit geometric fixtures. The dynamic help case injects a physical arrival after eight real ticks; it never injects an outcome or a defender's future target. These are controlled engine proofs, not a substitute for normal-career visual observation.

| Controlled scenario | Actual carrier action starts in 150 ticks |
|---|---|
| A_FREE_TO_GOAL | DRIVE → DRIBBLE → JUMP → SHOOT |
| B_HELP_M6 | PASS → RUN → RECEIVE |
| C_HELP_STAYS | DRIVE → DRIBBLE → JUMP → SHOOT |
| D_TWO_V_ONE | DRIVE → DRIVE → PASS → RUN → RECEIVE |
| E_THREE_V_TWO | DRIVE → DRIBBLE → JUMP → SHOOT |
| F_WING_CREATED | PASS → RUN → RECEIVE |
| G_FALSE_FREE | DRIVE → DRIBBLE → JUMP → SHOOT |
| H_NO_ADVANTAGE | DRIVE → DRIBBLE → HOLD → DRIVE → JUMP → SHOOT → LAND → RUN |
| I_DEFENSIVE_HELP | PASS → RUN → RECEIVE |
| J_RECOVERY | PASS → RUN → RECEIVE |

B/F/I/J start with the relevant defensive commitment already physically present. G is initially contained despite apparent lateral space; its legacy controlled drive is not a free-lane intelligence endorsement. H begins without advantage and can create a later threat. RUN/RECEIVE/LAND show normal continuation after release, not forced possession outcomes. Defensive duties and the evolving help trace are retained in controlled-scenarios.json.

44. **Free-carrier release blocker.** Across 20 seeds in each attack direction, 40/40 actual executions begin by carrying the threat, 0/40 pass sideways, and 40/40 reach a shot action. There is a real goalkeeper in these fixtures. Scoring the shot is neither asserted nor forced.
45. **Intelligence metrics.** Final match cohorts record beaten possessions, own-threat continuation, arrived help, shot/jump selection, advantageous pass selection, recycle with retained advantage, bind/pass count, estimated pass advantage increase/decrease and sampled intent changes. Definitions and distributions are in `comparison.json`. These are observations of selected motor/intent and current physical relationships, not counts of completed pass deliveries, scored finishes or causal outcome conversions. Fractions use the observed beaten-possession set and can overlap; the pass counters count observations and need not equal unique released passes. They have no universal empirical acceptance bands.

| Diagnostic mean per match | HBL N40 | Allsvenskan N40 |
|---|---:|---:|
| Decision observations / match | 3343.95 | 3321.00 |
| Intent changes / match | 1429.67 | 1456.83 |
| Closed sampled intent duration (s) | 1.72 | 1.71 |
| Rapid drive/pass oscillations / match | 0.82 | 0.95 |
| Possessions with observed beaten primary | 95.60 | 95.22 |
| Own-threat motor selected in beaten possessions | 50.30% | 50.93% |
| Committed help observed in beaten possessions | 42.65% | 42.12% |
| Shot/jump selected while primary beaten | 67.59% | 68.96% |
| Bind/pass selected while primary beaten | 13.13% | 13.11% |
| Non-bind pass with free-carrier estimate | 1.66% | 1.72% |
| Created receiver + committed help pass observations | 105.28 | 100.13 |
| Pass observations raising estimated advantage | 548.13 | 545.85 |
| Pass observations lowering estimated advantage | 184.85 | 195.10 |

46. **Intent duration.** Closed sampled carrier-intent episodes are measured in seconds. Intervals after a pass/shot and off-ball waiting are excluded from duration; open end-of-match episodes are not assigned invented completion times.
47. **Oscillation.** A drive/pass/drive pattern qualifies only when sampled reversals are within 500ms in the same possession. A later return reception is not automatically classified as hesitation. Motor action lifecycle counts are separate from tactical intent changes.
48. **Pass advantage.** The report retains both increasing and decreasing pass estimates. Receiver and carrier advantage represent different contexts, so their difference is a diagnostic proxy, not a universal expected-goal or pass-error label.
49. **HBL regression.** HBL retains the original reference files and observation-unit definitions. The first twenty are exact recipe pairs; final forty include twenty fresh seeds. Historical means are descriptive prior-season comparisons, not an automatic same-season acceptance certificate.

| Metric | Motion N20 | Same pairs N20 | Final N40 | Historical 2025/26 |
|---|---:|---:|---:|---:|
| Goals / match | 65.75 | 72.10 | 71.78 | 60.86 |
| Outfield attempts / match | 100.45 | 113.30 | 112.50 | 97.89 |
| Outfield conversion | 65.38% | 63.71% | 63.89% | 61.98% |
| 7m attempts / match | 3.55 | 3.50 | 3.65 | 6.58 |
| Suspensions / match | 3.50 | 2.65 | 2.60 | 4.80 |
| Keeper save rate | 23.92% | 25.53% | 24.39% | 28.57% |
| Top scorer share / team | 30.12% | 28.35% | 27.75% | 25.02% |
| Top shooter share / team | 26.87% | 23.52% | 23.68% | 23.73% |

50. **Allsvenskan regression.** Both final cohorts contain 40 complete canonical career matches: first 20 are exact retained Motion Quality input/seed/fixture pairs; indices 20–39 are fresh seeds using the same retained input universe. References retain their original competition, observation-unit and denominator policies.

| Metric | Motion N20 | Same pairs N20 | Final N40 | Historical 2025/26 |
|---|---:|---:|---:|---:|
| Goals / match | 60.10 | 66.65 | 66.78 | 61.62 |
| Outfield attempts / match | 93.75 | 102.80 | 105.95 | No reference |
| Outfield conversion | 64.11% | 64.78% | 63.20% | No reference |
| 7m attempts / match | 4.05 | 4.30 | 4.25 | 7.12 |
| Suspensions / match | 3.95 | 3.90 | 4.53 | 5.77 |
| Keeper save rate | 23.66% | 22.96% | 24.89% | 28.57% (HBL proxy) |
| Top scorer share / team | 28.75% | 29.94% | 28.47% | 24.52% |
| Top shooter share / team | 25.19% | 24.52% | 23.90% | No reference |

Allsvenskan goalkeeper interpretation still uses the explicitly labeled HBL proxy.
51. **Extreme tails.** HBL: goals 53–88, p95 83.05; match conversion 50.79%–76.52%, p95 73.24%; keeper-match saves 7.84%–41.86%. Allsvenskan: goals 43–79, p95 77.00; match conversion 48.18%–77.00%, p95 73.10%; keeper-match saves 2.44%–48.94%. No final match exceeds 80% conversion. Higher final goal volume is an acceptance risk, especially HBL; tails are not hidden. Tail observations remain visible. No goalkeeper/conversion coefficient, result forcing, score quota or benchmark-dependent decision was introduced to hide them.
52. **Motion regression.** All four paired samples retain zero recorded overlaps. Abrupt reversals remain small; target churn increases in every pair and HBL acceleration spikes increase. Synchronized retarget/acceleration also increase in these samples. These results do not justify claiming motion regression-free.

| Paired fixture | Live ticks | Abrupt reversals | Acceleration spikes | Target churn | Near collisions |
|---|---:|---:|---:|---:|---:|
| HBL 0 | 58386 → 57631 | 4 → 3 | 51819 → 53882 | 45217 → 52326 | 5098 → 4480 |
| HBL 1 | 58691 → 58075 | 2 → 5 | 52182 → 54136 | 45923 → 52244 | 5216 → 4375 |
| Allsvenskan 0 | 60024 → 56801 | 6 → 0 | 52874 → 52019 | 46708 → 49085 | 5571 → 4543 |
| Allsvenskan 1 | 59080 → 56962 | 3 → 2 | 51178 → 52037 | 44614 → 45836 | 4919 → 4522 |

Recorded motion counts compare the same two fixture recipes, with live exposure reported separately because intelligence changes the actual trajectory. They are engineering observations and do not certify visual quality.
53. **Tactics regression.** Focused tests assert preference sensitivity and preservation of the free lane under BALANCED/DIRECT/WIDTH/COMBINATION. Existing core identity/coaching tests also examine actual downstream tactic differences and 6:0/5:1 behavior. No claims of population-level tactical superiority follow from those tests.
54. **Capability regression.** The same physical free-lane picture is tested with low/high decision/anticipation/composure and different breakthrough capacity. Existing identity and keeper/shooter duel regressions remain. Obvious goal opportunities are not randomly discarded to simulate a weak reader.
55. **Fatigue regression.** Reduced energy changes risk and V2 reach/movement capacity, but the controlled tired carrier still understands an obvious lane. Existing Motion Quality fatigue travel contracts remain.
56. **Determinism.** Seeded canonical states, event/RNG truth and movement are compared by focused tests and complete observer/no-observer career session hashes in both cohorts. Diagnostic enablement does not consume RNG or canonical event IDs.
57. **Save/load.** Optional tactical intent and observed ownership persist in the same canonical player state. Core save/load tests and both full-match mid-career JSON resume proofs compare identical final sessions, RNG, results and trajectories. Saves without the new optional fields continue through the existing format/version contract.
58. **Archive/replay.** Existing archive format 1/2, encoded observed frames and immutable completed-match replay remain. Intelligence is executed only during simulation. Old completed archives do not require decision traces or resimulation. Full-match proof hashes include canonical frames; game tests cover archive codec and replay round trips.
59. **Career/season.** The completed isolated proof plays 26 manager matches, persists 27 archives, renews contracts, survives the offseason/calendar rollover and completes a season-two V2 match (33–44) in 2027/28. The next calendar has 182 fixtures. The result and large local end-state remain in delivery-season. Match commands, halftime, timeout, substitutions, archived result and exactly-once career commit remain on canonical V2.
60. **Focused tests.** 61 intelligence tests pass, including actual canonical free-carrier, evolving ownership/M6 and 2v1 execution. The free-carrier acceptance case covers forty seeded runs inside that suite.
61. **Core/V2 tests.** The complete core run finished 304 cases: 302 passed and two old transition assertions failed. Those assertions required passing despite an open personal lane, and an immediate bounce despite unused legal steps. The corrected attack-realism file passes 26/26, including an actually contained carrier releasing its free first-wave runner. Thus all 304 unique core cases are covered by the completed run plus scoped rerun; the expensive full suite was not restarted. Retained unchanged engine/domain suite: 180/180; V2 protocol suite: 9/9; simulation/contract/integration/tactics workspaces: 112/112. The original failure receipt remains hashed.
62. **Full game regression.** The completed full game run passed 2,306/2,306 in 2,820.28 seconds using HM_GAME_TEST_CONCURRENCY=1. It began during the implementation sequence; the final-source targeted canonical career, tactical, live-session, empirical, archive and playback suite separately passed 90/90 in 219.70 seconds. The serial runner isolates shared Windows editor fixture writes; earlier concurrent EPERM rename failures are retained as infrastructure receipts, not converted into passing assertions.
63. **Typechecks.** All nine workspace typechecks passed. Benchmark/report/query types passed, including a closeout check after the report update; the engine typecheck also passed after the two transition test corrections. PowerShell logs wrap npm stderr notices in NativeCommandError text; the commands exited zero and contain no TypeScript diagnostics.
64. **Production build.** The final-source Next.js webpack production build passed compilation, TypeScript and all 48 static-page generations. The isolated server is running on 127.0.0.1:3013; HTTP / and /new-game both returned 200. The isolated output is `apps/game/.next-game-intelligence-v1`.
65. **Performance.** Completed instrumented forty-match batches took 20.36 minutes HBL and 19.97 minutes Allsvenskan. Mean simulation costs were 24.29s and 24.06s; mean offline analysis 3.20s/2.87s and observer 1.09s/1.06s. Index-zero observer-disabled full-match runs took 37.12s/36.12s. Batches overlapped expensive regression work, so these are measured costs, not isolated before/after CPU guarantees. Candidate enumeration is bounded to the few relevant bodies and receivers; there is no combinatorial play search. Diagnostic traces and reports are opt-in; regular gameplay has no benchmark observer. These timings are simulation/analysis costs and are not browser FPS measurements.

## Delivery and limitations — requested items 66–77

66. **Browser QA.** The available computer-use browser/app inventory was empty. Normal-career 1× visual observation could not be performed here. **HUMAN QA PENDING**, with the final visual/behavioral verdict belonging to the user.
67. **Intelligence limits.** Perception uses visible physical geometry and existing reaction estimates, without body-facing/visual-occlusion modeling because the engine has no such canonical facing contract. The existing no-advantage entry/role policies remain alongside the new advantage layer. Synthetic cases and estimate components do not prove every real 2v1/3v2, handoff or receiving relationship is handled perfectly. Defensive recovery remains zonal rather than a new general negotiation system.
68. **Motion limits.** Numbered-dot presentation, constrained legal-step transitions, body contact, simplified lateral steering and support target updates remain. Compatible momentum is improved at the intent boundary, but this report cannot claim that the previous artificial appearance is visually resolved.
69. **Empirical limits.** Better continuation changes chance locations, pressure, possessions and goalkeeper exposure. Final shifts and tails are reported rather than coefficient-corrected. Against historical HBL 60.86 goals/97.89 attempts and Allsvenskan 61.62 goals, final means are elevated. HBL 7m/suspensions (3.65/2.60) remain below historical 6.58/4.80; Allsvenskan 4.25/4.53 remain below 7.12/5.77. HBL keeper save mean 24.39% remains below historical keeper-match 28.57%; Allsvenskan 24.89% is compared only with the labeled HBL proxy. M9 pooled goal share increases 14.37%→23.72% HBL and 17.47%→25.42% Allsvenskan; shot shares increase 12.74%→19.36% and 15.04%→19.89%. The historical HBL M9 season aggregate (18.97%) is a different observation unit. Automated reference coverage remains sparse (HBL 631/12,587 and Allsvenskan 893/12,581 rows have references) under the inherited identity/season policy; missing categories are not fabricated. Overall empirical preservation is not certified as passed. Penalty/suspension underrepresentation and the previously broad conversion/keeper tails remain relevant acceptance risks. Allsvenskan keeper/position proxies remain explicit.
70. **Local commits.** `d83ec18` implements canonical perception, observed ownership, intent, commitment and integration. `01d0834` adds focused scenarios, test registration and developer tooling. The subsequent causal commits and closeout tooling are:

- `2b98b08` fix(engine): bind real containment before releasing committed threats
- `aa2f029` feat(engine): carry threat through receipt reading and transition dribble
- `e631173` fix(engine): reuse the tactical read after gathering a known threat
- `c0bbb45` fix(engine): recognize beaten leverage after physical containment is lost
- `c25e606` fix(engine): honor closed lanes and actual committed help
- `cef2938` fix(engine): perceive current court bodies before planned exits
- `d4db28c` fix(engine): keep tactical manpower aligned with canonical court population
- `1f5f557` test(engine): close intelligence transition regressions and evidence tooling

The final documentation receipt commit follows this captured tooling HEAD and is identifiable by its local commit message; its own hash is not embedded in its contents.
71. **Final tree.** Only original user modifications/untracked content remain after the local closeout commits: modified match-qa/page.tsx, matchQa/qaHarness.ts and season-audit.ts; untracked .claude/, .tmp-final-benchmark.ts and docs/audit/. Original file hashes match. Local generated build, logs, traces and intermediate benchmark artifacts remain preserved under existing ignore rules. Task-owned files are locally committed; pre-existing user files remain unstaged.
72. **Motion/stashes.** Motion worktree remains `C:/Users/helgi/Documents/STARKVIS-HELA/handball-motion-lab` at `197d2a8`. Both original motion-lab M6 stashes retain their object IDs and descriptions.
73. **Push status.** **NOTHING WAS PUSHED.** No push, remote publish, merge or stash/worktree cleanup was performed.
74. **Exact start command, from repository root:**

```powershell
$env:HM_NEXT_DIST_DIR='.next-game-intelligence-v1'
npm run start --workspace @handball-manager/game -- --port 3013 --hostname 127.0.0.1
```

75. **Exact URL:** `http://127.0.0.1:3013`.
76. **Report path:** `C:/Users/helgi/Documents/STARKVIS-HELA/handball-manager/docs/match-intelligence-v1/REPORT.md`.
77. **Human QA:** Open the URL, create a normal career and play a match at **1×**. Watch for a carrier beating his defender and continuing himself; a carrier forcing help then passing; a 2v1 attacking its defender before passing; and defence helping then recovering as a chain. Use normal game controls. Also watch a moving catch/read and a free dribbler approaching goal without stopping to repeat the read. No imported save, console snippet, JSON or DevTools is required. Technical proof does not mark this Human-QA approved.
