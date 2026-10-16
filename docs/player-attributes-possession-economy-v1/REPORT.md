# Player Attributes & Possession Economy Audit v1

Relevant technical and physical attributes affect actual execution, but schema integration remains uneven. Corrected matched cohorts show 44.550 HBL and 41.750 Allsvenskan broad losses per match; these are broad terminal losses, not official technical errors. The exact human 27/20 match remains unavailable. The evidence supports a dedicated attribute-integration phase without broad calibration.

Main evidence: [complete attribute inventory](ATTRIBUTE-COVERAGE.md); [differentiation scorecard](DIFFERENTIATION-SCORECARD.md); [controlled sensitivity](ATTRIBUTE-SENSITIVITY.md); [possession economy](POSSESSION-ECONOMY.md); [root-cause classification](ROOT-CAUSE.md); [ball-loss taxonomy](BALL-LOSS-TAXONOMY.md); [Human-QA availability](HUMAN-QA.json).

The [80-topic request checklist](REQUEST-COVERAGE.md) maps the October 16 continuation request to the retained report sections and supporting evidence. Existing completed analysis is reused rather than renumbered or repeated.

## 1. recovered HEAD

The October 16 recovery found HEAD `20173857cf2d449ad716ecc19d58ded8ed210d93` (2017385), the completed Physical Load & Fatigue v1.1 closeout. This is the original task checkpoint and remained the current HEAD at recovery; no reset to it occurred. Final local commit identities belong in section 81.

## 2. commits after 2017385

At the October 16 recovery there were no commits after 2017385 and no staged changes. Completed task work remained uncommitted and was recovered in place. Final local commits belong in section 81 rather than being inferred from an earlier progress message.

## 3. recovered uncommitted work

The original unrelated state was six status entries covering 39 preserved file hashes: match-qa/page.tsx, qaHarness.ts, season-audit.ts, .claude/, .tmp-final-benchmark.ts and docs/audit/. All 39 hashes still matched at the October 16 inspection. Task-owned analysis, readers, presentation changes, tests, reports and verification helpers were retained separately. No reset/stash/restore was used to erase that state.

## 4. interrupted work

The earlier interruption occurred during the HBL cohort; that cohort finished successfully while the session was unavailable and was reused. By the latest October 16 recovery, both N40 cohorts, corrected sensitivity, economy aggregation, canonical proofs and this report draft were already complete on disk. The sequential check runner had passed core (467 tests), V2 (9 tests) and domain (180 tests), each with exit 0, then stopped before launching the full game suite because the progress file `.tmp/economy-current.txt` was temporarily locked. That pointer-file failure was not a failing game test. The runner was resumed from `game-final`, reusing those three successful receipts.

The corrected canonical-shot harness supersedes development-only direct keeper movement that omitted released-shot re-aiming; the invalid interpretation was not retained.

## 5. completed work reused

Reused approved Physical v1.1 recipe/input snapshots, both matched production cohorts, the 77-attribute inventory, corrected sensitivity receipt, economy/root-cause reports and completed pure-reader/presentation work. Original raw reports/manifests remain preserved; HBL reanalysis derives corrected readers from unchanged stored cores. At October 16 recovery, all 13 sensitivity source fingerprints, all 51 fingerprints in each canonical proof and all 46 corrected HBL reader fingerprints still matched current source. The source guards permit only the documented ledger, bounded result-timestamp and presentation changes. Completed cohorts and proofs did not require reruns.

## 6. remaining work completed

Completed the remaining full game regression, empirical checks, workspace and audit-script typechecks, isolated production build, local code commits and delivery verification. Reused both N40 cohorts, controlled sensitivity, canonical proofs and the passed core/V2/domain receipts. Final receipts are recorded below and in [VERIFICATION.json](VERIFICATION.json).

## 7. actual player attributes

The actual app schema has 56 outcourt attributes across technical, perception/decision, tactical, defensive, physical and mental domains, plus 21 keeper attributes across stopping, perception/decision, transition and mental domains. The adapter maps 35 outcourt and 13 goalkeeper keys. [complete attribute inventory](ATTRIBUTE-COVERAGE.md) lists every key and actual consumer.

## 8. unused attributes

21 outcourt and 8 keeper keys are unmapped in canonical V2. SWITCHING_HANDOVER maps into profile.handover but has no consumer. OFF_BALL_MOVEMENT is mapped into a readiness gate that saturates ordinary ratings. These are different findings from merely seeing a key in a schema or a profile; upstream/editor/development use is outside this match-path classification.

## 9. CA/PA/overall usage

