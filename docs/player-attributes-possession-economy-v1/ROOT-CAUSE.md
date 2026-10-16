# Root cause: ball losses, possession volume and attribute integration

The exact Torslanda 20-33 IFK Tumba Human-QA match remains **UNAVAILABLE for forensic reconstruction**. Its 27/20 broad losses cannot be decomposed without its event stream or save. The matched cohorts confirm broad label semantics, pure-reader errors and genuine interception/deflection losses. They do not establish excessive official-equivalent technical errors, possession volume or fatigue.

Sources: [ECONOMY.json](ECONOMY.json), [possession economy](POSSESSION-ECONOMY.md), [taxonomy](BALL-LOSS-TAXONOMY.md), [controlled sensitivity](ATTRIBUTE-SENSITIVITY.md), [attribute coverage](ATTRIBUTE-COVERAGE.md), [scorecard](DIFFERENTIATION-SCORECARD.md), [human-match availability](HUMAN-QA.json). No outcome coefficients or simulation trajectories were tuned.

## A-G classification

| Requested cause | Exact Human-QA case | Cohort result and limit |
|---|---|---|
| A. TRUE EXCESSIVE TECHNICAL ERROR RATE | UNAVAILABLE | **NOT ESTABLISHED; NO_DIRECT_COMPARISON.** Official HBL recorded technical errors, broad UI losses and the narrow engine rule counter have different definitions. |
| B. EXCESSIVE POSSESSION VOLUME | UNAVAILABLE | Volume measured; excess **NOT ESTABLISHED**. Means are 137.550/136.825 played episodes per match. There is NO_REFERENCE for an equivalent empirical denominator. |
| C. EXCESSIVE INTERCEPTION RATE | UNAVAILABLE | A major component is **CONFIRMED**, but excess is not established: 24.725/20.400 per match, or 2.352%/2.004% of pass releases. No matched official interception reference establishes excess. |
| D. EXCESSIVE RECEPTION/CONTROL ERROR | UNAVAILABLE | Actual fumbles are confirmed, but are not the dominant terminal-loss component. Failures are 1.087%/1.221% of recorded catch outcomes; most are recovered. Coherent technical-profile catch reversals remain a targeted question. |
| E. DOUBLE COUNTING | UNAVAILABLE for the exact 47 | **Reader artifacts CONFIRMED and corrected.** Shot/transfer classification and same-tick recalled-advantage provisional ownership inflated old loss/attack readings. Multiple explanatory events are not simply added as turnovers. |
| F. BROAD SEMANTIC LABEL MAKES NUMBER LOOK WORSE | Product definition confirmed; exact breakdown unavailable | **CONFIRMED.** Bollförluster counts broad attacking losses. Interceptions plus opponent recoveries of defensive deflections account for 85.19%/80.30% of current losses. This is not 47 registered technical errors. |
| G. MULTIPLE CAUSES | No exact forensic verdict | **Best supported cohort classification:** broad semantics, corrected reader defects and genuine pass/defensive interaction volume. Attribute gaps are independently confirmed, but their share of these losses has not been causally identified. |

The exact human facts remain user-provided: score 20-33, shots 43/49, broad losses 27/20, 7m 3/6 versus 4/4, suspensions 2/5. Actual possessions, Frikast and loss subtypes remain null/UNAVAILABLE. Subtracting the cohort-average correction from 27/20 would fabricate a reconstruction. The human total 47 lies within current cohort match-loss ranges (HBL 32-59; Allsvenskan 29-55), but that observation neither validates the particular match nor proves its rate realistic.

## Same trajectories, corrected readers

All figures below are per match unless identified as pooled. Both cohorts contain 40 matches and 80 team-matches.

| Quantity | HBL | Allsvenskan |
|---|---:|---:|
| Historical 2017385 broad UI losses | 49.200 | 45.775 |
| Current canonical UI broad losses | 44.550 | 41.750 |
| Independent played-episode broad losses | 44.550 | 41.750 |
| Current no-shot-only losses | 44.050 | 41.075 |
| Historical raw-ID attacks | 137.250 | 136.475 |
| Current canonical raw-ID attacks | 137.225 | 136.450 |
| Independent period/recall-aware played episodes | 137.550 | 136.825 |
| Goals, unchanged | 57.900 | 57.775 |
| All-actor attempts, unchanged | 94.600 | 96.050 |
| Released passes | 1051.350 | 1017.800 |

