# Current engine versus empirical handball

Engine N=20, se_handbollsligan_herr. Reference season 2025-26; canonical fixture roster season remains 2026/27.

| Metric/scope | Engine N | Engine mean | Reference N | Reference mean | Coverage | Fallback | Status | Priority |
|---|---:|---:|---:|---:|---:|---|---|---:|
| goals/MATCH | 20 | 51.100 | 182 | 60.857 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 58.270 |
| possessions/MATCH | 20 | 138.400 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| shots/MATCH | 20 | 111.750 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| outfieldShots/MATCH | 20 | 111.750 | 182 | 97.890 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 46.763 |
| outfieldConversion/MATCH | 20 | 0.457 | 182 | 0.620 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 53.700 |
| savePct/MATCH | 20 | 0.493 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| sevenMetres/MATCH | 20 | 8.900 | 182 | 6.582 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 31.240 |
| sevenMetreConversion/MATCH | 20 | 0.605 | 182 | 0.757 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 18.728 |
| suspensions/MATCH | 20 | 8.850 | 182 | 4.802 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 86.500 |
| whistles/MATCH | 20 | 40.000 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| transitionShots/MATCH | 20 | 7.050 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| turnovers/MATCH | 20 | 33.000 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| savePct/KEEPER | 40 | 0.492 | 480 | 0.286 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 86.500 |
| saves/KEEPER | 40 | 24.925 | 480 | 8.900 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 74.600 |
| shotsFaced/KEEPER | 40 | 50.475 | 480 | 29.815 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 46.684 |
| scorerConcentration/TEAM | 40 | 0.453 | 364 | 0.250 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 68.813 |
| shotConcentration/TEAM | 40 | 0.425 | 364 | 0.237 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 55.950 |

## 30-save investigation

Percentiles are empirical CDFs. Above the observed maximum is not proof of impossibility. No shot-context/player ability adjustment is fitted.

- Match 15: 39/59 = 66.10%. Saves empirical percentile 1.000, rate percentile 1.000, N=480. Rate above observed maximum: true. EXACT_COMPETITION_SEASON: se_handbollsligan_herr. Classification OUTLIER.

- Match 4: 36/51 = 70.59%. Saves empirical percentile 1.000, rate percentile 1.000, N=480. Rate above observed maximum: true. EXACT_COMPETITION_SEASON: se_handbollsligan_herr. Classification EXTREME.

- Match 8: 36/55 = 65.45%. Saves empirical percentile 1.000, rate percentile 1.000, N=480. Rate above observed maximum: true. EXACT_COMPETITION_SEASON: se_handbollsligan_herr. Classification OUTLIER.

- Match 19: 35/51 = 68.63%. Saves empirical percentile 1.000, rate percentile 1.000, N=480. Rate above observed maximum: true. EXACT_COMPETITION_SEASON: se_handbollsligan_herr. Classification EXTREME.

- Match 13: 34/53 = 64.15%. Saves empirical percentile 1.000, rate percentile 1.000, N=480. Rate above observed maximum: true. EXACT_COMPETITION_SEASON: se_handbollsligan_herr. Classification OUTLIER.

## Ranked calibration priorities

100 Ã— impact Ã— confidence Ã— coverage Ã— sample weights Ã— (0.7 Ã— capped standardized mean difference + 0.3 Ã— fraction beyond 2 reference SD); prioritization heuristic, not a handball target

- suspensions/MATCH: SUPPORTED PROBLEM, priority 86.500, mean difference 4.048, standardized difference 2.211.
- savePct/KEEPER: SUPPORTED PROBLEM, priority 86.500, mean difference 0.206, standardized difference 2.083.
- saves/KEEPER: SUPPORTED PROBLEM, priority 74.600, mean difference 16.025, standardized difference 3.433.
- scorerConcentration/TEAM: SUPPORTED PROBLEM, priority 68.813, mean difference 0.203, standardized difference 3.633.
- goals/MATCH: SUPPORTED PROBLEM, priority 58.270, mean difference -9.757, standardized difference -1.464.
- shotConcentration/TEAM: SUPPORTED PROBLEM, priority 55.950, mean difference 0.187, standardized difference 3.559.
- outfieldConversion/MATCH: SUPPORTED PROBLEM, priority 53.700, mean difference -0.163, standardized difference -3.240.
- outfieldShots/MATCH: SUPPORTED PROBLEM, priority 46.763, mean difference 13.860, standardized difference 1.841.
- shotsFaced/KEEPER: SUPPORTED PROBLEM, priority 46.684, mean difference 20.660, standardized difference 1.944.
- sevenMetres/MATCH: SUPPORTED PROBLEM, priority 31.240, mean difference 2.318, standardized difference 0.944.
- sevenMetreConversion/MATCH: SUPPORTED PROBLEM, priority 18.728, mean difference -0.152, standardized difference -0.849.

## Team expectation

Mapped team observations use competition baseline + historical team attack deviation + opponent goals-allowed deviation through the existing transparent expectation components. Unmapped or thin historical teams remain unresolved. This whole-season model is descriptive and has temporal leakage if misused for historical prediction.

## M9 and position evidence

Engine M9 share 48.43% (495/1022); official se_handbollsligan_herr season-table M9 share 18.97%, denominator 11041 recorded outfield/player goals. N=1 pooled season aggregate. This is descriptive position evidence, with registered-position versus release-role and competition-transfer caveats; no position-match z-score is claimed.

Engine M9 shot share 46.26% (1034/2235); official se_handbollsligan_herr M9 shot share 20.16%, denominator 17816 official season attempts, including 7m exactly once. Supplemental profiles use match-benchmarks/1, POSITION_SEASON scope and N=1; they remain separate from the match catalog pinned by both completed engine batches.

## Retained Motion Continuity effects

Historical paired N=20, source docs/match-motion-continuity/final/comparison.json. For Allsvenskan, goals 47.25 â†’ 50.65 moved closer to the empirical 61.615 environment, while remaining below it.
Combined match save rate 42.23% â†’ 46.52%; contact whistles 21.1 â†’ 43.55; transition shots 2.35 â†’ 6. These are paired engine changes, not empirical whistle/transition comparisons. The combined historical save-rate aggregation is not substituted for the keeper-match reference distribution. Attribution of current rule gaps to Motion alone remains unresolved.

## Gaps and interpretation

NO REFERENCE remains honest for possessions, exact whistle/free throws, transition and detailed shot context. Official technical-error counts are retained under sourceTechnicalErrors rather than relabeled as canonical turnovers. Recorded outfield attempts exclude keeper shooting attempts. Scorer concentration is supported where player goals reconcile. Position-season aggregates are separate from match-level position distributions. No engine coefficient, gameplay attribute or match behavior has been changed.

## How to read the empirical benchmark

Check competition, reference season, coverage and denominator before deviation. EXACT_COMPETITION_SEASON and explicit GLOBAL keeper proxy are different evidence. SUPPORTED PROBLEM denotes a measurable descriptive mismatch in this fixed engine sample; LIKELY PROBLEM uses transferred evidence. Neither identifies a causal coefficient. Follow comparison.json for reference provenance, confidence, distributions, mean-difference caveats, team components and source hashes.