No direct CA, PA or overall multiplier drives canonical V2 action execution: the production seam copies branch attribute values into buildProfile. Normal resolved plans use existing squad-status priorities; the fallback best-available lineup uses currentAbility for selection. Legacy Fast Match/spatial adapters still have explicit CA routes, separately documented. Attack-role proficiency selects a supported tendency name, not an execution multiplier. The displayed match rating is calculated afterwards from recorded goals, saves and missed shots; it is not read back as an in-match player-strength multiplier.

## 10. attribute coverage matrix

[complete attribute inventory](ATTRIBUTE-COVERAGE.md) and [ATTRIBUTE-COVERAGE.json](ATTRIBUTE-COVERAGE.json) provide all 77 domains, bridge formulas,47 consumer evidence groups, direct/indirect/partial/gated/dead classifications, factual body-profile omissions and confidence limits. A changed profile field alone is not classified as meaningful execution differentiation.

## 11. passing integration

PASSING and DECISION_MAKING form passing capacity; actual range, lane, pressure, urgency and recipient motion determine difficulty and scatter. PASSING 11 to 16 reduces difficult fresh mean release error 0.2933 to 0.1858m over 64 paired releases per tier. This proves release precision differentiation, not a measured completion probability or turnover quota.

## 12. reception integration

BALL_HANDLING and COMPOSURE influence actual swept-flight reception control. Individual handling difficult fresh failures are 4/128 low versus 3/128 high, while tired samples tie4/128. Coherent technical-profile catches can reverse: difficult+tired failures 6,4,11/128 low/median/high. Actual pace/collision context must be retained beside centre-risk probes; [differentiation scorecard](DIFFERENTIATION-SCORECARD.md).

## 13. ball-control integration

Handling rules still depend on legal state (steps, held-ball time, prior dribble). No dedicated dribble-mistouch/lost-dribble uncertainty category exists. Named reception failures, unspecified open-play control recoveries and rule violations are not relabelled as the same player error. Factual height, weight and handedness do not enter V2 capacities.

## 14. shooting integration

Power changes actual ball pace; placement/finishing and wing technique change intended aim and spread; fatigue protection depends on difficulty and technique. Central technique differentiates in corrected canonical encounters. SHOOTING_VARIETY is unmapped; PIVOT_PLAY chiefly changes pivot-specific quality/approach, not a distinct release-accuracy term. Existing shot architecture was preserved.

## 15. defence integration

Defensive timing/lateral skill changes real duel margins; positioning/covering changes step-out/help geometry; ball-winning changes actual intercept grasp; blocking changes active block reach and perceived threat. CONTACT_ABILITY has a narrow HOLD-severity consumer; switching is mapped but dead. The strong local duel/interception effects do not establish complete defensive cognition.

## 16. keeper integration

Positioning/set stance, reaction, explosiveness, reading and 7m capacities have live read/movement/reach consumers. Low/high saves affect vertical reach; close/long/wing primarily affect held-versus-parried results after reach. Eight keeper keys are unmapped, and keeper.outlet is an unused duplicate while OUTLET_PASSING remains active through generic passing.

## 17. physical integration

All 11 physical keys have real cost/capacity consumers. The physical model is unchanged: movement and actual contact/jump work drive reserve/acute load; endurance/repeat-sprint support bounded recovery. Lateral quickness is fatigue/turn gated; jump ability affects load cost, not variable takeoff height/airtime. Same-task physical cells do not establish human physiology.

## 18. decision integration

GAME_READING, DECISION_MAKING and ANTICIPATION alter reactions, secure/read timing and option components. In the fixed decision geometry, perceived decision rises .473684 to .763158, reaction .234737 to .182632s and recovery read ticks 2 to 1; all tiers retain ATTACK_NEXT_DEFENDER. A correct unchanged choice is not itself a decision failure. Broad named cognitive/tactical schema coverage remains sparse.

## 19. effect sizes

Observed effects are scoped to the reached task: BREAKTHROUGH low/high wrong-foots 80/128 versus 115/128; BALL_WINNING intercepts 150/384 versus 176/384 across identical lane offsets; technical shooting and pass scatter also change. Small or flat gated outcomes and finite non-monotonic samples remain visible. [differentiation scorecard](DIFFERENTIATION-SCORECARD.md) supplies exact grades and limits rather than an invented universal effect threshold.

## 20. specificity

Each supported outcourt key was varied individually at observed per-key p10/p90 to record changed capacities; action cells vary one key or an explicit related group. Notable couplings are DECISION_MAKING into mechanical passing, FINISHING into placement, AGILITY into running/attacking/defending, and COMPOSURE into handling and pressure execution. Coupling is documented, not automatically declared incorrectly weighted.

