# Current engine baseline

Reference system: match-benchmarks/1. Simulation remained Match Realism v2.1 + Motion Continuity v1.
Engine source commit: 3de1ecc035294dfe0b81e4f1653379968cd917ba. N=20 completed canonical matches; competition swe-2; reference season 2026-27.

## Observed distributions

| Metric | N | Mean | SD | Median | p05–p95 | Range |
|---|---:|---:|---:|---:|---|---|
| goals | 20 | 50.650 | 10.246 | 53.000 | 33.900–64.150 | 32.000–67.000 |
| possessions | 20 | 129.800 | 7.120 | 130.000 | 119.900–136.700 | 118.000–150.000 |
| shots | 20 | 103.200 | 8.370 | 105.000 | 89.750–114.200 | 85.000–118.000 |
| saves | 20 | 43.650 | 7.936 | 43.500 | 32.900–58.050 | 31.000–59.000 |
| shotsFaced | 20 | 94.300 | 7.994 | 95.000 | 83.350–103.050 | 71.000–104.000 |
| conversion | 20 | 0.489 | 0.086 | 0.495 | 0.374–0.609 | 0.337–0.610 |
| savePct | 20 | 0.465 | 0.087 | 0.468 | 0.349–0.597 | 0.344–0.628 |
| goalsPerPossession | 20 | 0.390 | 0.073 | 0.407 | 0.266–0.486 | 0.261–0.508 |
| turnovers | 20 | 31.550 | 6.661 | 31.000 | 23.900–44.150 | 22.000–47.000 |
| technicalErrors | 20 | 2.650 | 1.899 | 2.000 | 0.000–6.000 | 0.000–6.000 |
| offensiveFouls | 20 | 0.000 | 0.000 | 0.000 | 0.000–0.000 | 0.000–0.000 |
| sevenMetres | 20 | 11.100 | 3.177 | 12.000 | 5.000–15.050 | 5.000–16.000 |
| sevenMetreConversion | 20 | 0.643 | 0.171 | 0.703 | 0.397–0.838 | 0.333–0.917 |
| suspensions | 20 | 11.850 | 3.498 | 12.000 | 6.000–16.150 | 6.000–19.000 |
| contacts | 20 | 633.300 | 33.627 | 630.000 | 581.150–674.600 | 565.000–705.000 |
| assessedFouls | 20 | 69.350 | 8.356 | 69.000 | 58.600–82.100 | 51.000–84.000 |
| advantages | 20 | 25.800 | 5.736 | 26.000 | 16.900–36.000 | 15.000–36.000 |
| whistles | 20 | 43.550 | 4.685 | 45.000 | 35.900–48.150 | 34.000–51.000 |
| freeThrows | 20 | 35.900 | 4.778 | 36.500 | 27.850–42.000 | 25.000–42.000 |
| possessionSeconds | 20 | 27.812 | 1.481 | 27.692 | 26.347–30.025 | 24.000–30.508 |
| transitionPossessions | 20 | 124.750 | 9.640 | 127.000 | 109.900–133.850 | 108.000–150.000 |
| transitionAttempts | 20 | 124.950 | 9.644 | 127.000 | 109.900–133.850 | 108.000–150.000 |
| transitionShots | 20 | 6.000 | 2.656 | 6.000 | 1.950–10.000 | 1.000–10.000 |
| transitionGoals | 20 | 2.850 | 1.268 | 3.000 | 1.000–5.000 | 1.000–5.000 |
| transitionConversion | 20 | 0.505 | 0.157 | 0.500 | 0.329–0.683 | 0.250–1.000 |
| transitionRate | 20 | 0.960 | 0.028 | 0.965 | 0.909–0.993 | 0.904–1.000 |

## Keeper and player distributions

