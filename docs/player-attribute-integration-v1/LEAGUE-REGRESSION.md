# League regression: matched40 +40

Both leagues reuse the exact pre-integration recipes, fixtures, seeds, raw rating branches and database identities. Before outcomes are read from preserved cores, without simulation. After outcomes use the frozen final source. All80 new cores and80 retained cores are hash-verified. No means are compensated or calibrated.

## hbl —40 matches /80 team appearances

| Metric | Before mean per match | After mean per match | Change |
|---|---|---|---|
| goals | 57.900 | 66.925 | 9.025 |
| fieldAttempts | 87.575 | 103.825 | 16.250 |
| sevenMetres | 7.025 | 7.250 | 0.225 |
| totalAttempts | 94.600 | 111.075 | 16.475 |
| fieldGoals | 52.300 | 61.325 | 9.025 |
| sevenMetreGoals | 5.600 | 5.600 | 0.000 |
| keeperGoals | 0.000 | 0.000 | 0.000 |
| saves | 20.650 | 23.075 | 2.425 |
| suspensions | 4.250 | 3.550 | -0.700 |
| broadBallLosses | 44.550 | 40.175 | -4.375 |
| possessions | 137.550 | 149.575 | 12.025 |
| freeThrows | 11.575 | 11.950 | 0.375 |
| passes | 1051.350 | 993.250 | -58.100 |

Retained source fallback player appearances: before 0, after 0. Same retained role/rating-branch mismatches use documented raw10 fallback in both phases; these appearances do not measure actual player quality.

| Pooled denominator/rate | Before | After |
|---|---|---|
| fieldConversion | 0.59720 | 0.59066 |
| sevenMetreConversion | 0.79715 | 0.77241 |
| shotsPerPossession | 0.68775 | 0.74260 |
| lossesPerPossession | 0.32388 | 0.26859 |
| freeThrowsPerPossession | 0.08415 | 0.07989 |
| passesPerPossession | 7.64340 | 6.64048 |
| meanPossessionSeconds | 26.17157 | 24.06803 |
| keeperSaveFraction | 0.26289 | 0.25639 |

### Exclusive broad-loss causes

| Cause | Before total | After total |
|---|---|---|
| BAD_PASS_OUT | 93 | 100 |
| INTERCEPTION | 989 | 703 |
| DROPPED_RECEPTION | 77 | 39 |
| DEFLECTED_PASS_RECOVERED | 529 | 593 |
| BALL_CONTROL_LOSS_UNSPECIFIED | 0 | 0 |
| FAILED_RECEIVE_UNSPECIFIED | 0 | 0 |
| TECHNICAL_RULE_VIOLATION | 69 | 90 |
| PASSIVE_PLAY | 25 | 49 |
| OFFENSIVE_FOUL | 0 | 0 |
| OTHER | 0 | 0 |
| DRIBBLE_CONTROL_LOSS | 0 | 33 |

### Native-position contributions

| Position | Before attempts / goals / conv / attempt% / goal% | After attempts / goals / conv / attempt% / goal% |
|---|---|---|
| V6 | 665 / 322 / 0.4842 / 17.57% / 13.90% | 683 / 306 / 0.4480 / 15.37% / 11.43% |
| V9 | 831 / 536 / 0.6450 / 21.96% / 23.14% | 1209 / 753 / 0.6228 / 27.21% / 28.13% |
| M9 | 722 / 511 / 0.7078 / 19.08% / 22.06% | 766 / 535 / 0.6984 / 17.24% / 19.99% |
| M6 | 630 / 415 / 0.6587 / 16.65% / 17.92% | 552 / 351 / 0.6359 / 12.42% / 13.11% |
| H9 | 460 / 302 / 0.6565 / 12.16% / 13.04% | 714 / 449 / 0.6289 / 16.07% / 16.77% |
| H6 | 476 / 230 / 0.4832 / 12.58% / 9.93% | 519 / 283 / 0.5453 / 11.68% / 10.57% |
| GK | 0 / 0 / UNAVAILABLE / 0.00% / 0.00% | 0 / 0 / UNAVAILABLE / 0.00% / 0.00% |

### Scorer concentration and defensive context

| Metric | Before | After |
|---|---|---|
| Mean top scorer share | 0.2638 | 0.2812 |
| Mean top3 share | 0.6129 | 0.6245 |
| Highest individual goals | 13 | 16 |
| beaten per match | 18.925 | 13.300 |
| wrongFooted per match | 54.750 | 31.125 |
| legalContacts per match | 853.375 | 691.975 |
| whistleRestarts per match | 18.600 | 19.200 |

### Player variance by a named shooting attribute

| Band / phase | Player-matches | Mean / p90 / max goals | Zero-goal matches |
|---|---|---|---|
| lowerPlacement / before | 167 | 2.024 / 5 / 10 | 46 |
| lowerPlacement / after | 166 | 2.229 / 5 / 12 | 42 |
| middlePlacement / before | 265 | 3.147 / 7 / 13 | 29 |
| middlePlacement / after | 269 | 3.253 / 7 / 13 | 30 |
| upperPlacement / before | 296 | 3.865 / 7 / 11 | 15 |
| upperPlacement / after | 291 | 4.921 / 9 / 16 | 13 |
## allsv —40 matches /80 team appearances

| Metric | Before mean per match | After mean per match | Change |
|---|---|---|---|
| goals | 57.775 | 67.300 | 9.525 |
| fieldAttempts | 88.325 | 104.425 | 16.100 |
| sevenMetres | 7.725 | 7.825 | 0.100 |
| totalAttempts | 96.050 | 112.250 | 16.200 |
| fieldGoals | 52.125 | 61.500 | 9.375 |
| sevenMetreGoals | 5.650 | 5.800 | 0.150 |
| keeperGoals | 0.000 | 0.000 | 0.000 |
| saves | 22.825 | 23.050 | 0.225 |
| suspensions | 6.325 | 5.725 | -0.600 |
| broadBallLosses | 41.750 | 37.775 | -3.975 |
| possessions | 136.825 | 148.675 | 11.850 |
| freeThrows | 12.000 | 12.200 | 0.200 |
| passes | 1017.800 | 979.750 | -38.050 |

