# Current engine versus empirical handball

Engine N=20, swe-2. Reference season 2025-26; canonical fixture roster season remains 2026/27.

| Metric/scope | Engine N | Engine mean | Reference N | Reference mean | Coverage | Fallback | Status | Priority |
|---|---:|---:|---:|---:|---:|---|---|---:|
| goals/MATCH | 20 | 50.650 | 182 | 61.615 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 56.543 |
| possessions/MATCH | 20 | 129.800 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| shots/MATCH | 20 | 103.200 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| outfieldShots/MATCH | 20 | 103.200 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| outfieldConversion/MATCH | 20 | 0.489 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| savePct/MATCH | 20 | 0.465 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| sevenMetres/MATCH | 20 | 11.100 | 182 | 7.115 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 49.919 |
| sevenMetreConversion/MATCH | 20 | 0.643 | 182 | 0.750 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 13.392 |
| suspensions/MATCH | 20 | 11.850 | 182 | 5.769 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 91.000 |
| whistles/MATCH | 20 | 43.550 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| transitionShots/MATCH | 20 | 6.000 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| turnovers/MATCH | 20 | 31.550 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| savePct/KEEPER | 40 | 0.469 | 480 | 0.286 | 1.000 | GLOBAL | LIKELY PROBLEM | 50.358 |
| saves/KEEPER | 40 | 21.825 | 480 | 8.900 | 1.000 | GLOBAL | LIKELY PROBLEM | 47.320 |
| shotsFaced/KEEPER | 40 | 47.150 | 480 | 29.815 | 1.000 | GLOBAL | LIKELY PROBLEM | 24.903 |
| scorerConcentration/TEAM | 40 | 0.440 | 364 | 0.245 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 68.250 |
| shotConcentration/TEAM | 40 | 0.419 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |

## 30-save investigation

Percentiles are empirical CDFs. Above the observed maximum is not proof of impossibility. No shot-context/player ability adjustment is fitted.

- Match 8: 33/42 = 78.57%. Saves empirical percentile 1.000, rate percentile 1.000, N=480. Rate above observed maximum: true. EXPLICIT_CROSS_COMPETITION_PROXY: se_handbollsligan_herr. Classification EXTREME.

- Match 5: 31/48 = 64.58%. Saves empirical percentile 1.000, rate percentile 1.000, N=480. Rate above observed maximum: true. EXPLICIT_CROSS_COMPETITION_PROXY: se_handbollsligan_herr. Classification OUTLIER.

- Match 6: 31/51 = 60.78%. Saves empirical percentile 1.000, rate percentile 0.996, N=480. Rate above observed maximum: false. EXPLICIT_CROSS_COMPETITION_PROXY: se_handbollsligan_herr. Classification OUTLIER.

- Match 9: 30/53 = 56.60%. Saves empirical percentile 1.000, rate percentile 0.992, N=480. Rate above observed maximum: false. EXPLICIT_CROSS_COMPETITION_PROXY: se_handbollsligan_herr. Classification WATCH.

- Match 9: 29/41 = 70.73%. Saves empirical percentile 1.000, rate percentile 1.000, N=480. Rate above observed maximum: true. EXPLICIT_CROSS_COMPETITION_PROXY: se_handbollsligan_herr. Classification EXTREME.

## Ranked calibration priorities

100 Ã— impact Ã— confidence Ã— coverage Ã— sample weights Ã— (0.7 Ã— capped standardized mean difference + 0.3 Ã— fraction beyond 2 reference SD); prioritization heuristic, not a handball target

- suspensions/MATCH: SUPPORTED PROBLEM, priority 91.000, mean difference 6.081, standardized difference 2.522.
- scorerConcentration/TEAM: SUPPORTED PROBLEM, priority 68.250, mean difference 0.195, standardized difference 3.396.
- goals/MATCH: SUPPORTED PROBLEM, priority 56.543, mean difference -10.965, standardized difference -1.495.
- savePct/KEEPER: LIKELY PROBLEM, priority 50.358, mean difference 0.183, standardized difference 1.849.
- sevenMetres/MATCH: SUPPORTED PROBLEM, priority 49.919, mean difference 3.985, standardized difference 1.526.
- saves/KEEPER: LIKELY PROBLEM, priority 47.320, mean difference 12.925, standardized difference 2.769.
- shotsFaced/KEEPER: LIKELY PROBLEM, priority 24.903, mean difference 17.335, standardized difference 1.632.
- sevenMetreConversion/MATCH: SUPPORTED PROBLEM, priority 13.392, mean difference -0.107, standardized difference -0.595.

## Team expectation

Mapped team observations use competition baseline + historical team attack deviation + opponent goals-allowed deviation through the existing transparent expectation components. Unmapped or thin historical teams remain unresolved. This whole-season model is descriptive and has temporal leakage if misused for historical prediction.

## M9 and position evidence

Engine M9 share 50.74% (514/1013); official se_handbollsligan_herr season-table M9 share 18.97%, denominator 11041 recorded outfield/player goals. N=1 pooled season aggregate. This is descriptive position evidence, with registered-position versus release-role and competition-transfer caveats; no position-match z-score is claimed.

Engine M9 shot share 48.30% (997/2064); official se_handbollsligan_herr M9 shot share 20.16%, denominator 17816 official season attempts, including 7m exactly once. Supplemental profiles use match-benchmarks/1, POSITION_SEASON scope and N=1; they remain separate from the match catalog pinned by both completed engine batches.

## Retained Motion Continuity effects

Historical paired N=20, source docs/match-motion-continuity/final/comparison.json. For Allsvenskan, goals 47.25 â†’ 50.65 moved closer to the empirical 61.615 environment, while remaining below it.
Combined match save rate 42.23% â†’ 46.52%; contact whistles 21.1 â†’ 43.55; transition shots 2.35 â†’ 6. These are paired engine changes, not empirical whistle/transition comparisons. The combined historical save-rate aggregation is not substituted for the keeper-match reference distribution. Attribution of current rule gaps to Motion alone remains unresolved.

## Gaps and interpretation

NO REFERENCE remains honest for possessions, exact whistle/free throws, transition and detailed shot context. Official technical-error counts are retained under sourceTechnicalErrors rather than relabeled as canonical turnovers. Recorded outfield attempts exclude keeper shooting attempts. Scorer concentration is supported where player goals reconcile. Position-season aggregates are separate from match-level position distributions. No engine coefficient, gameplay attribute or match behavior has been changed.

## How to read the empirical benchmark

Check competition, reference season, coverage and denominator before deviation. EXACT_COMPETITION_SEASON and explicit GLOBAL keeper proxy are different evidence. SUPPORTED PROBLEM denotes a measurable descriptive mismatch in this fixed engine sample; LIKELY PROBLEM uses transferred evidence. Neither identifies a causal coefficient. Follow comparison.json for reference provenance, confidence, distributions, mean-difference caveats, team components and source hashes.