## 21. technical profile comparison

All 11 physical ratings are equal in coherent low/median/high technical comparisons. Difficult central goals are 49/64,55/64,59/64 fresh and 45/64,51/64,54/64 tired. Difficult fresh pass error is .3148,.2503,.1536m. Coherent tired catch failures reverse6,4,11/128 because delivery pace and reached execution context also change; no selective reporting of only favorable directions.

## 22. shooter comparison

Central shooting-technique low/high clear goals 59/64 to 64/64 fresh and 51/64 to 59/64 tired; difficult53/64 to 59/64 fresh and 49/64 to 53/64 tired. Wing technique narrows spread .8517 to .7043 while goals fall64/64 to 58/64 in that geometry. Power changes pace 22.789 to 25.684m/s but medium goals tie55/64. Precision, ball speed and final conversion are distinct signals.

## 23. defender comparison

Stronger defensive footwork changes wrong-footed outcomes108/128 to 83/128. BALL_WINNING 10 to 13 raises interceptions150/384 to 176/384 with the same absolute lane offsets/seeds. The positioning/timing/covering group moves pressure target 7.37cm and helper target 3.34cm; every reached frontal contact remains legal and stops the carrier. That preserved spatial contract must not become an arbitrary contact-success lottery.

## 24. keeper comparison

The corrected shot harness records an actual keeper-flight read in all 64 trials of every shot cell. REACTION 11 to 16 changes clear goals conceded 63/64 to 61/64; reading group63,62,62/64;7m60,59,60/64. Flat subtype cells are context/reach/pace gated, not proof live capacities are dead. No caught saves occur in the 27 isolated keeper-variation cells; other shot groups include11 held-save terminal outcomes.

## 25. real-player comparison

Seven ID-sorted median-position roster examples preserve their own complete branch and generated/derived provenance. Clear/difficult scored goals: Hugo Svensson62/55, Hugo Andersson59/54, Jack Mansson64/59, Jens Lindstrom64/57, Jakob Gronlund63/56, Kenan Salkicevic63/56 (each /64). Jonas Aberg is the goalkeeper example:61/50 goals conceded, not goals scored. These central scenarios do not establish real-athlete or role-specific shot rankings; original spellings/IDs are in [differentiation scorecard](DIFFERENTIATION-SCORECARD.md).

## 26. player differentiation scorecard

The16-family [differentiation scorecard](DIFFERENTIATION-SCORECARD.md) records2 STRONG,3 ADEQUATE,8 WEAK,2 NONE and 1 UNKNOWN judgments. Passing precision/duels are strong scoped effects; switching and dedicated dribble control have no corresponding player-specific path; committed-shot tests do not measure shot selection. GOOD_ENOUGH, TARGETED_FIX and DEDICATED_PHASE are qualitative engineering dispositions, not statistical acceptance thresholds.

### Required broad-domain grades

| Domain | Grade | Measured scope |
|---|---|---|
| Decisions | WEAK | Read/risk/reaction differ; tested best choice remains identical |
| Passing | STRONG | Specific release precision and pace effects |
| Reception | WEAK | Small individual effect and non-monotonic coherent-profile catches |
| Ball control | WEAK | Supported reception control; dedicated dribble-loss differentiation NONE |
| Shooting | ADEQUATE | Central execution differs; wing aim is non-monotonic and selection UNKNOWN |
| Defending | ADEQUATE | Duel/interception effects; positioning/help remain WEAK |
| Goalkeeper | WEAK | Small actual reaction/read effects, finite subtype plateaus |
| Physical load/recovery | ADEQUATE | Specific work/capacity/recovery effects with frozen v1.1 behavior |
| Technical execution under fatigue | WEAK | Pass/shot capacity differentiates; catch outcomes remain mixed |

These conservative broad grades summarize the detailed16-family evidence; they are engineering judgments, not empirical league acceptance thresholds.

## 27. possession definition

A played attacking episode requires actual control/receipt/shot evidence. Same-team defensive free throws and retained rebounds continue it. Independent reconstruction partitions at actual period ends and reconciles same-tick recalled advantage without opponent play. Raw canonical IDs, procedural no-touch fragments and played episodes remain separately reported.

## 28. possession reconstruction

HBL has 5502 independent episodes versus 5489 current canonical raw-ID attacks; Allsv 5473 versus 5458. The13/15 unit differences are separate from corrected loss classification. Recalled-advantage provisional ownership is aliased passively; no simulation event, RNG draw or body state is changed. [possession economy](POSSESSION-ECONOMY.md).

