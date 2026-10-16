# Latest request coverage

This checklist maps all 80 topics in the October 16 continuation request to the retained 88-section [audit report](REPORT.md). The existing analysis and evidence are reused. A mapping establishes where the topic is answered; passing checks and delivery values must come from the actual receipts in those report sections. This checklist does not certify a pending process as complete.

Exact Torslanda 20-33 IFK Tumba possession, pass, Frikast and loss reconstruction remains unavailable. Cohort team-match means below describe 80 team-matches per league, not those two human-match teams. [HUMAN-QA.json](HUMAN-QA.json) retains the known totals and null forensic fields.

| Request | Topic | Existing report section(s) | Evidence or scope |
|---:|---|---|---|
| 1 | recovered HEAD | [1](REPORT.md#1-recovered-head) | Starting/current recovery HEAD; final commit identity is a separate closeout fact. |
| 2 | recovered task state | [2](REPORT.md#2-commits-after-2017385), [3](REPORT.md#3-recovered-uncommitted-work), [4](REPORT.md#4-interrupted-work) | October 16 state and stop point: 467 core, 9 V2 and 180 domain tests passed; progress-pointer lock occurred before game-suite launch. |
| 3 | work reused | [5](REPORT.md#5-completed-work-reused) | Completed source-matching cohorts, experiments and canonical proofs are reused. |
| 4 | unfinished work completed | [6](REPORT.md#6-remaining-work-completed) | Continuation scope and final completion receipts; no inference that unfinished checks already passed. |
| 5 | player attribute inventory | [7](REPORT.md#7-actual-player-attributes), [10](REPORT.md#10-attribute-coverage-matrix) | All 56 outcourt + 21 keeper attributes: [inventory](ATTRIBUTE-COVERAGE.md). |
| 6 | unused attributes | [8](REPORT.md#8-unused-attributes), [62](REPORT.md#62-weak-domains) | 21 outcourt + 8 keeper keys are unmapped; mapped-dead and gated keys are distinguished. |
| 7 | CA/PA/overall use | [9](REPORT.md#9-capaoverall-usage) | Canonical execution, normal/fallback selection and legacy routes are separated. |
| 8 | attribute coverage | [10](REPORT.md#10-attribute-coverage-matrix) | Full formulas, actual consumers, evidence and classifications: [coverage JSON](ATTRIBUTE-COVERAGE.json). |
| 9 | passing effect | [11](REPORT.md#11-passing-integration), [21](REPORT.md#21-technical-profile-comparison) | Difficult release precision, equal-physical technical comparison and limits. |
| 10 | reception effect | [12](REPORT.md#12-reception-integration), [21](REPORT.md#21-technical-profile-comparison) | Catch signals and finite non-monotonic realized failures remain explicit. |
| 11 | control effect | [13](REPORT.md#13-ball-control-integration), [44](REPORT.md#44-control-losses) | Dedicated dribble-control uncertainty is absent; reception/rules are separate. |
| 12 | shooting effect | [14](REPORT.md#14-shooting-integration), [21](REPORT.md#21-technical-profile-comparison), [22](REPORT.md#22-shooter-comparison) | Aim/spread, power, central outcomes and wing reversals. |
| 13 | defence effect | [15](REPORT.md#15-defence-integration), [23](REPORT.md#23-defender-comparison) | Duels, interception and containment/help geometry; player-specific switching gap. |
| 14 | keeper effect | [16](REPORT.md#16-keeper-integration), [24](REPORT.md#24-keeper-comparison) | Canonical keeper-flight response, reached saves and subtype gates. |
| 15 | physical effect | [17](REPORT.md#17-physical-integration) | Capacity/load/recovery effects; unchanged approved physical model. |
| 16 | decision effect | [18](REPORT.md#18-decision-integration) | Reaction/read timing changes; fixed-choice and cognition limits. |
| 17 | measured effect sizes | [19](REPORT.md#19-effect-sizes), [21](REPORT.md#21-technical-profile-comparison), [22](REPORT.md#22-shooter-comparison), [23](REPORT.md#23-defender-comparison), [24](REPORT.md#24-keeper-comparison), [25](REPORT.md#25-real-player-comparison) | Controlled and retained-roster examples: [sensitivity](ATTRIBUTE-SENSITIVITY.md). |
| 18 | specificity | [20](REPORT.md#20-specificity) | Related-attribute couplings and actual action scope. |
| 19 | player differentiation scorecard | [26](REPORT.md#26-player-differentiation-scorecard) | STRONG/ADEQUATE/WEAK/NONE/UNKNOWN with [scorecard evidence](DIFFERENTIATION-SCORECARD.md). |
| 20 | possession definition | [27](REPORT.md#27-possession-definition) | Played episodes, actual control, retained rebounds and same-team free throws. |
| 21 | reconstruction architecture | [28](REPORT.md#28-possession-reconstruction) | Independent reconstruction, raw-ID distinction, recall aliases and period splits. |
| 22 | Human-QA match economy | [30](REPORT.md#30-human-qa-match-reconstruction) | Exact match is UNAVAILABLE; supplied totals and limits are in [HUMAN-QA.json](HUMAN-QA.json). |
| 23 | possessions by team | [31](REPORT.md#31-torslanda-possessions), [32](REPORT.md#32-tumba-possessions), [52](REPORT.md#52-hbl-n40-economy), [53](REPORT.md#53-allsvenskan-n40-economy) | Exact human team possessions are unavailable. Cohort team-match means: HBL 68.775, Allsvenskan 68.4125; [team distributions](POSSESSION-ECONOMY.md). |
| 24 | free throws by team | [33](REPORT.md#33-torslanda-free-throws), [34](REPORT.md#34-tumba-free-throws), [35](REPORT.md#35-free-throwspossession) | Exact human Frikast is unavailable. Cohort team-match means: HBL 5.7875, Allsvenskan 6; [team distributions](POSSESSION-ECONOMY.md). |
| 25 | passes by team | [30](REPORT.md#30-human-qa-match-reconstruction), [38](REPORT.md#38-passespossession), [52](REPORT.md#52-hbl-n40-economy), [53](REPORT.md#53-allsvenskan-n40-economy) | Exact human passes are unavailable. Cohort team-match means: HBL 525.675, Allsvenskan 508.9; [team distributions](POSSESSION-ECONOMY.md). |
| 26 | field attempts | [37](REPORT.md#37-shotspossession), [52](REPORT.md#52-hbl-n40-economy), [53](REPORT.md#53-allsvenskan-n40-economy) | Ordinary field excludes 7m/GK: 3503 HBL, 3533 Allsvenskan attempts; means 87.575/88.325 per match. Exact human ordinary-field denominator is unavailable. |
| 27 | 7m | [37](REPORT.md#37-shotspossession), [52](REPORT.md#52-hbl-n40-economy), [53](REPORT.md#53-allsvenskan-n40-economy) | Separate 7m goals/attempts: HBL 224/281, Allsvenskan 226/309; human supplied 3/6 and 4/4. Independent episode flags are not extra endings. |
| 28 | possession duration | [39](REPORT.md#39-possession-duration) | Official-clock definition, full tails and NO_REFERENCE. |
| 29 | broad ball losses | [40](REPORT.md#40-broad-ball-losses) | Historical/current/independent totals and loss-per-episode denominator. |
| 30 | bad passes | [41](REPORT.md#41-bad-passes) | Terminal BAD_PASS_OUT differs from defensive deflections and all pass incidents. |
| 31 | interceptions | [42](REPORT.md#42-interceptions) | Counts, loss shares and per-release exposure. |
| 32 | reception errors | [43](REPORT.md#43-reception-failures) | Failed/(received+failed), retained fumbles and terminal drops. |
| 33 | control errors | [13](REPORT.md#13-ball-control-integration), [44](REPORT.md#44-control-losses) | Unsupported dribble specificity is not fabricated from unspecified recoveries. |
| 34 | offensive fouls | [45](REPORT.md#45-offensive-fouls) | No canonical offensive-foul producer; cohort zero is UNSUPPORTED coverage. |
| 35 | other losses | [46](REPORT.md#46-other-losses) | Rule/passive and residual categories retain exact meanings. |
| 36 | double-count result | [47](REPORT.md#47-double-counting-result), [48](REPORT.md#48-reboundretained-ball-semantics) | One terminal loss per attack; corrected false classification/provisional award, not three explanatory events summed. |
| 37 | free-throw chains | [36](REPORT.md#36-free-throw-chains) | Zero/one/two/three-plus counts and nonexclusive continuation histories. |
| 38 | free throws/possession | [35](REPORT.md#35-free-throwspossession) | 463/5502 HBL, 480/5473 Allsvenskan; NO_REFERENCE. |
| 39 | shots/possession | [37](REPORT.md#37-shotspossession) | Ordinary-field and all-attempt rates remain separate. |
| 40 | losses/possession | [40](REPORT.md#40-broad-ball-losses) | 1782/5502 HBL, 1670/5473 Allsvenskan. |
| 41 | fatigue contribution | [49](REPORT.md#49-fatigue-contribution) | Context denominators, sparse severe/acute samples and controlled comparison: [root cause](ROOT-CAUSE.md). |
| 42 | pressure contribution | [50](REPORT.md#50-pressure-contribution) | Receiver pressure rates with denominators; posthoc confounding. |
| 43 | difficulty contribution | [51](REPORT.md#51-difficulty-contribution) | Release difficulty action-ID join is not intrinsic catch difficulty. |
| 44 | HBL N40 | [52](REPORT.md#52-hbl-n40-economy) | 40 complete retained/reconciled reports, distributions and zero integrity anomalies. |
| 45 | Allsvenskan N40 | [53](REPORT.md#53-allsvenskan-n40-economy) | 40 complete retained reports, distributions and zero integrity anomalies. |
| 46 | empirical semantics | [54](REPORT.md#54-comparable-empirical-technical-error-subset-or-no-direct-comparison) | Official source, broad UI and narrow rule counts have different meanings. |
| 47 | comparable technical-error subset or NO DIRECT COMPARISON | [54](REPORT.md#54-comparable-empirical-technical-error-subset-or-no-direct-comparison) | NO_DIRECT_COMPARISON; execution candidates are not a validated official-equivalent subset. |
| 48 | root cause of 27/20 | [55](REPORT.md#55-root-cause-of-2720-broad-losses) | Exact 27/20 origins remain UNAVAILABLE. Cohort A-G findings: [ROOT-CAUSE.md](ROOT-CAUSE.md). |
| 49 | possession-volume conclusion | [56](REPORT.md#56-root-cause-of-apparent-attack-volume), [57](REPORT.md#57-whether-possession-volume-is-excessive) | Volume is measured; empirical excess is not established. |
| 50 | technical-error conclusion | [58](REPORT.md#58-whether-technical-error-probability-is-excessive) | Official-equivalent excessive error probability is not established. |
| 51 | interception conclusion | [59](REPORT.md#59-whether-interception-frequency-is-excessive) | Major contribution confirmed; empirical excess is not established. |
| 52 | fatigue conclusion | [60](REPORT.md#60-whether-fatigue-contribution-is-excessive) | No causal share from posthoc snapshots; frozen-phase chronology retained. |
| 53 | attribute-differentiation conclusion | [61](REPORT.md#61-whether-attributes-matter-enough), [62](REPORT.md#62-weak-domains), [63](REPORT.md#63-future-integration-needs) | Meaningful local effects coexist with missing/gated/dead domains. |
| 54 | Frikast UI decision | [64](REPORT.md#64-frikast-match-center-decisionresult) | Conditional canonical Frikast row; legacy/incomplete protocol unavailable. |
| 55 | Match Center truth | [65](REPORT.md#65-match-center-truth) | Canonical parity, archive/loaded facts and 12 key-moment positions per proof. |
| 56 | Intelligence regression | [66](REPORT.md#66-intelligence-regression) | Preserved intelligence sources/trajectories and final suite evidence. |
| 57 | Physical Load regression | [67](REPORT.md#67-physical-load-regression) | Preserved Physical Load v1.1 sources/trajectories and final suite evidence. |
| 58 | passive observer proof | [29](REPORT.md#29-observer-non-mutation) | Exact OFF/ON and post-analysis non-mutation: both canonical proof receipts. |
| 59 | preservation proof | [3](REPORT.md#3-recovered-uncommitted-work), [68](REPORT.md#68-anti-cheat-proof) | 39 original user-file hashes and bounded source exceptions: [SOURCE-PRESERVATION.json](SOURCE-PRESERVATION.json). Final delivery state belongs in sections 82-84. |
| 60 | anti-cheat | [68](REPORT.md#68-anti-cheat-proof) | No calibration, quotas, overall shortcut or altered canonical trajectories. |
| 61 | determinism | [69](REPORT.md#69-determinism) | Same-seed/control repeats and canonical full/resumed equality. |
| 62 | save/load | [70](REPORT.md#70-saveload) | Natural Frikast checkpoints; owner/restart/RNG/events/result exact continuation. |
| 63 | archive | [71](REPORT.md#71-archive) | Exact archive/commit proof; historical archive reconstruction limitations. |
| 64 | focused tests | [72](REPORT.md#72-focused-tests) | Final focused-test receipts are recorded in the mapped report section. |
| 65 | core/V2 | [73](REPORT.md#73-corev2-tests) | Reuse successful core/V2 receipts; final source-valid status in the mapped section. |
| 66 | full game regression | [74](REPORT.md#74-full-game-regression) | Final full-game/empirical receipts are recorded in the mapped section. |
| 67 | typechecks | [75](REPORT.md#75-typechecks) | Final workspace and diagnostic-script typecheck receipts. |
| 68 | production build | [76](REPORT.md#76-production-build) | Final isolated production build receipt; no completion inferred from target directory. |
| 69 | performance | [77](REPORT.md#77-performance) | Completed measurements: [PERFORMANCE.json](PERFORMANCE.json); short-run timing limits retained. |
| 70 | resource-safety summary | [78](REPORT.md#78-resource-safety-summary) | Sequential heavy-job history and reuse of valid completed work. |
| 71 | remaining limitations | [79](REPORT.md#79-remaining-limitations) | Unavailable human evidence, unsupported producers, sparse/gated effects and continuity tail. |
| 72 | evidence-based next task | [80](REPORT.md#80-evidence-based-next-task) | Only B is recommended on completed evidence; no new roadmap/calibration. |
| 73 | local commits | [81](REPORT.md#81-local-commits) | Actual local commit identities, excluding unrelated user state. |
| 74 | final git status | [82](REPORT.md#82-final-git-status) | Actual final status after local commits. |
| 75 | Motion/stashes | [83](REPORT.md#83-motionstash-status) | Preserved Motion worktree and two original stash identities. |
| 76 | confirmation NOTHING WAS PUSHED | [84](REPORT.md#84-explicit-confirmation-nothing-was-pushed) | Explicit final no-push confirmation. |
| 77 | exact start command | [85](REPORT.md#85-exact-start-command) | Exact command for the isolated build/server after delivery. |
| 78 | exact URL | [86](REPORT.md#86-exact-url) | Exact delivered local URL. |
| 79 | exact report path | [87](REPORT.md#87-exact-report-path) | Exact report location. |
| 80 | Human QA instructions | [88](REPORT.md#88-short-human-qa-instructions) | Focused normal-match, Frikast, loss, reload and archive checks. |

The complete [possession economy](POSSESSION-ECONOMY.md), [machine-readable evidence](ECONOMY.json), [attribute coverage](ATTRIBUTE-COVERAGE.md), [sensitivity](ATTRIBUTE-SENSITIVITY.md), [taxonomy](BALL-LOSS-TAXONOMY.md) and [A-G root cause](ROOT-CAUSE.md) supply the detailed numerators, denominators and limitations behind the concise report.
