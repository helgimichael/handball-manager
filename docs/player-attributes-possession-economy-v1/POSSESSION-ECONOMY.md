# Possession economy: final matched N40 cohorts

Both leagues use 40 complete retained production fixtures, with reconciled pure-reader reports preferred. Scores, releases, bodies, fatigue and simulation trajectories are unchanged. Counts below explain possession and loss accounting; they are not calibration targets.

## Denominators and reference status

- **possession**: Independent played attacking episode; same-team free throws and retained rebounds continue it. Raw canonical IDs, no-touch fragments, period splits and recalled-advantage aliases are reported separately.
- **shots**: totalAttempts is all actors/all shot types; fieldAttempts excludes 7m and goalkeeper attempts; outfieldAttempts includes7m but excludes keepers. Conversions require action-linked category goals, not inferred total-goal subtraction.
- **loss**: Exactly one exclusive terminal loss cause per played episode. A failed reception can be retained; an earlier released shot does not erase a later loss. Incident pass flags overlap and are not added to terminal losses.
- **sevenMetres**: Independent shot/episode flag, not an additional exclusive ending; report its goals/attempts separately.
- **Frikast**: Distinct attacking WHISTLE_RESTART FREE_THROW/foulId only; excludes 7m, realized advantage, assessments, administrative awards and timeout. NO_REFERENCE.
- **duration**: Elapsed official-clock episode seconds; no empirical exact-duration reference. NO_REFERENCE.
- **officialTechnicalErrors**: NO_DIRECT_COMPARISON: official recorded pass/lost-ball/rule totals are not proven equivalent to engine broad losses, named fumbles, execution candidates or narrow technical-rule endings.
- **contexts**: Raw sample-weighted actor snapshots and named failed/(received+failed) incidents, with UNRECORDED values preserved. ActionId-joined release difficulty is explicitly not intrinsic catch difficulty.

Match distributions have n=40; team-match distributions n=80. Pooled rates are sums of numerators divided by sums of denominators, not unweighted means of match rates. Duration/pass distributions use individual played episodes. Full tails, numerators, provenance, contexts and integrity are in [ECONOMY.json](ECONOMY.json).

## Handbollsligan: 40 matches

Selected reconciled reports: 40/40. All retained session/core hashes agree with their original report. Read-only source/reader differences are retained in the JSON; historical raw manifests are untouched.

| Metric | Pooled count | Per-match mean | Median | p90 | p95 | Min / max |
|---|---:|---:|---:|---:|---:|---:|
| possessions | 5502 | 137.550 | 137.000 | 145.000 | 145.150 | 116 / 155 |
| goals | 2316 | 57.900 | 58.500 | 65.100 | 66.000 | 42 / 67 |
| totalAttempts | 3784 | 94.600 | 95.500 | 103.000 | 104.100 | 82 / 106 |
| fieldAttempts | 3503 | 87.575 | 87.500 | 95.300 | 99.050 | 75 / 100 |
| sevenMetres | 281 | 7.025 | 7.000 | 11.000 | 11.000 | 2 / 11 |
| broadBallLosses | 1782 | 44.550 | 46.000 | 51.300 | 54.050 | 32 / 59 |
| canonicalUiBallLosses | 1782 | 44.550 | 46.000 | 51.300 | 54.050 | 32 / 59 |
| nonShotLosses | 1762 | 44.050 | 45.000 | 51.300 | 54.050 | 31 / 58 |
| freeThrows | 463 | 11.575 | 11.000 | 15.200 | 19.000 | 6 / 20 |
| passes | 42054 | 1051.350 | 1033.500 | 1101.800 | 1113.550 | 989 / 1422 |
| fumbledPasses | 433 | 10.825 | 11.000 | 13.200 | 15.000 | 5 / 17 |

| Team-match metric | Mean | Median | p90 | p95 | Min / max |
|---|---:|---:|---:|---:|---:|
| possessions | 68.775 | 69.000 | 72.000 | 73.050 | 58 / 78 |
| goals | 28.950 | 30.000 | 35.000 | 36.000 | 17 / 38 |
| totalAttempts | 47.300 | 48.000 | 53.000 | 54.050 | 38 / 57 |
| fieldAttempts | 43.788 | 44.000 | 50.000 | 50.050 | 31 / 53 |
| sevenMetres | 3.513 | 3.000 | 6.000 | 7.000 | 0 / 8 |
| broadBallLosses | 22.275 | 22.000 | 28.100 | 29.050 | 12 / 31 |
| freeThrows | 5.787 | 5.000 | 9.000 | 11.000 | 1 / 14 |
| passes | 525.675 | 518.000 | 572.100 | 596.400 | 441 / 969 |