The broad-loss correction removes **186 HBL entries (4.650 per match)** and **161 Allsvenskan entries (4.025 per match)**. Historical `RECEPTION_FAILED` endings become actual blocked-shot rebound outcomes 193/174 times. Conversely, some later genuine losses after retained shots are restored. Last-action authority also changes some interception/rule categories without changing loss totals. One provisional raw-ID attack is removed per league after same-tick recalled advantage with no opponent play. None of this reduces simulated turnover probability.

The exact same-ID reconciliation removes 194 historical false loss classifications and reveals 8 previously masked genuine losses in HBL (net -186), with 6 further loss-class reclassifications. Allsvenskan removes 174 false losses and reveals 13 genuine ones (net -161), with 4 further class reclassifications. Historical-only/current-only records contribute zero losses. This is not naive addition of bad-pass, interception and transfer events as three turnovers: each attack already had one terminal reading; some readings and provisional awards were wrong.

The remaining played-versus-current-raw-ID episode differences are 13/15 across the cohorts. Period/recall units are separate from the 186/161 loss corrections. Current UI and independent broad losses agree exactly; both final integrity anomaly lists are empty. Consistent bookkeeping does not establish realistic event rates or desirable continuity.

## Exclusive terminal-loss causes

| Cause | HBL count | HBL /match | HBL share | Allsv count | Allsv /match | Allsv share |
|---|---:|---:|---:|---:|---:|---:|
| INTERCEPTION | 989 | 24.725 | 55.50% | 816 | 20.400 | 48.86% |
| DEFLECTED_PASS_RECOVERED | 529 | 13.225 | 29.69% | 525 | 13.125 | 31.44% |
| BAD_PASS_OUT | 93 | 2.325 | 5.22% | 115 | 2.875 | 6.89% |
| DROPPED_RECEPTION | 77 | 1.925 | 4.32% | 100 | 2.500 | 5.99% |
| TECHNICAL_RULE_VIOLATION | 69 | 1.725 | 3.87% | 66 | 1.650 | 3.95% |
| PASSIVE_PLAY | 25 | 0.625 | 1.40% | 48 | 1.200 | 2.87% |
| OFFENSIVE_FOUL | 0 | 0 | 0 | 0 | 0 | 0 |
| Unspecified control/reception and OTHER buckets | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total broad losses** | **1782** | **44.550** | **100%** | **1670** | **41.750** | **100%** |

Zero offensive fouls means **UNSUPPORTED coverage**: no current canonical offensive-foul producer exists. It is not proof that this action was realistically simulated and simply absent. Defensive deflection plus opponent recovery is not relabelled as a bad dribble or offensive foul.

## Per release, per catch and per possession are different units

| Exposure-normalized measure | HBL | Allsvenskan |
|---|---:|---:|
| Broad losses / played episodes | 32.388% | 30.513% |
| Terminal interceptions / pass releases | 2.352% | 2.004% |
| Terminal deflected-pass recoveries / releases | 1.258% | 1.290% |
| Terminal bad-pass-out / releases | 0.221% | 0.282% |
| Terminal dropped receptions / releases | 0.183% | 0.246% |
| Named failed / (received + failed) catches | 433/39818 = 1.087% | 473/38735 = 1.221% |
| Own recovery / named fumbles | 356/433 = 82.22% | 373/473 = 78.86% |
| Pass releases / played episode | 7.643 | 7.439 |

There are 42,054/40,712 pass releases across the cohorts. Roughly 2% intercepted per release can contribute 20-25 terminal losses per match at that exposure. This is not a 20-25% failure chance on each pass. Opportunities within the same attack are dependent; no independent-pass survival formula is used to predict match totals.

Named fumbles 433/473 are incidents, not that many turnovers: 356/373 are recovered by the attacking team. Terminal bad-pass-out plus dropped-reception candidates total 170/215 (4.250/5.375 per match). This narrower subset is still not proven equivalent to official HBL technical errors. The reference mean about 20.25 is therefore labelled **NO_DIRECT_COMPARISON**, rather than used as a target to halve broad losses.

## Posthoc fatigue, acute, pressure and difficulty