- keeper saves: N=40, mean 21.825, median 21.500, p05–p95 13.000–31.000, range 12.000–33.000.
- keeper shotsFaced: N=40, mean 47.150, median 47.000, p05–p95 39.900–55.000, range 33.000–55.000.
- keeper savePct: N=40, mean 0.469, median 0.477, p05–p95 0.265–0.669, range 0.218–0.786.
- team goals: N=40, mean 25.325, median 26.000, p05–p95 11.950–36.250, range 9.000–43.000.
- team possessions: N=40, mean 64.900, median 65.000, p05–p95 59.950–68.350, range 59.000–75.000.
- team shots: N=40, mean 51.600, median 51.500, p05–p95 42.950–59.050, range 41.000–60.000.
- team scorerConcentration: N=40, mean 0.440, median 0.451, p05–p95 0.265–0.702, range 0.217–0.778.
- team shotConcentration: N=40, mean 0.419, median 0.409, p05–p95 0.238–0.590, range 0.224–0.691.

## Conditional saves and positional scoring

| Scope | N matches | N attempts | N on target | Goals | Saves | Save rate |
|---|---:|---:|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 20 | 776 | 685 | 373 | 312 | 0.455 |
| POSITION:V9 | 20 | 240 | 219 | 98 | 121 | 0.553 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 20 | 1434 | 1262 | 697 | 565 | 0.448 |
| QUALITY:LOWER_UNDER_0.65 | 20 | 1626 | 1448 | 742 | 706 | 0.488 |
| PHASE:ESTABLISHED | 20 | 1721 | 1556 | 813 | 743 | 0.478 |
| DISTANCE:8_TO_10.5M | 20 | 1170 | 1060 | 509 | 551 | 0.520 |
| CATEGORY:BREAKTHROUGH | 20 | 622 | 578 | 298 | 280 | 0.484 |
| POSITION:M9 | 20 | 997 | 920 | 514 | 406 | 0.441 |
| DISTANCE:UP_TO_8M | 20 | 730 | 699 | 423 | 276 | 0.395 |
| POSITION:H6 | 20 | 196 | 167 | 83 | 84 | 0.503 |
| QUALITY:HIGH_AT_LEAST_0.65 | 20 | 438 | 438 | 271 | 167 | 0.381 |
| CATEGORY:STANDING | 20 | 171 | 162 | 47 | 115 | 0.710 |
| POSITION:H9 | 20 | 302 | 282 | 136 | 146 | 0.518 |
| PRESSURE:LOW_UNDER_0.2 | 20 | 630 | 624 | 316 | 308 | 0.494 |
| CATEGORY:SEVEN_METRE | 20 | 222 | 222 | 143 | 79 | 0.356 |
| PHASE:RESTART | 20 | 223 | 223 | 143 | 80 | 0.359 |
| DISTANCE:BEYOND_10.5M | 20 | 164 | 127 | 81 | 46 | 0.362 |
| CATEGORY:WING | 20 | 195 | 162 | 119 | 43 | 0.265 |
| POSITION:V6 | 20 | 251 | 221 | 149 | 72 | 0.326 |
| CONTEXT:NEAR_SIX_METRE_AREA | 20 | 492 | 448 | 271 | 177 | 0.395 |
| CATEGORY:PIVOT | 20 | 78 | 77 | 33 | 44 | 0.571 |
| POSITION:M6 | 20 | 78 | 77 | 33 | 44 | 0.571 |
| PHASE:TRANSITION | 20 | 120 | 107 | 57 | 50 | 0.467 |

## Human QA: the 30-save concern

The largest raw-save cases and highest-rate cases are ranked separately. All values below are engine observations. No empirical conditional dataset exists, so there is no supported claim that a particular save percentage is normal, impossible, or a competition-standard outlier.

- Match 8, se_player_jonas_aberg_87cd5977: 33 saves / 42 on-target shots = 0.786. 45 released attempts. Wilson 95% interval 0.641–0.883. Mean decision quality 0.561, pressure 0.471, distance 8.598m. Category/context table: current-engine/REPORT.md and match JSON.

- Match 5, se_player_jonas_aberg_87cd5977: 31 saves / 48 on-target shots = 0.646. 54 released attempts. Wilson 95% interval 0.504–0.766. Mean decision quality 0.533, pressure 0.599, distance 8.807m. Category/context table: current-engine/REPORT.md and match JSON.

- Match 6, se_player_pontus_axelsson_3a4455c6: 31 saves / 51 on-target shots = 0.608. 58 released attempts. Wilson 95% interval 0.471–0.730. Mean decision quality 0.578, pressure 0.584, distance 8.635m. Category/context table: current-engine/REPORT.md and match JSON.

