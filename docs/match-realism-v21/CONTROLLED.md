# Canonical controlled contrasts

These are deterministic same-recipe comparisons with the corresponding BASELINE subset. Positive and unfavorable responses are both retained. Ratios are fractions in this compact table. Full per-case and delta distributions are in controlled-comparison.json.

## Observed direction and limitations

All 130 completed cases retained identical initial starting IDs/roles, exact source fingerprints and pinned input. Each tactical variant changed actual own tactics in all ten recipes without changing profiles. The JSON records actual initial tactics and every changed consumed profile field.

- QUICK increased own transition attempts 1.000 to 3.100, while passes per possession fell 8.782 to 7.430. WIDTH increased own wing share 5.71% to 8.11%, but required more circulation (10.352 passes per possession). COMBINATION reached 7.80% wing share with only a small goal-mean change. DIRECT reduced passes per possession to 7.325. No tactic is uniformly superior.
- FIVE_ONE increased own defensive interception endings 5.000 to 13.900, while opponent release pressure fell 0.629 to 0.475 and opponent goals rose 23.200 to 24.700. This is a measured tradeoff, not uniformly higher pressure at every shot.
- SHOOTER_STRONG/WEAK scored mean 35.900/6.200 own goals, versus baseline 21.500. KEEPER_STRONG/WEAK produced 57.78%/15.96% mean conventional saves, versus baseline 44.08%. Keeper perturbation changed a starting profile in only eight recipes: index0 changed a bench profile only and index8 had no changed consumed profile. Both remain in the ten-pair means; no rerun or silent exclusion repairs that limitation.
- PASSER_STRONG/WEAK had mean passing-loss endings 8.900/22.400. Strong passing did not improve that raw count against baseline 8.400, despite clearly separating from weak passing. This composite also changes handling, reading, decision and composure, so it is not a pure pass-accuracy experiment.
- RUNNER_FAST/SLOW changed own field distance to 39.477/34.678km and passing-loss endings to 7.500/16.500. Own transition attempts differed only modestly (1.900/1.700); more total transitions with slow runners cannot be described as a benefit to their own break. Speed, agility, explosiveness and endurance change together, and energy responds to actual minutes, movement and substitutions.

Each variant has ten fixed recipe pairs. Whole-match physical feedback and opponent CPU coaching remain active. These are not a league census, independent possession samples or a promise that strong wins every seed. Unfavorable signs remain visible, and no scoring or save quota is inferred.