Retained source fallback player appearances: before 22, after 22. Same retained role/rating-branch mismatches use documented raw10 fallback in both phases; these appearances do not measure actual player quality.

| Pooled denominator/rate | Before | After |
|---|---|---|
| fieldConversion | 0.59015 | 0.58894 |
| sevenMetreConversion | 0.73139 | 0.74121 |
| shotsPerPossession | 0.70199 | 0.75500 |
| lossesPerPossession | 0.30513 | 0.25408 |
| freeThrowsPerPossession | 0.08770 | 0.08206 |
| passesPerPossession | 7.43870 | 6.58988 |
| meanPossessionSeconds | 26.31019 | 24.21243 |
| keeperSaveFraction | 0.28319 | 0.25512 |

### Exclusive broad-loss causes

| Cause | Before total | After total |
|---|---|---|
| BAD_PASS_OUT | 115 | 108 |
| INTERCEPTION | 816 | 572 |
| DROPPED_RECEPTION | 100 | 64 |
| DEFLECTED_PASS_RECOVERED | 525 | 573 |
| BALL_CONTROL_LOSS_UNSPECIFIED | 0 | 0 |
| FAILED_RECEIVE_UNSPECIFIED | 0 | 0 |
| TECHNICAL_RULE_VIOLATION | 66 | 66 |
| PASSIVE_PLAY | 48 | 70 |
| OFFENSIVE_FOUL | 0 | 0 |
| OTHER | 0 | 0 |
| DRIBBLE_CONTROL_LOSS | 0 | 58 |

### Native-position contributions

| Position | Before attempts / goals / conv / attempt% / goal% | After attempts / goals / conv / attempt% / goal% |
|---|---|---|
| V6 | 624 / 344 / 0.5513 / 16.24% / 14.89% | 655 / 329 / 0.5023 / 14.59% / 12.22% |
| V9 | 639 / 381 / 0.5962 / 16.63% / 16.49% | 866 / 537 / 0.6201 / 19.29% / 19.95% |
| M9 | 797 / 559 / 0.7014 / 20.74% / 24.19% | 879 / 601 / 0.6837 / 19.58% / 22.33% |
| M6 | 599 / 334 / 0.5576 / 15.59% / 14.45% | 540 / 308 / 0.5704 / 12.03% / 11.44% |
| H9 | 784 / 474 / 0.6046 / 20.41% / 20.51% | 1080 / 666 / 0.6167 / 24.05% / 24.74% |
| H6 | 371 / 208 / 0.5606 / 9.66% / 9.00% | 433 / 241 / 0.5566 / 9.64% / 8.95% |
| GK | 28 / 11 / 0.3929 / 0.73% / 0.48% | 37 / 10 / 0.2703 / 0.82% / 0.37% |

### Scorer concentration and defensive context

| Metric | Before | After |
|---|---|---|
| Mean top scorer share | 0.2514 | 0.2801 |
| Mean top3 share | 0.5973 | 0.6207 |
| Highest individual goals | 13 | 19 |
| beaten per match | 20.050 | 13.400 |
| wrongFooted per match | 43.050 | 22.125 |
| legalContacts per match | 849.350 | 667.700 |
| whistleRestarts per match | 19.725 | 20.025 |

### Player variance by a named shooting attribute

| Band / phase | Player-matches | Mean / p90 / max goals | Zero-goal matches |
|---|---|---|---|
| lowerPlacement / before | 186 | 2.452 / 5 / 12 | 29 |
| lowerPlacement / after | 187 | 2.508 / 6 / 11 | 32 |
| middlePlacement / before | 304 | 2.730 / 5 / 10 | 35 |
| middlePlacement / after | 299 | 3.050 / 6 / 11 | 30 |
| upperPlacement / before | 243 | 4.173 / 7 / 13 | 10 |
| upperPlacement / after | 245 | 5.310 / 10 / 19 | 4 |

## Interpretation and deferred empirical work

Scoring, attempts, pace and loss shares may drift because actual selection, release/control and defensive execution now differ. These paired full matches are an observational system regression; individual causal effects come from the controlled encounters. Changes in event order rapidly diverge stochastic trajectories, including source-specific synthetic template construction; full-match deltas cannot identify one coefficient.

Before calibration, review the retained Allsvenskan role/rating-branch input mismatches; no ratings or frozen population logic were repaired here. Empirical Reconciliation v1.2 should then investigate opportunity/attempt and possession volume, marginal shot/pass timing, defensive arrival/recovery and wing aim/keeper interaction. Then assess category-specific field conversion, keeper faced-shot denominators,7m conversion/frequency, sanctions and causal loss subtypes against semantically matched evidence. It must preserve the new player differentiation and avoid repairing aggregate means with overall multipliers, quotas or blanket error lotteries. No direct target is set from official ~20.25 technical errors for broad Bollförlust. Possession, Frikast and duration still lack matched references.

Stars may concentrate opportunities and have exceptional matches; weaker profiles can also score well. Native positions and placement bands are transparent developer groupings, not execution inputs. They are confounded by minutes, team strength, role and opportunity; no forced hierarchy, scorer cap or position quota is imposed. Frikast stays canonical and presentation is unchanged.

Whistle restarts count canonical WHISTLE_RESTART events, not every FOUL incident or played-on advantage. The separate controlled defensive-continuation table reports actual FOUL events.