- Match 9, se_player_alexander_holmberg_3b1f68d9: 30 saves / 53 on-target shots = 0.566. 58 released attempts. Wilson 95% interval 0.433–0.690. Mean decision quality 0.556, pressure 0.717, distance 8.421m. Category/context table: current-engine/REPORT.md and match JSON.

- Match 9, se_player_olle_soderqvist_467b211d: 29 saves / 41 on-target shots = 0.707. 46 released attempts. Wilson 95% interval 0.555–0.824. Mean decision quality 0.544, pressure 0.557, distance 8.711m. Category/context table: current-engine/REPORT.md and match JSON.

Highest save-rate cases (at least 10 shots faced):
- Match 8: 33/42 = 0.786; keeper se_player_jonas_aberg_87cd5977.
- Match 9: 29/41 = 0.707; keeper se_player_olle_soderqvist_467b211d.
- Match 4: 22/33 = 0.667; keeper se_player_olle_soderqvist_467b211d.
- Match 5: 31/48 = 0.646; keeper se_player_jonas_aberg_87cd5977.
- Match 6: 31/51 = 0.608; keeper se_player_pontus_axelsson_3a4455c6.

Interpretation: raw saves are exactly shot volume multiplied by save rate. Category/quality/pressure data and actual goalkeeper/shooter capabilities distinguish exposure from execution context. They do not establish how much a capability *caused* the result without a validated expectation model or a controlled experiment. Inspect close-range low-pressure cases first, and compare them to pressured backcourt exposure. The current high cases justify investigation; no keeper coefficient was changed.

## Retained Motion Continuity side effects

The existing paired receipt uses N=20, with sourceStable=true. Source: docs/match-motion-continuity/final/comparison.json. These are engine-to-engine changes, not deviations from a real competition. The current batch is a separately declared seed/fixture pool and is not presented as a paired causal comparison.

| Historical metric | Before | Motion after | Relative change |
|---|---:|---:|---:|
| goals | 47.250 | 50.650 | 7.196% |
| possessions | 115.200 | 129.800 | 12.674% |
| shots | 92.650 | 103.200 | 11.387% |
| careerTurnovers | 27.800 | 31.550 | 13.489% |
| nonShotLoss | 24.000 | 26.100 | 8.750% |
| savePctOnTarget | 0.422 | 0.465 | 10.165% |
| transitionStarts | 111.550 | 124.950 | 12.013% |
| transitionShots | 2.350 | 6.000 | 155.319% |
| backcourtShare | 0.620 | 0.458 | -26.155% |
| wingShare | 0.067 | 0.094 | 39.558% |
| closeShare | 0.313 | 0.449 | 43.293% |
| contactWhistles | 21.100 | 43.550 | 106.398% |

Higher possession volume can raise shots, goals and turnovers together. More close-shot exposure changes the keeper denominator and category mix. Whistle growth must be evaluated against assessed fouls, advantage decisions and free-throw awards, not raw contact-event totals. Transition phase entries must be separated from transition released shots: a large phase-entry count does not imply a large fast-break conversion opportunity count. These decompositions are now reported explicitly.

## Evidence and confidence

5956/6282 comparisons have NO_REFERENCE; 0 evidence-backed outlier flags. This absence of flags is not an approval of realism. Engineering sanity exceptions: 24, explicitly separate from empirical distributions.

## Equality and runtime

Source fingerprints stable: true. Full-match proof:
```json
[
  {
    "index": 0,
    "fullMatch": true,
    "exactSessionEqual": true,
    "sessionHash": "5c20eceefe370b763128da0b44a58b80f03e14ce1da1281fdaa6cb1416f5a6fa",
    "resultHash": "c5f5818a2d8ed97dcb1a9086a272146be8bd88c97de18a8459e2ae728791ce8c",
    "observedMs": 12064.796,
    "unobservedMs": 13248.562600000001,
    "observerMs": 708.1074999999266,
    "analysisMs": 1934.0491000000002,
    "includes": [
      "result",
      "events",
      "rng",
      "archive frames",
      "core statistics"
    ],
    "postAnalysisSessionUnchanged": true
  }
]
```