| Variant | Pairs | Metric | Baseline mean | Variant mean | Mean paired delta | Same starting IDs/roles |
|---|---:|---|---:|---:|---:|---|
| COMBINATION | 10 | ownGoals | 21.500 | 21.800 | 0.300 | true |
| COMBINATION | 10 | ownShots | 45.800 | 42.500 | -3.300 | true |
| COMBINATION | 10 | ownMeanOpportunityQuality | 0.473 | 0.467 | -0.007 | true |
| COMBINATION | 10 | ownMeanPressure | 0.547 | 0.625 | 0.078 | true |
| COMBINATION | 10 | ownPassesPerPossession | 8.782 | 9.047 | 0.265 | true |
| COMBINATION | 10 | ownPassingLossEndings | 8.400 | 9.000 | 0.600 | true |
| COMBINATION | 10 | ownWingShare | 0.057 | 0.078 | 0.021 | true |
| COMBINATION | 10 | ownPivotShare | 0.044 | 0.061 | 0.017 | true |
| COMBINATION | 10 | ownTransitionShots | 1.000 | 0.900 | -0.100 | true |
| COMBINATION | 10 | opponentGoals | 23.200 | 22.200 | -1.000 | true |
| COMBINATION | 10 | opponentMeanPressure | 0.629 | 0.615 | -0.014 | true |
| COMBINATION | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.431 | -0.009 | true |
| DIRECT | 10 | ownGoals | 21.500 | 22.800 | 1.300 | true |
| DIRECT | 10 | ownShots | 45.800 | 47.300 | 1.500 | true |
| DIRECT | 10 | ownMeanOpportunityQuality | 0.473 | 0.473 | -0.000 | true |
| DIRECT | 10 | ownMeanPressure | 0.547 | 0.604 | 0.056 | true |
| DIRECT | 10 | ownPassesPerPossession | 8.782 | 7.325 | -1.457 | true |
| DIRECT | 10 | ownPassingLossEndings | 8.400 | 10.400 | 2.000 | true |
| DIRECT | 10 | ownWingShare | 0.057 | 0.055 | -0.002 | true |
| DIRECT | 10 | ownPivotShare | 0.044 | 0.027 | -0.017 | true |
| DIRECT | 10 | ownTransitionShots | 1.000 | 1.300 | 0.300 | true |
| DIRECT | 10 | opponentGoals | 23.200 | 24.500 | 1.300 | true |
| DIRECT | 10 | opponentMeanPressure | 0.629 | 0.634 | 0.005 | true |
| DIRECT | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.434 | -0.007 | true |
| FIVE_ONE | 10 | ownGoals | 21.500 | 24.800 | 3.300 | true |
| FIVE_ONE | 10 | ownShots | 45.800 | 50.300 | 4.500 | true |
| FIVE_ONE | 10 | ownMeanOpportunityQuality | 0.473 | 0.465 | -0.008 | true |
| FIVE_ONE | 10 | ownMeanPressure | 0.547 | 0.604 | 0.057 | true |
| FIVE_ONE | 10 | ownPassesPerPossession | 8.782 | 8.151 | -0.632 | true |
| FIVE_ONE | 10 | ownPassingLossEndings | 8.400 | 9.700 | 1.300 | true |
| FIVE_ONE | 10 | ownWingShare | 0.057 | 0.068 | 0.011 | true |
| FIVE_ONE | 10 | ownPivotShare | 0.044 | 0.043 | -0.001 | true |
| FIVE_ONE | 10 | ownTransitionShots | 1.000 | 1.800 | 0.800 | true |
| FIVE_ONE | 10 | opponentGoals | 23.200 | 24.700 | 1.500 | true |
| FIVE_ONE | 10 | opponentMeanPressure | 0.629 | 0.475 | -0.154 | true |
| FIVE_ONE | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.382 | -0.059 | true |
| KEEPER_STRONG | 10 | ownGoals | 21.500 | 21.800 | 0.300 | true |
| KEEPER_STRONG | 10 | ownShots | 45.800 | 45.400 | -0.400 | true |
| KEEPER_STRONG | 10 | ownMeanOpportunityQuality | 0.473 | 0.476 | 0.002 | true |
| KEEPER_STRONG | 10 | ownMeanPressure | 0.547 | 0.579 | 0.032 | true |
| KEEPER_STRONG | 10 | ownPassesPerPossession | 8.782 | 8.956 | 0.174 | true |
| KEEPER_STRONG | 10 | ownPassingLossEndings | 8.400 | 8.300 | -0.100 | true |
| KEEPER_STRONG | 10 | ownWingShare | 0.057 | 0.050 | -0.007 | true |
| KEEPER_STRONG | 10 | ownPivotShare | 0.044 | 0.058 | 0.014 | true |
| KEEPER_STRONG | 10 | ownTransitionShots | 1.000 | 0.900 | -0.100 | true |
| KEEPER_STRONG | 10 | opponentGoals | 23.200 | 17.900 | -5.300 | true |
| KEEPER_STRONG | 10 | opponentMeanPressure | 0.629 | 0.616 | -0.013 | true |
| KEEPER_STRONG | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.578 | 0.137 | true |
| KEEPER_WEAK | 10 | ownGoals | 21.500 | 22.600 | 1.100 | true |
| KEEPER_WEAK | 10 | ownShots | 45.800 | 45.000 | -0.800 | true |
| KEEPER_WEAK | 10 | ownMeanOpportunityQuality | 0.473 | 0.462 | -0.011 | true |
| KEEPER_WEAK | 10 | ownMeanPressure | 0.547 | 0.598 | 0.051 | true |
| KEEPER_WEAK | 10 | ownPassesPerPossession | 8.782 | 8.435 | -0.347 | true |
| KEEPER_WEAK | 10 | ownPassingLossEndings | 8.400 | 8.100 | -0.300 | true |
| KEEPER_WEAK | 10 | ownWingShare | 0.057 | 0.061 | 0.004 | true |
| KEEPER_WEAK | 10 | ownPivotShare | 0.044 | 0.034 | -0.010 | true |
| KEEPER_WEAK | 10 | ownTransitionShots | 1.000 | 0.900 | -0.100 | true |
| KEEPER_WEAK | 10 | opponentGoals | 23.200 | 34.300 | 11.100 | true |
| KEEPER_WEAK | 10 | opponentMeanPressure | 0.629 | 0.622 | -0.007 | true |
| KEEPER_WEAK | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.160 | -0.281 | true |
| PASSER_STRONG | 10 | ownGoals | 21.500 | 22.100 | 0.600 | true |
| PASSER_STRONG | 10 | ownShots | 45.800 | 45.500 | -0.300 | true |
| PASSER_STRONG | 10 | ownMeanOpportunityQuality | 0.473 | 0.472 | -0.002 | true |
| PASSER_STRONG | 10 | ownMeanPressure | 0.547 | 0.594 | 0.047 | true |
| PASSER_STRONG | 10 | ownPassesPerPossession | 8.782 | 8.483 | -0.299 | true |
| PASSER_STRONG | 10 | ownPassingLossEndings | 8.400 | 8.900 | 0.500 | true |
| PASSER_STRONG | 10 | ownWingShare | 0.057 | 0.096 | 0.039 | true |
| PASSER_STRONG | 10 | ownPivotShare | 0.044 | 0.055 | 0.011 | true |
| PASSER_STRONG | 10 | ownTransitionShots | 1.000 | 1.800 | 0.800 | true |
| PASSER_STRONG | 10 | opponentGoals | 23.200 | 23.300 | 0.100 | true |
| PASSER_STRONG | 10 | opponentMeanPressure | 0.629 | 0.595 | -0.034 | true |
| PASSER_STRONG | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.446 | 0.006 | true |
| PASSER_WEAK | 10 | ownGoals | 21.500 | 18.200 | -3.300 | true |
| PASSER_WEAK | 10 | ownShots | 45.800 | 36.500 | -9.300 | true |
| PASSER_WEAK | 10 | ownMeanOpportunityQuality | 0.473 | 0.460 | -0.014 | true |
| PASSER_WEAK | 10 | ownMeanPressure | 0.547 | 0.691 | 0.144 | true |
| PASSER_WEAK | 10 | ownPassesPerPossession | 8.782 | 6.932 | -1.850 | true |
| PASSER_WEAK | 10 | ownPassingLossEndings | 8.400 | 22.400 | 14.000 | true |
| PASSER_WEAK | 10 | ownWingShare | 0.057 | 0.123 | 0.066 | true |
| PASSER_WEAK | 10 | ownPivotShare | 0.044 | 0.031 | -0.013 | true |
| PASSER_WEAK | 10 | ownTransitionShots | 1.000 | 0.800 | -0.200 | true |
| PASSER_WEAK | 10 | opponentGoals | 23.200 | 24.400 | 1.200 | true |
| PASSER_WEAK | 10 | opponentMeanPressure | 0.629 | 0.620 | -0.009 | true |
| PASSER_WEAK | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.444 | 0.003 | true |
| QUICK | 10 | ownGoals | 21.500 | 23.100 | 1.600 | true |
| QUICK | 10 | ownShots | 45.800 | 47.800 | 2.000 | true |
| QUICK | 10 | ownMeanOpportunityQuality | 0.473 | 0.479 | 0.005 | true |
| QUICK | 10 | ownMeanPressure | 0.547 | 0.626 | 0.079 | true |
| QUICK | 10 | ownPassesPerPossession | 8.782 | 7.430 | -1.352 | true |
| QUICK | 10 | ownPassingLossEndings | 8.400 | 10.500 | 2.100 | true |
| QUICK | 10 | ownWingShare | 0.057 | 0.098 | 0.041 | true |
| QUICK | 10 | ownPivotShare | 0.044 | 0.053 | 0.009 | true |
| QUICK | 10 | ownTransitionShots | 1.000 | 3.100 | 2.100 | true |
| QUICK | 10 | opponentGoals | 23.200 | 25.200 | 2.000 | true |
| QUICK | 10 | opponentMeanPressure | 0.629 | 0.569 | -0.061 | true |
| QUICK | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.432 | -0.009 | true |
| RUNNER_FAST | 10 | ownGoals | 21.500 | 24.100 | 2.600 | true |
| RUNNER_FAST | 10 | ownShots | 45.800 | 48.900 | 3.100 | true |
| RUNNER_FAST | 10 | ownMeanOpportunityQuality | 0.473 | 0.487 | 0.013 | true |
| RUNNER_FAST | 10 | ownMeanPressure | 0.547 | 0.761 | 0.214 | true |
| RUNNER_FAST | 10 | ownPassesPerPossession | 8.782 | 6.150 | -2.632 | true |
| RUNNER_FAST | 10 | ownPassingLossEndings | 8.400 | 7.500 | -0.900 | true |
| RUNNER_FAST | 10 | ownWingShare | 0.057 | 0.104 | 0.047 | true |
| RUNNER_FAST | 10 | ownPivotShare | 0.044 | 0.028 | -0.016 | true |
| RUNNER_FAST | 10 | ownTransitionShots | 1.000 | 1.900 | 0.900 | true |
| RUNNER_FAST | 10 | opponentGoals | 23.200 | 25.700 | 2.500 | true |
| RUNNER_FAST | 10 | opponentMeanPressure | 0.629 | 0.618 | -0.012 | true |
| RUNNER_FAST | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.405 | -0.036 | true |
| RUNNER_SLOW | 10 | ownGoals | 21.500 | 21.400 | -0.100 | true |
| RUNNER_SLOW | 10 | ownShots | 45.800 | 41.200 | -4.600 | true |
| RUNNER_SLOW | 10 | ownMeanOpportunityQuality | 0.473 | 0.475 | 0.001 | true |
| RUNNER_SLOW | 10 | ownMeanPressure | 0.547 | 0.503 | -0.044 | true |
| RUNNER_SLOW | 10 | ownPassesPerPossession | 8.782 | 7.588 | -1.194 | true |
| RUNNER_SLOW | 10 | ownPassingLossEndings | 8.400 | 16.500 | 8.100 | true |
| RUNNER_SLOW | 10 | ownWingShare | 0.057 | 0.142 | 0.085 | true |
| RUNNER_SLOW | 10 | ownPivotShare | 0.044 | 0.031 | -0.013 | true |
| RUNNER_SLOW | 10 | ownTransitionShots | 1.000 | 1.700 | 0.700 | true |
| RUNNER_SLOW | 10 | opponentGoals | 23.200 | 26.200 | 3.000 | true |
| RUNNER_SLOW | 10 | opponentMeanPressure | 0.629 | 0.501 | -0.128 | true |
| RUNNER_SLOW | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.424 | -0.017 | true |
| SHOOTER_STRONG | 10 | ownGoals | 21.500 | 35.900 | 14.400 | true |
| SHOOTER_STRONG | 10 | ownShots | 45.800 | 51.800 | 6.000 | true |
| SHOOTER_STRONG | 10 | ownMeanOpportunityQuality | 0.473 | 0.483 | 0.009 | true |
| SHOOTER_STRONG | 10 | ownMeanPressure | 0.547 | 0.643 | 0.096 | true |
| SHOOTER_STRONG | 10 | ownPassesPerPossession | 8.782 | 6.791 | -1.991 | true |
| SHOOTER_STRONG | 10 | ownPassingLossEndings | 8.400 | 7.400 | -1.000 | true |
| SHOOTER_STRONG | 10 | ownWingShare | 0.057 | 0.046 | -0.011 | true |
| SHOOTER_STRONG | 10 | ownPivotShare | 0.044 | 0.039 | -0.005 | true |
| SHOOTER_STRONG | 10 | ownTransitionShots | 1.000 | 2.000 | 1.000 | true |
| SHOOTER_STRONG | 10 | opponentGoals | 23.200 | 24.500 | 1.300 | true |
| SHOOTER_STRONG | 10 | opponentMeanPressure | 0.629 | 0.606 | -0.023 | true |
| SHOOTER_STRONG | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.437 | -0.004 | true |
| SHOOTER_WEAK | 10 | ownGoals | 21.500 | 6.200 | -15.300 | true |
| SHOOTER_WEAK | 10 | ownShots | 45.800 | 39.300 | -6.500 | true |
| SHOOTER_WEAK | 10 | ownMeanOpportunityQuality | 0.473 | 0.395 | -0.079 | true |
| SHOOTER_WEAK | 10 | ownMeanPressure | 0.547 | 0.286 | -0.261 | true |
| SHOOTER_WEAK | 10 | ownPassesPerPossession | 8.782 | 13.340 | 4.557 | true |
| SHOOTER_WEAK | 10 | ownPassingLossEndings | 8.400 | 8.900 | 0.500 | true |
| SHOOTER_WEAK | 10 | ownWingShare | 0.057 | 0.023 | -0.034 | true |
| SHOOTER_WEAK | 10 | ownPivotShare | 0.044 | 0.059 | 0.015 | true |
| SHOOTER_WEAK | 10 | ownTransitionShots | 1.000 | 0.900 | -0.100 | true |
| SHOOTER_WEAK | 10 | opponentGoals | 23.200 | 20.700 | -2.500 | true |
| SHOOTER_WEAK | 10 | opponentMeanPressure | 0.629 | 0.631 | 0.001 | true |
| SHOOTER_WEAK | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.408 | -0.033 | true |
| WIDTH | 10 | ownGoals | 21.500 | 23.200 | 1.700 | true |
| WIDTH | 10 | ownShots | 45.800 | 45.000 | -0.800 | true |
| WIDTH | 10 | ownMeanOpportunityQuality | 0.473 | 0.456 | -0.017 | true |
| WIDTH | 10 | ownMeanPressure | 0.547 | 0.528 | -0.019 | true |
| WIDTH | 10 | ownPassesPerPossession | 8.782 | 10.352 | 1.570 | true |
| WIDTH | 10 | ownPassingLossEndings | 8.400 | 7.500 | -0.900 | true |
| WIDTH | 10 | ownWingShare | 0.057 | 0.081 | 0.024 | true |
| WIDTH | 10 | ownPivotShare | 0.044 | 0.066 | 0.022 | true |
| WIDTH | 10 | ownTransitionShots | 1.000 | 2.200 | 1.200 | true |
| WIDTH | 10 | opponentGoals | 23.200 | 21.200 | -2.000 | true |
| WIDTH | 10 | opponentMeanPressure | 0.629 | 0.600 | -0.029 | true |
| WIDTH | 10 | ownKeeperSavePctOnTarget | 0.441 | 0.427 | -0.014 | true |

Orientation/tempo changes are assessed on own attack. Own defence changes are assessed through the opponent's pressure/chance and own saves. Capability variants are composite physical skill contrasts. No score, shot-category or save quota is inferred. A changed starting lineup must be disclosed; weak sample support and unfavorable signs must remain visible.