## 29. observer non-mutation

Both [HBL](verification/hbl-canonical-proof.json) and [Allsvenskan](verification/allsv-canonical-proof.json) receipts have exactObserverNonMutation and postAnalysisNonMutation=true. Observed/plain runs and JSON continuation preserve canonical state/event suffix/RNG. All 80 retained cohort trajectories also match their prior session/core identity; reporting and snapshots do not decide outcomes.

## 30. Human-QA match reconstruction

Exact Human-QA reconstruction is **UNAVAILABLE**. [Human-QA availability](HUMAN-QA.json) records no enabled browser session or exported matching save/archive and no retained cohort instance of that exact match. The provided aggregate totals cannot recover ordered possession/free-throw/loss causes. Cohort findings are clearly separate.

## 31. Torslanda possessions

Torslanda actual possessions: null/UNAVAILABLE. User-provided43 shots and 27 broad losses cannot be added to infer70 possessions because retained shots and subsequent loss can overlap.

## 32. Tumba possessions

IFK Tumba actual possessions: null/UNAVAILABLE. User-provided49 shots and 20 broad losses do not establish69 possessions. No cohort-average denominator is substituted.

## 33. Torslanda free throws

Torslanda exact ordinary defensive free throws: null/UNAVAILABLE. They are not inferred from opponent suspensions, total losses, foul assessments or7m attempts.

## 34. Tumba free throws

IFK Tumba exact ordinary defensive free throws: null/UNAVAILABLE for the same reason. A full provenance-valid whistle stream is required; absence of accessible evidence is not zero.

## 35. free throws/possession

Cohort Frikast/played episode is 0.084151 HBL and 0.087703 Allsv. Distinct ordinary attacking FREE_THROW whistles/foulId total 463/480, or11.575/12.000 per match. 7m, realized advantage, admin awards and horn retakes are excluded. NO_REFERENCE.

## 36. free-throw chains

HBL chains zero/one/two/three-plus are 5071/401/29/1 across 5502 episodes; Allsv 5036/396/39/2 across 5473. Free throws can precede eventual shots or losses without ending the attack. Ordered before-later-shot counts 337/370 and before-terminal-loss120/109 are nonexclusive histories.

## 37. shots/possession

Ordinary-field attempts/played episode: 0.636678/0.645533; all attempts: 0.687750/0.701992. Ordinary field excludes7m/GK. Outfield including7m totals 3784/3842; no keeper attempts occur. 7m is an independent attempt/episode flag, not another ending.

## 38. passes/possession

Passes/played episode are 7.643 HBL and 7.439 Allsv, with 42054/40712 releases. Median is6 in each; p90=14 and p95=17. Shot-bearing-episode pass counts are not asserted to be ordered before the final shot; later passes after a retained earlier shot may exist. Incident pass flags overlap.

## 39. possession duration

Official-clock episode duration mean 26.172/26.310s, median23.650 both, p95=51.497/51.120s. It includes running-clock restart preparation and excludes stopped-clock halftime/timeout. HBL max484.15s and 483 passes remains a continuity tail; Allsv max126.35s and 90 passes. NO_REFERENCE; consistent counts do not establish realistic tails.

## 40. broad ball losses

Historical broad UI means 49.200/45.775 become44.550/41.750 through pure reader corrections on unchanged trajectories. Current pooled losses 1782/1670 exactly match independent classified endings:32.388%/30.513% per played episode. These are broader than official technical errors.

## 41. bad passes

Terminal BAD_PASS_OUT is93/115 (2.325/2.875 per match). It is not every boundary event or every deflected pass. Including terminal dropped receptions yields170/215 execution candidates; that subset still has no proven official technical-error equivalence.

## 42. interceptions

Terminal interceptions989/816, means 24.725/20.400 per match, account for55.50%/48.86% of current losses. Per released pass, rates are 2.352%/2.004%. Strong existing BALL_WINNING sensitivity and high aggregate contribution are different observations; neither establishes an empirical excess.

## 43. reception failures

Named fumbles433/473 occur among 39818/38735 received-or-failed catch outcomes (1.087%/1.221%). Own recoveries356/373 leave terminal dropped losses 77/100. Counting all fumble incidents as turnovers would discard retained-ball truth.

## 44. control losses

No dedicated dribble-control-error producer exists. The cohorts have zero terminal BALL_CONTROL_LOSS_UNSPECIFIED/FAILED_RECEIVE_UNSPECIFIED buckets after evidence-linked decomposition; defensive deflection recoveries529/525 remain explicitly labelled. Zero unspecified residuals does not imply a modeled dribble skill.