Failure denominators count `PASS_RECEIVED + RECEPTION_FAILED`, including retained fumbles. Contexts are post-event actor snapshots. Interception energy belongs to the **intercepting defender**, not the losing passer. Catch intrinsic difficulty is generally UNRECORDED; `releaseDifficulty` explicitly joins the same action ID to its throw difficulty. Mean recorded catch risk exists only for failed catches, not all catches.

Diagnostic labels: SEVERE energy<.3 or energy<.4 with acute>.35; READY energy>=.7 and acute<.35; otherwise MODERATE. Acute HIGH>=.6. Pressure LOW<.2, MEDIUM .2..<1, HIGH>=1. Release difficulty SIMPLE<.2, MODERATE .2..=.5, DIFFICULT>.5. These are developer labels, not physiological thresholds.

| Receiver context | HBL failures / outcomes | HBL rate | Allsv failures / outcomes | Allsv rate |
|---|---:|---:|---:|---:|
| Fatigue READY | 133/15695 | 0.847% | 99/11349 | 0.872% |
| Fatigue MODERATE | 299/23942 | 1.249% | 372/27093 | 1.373% |
| Fatigue SEVERE | 1/181 | 0.552% | 2/293 | 0.683% |
| Acute HIGH | 0/7 | 0% | 0/11 | 0% |
| Acute LOWER | 433/39811 | 1.088% | 473/38724 | 1.221% |
| Pressure LOW | 349/36572 | 0.954% | 372/35789 | 1.039% |
| Pressure MEDIUM | 83/3213 | 2.583% | 101/2931 | 3.446% |
| Pressure HIGH | 1/33 | 3.030% | 0/15 | 0% |
| Release difficulty SIMPLE | 194/19820 | 0.979% | 183/18616 | 0.983% |
| Release difficulty MODERATE | 195/17142 | 1.138% | 229/17167 | 1.334% |
| Release difficulty DIFFICULT | 44/2856 | 1.541% | 61/2952 | 2.066% |

MODERATE has a higher pooled observed catch-failure rate than READY. SEVERE and HIGH-acute samples are too small and selected to support a zero-risk or protective-fatigue conclusion. High-pressure catcher samples are only 33/15 outcomes; they must not be confused with thousands of high-pressure throw releases.

| Throw difficulty | HBL mean error (m), release n | Allsv mean error (m), release n |
|---|---:|---:|
| SIMPLE | 0.0718, 19991 | 0.0797, 18756 |
| MODERATE | 0.1529, 18611 | 0.1713, 18454 |
| DIFFICULT | 0.2207, 3452 | 0.2487, 3502 |

The following cross-tabs hold the reported pressure and release-difficulty bands fixed. They still mix players, roles, exact geometry and decisions, so they narrow confounding without identifying a causal fatigue contribution.

| Receiver pressure / release difficulty | HBL READY failures/n | HBL MODERATE failures/n | Allsv READY failures/n | Allsv MODERATE failures/n |
|---|---:|---:|---:|---:|
| LOW / SIMPLE | 68/8201 (0.829%) | 96/10421 (0.921%) | 45/5829 (0.772%) | 114/11821 (0.964%) |
| LOW / MODERATE | 35/5546 (0.631%) | 118/9829 (1.201%) | 27/4163 (0.649%) | 150/11254 (1.333%) |
| LOW / DIFFICULT | 9/711 (1.266%) | 22/1696 (1.297%) | 7/606 (1.155%) | 27/1867 (1.446%) |
| MEDIUM / MODERATE | 11/661 (1.664%) | 30/1015 (2.956%) | 10/421 (2.375%) | 41/1162 (3.528%) |
| MEDIUM / DIFFICULT | 4/165 (2.424%) | 9/255 (3.529%) | Sparse; see JSON | 19/343 (5.539%) |

No share of the 1,782/1,670 losses is attributed causally to fatigue from these contexts. In particular, grouping interceptions by interceptor energy cannot estimate fatigue-induced losing-pass risk.

## Controlled fatigue and technical differentiation

The corrected controlled harness changes energy/acute or named attributes in the same actor/state/seed context. All 11 physical ratings are held equal across coherent technical-profile comparisons. Individual PASSING difficult-release error declines 0.2933 to 0.1858m across observed low/high ratings. At the median profile, difficult error rises 0.2503 fresh to 0.3664m tired; simple error rises 0.0523 to 0.0646m. Difficult execution has the larger absolute deterioration. These are release signals, not a league turnover probability or physiological validation.

