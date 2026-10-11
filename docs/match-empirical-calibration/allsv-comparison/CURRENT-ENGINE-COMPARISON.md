# Current engine versus empirical handball

Engine N=60, swe-2. Reference season 2025-26; canonical fixture roster season remains 2026/27.

| Metric/scope | Engine N | Engine mean | Reference N | Reference mean | Coverage | Fallback | Status | Priority |
|---|---:|---:|---:|---:|---:|---|---|---:|
| goals/MATCH | 60 | 60.083 | 182 | 61.615 | 1.000 | EXACT_COMPETITION_SEASON | UNRESOLVED | 7.030 |
| possessions/MATCH | 60 | 123.917 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| shots/MATCH | 60 | 94.283 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| outfieldShots/MATCH | 60 | 94.283 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| outfieldConversion/MATCH | 60 | 0.637 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| savePct/MATCH | 60 | 0.238 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| sevenMetres/MATCH | 60 | 4.817 | 182 | 7.115 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 24.645 |
| sevenMetreConversion/MATCH | 60 | 0.894 | 182 | 0.750 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 17.133 |
| suspensions/MATCH | 60 | 7.267 | 182 | 5.769 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 24.736 |
| whistles/MATCH | 60 | 20.683 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| transitionShots/MATCH | 60 | 4.283 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| turnovers/MATCH | 60 | 35.283 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| savePct/KEEPER | 120 | 0.240 | 480 | 0.286 | 1.000 | GLOBAL | LIKELY PROBLEM | 11.419 |
| saves/KEEPER | 120 | 9.417 | 480 | 8.900 | 1.000 | GLOBAL | UNRESOLVED | 2.144 |
| shotsFaced/KEEPER | 120 | 39.458 | 480 | 29.815 | 1.000 | GLOBAL | LIKELY PROBLEM | 12.389 |
| scorerConcentration/TEAM | 120 | 0.295 | 364 | 0.245 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 25.771 |
| shotConcentration/TEAM | 120 | 0.259 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |

## 30-save investigation

Percentiles are empirical CDFs. Above the observed maximum is not proof of impossibility. No shot-context/player ability adjustment is fitted.

- Match 36: 20/41 = 48.78%. Saves empirical percentile 0.998, rate percentile 0.977, N=480. Rate above observed maximum: false. EXPLICIT_CROSS_COMPETITION_PROXY: se_handbollsligan_herr. Classification WATCH.

- Match 19: 17/44 = 38.64%. Saves empirical percentile 0.965, rate percentile 0.865, N=480. Rate above observed maximum: false. EXPLICIT_CROSS_COMPETITION_PROXY: se_handbollsligan_herr. Classification NORMAL.

- Match 46: 17/41 = 41.46%. Saves empirical percentile 0.965, rate percentile 0.906, N=480. Rate above observed maximum: false. EXPLICIT_CROSS_COMPETITION_PROXY: se_handbollsligan_herr. Classification NORMAL.

- Match 56: 17/38 = 44.74%. Saves empirical percentile 0.965, rate percentile 0.942, N=480. Rate above observed maximum: false. EXPLICIT_CROSS_COMPETITION_PROXY: se_handbollsligan_herr. Classification NORMAL.

- Match 23: 16/45 = 35.56%. Saves empirical percentile 0.944, rate percentile 0.787, N=480. Rate above observed maximum: false. EXPLICIT_CROSS_COMPETITION_PROXY: se_handbollsligan_herr. Classification NORMAL.

## Ranked calibration priorities

100 Ã— impact Ã— confidence Ã— coverage Ã— sample weights Ã— (0.7 Ã— capped standardized mean difference + 0.3 Ã— fraction beyond 2 reference SD); prioritization heuristic, not a handball target

- scorerConcentration/TEAM: SUPPORTED PROBLEM, priority 25.771, mean difference 0.050, standardized difference 0.867.
- suspensions/MATCH: SUPPORTED PROBLEM, priority 24.736, mean difference 1.497, standardized difference 0.621.
- sevenMetres/MATCH: SUPPORTED PROBLEM, priority 24.645, mean difference -2.299, standardized difference -0.880.
- sevenMetreConversion/MATCH: SUPPORTED PROBLEM, priority 17.133, mean difference 0.144, standardized difference 0.802.
- shotsFaced/KEEPER: LIKELY PROBLEM, priority 12.389, mean difference 9.644, standardized difference 0.908.
- savePct/KEEPER: LIKELY PROBLEM, priority 11.419, mean difference -0.045, standardized difference -0.459.
- goals/MATCH: UNRESOLVED, priority 7.030, mean difference -1.532, standardized difference -0.209.
- saves/KEEPER: UNRESOLVED, priority 2.144, mean difference 0.517, standardized difference 0.111.

## Team expectation

Mapped team observations use competition baseline + historical team attack deviation + opponent goals-allowed deviation through the existing transparent expectation components. Unmapped or thin historical teams remain unresolved. This whole-season model is descriptive and has temporal leakage if misused for historical prediction.

## M9 and position evidence

Engine M9 share 19.31% (696/3605); official se_handbollsligan_herr season-table M9 share 18.97%, denominator 11041 recorded outfield/player goals. N=1 pooled season aggregate. This is descriptive position evidence, with registered-position versus release-role and competition-transfer caveats; no position-match z-score is claimed.

Engine M9 shot share 16.83% (952/5657); official se_handbollsligan_herr M9 shot share 20.16%, denominator 17816 official season attempts, including 7m exactly once. Supplemental profiles use match-benchmarks/1, POSITION_SEASON scope and N=1; they remain separate from the match catalog pinned by both completed engine batches.

## Retained Motion Continuity effects

Historical paired N=20, source docs/match-motion-continuity/final/comparison.json. For Allsvenskan, goals 47.25 â†’ 50.65 moved closer to the empirical 61.615 environment, while remaining below it.
Combined match save rate 42.23% â†’ 46.52%; contact whistles 21.1 â†’ 43.55; transition shots 2.35 â†’ 6. These are paired engine changes, not empirical whistle/transition comparisons. The combined historical save-rate aggregation is not substituted for the keeper-match reference distribution. Attribution of current rule gaps to Motion alone remains unresolved.

## Gaps and interpretation

NO REFERENCE remains honest for possessions, exact whistle/free throws, transition and detailed shot context. Official technical-error counts are retained under sourceTechnicalErrors rather than relabeled as canonical turnovers. Recorded outfield attempts exclude keeper shooting attempts. Scorer concentration is supported where player goals reconcile. Position-season aggregates are separate from match-level position distributions. No engine coefficient, gameplay attribute or match behavior has been changed.

## How to read the empirical benchmark

Check competition, reference season, coverage and denominator before deviation. EXACT_COMPETITION_SEASON and explicit GLOBAL keeper proxy are different evidence. SUPPORTED PROBLEM denotes a measurable descriptive mismatch in this fixed engine sample; LIKELY PROBLEM uses transferred evidence. Neither identifies a causal coefficient. Follow comparison.json for reference provenance, confidence, distributions, mean-difference caveats, team components and source hashes.