## 45. offensive fouls

OFFENSIVE_FOUL has no current canonical producer. Cohort zeros are labelled UNSUPPORTED, not proof of realistic foul simulation or player discipline. No new offensive-foul lottery or invented event attribution was added.

## 46. other losses

Technical-rule terminals69/66 and passive-play25/48 are separate causes. OTHER and remaining unspecified terminal loss buckets are zero. Interceptions and deflection recoveries remain broad defensive-interaction losses, not automatically pass-technique mistakes.

## 47. double counting result

HBL historical false classifications194 removed,8 masked genuine losses restored,6 loss classes reclassified: net-186. Allsv 174 removed,13 restored,4 reclassified: net-161. Historical-only/current-only records contribute zero losses. The bug was not naive summing of pass/interception/transfer facts; some one-terminal-per-attack readings and provisional awards were wrong. Exact human 47 remains unavailable.

## 48. rebound/retained-ball semantics

Saved/blocked shots recovered by the defending side are shot outcomes; attacking recoveries keep play alive. A later genuine pass/control loss after a retained shot still counts once. Current shot-bearing loss episodes20/27 are separate from no-shot losses 1762/1643. Named retained fumbles remain incidents rather than new possession endings.

## 49. fatigue contribution

READY versus MODERATE named catch failures: HBL 133/15695 (0.847%) versus 299/23942 (1.249%); Allsv 99/11349 (0.872%) versus 372/27093 (1.373%). SEVERE failures are 1/181 (HBL) and 2/293 (Allsvenskan); HIGH-acute failures are 0/7 and 0/11. Those samples are too small to establish severe-fatigue or acute-exertion risk. These associations do not identify a causal fatigue share of losses; interceptor energy is not losing-passer energy. [root-cause classification](ROOT-CAUSE.md) includes matched-band cross-tabs and controlled fatigue limits.

## 50. pressure contribution

Receiver LOW/MEDIUM-pressure failures are 349/36572 (0.954%) versus 83/3213 (2.583%) HBL;372/35789 (1.039%) versus 101/2931 (3.446%) Allsv. HIGH pressure has only 33 catch outcomes in HBL and 15 in Allsvenskan. Posthoc player/role/exact-geometry selection remains confounded even after coarse cross-tabs.

## 51. difficulty contribution

Action-linked release difficulty SIMPLE/DIFFICULT catch failures: HBL 194/19820 (0.979%) versus 44/2856 (1.541%); Allsv 183/18616 (0.983%) versus 61/2952 (2.066%). This is throw difficulty joined by actionId, not recorded intrinsic catch difficulty. Mean throw error SIMPLE/DIFFICULT .0718/.2207m HBL and .0797/.2487m Allsv, with raw sample weights.

## 52. HBL N40 economy

HBL N40: 5502 played episodes,1782 losses,42054 pass releases. Means137.550 episodes,57.900 goals,94.600 attempts,44.550 losses and 11.575 Frikast. Ordinary-field conversion 59.72%;7m224/281=79.72%. Reconciled pure-reader outputs preserve original core/session identity; integrity anomalies0. Full distributions and denominator definitions: [possession economy](POSSESSION-ECONOMY.md).

### Cohort side budget

These are40 home and40 away appearances in the retained cohort, not the unavailable Torslanda–Tumba match. Individual club/fixture rows are retained in ECONOMY.json.

| Metric | HOME total | AWAY total | Combined mean per match |
|---|---:|---:|---:|
| possessions | 2752 | 2750 | 137.550 |
| freeThrows | 239 | 224 | 11.575 |
| passes | 21262 | 20792 | 1051.350 |
| fieldAttempts | 1765 | 1738 | 87.575 |
| sevenMetres | 146 | 135 | 7.025 |
| totalAttempts | 1911 | 1873 | 94.600 |
| broadBallLosses | 869 | 913 | 44.550 |

## 53. Allsvenskan N40 economy

Allsvenskan N40: 5473 played episodes,1670 losses,40712 pass releases. Means136.825 episodes,57.775 goals,96.050 attempts,41.750 losses and 12.000 Frikast. Ordinary-field conversion 59.02%;7m226/309=73.14%. All retained canonical trajectories match; integrity anomalies0. Full distributions: [possession economy](POSSESSION-ECONOMY.md).

### Cohort side budget

These are40 home and40 away appearances in the retained cohort, not the unavailable Torslanda–Tumba match. Individual club/fixture rows are retained in ECONOMY.json.