| Pooled rate | Value | Denominator |
|---|---:|---|
| goalsPerPossession | 0.421 | played attacking episodes |
| fieldAttemptsPerPossession | 0.637 | played attacking episodes |
| totalAttemptsPerPossession | 0.688 | played attacking episodes |
| freeThrowsPerPossession | 0.084 | played attacking episodes |
| passesPerPossession | 7.643 | played attacking episodes |
| broadLossesPerPossession | 0.324 | played attacking episodes |
| nonShotLossesPerPossession | 0.320 | played attacking episodes |
| fieldConversion | 59.72% | ordinary field attempts, excludes 7m/GK |
| sevenMetreConversion | 79.72% | 7m attempts |
| outfieldIncludingSevenMetreConversion | 61.21% | ordinary field +7m attempts |
| allActorConversion | 61.21% | all actor attempts |

### Exclusive terminal budget

| Ending | Episodes | Share |
|---|---:|---:|
| GOAL | 2316 | 42.09% |
| SHOT_OUTCOME | 1329 | 24.15% |
| TURNOVER | 1782 | 32.39% |
| OFFENSIVE_FOUL | 0 | 0.00% |
| HALF_END | 75 | 1.36% |
| OTHER | 0 | 0.00% |
| UNRESOLVED | 0 | 0.00% |

`SHOT_OUTCOME` relabels the counter legacy name `FIELD_SHOT_MISS_SAVE`: it can include a 7m shot outcome and is not an ordinary-field-only bucket. Shot-bearing/7m flags are independent; never add them again to these exclusive endings.

| Exclusive loss cause | Count | Share of losses | Per played episode | Mean / match |
|---|---:|---:|---:|---:|
| BAD_PASS_OUT | 93 | 5.22% | 1.69% | 2.325 |
| BALL_CONTROL_LOSS_UNSPECIFIED | 0 | 0.00% | 0.00% | 0.000 |
| DEFLECTED_PASS_RECOVERED | 529 | 29.69% | 9.61% | 13.225 |
| DROPPED_RECEPTION | 77 | 4.32% | 1.40% | 1.925 |
| FAILED_RECEIVE_UNSPECIFIED | 0 | 0.00% | 0.00% | 0.000 |
| INTERCEPTION | 989 | 55.50% | 17.98% | 24.725 |
| OFFENSIVE_FOUL | 0 | 0.00% | 0.00% | 0.000 |
| OTHER | 0 | 0.00% | 0.00% | 0.000 |
| PASSIVE_PLAY | 25 | 1.40% | 0.45% | 0.625 |
| TECHNICAL_RULE_VIOLATION | 69 | 3.87% | 1.25% | 1.725 |

Shot-bearing loss episodes: 20. These are genuine terminal losses after a retained earlier shot, rather than errors inferred from every save/rebound. 7m-bearing episodes: 281; 7m-only episodes: 270. Neither is a new mutually exclusive ending.

### Free-throw continuations, duration and passing

| Free-throw chain | Played episodes | Mean duration (s) | p90 | Max |
|---|---:|---:|---:|---:|
| ZERO | 5071 | 24.959 | 40.650 | 484.150 |
| ONE | 401 | 39.618 | 60.150 | 117.550 |
| TWO | 29 | 50.783 | 67.770 | 88.600 |
| THREE_PLUS | 1 | 69.700 | 69.700 | 69.700 |

Free throws within shot-bearing episodes: 343; within eventually lost episodes: 120. These overlap when a shot-bearing episode later loses the ball. Ordered whistle-before-later-shot: 337; whistle-before-terminal-loss: 120 (ORDERED_WHISTLE_TO_LATER_SHOT). Episode membership alone is not presented as proof a whistle preceded its shot.

| Clock segment | Frikast |
|---|---:|
| 0-15 | 110 |
| 15-30 | 124 |
| 30-45 | 112 |
| 45-60 | 117 |