Measured developer sample mean: simulation 7898.128ms, observer 413.881ms (included in simulation), post-match analysis 1156.915ms. Total batch 210.829 seconds. Concurrent regression suites can affect wall time. Normal player matches install no new observer and import no benchmark modules.

## Next calibration targets supported by measurement

1. Acquire keeper-attributed category/pressure reference data before deciding whether close-range saves or keeper capabilities are miscalibrated. Use the high-save and high-rate cases above as reproducible investigation fixtures.
2. Investigate shot quality and category mix alongside volume; compare pressured backcourt versus near-area/breakthrough attempts, retaining actual shooter/keeper capability values.
3. Revisit Motion whistle/advantage balance and possession endings with the explicit event denominators; the retained paired receipt establishes a measurable shift, not its real-world correctness.
4. Check transition phase entries versus shots/goals and positional shot/scoring concentration against future competition evidence. Do not tune the engine to this batch mean.

## Limitations

No populated empirical competitions or evidence-supported capability coefficients. Category reference coverage is zero. N=20 is a practical pilot, not a precise league estimate. Rates use descriptive engine pressure/quality bins, not independent expected goals. Per-shot score/manpower and exact defender proximity are not retained by the reused observer. Some positional creation/reception stats lack verified canonical contracts. Team-history effects and future-season evolution are not invented. A single paired timing is noisy. No developer dashboard or production UI was added.

## How to read the report

### Concrete keeper diagnosis

The 33-save case is Jonas Åberg in match index 8: 33/42 on target = 78.57%, with 45 total attempts. On-target exposure is below the sample's mean of 47.15 keeper shots faced, so this case is not principally an unusually large shot-volume count. The high observed save rate matters.

It is also not explained solely by pressured long shots: low-pressure shots were saved 12/15 (80%), high decision-quality shots 9/12 (75%), breakthroughs 7/9 (77.78%), and 7m shots 6/8 (75%). Backcourt jumps were 10/13 (76.92%); standing shots 7/7 and pivot 1/1 have tiny denominators. These contexts overlap and must not be added. Average release pressure was 0.471, decision quality 0.561 and distance 8.598m. The canonical keeper profile records reaction/close/explosiveness around 0.789, versus opposing shot placement around 0.627 and finishing around 0.609. These gameplay capabilities provide an ability hypothesis, not a documented expected save-rate adjustment. No raw CA/PA is involved.

The 30-save case is Alexander Holmberg in match index 9: 30/53 = 56.60%. That has materially more exposure and a lower save rate than the 33/42 case. Olle Söderqvist in the same match had fewer saves (29), yet a higher rate (29/41 = 70.73%). Pontus Axelsson's 31/51 case in index 6 includes 13/16 low-pressure saves and 8/11 high-quality saves. The framework therefore distinguishes volume from contextual performance and identifies the particular categories to investigate.

Across the batch, standing shots yield 115/162 saves (70.99%), pivot shots 44/77 (57.14%), breakthroughs 280/578 (48.44%), backcourt jumps 312/685 (45.55%), 7m 79/222 (35.59%) and wings 43/162 (26.54%). Empirical evidence is still needed to judge those distributions, especially the relation between line/breakthrough chance quality and observed saves. The highest case's strong rates in several favorable contexts warrant investigating keeper execution/reading and shooter execution, rather than assuming poor shot mix alone. A causal engine anomaly versus a plausible extreme remains UNKNOWN until independently sourced conditional expectations exist. Nothing has been tuned.

The positional output also warrants measurement against real data: M9 accounts for 514 of 1,013 goals (50.74%) and 997 of 2,064 shots (48.30%). Mean largest-scorer share is 44.05% across 40 team-match observations. These are explicit scouting/position diagnostics, not a claim that every M9 should have a particular target share.

Start with N and denominator, then category/pressure/quality exposure. Reference, context expectation, actual output and deviation are distinct fields in each match JSON. NO_REFERENCE is an unresolved comparison. Compare engine distributions only as observations unless a verified profile is supplied. Use current-engine/REPORT.md for the keeper context tables and summary.json for machine-readable distributions, sanity exceptions and proof hashes.