| Metric | HOME total | AWAY total | Combined mean per match |
|---|---:|---:|---:|
| possessions | 2735 | 2738 | 136.825 |
| freeThrows | 252 | 228 | 12.000 |
| passes | 20347 | 20365 | 1017.800 |
| fieldAttempts | 1769 | 1764 | 88.325 |
| sevenMetres | 159 | 150 | 7.725 |
| totalAttempts | 1928 | 1914 | 96.050 |
| broadBallLosses | 829 | 841 | 41.750 |

## 54. comparable empirical technical-error subset or NO DIRECT COMPARISON

**NO_DIRECT_COMPARISON.** Official HBL source mean 20.247 registered technical errors is not equated to broad losses, named reception incidents, execution candidates or the narrow terminal-rule counter. HBL outfield-attempt reference includes7m and excludes keepers; ordinary-field attempts use a different denominator. Possessions, duration and Frikast remain NO_REFERENCE; no empirical data files were edited.

## 55. root cause of 27/20 broad losses

Exact27/20 causes are UNAVAILABLE. Cohort-supported A-G classification is G: multiple mechanisms (broad semantics, corrected reader defects and actual interception/deflection volume), with exact-human conclusions withheld. [root-cause classification](ROOT-CAUSE.md) explicitly classifies A throughG and preserves the source/denominator limits.

## 56. root cause of apparent attack volume

Apparent shots+losses volume mixes overlapping units: repeated retained shots and shot-bearing losses prevent addition. Independent reconstruction provides137.550/136.825 played episodes per match, while about1051/1018 pass releases per match create many defensive interception opportunities. Free throws and own recoveries continue existing attacks.

## 57. whether possession volume is excessive

Whether possession volume is excessive is **NOT ESTABLISHED**. NO_REFERENCE exists for a compatible empirical possession count/duration, and UI shots+losses was not a valid estimator. The extreme retained HBL continuation tail remains a limitation without inventing a league target.

## 58. whether technical-error probability is excessive

Whether the official-equivalent technical-error probability is excessive is **NOT ESTABLISHED**. Terminal bad-pass/dropped candidates170/215 and named catch failure rates are measured, but neither defines the complete official source statistic. No blanket turnover or fumble reduction is justified from 47 alone.

## 59. whether interception frequency is excessive

Interceptions are a confirmed major component (55.50%/48.86% of losses), with per-release rates2.352%/2.004%. Empirical excess is not established without a matched source definition/reference. High event count at high pass exposure is not evidence every player shares a high constant failure probability.

## 60. whether fatigue contribution is excessive

Excessive fatigue contribution is **NOT ESTABLISHED**. Same-context experiments show difficulty/technique-specific reserve/acute effects, while whole-match contexts mix exposure and selection. Frozen Rotation-v1 to Physical-v1.1 old-reader broad means 49.75 to 49.20 HBL and 45.775 to 45.775 Allsv do not show a new broad-loss explosion. Current44.55/41.75 is a reader correction, not a fatigue nerf.

## 61. whether attributes matter enough

Relevant attributes matter in several existing execution tasks, but the full schema does not matter uniformly. Strong local pass/duel/interception evidence coexists with 21/8 unmapped attributes, dead switching, gated off-ball readiness and partial screen/pivot/keeper scope. [differentiation scorecard](DIFFERENTIATION-SCORECARD.md) distinguishes GOOD_ENOUGH from targeted and dedicated-phase needs.

## 62. weak domains

Weak or absent domains include named cognitive/tactical recognition, spacing/off-ball differentiation, player-specific switching, dedicated dribble control, screen execution specificity and some keeper subtype/mental coverage. Small finite keeper effects or a retained correct decision are not automatically implementation bugs. Wing aim and coupled catch reversals remain bounded questions.

## 63. future integration needs

A separate dedicated attribute-integration phase is supported by demonstrated coverage gaps, while retaining existing strong passing, duel, interception and approved physical mechanisms. This audit implements no new roadmap or coefficient changes. The evidence and domain dispositions are complete in [complete attribute inventory](ATTRIBUTE-COVERAGE.md) and [differentiation scorecard](DIFFERENTIATION-SCORECARD.md).

## 64. Frikast Match Center decision/result

Match Center adds Frikast only from provenance-valid distinct WHISTLE_RESTART/FREE_THROW facts credited to owner, deduplicated by event/foul identity. It excludes7m, realized advantage and admin/technical awards. Incomplete/legacy/conflicting protocol is UNAVAILABLE and withheld, rather than fabricated as zero. A short footnote clarifies broad Bollforluster semantics; layout/shot architecture stay intact.

## 65. Match Center truth