| Episode sample | n | Mean | Median | p90 | p95 | Max |
|---|---:|---:|---:|---:|---:|---:|
| All duration seconds | 5502 | 26.172 | 23.650 | 43.140 | 51.497 | 484.150 |
| 7m-bearing duration seconds | 281 | 32.262 | 28.650 | 48.950 | 57.000 | 162.550 |
| Passes per played episode | 5502 | 7.643 | 6.000 | 14.000 | 17.000 | 483.000 |
| Passes in shot-bearing episode | 3666 | 7.888 | 6.000 | 15.000 | 18.000 | 133.000 |
| Passes in lost episode | 1782 | 7.012 | 6.000 | 14.000 | 17.000 | 42.000 |

Duration uses elapsed official clock inside the episode, including running-clock restart preparation and excluding stopped-clock halftime/timeout. NO_REFERENCE applies; no exact empirical possession-duration target is invented.

### Historical reader, current UI and played episodes

| Same-event reader/unit | Attacks/episodes | Broad losses | No-shot losses |
|---|---:|---:|---:|
| Historical2017385 canonical raw-ID reader | 5490 | 1968 | 1763 |
| Current canonical raw-ID reader | 5489 | 1782 | See per-match raw ledger |
| Independent period/recall-aware played episodes | 5502 | 1782 | 1762 |

Retained physical-v1.1 benchmark broad losses averaged 49.200 per match; current UI 44.550; independent episodes 44.550. Historical no-shot subtotal is a separate quantity. Played-versus-current-raw-ID episode difference: 13. Current-UI versus historical broad-loss difference: -186. These are reader/unit corrections on identical trajectories, not changes to how a match played.

### Technical contexts and integrity

Raw post-event actor snapshots; sample-weighted sums, never unweighted means of match means. Failed/(received+failed) counts named reception incidents, including own-recovered fumbles, and is not terminal possession loss. INTERCEPTION snapshots describe the intercepting actor, not the losing passer.

difficulty is the value actually recorded on that event; catch difficulty is normally UNRECORDED. releaseDifficulty explicitly joins that actionId to PASS_RELEASED and labels throw difficulty, not intrinsic catch difficulty.

Recorded risk is available only on RECEPTION_FAILED. Mean recorded failed-catch risk is not an average risk over all catches or a predicted failure rate.

| Receiver fatigue | Received | Failed | Failed / (received + failed) |
|---|---:|---:|---:|
| MODERATE | 23643 | 299 | 1.25% |
| READY | 15562 | 133 | 0.85% |
| SEVERE | 180 | 1 | 0.55% |

Pressure, acute, intrinsic recorded difficulty and action-linked release-difficulty views use the same denominator discipline in JSON. Different contexts/selection/roles confound these associations; they are not causal fatigue experiments.

Integrity anomaly entries: **0**. Category goal numerators complete: true. Original/reconciled reports, all per-match integrity fields, same-ID ending changes and source-manifest differences remain in JSON.

## Allsvenskan: 40 matches

Selected reconciled reports: 0/40. All retained session/core hashes agree with their original report. Read-only source/reader differences are retained in the JSON; historical raw manifests are untouched.

| Metric | Pooled count | Per-match mean | Median | p90 | p95 | Min / max |
|---|---:|---:|---:|---:|---:|---:|
| possessions | 5473 | 136.825 | 136.000 | 146.000 | 147.000 | 127 / 150 |
| goals | 2311 | 57.775 | 57.500 | 63.200 | 66.050 | 45 / 76 |
| totalAttempts | 3842 | 96.050 | 96.500 | 103.100 | 104.000 | 85 / 109 |
| fieldAttempts | 3533 | 88.325 | 88.500 | 95.300 | 99.050 | 76 / 104 |
| sevenMetres | 309 | 7.725 | 8.000 | 11.100 | 12.000 | 3 / 14 |
| broadBallLosses | 1670 | 41.750 | 41.000 | 49.300 | 52.100 | 29 / 55 |
| canonicalUiBallLosses | 1670 | 41.750 | 41.000 | 49.300 | 52.100 | 29 / 55 |
| nonShotLosses | 1643 | 41.075 | 40.500 | 48.300 | 51.100 | 29 / 54 |
| freeThrows | 480 | 12.000 | 11.000 | 17.100 | 18.000 | 4 / 18 |
| passes | 40712 | 1017.800 | 1018.500 | 1058.100 | 1061.550 | 943 / 1082 |
| fumbledPasses | 473 | 11.825 | 12.000 | 15.000 | 16.050 | 5 / 19 |