Coherent technical profiles score 49/64 low versus 59/64 high on the same difficult central shot fresh, and 45/64 versus 54/64 tired. Technique remains valuable with physical capacity held equal. Individual BALL_HANDLING difficult catches fail 4/128 versus 3/128 fresh and 4/128 at both low/high tired: this finite sample does not establish a uniform realized catch gap.

The coupled catch reversal remains explicit: coherent low/median/high difficult+tired fumbles are 6/128, 4/128 and 11/128. Higher passing technique changes pace and reached collision context; centreRisk is not average realized risk. Wing technique narrows spread while goals fall 64/64 to 58/64 in its sampled geometry. These are bounded interpretation/follow-up questions, not reasons to force monotonic outcomes or set error quotas.

## Volume, Frikast and continuity

Episodes average 137.550/136.825 per match; shots average 94.600/96.050. Shots plus broad losses is invalid as a possession counter: retained rebounds permit multiple shots, while 20/27 shot-bearing episodes subsequently have a genuine loss. The denominator instead comes from ownership/period/recall reconstruction.

Frikast averages 11.575/12.000 per match. HBL chains are zero:5071, one:401, two:29, three-plus:1 across 5502 episodes; Allsvenskan zero:5036, one:396, two:39, three-plus:2 across 5473. Ordered whistles before a later shot total 337/370; whistles before a terminal loss 120/109. These are nonexclusive continuation histories, not additional endings.

There is **NO_REFERENCE** for exact possessions, duration or Frikast. Mean duration is 26.172/26.310 official seconds, median 23.650 in both. The HBL tail reaches 484.15 seconds and 483 passes in one episode; Allsvenskan maxima are 126.35 seconds and 90 passes. The extreme HBL continuity tail remains a gameplay limitation. Empty integrity anomaly lists do not establish that this tail is desirable or empirical.

## Frozen chronology

| League / frozen phase | Goals /match | Attempts /match | Broad UI losses /match | Narrow technical counter /match |
|---|---:|---:|---:|---:|
| HBL Rotation v1 | 58.650 | 94.850 | 49.750 | 1.400 |
| HBL Physical v1.1, historical reader | 57.900 | 94.600 | 49.200 | 1.500 |
| HBL current reader, same Physical v1.1 trajectory | 57.900 | 94.600 | 44.550 | 1.725* |
| Allsv Rotation v1 | 59.150 | 96.400 | 45.775 | 1.475 |
| Allsv Physical v1.1, historical reader | 57.775 | 96.050 | 45.775 | 1.375 |
| Allsv current reader, same Physical v1.1 trajectory | 57.775 | 96.050 | 41.750 | 1.650* |

*Current final terminal-rule counts use corrected last-action authority; their change is not a new simulation-rate measurement. Frozen values remain in the [physical-v1.1 distributions](../physical-load-fatigue-v11/DISTRIBUTIONS.json) and [report](../physical-load-fatigue-v11/REPORT.md).

The chronology does not support a claim that Physical Load v1.1 suddenly created broad losses: old-reader HBL losses moved 49.75 to 49.20, and Allsvenskan 45.775 stayed 45.775. Physical changes altered trajectories between those historical phases; the subsequent 44.55/41.75 totals are reader corrections on the same Physical v1.1 trajectories. They are not evidence of a fatigue nerf or improved decisions in this audit.

## Evidence-based next task

**B: a dedicated player-attribute integration phase is better supported than A: broad possession/turnover calibration.** There are 21 outcourt and 8 keeper keys absent from the adapter, a mapped-but-unread switching capacity, saturated off-ball readiness, screen/pivot skills concentrated in upstream choice, and no dedicated dribble-control uncertainty. Existing passing, duel, interception and physical consumers show meaningful effects and should be preserved.

This is bounded: missing domains do not prove they caused the exact human 27/20 losses, and the present evidence does not name a desired turnover, interception, possession or physiological fatigue target. The completed coverage and scorecard define the evidence for that separate phase; no new roadmap, artificial error penalty or global calibration is implemented here.