Both canonical proofs verify score, attempts/conversion,7m,suspensions,player ordering/stats,energy/minutes,keeper denominators,timeline,loaded facts and Frikast/broad-loss equality. Each checks12 key-moment canonical positions. The additional passive presentation proof explicitly joins transition goals to original SHOT_RELEASED phase and GOAL action IDs, and checks live/cached/archive parity for both retained fixture-zero cores. It advances no ticks; its recreated archive has no retained frames and is not a replacement for the earlier actual-frame archive proofs. Existing render tests verify Statistics placement and unchanged Overview.

## 66. Intelligence regression

Intelligence source/decision architecture is preserved. All 80 matched trajectories remain exact relative to approved Physical v1.1. Pure decision reads are nonmutating in controlled evidence; final broader suite receipts are recorded in sections 72-75.

## 67. Physical Load regression

Physical Load v1.1 source/cost/recovery behavior is preserved; no endurance, reserve, acute, rotation or tactic coefficients are changed. Same-task physical comparisons retain expected capacity/recovery differences and explicit unexercised-channel limits. Final regression receipts are in sections 72-75.

## 68. anti-cheat proof

No goal/shot/loss quota, CA/PA execution shortcut, arbitrary low-skill penalty or calibration target was introduced. Runtime work is limited to pure terminal-truth reading and bounded presentation; event production, movement, fatigue and RNG paths remain unchanged. Cohort session/core identity and proof OFF/ON continuation equality provide direct evidence.

## 69. determinism

Corrected sensitivity repeats identical shot/reception seed-context results. Both HBL and Allsvenskan canonical proofs compare observed/plain/full runs and JSON continuation exactly. All 80 retained cohort trajectories match their prior session/core hashes. Result hashes across current observed/plain/resumed runs agree; reprocessed core-only reports do not invent missing current result-wrapper hashes.

## 70. save/load

Natural ordinary-free-throw checkpoints are HBL tick 3755 and Allsv tick 661. Each JSON round-trip preserves owner, current attacking episode, restart state, RNG, intents and physical conditions, then reproduces the exact event suffix and canonical result. The free throw continues that same attack; it is not counted as a new loss.

## 71. archive

Both proof receipts show exact archive and exactly-once commit truth. Archive Match Center facts and key-moment positions match canonical observations. Historical archives lacking full transfer/boundary/restart evidence cannot reconstruct a complete historical possession economy; no archive schema is expanded or historical event stream fabricated.

## 72. focused tests

Current focused reader/economy tests pass 54/54; Match Center presentation/result-timestamp tests pass 11/11. All fourteen attribute cases, including unrelated shooting/pass specificity and physical work without turnover increments, pass inside the final core suite. The earlier 12/133/43 focused runs are retained evidence and overlap these cases; their counts are not added as independent tests. The full game suite includes all21 Frikast provenance cases. [The39-intent map](TEST-COVERAGE.md) identifies supported contracts and the unavailable offensive-foul/dribble producers.

## 73. core/V2 tests

Core: **467/467**. V2: **9/9**. Domain: **180/180**. All exit0. These finished before the October16 continuation and were reused after source/hash verification; they were not rerun. Anti-target, Intelligence, physical-load, contact, referee and continuous-match contracts remain covered.

## 74. full game regression

Full game regression: **2402/2402**, exit0, using the existing portable recipe with HM_GAME_TEST_CONCURRENCY=1. Empirical suite: **15/15**, exit0. Both ran after the recovered core/V2/domain receipts; no cohort or second heavy job overlapped them.

## 75. typechecks

All workspace typechecks passed (npm.cmd run typecheck, exit0). The explicit audit-script TypeScript project also passed, covering sensitivity, cohorts, reanalysis, aggregation, canonical/presentation/performance proofs and passive economy diagnostics. Three missing strict annotations were added after the first script check. Emitted JavaScript is byte-identical before/after for all three files ([TYPE-ONLY-EQUIVALENCE.json](TYPE-ONLY-EQUIVALENCE.json)); source validation distinguishes exact text matches from proven type-only equivalents. Completed runtime evidence was reused. The original failed log, successful final logs and exact commands are recorded in VERIFICATION.json.

## 76. production build

Production build passed, exit0, in **.next-game-attribute-economy-v1**. Build ID: `IGWUR3-QLEFpc9JTP0vOZ`. Built after the local code commits; source HEAD at build: `a4cf7e9c888a561fb012bcdbf1d36043f3584013`. Routes / and /new-game both return200 at http://127.0.0.1:3021. Previous isolated builds/services remain preserved. Delivery scope and browser QA availability are explicit in [DELIVERY.json](DELIVERY.json).