| Team-match metric | Mean | Median | p90 | p95 | Min / max |
|---|---:|---:|---:|---:|---:|
| possessions | 68.412 | 68.000 | 73.000 | 73.050 | 63 / 75 |
| goals | 28.887 | 29.000 | 36.200 | 38.000 | 15 / 45 |
| totalAttempts | 48.025 | 48.000 | 54.000 | 55.000 | 38 / 59 |
| fieldAttempts | 44.163 | 44.000 | 51.000 | 52.000 | 32 / 55 |
| sevenMetres | 3.862 | 4.000 | 6.100 | 7.000 | 0 / 8 |
| broadBallLosses | 20.875 | 21.000 | 26.000 | 27.100 | 8 / 30 |
| freeThrows | 6.000 | 6.000 | 10.000 | 10.000 | 1 / 13 |
| passes | 508.900 | 512.000 | 550.200 | 562.100 | 434 / 601 |

| Pooled rate | Value | Denominator |
|---|---:|---|
| goalsPerPossession | 0.422 | played attacking episodes |
| fieldAttemptsPerPossession | 0.646 | played attacking episodes |
| totalAttemptsPerPossession | 0.702 | played attacking episodes |
| freeThrowsPerPossession | 0.088 | played attacking episodes |
| passesPerPossession | 7.439 | played attacking episodes |
| broadLossesPerPossession | 0.305 | played attacking episodes |
| nonShotLossesPerPossession | 0.300 | played attacking episodes |
| fieldConversion | 59.02% | ordinary field attempts, excludes 7m/GK |
| sevenMetreConversion | 73.14% | 7m attempts |
| outfieldIncludingSevenMetreConversion | 60.15% | ordinary field +7m attempts |
| allActorConversion | 60.15% | all actor attempts |

### Exclusive terminal budget

| Ending | Episodes | Share |
|---|---:|---:|
| GOAL | 2311 | 42.23% |
| SHOT_OUTCOME | 1417 | 25.89% |
| TURNOVER | 1670 | 30.51% |
| OFFENSIVE_FOUL | 0 | 0.00% |
| HALF_END | 75 | 1.37% |
| OTHER | 0 | 0.00% |
| UNRESOLVED | 0 | 0.00% |

`SHOT_OUTCOME` relabels the counter legacy name `FIELD_SHOT_MISS_SAVE`: it can include a 7m shot outcome and is not an ordinary-field-only bucket. Shot-bearing/7m flags are independent; never add them again to these exclusive endings.

| Exclusive loss cause | Count | Share of losses | Per played episode | Mean / match |
|---|---:|---:|---:|---:|
| BAD_PASS_OUT | 115 | 6.89% | 2.10% | 2.875 |
| BALL_CONTROL_LOSS_UNSPECIFIED | 0 | 0.00% | 0.00% | 0.000 |
| DEFLECTED_PASS_RECOVERED | 525 | 31.44% | 9.59% | 13.125 |
| DROPPED_RECEPTION | 100 | 5.99% | 1.83% | 2.500 |
| FAILED_RECEIVE_UNSPECIFIED | 0 | 0.00% | 0.00% | 0.000 |
| INTERCEPTION | 816 | 48.86% | 14.91% | 20.400 |
| OFFENSIVE_FOUL | 0 | 0.00% | 0.00% | 0.000 |
| OTHER | 0 | 0.00% | 0.00% | 0.000 |
| PASSIVE_PLAY | 48 | 2.87% | 0.88% | 1.200 |
| TECHNICAL_RULE_VIOLATION | 66 | 3.95% | 1.21% | 1.650 |

Shot-bearing loss episodes: 27. These are genuine terminal losses after a retained earlier shot, rather than errors inferred from every save/rebound. 7m-bearing episodes: 309; 7m-only episodes: 297. Neither is a new mutually exclusive ending.

### Free-throw continuations, duration and passing

| Free-throw chain | Played episodes | Mean duration (s) | p90 | Max |
|---|---:|---:|---:|---:|
| ZERO | 5036 | 25.016 | 41.975 | 126.350 |
| ONE | 396 | 40.169 | 57.550 | 113.400 |
| TWO | 39 | 50.601 | 69.710 | 110.450 |
| THREE_PLUS | 2 | 66.700 | 76.860 | 79.400 |