## 77. performance

Unobserved same-seed3,000-tick median is 335.26ms versus the retained Physical v1.1 333.22ms (0.61% descriptive difference). Three measured repeats exclude warmup and produce the same final core hash. Pure-ledger median reads on identical saved cores are HBL 36.75→45.10ms and Allsv 46.12→54.86ms. This extra reporting work is outside canonical ticks; it does not justify claiming all UI reads have unchanged cost. Full-match observer timings include three developer observers and checkpoint capture, not EconomyObserver alone. [PERFORMANCE.json](PERFORMANCE.json) retains scope and caveats.

## 78. resource-safety summary

Heavy work ran in a strict foreground sequence. Completed attribute/HBL/Allsv work was reused; HBL reader corrections used retained compressed cores. The previous runner completed core/V2/domain and stopped before game because the temporary progress pointer was locked. Its noncritical progress write now retries briefly and cannot cancel required validation. Resume started at game-final and verified the earlier success receipts. Game concurrency remained1; types and build followed after tests. No global process kill, recursive cleanup or existing-server replacement occurred.

## 79. remaining limitations

The exact human match is unavailable; no official-equivalent technical-error mapping or exact possession/duration/Frikast reference exists. Coverage is partial, dribble-control/offensive-foul producers are absent, some controlled outcomes reverse, sparse severe/acute contexts cannot identify causality, and HBL has an extreme continuity tail. Core-only reanalysis retains original result hashes rather than fabricating current wrappers. [root-cause classification](ROOT-CAUSE.md) and [differentiation scorecard](DIFFERENTIATION-SCORECARD.md) retain these limits.

## 80. evidence-based next task

**B: dedicated player-attribute integration, rather than A: broad possession/turnover calibration.** Evidence is the completed missing/gated/dead-path inventory and domain scorecard, alongside preserved strong execution effects. This does not claim those gaps caused the exact human 47 or establish a desired interception/loss/volume target. No new roadmap or tuning is performed in this audit.

## 81. local commits

All task-owned code and evidence were committed locally. Code commits after2017385:

```text
a4cf7e9 Add passive attribute and possession economy audit tools
a604140 Correct canonical ball-loss accounting and show ordinary free throws
```

The final evidence commit contains this report, compact verification, request/test mappings and the generated build type metadata. Its own hash is intentionally not self-embedded; git log2017385..HEAD shows the complete local sequence. No unrelated user file was staged.

## 82. final git status

The final post-commit status check preserves exactly the six original user entries, covering39 byte-identical files:

```text
 M apps/game/app/match-qa/page.tsx
 M apps/game/lib/matchQa/qaHarness.ts
 M apps/game/scripts/season-audit.ts
?? .claude/
?? apps/game/.tmp-final-benchmark.ts
?? docs/audit/
```

All task-owned files are committed. Large raw cores/cohort reports/logs and temporary orchestration helpers remain local and ignored. SOURCE-PRESERVATION.json records hashes; the final status check runs after the evidence commit.

## 83. Motion/stash status

Motion HEAD is unchanged: `197d2a80ecea3b70efdcf8ef347cfc68e0e86b2b`; status remains only `?? .claude/`. Both stashes are unchanged:

- `ddba79055949b76898b12fc1b947e8f8645589cb`
- `b068a9586209b9405b8d5f0dc6fae6384dd09001`

All 17 recorded earlier build IDs are preserved; delivery records the HTTP checks for ports3017–3020.

## 84. explicit confirmation NOTHING WAS PUSHED

**NOTHING WAS PUSHED.** All commits are local. No reset, restore, stash pop/drop, unrelated-file deletion or Motion edit was performed.

## 85. exact start command

```powershell
Set-Location 'C:\Users\helgi\Documents\STARKVIS-HELA\handball-manager\apps\game'
$env:HM_NEXT_DIST_DIR = '.next-game-attribute-economy-v1'
npm.cmd run start -- --hostname 127.0.0.1 --port 3021
```

## 86. exact URL

http://127.0.0.1:3021

## 87. exact report path

`C:/Users/helgi/Documents/STARKVIS-HELA/handball-manager/docs/player-attributes-possession-economy-v1/REPORT.md`

## 88. short Human QA instructions

Open http://127.0.0.1:3021 and play/open one normal completed match. Go to Match Center → Statistik → Matchstatistik. Check the compact Frikast row, separate 7m totals and clarified broad-loss wording; compare live/final/archive totals when available. Legacy archives with insufficient foul protocol withhold Frikast. Preserve an exact save/export when disputing a count; shots plus losses is not a possession denominator.