Free throws within shot-bearing episodes: 374; within eventually lost episodes: 109. These overlap when a shot-bearing episode later loses the ball. Ordered whistle-before-later-shot: 370; whistle-before-terminal-loss: 109 (ORDERED_WHISTLE_TO_LATER_SHOT). Episode membership alone is not presented as proof a whistle preceded its shot.

| Clock segment | Frikast |
|---|---:|
| 0-15 | 116 |
| 15-30 | 122 |
| 30-45 | 120 |
| 45-60 | 122 |

| Episode sample | n | Mean | Median | p90 | p95 | Max |
|---|---:|---:|---:|---:|---:|---:|
| All duration seconds | 5473 | 26.310 | 23.650 | 44.500 | 51.120 | 126.350 |
| 7m-bearing duration seconds | 309 | 32.224 | 29.650 | 48.120 | 54.610 | 84.000 |
| Passes per played episode | 5473 | 7.439 | 6.000 | 14.000 | 17.000 | 90.000 |
| Passes in shot-bearing episode | 3756 | 7.722 | 6.000 | 15.000 | 18.000 | 90.000 |
| Passes in lost episode | 1670 | 6.965 | 5.500 | 14.000 | 17.000 | 44.000 |

Duration uses elapsed official clock inside the episode, including running-clock restart preparation and excluding stopped-clock halftime/timeout. NO_REFERENCE applies; no exact empirical possession-duration target is invented.

### Historical reader, current UI and played episodes

| Same-event reader/unit | Attacks/episodes | Broad losses | No-shot losses |
|---|---:|---:|---:|
| Historical2017385 canonical raw-ID reader | 5459 | 1831 | 1643 |
| Current canonical raw-ID reader | 5458 | 1670 | See per-match raw ledger |
| Independent period/recall-aware played episodes | 5473 | 1670 | 1643 |

Retained physical-v1.1 benchmark broad losses averaged 45.775 per match; current UI 41.750; independent episodes 41.750. Historical no-shot subtotal is a separate quantity. Played-versus-current-raw-ID episode difference: 15. Current-UI versus historical broad-loss difference: -161. These are reader/unit corrections on identical trajectories, not changes to how a match played.

### Technical contexts and integrity

Raw post-event actor snapshots; sample-weighted sums, never unweighted means of match means. Failed/(received+failed) counts named reception incidents, including own-recovered fumbles, and is not terminal possession loss. INTERCEPTION snapshots describe the intercepting actor, not the losing passer.

difficulty is the value actually recorded on that event; catch difficulty is normally UNRECORDED. releaseDifficulty explicitly joins that actionId to PASS_RELEASED and labels throw difficulty, not intrinsic catch difficulty.

Recorded risk is available only on RECEPTION_FAILED. Mean recorded failed-catch risk is not an average risk over all catches or a predicted failure rate.

| Receiver fatigue | Received | Failed | Failed / (received + failed) |
|---|---:|---:|---:|
| MODERATE | 26721 | 372 | 1.37% |
| READY | 11250 | 99 | 0.87% |
| SEVERE | 291 | 2 | 0.68% |

Pressure, acute, intrinsic recorded difficulty and action-linked release-difficulty views use the same denominator discipline in JSON. Different contexts/selection/roles confound these associations; they are not causal fatigue experiments.

Integrity anomaly entries: **0**. Category goal numerators complete: true. Original/reconciled reports, all per-match integrity fields, same-ID ending changes and source-manifest differences remain in JSON.

## Reference limits and retained evidence

Approved frozen reference distributions are reused only for matched definitions. Ordinary field attempts exclude7m/GK; the HBL outfield-attempt reference includes7m and excludes keepers. Allsvenskan has no retained complete attempt/technical-error reference in this source package. Official technical errors are **NO_DIRECT_COMPARISON** to broad terminal losses or the narrow engine rule counter. Possessions, duration, Frikast and transition/cycle timing are **NO_REFERENCE**.

[Ball-loss taxonomy](BALL-LOSS-TAXONOMY.md), [attribute coverage](ATTRIBUTE-COVERAGE.md), [differentiation scorecard](DIFFERENTIATION-SCORECARD.md), [missing exact human-match evidence](HUMAN-QA.json). The human Torslanda 20-33 IFK Tumba case is not reconstructed from aggregate totals. No empirical files, simulation coefficients, match trajectories or original raw manifests were changed by this report.
